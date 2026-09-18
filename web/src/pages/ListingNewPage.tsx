/**
 * S4 - List Surplus (docs/06-UI-SPEC.md § 7). OWNER: M1.
 *
 * Supplier-side, so speed matters more than polish. Attribute fields (§ 2 of
 * the form) render entirely from `meta.categories[].attributeFields` - no
 * per-category branching in this file. Client validation mirrors
 * docs/04-API-CONTRACT.md § 3 exactly (ListingNewPage.validation.ts) but the
 * server stays the authority: a 400 VALIDATION_FAILED always wins over
 * whatever this page already believed.
 *
 * No photo field - POST /v1/uploads/listing-photo is cut (docs/04 § 2). No
 * post-create "matches" banner - GET /v1/listings/{id}/matches is cut too.
 */
import { useMemo, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CONDITIONS, HANDOFF_MODES, label } from '@dse/shared';
import type { EnumLabels, LabelKind, MetaField, Unit } from '@dse/shared';
import { ApiError, createListing } from '../api/client.js';
import { useMetaCategories } from '../api/queries.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { toast } from '../state/toast.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { Select } from '../components/Select.js';
import { Textarea } from '../components/Textarea.js';
import { DatePicker } from '../components/DatePicker.js';
import { RadioGroup } from '../components/RadioGroup.js';
import { TilePicker } from '../components/TilePicker.js';
import { Skeleton } from '../components/Skeleton.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  INITIAL_LISTING_FORM,
  buildCreateListingRequest,
  fieldId,
  fieldOrder,
  isKnownCategory,
  validateAll,
  validateField,
} from './ListingNewPage.validation.js';
import type { ListingFormState } from './ListingNewPage.validation.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-6 py-10">
      <Skeleton variant="text" className="h-8 w-64" />
      <Skeleton variant="card" className="h-56" />
      <Skeleton variant="card" className="h-72" />
      <Skeleton variant="card" className="h-48" />
    </div>
  );
}

/** Focuses the DOM node behind a field path, however that field is composed. */
function focusField(path: string): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(fieldId(path));
    if (!el) return;
    if (el.getAttribute('role') === 'radiogroup') {
      const control = el.querySelector<HTMLElement>('[role="radio"], input');
      control?.focus();
      return;
    }
    el.focus();
  });
}

export function ListingNewPage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const metaQuery = useMetaCategories();
  const acting = useActingBusiness();

  const today = useMemo(() => todayIso(), []);
  const [state, setState] = useState<ListingFormState>(() => ({ ...INITIAL_LISTING_FORM, availableFrom: today }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  const categories = metaQuery.data?.items ?? [];
  const categoryMeta = state.category ? (categories.find((c) => c.code === state.category) ?? null) : null;

  function enumLabel(kind: keyof EnumLabels, value: string): string {
    const fromMeta = metaQuery.data?.enumLabels[kind] as Record<string, string> | undefined;
    return fromMeta?.[value] ?? label(kind as LabelKind, value) ?? value;
  }

  const mutation = useMutation({
    mutationFn: createListing,
    meta: { silentErrorToast: true },
    onSuccess: (listing) => {
      toast.success('Listing created');
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      navigate(`/listings/${listing.listingId}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        const path = error.field;
        const known = path ? fieldOrder(categoryMeta).includes(path) : false;
        if (path && known) {
          setErrors((prev) => ({ ...prev, [path]: error.message }));
          setTouched((prev) => ({ ...prev, [path]: true }));
          setFormError(null);
          focusField(path);
          return;
        }
        setFormError(error.message);
        focusSummary();
        return;
      }
      const message = error instanceof ApiError ? error.message : 'Cannot reach the exchange. Try again.';
      setFormError(message);
      toast.error(message);
      focusSummary();
    },
  });

  if (metaQuery.isPending || acting.status === 'loading') {
    return <PageSkeleton />;
  }

  if (metaQuery.isError) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <h1 tabIndex={-1} className="mb-6 text-2xl font-bold text-ink-900">
          List surplus
        </h1>
        <ErrorState
          message={
            metaQuery.error instanceof ApiError
              ? metaQuery.error.message
              : 'Could not load material categories.'
          }
          code={metaQuery.error instanceof ApiError ? metaQuery.error.code : undefined}
          onRetry={() => void metaQuery.refetch()}
        />
      </div>
    );
  }

  if (acting.status === 'error') {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <h1 tabIndex={-1} className="mb-6 text-2xl font-bold text-ink-900">
          List surplus
        </h1>
        <ErrorState
          message={acting.error instanceof ApiError ? acting.error.message : 'Could not identify your business.'}
          onRetry={acting.retry}
        />
      </div>
    );
  }

  const { business } = acting;

  function focusSummary(): void {
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function clearFieldError(path: string): void {
    setErrors((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }

  function setField<K extends keyof ListingFormState>(key: K, value: ListingFormState[K]): void {
    setFormError(null);
    setState((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  }

  function setAttribute(key: string, value: string): void {
    setFormError(null);
    setState((prev) => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
    clearFieldError(`attributes.${key}`);
  }

  function handleBlur(path: string): void {
    setTouched((prev) => ({ ...prev, [path]: true }));
    const message = validateField(path, state, categoryMeta, today);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[path] = message;
      else delete next[path];
      return next;
    });
  }

  function fieldError(path: string): string | undefined {
    if (!(touched[path] || submitAttempted)) return undefined;
    return errors[path];
  }

  function handleCategoryChange(value: string): void {
    if (!isKnownCategory(value)) return;
    const meta = categories.find((c) => c.code === value) ?? null;
    setFormError(null);
    setState((prev) => ({
      ...prev,
      category: value,
      unit: meta?.canonicalUnit ?? null,
      attributes: {},
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.category;
      delete next.unit;
      for (const key of Object.keys(next)) {
        if (key.startsWith('attributes.')) delete next[key];
      }
      return next;
    });
  }

  function handleCancel(): void {
    if (location.key === 'default') navigate('/');
    else navigate(-1);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mutation.isPending) return;

    const allErrors = validateAll(state, categoryMeta, today);
    setErrors(allErrors);
    setSubmitAttempted(true);

    const order = fieldOrder(categoryMeta);
    const firstInvalid = order.find((path) => allErrors[path]);
    if (firstInvalid || !categoryMeta) {
      setFormError('Fix the highlighted fields before submitting.');
      focusSummary();
      return;
    }

    setFormError(null);
    mutation.mutate(buildCreateListingRequest(state, categoryMeta));
  }

  function renderAttributeField(field: MetaField): React.JSX.Element {
    const path = `attributes.${field.key}`;
    const id = fieldId(path);
    const raw = state.attributes[field.key] ?? '';
    const error = fieldError(path);

    if (field.type === 'number') {
      return (
        <Input
          id={id}
          label={field.label}
          required={field.required}
          type="number"
          inputMode="decimal"
          step="any"
          min={field.min}
          max={field.max}
          value={raw}
          onChange={(event) => setAttribute(field.key, event.target.value)}
          onBlur={() => handleBlur(path)}
          error={error}
        />
      );
    }

    if (field.type === 'boolean') {
      return (
        <RadioGroup
          id={id}
          name={id}
          label={field.label}
          required={field.required}
          options={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          value={raw === '' ? null : raw}
          onChange={(value) => {
            setAttribute(field.key, value);
            handleBlur(path);
          }}
          error={error}
        />
      );
    }

    return (
      <Input
        id={id}
        label={field.label}
        required={field.required}
        maxLength={field.maxLength}
        value={raw}
        onChange={(event) => setAttribute(field.key, event.target.value)}
        onBlur={() => handleBlur(path)}
        error={error}
      />
    );
  }

  const soleUnit = categoryMeta && categoryMeta.allowedUnits.length === 1 ? categoryMeta.allowedUnits[0] : undefined;
  const referencePriceUnit = state.unit ? enumLabel('unit', state.unit) : undefined;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        List your surplus material
      </h1>

      {formError && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="mt-4 rounded-lg border border-danger-050 bg-danger-050 px-4 py-3 text-[15px] text-danger-700"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="text-[20px] font-semibold leading-7 text-ink-900">1. What material</legend>

          <TilePicker
            id={fieldId('category')}
            label="Category"
            required
            value={state.category}
            options={categories.map((c) => ({ value: c.code, label: c.label, icon: c.icon }))}
            onChange={handleCategoryChange}
            error={fieldError('category')}
          />

          <Input
            id={fieldId('title')}
            label="Title"
            required
            value={state.title}
            maxLength={80}
            placeholder="Plywood offcuts, clean and dry"
            onChange={(event) => setField('title', event.target.value)}
            onBlur={() => handleBlur('title')}
            error={fieldError('title')}
            helper={fieldError('title') ? undefined : `${state.title.length}/80`}
          />

          <Textarea
            id={fieldId('description')}
            label="Description"
            value={state.description}
            maxLength={500}
            onChange={(event) => setField('description', event.target.value)}
            onBlur={() => handleBlur('description')}
            error={fieldError('description')}
          />
        </fieldset>

        {categoryMeta && (
          <fieldset className="flex flex-col gap-4">
            <legend className="text-[20px] font-semibold leading-7 text-ink-900">2. How much, what state</legend>

            <div className={cx(soleUnit === undefined && 'grid grid-cols-2 gap-4')}>
              <Input
                id={fieldId('totalQuantity')}
                label="Quantity"
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={state.totalQuantity}
                suffix={soleUnit !== undefined ? enumLabel('unit', soleUnit) : undefined}
                onChange={(event) => setField('totalQuantity', event.target.value)}
                onBlur={() => handleBlur('totalQuantity')}
                error={fieldError('totalQuantity')}
              />
              {soleUnit === undefined && (
                <Select
                  id={fieldId('unit')}
                  label="Unit"
                  required
                  value={state.unit ?? ''}
                  options={categoryMeta.allowedUnits.map((u) => ({ value: u, label: enumLabel('unit', u) }))}
                  onChange={(event) => setField('unit', event.target.value as Unit)}
                  onBlur={() => handleBlur('unit')}
                  error={fieldError('unit')}
                />
              )}
            </div>

            <RadioGroup
              id={fieldId('condition')}
              name={fieldId('condition')}
              label="Condition"
              required
              options={CONDITIONS.map((c) => ({ value: c, label: enumLabel('condition', c) }))}
              value={state.condition}
              onChange={(value) => {
                setField('condition', value as ListingFormState['condition']);
                handleBlur('condition');
              }}
              error={fieldError('condition')}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {categoryMeta.attributeFields.map((field) => (
                <div key={field.key} className={field.type === 'number' ? undefined : 'sm:col-span-2'}>
                  {renderAttributeField(field)}
                </div>
              ))}
            </div>

            <Input
              id={fieldId('referencePriceInr')}
              label="Reference price"
              type="number"
              inputMode="numeric"
              step="1"
              min={1}
              max={100000}
              prefix="₹"
              suffix={referencePriceUnit ? `per ${referencePriceUnit}` : undefined}
              value={state.referencePriceInr}
              onChange={(event) => setField('referencePriceInr', event.target.value)}
              onBlur={() => handleBlur('referencePriceInr')}
              error={fieldError('referencePriceInr')}
              helper={fieldError('referencePriceInr') ? undefined : 'Used only for an estimated-savings figure'}
            />
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="text-[20px] font-semibold leading-7 text-ink-900">3. When and how</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              id={fieldId('availableFrom')}
              label="Available from"
              required
              min={today}
              value={state.availableFrom}
              onChange={(event) => setField('availableFrom', event.target.value)}
              onBlur={() => handleBlur('availableFrom')}
              error={fieldError('availableFrom')}
            />
            <DatePicker
              id={fieldId('availableUntil')}
              label="Available until"
              required
              min={state.availableFrom || today}
              max={addDays(today, 90)}
              value={state.availableUntil}
              onChange={(event) => setField('availableUntil', event.target.value)}
              onBlur={() => handleBlur('availableUntil')}
              error={fieldError('availableUntil')}
            />
          </div>

          <RadioGroup
            id={fieldId('handoffMode')}
            name={fieldId('handoffMode')}
            label="Handoff"
            required
            options={HANDOFF_MODES.map((h) => ({ value: h, label: enumLabel('handoffMode', h) }))}
            value={state.handoffMode}
            onChange={(value) => {
              setField('handoffMode', value as ListingFormState['handoffMode']);
              handleBlur('handoffMode');
            }}
            error={fieldError('handoffMode')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-700">Pickup location</span>
            <p className="text-[15px] text-ink-900">
              {business.area}, {business.city}
            </p>
            <p className="text-[13px] text-ink-600">From your business profile</p>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            List surplus material
          </Button>
        </div>
      </form>
    </div>
  );
}
