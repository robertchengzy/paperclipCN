import type { TFunction } from "i18next";
import {
  AGENT_STATUSES,
  ENVIRONMENT_STATUSES,
  HEARTBEAT_RUN_STATUSES,
  ISSUE_STATUSES,
  PLUGIN_JOB_RUN_STATUSES,
  PLUGIN_JOB_RUN_TRIGGERS,
  PLUGIN_STATUSES,
  PLUGIN_WEBHOOK_DELIVERY_STATUSES,
  PROJECT_STATUSES,
  ROUTINE_STATUSES,
} from "@paperclipai/shared";

// WorkerStatus is server-local (server/src/services/plugin-worker-manager.ts).
const pluginStatusValues: Record<string, readonly string[]> = {
  worker: ["stopped", "starting", "running", "stopping", "crashed", "backoff"],
  lifecycle: PLUGIN_STATUSES,
  job: PLUGIN_JOB_RUN_STATUSES,
  delivery: PLUGIN_WEBHOOK_DELIVERY_STATUSES,
};

/** Translate only known display states; plugin-provided diagnostics stay intact. */
export function pluginStatusLabel(
  t: TFunction,
  kind: "worker" | "lifecycle" | "job" | "delivery",
  status: string,
): string {
  return pluginStatusValues[kind].includes(status)
    ? t(`app.settings.pluginSettings.displayStatus.${status}`, { defaultValue: status })
    : status;
}

export function pluginJobTriggerLabel(t: TFunction, trigger: string): string {
  return (PLUGIN_JOB_RUN_TRIGGERS as readonly string[]).includes(trigger)
    ? t(`app.settings.pluginSettings.jobTrigger.${trigger}`, { defaultValue: trigger })
    : trigger;
}

// buildBindingTargetMap in server/src/services/secrets.ts supplies these statuses.
const bindingTargetStatuses = new Map<string, readonly string[]>([
  ["agent", AGENT_STATUSES],
  ["project", PROJECT_STATUSES],
  ["environment", ENVIRONMENT_STATUSES],
  ["routine", ROUTINE_STATUSES],
  ["issue", ISSUE_STATUSES],
  ["run", HEARTBEAT_RUN_STATUSES],
]);

export function secretBindingTargetStatusLabel(t: TFunction, targetType: string, status: string): string {
  const fallback = status.replaceAll("_", " ");
  return bindingTargetStatuses.get(targetType)?.includes(status)
    ? t(`app.common.status.${status}`, { defaultValue: fallback })
    : fallback;
}
