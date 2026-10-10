import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useTranslation } from "@/i18n";
import { Link } from "@/lib/router";
import { ArrowLeft, Check, Circle, CircleAlert, Loader2 } from "lucide-react";
import { AdapterMark } from "../AdapterMark";
import { AgentSetupPrompt } from "../AgentSetupPrompt";
import { Button } from "../ui/button";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { cn } from "@/lib/utils";

export type ExternalAgentPreset = "dot" | "hermes" | "other";
export type DotConnectionState = {
  phase: "waiting" | "connected" | "subscribed" | "testing" | "finishing" | "ready";
  problem?: "event_timeout" | "prompt_unavailable" | "offline" | "agent_unavailable";
};

const presets = [
  { id: "dot", name: "Dot", adapter: "openai_dot", get description() { return translateUiCopy("app.uiCopy.adaptersAdapterDisplayRegistry.yourDotInChatGPT"); } },
  { id: "hermes", name: "Hermes", adapter: "hermes_gateway", get description() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.anExistingHermesAgent"); } },
  { id: "other", get name() { return translateUiCopy("app.taskChat.questionForm.other"); }, adapter: "http", get description() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.anyAgentThatCanConnectToPaperclip"); } },
] as const;

export function ExternalAgentPresetPicker({ onSelect, dotDisabledReason }: { onSelect: (preset: ExternalAgentPreset) => void; dotDisabledReason?: string }) {
  useUiCopyTranslation();
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {presets.map(preset => <button
      key={preset.id}
      type="button"
      onClick={() => onSelect(preset.id)}
      disabled={preset.id === "dot" && !!dotDisabledReason}
      title={preset.id === "dot" ? dotDisabledReason : undefined}
      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-3 py-4 text-center transition-colors disabled:opacity-50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AdapterMark type={preset.adapter} className="size-8" />
      <span className="text-sm font-medium">{preset.name}</span>
      <span className="sr-only">{preset.description}</span>
    </button>)}
  </div>;
}

const checks = [
  { get title() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.connectedToPaperclip"); }, get description() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotHasConnectedToThisAgent"); } },
  { get title() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.taskUpdatesEnabled"); }, get description() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotIsSubscribedToNewAssignmentsAndMessages"); } },
  { get title() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.testEventConfirmed"); }, get description() { return translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotReceivedOurTestAndRepliedToPaperclip"); } },
];

/** Controlled by server evidence in the invite controller, never by copying a prompt. */
export function DotConnectionChecks({ state }: { state: DotConnectionState }) {
  useUiCopyTranslation();
  const completed = { waiting: 0, connected: 1, subscribed: 2, testing: 2, finishing: 3, ready: 3 }[state.phase];
  const message = state.problem === "agent_unavailable" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.connectionChecksPassedButThisAgentCannotReceiveTasks")
    : state.problem === "offline" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.connectionUpdatesPausedReconnectToCheckTheLatestStatus")
    : state.problem === "prompt_unavailable" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.thisSetupPromptWasReplacedInAnotherWindowCreate")
    : state.problem === "event_timeout" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotConnectedButHasnTConfirmedTheTest")
    : state.phase === "finishing" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotConfirmedTheTestEventPaperclipIsFinishing")
    : state.phase === "ready" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotIsReadyForTasksMessagesCanTravel")
    : state.phase === "waiting" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.watchingForYourDotUpdatesWillAppearHereAutomatically")
    : state.phase === "connected" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotConnectedWaitingForItToEnableTask")
    : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.waitingForYourDotToConfirmATestEvent");
  return <section aria-label={translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.dotConnectionChecks")} className="space-y-4">
    <ol className="space-y-4">
      {checks.map((check, index) => {
        const done = index < completed;
        const failed = index === completed && state.problem === "event_timeout";
        const active = index === completed && !state.problem;
        const Icon = done ? Check : failed ? CircleAlert : active ? Loader2 : Circle;
        return <li key={check.title} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-accent text-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>
            <Icon className={cn("size-4", active && "animate-spin motion-reduce:animate-none")} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-sm", done || active || failed ? "font-medium" : "text-muted-foreground")}>
              {check.title}<span className="sr-only">{done ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.complete") : failed ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.needsAttention") : active ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.inProgress") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.waiting")}</span>
            </p>
            {done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.description}</p>}
          </div>
        </li>;
      })}
    </ol>
    <p role={state.problem && state.problem !== "prompt_unavailable" ? "alert" : "status"} aria-live="polite" className={cn("text-sm leading-relaxed", state.problem && state.problem !== "prompt_unavailable" ? "text-destructive" : "text-muted-foreground")}>{message}</p>
  </section>;
}

/** Shared presentation for the invitation flow. The caller owns invitations and watching. */
export function ExternalAgentInviteContent({
  preset, prompt, companyName, connection, onSelect, onBack, onClose, onCopied, onRetry, onNewPrompt,
  dotDisabledReason, busy = false, error, approvalHref,
}: {
  dotDisabledReason?: string;
  busy?: boolean;
  error?: string;
  approvalHref?: string;
  preset: ExternalAgentPreset | null;
  prompt: string;
  companyName: string;
  connection: DotConnectionState;
  onSelect: (preset: ExternalAgentPreset) => void;
  onBack: () => void;
  onClose: () => void;
  onCopied: () => void;
  onRetry: () => void;
  onNewPrompt: () => void;
}) {
  const { t } = useTranslation();
  const provider = presets.find(item => item.id === preset);
  const dot = preset === "dot";
  const ready = dot && connection.phase === "ready" && !connection.problem;
  const connecting = dot && connection.phase !== "waiting";
  const progressLabel = connection.problem === "agent_unavailable" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.agentUnavailable")
    : connection.problem === "offline" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.updatesPaused")
    : connection.problem === "event_timeout" ? translateUiCopy("app.common.states.needsAttention")
    : connection.phase === "finishing" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.finishingSetup")
    : connection.phase === "connected" ? translateUiCopy("app.common.progress.connecting") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.confirmingConnection");
  return <>
    <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 pr-5">
        {provider && <AdapterMark type={provider.adapter} className="size-10" />}
        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {!provider ? t("app.agentSetup.basics.invite") : dot ? ready ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotIsConnected") : translateUiCopy("app.uiCopy.componentsDotRunnerConnection.connectYourDot") : preset === "hermes" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.inviteYourHermesAgent") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.inviteYourAgent")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {!provider ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.bringAnAgentYouAlreadyUseIntoValue0", { value0: String(companyName) })
              : ready ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotCanNowReceiveAssignmentsAndWorkWithValue0", { value0: String(companyName) })
              : connection.problem === "agent_unavailable" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotIsConnectedThisAgentMustBeAvailable")
              : connection.phase === "finishing" ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotHasConnectedAndConfirmedTaskUpdatesPaperclip")
              : connecting ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.yourDotHasConnectedWeReCheckingThatTask")
              : dot ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.copyTheSetupPromptAndSendItToYour")
              : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.copyTheInvitationPromptAndSendItToYourValue0", { value0: String(preset === "hermes" ? "Hermes " : "") })}
          </DialogDescription>
        </div>
      </div>
      {error && <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p><Button variant="outline" disabled={busy} onClick={onRetry}>{translateUiCopy("app.common.actions.tryAgain")}</Button></div>}
      {!provider ? <><ExternalAgentPresetPicker onSelect={onSelect} dotDisabledReason={dotDisabledReason} />
        {dotDisabledReason && <p className="text-sm text-muted-foreground">{dotDisabledReason}</p>}</>
        : approvalHref ? <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.anOrganizationAdminNeedsToApproveThisAgentBefore")}</p>
        : busy && !prompt && connection.phase === "waiting" ? <p role="status" className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.preparingYourInvitation")}</p> : dot ? <>
        <div className="border-t pt-6"><DotConnectionChecks state={connection} />
          {connection.phase === "waiting" && <p className="mt-4 text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.dotUsesYourOpenAIAccountProviderUsageAndCost")}</p>}</div>
        {connection.problem === "event_timeout" && <Button variant="outline" disabled={busy} onClick={onRetry}>{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.retryTestEvent")}</Button>}
        {connection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.reconnectUpdates")}</Button>}
      </> : <p className="text-sm leading-relaxed text-muted-foreground"><Trans i18nKey="app.uiCopy.componentsNewAgentExternalAgentInviteContent.message23" components={{ part0: <>{""}{companyName}</> }} /></p>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
      <Button variant="ghost" onClick={provider ? onBack : onClose}>
        {provider && <ArrowLeft className="size-4" />}{provider ? t("app.common.actions.back") : t("app.common.actions.cancel")}
      </Button>
      {provider && (approvalHref ? <Button asChild><Link to={approvalHref} onClick={onClose}>{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.reviewApproval")}</Link></Button>
        : ready ? <Button onClick={onClose}>{t("app.common.actions.done")}</Button>
        : connecting ? <Button disabled aria-live="polite">
          {!connection.problem && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {progressLabel}
        </Button>
        : dot && connection.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.createANewPrompt")}</Button>
        : !prompt || busy ? <Button disabled>{busy ? translateUiCopy("app.connections.connectionSetupFlow.preparing") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.waitingForDot")}</Button>
        : <AgentSetupPrompt
          key={preset}
          prompt={prompt}
          label={dot ? translateUiCopy("app.apps.gitHubSetupPrompt.copySetupPrompt") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.copyInvitationPrompt")}
          title={dot ? translateUiCopy("app.uiCopy.componentsDotRunnerConnection.connectYourDot") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.inviteYourAgent")}
          description={dot ? translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.sendThisWholePromptToYourDotInChatGPT") : translateUiCopy("app.uiCopy.componentsNewAgentExternalAgentInviteContent.sendThisWholePromptToYourAgent")}
          agent={dot ? { name: "Dot", src: "/brands/adapters/openai-dot.svg" } : undefined}
          align="end"
          className="min-w-0 shrink"
          onCopied={onCopied}
        />)}
    </div>
  </>;
}
