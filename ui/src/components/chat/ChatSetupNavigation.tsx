import { SetupWizardNavigation, SetupWizardSidebar } from "../SetupWizard";
import { useTranslation } from "@/i18n";
export { SetupWizardSidebar as ChatSetupSidebar };
export function ChatSetupNavigation(props: {
  labels?: string[]; step: number; availableStep: number; disabled?: boolean; onSelect: (step: number) => void;
}) {
  const { t } = useTranslation();
  return <SetupWizardNavigation {...props} labels={props.labels ?? [t("app.apps.chatEndpointSetup.steps.chooseAgent"), t("app.taskChat.chatSetupNavigation.connectProvider"), t("app.apps.chatEndpointSetup.steps.tryIt")]} ariaLabel={t("app.taskChat.chatSetupNavigation.progressLabel")} />;
}
