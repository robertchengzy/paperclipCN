import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import type { CostByAgent } from "@paperclipai/shared";
import { Badge } from "./ui/badge";

/** Use this group's ledger counts, never the page-wide estimate count. */
export function CostEstimateLabel({
  eventCount,
  estimatedEventCount,
}: Partial<Pick<CostByAgent, "eventCount" | "estimatedEventCount">>) {
  useUiCopyTranslation();
  if (!estimatedEventCount) return null;
  const allEstimated = estimatedEventCount === eventCount;
  return (
    <Badge
      variant="outline"
      className="font-normal text-muted-foreground"
      title={translateUiCopy("app.uiCopy.componentsCostEstimateLabel.estimatedCharges", { count: estimatedEventCount })}
    >
      {allEstimated ? translateUiCopy("app.reports.costs.estimated") : translateUiCopy("app.finance.subscriptionCostCard.partiallyEstimated")}
    </Badge>
  );
}
