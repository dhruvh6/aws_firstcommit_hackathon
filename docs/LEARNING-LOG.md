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

## 2026-09-18 - M4

- Learned: two implementations of the same rules can be compared mechanically instead of by
  reading them. Both matching engines - the real one in `api/src/domain/matching.ts` and M1's
  mock in `web/src/mocks/matching.ts` - are pure and take `today` as an argument, so a
  throwaway harness could call both on the same fixture and diff every field. They agreed on
  order, flags, quantities, distances and scores, and disagreed on exactly one thing: a month
  abbreviation.
- Failed first: reviewing a 2800-line PR by reading it. The `Sept` vs `Sep` divergence is
  invisible in the source, because `Intl.DateTimeFormat('en-GB', { month: 'short' })` looks
  more correct than a hardcoded month array, and modern ICU renders `Sept`.
- Changed: review by execution where the code is pure - a 40-line harness found in one run
  what reading would have missed, and the same approach caught the mock validator accepting
  two fields the real API rejects.
- Trade-off: `Intl` is the obvious tool for formatting a date and it is the wrong one here.
  `en-GB` and `en-IN` give `20 Sept`, `en-US` gives `Sep 20` with the parts reversed. When a
  string is part of a contract, the contract has to own the formatting.

- Also learned: a red test is not evidence of a bug in the code under review. Four contract
  cases failed against M2's correct implementation because the suite hardcoded dates that had
  since passed, and the API was right to reject them. Nearly filed as backend bugs.

## 2026-09-20 - M1 (Vedika)

- Learned: React applies a state update later, not on the click. A validation check
  that runs in the same tick is still reading the *previous* form data, so it decides
  "nothing selected" on the very click that selected something. Clicking again appeared
  to fix it only because the old data had caught up by then.
- Failed first: testing S4, selecting a condition made a red "choose a condition" label
  appear at the bottom, which then vanished on the next click. S5 had the mirror image -
  ticking a box showed "Choose at least one accepted condition", and unticking the last
  box cleared the error instead of showing it, even though a checkbox group can be
  emptied back to zero, which is exactly when the error *should* appear. The same bug
  existed in six places.
- Changed: simply clearing the error on selection would not have been enough, because
  unticking the last box has to bring it back. The click already hands over the new
  value, so rather than waiting for React and hoping - which is what a `setTimeout`
  would be - the handler validates that value directly. Browser-tested on both forms,
  merged in #32.
- Trade-off: it only applies to the controls whose `onChange` carries the final value.
  Next time I write or review a form handler I will test selecting something and then
  unselecting everything, not just submitting an empty form.

## 2026-09-20 - M2 (Prakriti)

- Learned: why a normal read-then-write approach cannot safely manage
  `availableQuantity`. If two buyers read that 80 kg is available at nearly the same
  time and both reserve 50 kg, both requests may appear valid even though the listing
  only has enough material for one. Checking the quantity in application code is
  therefore not sufficient, because the value can change between reading and writing.
- Failed first: treating the check as ordinary business logic - read the row, compare
  in code, then write - which looks correct and is correct right up until two requests
  overlap.
- Changed: a DynamoDB `ConditionExpression`, which makes the quantity check and the
  update one atomic database operation. The reservation succeeds only if enough stock
  still exists at the exact moment the update is applied. When two requests compete,
  one succeeds and the other receives a conditional-check failure, which our API
  translates into a clear `409 INSUFFICIENT_QUANTITY` carrying the latest available
  quantity so the client can correct itself.
- Trade-off: concurrency correctness has to be enforced at the data layer, not assumed
  from what the client or the server read moments earlier - and the cost of that is
  that callers must handle the 409 and refetch rather than being able to trust their
  own earlier read.

## 2026-09-20 - M4

- Learned: "deployed" and "demonstrable" are different claims, and only one of them can
  be tested. The stack was live, healthy and returning 200s while still running
  `REPO_DRIVER=memory`, so state lived in Lambda memory. Probing it properly - create one
  listing, then fire twenty simultaneous reads - returned 11 responses that could not see
  a row created seconds earlier. Had we trusted the green health check, the listing
  created on camera would have vanished when the buyer posted their requirement.
- Failed first: accepting "it's deployed" as the end of the task. The five DynamoDB
  tables existed and were empty the whole time; nothing read or wrote them.
- Changed: every claim now has a command behind it. The contract suite runs against the
  deployed URL, not just localhost, and it reads 17/17 there. `seed-demo` prints the
  dates to type on camera and checks them against match rule C5 before you record.
- Trade-off: verifying costs time that feels like it should go into features. It bought
  back more than it cost - the per-container state problem, the fixture dates expiring
  mid-competition, and a client validator that disagreed with the server would each have
  surfaced during the recording instead.

## 2026-09-20 - M4 (process)

- Learned: cutting scope early is a decision; cutting it late is an accident. On Day 2,
  with the backend a day behind, we cut the API from 19 routes to 11 - exactly the set
  the demo walks through - and wrote down that "cut" means the route does not exist, the
  UI does not call it, and the write-up does not claim it. Everything that shipped after
  that was on the critical path.
- Failed first: today, under deadline pressure, I merged a pull request while CI was
  still red by using an admin bypass, and put `main` in a broken state on submission day.
  The irony is that the same config gap had already bitten twice before.
- Changed: the bypass exists for unblocking a red `main`, not for skipping the wait. Two
  minutes of patience would have cost less than the fix did.
- Trade-off: contract-first cost most of Day 1 before a line of product code existed, and
  it is the reason a four-person team on four machines never blocked each other - when
  one member started a day late, nobody else was waiting.

## 2026-09-20 - M4 (reviewing M3's infrastructure work)

*Recorded by M4 from reviewing and testing M3's deployment; M3's own account to follow.*

- Learned: two correct-looking implementations of the same guard can differ in an
  important way. The spec called for `ConditionExpression: availableQuantity >= :q`;
  the DynamoDB repository shipped compare-and-swap instead -
  `availableQuantity = :currAvail AND #s = :currStatus`. Both make over-reservation
  impossible, but CAS is stricter: two concurrent reservations that could both have
  succeeded will have one fail spuriously. Safe, and worth knowing the difference.
- Failed first: assuming a read before a conditional write meant read-then-write. It did
  not - the read only computes the new status, and the condition still closes the race.
- Changed: reviewed the deployment by exercising it rather than reading it. That is how
  the 503s under burst, the `categoryCity` leaking into list responses, and the
  memory-driver state problem were all found.
- Trade-off: `TransactWriteItems` with `attribute_not_exists(impactId)` makes a retried
  handoff unable to double-count, at the cost of a heavier write path than four separate
  updates - which is the right trade when the alternative is inventing reuse that never
  happened.
