import assert from "node:assert/strict";
import {
  CONTROL_PLANE_ADMIN_USERS_PATH,
  CONTROL_PLANE_CONSUMER,
  CONTROL_PLANE_DEVELOPER_BANNER,
  buildControlPlaneAccessRequest,
  buildControlPlaneLogoutRequest,
  consumeControlPlaneAccessDecision,
  consumeControlPlaneSession,
  createUnboundControlPlaneAuthPort,
  resolveControlPlaneAdminUsersLink,
  selectControlPlaneAuthPath,
  type ControlPlaneConsumerRegistration,
} from "./controlPlaneAuthConsumer";

async function run() {
assert.equal(CONTROL_PLANE_CONSUMER.applicationId, "ecc");
assert.equal(CONTROL_PLANE_CONSUMER.clientId, "ecc-web");
assert.equal(CONTROL_PLANE_CONSUMER.primaryCapability, "ecc.read");
assert.equal(
  selectControlPlaneAuthPath({
    bindingReady: false,
    rollbackToExistingAuth: false,
  }),
  "existing",
);
assert.equal(
  selectControlPlaneAuthPath({
    bindingReady: true,
    rollbackToExistingAuth: true,
  }),
  "existing",
);
assert.equal(
  selectControlPlaneAuthPath({
    bindingReady: true,
    rollbackToExistingAuth: false,
  }),
  "control_plane",
);

const unbound: ControlPlaneConsumerRegistration = {
  applicationId: "consumer-app",
  clientId: "consumer-web",
  registrationStatus: "unbound",
};
const registered: ControlPlaneConsumerRegistration = {
  ...unbound,
  registrationStatus: "registered",
};
const now = Date.parse("2026-09-04T20:00:00Z");
const canonicalSession = {
  applicationSessionId: "opaque-app-session",
  personId: "00000000-0000-4000-8000-000000000001",
  accountId: "00000000-0000-4000-8000-000000000002",
  applicationId: "consumer-app",
  expiresAt: "2026-09-04T21:00:00Z",
  decisionMode: "canonical",
  reasonCode: "ACCESS_ALLOWED",
  billingMode: "canonical",
  banner: null,
} as const;

assert.deepEqual(await createUnboundControlPlaneAuthPort().readSession(), {
  status: "unavailable",
  reasonCode: "CONTROL_PLANE_NOT_BOUND",
});
assert.equal(
  consumeControlPlaneSession(canonicalSession, unbound, "development", now).status,
  "unavailable",
);
const accepted = consumeControlPlaneSession(
  canonicalSession,
  registered,
  "production",
  now,
);
assert.equal(accepted.status, "authenticated");
const canonicalAdminDecision = {
  allowed: true,
  reasonCode: "ACCESS_ALLOWED",
  applicationId: "consumer-app",
  decisionMode: "canonical",
  billingMode: "canonical",
  banner: null,
} as const;
assert.equal(
  resolveControlPlaneAdminUsersLink(
    accepted,
    canonicalAdminDecision,
    registered,
    "production",
  ),
  CONTROL_PLANE_ADMIN_USERS_PATH,
);
assert.equal(
  resolveControlPlaneAdminUsersLink(
    accepted,
    { ...canonicalAdminDecision, applicationId: "another-app" },
    registered,
    "production",
  ),
  null,
);

assert.equal(
  consumeControlPlaneSession(
    { ...canonicalSession, applicationId: "another-app" },
    registered,
    "production",
    now,
  ).status,
  "denied",
);
assert.equal(
  consumeControlPlaneSession(
    { ...canonicalSession, expiresAt: "2026-09-04T20:00:00Z" },
    registered,
    "production",
    now,
  ).status,
  "expired_or_revoked",
);
assert.equal(
  consumeControlPlaneSession(
    { ...canonicalSession, browserRole: "admin" },
    registered,
    "production",
    now,
  ).status,
  "denied",
);
assert.equal(
  consumeControlPlaneSession(
    { ...canonicalSession, personId: "browser-person" },
    registered,
    "production",
    now,
  ).status,
  "denied",
);
assert.equal(
  consumeControlPlaneSession(
    { ...canonicalSession, expiresAt: "2026-09-04" },
    registered,
    "production",
    now,
  ).status,
  "denied",
);

const bypassSession = {
  ...canonicalSession,
  decisionMode: "developer_bypass",
  reasonCode: "DEVELOPER_BYPASS_ALLOWED",
  billingMode: "not_applicable_developer",
  banner: CONTROL_PLANE_DEVELOPER_BANNER,
} as const;
const bypass = consumeControlPlaneSession(
  bypassSession,
  registered,
  "development",
  now,
);
assert.equal(bypass.status, "developer_bypass");
assert.equal(
  resolveControlPlaneAdminUsersLink(
    bypass,
    canonicalAdminDecision,
    registered,
    "development",
  ),
  null,
);
assert.equal(
  consumeControlPlaneSession(
    bypassSession,
    registered,
    "production",
    now,
  ).status,
  "denied",
);

assert.deepEqual(buildControlPlaneAccessRequest(registered, "app.read"), {
  applicationId: "consumer-app",
  capability: "app.read",
});
assert.equal(buildControlPlaneAccessRequest(unbound, "app.read"), null);
assert.equal(buildControlPlaneAccessRequest(registered, " app.read"), null);

assert.deepEqual(
  consumeControlPlaneAccessDecision(
    {
      allowed: true,
      reasonCode: "ACCESS_ALLOWED",
      applicationId: "consumer-app",
      decisionMode: "canonical",
      billingMode: "canonical",
      banner: null,
    },
    registered,
    "production",
  ),
  {
    allowed: true,
    reasonCode: "ACCESS_ALLOWED",
    applicationId: "consumer-app",
    decisionMode: "canonical",
    billingMode: "canonical",
    banner: null,
  },
);
assert.equal(
  consumeControlPlaneAccessDecision(
    {
      allowed: true,
      reasonCode: "DEVELOPER_BYPASS_ALLOWED",
      applicationId: "consumer-app",
      decisionMode: "developer_bypass",
      billingMode: "not_applicable_developer",
      banner: CONTROL_PLANE_DEVELOPER_BANNER,
    },
    registered,
    "production",
  ).allowed,
  false,
);
assert.deepEqual(buildControlPlaneLogoutRequest("application"), {
  scope: "application",
});
assert.deepEqual(buildControlPlaneLogoutRequest("global"), { scope: "global" });

console.log("Control Plane auth consumer proof: 24 assertions passed");
}

void run();
