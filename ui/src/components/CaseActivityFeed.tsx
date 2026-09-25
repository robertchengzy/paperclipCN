import { statusLabel } from "@/i18n/labels";
import { t, useTranslation } from "@/i18n";
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { Bot, User, Cog, ChevronDown, ListFilter } from "lucide-react";
import type { CaseEvent, CaseEventKind } from "@/api/cases";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/StatusIcon";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, relativeTime } from "@/lib/utils";

function getEventLabels(): Record<CaseEventKind, string> {
  return {
    created: t("app.reports.caseActivityFeed.created"),
    updated: t("app.reports.caseActivityFeed.updated"),
    fields_changed: t("app.reports.caseActivityFeed.fields_changed"),
    status_changed: t("app.reports.caseActivityFeed.status_changed"),
    issue_linked: t("app.reports.caseActivityFeed.issue_linked"),
    issue_unlinked: t("app.reports.caseActivityFeed.issue_unlinked"),
    document_revised: t("app.reports.caseActivityFeed.document_revised"),
    child_linked: t("app.reports.caseActivityFeed.child_linked"),
    attachment_added: t("app.reports.caseActivityFeed.attachment_added"),
    label_added: t("app.reports.caseActivityFeed.label_added"),
    label_removed: t("app.reports.caseActivityFeed.label_removed"),
  };
}

/** Human label for the actor, preferring the resolved agent name. */
function actorLabel(event: CaseEvent): string {
  if (event.actorType === "agent") return event.actorAgentName ?? t("app.common.nouns.agent");
  if (event.actorType === "user") return t("app.common.labels.user");
  return t("app.common.labels.system");
}

function ActorIcon({ event }: { event: CaseEvent }) {
  const Icon = event.actorType === "agent" ? Bot : event.actorType === "user" ? User : Cog;
  return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

function issueRelationLabel(event: CaseEvent): string {
  return event.kind === "issue_linked" || event.kind === "issue_unlinked" ? t("app.reports.caseActivityFeed.issueRelation") : t("app.reports.caseActivityFeed.via");
}

/** One event with actor + run→issue attribution (P4 §1). */
export function CaseEventRow({ event, compact = false }: { event: CaseEvent; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  // English keeps the raw status tokens; other languages show translated labels.
  const statusText = (status: string) => (i18n.language === "zh-CN" ? statusLabel(t, status) : status);
  const detail =
    event.kind === "status_changed" && event.payload
      ? `${statusText((event.payload.previousStatus as string) ?? "?")} → ${statusText((event.payload.status as string) ?? "?")}`
      : "";
  return (
    <div className={cn("flex items-start gap-2 text-xs", compact ? "py-1.5" : "py-2")}>
      <span className="mt-1"><ActorIcon event={event} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium">{getEventLabels()[event.kind] ?? event.kind}</span>
          {detail && <span className="text-muted-foreground">· {detail}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
          <span>{actorLabel(event)}</span>
          {event.issue && (
            <>
              <span aria-hidden>·</span>
              <span>{issueRelationLabel(event)}</span>
              <Link
                to={`/issues/${event.issue.identifier}`}
                className="inline-flex min-w-0 items-center gap-1 text-foreground/80 hover:underline"
                title={event.issue.title}
              >
                <StatusIcon status={event.issue.status} size="sm" />
                <span className="shrink-0 font-mono">{event.issue.identifier}</span>
                <span className="min-w-0 truncate">{event.issue.title}</span>
              </Link>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{relativeTime(event.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

/** The full activity feed with kind filters (detail-page Activity tab). */
export function CaseActivityFeed({ events }: { events: CaseEvent[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Set<CaseEventKind>>(new Set());

  // Only offer filters for kinds actually present, in first-seen order.
  const presentKinds = useMemo(() => {
    const seen: CaseEventKind[] = [];
    for (const e of events) if (!seen.includes(e.kind)) seen.push(e.kind);
    return seen;
  }, [events]);

  const filtered = useMemo(
    () => (active.size === 0 ? events : events.filter((e) => active.has(e.kind))),
    [events, active],
  );

  function toggle(kind: CaseEventKind) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const filterLabel = active.size === 0
    ? t("app.reports.caseActivityFeed.allActivity")
    : active.size === 1
      ? getEventLabels()[[...active][0]!] ?? [...active][0]!
      : t("app.reports.caseActivityFeed.filtersCount", { count: active.size });

  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("app.common.messages.noActivityYet")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("app.reports.caseActivityFeed.eventCount", { count: filtered.length, total: events.length })}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <ListFilter className="h-3.5 w-3.5" />
              {filterLabel}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("app.reports.caseActivityFeed.activityFilter")}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setActive(new Set())}>{t("app.reports.caseActivityFeed.allActivity")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            {presentKinds.map((kind) => (
              <DropdownMenuCheckboxItem
                key={kind}
                checked={active.has(kind)}
                onCheckedChange={() => toggle(kind)}
              >
                {getEventLabels()[kind] ?? kind}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("app.reports.caseActivityFeed.noEventsMatchThisFilter")}</p>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((event) => (
            <CaseEventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
