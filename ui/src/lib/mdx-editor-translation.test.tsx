// @vitest-environment jsdom

import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInstance } from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n";
import { MarkdownEditor, type MarkdownEditorRef } from "../components/MarkdownEditor";
import { createMdxEditorTranslation, MDX_EDITOR_TRANSLATION_KEYS } from "./mdx-editor-translation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MDXEditor translations", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await i18n.changeLanguage("en");
    });
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it("resolves enabled controls in both application locales", () => {
    for (const language of ["en", "zh-CN"]) {
      for (const key of Object.values(MDX_EDITOR_TRANSLATION_KEYS)) {
        expect(i18n.exists(key, { lng: language, fallbackLng: false }), `${language}: ${key}`).toBe(true);
      }
    }
    const translate = createMdxEditorTranslation(i18n.getFixedT("zh-CN"));
    expect(translate("createLink.text", "Anchor text")).toBe("链接文本");
    expect(translate("table.deleteRow", "Delete this row")).toBe("删除当前行");
    expect(translate("codeblock.delete", "Delete code block")).toBe("删除代码块");
    expect(translate("imageEditor.deleteImage", "Delete image")).toBe("删除图片");
  });

  it("interpolates URLs without escaping or changing their content", () => {
    const url = 'https://example.test/?q=<text>&next=$&';
    const translate = createMdxEditorTranslation(i18n.getFixedT("zh-CN"));
    expect(translate("linkPreview.open", "Open {{url}} in new window", { url }))
      .toBe(`在新窗口中打开 ${url}`);
  });

  it("preserves unknown controls and code language names with literal fallback interpolation", () => {
    const translate = createMdxEditorTranslation(i18n.getFixedT("zh-CN"));
    expect(translate("future.control", "Show {{value}} then {{value}}", { value: "$& <draft>" }))
      .toBe("Show $& <draft> then $& <draft>");
    expect(translate("future.language", "JavaScript")).toBe("JavaScript");
    expect(translate("toString", "Upstream default")).toBe("Upstream default");
  });

  it("uses the upstream English fallback if an application resource is unavailable", async () => {
    const emptyI18n = createInstance();
    await emptyI18n.init({ lng: "en", resources: {}, interpolation: { escapeValue: false } });
    const translate = createMdxEditorTranslation(emptyI18n.t.bind(emptyI18n));
    expect(translate("linkPreview.open", "Open {{url}} in new window", { url: "https://example.test" }))
      .toBe("Open https://example.test in new window");
  });

  it("updates the real editor's controls when the language changes without remounting or losing a draft", async () => {
    const onChange = vi.fn();
    const editor = createRef<MarkdownEditorRef>();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<MarkdownEditor ref={editor} value="Original **draft**" onChange={onChange} />);
    });
    const editable = container.querySelector('[contenteditable="true"]');
    expect(editable?.getAttribute("aria-label")).toBe("editable markdown");
    await act(async () => {
      editor.current!.insertMarkdown("\n\nKeep `command --flag` and 中文正文");
    });
    const draft = editable?.textContent;
    expect(draft).toContain("Keep command --flag and 中文正文");
    onChange.mockClear();

    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
    expect(container.querySelector('[contenteditable="true"]')).toBe(editable);
    expect(editable?.getAttribute("aria-label")).toBe("Markdown 编辑区");
    expect(editable?.textContent).toBe(draft);
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(editable?.getAttribute("aria-label")).toBe("editable markdown");
    expect(editable?.textContent).toBe(draft);
    expect(onChange).not.toHaveBeenCalled();
  });
});
