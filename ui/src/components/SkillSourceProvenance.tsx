import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import type { CompanySkill } from '@paperclipai/shared';
import { Link } from '@/lib/router';
export function SkillSourceProvenance({ skill }: { skill: CompanySkill }) {
  useUiCopyTranslation();
  const id = skill.metadata?.skillSourceId ?? skill.metadata?.legacySkillSourceId;
  if (typeof id !== 'string') return null;
  const state = skill.metadata?.skillSourceState;
  const label = !skill.metadata?.skillSourceId ? translateUiCopy("app.uiCopy.componentsSkillSourceProvenance.refreshThisSourceToSyncAllFiles") : state === 'removed' ? translateUiCopy("app.uiCopy.componentsSkillSourceProvenance.removedFromSourceLastInstalledVersionRetained")
    : state === 'not_syncing' ? translateUiCopy("app.uiCopy.componentsSkillSourceProvenance.notSyncingInstalledCopyRetained")
    : state === 'update_failed' ? translateUiCopy("app.uiCopy.componentsSkillSourceProvenance.updateFailedLastInstalledVersionRetained") : translateUiCopy("app.uiCopy.componentsSkillSourceProvenance.syncedFromGitHub");
  return <div className="flex flex-col gap-1 py-3 text-xs text-muted-foreground">
    <span>{label}</span>
    <span className="break-all font-mono">{String(skill.metadata?.skillSourcePath ?? '')}{skill.sourceRef ? ` · ${skill.sourceRef.slice(0, 8)}` : ''}</span>
    <Link to={`/skills/sources/${id}`} className="text-foreground underline">{translateUiCopy("app.uiCopy.componentsSkillSourceProvenance.manageSource")}</Link>
  </div>;
}
