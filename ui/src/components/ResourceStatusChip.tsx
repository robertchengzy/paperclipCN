import { t, useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge, type BrandChipColor } from "@/lib/status-colors";

/**
 * The load-bearing visual grammar for the built-in bundle status panel
 * (Reflection Coach — [PAP-13099], ux-spec §4). Each variant double-encodes
 * state as glyph + word + color so it never relies on color alone
 * (WCAG 1.4.1). Colors route through the shared `brandChipBadge` families — no
 * bespoke tints are minted here (ux-spec §10).
 *
 * A single resource shows at most one readiness chip and at most one drift
 * chip; when both a readiness problem and a drift state coexist, the caller
 * suppresses the drift chip until readiness is `ready` (ux-spec §4).
 */
export type ResourceStatusVariant =
  | "ready"
  | "needs_setup"
  | "missing"
  | "error"
  | "update_available"
  | "drifted"
  | "schedule_off"
  | "schedule_on"
  | "pending_approval"
  | "proposal_pending";

interface VariantSpec {
  color: BrandChipColor;
  glyph: string;
  label: string;
  title: string;
}

const VARIANTS: Record<ResourceStatusVariant, VariantSpec> = {
  get ready(): VariantSpec { return { color: "green", glyph: "●", label: t("app.common.states.ready"), title: t("app.shell.resourceStatusChip.materializedAndMatchesTheShippedDefault") }; },
  get needs_setup(): VariantSpec { return { color: "amber", glyph: "⚠", label: t("app.shell.resourceStatusChip.needsSetup"), title: t("app.shell.resourceStatusChip.presentButNotUsableYet") }; },
  get missing(): VariantSpec { return { color: "amber", glyph: "⚠", label: t("app.shell.resourceStatusChip.missing"), title: t("app.shell.resourceStatusChip.expectedResourceAbsentReconcileWillRecreateIt") }; },
  get error(): VariantSpec { return { color: "red", glyph: "✕", label: t("app.common.labels.error"), title: t("app.shell.resourceStatusChip.failedToLoadOrReconcile") }; },
  get update_available(): VariantSpec { return {
    color: "blue",
    glyph: "↑",
    label: t("app.common.states.updateAvailable"),
    title: t("app.shell.resourceStatusChip.uneditedANewerShippedDefaultCanBe"),
  }; },
  get drifted(): VariantSpec { return {
    color: "gray",
    glyph: "✎",
    label: t("app.shell.resourceStatusChip.drifted"),
    title: t("app.shell.resourceStatusChip.youVeEditedThisYourChangesAre"),
  }; },
  get schedule_off(): VariantSpec { return {
    color: "gray",
    glyph: "◌",
    label: t("app.shell.resourceStatusChip.scheduleOff"),
    title: t("app.shell.resourceStatusChip.noBackgroundWorkRunsUntilYouEnable"),
  }; },
  get schedule_on(): VariantSpec { return { color: "green", glyph: "●", label: t("app.shell.resourceStatusChip.weekly"), title: t("app.shell.resourceStatusChip.runsOnTheWeeklySchedule") }; },
  get pending_approval(): VariantSpec { return {
    color: "amber",
    glyph: "⚠",
    label: t("app.shell.resourceStatusChip.pendingApproval"),
    title: t("app.shell.resourceStatusChip.waitingOnBoardHireApprovalBeforeIt"),
  }; },
  get proposal_pending(): VariantSpec { return {
    color: "blue",
    glyph: "↑",
    label: t("app.shell.resourceStatusChip.proposalPending"),
    title: t("app.shell.resourceStatusChip.aProposedUpdateIsWaitingForYour"),
  }; },
};

export function ResourceStatusChip({
  variant,
  label,
  compact = false,
  className,
}: {
  variant: ResourceStatusVariant;
  /** Override the default label (e.g. "Weekly · Mon 09:00 UTC"). */
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const spec = VARIANTS[variant];
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge[spec.color],
        "font-medium",
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={spec.title}
    >
      <span aria-hidden="true">{spec.glyph}</span>
      {label ?? spec.label}
    </Badge>
  );
}
