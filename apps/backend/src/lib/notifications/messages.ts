import type { MessageLocale } from "../errors/messages"

/**
 * The shop's alerts as plain text (adr/0020): Medusa's notification feed
 * takes `title` and `description` as they are, so they are worded on the
 * server. The panel words alerts from their data in its own language; these
 * texts are what Medusa's own admin shows.
 */

// One language until F19 (DEFAULT_LOCALE in packages/types)
export const NOTIFICATION_LOCALE: MessageLocale = "tr"

interface AlertText {
  title: string
  description: string
}

export const NOTIFICATION_MESSAGES: Readonly<
  Record<MessageLocale, Readonly<Record<string, AlertText>>>
> = {
  tr: {
    "stock.low_stock": {
      title: "Düşük stok: {{name}}",
      description: "{{available}} adet kaldı (eşik {{threshold}}).",
    },
    "integrations.account_changed": {
      title: "{{provider}} hesap bilgileri değişti",
      description: "{{who}}: {{what}}",
    },
  },
  en: {
    "stock.low_stock": {
      title: "Low stock: {{name}}",
      description: "{{available}} left (threshold {{threshold}}).",
    },
    "integrations.account_changed": {
      title: "{{provider}} account details changed",
      description: "{{who}}: {{what}}",
    },
  },
}

const fill = (text: string, params: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole
  )

/** An alert's title and description in the shop's language; an unknown key reads as itself. */
export function notificationText(
  key: string,
  params: Readonly<Record<string, string | number>>,
  locale: MessageLocale = NOTIFICATION_LOCALE
): AlertText {
  const messages = NOTIFICATION_MESSAGES[locale]
  const text = Object.hasOwn(messages, key) ? messages[key] : undefined
  return text
    ? { title: fill(text.title, params), description: fill(text.description, params) }
    : { title: key, description: "" }
}
