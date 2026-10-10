import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, Monitor } from "lucide-react";
import {
  aiProviderRoutingSchema,
  createAiConnectionSchema,
  type AiProvider,
  type AiProviderRouting,
  type AiConnectionBinding,
  type AiManagedConnectionSummary,
} from "@paperclipai/shared";
import { aiConnectionsApi } from "@/api/ai-connections";
import { agentsApi } from "@/api/agents";
import { ConnectionChoiceList } from "@/features/connections/ConnectionChoiceList";
import { ConnectionAccessDefaults, connectionDefaultSummarySentence } from "@/features/connections/ConnectionSetupFlow";
import { AppLogo } from "@/pages/apps/AppLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiConnectionCredentialStep } from "./AiConnectionCredentialStep";

const providers = [
  {
    id: "openai",
    name: "OpenAI",
    get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.chatGPTSubscriptionOrAPIKey"); },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.claudeSubscriptionOrAPIKey"); },
  },
  { id: "google", name: "Google", get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.geminiAPIKey"); } },
  { id: "xai", name: "xAI", get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.grokSubscriptionOrAPIKey"); } },
  {
    id: "openrouter",
    name: "OpenRouter",
    get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.modelsThroughOneAPIKey"); },
    advanced: true,
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.bedrockAPIKeyAndAWSRegion"); },
    advanced: true,
  },
  {
    id: "gateway",
    get name() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.customGateway"); },
    get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.emissaryOrAnotherCompatibleEndpoint"); },
    advanced: true,
  },
  {
    id: "local",
    get name() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.localEndpoint"); },
    get description() { return translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.aModelServerInTheAgentSEnvironment"); },
    advanced: true,
  },
] as const;
type ProviderChoice = (typeof providers)[number]["id"];

export function AiProviderSetup({
  companyId,
  agentId,
  environmentId,
  initialProvider,
  initialProtocol,
  providerLabel,
  advancedOnly = false,
  reconnect,
  onCancel,
  onComplete,
}: {
  companyId: string;
  agentId?: string;
  environmentId?: string;
  initialProvider?: ProviderChoice;
  initialProtocol?: AiProviderRouting["protocol"];
  providerLabel?: string;
  advancedOnly?: boolean;
  reconnect?: AiManagedConnectionSummary;
  onCancel: () => void;
  onComplete: (
    binding: Exclude<AiConnectionBinding, { mode: "responsible_user" }>,
  ) => void;
}) {
  useUiCopyTranslation();
  const [provider, setProvider] = useState<ProviderChoice | undefined>(
    reconnect
      ? reconnect.routing?.kind === "gateway" ||
        reconnect.routing?.kind === "local" ||
        reconnect.routing?.kind === "bedrock"
        ? reconnect.routing.kind
        : reconnect.provider
      : initialProvider,
  );
  const [step, setStep] = useState(
    reconnect || initialProvider ? "connect" : "provider",
  );
  const [ownershipChoice, setOwnership] = useState<"personal" | "shared">();
  const [allAgentsChoice, setAllAgents] = useState<boolean>();
  const [agentIds, setAgentIds] = useState(new Set(agentId ? [agentId] : []));
  const [protocol, setProtocol] = useState<AiProviderRouting["protocol"]>(
    reconnect?.routing?.protocol ?? initialProtocol ?? "responses",
  );
  const [auth, setAuth] = useState<AiProviderRouting["auth"]>(
    reconnect?.routing?.auth ?? "bearer",
  );
  const [baseUrl, setBaseUrl] = useState(reconnect?.routing?.baseUrl ?? "");
  const [region, setRegion] = useState(
    reconnect?.routing?.region ?? "us-east-1",
  );
  const [models, setModels] = useState(
    reconnect?.routing?.models.map((m) => m.id).join(", ") ?? "",
  );
  const [apiKey, setApiKey] = useState("");
  const client = useQueryClient();
  const accounts = useQuery({
    queryKey: ["ai-connections", companyId, agentId],
    queryFn: () => aiConnectionsApi.list(companyId, agentId),
  });
  const canManageConnections = accounts.data?.canManageConnections ?? false;
  const ownership = reconnect?.ownership ?? ownershipChoice ?? (!agentId && canManageConnections ? "shared" : "personal");
  const allAgents = allAgentsChoice ?? (!agentId && canManageConnections);
  const agents = useQuery({
    queryKey: ["agents", companyId, "provider-access"],
    queryFn: () => agentsApi.list(companyId),
  });
  const label = providerLabel ?? providers.find((p) => p.id === provider)?.name ?? translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.providerFallback");
  const advanced = reconnect ? Boolean(reconnect.routing) : ["openrouter", "bedrock", "gateway", "local"].includes(provider ?? "");
  const nativeProvider: AiProvider =
    provider === "bedrock"
      ? "anthropic"
      : provider === "gateway" || provider === "local"
        ? protocol === "messages"
          ? "anthropic"
          : "openai"
        : (provider ?? "openai");
  const name =
    reconnect?.name ??
    `${ownership === "personal" ? translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.my") : translateUiCopy("app.sidebar.company")} ${
      provider === "gateway" && baseUrl
        ? (() => {
            try {
              return new URL(baseUrl).hostname;
            } catch {
              return label;
            }
          })()
        : label
    }`;
  const complete = (result: {
    connectionId: string;
    grantId: string;
    method?: "api_key" | "subscription";
  }) => {
    void client.invalidateQueries({ queryKey: ["ai-connections", companyId] });
    void client.invalidateQueries({ queryKey: ["tools"] });
    onComplete({
      provider: nativeProvider,
      method: result.method ?? "api_key",
      mode: ownership === "shared" ? "shared" : "delegated",
      ...result,
    });
  };
  const save = useMutation({
    mutationFn: () => {
      const routing =
        reconnect?.routing ??
        aiProviderRoutingSchema.parse({
          kind: provider,
          protocol: provider === "bedrock" ? "bedrock" : protocol,
          auth: provider === "openrouter" ? "bearer" : auth,
          ...(provider === "bedrock"
            ? { region }
            : provider === "gateway" || provider === "local"
              ? { baseUrl }
              : {}),
          models: models
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
            .map((id) => ({ id })),
        });
      return aiConnectionsApi.create(
        companyId,
        createAiConnectionSchema.parse({
          provider: nativeProvider,
          method: "api_key",
          name,
          ownership,
          allAgents,
          agentIds: [...agentIds],
          connectionId: reconnect?.id,
          routing,
          ...(auth !== "none" ? { apiKey } : {}),
        }),
      );
    },
    onSuccess: complete,
    onSettled: () => {
      setApiKey("");
    },
  });
  const choices = (advancedOnly: boolean) => (
    <ConnectionChoiceList
      choices={providers
        .filter((p) => Boolean("advanced" in p && p.advanced) === advancedOnly)
        .map((p) => ({
          ...p,
          icon:
            p.id === "gateway" || p.id === "local" ? (
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                {p.id === "gateway" ? (
                  <Network className="size-5" />
                ) : (
                  <Monitor className="size-5" />
                )}
              </span>
            ) : (
              <AppLogo name={p.name} brandKey={p.id} />
            ),
        }))}
      onSelect={(id) => {
        setProvider(id as ProviderChoice);
        setStep("connect");
        setApiKey("");
        setAuth("bearer");
        save.reset();
      }}
    />
  );
  const modelSettings = (
    <label className="block space-y-2 text-xs text-muted-foreground">
      {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.modelIDsCommaSeparated")}
      <Input
        aria-label={translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.modelIDs")}
        value={models}
        onChange={(e) => setModels(e.target.value)}
        disabled={Boolean(reconnect)}
      />
      <span className="block">
        {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.useTheProviderSModelIDOrYourGateway")}
      </span>
    </label>
  );
  const accessDefaults = !reconnect ? (
    <ConnectionAccessDefaults
      companyId={companyId}
      extra={advanced ? modelSettings : undefined}
      agents={agents.data ?? []}
      sentence={connectionDefaultSummarySentence({ grantKind: ownership === "shared" ? "organization" : "user", authKind: auth === "none" ? "none" : "api_key", installChoice: allAgents ? "all" : "specific", installCount: agentIds.size })}
      capabilities={{ canCreateOrganizationGrant: canManageConnections, canSetCompanyInstall: canManageConnections }}
      authKind={auth === "none" ? "none" : "api_key"}
      grantKind={ownership === "shared" ? "organization" : "user"}
      grantKinds={["user", "organization"]}
      setGrantKind={kind => setOwnership(kind === "organization" ? "shared" : "personal")}
      installChoice={allAgents ? "all" : "specific"}
      setInstallChoice={choice => setAllAgents(choice === "all")}
      installAgentIds={agentIds}
      setInstallAgentIds={setAgentIds}
      disabled={save.isPending}
      notice={!canManageConnections ? ["Only a connection manager can share this credential with everyone or give every agent access."] : undefined}
    />
  ) : undefined;
  const cancel = () => reconnect || initialProvider ? onCancel() : setStep("provider");
  if (!reconnect && accounts.isPending) return <p role="status">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.loadingConnectionPermissions")}</p>;
  if (!reconnect && accounts.isError) return <p role="alert">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.couldNotLoadConnectionPermissions")} <Button type="button" variant="ghost" onClick={() => void accounts.refetch()}>{translateUiCopy("app.common.actions.retry")}</Button></p>;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" onSubmit={(event) => event.stopPropagation()}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {step === "provider"
            ? translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.connectAModelProvider")
            : `${reconnect ? translateUiCopy("app.common.actions.reconnect") : translateUiCopy("app.common.actions.connect")} ${label}`}
        </h2>
      </div>
      {agents.isError && <p role="alert" className="text-sm text-destructive">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.couldNotLoadAgents")} <Button type="button" variant="ghost" onClick={() => void agents.refetch()}>{translateUiCopy("app.common.actions.retry")}</Button></p>}
      {step === "provider" ? (
        <>
          {advancedOnly ? choices(true) : <>
          {choices(false)}
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionField.advancedProviders")}
            </summary>
            <div className="pt-4">{choices(true)}</div>
          </details>
          </>}
          <Button type="button" variant="ghost" onClick={onCancel}>
            {translateUiCopy("app.common.actions.cancel")}
          </Button>
        </>
      ) : !advanced ? (
        <AiConnectionCredentialStep
          companyId={companyId}
          provider={nativeProvider}
          connectionId={reconnect?.id}
          initialMethod={reconnect?.method}
          fixedMethod={Boolean(reconnect)}
          name={name}
          hideName
          ownership={ownership}
          allAgents={allAgents}
          agentIds={[...agentIds]}
          environmentId={environmentId}
          onCancel={cancel}
          defaults={accessDefaults}
          disabled={!reconnect && ownership === "shared" && !allAgents && agentIds.size === 0}
          onComplete={complete}
        />
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {(provider === "gateway" || provider === "local") && (
            <>
              <label className="block space-y-2 text-xs text-muted-foreground">
                {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.providerURL")}
                <Input
                  aria-label={translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.providerURL")}
                  placeholder={
                    provider === "local"
                      ? "http://localhost:11434/v1"
                      : "https://gateway.example.com/v1"
                  }
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  disabled={Boolean(reconnect)}
                />
              </label>
              <label className="block space-y-2 text-xs text-muted-foreground">
                {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.aPIFormat")}
                <Select
                  value={protocol}
                  onValueChange={(v) => {
                    setProtocol(v as typeof protocol);
                    if (v !== "messages" && auth === "api_key")
                      setAuth("bearer");
                  }}
                  disabled={Boolean(reconnect) || Boolean(initialProtocol)}
                >
                  <SelectTrigger aria-label={translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.aPIFormat")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="responses">
                      {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.openAIResponsesCodex")}
                    </SelectItem>
                    <SelectItem value="messages">
                      {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.anthropicMessagesClaude")}
                    </SelectItem>
                    <SelectItem value="chat">
                      {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.chatCompletionsOpenCodeHermes")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </>
          )}
          {provider === "bedrock" && (
            <label className="block space-y-2 text-xs text-muted-foreground">
              {translateUiCopy("app.secrets.secrets.fieldAwsRegion")}
              <Input
                aria-label={translateUiCopy("app.secrets.secrets.fieldAwsRegion")}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={Boolean(reconnect)}
              />
            </label>
          )}
          {provider !== "openrouter" && (
            <label className="block space-y-2 text-xs text-muted-foreground">
              {translateUiCopy("app.apps.gatewayAdvancedPanel.authentication")}
              <Select
                value={auth}
                onValueChange={(v) => setAuth(v as typeof auth)}
                disabled={Boolean(reconnect)}
              >
                <SelectTrigger aria-label={translateUiCopy("app.apps.gatewayAdvancedPanel.authentication")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer">
                    {provider === "bedrock"
                      ? translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.bedrockAPIKey")
                      : translateUiCopy("app.connections.remoteMcpConnectionSetup.bearerToken")}
                  </SelectItem>
                  {provider !== "bedrock" && (
                    <>
                      {protocol === "messages" && (
                        <SelectItem value="api_key">
                          {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.aPIKeyXApiKey")}
                        </SelectItem>
                      )}
                      <SelectItem value="none">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.noAuthentication")}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </label>
          )}
          {
            auth !== "none" && (
              <label className="block space-y-2 text-xs text-muted-foreground">
                {translateUiCopy("app.common.labels.apiKey")}
                <Input
                  aria-label={translateUiCopy("app.common.labels.apiKey")}
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </label>
            )
          }
          {reconnect && <details><summary className="cursor-pointer text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.modelSettings")}</summary>{modelSettings}</details>}
          <p className="text-xs text-muted-foreground">
            {translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.testTheConnectionWithYourChosenModelInThe")}
          </p>
          {save.error && (
            <p role="alert" className="text-sm text-destructive">
              {save.error instanceof Error && save.error.name === "ZodError"
                ? translateUiCopy("app.uiCopy.componentsAiConnectionsAiProviderSetup.checkTheURLAPIFormatAndAuthenticationFields")
                : save.error.message}
            </p>
          )}
          {accessDefaults}
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={cancel}
              disabled={save.isPending}
            >
              {translateUiCopy("app.common.actions.back")}
            </Button>
            <Button
              type="submit"
              disabled={
                save.isPending || accounts.isPending || accounts.isError ||
                (!reconnect && ownership === "shared" && !allAgents && agentIds.size === 0) ||
                (auth !== "none" && !apiKey.trim())
              }
            >
              {save.isPending
                ? translateUiCopy("app.common.progress.connecting")
                : reconnect
                  ? translateUiCopy("app.common.actions.reconnect")
                  : translateUiCopy("app.common.actions.connect")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
