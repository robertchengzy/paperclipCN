import { Trans } from "react-i18next";
import { t as translateUiCopy } from "@/i18n";
import { t, useTranslation } from "@/i18n";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GITHUB_REVIEW_EVENTS,
  type GitHubChatConfiguration,
  type GitHubReviewPolicy,
  type GitHubAllowedPerson,
} from "@paperclipai/shared";
import { accessApi } from "@/api/access";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { githubChatApi } from "@/api/githubChat";
import { useOptionalCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import {
  AtSign,
  Check,
  Copy,
  HelpCircle,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubSettingsDisclosure } from "./GitHubSettingsDisclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Link } from "@/lib/router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const githubSelectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
function eventLabel(event: (typeof GITHUB_REVIEW_EVENTS)[number]): string {
  return {
    opened: t("app.apps.gitHubBotConfiguration.events.opened"),
    synchronize: t("app.apps.gitHubBotConfiguration.events.synchronize"),
    reopened: t("app.apps.gitHubBotConfiguration.events.reopened"),
    ready_for_review: t("app.apps.gitHubBotConfiguration.events.readyForReview"),
    mention: t("app.apps.gitHubBotConfiguration.events.mention"),
    comment: t("app.apps.gitHubBotConfiguration.events.comment"),
  }[event];
}
function GitHubHelp({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t("app.upstreamOct10.aboutLabel", { label })}
          className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

export function GitHubToggle({
  label,
  description,
  help,
  checked,
  onChange,
  ariaLabel,
  disabled,
}: {
  label: string;
  description?: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="break-words text-sm font-medium">{label}</p>
          {help && <GitHubHelp label={label}>{help}</GitHubHelp>}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ToggleSwitch
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}
/** Keep separators while typing; the saved policy still contains normalized lists. */
function GitHubListInput({
  id,
  values,
  separator = "\n",
  onChange,
}: {
  id: string;
  values: string[];
  separator?: "\n" | ",";
  onChange: (values: string[]) => void;
}) {
  useTranslation();
  const joiner = separator === "," ? ", " : "\n";
  const [text, setText] = useState(values.join(joiner));
  const parse = (value: string) =>
    value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
  useEffect(() => {
    setText((current) =>
      JSON.stringify(parse(current)) === JSON.stringify(values)
        ? current
        : values.join(joiner),
    );
  }, [values, separator]);
  const props = {
    id,
    value: text,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setText(event.target.value);
      onChange(parse(event.target.value));
    },
  };
  return separator === "\n" ? <Textarea {...props} /> : <Input {...props} />;
}

function GitHubPassingScore({
  value,
  onChange,
  onValidityChange,
  text: controlledText,
  onTextChange,
}: {
  text?: string;
  onTextChange?: (text: string) => void;
  value: GitHubReviewPolicy["ratingThreshold"];
  onChange: (value: GitHubReviewPolicy["ratingThreshold"]) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  useTranslation();
  const id = useId();
  const [localText, setLocalText] = useState(String(value ?? 5));
  const text = controlledText ?? localText;
  const setText = onTextChange ?? setLocalText;
  const number = Number(text);
  const valid = value === null || (text.trim() !== "" && Number.isInteger(number) && number >= 1 && number <= 5);
  useEffect(() => setLocalText(String(value ?? 5)), [value]);
  useEffect(() => { onValidityChange?.(valid); }, [valid, onValidityChange]);
  return (
    <div className="space-y-3 py-3">
      <Label htmlFor={id}>{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.passingScore")}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Input id={id} type="number" min={1} max={5} step={1} required
            className="w-20" value={text} disabled={value === null}
            aria-invalid={!valid} aria-describedby={`${id}-help${valid ? "" : ` ${id}-error`}`}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              const score = Number(next);
              if (next.trim() && Number.isInteger(score) && score >= 1 && score <= 5)
                onChange(score as 1 | 2 | 3 | 4 | 5);
            }} />
          <span className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.outOf5")}</span>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox aria-label={t("app.apps.gitHubBotConfiguration.policy.reportOnly")} checked={value === null}
            onCheckedChange={(checked) => { setText("5"); onChange(checked === true ? null : 5); }} />
          {t("app.apps.gitHubBotConfiguration.policy.reportOnly")}
        </Label>
      </div>
      {!valid && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.enterAWholeNumberFrom1To5")}</p>}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {value === null
          ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.publishesANeutralCheckWithoutAScoreRequirementGitHub")
          : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.paperclipPassesTheCheckWhenACompleteReviewOf")}
      </p>
      <p className="text-xs text-muted-foreground"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubBotConfiguration.message85" components={{ part0: <strong>{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.paperclipReview")}</strong>, part1: <a className="underline hover:text-foreground"
          href="https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository"
          target="_blank" rel="noreferrer">{t("app.apps.gitHubBotManagement.configureOnGithub")}</a> }} /></p>
    </div>
  );
}

export function GitHubPolicyEditor({
  policy,
  onChange,
  accessHref,
  onValidityChange,
  scoreText,
  onScoreTextChange,
  rememberedAutomaticMode,
  readOnly = false,
}: {
  accessHref?: string;
  readOnly?: boolean;
  scoreText?: string;
  onScoreTextChange?: (text: string) => void;
  rememberedAutomaticMode?: "linked_authors" | "allowed_authors";
  policy: GitHubReviewPolicy;
  onChange: (policy: GitHubReviewPolicy) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  useTranslation();
  const id = useId();
  const automaticMode = useRef<"linked_authors" | "allowed_authors">(
    "linked_authors",
  );
  if (policy.invocation !== "mentions_only")
    automaticMode.current = policy.invocation;
  const filterField = (
    key:
      | "includeAuthors"
      | "excludeAuthors"
      | "targetBranches"
      | "excludedBranches"
      | "requiredLabels"
      | "excludedLabels"
      | "ignoredPaths",
    label: string,
    help: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`${id}-github-${key}`}>{label}</Label>
      <GitHubListInput
        id={`${id}-github-${key}`}
        values={policy[key]}
        onChange={(values) => set(key, values)}
      />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
  const [prompt, setPrompt] = useState<
    (typeof GITHUB_REVIEW_EVENTS)[number] | "issue_opened"
  >("opened");
  const set = <K extends keyof GitHubReviewPolicy>(
    key: K,
    value: GitHubReviewPolicy[K],
  ) => onChange({ ...policy, [key]: value });
  return (
    <div className="space-y-8">
      <section
        className="space-y-3"
        aria-labelledby={`${id}-github-instructions-heading`}
      >
        <h2
          id={`${id}-github-instructions-heading`}
          className="text-base font-semibold"
        >
          {t("app.agentUi.agentDetailNavigation.instructions")}
        </h2>
        <MarkdownEditor
          readOnly={readOnly}
          ariaLabel={translateUiCopy("app.routines.webhookFields.agentInstructions")}
          contentClassName="min-h-32"
          value={policy.instructions}
          placeholder={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.whatShouldThisAgentDoOnGitHub")}
          onChange={(value) => set("instructions", value)}
        />
        <p className="text-xs text-muted-foreground">
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.includedInEveryGitHubTaskTypeToSelectA")}
        </p>
        <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.eventSpecificInstructions")}>
          <div className="grid gap-3 pt-3">
            <Label htmlFor={`${id}-github-prompt-event`} className="sr-only">
              {t("app.reviewProtocolLabels.event")}
            </Label>
            <select
              id={`${id}-github-prompt-event`}
              className={githubSelectClass}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value as typeof prompt)}
            >
              {GITHUB_REVIEW_EVENTS.map((event) => (
                <option key={event} value={event}>
                  {eventLabel(event)}
                </option>
              ))}
              <option value="issue_opened">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.newIssue")}</option>
            </select>
            <MarkdownEditor
              key={prompt}
              readOnly={readOnly}
              ariaLabel={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.value0Instructions", { value0: String(prompt === "issue_opened" ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.newIssue") : eventLabel(prompt)) })}
              contentClassName="min-h-32"
              value={
                prompt === "issue_opened"
                  ? (policy.issueOpenedInstructions ?? "")
                  : policy.prompts[prompt]
              }
              onChange={(value) =>
                prompt === "issue_opened"
                  ? set("issueOpenedInstructions", value)
                  : set("prompts", {
                      ...policy.prompts,
                      [prompt]: value,
                    })
              }
            />
            <p className="text-xs text-muted-foreground">
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.addedToTheMainInstructionsForThisEventType")}
            </p>
          </div>
        </GitHubSettingsDisclosure>
      </section>
      <section
        className="space-y-3"
        aria-labelledby={`${id}-github-triggers-heading`}
      >
        <h2
          id={`${id}-github-triggers-heading`}
          className="text-base font-semibold"
        >
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.whenToRun")}
        </h2>
        <div className="flex items-start gap-3 py-2">
          <AtSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.whenMentioned")}</p>
            <p className="text-xs text-muted-foreground"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubBotConfiguration.message86" components={{ part0: <>{""}{accessHref && (
                <Link className="underline underline-offset-4" to={accessHref}>
                  {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.managePeopleInAccess")}
                </Link>
              )}</> }} /></p>
          </div>
        </div>
        <GitHubToggle
          label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.runAutomatically")}
          description={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.startWorkWithoutAMentionWhenAnAllowedPerson")}
          checked={policy.invocation !== "mentions_only"}
          onChange={(enabled) =>
            set("invocation", enabled ? (rememberedAutomaticMode ?? automaticMode.current) : "mentions_only")
          }
        />
        {policy.invocation !== "mentions_only" && (
          <div className="space-y-4">
            <div
              className="grid gap-x-6 gap-y-3 sm:grid-cols-2"
              aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.automaticEvents")}
            >
              {GITHUB_REVIEW_EVENTS.slice(0, 4).map((event) => (
                <Label
                  key={event}
                  className="flex cursor-pointer items-center gap-3 text-sm font-normal"
                >
                  <Checkbox
                    checked={policy.events.includes(event)}
                    onCheckedChange={(enabled) =>
                      set(
                        "events",
                        enabled === true
                          ? [...new Set([...policy.events, event])]
                          : policy.events.filter((value) => value !== event),
                      )
                    }
                  />
                  {eventLabel(event)}
                </Label>
              ))}
              <Label className="flex cursor-pointer items-center gap-3 text-sm font-normal">
                <Checkbox
                  checked={policy.issueOpened === true}
                  onCheckedChange={(enabled) =>
                    set("issueOpened", enabled === true)
                  }
                />
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.newIssues")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.runsForAuthorizedAuthorsInAccessUseTheAuthor")}
            </p>
            <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.automaticReviewFilters")}>
              <div>
                <GitHubToggle
                  label={t("app.apps.gitHubBotConfiguration.policy.drafts")}
                  checked={policy.reviewDrafts}
                  onChange={(value) => set("reviewDrafts", value)}
                />
                <GitHubToggle
                  label={t("app.apps.gitHubBotConfiguration.policy.botAuthors")}
                  description={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.theAccountAlsoNeedsASponsorAndExternalContributor")}
                  checked={policy.reviewBotAuthors}
                  onChange={(value) => set("reviewBotAuthors", value)}
                />
              </div>
              <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.authors")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filterField(
                    "includeAuthors",
                    t("app.apps.gitHubBotConfiguration.filters.includeAuthors"),
                    "Leave empty for all authorized authors. One username or glob per line.",
                  )}
                  {filterField(
                    "excludeAuthors",
                    t("app.apps.gitHubBotConfiguration.filters.excludeAuthors"),
                    t("app.apps.gitHubBotConfiguration.filters.excludeAuthorsHelp"),
                  )}
                </div>
              </GitHubSettingsDisclosure>
              <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.branches")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filterField(
                    "targetBranches",
                    t("app.apps.gitHubBotConfiguration.filters.targetBranches"),
                    t("app.apps.gitHubBotConfiguration.filters.targetBranchesHelp"),
                  )}
                  {filterField(
                    "excludedBranches",
                    "Excluded branches",
                    "Supports * and **.",
                  )}
                </div>
              </GitHubSettingsDisclosure>
              <GitHubSettingsDisclosure title={t("app.reports.caseDetail.labels")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filterField(
                    "requiredLabels",
                    t("app.apps.gitHubBotConfiguration.filters.requiredLabels"),
                    t("app.apps.gitHubBotConfiguration.filters.requiredLabelsHelp"),
                  )}
                  {filterField(
                    "excludedLabels",
                    t("app.apps.gitHubBotConfiguration.filters.excludedLabels"),
                    t("app.apps.gitHubBotConfiguration.filters.excludedLabelsHelp"),
                  )}
                </div>
              </GitHubSettingsDisclosure>
              <p className="text-xs text-muted-foreground">
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.reviewsRequestedByMentionBypassTheseSchedulingFiltersRepository")}
              </p>
            </GitHubSettingsDisclosure>
          </div>
        )}
      </section>
      <section
        className="space-y-3"
        aria-labelledby={`${id}-github-results-heading`}
      >
        <h2
          id={`${id}-github-results-heading`}
          className="text-base font-semibold"
        >
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.reviewResults")}
        </h2>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <GitHubToggle
            label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.postAReviewSummary")}
            checked={policy.publishSummary}
            onChange={(value) => set("publishSummary", value)}
          />
          <GitHubToggle
            label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.postInlineFindings")}
            checked={policy.publishInline}
            onChange={(value) => set("publishInline", value)}
          />
        </div>
        <GitHubPassingScore value={policy.ratingThreshold} text={scoreText} onTextChange={onScoreTextChange}
          onChange={(value) => set("ratingThreshold", value)} onValidityChange={onValidityChange} />
      </section>
      <div className="divide-y divide-border">
        <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.ignoredFiles")}>
          {filterField(
            "ignoredPaths",
            "File patterns",
            "Excluded from all reviews, including @mentions. One pattern per line; supports * and **.",
          )}
        </GitHubSettingsDisclosure>
        <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.inlineCommentOptions")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-github-categories`}>
                {t("app.apps.gitHubBotConfiguration.policy.categories")}
              </Label>
              <GitHubListInput
                id={`${id}-github-categories`}
                values={policy.findingCategories}
                separator=","
                onChange={(values) => set("findingCategories", values)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-github-severity`}>
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.minimumInlineSeverity")}
              </Label>
              <select
                id={`${id}-github-severity`}
                className={githubSelectClass}
                value={policy.minimumCommentSeverity}
                onChange={(e) =>
                  set(
                    "minimumCommentSeverity",
                    e.target
                      .value as GitHubReviewPolicy["minimumCommentSeverity"],
                  )
                }
              >
                <option value="info">{t("app.apps.gitHubBotConfiguration.severity.info")}</option>
                <option value="warning">{t("app.common.labels.warning")}</option>
                <option value="error">{t("app.agentUi.agents.error")}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.hiddenFindingsStillCountInTheAssessment")}
              </p>
            </div>
          </div>
        </GitHubSettingsDisclosure>
        <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.approvalsAndChangeRequests")}>
          <p className="text-xs text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.optionalFormalDecisionsOnGitHubScoresCommentsAndChecks")}
          </p>
          <div>
            <GitHubToggle
              label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowApprovals")}
              help="Lets the agent submit an Approve review on GitHub after a complete assessment. The agent must explicitly choose it; a 5/5 score or passing check does not approve the PR. Off still allows scores, comments, and checks."
              checked={policy.allowApprove}
              onChange={(value) => set("allowApprove", value)}
            />
            <GitHubToggle
              label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowRequestChanges")}
              help="Lets the agent submit a Request changes review on GitHub after a complete assessment. This is a formal review decision and may prevent merging under your repository rules. Off still allows findings, comments, and a failing check."
              checked={policy.allowRequestChanges}
              onChange={(value) => set("allowRequestChanges", value)}
            />
          </div>
        </GitHubSettingsDisclosure>
      </div>
    </div>
  );
}

export function GitHubAccessEditor({
  endpointId,
  companyId,
  configuration,
  onChange,
}: {
  endpointId: string;
  companyId: string;
  configuration: GitHubChatConfiguration;
  onChange: (configuration: GitHubChatConfiguration) => void;
}) {
  useTranslation();
  const company = useOptionalCompany()?.companies.find((item) => item.id === companyId);
  const accountLink = useRef<HTMLAnchorElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dialog, setDialog] = useState<"member" | "guest" | null>(null);
  const members = useQuery({
    queryKey: ["github-members", companyId],
    queryFn: () => accessApi.listMembers(companyId),
  });
  const links = useQuery({
    queryKey: ["github-linked-members", endpointId],
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
  });
  const [login, setLogin] = useState("");
  const [sponsor, setSponsor] = useState(configuration.responsibleUserId);
  const [candidate, setCandidate] = useState<{
    githubUserId: string;
    login: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeMembers = (members.data?.members ?? []).filter(
    (member) =>
      member.status === "active" && member.membershipRole !== "viewer",
  );
  const linkedAccounts = (links.data ?? []).filter(
    (link) => link.status === "linked",
  );
  const responsible = activeMembers.find(
    (member) => member.principalId === configuration.responsibleUserId,
  );
  const memberName = (userId: string) =>
    activeMembers.find((member) => member.principalId === userId)?.user?.name ??
    userId;
  const automatic = configuration.defaults.invocation !== "mentions_only";
  const guestsAutomatic =
    configuration.defaults.invocation === "allowed_authors";
  const guests = configuration.people.filter(
    (person) => person.kind === "guest",
  );
  // Preserve configured members whose identity link was revoked; show why they cannot run.
  const memberRows = [
    ...configuration.people.filter((person) => person.kind === "member"),
    ...linkedAccounts
      .filter(
        (link) =>
          link.githubUserId &&
          link.paperclipUserId &&
          !configuration.people.some(
            (person) => person.githubUserId === link.githubUserId,
          ),
      )
      .map((link): GitHubAllowedPerson => ({
        kind: "member",
        userId: link.paperclipUserId!,
        githubUserId: link.githubUserId!,
        login: link.githubLogin ?? link.externalLabel,
      })),
  ];
  const updatePerson = (person: GitHubAllowedPerson) =>
    onChange({
      ...configuration,
      people: configuration.people.some(
        (p) => p.githubUserId === person.githubUserId,
      )
        ? configuration.people.map((p) =>
            p.githubUserId === person.githubUserId ? person : p,
          )
        : [...configuration.people, person],
    });
  const removePerson = (person: GitHubAllowedPerson) =>
    onChange({
      ...configuration,
      people: configuration.people.filter(
        (p) => p.githubUserId !== person.githubUserId,
      ),
    });
  const unlink = async (principalId: string) => {
    setBusy(true);
    setError("");
    try {
      await chatEndpointsApi.revokeLink(endpointId, principalId);
      await links.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("app.apps.gitHubBotConfiguration.access.unlinkFailed"),
      );
    } finally {
      setBusy(false);
    }
  };
  const peopleRows = (people: GitHubAllowedPerson[]) => (
    <div className="divide-y divide-border">
      {people.map((person) => {
        const identity = linkedAccounts.find(
          (link) => link.githubUserId === person.githubUserId,
        );
        const linked = person.kind === "guest" || Boolean(identity);
        const explicit = configuration.people.some(
          (p) => p.githubUserId === person.githubUserId,
        );
        const mentions =
          person.kind === "guest" ||
          configuration.memberAccess === "all_linked" ||
          explicit;
        const removable = explicit && (person.kind === "guest" || configuration.memberAccess === "selected");
        return (
          <div
            key={person.githubUserId}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4"
          >
            <div className="min-w-0 flex-1 basis-32">
              <p className="break-words text-sm font-medium">@{person.login}</p>
              <p className="text-xs text-muted-foreground">
                {person.kind === "guest"
                  ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.sponsoredByValue0", { value0: String(memberName(person.sponsorUserId)) })
                  : (identity?.paperclipUserLabel ?? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.companyMember"))}
              </p>
              {!linked && (
                <p className="mt-1 text-xs text-destructive">
                  {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.gitHubAccountNeedsLinking")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.mentions")}</span>
                {person.kind === "guest" ||
                configuration.memberAccess === "all_linked" ? (
                  <span
                    className="flex h-5 items-center gap-1 text-xs"
                    aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.mentionsValue0ForValue1", { value0: String(linked ? translateUiCopy("app.tools.shared.decision.allow") : translateUiCopy("app.settings.adapterManager.versionUnavailable")), value1: String(person.login) })}
                  >
                    {linked && (
                      <Check className="size-3.5 text-muted-foreground" />
                    )}
                    {linked ? t("app.taskChat.runTranscriptView.allowed") : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.unlinked")}
                  </span>
                ) : (
                  <ToggleSwitch
                    aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowMentionsFromValue0", { value0: String(person.login) })}
                    checked={mentions}
                    disabled={!linked}
                    onCheckedChange={(enabled) =>
                      enabled ? updatePerson(person) : removePerson(person)
                    }
                  />
                )}
              </div>
              {(identity || removable) && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.manageValue0", { value0: String(person.login) })}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {removable && (
                    <DropdownMenuItem onClick={() => removePerson(person)}>
                      {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.removeAccess")}
                    </DropdownMenuItem>
                  )}
                  {identity && (
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => void unlink(identity.principalId)}
                    >
                      {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.unlinkGitHubAccount")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <section className="space-y-6" aria-label={translateUiCopy("app.projects.projectAccessMembers.people")}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{translateUiCopy("app.projects.projectAccessMembers.people")}</h2>
        <p className="text-sm text-muted-foreground">
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.chooseWhoCanMentionThisBotAndWhoseActivity")}
        </p>
      </div>
      <section className="space-y-2" aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.companyMembers")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.companyMembers")}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialog("member");
              setLinkCopied(false);
              setError("");
            }}
          >
            <Plus className="size-4" />
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.linkAMember")}
          </Button>
        </div>
        <GitHubToggle
          label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowMentionsFromAllLinkedMembers")}
          description={
            configuration.memberAccess === "all_linked"
              ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.includesMembersFromValue0WhoLinkTheirGitHubAccountLater", { value0: String(company?.name ?? translateUiCopy("app.uiCopy.pagesSkillSources.thisCompany")) })
              : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.onlyMembersYouEnableBelowCanMentionThisBot")
          }
          checked={configuration.memberAccess === "all_linked"}
          onChange={(enabled) =>
            onChange({
              ...configuration,
              memberAccess: enabled ? "all_linked" : "selected",
            })
          }
        />
        {peopleRows(memberRows)}
        {links.isPending && (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.loadingLinkedAccounts")}
          </p>
        )}
        {!links.isPending && !links.isError && memberRows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.noMembersLinkedYetLinkAnAccountToGet")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {automatic ? (
            <>
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.automaticRunsUseTheEventsAndAuthorFiltersIn")}{" "}
              <Link
                className="underline underline-offset-4"
                to={`/apps/chat/${endpointId}/settings`}
              >
                {t("app.common.nouns.settings")}
              </Link>
              {t("app.issueChat.legacyRecovery.period")}
            </>
          ) : (
            <>
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.automaticRunsAreOffIn")}{" "}
              <Link
                className="underline underline-offset-4"
                to={`/apps/chat/${endpointId}/settings`}
              >
                {t("app.common.nouns.settings")}
              </Link>
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.authorizedMentionsStillWork")}
            </>
          )}
        </p>
      </section>
      <section
        className="space-y-2 border-t border-border pt-6"
        aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.externalContributors")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.externalContributors")}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialog("guest");
              setLookupError("");
            }}
          >
            <Plus className="size-4" />
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.addExternalContributor")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowSpecificGitHubUsersWithAMemberAsTheir")}
        </p>
        {peopleRows(guests)}
        {guests.length > 0 && (
          <GitHubToggle
            label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowAutomaticRunsForExternalContributors")}
            description={
              automatic
                ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.authorizedContributorsCanTriggerTheEventsAndAuthorFilters")
                : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.turnOnAutomaticRunsInSettingsFirstMentionsRemain")
            }
            checked={guestsAutomatic}
            disabled={!automatic}
            onChange={(enabled) =>
              onChange({
                ...configuration,
                defaults: {
                  ...configuration.defaults,
                  invocation: enabled ? "allowed_authors" : "linked_authors",
                },
              })
            }
          />
        )}
      </section>
      <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.automaticTaskResponsibility")}>
        <div className="space-y-2">
          {activeMembers.length === 1 && responsible ? (
            <p className="text-sm"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubBotConfiguration.message87" components={{ part0: <>{""}{memberName(configuration.responsibleUserId)}</> }} /></p>
          ) : (
            <>
              <Label htmlFor="github-responsible">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.responsibleMember2")}</Label>
              <select
                id="github-responsible"
                className={githubSelectClass}
                value={configuration.responsibleUserId}
                onChange={(e) =>
                  onChange({
                    ...configuration,
                    responsibleUserId: e.target.value,
                  })
                }
              >
                {!responsible && (
                  <option value={configuration.responsibleUserId}>
                    {configuration.responsibleUserId || translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.selectAMember")}
                  </option>
                )}
                {activeMembers.map((member) => (
                  <option key={member.principalId} value={member.principalId}>
                    {member.user?.name ??
                      member.user?.email ??
                      member.principalId}
                  </option>
                ))}
              </select>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.theMemberAccountableForAutomaticallyCreatedPaperclipTasksGitHub")}
          </p>
        </div>
      </GitHubSettingsDisclosure>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {(members.error || links.error) && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.couldNotLoadMembersOrLinkedAccounts")}
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              void members.refetch();
              void links.refetch();
            }}
          >
            {t("app.issueUi.projectRepositoryInput.tryAgain")}
          </Button>
        </div>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "member"
                ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.linkACompanyMember")
                : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.addExternalContributor")}
            </DialogTitle>
            <DialogDescription>
              {dialog === "member"
                ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.eachMemberConfirmsTheirOwnGitHubIdentityShareThis")
                : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.allowAGitHubUserToMentionThisBotA")}
            </DialogDescription>
          </DialogHeader>
          {dialog === "member" ? (
            <>
              <Button
                variant="outline"
                aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.copyAccountLinkingURL")}
                onClick={() => {
                  if (accountLink.current)
                    void copyTextToClipboard(accountLink.current.href).then(
                      () => setLinkCopied(true),
                      () =>
                        setError(
                          t("app.apps.gitHubBotConfiguration.access.copyLinkFailed"),
                        ),
                    );
                }}
              >
                <Copy className="size-4" />
                {linkCopied ? t("app.agentUi.agentDetail.copied") : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.copyInvitationLink")}
              </Button>
              <Link
                ref={accountLink}
                to={`/apps/chat/connect?provider=github&resume=${endpointId}&stage=identity`}
                className="text-sm underline underline-offset-4"
              >
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.linkYourAccount")}
              </Link>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="github-guest-login">{t("app.apps.gitHubBotConfiguration.access.username")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="github-guest-login"
                    value={login}
                    placeholder="octocat"
                    disabled={busy}
                    onChange={(e) => {
                      setLogin(e.target.value);
                      setCandidate(null);
                      setLookupError("");
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={busy || !login.trim()}
                    onClick={async () => {
                      setBusy(true);
                      setLookupError("");
                      setCandidate(null);
                      try {
                        setCandidate(
                          await githubChatApi.lookup(endpointId, login),
                        );
                      } catch (e) {
                        setLookupError(
                          e instanceof Error ? e.message : t("app.apps.gitHubBotConfiguration.access.lookupFailed"),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.lookingUp") : t("app.apps.gitHubBotConfiguration.access.lookUp")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-guest-sponsor">{t("app.apps.gitHubBotConfiguration.access.sponsor")}</Label>
                <select
                  id="github-guest-sponsor"
                  className={githubSelectClass}
                  value={sponsor}
                  onChange={(e) => setSponsor(e.target.value)}
                >
                  {!activeMembers.some(
                    (member) => member.principalId === sponsor,
                  ) && <option value={sponsor}>{translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.selectAMember")}</option>}
                  {activeMembers.map((member) => (
                    <option key={member.principalId} value={member.principalId}>
                      {member.user?.name ?? member.principalId}
                    </option>
                  ))}
                </select>
              </div>
              {candidate && (
                <p role="status" className="text-sm">
                  {configuration.people.some(
                    (p) => p.githubUserId === candidate.githubUserId,
                  ) ||
                  linkedAccounts.some(
                    (link) => link.githubUserId === candidate.githubUserId,
                  )
                    ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.value0IsAlreadyListedInPeople", { value0: String(candidate.login) })
                    : translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.foundValue0TheyWillBeAbleToMentionTheBot", { value0: String(candidate.login) })}
                </p>
              )}
              {lookupError && (
                <p role="alert" className="text-sm text-destructive">
                  {lookupError}
                </p>
              )}
              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  {t("app.agentUi.agentDetail.cancel")}
                </Button>
                <Button
                  disabled={
                    !candidate ||
                    !activeMembers.some(
                      (member) => member.principalId === sponsor,
                    ) ||
                    configuration.people.some(
                      (p) => p.githubUserId === candidate.githubUserId,
                    ) ||
                    linkedAccounts.some(
                      (link) => link.githubUserId === candidate.githubUserId,
                    )
                  }
                  onClick={() => {
                    if (candidate) {
                      updatePerson({
                        ...candidate,
                        kind: "guest",
                        sponsorUserId: sponsor,
                        permissionProfile: "restricted",
                      });
                      setDialog(null);
                      setCandidate(null);
                      setLogin("");
                    }
                  }}
                >
                  {translateUiCopy("app.uiCopy.pagesAppsChatGitHubBotConfiguration.addContributor")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
