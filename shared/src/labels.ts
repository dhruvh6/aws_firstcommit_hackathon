/**
 * Enum value -> human display string.
 *
 * OWNER: M1  (docs/08-TEAM-ROLES.md § 3)
 * SOURCE: docs/04-API-CONTRACT.md § 3 `enumLabels`, mirrored in
 *         fixtures/meta-categories.json.
 *
 * Rules (docs/07-DESIGN-SYSTEM.md § 4):
 *   - Every enum in docs/02 § 3 needs a label map here.
 *   - An unknown value must NOT throw and must NOT render blank: return
 *     undefined and let the caller fall back to a neutral chip showing the raw
 *     string. That fallback is what stops a Day-3 enum addition from breaking
 *     the UI.
 *   - At runtime prefer the labels from GET /v1/meta/categories; this file is
 *     the typed fallback so components never hardcode enum lists.
 */

export {};
