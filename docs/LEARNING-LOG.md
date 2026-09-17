# Learning Log

Append daily. Four lines per entry, one entry per member per day. Newest at the bottom.

**Learning is an official judging category** ([rules](../First_Commit_2026_Complete_Rules_Checklist.md)
§ 14.3). Written as it happens, this reads as specific and credible; reconstructed on Day 4,
it reads exactly like what it is.

Format:

```markdown
## YYYY-MM-DD - M<N>
- Learned:
- Failed first:
- Changed:
- Trade-off:
```

Worth recording: a service you had never used; something that failed and why; why you chose
one service over another; an architecture or IAM lesson; a trade-off you discovered; a bug
that taught you something about the platform rather than about your own typo.

Not worth recording: "fixed a typo", "styled the button", anything you already knew.

---

## 2026-09-17 - M4
- Learned: writing the API contract, domain model and matching rules before any code turns
  four people on four machines from a coordination problem into four independent tasks.
- Failed first: the original brief kept a `Match` table; persisting it would have needed a
  sync step between the matching engine and storage, owned by two different people.
- Changed: matches are computed on request and snapshotted onto the reservation, so the only
  durable copy is the one that must be durable.
- Trade-off: no match history for analytics - acceptable, since reservations carry the
  reasons that actually mattered.

## 2026-09-17 - M4 (history correction)

**What commit `141eebe` actually contains.** Its message reads *"docs: record M4,
point slot claims and eligibility at issue #1, confirm Ship It"*, but the commit
also introduced `shared/src/domain.ts` (294 lines) and `shared/src/api.ts` (502
lines) - the full transcription of the frozen docs/02 and docs/04. Those files
were produced in a parallel session, were sitting uncommitted in the working
tree, and were swept in by a `git add -A`. The message does not mention them.

- Learned: `git add -A` commits whatever is in the tree, not what you worked on.
  On a shared repository whose history gets inspected, the commit message and the
  diff have to agree.
- Failed first: staging everything by habit rather than staging the files the
  commit is about.
- Changed: stage explicit paths. `main` is shared and already pushed, so the
  history is not being rewritten - this note is the correction instead.
- Trade-off: one commit in the log under-describes its diff. Recorded here rather
  than force-pushed, because rewriting shared history is worse than an inaccurate
  message, and docs/09 § 1 forbids it.

Both files were reviewed after the fact against the frozen specs: all seven
enums, all eight entity interfaces, the six match-check codes in documented
order, and every error code in docs/04 § 4 are present and faithful.

## 2026-09-18 - M4

- Learned: a self-referential CSS custom property (`--radius-md: var(--radius-md)`)
  is invalid at computed-value time, so it fails **silently** - no build error, no
  console warning, green CI, and every `rounded-*`, `shadow-*` and `font-sans`
  utility quietly resolving to nothing.
- Failed first: reviewing the token file by reading it. The cycle is invisible in
  the source, because the two colliding declarations live in different blocks.
- Changed: reviewed the **built** CSS instead, where both declarations appear in
  the same `:root` and the self-reference wins. Tailwind's theme keys for the
  radius, shadow and font namespaces collide with the design system's own token
  names; colours do not, because they are prefixed `--color-*`.
- Trade-off: those three namespaces now have their literal values in `@theme`
  rather than in the `:root` block, so tokens.css has two sources of truth by
  namespace instead of one. `@theme static` keeps them emitted even when no
  utility references them yet.
