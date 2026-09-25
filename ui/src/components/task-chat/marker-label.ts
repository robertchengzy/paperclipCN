import { t } from "@/i18n";

// Labels remain stable protocol/display identifiers in the model. Translate
// only known lifecycle labels here; provider and user-authored labels pass through.
const MARKER_LABEL_KEYS = new Map<string, string>([
  ["New session", "app.reviewMarkers.newSession"],
  ["Session started", "app.reviewMarkers.sessionStarted"],
  ["Turn started", "app.reviewMarkers.turnStarted"],
  ["Turn completed", "app.reviewMarkers.turnCompleted"],
  ["Interrupted", "app.reviewMarkers.interrupted"],
  ["Waiting to resume", "app.reviewMarkers.waitingToResume"],
  ["Approval required", "app.reviewMarkers.approvalRequired"],
  ["Usage limit reached", "app.reviewMarkers.usageLimitReached"],
  ["Run cancelled", "app.reviewMarkers.runCancelled"],
  ["Run interrupted", "app.reviewMarkers.runInterrupted"],
  ["Run timed out", "app.reviewMarkers.runTimedOut"],
  ["Run failed", "app.reviewMarkers.runFailed"],
  ["Stopped", "app.reviewMarkers.stopped"],
  ["Couldn't start", "app.reviewMarkers.couldNotStart"],
  ["Run completed", "app.reviewMarkers.runCompleted"],
]);

/** Display only: never replace the marker model's label with this value. */
export function taskChatMarkerLabel(label: string): string {
  const key = MARKER_LABEL_KEYS.get(label);
  return key ? t(key) : label;
}
