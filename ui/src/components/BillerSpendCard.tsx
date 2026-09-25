import { t, useTranslation } from "@/i18n";
import { Trans } from "react-i18next";
import { useMemo } from "react";
import type { CostByBiller, CostByProviderModel } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QuotaBar } from "./QuotaBar";
import { billingTypeDisplayName, formatCents, formatTokens, providerDisplayName } from "@/lib/utils";

interface BillerSpendCardProps {
  row: CostByBiller;
  weekSpendCents: number;
  budgetMonthlyCents: number;
  totalCompanySpendCents: number;
  providerRows: CostByProviderModel[];
}

export function BillerSpendCard({
  row,
  weekSpendCents,
  budgetMonthlyCents,
  totalCompanySpendCents,
  providerRows,
}: BillerSpendCardProps) {
  const { t } = useTranslation();
  const providerBreakdown = useMemo(() => {
    const map = new Map<string, { provider: string; costCents: number; inputTokens: number; outputTokens: number }>();
    for (const entry of providerRows) {
      const current = map.get(entry.provider) ?? {
        provider: entry.provider,
        costCents: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      current.costCents += entry.costCents;
      current.inputTokens += entry.inputTokens + entry.cachedInputTokens;
      current.outputTokens += entry.outputTokens;
      map.set(entry.provider, current);
    }
    return Array.from(map.values()).sort((a, b) => b.costCents - a.costCents);
  }, [providerRows, t]);

  const billingTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of providerRows) {
      map.set(entry.billingType, (map.get(entry.billingType) ?? 0) + entry.costCents);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [providerRows, t]);

  const providerBudgetShare =
    budgetMonthlyCents > 0 && totalCompanySpendCents > 0
      ? (row.costCents / totalCompanySpendCents) * budgetMonthlyCents
      : budgetMonthlyCents;
  const budgetPct =
    providerBudgetShare > 0
      ? Math.min(100, (row.costCents / providerBudgetShare) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-0 gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">
              {providerDisplayName(row.biller)}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              <Trans i18nKey="app.shell.billerSpendCard.inTokens" values={{ count: formatTokens(row.inputTokens + row.cachedInputTokens) }} components={{ value: <span className="font-mono" /> }} />
              {" · "}
              <Trans i18nKey="app.shell.billerSpendCard.outTokens" values={{ count: formatTokens(row.outputTokens) }} components={{ value: <span className="font-mono" /> }} />
              {" · "}
              {row.providerCount === 1 ? t("app.shell.billerSpendCard.providerOne", { count: row.providerCount }) : t("app.shell.billerSpendCard.providerMany", { count: row.providerCount })}
              {" · "}
              {row.modelCount === 1 ? t("app.shell.billerSpendCard.modelOne", { count: row.modelCount }) : t("app.shell.billerSpendCard.modelMany", { count: row.modelCount })}
            </CardDescription>
          </div>
          <span className="text-xl font-bold tabular-nums shrink-0">
            {formatCents(row.costCents)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-3 space-y-4">
        {budgetMonthlyCents > 0 && (
          <QuotaBar
            label={t("app.shell.billerSpendCard.periodSpend")}
            percentUsed={budgetPct}
            leftLabel={formatCents(row.costCents)}
            rightLabel={t("app.shell.billerSpendCard.allocation", { percent: Math.round(budgetPct) })}
          />
        )}

        <div className="text-xs text-muted-foreground">
          {row.apiRunCount === 1 ? t("app.shell.billerSpendCard.meteredOne", { count: row.apiRunCount }) : t("app.shell.billerSpendCard.meteredMany", { count: row.apiRunCount })}
          {" · "}
          {row.subscriptionRunCount === 1 ? t("app.shell.billerSpendCard.subscriptionOne", { count: row.subscriptionRunCount }) : t("app.shell.billerSpendCard.subscriptionMany", { count: row.subscriptionRunCount })}
          {" · "}
          {t("app.shell.billerSpendCard.weekSpend", { amount: formatCents(weekSpendCents) })}
        </div>

        {billingTypeBreakdown.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("app.shell.billerSpendCard.billingTypes")}</p>
              <div className="space-y-1.5">
                {billingTypeBreakdown.map(([billingType, costCents]) => (
                  <div key={billingType} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{billingTypeDisplayName(billingType as any)}</span>
                    <span className="font-medium tabular-nums">{formatCents(costCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {providerBreakdown.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("app.shell.billerSpendCard.upstreamProviders")}</p>
              <div className="space-y-1.5">
                {providerBreakdown.map((entry) => (
                  <div key={entry.provider} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{providerDisplayName(entry.provider)}</span>
                    <div className="text-right tabular-nums">
                      <div className="font-medium">{formatCents(entry.costCents)}</div>
                      <div className="text-muted-foreground">
                        {t("app.shell.billerSpendCard.tokens", { count: formatTokens(entry.inputTokens + entry.outputTokens) })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
