/**
 * docs/06-UI-SPEC.md § 2 "/* Not found".
 * OWNER: M1.
 */
export function NotFoundPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        Page not found
      </h1>
      <p className="mt-2 text-[15px] text-ink-600">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
    </div>
  );
}
