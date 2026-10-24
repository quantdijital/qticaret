import { XMLParser, XMLValidator } from "fast-xml-parser"
import { ValidationError } from "../errors"

/**
 * XML from outside (migration files, supplier feeds, UBL responses; docs/04)
 * parsed without document type definitions or entity expansion, so neither
 * XXE (external entities reading files or URLs) nor entity bombs apply.
 * Values stay text: "06100" is a postal code, not 6100. Callers convert
 * them with Zod or lib/money.
 */

export const MAX_XML_BYTES = 5 * 1024 * 1024
// Feeds and UBL nest a dozen levels; the parser recurses once per level
export const MAX_XML_DEPTH = 64

export interface SafeXmlOptions {
  maxBytes?: number
  /** Keep attributes (prefixed `@_`); off by default, like fast-xml-parser. */
  keepAttributes?: boolean
  /** Elements that always parse as arrays, for repeated items. */
  isArray?: (tagName: string) => boolean
}

// A document type declaration is where entities are defined: refused outright
const DOCTYPE = /<!DOCTYPE|<!ENTITY/i
// Opening, closing and self-closing tags; comments and CDATA that look like
// tags count too, which can only refuse more
const TAG = /<(\/?)[A-Za-z_][^>]*?(\/?)>/g

function tooDeep(text: string): boolean {
  let depth = 0
  for (const [, closing, selfClosing] of text.matchAll(TAG)) {
    if (closing) {
      depth -= 1
    } else if (!selfClosing) {
      depth += 1
      if (depth > MAX_XML_DEPTH) {
        return true
      }
    }
  }
  return false
}

export function parseXmlSafely(text: string, options: SafeXmlOptions = {}): unknown {
  if (Buffer.byteLength(text, "utf8") > (options.maxBytes ?? MAX_XML_BYTES)) {
    throw new ValidationError("xml.too_large")
  }
  if (DOCTYPE.test(text)) {
    throw new ValidationError("xml.doctype_not_allowed")
  }
  if (tooDeep(text)) {
    throw new ValidationError("xml.too_deep")
  }
  try {
    if (XMLValidator.validate(text) !== true) {
      throw new ValidationError("xml.invalid")
    }
    const parser = new XMLParser({
      processEntities: false,
      parseTagValue: false,
      ignoreAttributes: !(options.keepAttributes ?? false),
      ...(options.isArray
        ? { isArray: (tagName: string) => options.isArray?.(tagName) ?? false }
        : {}),
    })
    return parser.parse(text) as unknown
  } catch (error) {
    // Anything the parser throws (a stack overflow included) is bad input
    throw error instanceof ValidationError
      ? error
      : new ValidationError("xml.invalid", { cause: error })
  }
}
