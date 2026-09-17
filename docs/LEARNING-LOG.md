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
