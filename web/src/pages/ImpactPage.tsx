/**
 * S10 - Impact dashboard (docs/06-UI-SPEC.md § 13). OWNER: M1.
 *
 * Minimal pass: charts are skipped in favour of the two tables the spec
 * already requires as the data-table-toggle fallback (docs/07 § 7 accessibility
 * pass); the date-range filter (`[All time ▾]` in the mockup) is cut too -
 * all-time only, `ImpactQuery.from`/`.to` are never sent.
 *
 * `scope=MINE` needs the acting business (docs/04 § 3 `GET /v1/impact`); if
 * none is resolved yet, this falls back to `PLATFORM` rather than blocking
 * the page. The query key carries both `scope` and the acting business id
 * (api/queries.ts `useImpact`) so switching "Acting as" refetches even
 * though `setActingBusiness` also resets the cache.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { label } from '@dse/shared';
import type { ImpactResponse, ImpactScope } from '@dse/shared';
import { ApiError } from '../api/client.js';
import { useImpact } from '../api/queries.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { Button } from '../components/Button.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { StatTile } from '../components/StatTile.js';
import { Tabs } from '../components/Tabs.js';
import type { TabItem } from '../components/Tabs.js';
import { formatDate, formatInr, formatQuantity } from '../lib/format.js';

const OTHER_UNITS = ['UNITS', 'SHEETS', 'METRES'] as const;

const TABS: TabItem[] = [
  { value: 'PLATFORM', label: 'Platform', panelId: 'impact-content' },
  { value: 'MINE', label: 'My business', panelId: 'impact-content' },
];

function ImpactSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="card" className="h-40" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile loading value={undefined} label="" />
        <StatTile loading value={undefined} label="" />
        <StatTile loading value={undefined} label="" />
        <StatTile loading value={undefined} label="" />
      </div>
    </div>
  );
}

function ImpactContent({ data }: { data: ImpactResponse }): React.JSX.Element {
  const [showTable, setShowTable] = useState(false);
  const { totals, byCategory, dailySeries, meta } = data;

  const otherUnits = OTHER_UNITS.filter((unit) => totals.quantityReusedByUnit[unit] > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-ink-200 bg-white px-6 py-10 text-center shadow-card">
        <p className="text-[48px] font-bold leading-[56px] text-ink-900">
          {formatQuantity(totals.quantityReusedByUnit.KG, 'KG')}
        </p>
        <p className="mt-1 text-[15px] text-ink-600">material reused through the exchange</p>
        {otherUnits.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            {otherUnits.map((unit) => (
              <p key={unit} className="text-[15px] text-ink-900">
                <span className="font-semibold">{formatQuantity(totals.quantityReusedByUnit[unit], unit)}</span>{' '}
                <span className="text-ink-600">reused</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile value={totals.completedExchanges} label="completed exchanges" />
        <StatTile value={`${totals.fulfilmentRatePct}%`} label="of requirements filled" />
        <StatTile value={formatQuantity(totals.activeSurplusByUnit.KG, 'KG')} label="surplus still live" />
        {totals.estimatedProcurementAvoidedInr !== undefined && (
          <StatTile
            value={`${formatInr(totals.estimatedProcurementAvoidedInr)} (est)`}
            label="procurement avoided"
            tooltip="Based on reference prices stated by suppliers. Estimate only."
          />
        )}
      </div>

      <div>
        <Button
          variant="ghost"
          aria-expanded={showTable}
          aria-controls="impact-data-tables"
          onClick={() => setShowTable((current) => !current)}
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </Button>

        {showTable && (
          <div id="impact-data-tables" className="mt-4 flex flex-col gap-6">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">By category</h2>
              {byCategory.length === 0 ? (
                <p className="mt-2 text-[13px] text-ink-600">No category data yet.</p>
              ) : (
                <table className="mt-2 w-full text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-ink-200 text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Reused</th>
                      <th className="py-2 pr-4">Unit</th>
                      <th className="py-2 pr-4">Exchanges</th>
                      <th className="py-2">Active surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCategory.map((row) => (
                      <tr key={row.category} className="border-b border-ink-100">
                        <td className="py-2 pr-4 text-ink-900">{label('category', row.category) ?? row.category}</td>
                        <td className="py-2 pr-4 tabular-nums text-ink-900">{row.quantityReused}</td>
                        <td className="py-2 pr-4 text-ink-600">{label('unit', row.unit) ?? row.unit}</td>
                        <td className="py-2 pr-4 tabular-nums text-ink-900">{row.completedExchanges}</td>
                        <td className="py-2 tabular-nums text-ink-900">{row.activeSurplus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Daily</h2>
              {dailySeries.length === 0 ? (
                <p className="mt-2 text-[13px] text-ink-600">No daily data yet.</p>
              ) : (
                <table className="mt-2 w-full text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-ink-200 text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Reused</th>
                      <th className="py-2">Exchanges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySeries.map((row) => (
                      <tr key={row.date} className="border-b border-ink-100">
                        <td className="py-2 pr-4 text-ink-900">{formatDate(row.date)}</td>
                        <td className="py-2 pr-4 tabular-nums text-ink-900">{row.quantityReused}</td>
                        <td className="py-2 tabular-nums text-ink-900">{row.completedExchanges}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[12px] text-ink-600">
        Every figure above derives from {meta.sourceRecordCount} completed handoff record
        {meta.sourceRecordCount === 1 ? '' : 's'}.
      </p>
    </div>
  );
}

export function ImpactPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const acting = useActingBusiness();

  const scopeParam = searchParams.get('scope');
  const requestedScope: ImpactScope = scopeParam === 'MINE' ? 'MINE' : 'PLATFORM';
  const actingBusinessId = acting.status === 'ready' ? acting.business.businessId : null;
  const effectiveScope: ImpactScope = requestedScope === 'MINE' && actingBusinessId ? 'MINE' : 'PLATFORM';

  const impactQuery = useImpact({ scope: effectiveScope }, actingBusinessId);

  function handleScopeChange(next: string): void {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('scope', next);
        return params;
      },
      { replace: true },
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Impact
        </h1>
        <Tabs tabs={TABS} value={requestedScope} onChange={handleScopeChange} />
      </div>

      <div id="impact-content" role="tabpanel" className="mt-6">
        {impactQuery.isPending ? (
          <ImpactSkeleton />
        ) : impactQuery.isError ? (
          <ErrorState
            message={
              impactQuery.error instanceof ApiError ? impactQuery.error.message : 'Cannot reach the exchange. Try again.'
            }
            code={impactQuery.error instanceof ApiError ? impactQuery.error.code : undefined}
            onRetry={() => void impactQuery.refetch()}
          />
        ) : (
          <ImpactContent data={impactQuery.data} />
        )}
      </div>
    </div>
  );
}
