import { t } from "@/i18n";
/**
 * Prosumer copy for the Apps surface (PAP-10856).
 *
 * The P1a gallery manifest carries developer-flavoured taglines and credential
 * labels (e.g. "Connect Zapier-hosted MCP actions", "Zapier MCP token"). Those
 * strings would fail the vocabulary gate from PAP-10827 — no "MCP", "server",
 * "profile", "policy", "gateway", or "transport" anywhere on this surface. So
 * the UI never renders the raw manifest copy directly: it looks up plain copy
 * here, and `sanitizeProsumerCopy` is a final backstop for any free-text we do
 * surface (app names, fallback taglines).
 */

/** Words that must never appear in prosumer-facing copy on the Apps surface. */
const BANNED_WORDS = [
  "mcp",
  "server",
  "profile",
  "policy",
  "gateway",
  "transport",
  "stdio",
  "endpoint",
];

const BANNED_RE = new RegExp(`\\b(${BANNED_WORDS.join("|")})s?\\b`, "gi");

/**
 * Strip banned vocabulary from a free-text string as a last-resort backstop.
 * Prefer curated copy below; this only protects against manifest text we can't
 * fully control (e.g. a newly added gallery app with no curated entry yet).
 */
export function sanitizeProsumerCopy(text: string): string {
  return text
    .replace(BANNED_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

export interface AppCopy {
  /** Two short lines for the gallery card (M2). */
  tagline: string;
  /** Single line for the connect step header (M3b). */
  short: string;
}

/**
 * Curated prosumer copy keyed by gallery key. Taken from the M-series wires
 * (https://happy-grove-jzyc.here.now/). Apps without an entry fall back to a
 * generic, gate-safe line.
 */
function appCopyTable(): Record<string, AppCopy> {
  return {
    zapier: {
      tagline: t("app.lib.appGalleryCopy.zapier.tagline"),
      short: t("app.lib.appGalleryCopy.zapier.short"),
    },
    github: {
      tagline: t("app.lib.appGalleryCopy.github.tagline"),
      short: t("app.lib.appGalleryCopy.github.tagline"),
    },
    slack: {
      tagline: t("app.lib.appGalleryCopy.slack.tagline"),
      short: t("app.lib.appGalleryCopy.slack.short"),
    },
    notion: {
      tagline: t("app.lib.appGalleryCopy.notion.tagline"),
      short: t("app.lib.appGalleryCopy.notion.tagline"),
    },
    railway: {
      tagline: t("app.lib.appGalleryCopy.railway.tagline"),
      short: t("app.lib.appGalleryCopy.railway.short"),
    },
    posthog: {
      tagline: t("app.lib.appGalleryCopy.posthog.tagline"),
      short: t("app.lib.appGalleryCopy.posthog.short"),
    },
    linear: {
      tagline: t("app.lib.appGalleryCopy.linear.tagline"),
      short: t("app.lib.appGalleryCopy.linear.tagline"),
    },
    "google-sheets": {
      tagline: t("app.lib.appGalleryCopy.googleSheets.tagline"),
      short: t("app.lib.appGalleryCopy.googleSheets.short"),
    },
    gmail: {
      tagline: t("app.lib.appGalleryCopy.gmail.tagline"),
      short: t("app.lib.appGalleryCopy.gmail.tagline"),
    },
    "google-drive": {
      tagline: t("app.lib.appGalleryCopy.googleDrive.tagline"),
      short: t("app.lib.appGalleryCopy.googleDrive.tagline"),
    },
    "google-docs": {
      tagline: t("app.lib.appGalleryCopy.googleDocs.tagline"),
      short: t("app.lib.appGalleryCopy.googleDocs.tagline"),
    },
    "google-slides": {
      tagline: t("app.lib.appGalleryCopy.googleSlides.tagline"),
      short: t("app.lib.appGalleryCopy.googleSlides.tagline"),
    },
    "google-calendar": {
      tagline: t("app.lib.appGalleryCopy.googleCalendar.tagline"),
      short: t("app.lib.appGalleryCopy.googleCalendar.tagline"),
    },
    "google-chat": {
      tagline: t("app.lib.appGalleryCopy.googleChat.tagline"),
      short: t("app.lib.appGalleryCopy.googleChat.tagline"),
    },
    "google-people": {
      tagline: t("app.lib.appGalleryCopy.googlePeople.tagline"),
      short: t("app.lib.appGalleryCopy.googlePeople.tagline"),
    },
    "google-workspace-search": {
      tagline: t("app.lib.appGalleryCopy.googleWorkspaceSearch.tagline"),
      short: t("app.lib.appGalleryCopy.googleWorkspaceSearch.tagline"),
    },
    hubspot: {
      tagline: t("app.lib.appGalleryCopy.hubspot.tagline"),
      short: t("app.lib.appGalleryCopy.hubspot.tagline"),
    },
    intercom: {
      tagline: t("app.lib.appGalleryCopy.intercom.tagline"),
      short: t("app.lib.appGalleryCopy.intercom.tagline"),
    },
    figma: {
      tagline: t("app.lib.appGalleryCopy.figma.tagline"),
      short: t("app.lib.appGalleryCopy.figma.tagline"),
    },
    stripe: {
      tagline: t("app.lib.appGalleryCopy.stripe.tagline"),
      short: t("app.lib.appGalleryCopy.stripe.tagline"),
    },
    context7: {
      tagline: t("app.lib.appGalleryCopy.context7.tagline"),
      short: t("app.lib.appGalleryCopy.context7.tagline"),
    },
  };
}

function genericCopy(): AppCopy {
  const line = t("app.lib.appGalleryCopy.generic");
  return { tagline: line, short: line };
}

/** Curated, gate-safe copy for a gallery app. */
export function appCopyFor(key: string, fallbackTagline?: string | null): AppCopy {
  const curated = appCopyTable()[key];
  if (curated) return curated;
  if (fallbackTagline) {
    const cleaned = sanitizeProsumerCopy(fallbackTagline);
    if (cleaned) return { tagline: cleaned, short: cleaned };
  }
  return genericCopy();
}

/**
 * Label for a single credential field on the key-paste step (M3b). The raw
 * manifest label can contain banned vocab ("Zapier MCP token"), so for the
 * common single-field case we present "Your {App} key" per the wires; multi-
 * field apps fall back to a sanitized version of the manifest label.
 */
export function credentialFieldLabel(
  appName: string,
  rawLabel: string,
  fieldCount: number,
): string {
  if (fieldCount <= 1) return t("app.lib.appGalleryCopy.yourKey", { appName });
  const cleaned = sanitizeProsumerCopy(rawLabel);
  return cleaned || t("app.lib.appGalleryCopy.yourKey", { appName });
}
