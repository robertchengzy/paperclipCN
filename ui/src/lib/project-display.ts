import { t } from "@/i18n";

/** Display-only alias; callers keep the original project name for writes and URLs. */
export function projectDisplayName(name: string): string {
  return name === "Onboarding" ? t("app.projects.display.onboarding") : name;
}
