/**
 * S5 - Post a Requirement (docs/06-UI-SPEC.md § 8). OWNER: M1.
 *
 * Mirrors ListingNewPage.tsx's layout and validation approach so the two
 * sides of the exchange feel like one product. Constraint fields (§ 2 of
 * the form) render entirely from `meta.categories[].constraintFields` - no
 * per-category branching in this file. Every constraint is optional and a
 * blank value is omitted from the request body, never sent as '', 0 or
 * false (docs/03-MATCHING-SPEC.md § 4's absent-constraint semantics).
 *
 * Submit calls POST /v1/requirements?withMatches=true and writes the match
 * set straight into the TanStack cache under the exact key S6 reads
 * (api/queries.ts's requirementMatchesKey), then navigates - no second
 * spinner between submit and results (docs/06 § 8, the demo's 1:35 WOW
 * moment).
 */
import { useMemo, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CONDITIONS, label } from '@dse/shared';
import type { EnumLabels, LabelKind, MetaField, RequirementMatchesResponse, Unit } from '@dse/shared';
import { ApiError, createRequirementWithMatches } from '../api/client.js';
import { requirementMatchesKey, useMetaCategories } from '../api/queries.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { toast } from '../state/toast.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { Select } from '../components/Select.js';
import { Textarea } from '../components/Textarea.js';
import { DatePicker } from '../components/DatePicker.js';
import { RadioGroup } from '../components/RadioGroup.js';
import { CheckboxGroup } from '../components/CheckboxGroup.js';
import { TilePicker } from '../components/TilePicker.js';
import { Skeleton } from '../components/Skeleton.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  INITIAL_REQUIREMENT_FORM,
  RADIUS_OPTIONS,
  buildCreateRequirementRequest,
  fieldId,
  fieldOrder,
  isKnownCategory,
  validateAll,
  validateField,
} from './RequirementNewPage.validation.js';
import type { RequirementFormState } from './RequirementNewPage.validation.js';

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
    if (el.getAttribute('role') === 'radiogroup' || el.getAttribute('role') === 'group') {
      const control = el.querySelector<HTMLElement>('[role="radio"], input');
      control?.focus();
      return;
    }
    el.focus();
  });
}

export function RequirementNewPage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const metaQuery = useMetaCategories();
  const acting = useActingBusiness();

  const today = useMemo(() => todayIso(), []);
  const [state, setState] = useState<RequirementFormState>(INITIAL_REQUIREMENT_FORM);
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
    mutationFn: createRequirementWithMatches,
    meta: { silentErrorToast: true },
    onSuccess: (response) => {
      const { requirement, matches } = response;
      const compatibleCount = matches.filter((m) => m.compatible).length;
      const shaped: RequirementMatchesResponse = {
        requirement,
        items: matches,
        meta: {
          count: matches.length,
          compatibleCount,
          nearMissCount: matches.length - compatibleCount,
          truncated: false,
          evaluatedAt: new Date().toISOString(),
        },
      };
      queryClient.setQueryData(requirementMatchesKey(requirement.requirementId), shaped);
      toast.success('Requirement posted');
      navigate(`/requirements/${requirement.requirementId}/matches`);
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
          Post a requirement
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
          Post a requirement
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

  function setField<K extends keyof RequirementFormState>(key: K, value: RequirementFormState[K]): void {
    setFormError(null);
    setState((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  }

  function setConstraint(key: string, value: string): void {
    setFormError(null);
    setState((prev) => ({ ...prev, constraints: { ...prev.constraints, [key]: value } }));
    clearFieldError(`constraints.${key}`);
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
      constraints: {},
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.category;
      delete next.unit;
      for (const key of Object.keys(next)) {
        if (key.startsWith('constraints.')) delete next[key];
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
    mutation.mutate(buildCreateRequirementRequest(state, categoryMeta));
  }

  function renderConstraintField(field: MetaField): React.JSX.Element {
    const path = `constraints.${field.key}`;
    const id = fieldId(path);
    const raw = state.constraints[field.key] ?? '';
    const error = fieldError(path);

    if (field.type === 'number') {
      return (
        <Input
          id={id}
          label={field.label}
          type="number"
          inputMode="decimal"
          step="any"
          min={field.min}
          max={field.max}
          value={raw}
          onChange={(event) => setConstraint(field.key, event.target.value)}
          onBlur={() => handleBlur(path)}
          error={error}
          helper={error ? undefined : field.helper}
        />
      );
    }

    if (field.type === 'boolean') {
      return (
        <RadioGroup
          id={id}
          name={id}
          label={field.label}
          options={[
            { value: '', label: 'No preference' },
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          value={raw}
          onChange={(value) => {
            setConstraint(field.key, value);
            handleBlur(path);
          }}
          error={error}
          helper={error ? undefined : field.helper}
        />
      );
    }

    return (
      <Input
        id={id}
        label={field.label}
        maxLength={field.maxLength}
        value={raw}
        onChange={(event) => setConstraint(field.key, event.target.value)}
        onBlur={() => handleBlur(path)}
        error={error}
        helper={error ? undefined : field.helper}
      />
    );
  }

  const soleUnit = categoryMeta && categoryMeta.allowedUnits.length === 1 ? categoryMeta.allowedUnits[0] : undefined;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        Tell us what material you need
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
          <legend className="text-[20px] font-semibold leading-7 text-ink-900">1. What you need</legend>

          <TilePicker
            id={fieldId('category')}
            label="Category"
            required
            value={state.category}
            options={categories.map((c) => ({ value: c.code, label: c.label, icon: c.icon }))}
            onChange={handleCategoryChange}
            error={fieldError('category')}
          />

          {categoryMeta && (
            <div className={cx(soleUnit === undefined && 'grid grid-cols-2 gap-4')}>
              <Input
                id={fieldId('requestedQuantity')}
                label="Quantity needed"
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={state.requestedQuantity}
                suffix={soleUnit !== undefined ? enumLabel('unit', soleUnit) : undefined}
                onChange={(event) => setField('requestedQuantity', event.target.value)}
                onBlur={() => handleBlur('requestedQuantity')}
                error={fieldError('requestedQuantity')}
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
          )}

          <DatePicker
            id={fieldId('requiredBy')}
            label="Needed by"
            required
            min={today}
            max={addDays(today, 90)}
            value={state.requiredBy}
            onChange={(event) => setField('requiredBy', event.target.value)}
            onBlur={() => handleBlur('requiredBy')}
            error={fieldError('requiredBy')}
          />
        </fieldset>

        {categoryMeta && (
          <fieldset className="flex flex-col gap-4">
            <legend className="text-[20px] font-semibold leading-7 text-ink-900">2. What will work for you</legend>

            <CheckboxGroup
              id={fieldId('acceptedConditions')}
              name={fieldId('acceptedConditions')}
              label="Acceptable condition"
              required
              options={CONDITIONS.map((c) => ({ value: c, label: enumLabel('condition', c) }))}
              value={state.acceptedConditions}
              onChange={(value) => {
                setField('acceptedConditions', value);
                handleBlur('acceptedConditions');
              }}
              error={fieldError('acceptedConditions')}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {categoryMeta.constraintFields.map((field) => (
                <div key={field.key} className={field.type === 'number' ? undefined : 'sm:col-span-2'}>
                  {renderConstraintField(field)}
                </div>
              ))}
            </div>

            <Textarea
              id={fieldId('notes')}
              label="Notes"
              value={state.notes}
              maxLength={500}
              onChange={(event) => setField('notes', event.target.value)}
              onBlur={() => handleBlur('notes')}
              error={fieldError('notes')}
            />
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="text-[20px] font-semibold leading-7 text-ink-900">3. How far you will travel</legend>

          <RadioGroup
            id={fieldId('radiusKm')}
            name={fieldId('radiusKm')}
            label="Search radius"
            required
            options={RADIUS_OPTIONS.map((r) => ({ value: r, label: `${r} km` }))}
            value={state.radiusKm}
            onChange={(value) => {
              setField('radiusKm', value);
              handleBlur('radiusKm');
            }}
            error={fieldError('radiusKm')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-700">From</span>
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
            Find matching surplus
          </Button>
        </div>
      </form>
    </div>
  );
}
