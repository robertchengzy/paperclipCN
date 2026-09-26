import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_STATUSES, ENVIRONMENT_STATUSES, HEARTBEAT_RUN_STATUSES, ISSUE_STATUSES,
  PLUGIN_JOB_RUN_STATUSES, PLUGIN_JOB_RUN_TRIGGERS, PLUGIN_STATUSES,
  PLUGIN_WEBHOOK_DELIVERY_STATUSES, PROJECT_STATUSES, ROUTINE_STATUSES,
} from "@paperclipai/shared";
import { i18n } from "@/i18n";
import { pluginJobTriggerLabel, pluginStatusLabel, secretBindingTargetStatusLabel } from "./settings-status-labels";

// An unbound language uses the current i18n language on each call.
const t = i18n.getFixedT(null, "translation");

describe("settings status display", () => {
  afterEach(async () => { await i18n.changeLanguage("en"); });

  it("preserves the original English output for all server enum values", async () => {
    await i18n.changeLanguage("en");
    for (const status of PLUGIN_STATUSES) expect(pluginStatusLabel(t, "lifecycle", status)).toBe(status);
    for (const status of PLUGIN_JOB_RUN_STATUSES) expect(pluginStatusLabel(t, "job", status)).toBe(status);
    for (const status of PLUGIN_WEBHOOK_DELIVERY_STATUSES) expect(pluginStatusLabel(t, "delivery", status)).toBe(status);
    for (const status of ["stopped", "starting", "running", "stopping", "crashed", "backoff"])
      expect(pluginStatusLabel(t, "worker", status)).toBe(status);
    for (const trigger of PLUGIN_JOB_RUN_TRIGGERS) expect(pluginJobTriggerLabel(t, trigger)).toBe(trigger);
    for (const [kind, statuses] of Object.entries({
      agent: AGENT_STATUSES, environment: ENVIRONMENT_STATUSES, run: HEARTBEAT_RUN_STATUSES,
      issue: ISSUE_STATUSES, project: PROJECT_STATUSES, routine: ROUTINE_STATUSES,
    })) {
      for (const status of statuses) expect(secretBindingTargetStatusLabel(t, kind, status)).toBe(status.replaceAll("_", " "));
    }
  });

  it("updates known labels after language changes without changing input values", async () => {
    const binding = Object.freeze({ type: "agent", status: "pending_approval" });
    await i18n.changeLanguage("zh-CN");
    expect(pluginStatusLabel(t, "worker", "backoff")).toBe("等待重启");
    expect(pluginStatusLabel(t, "lifecycle", "upgrade_pending")).toBe("等待升级");
    expect(pluginJobTriggerLabel(t, "schedule")).toBe("计划触发");
    expect(secretBindingTargetStatusLabel(t, binding.type, binding.status)).toBe("待审批");
    expect(secretBindingTargetStatusLabel(t, "agent", "idle")).toBe("空闲");
    expect(secretBindingTargetStatusLabel(t, "issue", "in_review")).toBe("审核中");
    expect(secretBindingTargetStatusLabel(t, "run", "scheduled_retry")).toBe("已安排重试");
    expect(binding).toEqual({ type: "agent", status: "pending_approval" });
    await i18n.changeLanguage("en");
    expect(pluginStatusLabel(t, "worker", "backoff")).toBe("backoff");
    expect(secretBindingTargetStatusLabel(t, binding.type, binding.status)).toBe("pending approval");
  });

  it("preserves unknown and cross-domain values instead of guessing their meaning", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(pluginStatusLabel(t, "worker", "ready")).toBe("ready");
    expect(pluginStatusLabel(t, "delivery", "processed")).toBe("processed");
    expect(pluginStatusLabel(t, "lifecycle", "custom_state")).toBe("custom_state");
    expect(pluginJobTriggerLabel(t, "user_supplied")).toBe("user_supplied");
    expect(secretBindingTargetStatusLabel(t, "agent", "custom_state")).toBe("custom state");
    expect(secretBindingTargetStatusLabel(t, "plugin", "running")).toBe("running");
    expect(secretBindingTargetStatusLabel(t, "issue", "idle")).toBe("idle");
    expect(secretBindingTargetStatusLabel(t, "toString", "active")).toBe("active");
    expect(pluginJobTriggerLabel(t, "toString")).toBe("toString");
  });
});
