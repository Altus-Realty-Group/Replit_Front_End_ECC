# ECC Property Intelligence consumer work order

Status: proposed; no ECC frontend implementation in this PR. PI owner work is tracked in [#1547](https://github.com/Altus-Realty-Group/price-engine/issues/1547).

## Existing surface
ECC frontend has `src/pages/integrations/corelogic.tsx` (currently a stub), `src/lib/useIntegrations.ts`, and `server/routes/config.ts` reporting CoreLogic configuration. These do not establish a governed property intelligence read contract. The ECC frontend is an adapter/consumer; its backend contract owner must be identified before route or proxy wiring.

## Future implementation scope
- Determine the active ECC backend/API authority and inventory ECC property screens and direct vendor paths. Do not revive frozen legacy runtimes or invent a new direct PI-to-browser contract.
- Have the approved ECC backend resolve a verified PI identity, enforce ECC viewer authorization and return a minimal allowed PI projection with provenance, freshness and explicit unlinked/denied/unavailable states. ECC keeps its portfolio and operational data.
- Replace misleading CoreLogic integration status or stub behavior only when the governed PI backend contract exists; reading an ECC property page must not incur a paid CoreLogic call.
- Demonstrate real authorized ECC property identity, denial isolation and stale/missing handling in a separate implementation PR. Coordinate cutover with PI and CM migration gates.

## Current change
Documentation only. No frontend adapter, backend contract, proxy, environment, secret, database, vendor call or deployment change. Delete this document to roll back the handoff.