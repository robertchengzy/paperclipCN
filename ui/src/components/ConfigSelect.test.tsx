// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSelect } from "./ConfigSelect";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ""; });

describe("ConfigSelect", () => {
  it("renders an empty storage value and updates asynchronously loaded labels", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    await act(async () => root.render(<ConfigSelect value="" onValueChange={onChange} aria-label="Engine"><option value="">Default</option><option value="cli">CLI</option></ConfigSelect>));
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain("Default");
    await act(async () => root.render(<ConfigSelect value="secret-1" onValueChange={onChange} aria-label="Secret"><option value="">None</option><option value="secret-1">Loaded secret</option></ConfigSelect>));
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain("Loaded secret");
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
