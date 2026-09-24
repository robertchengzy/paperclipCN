import { useEffect } from "react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { NewAgentSetup } from "../components/new-agent/NewAgentSetup";
import { useTranslation } from "@/i18n";

export function NewAgent() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => {
    setBreadcrumbs([
      { label: t("app.pages.agents"), href: "/agents" },
      { label: t("app.agents.newAgent.breadcrumb") },
    ]);
  }, [setBreadcrumbs, t]);
  return <NewAgentSetup />;
}
