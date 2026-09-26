import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, HelpCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { InlineBanner } from "@/components/InlineBanner";
import { ActionsSection } from "@/pages/apps/app-detail/PermissionsPanel";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { Trans } from "react-i18next";
import { RemoteMcpManagement } from "./RemoteMcpManagement";
import { AccessStepContent, StepHeader } from "../ConnectionSetupFlow";
import type { RemoteMcpProvider } from "./providers";
import type { RemoteMcpSetupActions, RemoteMcpSetupState } from "./types";

const steps = ["access", "connect"] as const;
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild><button type="button" aria-label={t("app.connections.remoteMcpConnectionSetup.helpWith", { label })} onClick={() => setOpen(!open)} className="rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><HelpCircle className="size-4" /></button></TooltipTrigger>
    <TooltipContent className="max-w-xs">{children}</TooltipContent>
  </Tooltip>;
}

function ExternalAction({ onOpen, children }: { onOpen: () => void; children?: ReactNode }) {
  return <Button type="button" variant="link" className="h-auto p-0 text-sm text-current underline" onClick={onOpen}>{children}<ExternalLink className="size-3.5" aria-hidden="true" /></Button>;
}

/** Controlled presentation shared by provider setup, configuration imports and review stories.
 * Authentication, persistence and calls belong to the controller, never these views. */
export function RemoteMcpConnectionSetup({ provider, state: s, actions: a, agents, connectionId, fixedGrantKind, lockedAgentId, host = "page", authorizationUrl, upstreamServiceName }: {
  upstreamServiceName?: string;
  host?: "page" | "dialog";
  lockedAgentId?: string;
  authorizationUrl?: string;
  provider: RemoteMcpProvider;
  connectionId: string;
  fixedGrantKind?: RemoteMcpSetupState["grantKind"];
  state: RemoteMcpSetupState;
  actions: RemoteMcpSetupActions;
  agents: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const uid = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(s.step);
  useEffect(() => {
    if (previousStep.current !== s.step) heading.current?.focus();
    previousStep.current = s.step;
  }, [s.step]);
  const currentStep = steps.indexOf(s.step as typeof steps[number]);
  const busy = s.connectStatus === "connecting";
  const change = (patch: Partial<RemoteMcpSetupState>) => a.edit(patch);
  const external = (purpose: Parameters<typeof a.openProvider>[0], text: string) => <ExternalAction onOpen={() => a.openProvider(purpose)}>{text}</ExternalAction>;
  // Pass provider names as React children so markup-like names stay literal.
  const boundary = <InlineBanner compact>
    <Trans i18nKey="app.connections.remoteMcpConnectionSetup.boundary" components={{ link: <ExternalAction onOpen={() => a.openProvider("manage")}>{provider.name}</ExternalAction> }} />
  </InlineBanner>;
  const footer = (children: ReactNode) => <SetupWizardFooter onSaveExit={a.saveExit} disabled={busy}>{children}</SetupWizardFooter>;

  const error = s.connectStatus === "invalid_url" ? { title: t("app.connections.remoteMcpConnectionSetup.invalidUrlTitle"), body: t("app.connections.remoteMcpConnectionSetup.invalidUrlBody") }
    : s.connectStatus === "oauth_failed" ? { title: t("app.connections.remoteMcpConnectionSetup.oauthFailedTitle", { provider: provider.name }), body: t("app.connections.remoteMcpConnectionSetup.oauthFailedBody") }
    : s.connectStatus === "rejected" ? { title: t("app.connections.remoteMcpConnectionSetup.rejectedTitle"), body: t("app.connections.remoteMcpConnectionSetup.rejectedBody", { provider: provider.name }) }
    : s.connectStatus === "unreachable" ? { title: t("app.connections.remoteMcpConnectionSetup.unreachableTitle"), body: t("app.connections.remoteMcpConnectionSetup.unreachableBody") }
    : null;

  return <div className={host === "dialog" ? "min-w-0 text-foreground" : "mx-auto max-w-6xl p-4 text-foreground sm:p-8"} data-remote-mcp-provider={provider.id}>
    <StepHeader headingRef={heading} appIdentity={{ name: provider.name, logoUrl: null }}
      title={upstreamServiceName ? t("app.connections.remoteMcpConnectionSetup.connectThroughProvider", { service: upstreamServiceName, provider: provider.name }) : s.step === "draft" ? t("app.connections.remoteMcpConnectionSetup.continueYourSetup") : s.setupComplete ? s.step === "access" ? t("app.connections.remoteMcpConnectionSetup.whoCanUse") : s.step === "connect" ? t("app.connections.remoteMcpConnectionSetup.reconnectProvider", { provider: provider.name }) : provider.name : undefined}
      subtitle={currentStep >= 0 && !s.setupComplete ? t("app.connections.remoteMcpConnectionSetup.stepOf", { step: currentStep + 1, total: 2 }) : s.step === "draft" ? t("app.connections.remoteMcpConnectionSetup.readyToResume", { provider: provider.name }) : s.step === "permissions" ? (s.identity ? t("app.connections.remoteMcpConnectionSetup.connectedAsActions", { identity: s.identity, count: s.tools.length }) : t("app.connections.remoteMcpConnectionSetup.connectedActions", { count: s.tools.length })) : t("app.connections.remoteMcpConnectionSetup.manageProvider", { provider: provider.name })}
      step={currentStep >= 0 && !s.setupComplete ? "access" : "gallery"} activeIndex={currentStep} labels={[t("app.connections.remoteMcpConnectionSetup.stepAccess"), t("app.common.actions.connect")]} onCancel={busy || s.step === "management" || s.step === "permissions" || s.step === "draft" ? undefined : a.saveExit} />
    <main className="space-y-6">
        {upstreamServiceName && <InlineBanner compact>{t("app.connections.remoteMcpConnectionSetup.upstreamServiceBoundary", { provider: provider.name, service: upstreamServiceName })}</InlineBanner>}
        {s.notice && <p role="status" className="text-sm text-muted-foreground">{s.notice}</p>}

        {s.step === "access" && <AccessStepContent agents={agents} lockedAgentId={lockedAgentId} authKind="oauth" grantKinds={fixedGrantKind ? [fixedGrantKind] : undefined} grantKind={s.grantKind} setGrantKind={(grantKind) => { if (grantKind !== "agent") change({ grantKind }); }}
          installChoice={s.allAgents ? "all" : "specific"} setInstallChoice={(choice) => change({ allAgents: choice === "all" })}
          installAgentIds={new Set(s.agentIds)} setInstallAgentIds={(ids) => change({ agentIds: [...ids] })}
          submitLabel={s.setupComplete ? t("app.common.actions.done") : t("app.common.actions.continue")} onBack={s.setupComplete ? a.finish : a.saveExit} onContinue={s.setupComplete ? a.finish : () => a.navigate("connect")} />}
        {s.step === "permissions" && <>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t("app.common.labels.permissions")}</h2><Button variant="outline" onClick={a.finish}>{t("app.connections.remoteMcpManagement.connectionSettings")}</Button></div>
          {s.tools.some((entry) => entry.broad) && boundary}
          <ActionsSection connectionId={connectionId} appName={provider.name}
            readOnly={s.tools.filter((entry) => entry.isReadOnly)} canChange={s.tools.filter((entry) => !entry.isReadOnly)} quarantined={[]}
            enabledIds={new Set(s.tools.filter((entry) => s.permissions[entry.id] !== "off").map((entry) => entry.id))}
            askFirstIds={new Set(s.tools.filter((entry) => s.permissions[entry.id] === "ask_first").map((entry) => entry.id))}
            disabled={!s.connected} refreshPending={s.refreshing} canConfigure
            onSetPermission={(id, next) => change({ permissions: { ...s.permissions, [id]: next === "ask" ? "ask_first" : next } })}
            onReviewQuarantined={() => {}} onRefreshActions={a.refresh} />
        </>}
        <div className="mx-auto max-w-2xl space-y-6">
        {s.step === "connect" && <>
          <div className="space-y-3">
            <ol className="list-decimal space-y-2 pl-5 text-sm">{provider.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
            {external("setup", t("app.connections.remoteMcpConnectionSetup.openSetupGuide", { provider: provider.name }))}
          </div>
          {s.connectStatus === "sign_in" && provider.supportsBrowserAuth ? <>
            <div role="status"><InlineBanner title={t("app.connections.remoteMcpConnectionSetup.finishSigningIn", { provider: provider.name })}>
              {t("app.connections.remoteMcpConnectionSetup.completeSignIn")}
            </InlineBanner></div>
            <p className="text-sm text-muted-foreground"><Trans i18nKey="app.connections.remoteMcpConnectionSetup.windowDidNotOpen" components={{ link: authorizationUrl ? <a className="text-current underline" href={authorizationUrl} onClick={() => a.openProvider("sign_in")} target="_blank" rel="noopener noreferrer" /> : <ExternalAction onOpen={() => a.openProvider("sign_in")} /> }} /></p>
            {footer(<><Button variant="outline" onClick={a.cancelConnect}>{t("app.connections.remoteMcpConnectionSetup.cancelSignIn")}</Button><Button disabled>{t("app.connections.remoteMcpConnectionSetup.waitingForSignIn")}</Button></>)}
          </> : <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); a.connect(); }}>
            {error && <div role="alert"><InlineBanner tone="danger" title={error.title}>{error.body}</InlineBanner></div>}
            {s.connectStatus === "cancelled" && <p role="status" className="text-sm text-muted-foreground">{t("app.connections.remoteMcpConnectionSetup.cancelled")}</p>}
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Label htmlFor={`${uid}-url`}>{t("app.connections.remoteMcpConnectionSetup.serverUrl")}</Label><FieldHelp label={t("app.connections.remoteMcpConnectionSetup.serverUrl")}>{provider.urlHelp}</FieldHelp></div>
                <Input id={`${uid}-url`} type="password" autoComplete="off" spellCheck={false} placeholder={provider.placeholder} value={s.url} aria-invalid={s.connectStatus === "invalid_url"} aria-describedby={`${uid}-url-help`} onChange={(event) => change({ url: event.target.value })} />
                <p id={`${uid}-url-help`} className="text-xs text-muted-foreground">{provider.urlHelp}</p>
              </div>
              <details open={s.advanced} onToggle={(event) => { if (event.currentTarget.open !== s.advanced) change({ advanced: event.currentTarget.open }); }}>
                <summary className="cursor-pointer text-sm font-medium">{t("app.connections.remoteMcpConnectionSetup.advancedAuth")}</summary>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">{provider.authHelp}</p>
                  <div className="space-y-2"><Label htmlFor={`${uid}-auth`}>{t("app.connections.remoteMcpConnectionSetup.authentication")}</Label><select id={`${uid}-auth`} className={selectClass} value={s.auth} onChange={(event) => change({ auth: event.target.value as RemoteMcpSetupState["auth"] })}>
                    {provider.supportsBrowserAuth && <option value="auto">{t("app.connections.remoteMcpConnectionSetup.authAuto")}</option>}<option value="bearer">{t("app.connections.remoteMcpConnectionSetup.bearerToken")}</option><option value="headers">{t("app.connections.remoteMcpConnectionSetup.customHeaders")}</option><option value="none">{t("app.connections.remoteMcpConnectionSetup.authNone")}</option>
                  </select></div>
                  {s.auth === "bearer" && <div className="space-y-2"><div className="flex items-center gap-2"><Label htmlFor={`${uid}-token`}>{t("app.connections.remoteMcpConnectionSetup.bearerToken")}</Label><FieldHelp label={t("app.connections.remoteMcpConnectionSetup.bearerTokenLower")}>{t("app.connections.remoteMcpConnectionSetup.bearerHelp")}</FieldHelp></div><Input id={`${uid}-token`} type="password" autoComplete="off" value={s.token} onChange={(event) => change({ token: event.target.value })} /></div>}
                  {(s.auth === "bearer" || s.auth === "headers") && <div className="space-y-3">
                    <p className="text-sm font-medium">{s.auth === "bearer" ? t("app.connections.remoteMcpConnectionSetup.additionalHeaders") : t("app.connections.remoteMcpConnectionSetup.headers")}</p>
                    {s.headers.map((header, index) => <div key={header.id} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`${uid}-${header.id}-name`}>{t("app.connections.remoteMcpConnectionSetup.headerName", { index: index + 1 })}</Label><Input id={`${uid}-${header.id}-name`} value={header.name} placeholder={provider.id === "arcade" ? "Arcade-User-ID" : t("app.connections.remoteMcpConnectionSetup.headerNamePlaceholder")} onChange={(event) => change({ headers: s.headers.map((h) => h.id === header.id ? { ...h, name: event.target.value } : h) })} /></div>
                      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`${uid}-${header.id}-value`}>{t("app.connections.remoteMcpConnectionSetup.headerValue", { index: index + 1 })}</Label><Input id={`${uid}-${header.id}-value`} type="password" autoComplete="off" value={header.value} onChange={(event) => change({ headers: s.headers.map((h) => h.id === header.id ? { ...h, value: event.target.value } : h) })} /></div>
                      <Button type="button" variant="ghost" size="icon" aria-label={t("app.connections.remoteMcpConnectionSetup.removeHeader", { index: index + 1 })} onClick={() => change({ headers: s.headers.filter((h) => h.id !== header.id) })}><Trash2 className="size-4" /></Button>
                    </div>)}
                    <Button type="button" variant="outline" size="sm" onClick={() => change({ headers: [...s.headers, { id: crypto.randomUUID(), name: "", value: "" }] })}><Plus className="size-4" />{t("app.connections.remoteMcpConnectionSetup.addHeader")}</Button>
                  </div>}
                </div>
              </details>
            </fieldset>
            {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{t("app.connections.remoteMcpConnectionSetup.discovering")}</p>}
            {footer(<><Button type="button" variant="outline" disabled={busy} onClick={() => s.setupComplete ? a.finish() : a.navigate("access")}>{t("app.common.actions.back")}</Button><Button type="submit" disabled={busy || !s.url.trim()}>{busy ? t("app.common.progress.connecting") : error || s.connectStatus === "cancelled" ? t("app.common.actions.tryAgain") : t("app.common.actions.connect")}</Button></>)}
          </form>}
        </>}

        {s.step === "management" && <>
          {!s.connected ? <InlineBanner tone="warning" title={t("app.connections.remoteMcpConnectionSetup.disconnected")}>{t("app.connections.remoteMcpConnectionSetup.disconnectedBody")}</InlineBanner> : <div className="space-y-2"><p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4" />{s.identity ? t("app.connections.remoteMcpConnectionSetup.connectedAs", { identity: s.identity }) : t("app.common.states.connected")}</p><p className="text-sm text-muted-foreground">{s.grantKind === "user" ? t("app.connections.emailConnectionAccess.justMe") : t("app.connections.emailConnectionAccess.anyHuman")} · {t("app.connections.remoteMcpConnectionSetup.toolCount", { count: s.tools.length })} · {s.allAgents ? t("app.connections.emailConnectionAccess.anyAgent") : t("app.connections.remoteMcpConnectionSetup.agentsWithAccess", { count: s.agentIds.length })}</p></div>}
          <div className="flex flex-wrap gap-2"><Button onClick={() => a.navigate("access")}>{t("app.connections.remoteMcpConnectionSetup.whoCanUse")}</Button><Button variant="outline" disabled={!s.connected} onClick={() => a.navigate("permissions")}>{t("app.common.labels.permissions")}</Button></div>
          <p className="text-sm text-muted-foreground">{t("app.connections.remoteMcpConnectionSetup.refreshCatalog", { provider: provider.name })}</p>
          <Button variant="outline" disabled={!s.connected || s.refreshing} onClick={a.refresh}>{s.refreshing ? t("app.connections.remoteMcpConnectionSetup.refreshing") : t("app.connections.remoteMcpConnectionSetup.refreshTools")}</Button>
          <RemoteMcpManagement providerName={provider.name} connected={s.connected} onReconnect={a.reconnect} onManage={() => a.openProvider("manage")} onDisconnect={a.disconnect} />
        </>}
        {s.step === "draft" && <><p className="text-sm">{t("app.connections.remoteMcpConnectionSetup.draftKept")}</p><div className="flex justify-end"><Button onClick={a.resumeDraft}>{t("app.connections.remoteMcpConnectionSetup.resumeSetup")}</Button></div></>}
        </div>
    </main>
  </div>;
}
