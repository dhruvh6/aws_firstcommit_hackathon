# web/src/components - OWNER: M1

Design-system primitives, specified in docs/07-DESIGN-SYSTEM.md § 4. Build this
list on Day 1-2; every screen in docs/06 is assembled from it.

Day 1: `Button` `Chip` `StatusChip` `Input` `Select` `Skeleton` `EmptyState` `ErrorState`
Day 2: `ListingCard` `QuantityStepper` `TilePicker` `AllocationBar` `CheckList` `MatchCard`
Day 3: `StatTile` `Toast` `Dialog` `Breadcrumb` `Tabs`

Every component ships its full state set - default, hover, focus-visible,
disabled, loading, error - and uses tokens by role, never hex literals.

`CheckList` is the signature component: icon **and** colour together, verbatim
`detail` strings, no truncation. It must read correctly in greyscale.
