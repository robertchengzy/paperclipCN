import { useEffect, useMemo } from "react";
import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { PluginSlotMount, usePluginSlots } from "@/plugins/slots";
import { useTranslation } from "@/i18n";
import { Trans } from "react-i18next";
import { NotFoundPage } from "./NotFound";

export function CompanySettingsPluginPage() {
  const params = useParams<{
    companyPrefix?: string;
    settingsRoutePath?: string;
  }>();
  const { companyPrefix: routeCompanyPrefix, settingsRoutePath } = params;
  const { companies, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useTranslation();

  const routeCompany = useMemo(() => {
    if (!routeCompanyPrefix) return null;
    const requested = routeCompanyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requested) ?? null;
  }, [companies, routeCompanyPrefix]);
  const hasInvalidCompanyPrefix = Boolean(routeCompanyPrefix) && !routeCompany;
  const resolvedCompanyId = routeCompany?.id ?? (routeCompanyPrefix ? null : selectedCompanyId ?? null);
  const companyPrefix = resolvedCompanyId
    ? companies.find((company) => company.id === resolvedCompanyId)?.issuePrefix ?? null
    : null;

  const { slots, isLoading, errorMessage } = usePluginSlots({
    slotTypes: ["companySettingsPage"],
    companyId: resolvedCompanyId,
    enabled: Boolean(resolvedCompanyId && settingsRoutePath),
  });

  const pageSlots = useMemo(() => {
    if (!settingsRoutePath) return [];
    return slots.filter((slot) => slot.routePath === settingsRoutePath);
  }, [settingsRoutePath, slots]);

  const pageSlot = pageSlots.length === 1 ? pageSlots[0] : null;

  useEffect(() => {
    if (!pageSlot) return;
    setBreadcrumbs([
      { label: t("app.common.nouns.settings"), href: "/company/settings" },
      { label: pageSlot.displayName },
    ]);
  }, [pageSlot, setBreadcrumbs, t]);

  if (!resolvedCompanyId) {
    if (hasInvalidCompanyPrefix) {
      return <NotFoundPage scope="invalid_company_prefix" requestedPrefix={routeCompanyPrefix} />;
    }
    return <div className="text-sm text-muted-foreground">{t("app.settings.companySettingsPluginPage.selectOrganization")}</div>;
  }

  if (!settingsRoutePath || isLoading) {
    return <div className="text-sm text-muted-foreground">{t("app.settings.companySettingsPluginPage.loading")}</div>;
  }

  if (errorMessage) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {t("app.settings.companySettingsPluginPage.extensionsUnavailable", { message: errorMessage })}
      </div>
    );
  }

  if (pageSlots.length > 1) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <Trans
          i18nKey="app.settings.companySettingsPluginPage.duplicateRoute"
          values={{ route: settingsRoutePath }}
          components={{ code: <code /> }}
        />
      </div>
    );
  }

  if (!pageSlot) {
    return <NotFoundPage scope="board" />;
  }

  return (
    <div className="max-w-6xl">
      <PluginSlotMount
        slot={pageSlot}
        context={{ companyId: resolvedCompanyId, companyPrefix }}
        className="min-h-(--sz-200px)"
        missingBehavior="placeholder"
      />
    </div>
  );
}
