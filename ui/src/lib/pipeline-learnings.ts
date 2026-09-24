import type { PipelineCompanyCaseEvent } from "../api/pipelines";
import { formatShortDate } from "./utils";
import { t } from "@/i18n";

export type LearningEventPresentation = {
  sentence: string;
  kind: "review" | "forced_move" | "unknown";
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function eventItemTitle(event: PipelineCompanyCaseEvent): string {
  const payload = asRecord(event.payload);
  return (
    asString(event.case?.title) ??
    asString(payload.itemTitle) ??
    asString(payload.caseTitle) ??
    asString(payload.title) ??
    t("app.pipelines.pipelineLearnings.untitledItem")
  );
}

function eventActorName(event: PipelineCompanyCaseEvent): string {
  const payload = asRecord(event.payload);
  return (
    asString(event.actorAgent?.name) ??
    asString(payload.actorName) ??
    asString(payload.reviewerName) ??
    asString(payload.decidedByName) ??
    t("app.common.labels.someone")
  );
}

function payloadText(event: PipelineCompanyCaseEvent, ...keys: string[]): string | null {
  const payload = asRecord(event.payload);
  for (const key of keys) {
    const value = asString(payload[key]);
    if (value) return value;
  }
  return null;
}

function reviewVerbKey(decision: string | null): string {
  if (decision === "request_changes") return "sentBack";
  if (decision === "reject" || decision === "drop") return "declined";
  return "approved";
}

/** Static keys for every review sentence shape (verb × optional stage × optional note). */
const REVIEW_SENTENCE_KEYS: Record<string, string> = {
  "approved:": "app.pipelines.pipelineLearnings.review.approved",
  "approved:n": "app.pipelines.pipelineLearnings.review.approvedNote",
  "approved:s": "app.pipelines.pipelineLearnings.review.approvedStage",
  "approved:sn": "app.pipelines.pipelineLearnings.review.approvedStageNote",
  "sentBack:": "app.pipelines.pipelineLearnings.review.sentBack",
  "sentBack:n": "app.pipelines.pipelineLearnings.review.sentBackNote",
  "sentBack:s": "app.pipelines.pipelineLearnings.review.sentBackStage",
  "sentBack:sn": "app.pipelines.pipelineLearnings.review.sentBackStageNote",
  "declined:": "app.pipelines.pipelineLearnings.review.declined",
  "declined:n": "app.pipelines.pipelineLearnings.review.declinedNote",
  "declined:s": "app.pipelines.pipelineLearnings.review.declinedStage",
  "declined:sn": "app.pipelines.pipelineLearnings.review.declinedStageNote",
};

/** Static keys for every forced-move sentence shape (optional from × to × reason). */
const FORCED_MOVE_SENTENCE_KEYS: Record<string, string> = {
  "": "app.pipelines.pipelineLearnings.forced.moved",
  "r": "app.pipelines.pipelineLearnings.forced.movedReason",
  "t": "app.pipelines.pipelineLearnings.forced.movedTo",
  "tr": "app.pipelines.pipelineLearnings.forced.movedToReason",
  "f": "app.pipelines.pipelineLearnings.forced.movedFrom",
  "fr": "app.pipelines.pipelineLearnings.forced.movedFromReason",
  "ft": "app.pipelines.pipelineLearnings.forced.movedFromTo",
  "ftr": "app.pipelines.pipelineLearnings.forced.movedFromToReason",
};

export function formatLearningEvent(event: PipelineCompanyCaseEvent): LearningEventPresentation {
  const payload = asRecord(event.payload);
  const title = eventItemTitle(event);

  if (event.type === "review_decided") {
    const actor = eventActorName(event);
    const decision = asString(payload.decision);
    const toStageName =
      asString(event.toStage?.name) ?? payloadText(event, "toStageName", "stageName", "targetStageName");
    const note = payloadText(event, "reason", "note");
    const shape = `${reviewVerbKey(decision)}:${toStageName ? "s" : ""}${note ? "n" : ""}`;
    return {
      kind: "review",
      sentence: t(REVIEW_SENTENCE_KEYS[shape]!, { actor, title, stage: toStageName ?? "", note: note ?? "" }),
    };
  }

  if (event.type === "transition_forced") {
    const fromStageName = asString(event.fromStage?.name) ?? payloadText(event, "fromStageName");
    const toStageName =
      asString(event.toStage?.name) ?? payloadText(event, "toStageName", "stageName", "targetStageName");
    const reason = payloadText(event, "reason", "note");
    const shape = `${fromStageName ? "f" : ""}${toStageName ? "t" : ""}${reason ? "r" : ""}`;
    return {
      kind: "forced_move",
      sentence: t(FORCED_MOVE_SENTENCE_KEYS[shape]!, {
        title,
        from: fromStageName ?? "",
        to: toStageName ?? "",
        reason: reason ?? "",
      }),
    };
  }

  return {
    kind: "unknown",
    sentence: t("app.pipelines.pipelineLearnings.changed", { title }),
  };
}

export function learningDayKey(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toISOString().slice(0, 10);
}

export function learningDayLabel(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("app.common.labels.unknown");
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDay) / 86_400_000);
  if (diffDays === 0) return t("app.common.labels.today");
  if (diffDays === 1) return t("app.pipelines.pipelineLearnings.yesterday");
  return formatShortDate(date);
}

export function groupLearningEventsByDay<T extends { createdAt: string | Date }>(events: T[]) {
  const groups: Array<{ key: string; label: string; events: T[] }> = [];
  for (const event of events) {
    const key = learningDayKey(event.createdAt);
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.events.push(event);
      continue;
    }
    groups.push({ key, label: learningDayLabel(event.createdAt), events: [event] });
  }
  return groups;
}
