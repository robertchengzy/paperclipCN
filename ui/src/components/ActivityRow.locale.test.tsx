import { renderToStaticMarkup } from "react-dom/server";
import type { ActivityEvent } from "@paperclipai/shared";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { ActivityRow } from "./ActivityRow";

const metadataEvent: ActivityEvent = {
  id: "event-1",
  companyId: "company-1",
  actorType: "user",
  actorId: "user-1",
  action: "provider_trace.metadata_listed",
  entityType: "company",
  entityId: "company-1",
  agentId: null,
  runId: null,
  details: { requestedRunCount: 2, traceCount: 1, payloadLogged: false },
  createdAt: new Date("2026-09-26T12:00:00.000Z"),
};

describe("ActivityRow metadata event localization", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it.each([
    ["en", "provider trace metadata listed"],
    ["zh-CN", "仅列出了提供方 Trace 元数据"],
  ])("renders a complete metadata-only label without an entity name in %s", async (language, label) => {
    await i18n.changeLanguage(language);
    const html = renderToStaticMarkup(
      <ActivityRow event={metadataEvent} agentMap={new Map()} entityNameMap={new Map()} />,
    );
    expect(html).toContain(`>${label}</span>`);
    expect(html).not.toContain("metadata for");
    expect(html).not.toContain("所属组织：");
    expect(html).not.toContain("原始帧");
    expect(html).not.toContain("raw frame");
    expect(html).not.toContain("provider_trace.metadata_listed");
    expect(html).not.toContain("<a ");
  });
});
