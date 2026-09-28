# ECC property-scoped Property Intelligence request handoff

Status: frontend integration work order. No new endpoint, credential or live vendor call is enabled by this document.
Owner: ECC project manager, coordinating with the owner of ECC's server adapter and Property Intelligence.

## Verified current surfaces (2026-09-28)

- `src/pages/card/property/index.tsx` loads `usePropertyCard(Number(params.id))`: the ECC property route uses a numeric local ID.
- `src/pages/integrations/corelogic.tsx` is a stub. `server/routes/config.ts` reports only a CoreLogic configuration flag; this flag does not establish a PI consumer or authenticated request route.
- PI currently requires a UUID `sourceRecordId`, an Altus property UUID, a unique active `normalized.property_identity_map` row with `source_system=ecc` and confidence 1, and approved ECC consumer/endpoint policy. PI currently has no active ECC identity map. Its ECC read policy is draft and lists grouped labels rather than exact dotted snapshot keys.
- ECC's frontend ownership contract forbids inventing backend business logic or API proxy targets here. Agree the backend owner and its exact contract before implementing the action.

## Project manager work

1. Resolve the canonical ECC property UUID or an approved stable UUID mapping for each numeric ECC property ID. Verify identity with a PI property using persisted evidence; do not send the numeric ID as `sourceRecordId` or infer identity from address similarity.
2. Agree with the PI owner on an ECC consumer profile, exact permitted snapshot field keys, supported detail endpoints, server authentication and per-request receipt shape. The PI worker and production policies must be ready before enabling provider execution.
3. Add a backend-owned, authenticated server route that binds ECC user, local property, verified PI identity and endpoint on the server. Have the route call PI `request_consumer_refresh` and `get_refresh_request_status`; never store PI or CoreLogic credentials in the browser.
4. Through that approved route, add a property-card manual action: explicit endpoint family and reason, known source date and expiry, confirmation of one allowance unit, pending/completed/blocked receipt, and a new read after completion. Missing source may be a deliberate first acquisition. Merely opening a card must never request a paid call.
5. Disable the action on missing/ambiguous identity, missing permission, unavailable PI, budget denial and unapproved endpoint. Show an operator-friendly reason without internal errors or vendor payloads.

## Acceptance

- Contract proof from the backend owner and PI owner before frontend adapter implementation.
- Tests for numeric-to-UUID identity, two matching PI properties, absent link, unauthorized user, duplicate clicks, pending status polling, denied/failed vendor request, and fresh read after completed publication. No mock claims of live CoreLogic data.
- Credentialed runtime proof must show a single explicitly requested PI receipt, budget reservation, archive/ledger, published field lineage and ECC display. Until then the action remains disabled and this is a handoff only.

No deployment, Supabase mutation, API proxy target change or workflow trigger is in scope for this documentation PR.
