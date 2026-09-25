// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/context/ThemeContext";
import { MemoryRouter } from "@/lib/router";
import { setUiLanguage } from "@/i18n";
import { TaskChatProtocolActivityDetails } from "./TaskChatProtocolActivityRow";
import { TaskChatProtocolCard } from "./TaskChatProtocolCard";
import type { TaskChatProviderActivityItem } from "./task-chat-model";

const originalLabels = ["Query", "Action", "Status", "Summary", "Revision", "Customer priority", "query", "__proto__"];
const chineseLabels = ["查询", "动作", "状态", "摘要", "修订版本", "Customer priority", "query", "__proto__"];

function providerItem(): TaskChatProviderActivityItem {
  const details = originalLabels.map((label, index) => Object.freeze({ label, value: `provider-value-${index}` }));
  Object.freeze(details);
  return Object.freeze({
    id: "stable-provider-activity",
    kind: "protocol",
    surface: "provider_activity",
    family: "tool_execution",
    eventType: "tool.execution.completed",
    status: "completed",
    title: "Provider-authored title",
    details,
    steps: [],
    links: [],
    children: [],
  });
}

describe("protocol detail display labels", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await setUiLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => root.unmount());
    container.remove();
    await setUiLanguage("en");
  });

  it.each(["activity", "card"] as const)("updates %s labels without changing protocol or DOM identity", async (surface) => {
    const item = providerItem();
    const originalDetails = item.details;
    const originalQuery = item.details.find((detail) => detail.label === "Query");
    const snapshot = JSON.stringify(item);
    act(() => root.render(
      <MemoryRouter>
        <ThemeProvider>
          {surface === "activity"
            ? <TaskChatProtocolActivityDetails item={item} />
            : <TaskChatProtocolCard item={item} />}
        </ThemeProvider>
      </MemoryRouter>,
    ));

    const nodes = Array.from(container.querySelectorAll("dt"));
    const labels = () => Array.from(container.querySelectorAll("dt"), (node) => node.textContent);
    const values = () => Array.from(container.querySelectorAll("dd"), (node) => node.textContent);
    expect(labels()).toEqual(originalLabels);
    const originalValues = values();

    await act(async () => { await setUiLanguage("zh-CN"); });
    expect(labels()).toEqual(chineseLabels);
    expect(values()).toEqual(originalValues);
    for (const [index, node] of Array.from(container.querySelectorAll("dt")).entries()) {
      expect(node).toBe(nodes[index]);
    }
    expect(item.details).toBe(originalDetails);
    expect(item.details.find((detail) => detail.label === "Query")).toBe(originalQuery);
    expect(JSON.stringify(item)).toBe(snapshot);

    await act(async () => { await setUiLanguage("en"); });
    expect(labels()).toEqual(originalLabels);
    expect(values()).toEqual(originalValues);
  });
});
