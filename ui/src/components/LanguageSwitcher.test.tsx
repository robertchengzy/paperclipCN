// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n, LANGUAGE_STORAGE_KEY, setUiLanguage } from "@/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageSwitcher } from "./LanguageSwitcher";

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await setUiLanguage("zh-CN");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  await setUiLanguage("en");
});

it("switches both directions without submitting or losing an unsaved form", async () => {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  await act(async () => root.render(
    <TooltipProvider><form onSubmit={submit}>
      <input defaultValue="unsaved draft" />
      <LanguageSwitcher variant="toggle" /><LanguageSwitcher />
    </form></TooltipProvider>,
  ));
  const input = container.querySelector("input")!;
  const button = () => container.querySelector("button")!;
  expect(button().textContent).toBe("EN");
  expect(button().getAttribute("aria-label")).toBe("切换到英文");
  await act(async () => button().click());
  expect(i18n.resolvedLanguage).toBe("en");
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  expect(container.querySelector("select")?.value).toBe("en");
  expect(button().textContent).toBe("中");
  expect(button().getAttribute("aria-label")).toBe("Switch to Chinese");
  await act(async () => button().click());
  expect(i18n.resolvedLanguage).toBe("zh-CN");
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("zh-CN");
  expect(container.querySelector("input")).toBe(input);
  expect(input.value).toBe("unsaved draft");
  expect(submit).not.toHaveBeenCalled();
});

it("switches even when saving the language preference is unavailable", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  await act(async () => root.render(<TooltipProvider><LanguageSwitcher variant="toggle" /></TooltipProvider>));
  await act(async () => container.querySelector("button")!.click());
  expect(i18n.resolvedLanguage).toBe("en");
  expect(document.documentElement.lang).toBe("en");
});
