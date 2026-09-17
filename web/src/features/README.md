# web/src/features - OWNER: M1

Feature-scoped composition: `browse/`, `listing/`, `requirement/`, `matches/`,
`reservation/`, `dashboard/`, `impact/`.

A feature folder holds the screen's composed sections and its own hooks. Anything
reused across two features moves to `components/`. Pages in `pages/` stay thin -
routing, params, and layout only.
