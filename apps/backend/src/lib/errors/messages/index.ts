import { SERVER_ERROR_MESSAGES_EN } from "./en"
import { SERVER_ERROR_MESSAGES_TR } from "./tr"

export { SERVER_ERROR_MESSAGES_EN, SERVER_ERROR_MESSAGES_TR }

export type MessageLocale = "tr" | "en"

const MESSAGES: Readonly<Record<MessageLocale, Readonly<Record<string, string>>>> = {
  tr: SERVER_ERROR_MESSAGES_TR,
  en: SERVER_ERROR_MESSAGES_EN,
}

// For a key without a sentence yet: still readable, and support can find it
const GENERIC: Readonly<Record<MessageLocale, (key: string) => string>> = {
  tr: (key) => `İşlem tamamlanamadı (hata kodu: ${key}).`,
  en: (key) => `The action could not be completed (error code: ${key}).`,
}

/** The sentence for an API error key (`catalog.handle_invalid`). */
export function serverErrorMessage(key: string, locale: MessageLocale = "tr"): string {
  const messages = MESSAGES[locale]
  return Object.hasOwn(messages, key)
    ? (messages[key] ?? GENERIC[locale](key))
    : GENERIC[locale](key)
}
