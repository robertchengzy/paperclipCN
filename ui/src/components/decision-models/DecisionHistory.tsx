import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import type { DecisionHistoryEntry } from "@paperclipai/shared";
import { decisionModelsApi } from "@/api/decision-models";
import { Link } from "@/lib/router";
import { formatDateTime, formatTokens, formatDetailedCents } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DecisionHistoryTable({ entries }: { entries: DecisionHistoryEntry[] }) {
  useUiCopyTranslation();
  if (!entries.length) return <p className="text-sm text-muted-foreground"><Trans i18nKey="app.uiCopy.componentsDecisionModelsDecisionHistory.message20" components={{ part0: <Link to="/company/settings" className="underline underline-offset-4">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.configureADecisionModel")}</Link> }} /></p>;
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.recentRequestsInputsAndAnswersAreNotRetained")}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm" aria-label={translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.decisionRequests")}>
      <thead><tr className="border-b border-border text-muted-foreground">{["When / feature", "Responsible", "Task", "Model", "Status", "Duration", "Tokens in / out", "Cost"].map(label => <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>)}</tr></thead>
      <tbody>{entries.map(row => <tr key={row.id} className="border-b border-border last:border-0">
        <td className="px-3 py-3"><div className="whitespace-nowrap">{formatDateTime(row.startedAt)}</div><div className="text-xs text-muted-foreground">{row.feature === "settings.test" ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.setupTest") : row.feature}</div></td>
        <td className="px-3 py-3">{row.actorType === "system" ? translateUiCopy("app.upstreamOct08.paperclipServices") : row.userName ?? (row.responsibleUserId === "local-board" ? translateUiCopy("app.common.nouns.board") : translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.formerUser"))}</td>
        <td className="px-3 py-3">{row.issueId ? <Link className="underline underline-offset-4" to={`/issues/${row.issueIdentifier ?? row.issueId}`}>{row.issueIdentifier ?? translateUiCopy("app.tools.auditTab.viewTask")}</Link> : "—"}</td>
        <td className="px-3 py-3 font-mono text-xs">{row.model}</td>
        <td className="px-3 py-3"><div>{row.status === "succeeded" ? translateUiCopy("app.reports.activityCharts.succeeded") : row.status === "running" ? translateUiCopy("app.common.states.running") : row.status === "unknown" ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.unresolved") : translateUiCopy("app.common.states.failed")}</div>{row.errorCode && <div className="text-xs text-muted-foreground">{row.errorCode.replaceAll("_", " ")}</div>}</td>
        <td className="px-3 py-3 font-mono">{row.durationMs === null ? "—" : `${(row.durationMs / 1000).toFixed(1)}s`}</td>
        <td className="whitespace-nowrap px-3 py-3 font-mono">{row.inputTokens === null ? "—" : formatTokens(row.inputTokens)} / {row.outputTokens === null ? "—" : formatTokens(row.outputTokens)}</td>
        <td className="px-3 py-3 font-mono"><div>{row.costCents === null ? translateUiCopy("app.common.labels.unknown") : formatDetailedCents(row.costCents)}</div>{row.costStatus !== "unpriced" && row.costStatus && <span className="text-xs text-muted-foreground">{row.costStatus === "estimated" ? translateUiCopy("app.reports.costs.estimated") : translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.reported")}</span>}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
export function DecisionHistory({ companyId, from, to }: { companyId: string; from?: string | null; to?: string | null }) {
  useUiCopyTranslation();
  const query = useQuery({ queryKey: ["decision-history", companyId, from, to], queryFn: () => decisionModelsApi.history(companyId, from, to), refetchInterval: q => q.state.data?.some(row => row.status === "running") ? 5000 : false });
  if (query.isPending) return <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.loadingDecisionRequests")}</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionHistory.couldNotLoadDecisionRequests")}</p><Button variant="outline" onClick={() => void query.refetch()}>{translateUiCopy("app.common.actions.tryAgain")}</Button></div>;
  return <DecisionHistoryTable entries={query.data ?? []} />;
}
