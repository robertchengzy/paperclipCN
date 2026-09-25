import * as fs from "node:fs";
import * as path from "node:path";
import { parseSync } from "vite";

/**
 * Static scanner for user-visible English literals in the board UI.
 *
 * It reports three shapes of hardcoded copy:
 * - JSX text children (`<p>Save changes</p>`)
 * - string literals on copy-bearing JSX attributes (`placeholder="Search"`)
 * - string literals on copy-bearing object properties (`{ label: "Name" }`)
 *   and in toast/notice calls
 *
 * Code-like strings (identifiers, paths, URLs, CSS classes) are skipped.
 * Exemptions live in `hardcoded-strings.exemptions.json`.
 */

export type HardcodedStringKind = "jsx-text" | "jsx-attr" | "jsx-expr" | "prop" | "map" | "return" | "var" | "call" | "error";

export interface HardcodedString {
  file: string;
  line: number;
  kind: HardcodedStringKind;
  text: string;
}

export interface Exemptions {
  /** Path prefixes (relative to ui/src) whose files are not scanned. */
  files: string[];
  /** Exact literal values that are allowed to stay as-is (brand names, acronyms). */
  values: string[];
  /**
   * Per-file literals that look like copy but are program data (persisted
   * defaults, ids, developer-only errors). Keyed by ui/src-relative path.
   */
  entries?: Record<string, string[]>;
}

const COPY_ATTR_RE =
  /^(title|placeholder|alt|label|description|tooltip|hint|heading|subtitle|subheading|message|caption|helperText|helpText|emptyText|emptyMessage|emptyTitle|emptyDescription|confirmText|cancelText|aria-label|aria-description|aria-valuetext|aria-roledescription|[a-z][A-Za-z]*(Label|Title|Text|Message|Description|Placeholder|Hint|Tooltip|Heading|Caption))$/;

const COPY_PROP_RE =
  /^(title|placeholder|label|description|tooltip|hint|heading|subtitle|message|caption|helperText|helpText|emptyText|emptyMessage|body|detail|summary|reason|confirmText|cancelText|[a-z][A-Za-z]*(Label|Title|Text|Message|Description|Placeholder|Hint|Tooltip|Heading|Caption))$/;

const COPY_CALLEES = new Set(["toast", "pushToast", "showToast", "notify", "alert", "confirm", "setError", "setMessage", "setNotice"]);

const LETTER_WORD_RE = /[A-Za-z]{2,}/;

function looksLikeCode(value: string): boolean {
  const v = value.replace(/&[a-z]+;|&#\d+;/g, " ").trim();
  if (!LETTER_WORD_RE.test(v)) return true;
  if (/^https?:\/\//.test(v) || /^mailto:/.test(v)) return true;
  if (/\b(var|rgba?|hsla?|oklch|calc|linear-gradient|radial-gradient|url)\(/.test(v)) return true;
  if (/^[./~@#]/.test(v)) return true;
  // identifiers: camelCase, snake_case, kebab-case, dotted keys, SCREAMING_CASE
  if (/^[a-z0-9_.:\/-]+$/.test(v)) return true;
  if (/^[A-Z0-9_]+$/.test(v) && v.includes("_")) return true;
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(v)) return true;
  // CSS utility class lists
  if (/^[a-z0-9:_\-\[\]\/.%#()!]+(\s+[a-z0-9:_\-\[\]\/.%#()!]+)+$/.test(v)) return true;
  // placeholders that are sample values rather than copy
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v)) return true;
  return false;
}

function isCopy(value: string, relaxed: boolean): boolean {
  const v = value.replace(/\s+/g, " ").trim();
  if (!v || looksLikeCode(v)) return false;
  if (relaxed) return true;
  // attribute/property strings: require a capitalised word or a space-separated phrase
  return /^[A-Z]/.test(v) || /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v);
}

type AstNode = { type: string; start: number; end: number; [key: string]: unknown };

function lineOf(lineStarts: number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function attrName(node: AstNode): string | null {
  const name = node.name as AstNode;
  if (name.type === "JSXIdentifier") return name.name as string;
  if (name.type === "JSXNamespacedName") return `${(name.namespace as AstNode).name}:${(name.name as AstNode).name}`;
  return null;
}

function propName(node: AstNode): string | null {
  const key = node.key as AstNode;
  if (!key || node.computed) return null;
  if (key.type === "Identifier") return key.name as string;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

function calleeName(node: AstNode): string | null {
  const callee = node.callee as AstNode;
  if (callee.type === "Identifier") return callee.name as string;
  if (callee.type === "MemberExpression" && !callee.computed) return ((callee.property as AstNode).name as string) ?? null;
  return null;
}

const WRAPPER_TYPES = new Set([
  "ConditionalExpression",
  "LogicalExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "SequenceExpression",
]);

const TRANSLATE_CALLEES = new Set(["t", "translate", "tr", "i18nT"]);

function isStringNode(node: AstNode): boolean {
  if (node.type === "Literal") return typeof node.value === "string";
  return node.type === "TemplateLiteral";
}

function stringText(node: AstNode): string {
  if (node.type === "Literal") return node.value as string;
  const quasis = node.quasis as Array<{ value: { cooked: string | null } }>;
  return quasis.map((q) => q.value.cooked ?? "").join(" ");
}

/** Copy check for literals whose position alone does not imply UI copy. */
function isPhrase(value: string): boolean {
  const v = value.replace(/\s+/g, " ").trim();
  if (!v || looksLikeCode(v)) return false;
  if (!/[a-z]/.test(v)) return false;
  return /^[A-Z][a-z]/.test(v) || /^[A-Za-z]+[a-z]\s+[A-Za-z]{2,}/.test(v);
}

function templateIsCopy(node: AstNode): boolean {
  const quasis = (node.quasis as Array<{ value: { cooked: string | null } }>).map((q) => q.value.cooked ?? "");
  const joined = quasis.join(" ").replace(/\s+/g, " ").trim();
  if (!joined || looksLikeCode(joined)) return false;
  // prose around interpolations: at least one alphabetic word next to a space
  return quasis.some((q) => /(^|\s)[A-Za-z]{3,}(\s|[.,:!?…]|$)/.test(q) && !/^[a-z0-9_.:\/-]+$/.test(q.trim()));
}

function classifyLiteral(
  node: AstNode,
  ancestors: AstNode[],
): { kind: HardcodedStringKind; text: string } | null {
  const text = stringText(node);
  const isTemplate = node.type === "TemplateLiteral";
  let child = node;
  let concat = false;
  let i = ancestors.length - 1;
  for (; i >= 0; i--) {
    const parent = ancestors[i];
    if (parent.type === "ConditionalExpression" && parent.test === child) return null;
    if (parent.type === "LogicalExpression" && parent.operator !== "||" && parent.operator !== "??" && parent.left === child) return null;
    if (WRAPPER_TYPES.has(parent.type)) {
      child = parent;
      continue;
    }
    if (parent.type === "BinaryExpression" && parent.operator === "+") {
      concat = true;
      child = parent;
      continue;
    }
    if (parent.type === "TemplateLiteral") {
      child = parent;
      continue;
    }
    break;
  }
  const sink = i >= 0 ? ancestors[i] : null;
  if (!sink) return null;
  const copy = (strict: boolean) =>
    isTemplate ? templateIsCopy(node) : strict ? isPhrase(text) : isCopy(text, false) || (concat && isPhrase(text));

  switch (sink.type) {
    case "JSXAttribute": {
      const name = attrName(sink);
      return name && COPY_ATTR_RE.test(name) && copy(false) ? { kind: "jsx-attr", text } : null;
    }
    case "JSXExpressionContainer": {
      const holder = ancestors[i - 1];
      if (holder?.type === "JSXAttribute") {
        const name = attrName(holder);
        return name && COPY_ATTR_RE.test(name) && copy(false) ? { kind: "jsx-attr", text } : null;
      }
      if (holder?.type === "JSXElement" || holder?.type === "JSXFragment") {
        return copy(false) ? { kind: "jsx-expr", text } : null;
      }
      return null;
    }
    case "Property": {
      if (sink.value !== child) return null;
      const name = propName(sink);
      if (name && COPY_PROP_RE.test(name)) return copy(false) ? { kind: "prop", text } : null;
      return copy(true) ? { kind: "map", text } : null;
    }
    case "ReturnStatement":
      return copy(true) ? { kind: "return", text } : null;
    case "ArrowFunctionExpression":
      return sink.body === child && copy(true) ? { kind: "return", text } : null;
    case "VariableDeclarator":
      return sink.init === child && copy(true) ? { kind: "var", text } : null;
    case "AssignmentExpression":
      return sink.right === child && copy(true) ? { kind: "var", text } : null;
    case "CallExpression": {
      const name = calleeName(sink);
      if (!name || TRANSLATE_CALLEES.has(name)) return null;
      if (COPY_CALLEES.has(name)) return copy(false) ? { kind: "call", text } : null;
      return null;
    }
    case "NewExpression": {
      const callee = sink.callee as AstNode;
      return callee.type === "Identifier" && /Error$/.test(callee.name as string) && copy(true)
        ? { kind: "error", text }
        : null;
    }
    case "ThrowStatement":
      return copy(true) ? { kind: "error", text } : null;
    default:
      return null;
  }
}

export function scanSource(file: string, source: string, exemptValues: Set<string>): HardcodedString[] {
  const lang = file.endsWith(".tsx") ? "tsx" : "ts";
  const result = parseSync(file, source, { lang });
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const found: HardcodedString[] = [];

  const report = (node: AstNode, kind: HardcodedStringKind, text: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (exemptValues.has(normalized)) return;
    found.push({ file, line: lineOf(lineStarts, node.start), kind, text: normalized });
  };

  const visit = (node: unknown, ancestors: AstNode[]) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, ancestors);
      return;
    }
    const n = node as AstNode;
    if (typeof n.type !== "string") return;

    if (n.type === "JSXText") {
      const text = n.value as string;
      if (isCopy(text, true)) report(n, "jsx-text", text);
    } else if (isStringNode(n)) {
      const hit = classifyLiteral(n, ancestors);
      if (hit) report(n, hit.kind, hit.text);
      // do not descend into template expressions here; they are visited below
    }

    const next = [...ancestors, n];
    for (const key of Object.keys(n)) {
      if (key === "type" || key === "start" || key === "end") continue;
      const child = n[key];
      if (child && typeof child === "object") visit(child, next);
    }
  };

  visit(result.program, []);
  return found;
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "__tests__" || entry.name === "fixtures") continue;
      out.push(...collectSourceFiles(full));
    } else if (
      /\.(tsx|ts)$/.test(entry.name) &&
      !/\.(test|spec|stories)\.(tsx|ts)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

export function countByFile(found: HardcodedString[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of found) counts[item.file] = (counts[item.file] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function scanUi(srcDir: string, exemptions: Exemptions): HardcodedString[] {
  const exemptValues = new Set(exemptions.values);
  const found: HardcodedString[] = [];
  for (const full of collectSourceFiles(srcDir)) {
    const rel = path.relative(srcDir, full).split(path.sep).join("/");
    if (exemptions.files.some((prefix) => rel === prefix || rel.startsWith(prefix))) continue;
    const fileEntries = exemptions.entries?.[rel];
    const values = fileEntries ? new Set([...exemptValues, ...fileEntries]) : exemptValues;
    found.push(...scanSource(rel, fs.readFileSync(full, "utf8"), values));
  }
  return found;
}
