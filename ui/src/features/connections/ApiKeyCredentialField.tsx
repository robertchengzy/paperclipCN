import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Providers supply only credentials the current user is authorized to use.
 * Values are opaque connection references, never secret values. */
export function ApiKeyCredentialField({ options, connectionId, onConnectionChange, value, onChange,
  disabled, loading, error, providerName, keysUrl, label = "API key" }: {
  options: { id: string; label: string; disabled?: boolean }[];
  connectionId: string | null;
  onConnectionChange(id: string): void;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  providerName: string;
  keysUrl: string;
  label?: string;
}) {
  useUiCopyTranslation();
  const id = useId();
  const choices = connectionId && !options.some(option => option.id === connectionId)
    ? [{ id: connectionId, label: loading ? translateUiCopy("app.uiCopy.featuresConnectionsApiKeyCredentialField.checkingSavedAPIKey") : translateUiCopy("app.uiCopy.featuresConnectionsApiKeyCredentialField.previouslySelectedKeyUnavailable"), disabled: true }, ...options] : options;
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    {choices.length > 0 && <select id={id} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={connectionId ?? ""} disabled={disabled} onChange={event => onConnectionChange(event.target.value)}>
      {choices.map(option => <option key={option.id} value={option.id} disabled={option.disabled}>{option.label}</option>)}
      <option value="">{translateUiCopy("app.shell.savedProviderKeySelect.enterANewApiKey")}</option>
    </select>}
    {!connectionId && <Input id={choices.length ? `${id}-new` : id} aria-label={choices.length ? translateUiCopy("app.uiCopy.featuresConnectionsApiKeyCredentialField.newAPIKey") : undefined}
      type="password" autoComplete="off" value={value} disabled={disabled}
      onChange={event => { onConnectionChange(""); onChange(event.target.value); }} placeholder={translateUiCopy("app.uiCopy.featuresConnectionsApiKeyCredentialField.pasteYourValue0APIKey", { value0: String(providerName) })} />}
    {loading && <p role="status" className="text-sm text-muted-foreground">{translateUiCopy("app.shell.savedProviderKeySelect.checkingSavedApiKeys")}</p>}
    {error && <p role="alert" className="text-sm text-destructive"><Trans i18nKey="app.uiCopy.featuresConnectionsApiKeyCredentialField.message27" components={{ part0: <>{""}{error}</> }} /></p>}
    <a href={keysUrl} target="_blank" rel="noreferrer" className="text-sm underline">{translateUiCopy("app.uiCopy.featuresConnectionsApiKeyCredentialField.getAn")} {providerName} {translateUiCopy("app.uiCopy.featuresConnectionsApiKeyCredentialField.aPIKey")}</a>
  </div>;
}
