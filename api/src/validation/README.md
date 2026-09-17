# api/src/validation - OWNER: M2

One validator per endpoint with a request body, mirroring the tables in
docs/04-API-CONTRACT.md § 3.

Rules:
- Validate **server-side always**. The client's checks are a convenience, never
  the authority.
- Return `400 VALIDATION_FAILED` with `field` set to the first offender, so M1
  can focus that input.
- Reject unknown keys and any client-supplied derived field (`status`,
  `availableQuantity`, `businessId`, `location`).
- Round quantities to 2 dp **once**, here, at the boundary.
