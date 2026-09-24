/** Presentation metadata only. Each provider will have its own catalog entry and connection. */
import { t } from "@/i18n";

export type RemoteMcpProviderId = "zapier" | "arcade" | "composio" | "executor";

export interface RemoteMcpProvider {
  id: RemoteMcpProviderId;
  name: string;
  description: string;
  instructions: string[];
  setupUrl: string;
  dashboardUrl: string;
  defaultUrl: string;
  placeholder: string;
  urlHelp: string;
  authHelp: string;
  supportsBrowserAuth: boolean;
}

// Display text uses getters so it is translated at read time and follows runtime language switches.
export const remoteMcpProviders: Record<RemoteMcpProviderId, RemoteMcpProvider> = {
  zapier: {
    id: "zapier", name: "Zapier", supportsBrowserAuth: false,
    get description() { return t("app.connections.providers.zapier.description"); },
    get instructions() { return [t("app.connections.providers.zapier.instruction1"), t("app.connections.providers.zapier.instruction2"), t("app.connections.providers.zapier.instruction3")]; },
    setupUrl: "https://docs.zapier.com/mcp/get-started/connect/other",
    dashboardUrl: "https://mcp.zapier.com",
    defaultUrl: "", get placeholder() { return t("app.connections.providers.zapier.placeholder"); },
    get urlHelp() { return t("app.connections.providers.zapier.urlHelp"); },
    get authHelp() { return t("app.connections.providers.zapier.authHelp"); },
  },
  arcade: {
    id: "arcade", name: "Arcade", supportsBrowserAuth: true,
    get description() { return t("app.connections.providers.arcade.description"); },
    get instructions() { return [t("app.connections.providers.arcade.instruction1"), t("app.connections.providers.arcade.instruction2"), t("app.connections.providers.arcade.instruction3")]; },
    setupUrl: "https://docs.arcade.dev/en/operate/governance/mcp-gateways",
    dashboardUrl: "https://app.arcade.dev",
    defaultUrl: "", placeholder: "https://api.arcade.dev/mcp/your-gateway",
    get urlHelp() { return t("app.connections.providers.arcade.urlHelp"); },
    get authHelp() { return t("app.connections.providers.arcade.authHelp"); },
  },
  composio: {
    id: "composio", name: "Composio", supportsBrowserAuth: true,
    get description() { return t("app.connections.providers.composio.description"); },
    get instructions() { return [t("app.connections.providers.composio.instruction1"), t("app.connections.providers.composio.instruction2")]; },
    setupUrl: "https://docs.composio.dev/docs/composio-connect",
    dashboardUrl: "https://dashboard.composio.dev",
    defaultUrl: "https://connect.composio.dev/mcp", placeholder: "https://connect.composio.dev/mcp",
    get urlHelp() { return t("app.connections.providers.composio.urlHelp"); },
    get authHelp() { return t("app.connections.providers.composio.authHelp"); },
  },
  executor: {
    id: "executor", name: "Executor", supportsBrowserAuth: true,
    get description() { return t("app.connections.providers.executor.description"); },
    get instructions() { return [t("app.connections.providers.executor.instruction1"), t("app.connections.providers.executor.instruction2"), t("app.connections.providers.executor.instruction3")]; },
    setupUrl: "https://executor.sh/docs/mcp-proxy",
    dashboardUrl: "https://executor.sh",
    defaultUrl: "", get placeholder() { return t("app.connections.providers.executor.placeholder"); },
    get urlHelp() { return t("app.connections.providers.executor.urlHelp"); },
    get authHelp() { return t("app.connections.providers.executor.authHelp"); },
  },
};
