import { t, useTranslation } from "@/i18n";
import { Database, Gauge, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SURFACES = [
  {
    get title() { return t("app.shell.accountingModelCard.inferenceLedger"); },
    get description() { return t("app.shell.accountingModelCard.requestScopedUsageAndBilledRunsFrom"); },
    icon: Database,
    get points() { return [t("app.shell.accountingModelCard.tokensDollars"), t("app.shell.accountingModelCard.dimensions"), t("app.shell.accountingModelCard.overage")]; },
    tone: "from-sky-500/12 via-sky-500/6 to-transparent",
  },
  {
    get title() { return t("app.shell.accountingModelCard.financeLedger"); },
    get description() { return t("app.shell.accountingModelCard.accountLevelChargesThatAreNotOne"); },
    icon: ReceiptText,
    get points() { return [t("app.shell.accountingModelCard.charges"), t("app.shell.accountingModelCard.bedrock"), t("app.shell.accountingModelCard.credits")]; },
    tone: "from-amber-500/14 via-amber-500/6 to-transparent",
  },
  {
    get title() { return t("app.shell.accountingModelCard.liveQuotas"); },
    get description() { return t("app.shell.accountingModelCard.providerOrBillerWindowsThatCanStop"); },
    icon: Gauge,
    get points() { return [t("app.shell.accountingModelCard.providerWindows"), t("app.shell.accountingModelCard.billerCredits"), t("app.shell.accountingModelCard.errors")]; },
    tone: "from-emerald-500/14 via-emerald-500/6 to-transparent",
  },
] as const;

export function AccountingModelCard() {
  const { t } = useTranslation();
  return (
    <Card className="relative overflow-hidden border-border/70">
      <div className="absolute inset-0 bg-(image:--gradient-extract-3)" />
      <CardHeader className="relative px-5 pt-5 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">{t("app.shell.accountingModelCard.accountingModel")}</CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-6">{t("app.shell.accountingModelCard.paperclipNowSeparatesRequestLevelInferenceUsage")}</CardDescription>
      </CardHeader>
      <CardContent className="relative grid gap-3 px-5 pb-5 md:grid-cols-3">
        {SURFACES.map((surface, surfaceIndex) => {
          const Icon = surface.icon;
          return (
            <div
              key={surfaceIndex}
              className={`rounded-2xl border border-border/70 bg-gradient-to-br ${surface.tone} p-4 shadow-sm`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{surface.title}</div>
                  <div className="text-xs text-muted-foreground">{surface.description}</div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {surface.points.map((point) => (
                  <div key={point}>{point}</div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
