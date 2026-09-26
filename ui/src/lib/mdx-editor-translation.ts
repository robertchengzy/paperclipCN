import { realmPlugin, translation$, type Translation } from "@mdxeditor/editor";
import type { TFunction } from "i18next";

// Only the controls exposed by MarkdownEditor's enabled plugins are mapped.
// Unknown upstream controls keep the editor's own English fallback.
export const MDX_EDITOR_TRANSLATION_KEYS: Record<string, string> = {
  "contentArea.editableMarkdown": "app.shell.markdownEditor.controls.editableMarkdown",
  "codeBlock.selectLanguage": "app.shell.markdownEditor.controls.selectCodeLanguage",
  "codeBlock.inlineLanguage": "app.shell.markdownEditor.controls.codeLanguage",
  "codeblock.delete": "app.shell.markdownEditor.controls.deleteCodeBlock",
  "table.deleteTable": "app.shell.markdownEditor.controls.deleteTable",
  "table.columnMenu": "app.shell.markdownEditor.controls.columnMenu",
  "table.textAlignment": "app.shell.markdownEditor.controls.textAlignment",
  "table.alignLeft": "app.shell.markdownEditor.controls.alignLeft",
  "table.alignCenter": "app.shell.markdownEditor.controls.alignCenter",
  "table.alignRight": "app.shell.markdownEditor.controls.alignRight",
  "table.insertColumnLeft": "app.shell.markdownEditor.controls.insertColumnLeft",
  "table.insertColumnRight": "app.shell.markdownEditor.controls.insertColumnRight",
  "table.deleteColumn": "app.shell.markdownEditor.controls.deleteColumn",
  "table.rowMenu": "app.shell.markdownEditor.controls.rowMenu",
  "table.insertRowAbove": "app.shell.markdownEditor.controls.insertRowAbove",
  "table.insertRowBelow": "app.shell.markdownEditor.controls.insertRowBelow",
  "table.deleteRow": "app.shell.markdownEditor.controls.deleteRow",
  "uploadImage.dialogTitle": "app.shell.markdownEditor.controls.uploadImage",
  "uploadImage.uploadInstructions": "app.shell.markdownEditor.controls.uploadImageInstructions",
  "uploadImage.addViaUrlInstructions": "app.shell.markdownEditor.controls.imageUrlOrUpload",
  "uploadImage.addViaUrlInstructionsNoUpload": "app.shell.markdownEditor.controls.imageUrl",
  "uploadImage.autoCompletePlaceholder": "app.shell.markdownEditor.controls.imageSourcePlaceholder",
  "uploadImage.alt": "app.shell.markdownEditor.controls.imageAlt",
  "uploadImage.title": "app.shell.markdownEditor.controls.imageTitle",
  "uploadImage.width": "app.shell.markdownEditor.controls.imageWidth",
  "uploadImage.height": "app.shell.markdownEditor.controls.imageHeight",
  "imageEditor.deleteImage": "app.shell.markdownEditor.controls.deleteImage",
  "imageEditor.editImage": "app.shell.markdownEditor.controls.editImage",
  "createLink.url": "app.shell.markdownEditor.controls.linkUrl",
  "createLink.urlPlaceholder": "app.shell.markdownEditor.controls.linkUrlPlaceholder",
  "createLink.textTooltip": "app.shell.markdownEditor.controls.linkTextTooltip",
  "createLink.text": "app.shell.markdownEditor.controls.linkText",
  "createLink.titleTooltip": "app.shell.markdownEditor.controls.linkTitleTooltip",
  "createLink.title": "app.shell.markdownEditor.controls.linkTitle",
  "createLink.saveTooltip": "app.shell.markdownEditor.controls.setLinkUrl",
  "createLink.cancelTooltip": "app.shell.markdownEditor.controls.cancelLinkChange",
  "linkPreview.open": "app.shell.markdownEditor.controls.openLink",
  "linkPreview.edit": "app.shell.markdownEditor.controls.editLink",
  "linkPreview.copyToClipboard": "app.shell.markdownEditor.controls.copyLink",
  "linkPreview.copied": "app.shell.markdownEditor.controls.linkCopied",
  "linkPreview.remove": "app.shell.markdownEditor.controls.removeLink",
  "dialogControls.save": "app.common.actions.save",
  "dialogControls.cancel": "app.common.actions.cancel",
};

export function createMdxEditorTranslation(t: TFunction): Translation {
  return (key, defaultValue, interpolations = {}) => {
    if (Object.hasOwn(MDX_EDITOR_TRANSLATION_KEYS, key)) {
      return t(MDX_EDITOR_TRANSLATION_KEYS[key], { ...interpolations, defaultValue });
    }
    // Match MDXEditor's default callback, including repeated placeholders.
    return Object.entries(interpolations).reduce(
      (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, () => String(replacement)),
      defaultValue,
    );
  };
}

// MDXEditor 4.2 only publishes translation$ during core plugin initialization.
// Publish a changed callback without remounting and losing the document/history.
export const mdxEditorTranslationPlugin = realmPlugin<{ translation: Translation }>({
  update(realm, params) {
    realm.pub(translation$, params!.translation);
  },
});
