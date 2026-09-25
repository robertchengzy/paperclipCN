import { useMemo } from "react";
import {
  humanizeConnectionDisplayName,
  type Agent,
  type ToolCallEvent,
  type ToolConnectionLifecycleEvent,
} from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { Trans } from "react-i18next";
import { t, useTranslation } from "@/i18n";
import { appTabHref } from "../app-tabs";
import type { ActivityPanelProps } from "./types";

export function ActivityPanel(props: ActivityPanelProps) {
  return <RecentActivity {...props} />;
}

type TimelineRow = {
  key: string;
  createdAt: Date | string;
  primary: string;
  dotClass: string;
  /** Secondary "while working on PAP-…" issue link, tool-call rows only. */
  issue?: { identifier: string } | null;
  /** Deep-link rendered after the timestamp, lifecycle rows only. */
  link?: { to: string; label: string } | null;
};

function RecentActivity({
  events,
  lifecycleEvents,
  issues,
  actionRequests,
  loading,
  agents,
  connectionId,
  appName,
  userLabelById,
}: ActivityPanelProps) {
  const { t, i18n } = useTranslation();
  const nameById = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents]);

  const rows = useMemo<TimelineRow[]>(() => {
    const callRows: TimelineRow[] = events
      .filter((e) => HUMANIZED_EVENTS.has(e.eventType))
      .map((event) => {
        const row = humanizeEvent(
          event,
          nameById.get(event.agentId ?? "") ?? null,
          event.actionRequestId ? actionRequests[event.actionRequestId] : undefined,
          isTestEvent(event) ? resolveActorLabel(event.actorId, userLabelById) : null,
        );
        return {
          key: `call:${event.id}`,
          createdAt: event.createdAt,
          primary: row.primary,
          dotClass: dotColor(event),
          issue: event.issueId ? issues[event.issueId] ?? null : null,
        };
      });

    const permissionsHref = appTabHref(connectionId, "permissions");
    const lifecycleRows: TimelineRow[] = lifecycleEvents.map((event) => ({
      key: `lifecycle:${event.id}`,
      createdAt: event.createdAt,
      primary: humanizeLifecycleEvent(event, appName, nameById.get(event.agentId ?? "") ?? null),
      dotClass: lifecycleDotColor(event),
      link: { to: permissionsHref, label: lifecycleLinkLabel(event) },
    }));

    return [...callRows, ...lifecycleRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [events, lifecycleEvents, issues, actionRequests, nameById, connectionId, appName, userLabelById]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("app.apps.activityPanel.recentActivity")}</h2>
      </div>
      {loading ? (
        <div className="space-y-2 py-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-5 text-sm text-muted-foreground">{t("app.common.messages.noActivityYet")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-3 py-3 text-sm">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", row.dotClass)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-foreground">{row.primary}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.issue ? (
                    <>
                      <Trans
                        i18nKey="app.apps.activityPanel.whileWorkingOn"
                        values={{ identifier: row.issue.identifier }}
                        components={{
                          issueLink: (
                            <Link
                              to={`/issues/${row.issue.identifier}`}
                              className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                            />
                          ),
                        }}
                      />
                      {" · "}
                    </>
                  ) : null}
                  {timeAgo(row.createdAt, i18n.language)}
                  {row.link ? (
                    <>
                      {" · "}
                      <Link
                        to={row.link.to}
                        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.link.label}
                      </Link>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const HUMANIZED_EVENTS = new Set<ToolCallEvent["eventType"]>([
  "call_completed",
  "call_failed",
  "call_denied",
  "approval_requested",
  "approval_resolved",
]);

/**
 * A row is a prosumer Test-tab call (vs. a real heartbeat-driven agent run) when
 * the gateway tagged the audit event `metadata.source === "test"` (PAP-11349).
 */
export function isTestEvent(event: ToolCallEvent): boolean {
  return (event.metadata as { source?: unknown } | null)?.source === "test";
}

/** Display name for the human who ran a Test-tab call, from the company directory. */
export function resolveActorLabel(
  actorId: string | null,
  userLabelById: Map<string, string> | undefined,
): string {
  if (actorId) {
    const label = userLabelById?.get(actorId);
    if (label) return label;
    if (actorId === "local-board") return t("app.common.nouns.board");
  }
  return t("app.common.labels.someone");
}

export function humanizeEvent(
  event: ToolCallEvent,
  agentName: string | null,
  actionRequest?: ActivityPanelProps["actionRequests"][string],
  /** When set, this row is a Test-tab call run by the named user; prefix accordingly. */
  testRunnerLabel?: string | null,
): { primary: string } {
  // For Test-tab calls, surface "<User> tested as <Agent>" so prosumer test runs are
  // distinguishable from real heartbeat agent activity in the audit trail (PAP-11415).
  const who = testRunnerLabel
    ? t("app.apps.activityPanel.testedAs", {
      user: testRunnerLabel,
      agent: agentName ?? t("app.apps.activityPanel.anAgentLower"),
    })
    : agentName ?? t("app.apps.activityPanel.anAgent");
  // Mid-sentence form of `who` ("didn't work for an agent").
  const whoLower = testRunnerLabel || agentName ? who : t("app.apps.activityPanel.anAgentLower");
  // The raw gateway tool name is prefixed (e.g. `mcp.app-gallery-link-…:kv-set`);
  // humanize it to "Kv Set" to match the cross-app Activity view (PAP-11105).
  const action = event.toolName ? humanizeConnectionDisplayName(event.toolName) : t("app.apps.activityPanel.anAction");
  switch (event.eventType) {
    case "call_completed":
      return {
        primary: event.outcome === "success"
          ? t("app.apps.activityPanel.used", { who, action })
          : t("app.apps.activityPanel.ranButDidNotFinish", { who, action }),
      };
    case "call_failed":
      return { primary: t("app.apps.activityPanel.didNotWorkFor", { action, who: whoLower }) };
    case "call_denied":
      return {
        primary: testRunnerLabel
          ? t("app.apps.activityPanel.turnedOff", { who, action })
          : t("app.apps.activityPanel.blockedNotTurnedOn", { action }),
      };
    case "approval_requested":
      return { primary: t("app.apps.activityPanel.askedBeforeRunning", { who, action }) };
    case "approval_resolved":
      return { primary: humanizeApprovalResolved(action, actionRequest) };
    default:
      return { primary: t("app.apps.activityPanel.used", { who, action }) };
  }
}

function humanizeApprovalResolved(
  action: string,
  actionRequest?: ActivityPanelProps["actionRequests"][string],
): string {
  const resolver = actionRequest?.resolverDisplayName ?? t("app.common.labels.someone");
  if (actionRequest?.status === "approved") return t("app.apps.activityPanel.approved", { resolver, action });
  if (actionRequest?.status === "rejected") return t("app.apps.activityPanel.saidNo", { resolver, action });
  return t("app.apps.activityPanel.reviewed", { resolver, action });
}

/** Humanize a connection lifecycle event into a prosumer sentence (PAP-11284). */
function humanizeLifecycleEvent(
  event: ToolConnectionLifecycleEvent,
  appName: string,
  agentName: string | null,
): string {
  const who = event.actorDisplayName ?? agentName ?? t("app.common.labels.someone");
  switch (event.type) {
    case "app_connected":
      return t("app.apps.activityPanel.connected", { who, app: appName });
    case "app_paused":
      return t("app.apps.activityPanel.paused", { who });
    case "app_resumed":
      return t("app.apps.activityPanel.resumed", { who });
    case "reconnected":
      return t("app.apps.activityPanel.reconnected", { who, app: appName });
    case "disconnected":
      return t("app.apps.activityPanel.disconnected", { who, app: appName });
    case "allowlist_changed":
      return humanizeAllowlistChange(who, event.details);
    case "actions_quarantined": {
      const count = numberFrom(event.details?.count);
      return count === 1
        ? t("app.apps.activityPanel.oneNewActionNeedsReview", { count })
        : t("app.apps.activityPanel.manyNewActionsNeedReview", { count });
    }
    default:
      return t("app.apps.activityPanel.updatedApp", { who });
  }
}

function humanizeAllowlistChange(who: string, details: Record<string, unknown> | null): string {
  const added = numberFrom(details?.added);
  const removed = numberFrom(details?.removed);
  if (added > 0 && removed === 0) {
    return added === 1
      ? t("app.apps.activityPanel.addedOneSheet", { who, count: added })
      : t("app.apps.activityPanel.addedManySheets", { who, count: added });
  }
  if (removed > 0 && added === 0) {
    return removed === 1
      ? t("app.apps.activityPanel.removedOneSheet", { who, count: removed })
      : t("app.apps.activityPanel.removedManySheets", { who, count: removed });
  }
  if (added > 0 && removed > 0) {
    return t("app.apps.activityPanel.updatedAllowlistCounts", { who, added, removed });
  }
  return t("app.apps.activityPanel.updatedAllowlist", { who });
}

function lifecycleLinkLabel(event: ToolConnectionLifecycleEvent): string {
  return event.type === "actions_quarantined"
    ? t("app.apps.activityPanel.reviewPermissions")
    : t("app.apps.activityPanel.viewPermissions");
}

function numberFrom(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dotColor(event: ToolCallEvent): string {
  if (event.eventType === "call_failed" || event.outcome === "failure" || event.outcome === "timeout") {
    return "bg-red-400";
  }
  if (event.eventType === "call_denied" || event.outcome === "denied") return "bg-amber-400";
  if (event.eventType === "approval_requested") return "bg-amber-400";
  return "bg-emerald-400";
}

function lifecycleDotColor(event: ToolConnectionLifecycleEvent): string {
  if (event.type === "disconnected") return "bg-red-400";
  if (event.type === "app_paused" || event.type === "actions_quarantined") return "bg-amber-400";
  return "bg-emerald-400";
}
