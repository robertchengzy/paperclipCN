// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { RemoteMcpConnectionSetup } from "./RemoteMcpConnectionSetup";
import { remoteMcpProviders } from "./providers";
import type { RemoteMcpSetupActions, RemoteMcpSetupState } from "./types";

vi.mock("@/pages/apps/app-detail/PermissionsPanel", () => ({ ActionsSection: () => null }));
vi.mock("../ConnectionSetupFlow", () => ({ AccessStepContent: () => null, StepHeader: () => null }));
vi.mock("./RemoteMcpManagement", () => ({ RemoteMcpManagement: () => null }));

const actions: RemoteMcpSetupActions = {
  edit: vi.fn(), navigate: vi.fn(), connect: vi.fn(), cancelConnect: vi.fn(),
  openProvider: vi.fn(), saveExit: vi.fn(), resumeDraft: vi.fn(), finish: vi.fn(),
  refresh: vi.fn(), reconnect: vi.fn(), disconnect: vi.fn(),
};

const state: RemoteMcpSetupState = {
  step: "permissions", grantKind: "user", setupComplete: true, url: "", auth: "none",
  token: "", headers: [], advanced: false, connectStatus: "idle", connected: true,
  identity: null, allAgents: false, agentIds: [], permissions: {},
  tools: [{ id: "tool-1", broad: true } as RemoteMcpSetupState["tools"][number]],
  notice: null, refreshing: false,
};

describe("RemoteMcpConnectionSetup external service names", () => {
  for (const language of ["en", "zh-CN"]) {
    it.each([
      "Example <strong>Admin</strong>",
      '</link><link title="injected">Injected</link><link>',
    ])(`preserves provider and service names as literal text in ${language}: %s`, async (name) => {
      await i18n.changeLanguage(language);
      try {
        const service = `Upstream ${name}`;
        const container = document.createElement("div");
        container.innerHTML = renderToStaticMarkup(
          <RemoteMcpConnectionSetup
            provider={{ ...remoteMcpProviders.zapier, name }}
            state={state}
            actions={actions}
            agents={[]}
            connectionId="connection-1"
            upstreamServiceName={service}
          />,
        );
        expect(container.textContent).toContain(service);
        expect(container.querySelector("strong, [title=injected]")).toBeNull();
        expect([...container.querySelectorAll("button")].filter((button) => button.textContent === name)).toHaveLength(1);
      } finally {
        await i18n.changeLanguage("en");
      }
    });
  }
});
