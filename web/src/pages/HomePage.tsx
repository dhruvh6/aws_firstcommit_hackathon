/**
 * S1 - Home (docs/06-UI-SPEC.md § 4). Stub only - OWNER: M1 builds this
 * screen out on a later Day 1/2 task (build order: docs/06 § 2 puts S1
 * last, after the reservation flow).
 */
export function HomePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        Home
      </h1>
      <p className="mt-2 text-[15px] text-ink-600">Coming soon.</p>
    </div>
  );
}
