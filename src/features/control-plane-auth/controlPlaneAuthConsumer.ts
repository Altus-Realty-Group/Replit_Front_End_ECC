export const CONTROL_PLANE_CONTRACT_VERSION = "1.0.0";
export const CONTROL_PLANE_ADMIN_USERS_PATH = "/control/users";
export const CONTROL_PLANE_DEVELOPER_BANNER =
  "DEVELOPER BYPASS · NON-PRODUCTION · NOT BILLABLE";

export type ControlPlaneRuntime =
  | "development"
  | "test"
  | "preview"
  | "staging"
  | "production";

export type ControlPlaneConsumerRegistration = Readonly<{
  applicationId: string;
  clientId: string;
  registrationStatus: "unbound" | "registered";
}>;

export const CONTROL_PLANE_CONSUMER = Object.freeze({
  applicationId: "ecc",
  clientId: "ecc-web",
  primaryCapability: "ecc.read",
  registrationStatus: "unbound" as const,
});

export type ControlPlaneSessionData = Readonly<{
  applicationSessionId: string;
  personId: string;
  accountId: string;
  applicationId: string;
  expiresAt: string;
  decisionMode: "canonical" | "developer_bypass";
  reasonCode: string;
  billingMode: "canonical" | "not_applicable_developer";
  banner: null | string;
}>;

export type ControlPlaneAccessData = Readonly<{
  allowed: boolean;
  reasonCode: string;
  applicationId: string;
  decisionMode: "canonical" | "developer_bypass";
  billingMode: "canonical" | "not_applicable_developer";
  banner: null | string;
}>;

export type ControlPlaneAuthState =
  | Readonly<{ status: "unavailable"; reasonCode: "CONTROL_PLANE_NOT_BOUND" | "SESSION_FEDERATION_UNAVAILABLE" }>
  | Readonly<{ status: "missing_session"; reasonCode: "SESSION_REQUIRED" }>
  | Readonly<{ status: "expired_or_revoked"; reasonCode: "SESSION_REVOKED" }>
  | Readonly<{ status: "denied"; reasonCode: string }>
  | Readonly<{ status: "authenticated"; session: ControlPlaneSessionData }>
  | Readonly<{ status: "developer_bypass"; session: ControlPlaneSessionData }>;

export interface ControlPlaneAuthPort {
  readSession(): Promise<ControlPlaneAuthState>;
}

const SESSION_KEYS = [
  "applicationSessionId",
  "personId",
  "accountId",
  "applicationId",
  "expiresAt",
  "decisionMode",
  "reasonCode",
  "billingMode",
  "banner",
] as const;

const ACCESS_KEYS = [
  "allowed",
  "reasonCode",
  "applicationId",
  "decisionMode",
  "billingMode",
  "banner",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isBoundedString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    value.trim() === value
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isNonProduction(runtime: ControlPlaneRuntime): boolean {
  return runtime === "development" || runtime === "test" || runtime === "preview";
}

function successReasonIsValid(
  decisionMode: unknown,
  reasonCode: unknown,
): boolean {
  return (
    (decisionMode === "canonical" && reasonCode === "ACCESS_ALLOWED") ||
    (decisionMode === "developer_bypass" &&
      reasonCode === "DEVELOPER_BYPASS_ALLOWED")
  );
}

function modesAreValid(
  decisionMode: unknown,
  billingMode: unknown,
  banner: unknown,
  runtime: ControlPlaneRuntime,
): boolean {
  if (decisionMode === "canonical") {
    return billingMode === "canonical" && banner === null;
  }

  return (
    decisionMode === "developer_bypass" &&
    billingMode === "not_applicable_developer" &&
    banner === CONTROL_PLANE_DEVELOPER_BANNER &&
    isNonProduction(runtime)
  );
}

export function createUnboundControlPlaneAuthPort(): ControlPlaneAuthPort {
  return {
    async readSession() {
      return { status: "unavailable", reasonCode: "CONTROL_PLANE_NOT_BOUND" };
    },
  };
}

export function selectControlPlaneAuthPath(input: Readonly<{
  bindingReady: boolean;
  rollbackToExistingAuth: boolean;
}>): "existing" | "control_plane" {
  if (!input.bindingReady || input.rollbackToExistingAuth) {
    return "existing";
  }
  return "control_plane";
}

export function buildControlPlaneAccessRequest(
  registration: ControlPlaneConsumerRegistration,
  capability: string,
): Readonly<{ applicationId: string; capability: string }> | null {
  if (
    registration.registrationStatus !== "registered" ||
    !isBoundedString(registration.applicationId) ||
    !isBoundedString(capability)
  ) {
    return null;
  }

  return { applicationId: registration.applicationId, capability };
}

export function consumeControlPlaneSession(
  payload: unknown,
  registration: ControlPlaneConsumerRegistration,
  runtime: ControlPlaneRuntime,
  nowMs: number,
): ControlPlaneAuthState {
  if (registration.registrationStatus !== "registered") {
    return { status: "unavailable", reasonCode: "CONTROL_PLANE_NOT_BOUND" };
  }

  if (payload === null || payload === undefined) {
    return { status: "missing_session", reasonCode: "SESSION_REQUIRED" };
  }

  if (!isRecord(payload) || !hasExactKeys(payload, SESSION_KEYS)) {
    return { status: "denied", reasonCode: "AUTHORIZATION_REQUEST_INVALID" };
  }

  const stringKeys = [
    "applicationSessionId",
    "personId",
    "accountId",
    "applicationId",
    "expiresAt",
    "reasonCode",
  ] as const;
  if (stringKeys.some((key) => !isBoundedString(payload[key]))) {
    return { status: "denied", reasonCode: "AUTHORIZATION_REQUEST_INVALID" };
  }

  if (
    payload.applicationId !== registration.applicationId ||
    !UUID_PATTERN.test(payload.personId as string) ||
    !UUID_PATTERN.test(payload.accountId as string) ||
    !RFC3339_PATTERN.test(payload.expiresAt as string) ||
    !successReasonIsValid(payload.decisionMode, payload.reasonCode)
  ) {
    return { status: "denied", reasonCode: "APPLICATION_ACCESS_DENIED" };
  }

  if (
    !modesAreValid(
      payload.decisionMode,
      payload.billingMode,
      payload.banner,
      runtime,
    )
  ) {
    return { status: "denied", reasonCode: "APPLICATION_ACCESS_DENIED" };
  }

  const expiresAtMs = Date.parse(payload.expiresAt as string);
  if (!Number.isFinite(expiresAtMs)) {
    return { status: "denied", reasonCode: "AUTHORIZATION_REQUEST_INVALID" };
  }
  if (expiresAtMs <= nowMs) {
    return { status: "expired_or_revoked", reasonCode: "SESSION_REVOKED" };
  }

  const session = payload as unknown as ControlPlaneSessionData;
  return session.decisionMode === "developer_bypass"
    ? { status: "developer_bypass", session }
    : { status: "authenticated", session };
}

export function consumeControlPlaneAccessDecision(
  payload: unknown,
  registration: ControlPlaneConsumerRegistration,
  runtime: ControlPlaneRuntime,
): ControlPlaneAccessData | Readonly<{ allowed: false; reasonCode: string }> {
  if (
    registration.registrationStatus !== "registered" ||
    !isRecord(payload) ||
    !hasExactKeys(payload, ACCESS_KEYS) ||
    typeof payload.allowed !== "boolean" ||
    !isBoundedString(payload.reasonCode) ||
    payload.applicationId !== registration.applicationId ||
    (payload.allowed &&
      !successReasonIsValid(payload.decisionMode, payload.reasonCode)) ||
    !modesAreValid(
      payload.decisionMode,
      payload.billingMode,
      payload.banner,
      runtime,
    )
  ) {
    return { allowed: false, reasonCode: "APPLICATION_ACCESS_DENIED" };
  }

  return payload as unknown as ControlPlaneAccessData;
}

export function resolveControlPlaneAdminUsersLink(
  state: ControlPlaneAuthState,
  rawAdminDecision: unknown,
  registration: ControlPlaneConsumerRegistration,
  runtime: ControlPlaneRuntime,
): string | null {
  const decision = consumeControlPlaneAccessDecision(
    rawAdminDecision,
    registration,
    runtime,
  );
  if (
    state.status !== "authenticated" ||
    !decision.allowed ||
    !("decisionMode" in decision) ||
    decision.decisionMode !== "canonical"
  ) {
    return null;
  }
  return CONTROL_PLANE_ADMIN_USERS_PATH;
}

export function buildControlPlaneLogoutRequest(
  scope: "application" | "global",
): Readonly<{ scope: "application" | "global" }> {
  return { scope };
}
