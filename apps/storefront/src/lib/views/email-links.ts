import type { ConfirmPageView, Translate } from "@qticaret/ui"

/**
 * The pages a message's token link opens (adr/0038 Ek 2026-11-02): they
 * ask first (opening the link changes nothing, so a mail scanner's visit
 * spends no token), and after the button say what happened. Each its own
 * Store endpoint; the backend checks the token again.
 */
export type EmailLinkKind = "unsubscribe" | "consent" | "stock_alert"

export const EMAIL_LINK_PATHS: Readonly<Record<EmailLinkKind, string>> = {
  unsubscribe: "/abonelik/cik",
  consent: "/abonelik/onay",
  stock_alert: "/stok-bildirimi/onay",
}

export const EMAIL_LINK_ENDPOINTS: Readonly<Record<EmailLinkKind, string>> = {
  unsubscribe: "/store/consents/unsubscribe",
  consent: "/store/consents/confirm",
  stock_alert: "/store/stock-alerts/confirm",
}

// The backend's token shapes: a signed recipient hash, or 32 random bytes
const TOKEN_SHAPES: Readonly<Record<EmailLinkKind, RegExp>> = {
  unsubscribe: /^[0-9a-f]{64}\.[\w-]{43}$/,
  consent: /^[\w-]{20,100}$/,
  stock_alert: /^[\w-]{20,100}$/,
}

/** The link's token when it has the shape of one; anything else is no token. */
export const linkTokenOf = (kind: EmailLinkKind, value: unknown): string | null =>
  typeof value === "string" && TOKEN_SHAPES[kind].test(value) ? value : null

export type EmailLinkOutcome = "done" | "granted" | "revoked" | "invalid" | "busy" | "failed"

/** How the outcome reads in the address (`?sonuc=`): Turkish words, as the paths. */
export const OUTCOME_PARAMS: Readonly<Record<EmailLinkOutcome, string>> = {
  done: "tamam",
  granted: "verildi",
  revoked: "geri-cekildi",
  invalid: "gecersiz",
  busy: "yogun",
  failed: "hata",
}

// What each link can end in: a page never says what its own link cannot do
const OUTCOMES: Readonly<Record<EmailLinkKind, readonly EmailLinkOutcome[]>> = {
  unsubscribe: ["done", "invalid", "busy", "failed"],
  consent: ["granted", "revoked", "invalid", "busy", "failed"],
  stock_alert: ["done", "invalid", "busy", "failed"],
}

const outcomeOf = (kind: EmailLinkKind, value: unknown): EmailLinkOutcome | null =>
  OUTCOMES[kind].find((outcome) => OUTCOME_PARAMS[outcome] === value) ?? null

/** Where the button's action sends the reader: the page again, saying what happened. */
export const outcomePath = (kind: EmailLinkKind, outcome: EmailLinkOutcome): string =>
  `${EMAIL_LINK_PATHS[kind]}?sonuc=${OUTCOME_PARAMS[outcome]}`

const PREFIX: Readonly<Record<EmailLinkKind, string>> = {
  unsubscribe: "email_links.unsubscribe",
  consent: "email_links.consent",
  stock_alert: "email_links.stock",
}

/** The page's own title, for its `<title>`. */
export const emailLinkTitle = (kind: EmailLinkKind, t: Translate): string =>
  t(`${PREFIX[kind]}_title`)

/**
 * The page for a link: after the button, what happened; with a token of
 * the right shape, the question and its button; else the link is broken.
 */
export function emailLinkView(
  kind: EmailLinkKind,
  query: { token: unknown; outcome: unknown },
  t: Translate
): ConfirmPageView {
  const prefix = PREFIX[kind]
  const back = { label: t("email_links.back"), path: "/" }
  const said = (title: string, text: string): ConfirmPageView => ({
    title,
    text,
    warning: null,
    fields: [],
    submit: null,
    back,
  })
  const invalid = said(t("email_links.invalid_title"), t(`${prefix}_invalid`))
  switch (outcomeOf(kind, query.outcome)) {
    case "done":
      return said(t(`${prefix}_done_title`), t(`${prefix}_done_text`))
    case "granted":
      return said(t("email_links.consent_granted_title"), t("email_links.consent_granted_text"))
    case "revoked":
      return said(t("email_links.consent_revoked_title"), t("email_links.consent_revoked_text"))
    case "busy":
      return said(t("email_links.busy_title"), t("email_links.busy_text"))
    case "failed":
      return said(t("email_links.failed_title"), t("email_links.failed_text"))
    case "invalid":
      return invalid
    case null:
      break
  }
  const token = linkTokenOf(kind, query.token)
  return token
    ? {
        title: t(`${prefix}_title`),
        text: t(`${prefix}_text`),
        warning: null,
        fields: [{ name: "token", value: token }],
        submit: t(`${prefix}_submit`),
        back,
      }
    : invalid
}
