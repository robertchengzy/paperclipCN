import { t as translateCopy } from "@/i18n";
import type { ToastInput } from "@/context/ToastContext";

export interface BuiltInAgentPausedToastOptions {
  /** Display name of the paused built-in agent, e.g. "Briefs Agent". */
  displayName: string;
  /** Deep link to the agent page (from `agentUrl(agent)`). */
  agentHref: string;
  /** Noun for the feature item, e.g. "brief". */
  featureNoun?: string;
}

/**
 * Build the "use-while-paused" toast payload (ux-spec §5 / D9).
 *
 * `ToastAction` supports a single `href` link only, so v1 carries one
 * "View agent" link and Resume happens on the agent page. Deduped so repeated
 * feature actions don't stack duplicate toasts.
 */
export function buildBuiltInAgentPausedToast(options: BuiltInAgentPausedToastOptions): ToastInput {
  const noun = options.featureNoun ?? translateCopy("app.agentUi.builtInAgentToast.item");
  return {
    dedupeKey: `built-in-agent-paused:${options.displayName}`,
    title: translateCopy("app.agentUi.builtInAgentToast.pausedNamed", { name: options.displayName }),
    body: translateCopy("app.agentUi.builtInAgentToast.resumeToGenerate", { item: noun }),
    tone: "warn",
    action: { label: translateCopy("app.agentUi.builtInAgentToast.viewAgent"), href: options.agentHref },
  };
}
