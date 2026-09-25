import {
  codexLocalReasoningEffortsForModel,
  type CodexLocalReasoningEffort,
} from "@paperclipai/adapter-codex-local";
import { t } from "@/i18n";

const CODEX_REASONING_EFFORT_LABELS: Record<CodexLocalReasoningEffort, string> = {
  get minimal() { return t("app.lib.codexReasoningEffort.minimal"); },
  get low() { return t("app.common.priority.low"); },
  get medium() { return t("app.common.priority.medium"); },
  get high() { return t("app.common.priority.high"); },
  get xhigh() { return t("app.lib.codexReasoningEffort.xhigh"); },
  get max() { return t("app.lib.codexReasoningEffort.max"); },
  get ultra() { return t("app.lib.codexReasoningEffort.ultra"); },
};

export function codexReasoningEffortOptions(
  model: string | null | undefined,
  defaultLabel = t("app.common.labels.default"),
) {
  return [
    { value: "", label: defaultLabel },
    ...codexLocalReasoningEffortsForModel(model).map((value) => ({
      value,
      label: CODEX_REASONING_EFFORT_LABELS[value],
    })),
  ];
}
