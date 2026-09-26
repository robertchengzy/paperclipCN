/**
 * @fileoverview Classifies a failed skill mutation into the four visual states
 * from the Phase 3 UX spec (PAP-13865 / §9.10 Company Skill Policy Contract).
 *
 * The contract inverts the old model: **skill permissions are opt-in
 * restrictions, not opt-in capabilities.** Under the open default there is no
 * permission chrome at all — install / edit / update / test / reset / remove
 * are just live buttons. A denial notice only appears when an explicit company
 * policy (State B) or a non-configurable platform invariant (State C) actually
 * denied the action. Everything else (network, 409 conflict, 5xx) is a
 * transient error (State D) that keeps the existing toast path.
 *
 * This classifier is deliberately pure and framework-free so it can be unit
 * tested exhaustively without a DOM. `classifySkillDenial()` returns `null` for
 * State A (allowed / nothing to show) and State D (transient — let the caller
 * toast it); the UI renders a persistent banner only for B and C.
 */

import { ApiError } from "../api/client";
import { i18n, t } from "@/i18n";

/** Machine-readable error codes the server attaches to skill mutation failures. */
export const SKILL_POLICY_DENIAL_CODE = "skill_policy_denied";

/**
 * Non-configurable platform-invariant failure codes (§9.10). Policy can never
 * loosen these — the remediation is always to fix the artifact/source/input,
 * never to change a permission.
 */
export const SKILL_PLATFORM_INVARIANT_CODES = [
  "skill_authentication_required",
  "skill_company_boundary_denied",
  "skill_workspace_boundary_denied",
  "skill_source_validation_failed",
  "skill_unsafe_content_blocked",
  "skill_secret_handling_blocked",
  "skill_actor_restricted",
] as const;

/**
 * Requires board-administration authority (`users:manage_permissions`). This is
 * a platform boundary — not something the current agent can self-serve — so we
 * treat it as State C but with admin-oriented remediation.
 */
export const SKILL_POLICY_ADMIN_CODE = "skill_policy_admin_required";

export type SkillDenialState = "policy" | "platform" | "platform_admin";

export interface SkillDenial {
  /** Which visual treatment applies. `policy` = State B, `platform*` = State C. */
  state: SkillDenialState;
  /** Machine-readable error code from the server, when present. */
  code: string | null;
  /** §9.10 decision `reason`, when the server surfaced the decision shape. */
  reason: string | null;
  /** Plain-language title for the banner. */
  title: string;
  /** Human remediation — never a curl/API-key snippet. */
  remediation: string;
}

const DEFAULT_POLICY_REMEDIATION_KEY = "app.skills.skillPolicyDenial.defaultPolicyRemediation";
const DEFAULT_ADMIN_REMEDIATION_KEY =
  "app.skills.skillPolicyDenial.defaultAdminRemediation";

// Translate only known server-owned copy. Custom diagnostics must remain intact.
const SERVER_REMEDIATION_KEYS = new Map<string, string>([
  ["Contact a company administrator to change the skill policy.", DEFAULT_POLICY_REMEDIATION_KEY],
  ["Ask a company administrator to manage the skill policy.", DEFAULT_ADMIN_REMEDIATION_KEY],
  [
    "Import from a configured Paperclip workspace or the company managed-skill directory.",
    "app.skills.skillPolicyDenial.remediations.workspaceBoundaryDenied",
  ],
]);

function localizedServerRemediation(value: string | null): string | null {
  if (value === null || (i18n.resolvedLanguage ?? i18n.language) !== "zh-CN") return value;
  const key = SERVER_REMEDIATION_KEYS.get(value);
  return key ? t(key) : value;
}

/** i18n keys for the human-readable titles of the platform-invariant codes (State C). */
const PLATFORM_TITLE_KEYS: Record<string, string> = {
  skill_authentication_required: "app.skills.skillPolicyDenial.titles.authenticationRequired",
  skill_company_boundary_denied: "app.skills.skillPolicyDenial.titles.companyBoundaryDenied",
  skill_workspace_boundary_denied: "app.skills.skillPolicyDenial.titles.workspaceBoundaryDenied",
  skill_source_validation_failed: "app.skills.skillPolicyDenial.titles.sourceValidationFailed",
  skill_unsafe_content_blocked: "app.skills.skillPolicyDenial.titles.unsafeContentBlocked",
  skill_secret_handling_blocked: "app.skills.skillPolicyDenial.titles.secretHandlingBlocked",
  skill_actor_restricted: "app.skills.skillPolicyDenial.titles.actorRestricted",
};

/** i18n keys for the default remediation copy per platform-invariant code — framed as a fix, never a grant. */
const PLATFORM_REMEDIATION_KEYS: Record<string, string> = {
  skill_authentication_required:
    "app.skills.skillPolicyDenial.remediations.authenticationRequired",
  skill_company_boundary_denied:
    "app.skills.skillPolicyDenial.remediations.companyBoundaryDenied",
  skill_workspace_boundary_denied:
    "app.skills.skillPolicyDenial.remediations.workspaceBoundaryDenied",
  skill_source_validation_failed:
    "app.skills.skillPolicyDenial.remediations.sourceValidationFailed",
  skill_unsafe_content_blocked:
    "app.skills.skillPolicyDenial.remediations.unsafeContentBlocked",
  skill_secret_handling_blocked:
    "app.skills.skillPolicyDenial.remediations.secretHandlingBlocked",
  skill_actor_restricted:
    "app.skills.skillPolicyDenial.remediations.actorRestricted",
};

function translatedKey(keys: Record<string, string>, code: string | null): string | null {
  const key = code ? keys[code] : undefined;
  return key ? t(key) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * Turn a caller-supplied error into a denial descriptor, or `null` when there
 * is nothing to render as a persistent notice (State A allowed / State D
 * transient). The `actionLabel` (e.g. "Installing external skills") lets the
 * caller phrase State B's title around the specific action.
 */
export function classifySkillDenial(
  error: unknown,
  actionLabel?: string,
): SkillDenial | null {
  if (!(error instanceof ApiError)) return null;

  const body = asRecord(error.body);
  const code = asString(body?.code);
  const reason = asString(body?.reason);
  const remediation = localizedServerRemediation(asString(body?.remediation));

  // State B — explicit company-policy denial. Resolvable by an administrator.
  const isPolicyDenial =
    code === SKILL_POLICY_DENIAL_CODE
    || reason === "explicit_rule"
    || reason === "policy_default";
  if (isPolicyDenial) {
    const title = actionLabel
      ? t("app.skills.skillPolicyDenial.actionRestricted", { action: actionLabel })
      : t("app.skills.skillPolicyDenial.thisActionRestricted");
    return {
      state: "policy",
      code,
      reason,
      title,
      remediation: remediation ?? t(DEFAULT_POLICY_REMEDIATION_KEY),
    };
  }

  // State C — policy administration boundary (needs users:manage_permissions).
  if (code === SKILL_POLICY_ADMIN_CODE) {
    return {
      state: "platform_admin",
      code,
      reason,
      title: t("app.skills.skillPolicyDenial.adminRequired"),
      remediation: remediation ?? t(DEFAULT_ADMIN_REMEDIATION_KEY),
    };
  }

  // State C — non-configurable platform-safety invariant. Never waivable.
  const isPlatformInvariant =
    (code !== null && (SKILL_PLATFORM_INVARIANT_CODES as readonly string[]).includes(code))
    || reason === "platform_invariant";
  if (isPlatformInvariant) {
    return {
      state: "platform",
      code,
      reason,
      title: translatedKey(PLATFORM_TITLE_KEYS, code) ?? t("app.skills.skillPolicyDenial.platformBlocked"),
      remediation:
        remediation
        ?? translatedKey(PLATFORM_REMEDIATION_KEYS, code)
        ?? t("app.skills.skillPolicyDenial.fixAndRetry"),
    };
  }

  // State D — transient (network / 409 conflict / 5xx / uncoded 4xx). Let the
  // caller keep the existing retry toast; do not render a policy banner.
  return null;
}
