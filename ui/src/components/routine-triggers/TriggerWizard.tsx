import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  AlertCircle,
  Globe,
  GitBranch,
  Radio,
  Webhook,
} from "lucide-react";
import {
  SetupWizardNavigation,
  SetupWizardFooter,
} from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { cn } from "@/lib/utils";
import { t as translate, useTranslation } from "@/i18n";
import { AgentInstructions, CopyField } from "./WebhookFields";
import { WebhookUrlWarning } from "./WebhookUrlWarning";

export type TriggerDraft = {
  kind: "choose" | "schedule" | "webhook";
  step: number;
  availableStep: number;
  sender: "custom" | "github";
  /** Retained when resuming webhooks created before generic signed-app support. */
  signingMode?: "bearer" | "app_webhook" | "fireflies_hmac";
  frequency: string;
  time: string;
  weekday: string;
  timezone: string;
  created: boolean;
};
export const defaultTriggerDraft: TriggerDraft = {
  kind: "choose",
  step: 0,
  availableStep: 0,
  sender: "custom",
  frequency: "weekdays",
  time: "09:00",
  weekday: "Monday",
  timezone: "America/Chicago",
  created: false,
};
export function webhookAgentInstructions(
  sender: TriggerDraft["sender"],
  routineTitle: string,
  webhookUrl: string,
  webhookSecret: string,
  setupPending = true,
  signingMode: TriggerDraft["signingMode"] = "app_webhook",
) {
  const common = [
    `Connect the sending app to the Paperclip routine ${JSON.stringify(routineTitle)}.`,
    `Webhook URL: ${webhookUrl}`,
    "Send an HTTP POST request with a JSON object as the body (not an array or string).",
    "Content-Type: application/json",
  ];
  const auth =
    sender === "github"
      ? [
          "In GitHub, open your repository → Settings → Webhooks → Add webhook.",
          "Use the webhook URL above as Payload URL and select application/json as Content type.",
          `Secret: ${webhookSecret}`,
          "Paste this value into GitHub’s Secret field. GitHub signs requests with X-Hub-Signature-256; do not use Bearer authentication.",
          "Select the events that should start this routine, enable the webhook, and save.",
          "To check the connection, open Recent Deliveries and redeliver an event.",
        ]
      : [
          `Secret key: ${webhookSecret}`,
          ...(signingMode === "bearer" ? [] : [
            `If the app asks for a signing secret, paste the secret key above. Paperclip accepts HMAC-SHA256 over the exact request body in ${signingMode === "fireflies_hmac" ? "X-Hub-Signature" : "X-Hub-Signature or X-Hub-Signature-256"}, formatted sha256=<hex digest>.`,
          ]),
          ...(signingMode === "fireflies_hmac" ? [] : [
            `For apps with custom headers, use Authorization: Bearer ${webhookSecret}`,
          ]),
          "Subscribe only to the events that should start this routine. Public services need a publicly reachable HTTPS URL.",
          "In the sending app, add a webhook using this URL, POST method, JSON body, and headers, then save it.",
          "Send a unique Idempotency-Key header for each event and reuse it on retries, so retrying a setup test after activation cannot start the routine.",
          'Example JSON body: {"event":"deployment.completed","environment":"production"}',
          "To check the connection, send a test event from the app or perform the action that triggers a delivery.",
        ];
  return [
    ...common,
    ...auth,
    "Open Check connection in Paperclip to see whether the event arrived and authentication passed.",
    ...(setupPending
      ? [
          "During setup, deliveries only test the connection. They do not start the routine or create a task.",
          "Finish setup in Paperclip to enable this webhook for future events. Test events are not replayed.",
        ]
      : [
          "This webhook is enabled. Deliveries can start the routine and create tasks.",
        ]),
    "Store the key securely; do not put it in source control or logs.",
  ].join("\n");
}
const WEEKDAY_LABEL_KEYS: Record<string, string> = {
  Monday: "app.lib.cronReadable.monday",
  Tuesday: "app.lib.cronReadable.tuesday",
  Wednesday: "app.lib.cronReadable.wednesday",
  Thursday: "app.lib.cronReadable.thursday",
  Friday: "app.lib.cronReadable.friday",
  Saturday: "app.lib.cronReadable.saturday",
  Sunday: "app.lib.cronReadable.sunday",
};
function weekdayLabel(day: string) {
  const key = WEEKDAY_LABEL_KEYS[day];
  return key ? translate(key) : day;
}
export function describeSchedule(draft: TriggerDraft) {
  const time = draft.time;
  if (draft.frequency === "daily") return translate("app.lib.cronReadable.everyDayAt", { time });
  if (draft.frequency === "weekly") {
    return translate("app.lib.cronReadable.everyDayOfWeekAt", { day: weekdayLabel(draft.weekday), time });
  }
  return translate("app.lib.cronReadable.everyWeekdayAt", { time });
}
export function RoutineTriggerWizard({
  initialDraft,
  onSaveExit,
  onFinish,
  onCreateWebhook,
  onRotateKey,
  routineTitle,
  routineId,
  routineActive = true,
  webhookUrl = "",
  webhookSecret = "",
  checkResult = "waiting",
}: {
  initialDraft: TriggerDraft;
  routineTitle: string;
  routineId: string;
  routineActive?: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  onCreateWebhook?: (draft: TriggerDraft) => Promise<void>;
  onRotateKey?: () => Promise<void>;
  onSaveExit: (draft: TriggerDraft) => void | Promise<void>;
  onFinish: (draft: TriggerDraft) => void | Promise<void>;
  checkResult?: "waiting" | "received" | "rejected" | "no_event";
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { setBreadcrumbs } = useBreadcrumbs();
  const perform = useCallback(
    async (action: () => void | Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setSaveError("");
      try {
        await action();
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : t("app.routines.triggerWizard.couldntSave"),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, t],
  );
  const saveAndExit = useCallback(() => {
    void perform(() => onSaveExit(draft));
  }, [draft, onSaveExit, perform]);
  useEffect(() => {
    setBreadcrumbs([
      {
        label: routineTitle,
        href: `/routines/${routineId}/triggers`,
        onClick: (event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          saveAndExit();
        },
      },
      { label: t("app.routines.triggerWizard.addTrigger") },
    ]);
  }, [saveAndExit, setBreadcrumbs, routineTitle, routineId, t]);
  const schedule = draft.kind === "schedule";
  const github = draft.sender === "github";
  const labels = schedule
    ? [t("app.routines.triggerWizard.stepChooseTrigger"), t("app.routines.triggerWizard.stepSetSchedule"), t("app.routines.triggerWizard.reviewSchedule")]
    : [t("app.routines.triggerWizard.stepChooseTrigger"), t("app.routines.triggerWizard.connectYourApp"), t("app.routines.triggerWizard.checkConnection")];
  function patch(values: Partial<TriggerDraft>) {
    setDraft((current) => ({ ...current, ...values }));
  }
  function advance() {
    void perform(async () => {
      if (draft.kind === "webhook" && draft.step === 0 && !draft.created)
        await onCreateWebhook?.(draft);
      const step = draft.step + 1;
      patch({
        step,
        availableStep: Math.max(draft.availableStep, step),
        created:
          draft.created || (draft.kind === "webhook" && draft.step === 0),
      });
    });
  }
  const title =
    draft.step === 0
      ? t("app.routines.triggerWizard.titleChoose")
      : schedule
        ? draft.step === 1
          ? t("app.routines.triggerWizard.titleSetSchedule")
          : t("app.routines.triggerWizard.titleReviewSchedule")
        : draft.step === 1
          ? github
            ? t("app.routines.triggerWizard.titleConnectGithub")
            : t("app.routines.triggerWizard.connectYourApp")
          : t("app.routines.triggerWizard.titleCheckConnection");
  const subtitle =
    draft.step === 0
      ? t("app.routines.triggerWizard.subtitleChoose", { title: routineTitle })
      : schedule
        ? draft.step === 1
          ? t("app.routines.triggerWizard.subtitleSetSchedule")
          : t("app.routines.triggerWizard.subtitleReviewSchedule")
        : draft.step === 1
          ? t("app.routines.triggerWizard.subtitleConnect")
          : t("app.routines.triggerWizard.subtitleCheck");
  const selectClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const goBack = (
    <Button variant="outline" onClick={() => patch({ step: draft.step - 1 })}>
      {t("app.common.actions.back")}
    </Button>
  );
  return (
    <div className="min-w-0 w-full max-w-2xl space-y-6">
      <SetupWizardNavigation
        takeover
        disabled={busy}
        ariaLabel={t("app.routines.triggerWizard.progressLabel")}
        labels={labels}
        step={draft.step}
        availableStep={draft.availableStep}
        onSelect={(step) => patch({ step })}
      />
      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {!schedule && draft.step > 0 && <WebhookUrlWarning url={webhookUrl} />}
        {draft.step === 0 && (
          <fieldset className="space-y-3">
            <legend className="sr-only">{t("app.routines.triggerWizard.triggerType")}</legend>
            {(
              [
                {
                  kind: "schedule",
                  label: t("app.routines.triggerWizard.onSchedule"),
                  detail: t("app.routines.triggerWizard.onScheduleDetail"),
                  Icon: CalendarClock,
                },
                {
                  kind: "webhook",
                  label: t("app.routines.triggerWizard.onWebhook"),
                  detail: t("app.routines.triggerWizard.onWebhookDetail"),
                  Icon: Webhook,
                },
              ] as const
            ).map(({ kind, label, detail, Icon }) => (
              <label
                key={kind}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-4 focus-within:ring-2 focus-within:ring-ring",
                  draft.kind === kind
                    ? "border-primary bg-accent/30"
                    : "border-border hover:bg-accent/20",
                )}
              >
                <input
                  type="radio"
                  name="trigger-kind"
                  checked={draft.kind === kind}
                  disabled={draft.created && kind !== draft.kind}
                  onChange={() =>
                    patch({
                      kind,
                      availableStep:
                        kind === draft.kind ? draft.availableStep : 0,
                    })
                  }
                  className="sr-only"
                />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {detail}
                  </span>
                </span>
                {draft.kind === kind && <Check className="h-4 w-4" />}
              </label>
            ))}
          </fieldset>
        )}
        {schedule && draft.step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repeat">{t("app.routines.triggerWizard.repeat")}</Label>
                <select
                  id="repeat"
                  className={selectClass}
                  value={draft.frequency}
                  onChange={(event) => patch({ frequency: event.target.value })}
                >
                  <option value="daily">{t("app.routines.triggerWizard.everyDay")}</option>
                  <option value="weekdays">{t("app.routines.triggerWizard.weekdaysOption")}</option>
                  <option value="weekly">{t("app.routines.triggerWizard.everyWeek")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-time">{t("app.routines.triggerWizard.time")}</Label>
                <Input
                  id="run-time"
                  type="time"
                  value={draft.time}
                  onChange={(event) => patch({ time: event.target.value })}
                />
              </div>
            </div>
            {draft.frequency === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="run-day">{t("app.routines.triggerWizard.day")}</Label>
                <select
                  id="run-day"
                  className={selectClass}
                  value={draft.weekday}
                  onChange={(event) => patch({ weekday: event.target.value })}
                >
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <option key={day} value={day}>{weekdayLabel(day)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="timezone">{t("app.routines.triggerWizard.timeZone")}</Label>
              <select
                id="timezone"
                className={selectClass}
                value={draft.timezone}
                onChange={(event) => patch({ timezone: event.target.value })}
              >
                {Array.from(
                  new Set([
                    draft.timezone,
                    "America/Chicago",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Europe/London",
                    "UTC",
                  ]),
                ).map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {t("app.routines.triggerWizard.timeZoneHelp")}
              </p>
            </div>
          </div>
        )}
        {schedule && draft.step === 2 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-md bg-muted/40 p-4">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{describeSchedule(draft)}</p>
                <p className="text-xs text-muted-foreground">
                  {draft.timezone}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("app.routines.triggerWizard.scheduleReviewNote")}
            </p>
          </div>
        )}
        {draft.step === 0 && draft.kind === "webhook" && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              {t("app.routines.triggerWizard.senderLegend")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    sender: "custom",
                    label: t("app.routines.triggerWizard.senderCustom"),
                    Icon: Globe,
                  },
                  { sender: "github", label: "GitHub", Icon: GitBranch },
                ] as const
              ).map(({ sender, label, Icon }) => (
                <label
                  key={sender}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3 focus-within:ring-2 focus-within:ring-ring",
                    draft.sender === sender
                      ? "border-primary bg-accent/30"
                      : "border-border",
                    draft.created && "cursor-default",
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="sender"
                    checked={draft.sender === sender}
                    disabled={draft.created}
                    onChange={() => patch({ sender })}
                  />
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-sm">{label}</span>
                  {draft.sender === sender && <Check className="h-4 w-4" />}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {draft.kind === "webhook" && draft.step === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("app.routines.triggerWizard.publicHttpsNote")}
          </p>
        )}
        {!schedule && draft.step === 1 && (
          <div className="space-y-5">
            {webhookSecret && (
              <AgentInstructions
                value={webhookAgentInstructions(
                  draft.sender,
                  routineTitle,
                  webhookUrl,
                  webhookSecret,
                  true,
                  draft.signingMode,
                )}
              />
            )}
            <CopyField
              label={github ? t("app.routines.triggerWizard.payloadUrl") : t("app.routines.triggerWizard.webhookUrl")}
              value={webhookUrl}
            />
            {!github && draft.signingMode !== "bearer" && (
              <p className="text-sm text-muted-foreground">
                {t("app.routines.triggerWizard.signingSecretHint")}
                {draft.signingMode !== "fireflies_hmac" && <>
                  {" "}{t("app.routines.triggerWizard.customHeadersHint")}
                </>}
              </p>
            )}
            {webhookSecret ? (
              <CopyField
                label={github ? t("app.common.nouns.secret") : draft.signingMode === "bearer" ? t("app.routines.triggerWizard.authHeaderValue") : t("app.routines.triggerWizard.secretKey")}
                value={!github && draft.signingMode === "bearer" ? `Bearer ${webhookSecret}` : webhookSecret}
              />
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("app.routines.triggerWizard.keyHidden")}
                </p>
                <Button
                  variant="outline"
                  onClick={() => void perform(() => onRotateKey?.())}
                >
                  {t("app.routines.triggerWizard.generateNewKey")}
                </Button>
              </div>
            )}
          </div>
        )}
        {!schedule && draft.step === 2 && (
          <div className="space-y-5">
            <div className="space-y-1 rounded-md border border-border p-4">
              <p className="text-sm font-medium">{t("app.routines.triggerWizard.connectionTestOnly")}</p>
              <p className="text-sm text-muted-foreground">
                {t("app.routines.triggerWizard.connectionTestOnlyDetail")}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {github ? t("app.routines.triggerWizard.sendEventFromGithub") : t("app.routines.triggerWizard.sendEventFromApp")}
              </p>
              <p className="text-sm text-muted-foreground">
                {github
                  ? t("app.routines.triggerWizard.githubRedeliverHint")
                  : t("app.routines.triggerWizard.appSendTestHint")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("app.routines.triggerWizard.keepPageOpen")}
              </p>
            </div>
            <div
              role="status"
              className="flex items-start gap-3 rounded-md bg-muted/40 p-4"
            >
              {checkResult === "received" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-(--status-task-done)" />
              ) : checkResult === "rejected" ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              ) : (
                <Radio className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {checkResult === "received"
                    ? t("app.routines.triggerWizard.checkReceived")
                    : checkResult === "rejected"
                      ? t("app.routines.triggerWizard.checkRejected")
                      : checkResult === "no_event"
                        ? t("app.routines.triggerWizard.checkNoEvent")
                        : t("app.routines.triggerWizard.checkWaiting")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {checkResult === "received"
                    ? t("app.routines.triggerWizard.checkReceivedDetail")
                    : checkResult === "rejected"
                      ? t("app.routines.triggerWizard.checkRejectedDetail")
                      : t("app.routines.triggerWizard.checkWaitingDetail")}
                </p>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {t("app.routines.triggerWizard.troubleshoot")}
              </summary>
              <div className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {t("app.routines.triggerWizard.troubleshootDetail")}
                </p>
                <CopyField label={t("app.routines.triggerWizard.webhookUrl")} value={webhookUrl} />
              </div>
            </details>
          </div>
        )}
        {!schedule && draft.step === 2 && (
          <p className="text-xs text-muted-foreground">
            {routineActive
              ? t("app.routines.triggerWizard.finishActiveNote")
              : t("app.routines.triggerWizard.finishPausedNote")}
          </p>
        )}
        {schedule && draft.step === 2 && !routineActive && (
          <p className="text-sm text-muted-foreground">
            {t("app.routines.triggerWizard.schedulePausedNote")}
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
        <SetupWizardFooter onSaveExit={saveAndExit}>
          {draft.step > 0 && goBack}
          {draft.step === 0 ? (
            <Button disabled={draft.kind === "choose"} onClick={advance}>
              {t("app.common.actions.continue")}
            </Button>
          ) : schedule ? (
            draft.step === 1 ? (
              <Button disabled={!draft.time} onClick={advance}>
                {t("app.routines.triggerWizard.reviewSchedule")}
              </Button>
            ) : (
              <Button onClick={() => void perform(() => onFinish(draft))}>
                {t("app.routines.triggerWizard.addSchedule")}
              </Button>
            )
          ) : draft.step === 1 ? (
            <Button onClick={advance}>{t("app.routines.triggerWizard.checkConnection")}</Button>
          ) : (
            <Button onClick={() => void perform(() => onFinish(draft))}>
              {checkResult === "received"
                ? t("app.routines.triggerWizard.finishSetup")
                : t("app.routines.triggerWizard.finishWithoutChecking")}
            </Button>
          )}
        </SetupWizardFooter>
      </fieldset>
    </div>
  );
}
