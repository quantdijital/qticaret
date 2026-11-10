import { SMS_MAX_PARTS, smsLength } from "../../campaigns/sms"
import { ValidationError } from "../../errors"
import { isCleanText } from "../../security/text"
import type { Brand, MessageTemplate } from "../templates/types"
import {
  defaultText,
  fillTemplateText,
  missingTokens,
  tokenValues,
  unknownTemplateTokens,
} from "./texts"
import { traitsOf } from "./tokens"
import { SINGLE_LINE_FIELDS, TEXT_FIELDS, TEXT_LIMITS } from "./types"
import type { EditSpec, TextField } from "./types"

/**
 * A shop's words for a customer message, checked before they are kept
 * (adr/0036 Ek 2026-11-10): plain text only, the template's own
 * `{belirteç}`s only, short enough for a subject line and for three SMS,
 * and a required message never turned off. A field sent as its default
 * is kept as nothing, so a later change to the platform's text reaches it.
 */

export type TextsInput = { enabled?: boolean | undefined } & Partial<
  Record<TextField, string | null | undefined>
>

export interface CheckedTexts {
  enabled: boolean
  subject: string | null
  preheader: string | null
  heading: string | null
  intro: string | null
  sms: string | null
}

export const NO_OWN_TEXTS: CheckedTexts = {
  enabled: true,
  subject: null,
  preheader: null,
  heading: null,
  intro: null,
  sms: null,
}

// Format characters that could hide or turn text (bidi overrides, zero-width
// spaces), and the line and paragraph separators; a joiner keeps emoji whole
const HIDDEN = new RegExp("[\\p{Cf}\\u2028\\u2029]", "u")
const JOINERS = new RegExp("[\\u200c\\u200d]", "g")

function clean(field: TextField, value: string): string {
  const text = value.normalize("NFC").replace(/\r\n?/g, "\n").trim()
  const lines = SINGLE_LINE_FIELDS.has(field) ? text : text.replace(/\n/g, " ")
  if (!isCleanText(lines) || HIDDEN.test(text.replace(JOINERS, ""))) {
    throw new ValidationError("messaging.template_text_invalid", { field })
  }
  // UTF-16 units, as the panel's field counts them
  if (text.length > TEXT_LIMITS[field]) {
    throw new ValidationError("messaging.template_text_too_long", {
      field,
      values: { limit: String(TEXT_LIMITS[field]) },
    })
  }
  return text
}

function checkTokens<V>(spec: EditSpec<V>, field: TextField, text: string): void {
  const unknown = unknownTemplateTokens(text, Object.keys(spec.tokens))
  if (unknown.length > 0) {
    throw new ValidationError("messaging.template_token_unknown", {
      field,
      values: {
        tokens: unknown
          .slice(0, 10)
          .map((name) => `{${name.slice(0, 40)}}`)
          .join(", "),
        available: Object.keys(spec.tokens)
          .map((name) => `{${name}}`)
          .join(", "),
      },
    })
  }
}

/**
 * The SMS as long as a send can make it (as `workflows/campaigns/sms-length.ts`
 * counts a campaign): each token at its longest (`TOKEN_TRAITS`), the
 * shop's own name, the preview's value for the rest. A name with a letter
 * outside the GSM/TR table still turns it UCS-2: the panel warns of that.
 */
export function longestSms<V>(spec: EditSpec<V>, text: string, sample: V, brand: Brand): string {
  const values = tokenValues(spec, sample, brand)
  const longest = Object.fromEntries(
    Object.entries(values).map(([token, value]) => {
      const worst = traitsOf(token).longest ?? ""
      return [token, worst.length > value.length ? worst : value]
    })
  )
  return fillTemplateText(text, longest)
}

/**
 * `input` over what is kept now, checked. `sample` and `brand` stand for
 * a real send in the SMS's count: the preview's values, the shop's name,
 * each token at its longest.
 */
export function checkOwnTexts<V>(
  template: MessageTemplate<V>,
  input: TextsInput,
  current: CheckedTexts | null,
  sample: V,
  brand: Brand
): CheckedTexts {
  const spec = template.editable
  if (!spec) {
    throw new ValidationError("messaging.template_not_editable")
  }
  const next: CheckedTexts = { ...(current ?? NO_OWN_TEXTS) }
  for (const field of TEXT_FIELDS) {
    const value = input[field]
    if (value === undefined) {
      continue
    }
    if (spec.fields[field] === undefined) {
      throw new ValidationError("messaging.template_field_unknown", { field })
    }
    const text = value === null ? "" : clean(field, value)
    if (text !== "") {
      checkTokens(spec, field, text)
      const missing = missingTokens(spec, field, text)
      if (missing.length > 0) {
        throw new ValidationError("messaging.template_token_missing", {
          field,
          values: { tokens: missing.map((name) => `{${name}}`).join(", ") },
        })
      }
    }
    next[field] = text === "" || text === defaultText(spec, field, sample) ? null : text
  }
  if (input.enabled === false && spec.required) {
    throw new ValidationError("messaging.template_required", { field: "enabled" })
  }
  if (input.enabled !== undefined && spec.switchedIn) {
    throw new ValidationError("messaging.template_switched_elsewhere", { field: "enabled" })
  }
  next.enabled = spec.required || spec.switchedIn ? true : (input.enabled ?? next.enabled)
  if (next.sms !== null) {
    if (smsLength(longestSms(spec, next.sms, sample, brand)).parts > SMS_MAX_PARTS) {
      throw new ValidationError("messaging.sms_too_long", {
        field: "sms",
        values: { parts: String(SMS_MAX_PARTS) },
      })
    }
  }
  return next
}

/** The kept values as the templates read them: the fields the shop wrote. */
export function ownTextsOf(values: CheckedTexts | null): Partial<Record<TextField, string>> {
  if (!values) {
    return {}
  }
  return Object.fromEntries(
    TEXT_FIELDS.flatMap((field) => {
      const text = values[field]
      return text ? [[field, text]] : []
    })
  )
}
