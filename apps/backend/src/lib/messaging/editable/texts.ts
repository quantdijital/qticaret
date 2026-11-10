import { messageText, rawMessageText } from "../texts"
import type { Brand } from "../templates/types"
import type { EditSpec, OwnTexts, TextField } from "./types"

/**
 * A customer message's words (adr/0036 Ek 2026-11-10): the shop's own
 * text where it wrote one, its `{belirteç}`s filled with plain values,
 * else the catalog's. Nothing here is HTML: the layout escapes every
 * value it is given, the filled text included.
 */

// The shop details' own pattern (lib/shop/tokens.ts): letters, digits and `_` between braces
const TOKEN = /\{([\p{L}\p{N}_]+)\}/gu
// Control and format characters never reach a message through a value
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu
const CATALOG_VALUE = /\{\{(\w+)\}\}/g

/** The `{name}`s a text uses that the template does not offer: refused when it is saved. */
export function unknownTemplateTokens(text: string, allowed: Iterable<string>): string[] {
  const known = new Set(allowed)
  const unknown = new Set<string>()
  for (const [, name = ""] of text.normalize("NFC").matchAll(TOKEN)) {
    if (!known.has(name)) {
      unknown.add(name)
    }
  }
  return [...unknown]
}

/**
 * The text with each offered `{name}` in place, in one pass: a value is
 * never read again as a token. One not offered (a token a later version
 * dropped) stays as typed, as the shop's details do.
 */
export function fillTemplateText(text: string, values: Readonly<Record<string, string>>): string {
  return text
    .normalize("NFC")
    .replace(TOKEN, (whole, name: string) =>
      Object.hasOwn(values, name) ? (values[name] ?? "").replace(INVISIBLE, "").trim() : whole
    )
}

/** Each offered token's value for this send: the catalog's values under the shop's names. */
export function tokenValues<V>(
  spec: EditSpec<V>,
  vars: V,
  brand: Brand
): Readonly<Record<string, string>> {
  const values = spec.values(vars, brand)
  return Object.fromEntries(
    Object.entries(spec.tokens).map(([token, value]) => [token, values[value] ?? ""])
  )
}

const keyOf = <V>(spec: EditSpec<V>, field: TextField, vars: V): string => {
  const key = spec.fields[field]
  if (key === undefined) {
    throw new Error(`messaging: ${field} is not a field of this template`)
  }
  return typeof key === "function" ? key(vars) : key
}

/**
 * The field's default as the shop writes it: the catalog's text for these
 * values with each `{{value}}` as its `{belirteç}`. The panel shows it and
 * a save that sends it back unchanged stores nothing.
 */
export function defaultText<V>(spec: EditSpec<V>, field: TextField, vars: V): string {
  const tokenOf = new Map(Object.entries(spec.tokens).map(([token, value]) => [value, token]))
  return rawMessageText(keyOf(spec, field, vars)).replace(CATALOG_VALUE, (whole, value: string) => {
    const token = tokenOf.get(value)
    return token ? `{${token}}` : whole
  })
}

/** The words of each field for one send: the shop's text filled in, else the catalog's. */
export function textsFor<V>(
  spec: EditSpec<V>,
  vars: V,
  brand: Brand,
  own: OwnTexts | undefined
): (field: TextField) => string {
  const values = spec.values(vars, brand)
  return (field) => {
    const written = own?.[field]
    if (written) {
      return fillTemplateText(written, tokenValues(spec, vars, brand))
    }
    return messageText(keyOf(spec, field, vars), values)
  }
}
