import { t as translateCopy } from "@/i18n";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { TFunction } from "i18next";
import { Trans } from "react-i18next";
import { useTranslation } from "@/i18n";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";

/* ---- Help text for (?) tooltips ---- */
export const help: Record<string, string> = {
  get name() { return translateCopy("app.agentUi.agentConfigPrimitives.displayNameForThisAgent"); },
  get title() { return translateCopy("app.agentUi.agentConfigPrimitives.jobTitleShownInTheOrgChart"); },
  get role() { return translateCopy("app.agentUi.agentConfigPrimitives.organizationalRoleDeterminesPositionAndCapabilities"); },
  get reportsTo() { return translateCopy("app.agentUi.agentConfigPrimitives.theAgentThisOneReportsToInTheOrg"); },
  get capabilities() { return translateCopy("app.agentUi.agentConfigPrimitives.describesWhatThisAgentCanDoShownInThe"); },
  get adapterType() { return translateCopy("app.agentUi.agentConfigPrimitives.howThisAgentRunsLocalCLIClaudeCodexOpenCodeOpenClawGateway"); },
  get cwd() { return translateCopy("app.agentUi.agentConfigPrimitives.deprecatedLegacyWorkingDirectoryFallbackForLocalAdaptersExisting"); },
  get promptTemplate() { return translateCopy("app.agentUi.agentConfigPrimitives.sentOnEveryHeartbeatKeepThisSmallAndDynamic"); },
  get model() { return translateCopy("app.agentUi.agentConfigPrimitives.overrideTheDefaultModelUsedByTheAdapter"); },
  get thinkingEffort() { return translateCopy("app.agentUi.agentConfigPrimitives.controlModelReasoningDepthSupportedValuesVaryByAdaptermodel"); },
  get chrome() { return translateCopy("app.agentUi.agentConfigPrimitives.enableClaudesChromeIntegrationByPassingChrome"); },
  get dangerouslySkipPermissions() { return translateCopy("app.agentUi.agentConfigPrimitives.runUnattendedByAutoapprovingAdapterPermissionPromptsWhenSupported"); },
  get dangerouslyBypassSandbox() { return translateCopy("app.agentUi.agentConfigPrimitives.runCodexWithoutSandboxRestrictionsRequiredForFilesystemnetworkAccess"); },
  get search() { return translateCopy("app.agentUi.agentConfigPrimitives.enableCodexWebSearchCapabilityDuringRuns"); },
  get fastMode() { return translateCopy("app.agentUi.agentConfigPrimitives.enableCodexFastModeThisBurnsCreditstokensMuchFaster"); },
  get workspaceStrategy() { return translateCopy("app.agentUi.agentConfigPrimitives.howPaperclipShouldRealizeAnExecutionWorkspaceForThis"); },
  get workspaceBaseRef() { return translateCopy("app.agentUi.agentConfigPrimitives.baseGitRefUsedWhenCreatingAWorktreeBranch"); },
  get workspaceBranchTemplate() { return translateCopy("app.agentUi.agentConfigPrimitives.templateForNamingDerivedBranchesSupportsIssueidentifierIssuetitleAgentname"); },
  get worktreeParentDir() { return translateCopy("app.agentUi.agentConfigPrimitives.directoryWhereDerivedWorktreesShouldBeCreatedAbsolutePrefixed"); },
  get runtimeServicesJson() { return translateCopy("app.agentUi.agentConfigPrimitives.optionalWorkspaceRuntimeServiceDefinitionsUseThisForShared"); },
  get maxTurnsPerRun() { return translateCopy("app.agentUi.agentConfigPrimitives.maximumNumberOfAgenticTurnsToolCallsPerHeartbeat"); },
  get command() { return translateCopy("app.agentUi.agentConfigPrimitives.theCommandToExecuteEgNodePython"); },
  get localCommand() { return translateCopy("app.agentUi.agentConfigPrimitives.overrideThePathToTheCLICommandYouWant"); },
  get args() { return translateCopy("app.agentUi.agentConfigPrimitives.commandlineArgumentsCommaseparated"); },
  get extraArgs() { return translateCopy("app.agentUi.agentConfigPrimitives.extraCLIArgumentsForLocalAdaptersCommaseparated"); },
  get envVars() { return translateCopy("app.agentUi.agentConfigPrimitives.environmentVariablesInjectedIntoTheAdapterProcessUsePlain"); },
  get secretAccess() { return translateCopy("app.agentUi.agentConfigPrimitives.secretsThisAgentCanReachEnvvarBindingsAreInjected"); },
  get bootstrapPrompt() { return translateCopy("app.agentUi.agentConfigPrimitives.onlySentWhenPaperclipStartsAFreshSessionUse"); },
  get payloadTemplateJson() { return translateCopy("app.agentUi.agentConfigPrimitives.optionalJSONMergedIntoRemoteAdapterRequestPayloadsBefore"); },
  get webhookUrl() { return translateCopy("app.agentUi.agentConfigPrimitives.theURLThatReceivesPOSTRequestsWhenTheAgent"); },
  get heartbeatInterval() { return translateCopy("app.agentUi.agentConfigPrimitives.runThisAgentAutomaticallyOnATimerUsefulFor"); },
  get intervalSec() { return translateCopy("app.agentUi.agentConfigPrimitives.secondsBetweenAutomaticHeartbeatInvocations"); },
  get timeoutSec() { return translateCopy("app.agentUi.agentConfigPrimitives.maximumSecondsARunCanTakeBeforeBeingTerminated"); },
  get graceSec() { return translateCopy("app.agentUi.agentConfigPrimitives.secondsToWaitAfterSendingInterruptBeforeForcekillingThe"); },
  get wakeOnDemand() { return translateCopy("app.agentUi.agentConfigPrimitives.allowThisAgentToBeWokenByAssignmentsAPI"); },
  get cooldownSec() { return translateCopy("app.agentUi.agentConfigPrimitives.minimumSecondsBetweenConsecutiveHeartbeatRuns"); },
  get maxConcurrentRuns() { return translateCopy("app.agentUi.agentConfigPrimitives.maximumNumberOfHeartbeatRunsThatCanExecuteSimultaneously"); },
  get maxTurnContinuationEnabled() { return translateCopy("app.agentUi.agentConfigPrimitives.automaticallyQueueBoundedContinuationRunsWhenAnAdapterStops"); },
  get maxTurnContinuationMaxAttempts() { return translateCopy("app.agentUi.agentConfigPrimitives.maximumAutomaticContinuationsAfterOneMaxturnStopThisIs"); },
  get maxTurnContinuationDelaySec() { return translateCopy("app.agentUi.agentConfigPrimitives.secondsToWaitBeforeStartingEachMaxturnContinuation"); },
  get budgetMonthlyCents() { return translateCopy("app.agentUi.agentConfigPrimitives.monthlySpendingLimitInCents0MeansNoLimit"); },
};

import { getAdapterLabels } from "../adapters/adapter-display-registry";

export const adapterLabels = getAdapterLabels();

export const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

const helpValues: Record<string, Record<string, string>> = {
  promptTemplate: {
    agentId: "{{ agent.id }}",
    agentName: "{{ agent.name }}",
    agentRole: "{{ agent.role }}",
  },
  workspaceBranchTemplate: {
    issueIdentifier: "{{issue.identifier}}",
    issueTitle: "{{issue.title}}",
    agentName: "{{agent.name}}",
    projectId: "{{project.id}}",
    workspaceRepoRef: "{{workspace.repoRef}}",
    slug: "{{slug}}",
  },
};

/** Localized help text for a `help` key; falls back to the English `help` entry. */
export function helpText(t: TFunction, key: string): string {
  const fallback = help[key];
  if (fallback === undefined) return key;
  return t(`app.agentSetup.help.${key}`, {
    defaultValue: fallback,
    ...helpValues[key],
  });
}

/** Render-time localized counterpart of `help`, with the same keys. */
export function useAgentConfigHelp(): Record<string, string> {
  const { t } = useTranslation();
  return useMemo(
    () => Object.fromEntries(Object.keys(help).map((key) => [key, helpText(t, key)])),
    [t],
  );
}

/** Localized adapter display label; adapter type ids are never translated. */
export function adapterLabel(t: TFunction, type: string): string {
  return t(`app.agentSetup.adapterLabels.${type}`, { defaultValue: adapterLabels[type] ?? type });
}

/** Localized role label, backed by `app.agents.roles`. */
export function roleLabel(t: TFunction, role: string): string {
  return t(`app.agents.roles.${role}`, { defaultValue: roleLabels[role] ?? role });
}

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; configSection?: import("../adapters/types").AdapterConfigSection }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleTestId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      {/* Gallery feedback r3: was a hand-rolled h-5 w-9 pill with a bg-green-600
          track — the app's second switch implementation. Converged on the one
          canonical ToggleSwitch (status-green on-state), DESIGN.md principle 1. */}
      <ToggleSwitch
        data-testid={toggleTestId}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function AutoExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function DraftInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Auto-expanding textarea with draft state and blur-commit.
 */
export function DraftTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function DraftNumberInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type">) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * "Choose" button that opens a dialog explaining the user must manually
 * type the path due to browser security limitations.
 */
export function ChoosePathButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const kbd = { kbd: <kbd /> };
  const code = { code: <code /> };
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
        onClick={() => setOpen(true)}
      >
        {t("app.agentSetup.choosePath.button")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.agentSetup.choosePath.title")}</DialogTitle>
            <DialogDescription>
              {t("app.agentSetup.choosePath.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section className="space-y-1.5">
              <p className="font-medium">{t("app.agentSetup.choosePath.macTitle")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>{t("app.agentSetup.choosePath.macStep1")}</li>
                <li><Trans i18nKey="app.agentSetup.choosePath.macStep2" components={kbd} /></li>
                <li>{t("app.agentSetup.choosePath.macStep3")}</li>
                <li>{t("app.agentSetup.choosePath.pasteStep")}</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                /Users/yourname/Documents/project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">{t("app.agentSetup.choosePath.winTitle")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>{t("app.agentSetup.choosePath.winStep1")}</li>
                <li><Trans i18nKey="app.agentSetup.choosePath.winStep2" components={kbd} /></li>
                <li>{t("app.agentSetup.choosePath.winStep3")}</li>
                <li>{t("app.agentSetup.choosePath.pasteStep")}</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                C:\Users\yourname\Documents\project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">{t("app.agentSetup.choosePath.terminalTitle")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li><Trans i18nKey="app.agentSetup.choosePath.terminalStep1" components={code} /></li>
                <li><Trans i18nKey="app.agentSetup.choosePath.terminalStep2" components={code} /></li>
                <li>{t("app.agentSetup.choosePath.terminalStep3")}</li>
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("app.agentSetup.choosePath.ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div className="w-24 ml-auto">{children}</div>
    </div>
  );
}
