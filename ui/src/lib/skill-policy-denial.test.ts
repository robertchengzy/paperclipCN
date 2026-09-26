import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/i18n";

import { ApiError } from "../api/client";
import {
  classifySkillDenial,
  SKILL_PLATFORM_INVARIANT_CODES,
  SKILL_POLICY_ADMIN_CODE,
  SKILL_POLICY_DENIAL_CODE,
} from "./skill-policy-denial";

function apiError(status: number, body: unknown): ApiError {
  return new ApiError("Request failed", status, body);
}

describe("classifySkillDenial", () => {
  it("returns null for non-ApiError inputs (State A / unexpected)", () => {
    expect(classifySkillDenial(new Error("boom"))).toBeNull();
    expect(classifySkillDenial(null)).toBeNull();
    expect(classifySkillDenial("nope")).toBeNull();
  });

  it("returns null for transient errors so the caller keeps the retry toast (State D)", () => {
    expect(classifySkillDenial(apiError(409, { code: "issue_run_conflict" }))).toBeNull();
    expect(classifySkillDenial(apiError(500, { error: "Internal error" }))).toBeNull();
    expect(classifySkillDenial(apiError(422, { error: "This skill does not support updates." }))).toBeNull();
  });

  it("classifies the redacted mutation denial payload as State B (policy)", () => {
    const denial = classifySkillDenial(
      apiError(403, {
        code: SKILL_POLICY_DENIAL_CODE,
        reason: "explicit_rule",
        action: "skills.install",
        remediation: "Contact a company administrator to change the skill policy.",
      }),
      "Installing external skills",
    );
    expect(denial).not.toBeNull();
    expect(denial?.state).toBe("policy");
    expect(denial?.title).toBe("Installing external skills is restricted by your organization policy.");
    expect(denial?.remediation).toBe("Contact a company administrator to change the skill policy.");
  });

  it("recognises a policy denial from reason alone (policy_default) and falls back to default remediation", () => {
    const denial = classifySkillDenial(apiError(403, { reason: "policy_default" }));
    expect(denial?.state).toBe("policy");
    expect(denial?.title).toBe("This action is restricted by your organization policy.");
    expect(denial?.remediation).toContain("administrator can change the skill policy");
  });

  it("classifies the policy-admin requirement as State C (platform_admin)", () => {
    const denial = classifySkillDenial(apiError(403, { code: SKILL_POLICY_ADMIN_CODE }));
    expect(denial?.state).toBe("platform_admin");
    expect(denial?.title).toContain("administration access");
  });

  it.each(SKILL_PLATFORM_INVARIANT_CODES)(
    "classifies platform invariant %s as State C",
    (code) => {
      const denial = classifySkillDenial(apiError(403, { code, reason: "platform_invariant" }));
      expect(denial?.state).toBe("platform");
      expect(denial?.title.length).toBeGreaterThan(0);
      expect(denial?.remediation.length).toBeGreaterThan(0);
    },
  );

  it("prefers a server-supplied remediation over the default for platform invariants", () => {
    const denial = classifySkillDenial(
      apiError(403, {
        code: "skill_workspace_boundary_denied",
        reason: "platform_invariant",
        remediation: "Import from an approved managed-skill root.",
      }),
    );
    expect(denial?.remediation).toBe("Import from an approved managed-skill root.");
  });

  it("treats reason=platform_invariant without a known code as a generic safety block", () => {
    const denial = classifySkillDenial(apiError(403, { reason: "platform_invariant" }));
    expect(denial?.state).toBe("platform");
    expect(denial?.title).toContain("platform safety rule");
  });

  it("never surfaces raw rule internals — only title + remediation are exposed", () => {
    const denial = classifySkillDenial(
      apiError(403, {
        code: SKILL_POLICY_DENIAL_CODE,
        reason: "explicit_rule",
        matchedRuleId: "secret-internal-rule-id",
      }),
      "Editing skills",
    );
    // matchedRuleId must not leak into any user-facing string.
    expect(JSON.stringify(denial)).not.toContain("secret-internal-rule-id");
  });
});


describe("localized server remediation", () => {
  afterEach(async () => { await i18n.changeLanguage("en"); });

  it.each([
    ["skill_policy_denied", "Contact a company administrator to change the skill policy.", "组织管理员可以修改技能策略以允许此操作。"],
    ["skill_policy_admin_required", "Ask a company administrator to manage the skill policy.", "此操作需要组织管理权限，请联系管理员进行修改。"],
    ["skill_workspace_boundary_denied", "Import from a configured Paperclip workspace or the company managed-skill directory.", "请从已配置的 Paperclip 工作区或组织托管技能目录导入。"],
  ])("localizes known remediation for %s and keeps the original English", async (code, remediation, chinese) => {
    const error = apiError(403, { code, remediation });
    await i18n.changeLanguage("zh-CN");
    expect(classifySkillDenial(error)?.remediation).toBe(chinese);
    await i18n.changeLanguage("en");
    expect(classifySkillDenial(error)?.remediation).toBe(remediation);
  });

  it.each([
    "Import from /srv/custom/project to fix this error.",
    "Contact a company administrator to change the skill policy. More detail.",
    "Contact a company administrator to change the skill policy. ",
  ])("preserves non-exact diagnostics in Chinese: %s", async (remediation) => {
    await i18n.changeLanguage("zh-CN");
    expect(classifySkillDenial(apiError(403, { code: SKILL_POLICY_DENIAL_CODE, remediation }))?.remediation)
      .toBe(remediation);
  });
});
