/**
 * XML for SOAP carriers (adr/0035), without a dependency: a writer that
 * escapes every value, and a reader for the plain answers these services
 * give. The reader refuses a DOCTYPE (so no entity, no XXE), knows only
 * XML's five entities and character references, and stops at a depth and
 * a node count no answer of theirs comes near.
 */

export type XmlValue =
  string | number | boolean | null | undefined | readonly XmlValue[] | XmlFields

/** An element's children by name. */
export interface XmlFields {
  readonly [name: string]: XmlValue
}

export interface XmlNode {
  /** The element's name without its prefix (`soap:Body` is `Body`). */
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
  /** The element's own text, joined and unescaped. */
  text: string
}

export class XmlRefused extends Error {
  constructor(reason: string) {
    super(`xml: ${reason}`)
    this.name = "XmlRefused"
  }
}

const MAX_DEPTH = 64
const MAX_NODES = 100_000
// No tag of theirs comes near it; it keeps the attribute reader linear in practice
const MAX_TAG = 4096

// Characters XML 1.0 does not allow at all (a control character in a name or an address)
// eslint-disable-next-line no-control-regex
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

export function escapeXml(text: string): string {
  return text
    .replace(NOT_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*(:[A-Za-z_][A-Za-z0-9_.-]*)?$/

/** One element per value: a list repeats it, an object nests, null and undefined leave it out. */
export function xmlElement(name: string, value: XmlValue): string {
  if (!NAME.test(name)) {
    throw new XmlRefused(`invalid element name ${JSON.stringify(name)}`)
  }
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `<${name}>${escapeXml(String(value))}</${name}>`
  }
  if (Array.isArray(value)) {
    return (value as readonly XmlValue[]).map((each) => xmlElement(name, each)).join("")
  }
  const inner = Object.entries(value as XmlFields)
    .map(([child, each]) => xmlElement(child, each))
    .join("")
  return `<${name}>${inner}</${name}>`
}

/**
 * A SOAP request, 1.1 unless asked for 1.2 (an Axis2 port that offers only
 * that: PTT's tracking). A .NET (ASMX) service takes its parameters in the
 * operation's namespace (the default); a JAX-WS one in no namespace, the
 * operation alone prefixed (`prefixed`). `namespaces` declares more
 * prefixes on the operation, for parameters qualified by another schema's
 * namespace (Axis2: `xsd:dongu`); their names carry the prefix.
 */
export function soapEnvelope(input: {
  namespace: string
  operation: string
  params: XmlFields
  prefixed?: boolean
  namespaces?: Readonly<Record<string, string>>
  version?: "1.1" | "1.2"
}): string {
  if (!NAME.test(input.operation)) {
    throw new XmlRefused("invalid operation name")
  }
  const inner = Object.entries(input.params)
    .map(([name, value]) => xmlElement(name, value))
    .join("")
  const ns = escapeXml(input.namespace)
  const more = Object.entries(input.namespaces ?? {})
    .map(([prefix, uri]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix) || prefix === "op" || prefix === "soap") {
        throw new XmlRefused(`invalid namespace prefix ${JSON.stringify(prefix)}`)
      }
      return ` xmlns:${prefix}="${escapeXml(uri)}"`
    })
    .join("")
  const operation = input.prefixed
    ? `<op:${input.operation} xmlns:op="${ns}"${more}>${inner}</op:${input.operation}>`
    : `<${input.operation} xmlns="${ns}"${more}>${inner}</${input.operation}>`
  const envelope =
    input.version === "1.2"
      ? "http://www.w3.org/2003/05/soap-envelope"
      : "http://schemas.xmlsoap.org/soap/envelope/"
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="${envelope}">` +
    `<soap:Body>${operation}</soap:Body></soap:Envelope>`
  )
}

const ENTITIES: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
}

/** A character reference XML allows: a Unicode scalar value, not a surrogate. */
function character(code: number, ref: string): string {
  if (!Number.isInteger(code) || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    throw new XmlRefused(`invalid character reference &${ref};`)
  }
  return String.fromCodePoint(code)
}

function unescape(text: string): string {
  return text.replace(/&(#x[0-9A-Fa-f]{1,8}|#[0-9]{1,10}|[A-Za-z]{1,16});/g, (_, ref: string) => {
    if (ref.startsWith("#x")) {
      return character(Number.parseInt(ref.slice(2), 16), ref)
    }
    if (ref.startsWith("#")) {
      return character(Number.parseInt(ref.slice(1), 10), ref)
    }
    const known = ENTITIES[ref]
    if (known === undefined) {
      throw new XmlRefused(`unknown entity &${ref};`)
    }
    return known
  })
}

const localName = (name: string): string => name.slice(name.indexOf(":") + 1)

const ATTRIBUTE = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g

function attributesOf(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1] ?? ""
    attributes[localName(name)] = unescape(match[3] ?? match[4] ?? "")
  }
  return attributes
}

/** Reads an answer into a tree of elements; refuses what a carrier's answer never holds. */
export function parseXml(source: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new XmlRefused("a DOCTYPE is not read")
  }
  const root: XmlNode = { name: "#document", attributes: {}, children: [], text: "" }
  const stack: XmlNode[] = [root]
  let nodes = 0
  let at = 0
  while (at < source.length) {
    const open = source.indexOf("<", at)
    const top = stack[stack.length - 1] ?? root
    if (open === -1) {
      top.text += unescape(source.slice(at))
      break
    }
    if (open > at) {
      top.text += unescape(source.slice(at, open))
    }
    if (source.startsWith("<?", open)) {
      at = closeOf(source, open, "?>")
      continue
    }
    if (source.startsWith("<!--", open)) {
      at = closeOf(source, open, "-->")
      continue
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open)
      if (end === -1) {
        throw new XmlRefused("unclosed CDATA")
      }
      top.text += source.slice(open + 9, end)
      at = end + 3
      continue
    }
    const close = source.indexOf(">", open)
    if (close === -1) {
      throw new XmlRefused("unclosed tag")
    }
    if (close - open > MAX_TAG) {
      throw new XmlRefused("tag too long")
    }
    const tag = source.slice(open + 1, close)
    at = close + 1
    if (tag.startsWith("/")) {
      const name = localName(tag.slice(1).trim())
      if (stack.length < 2 || top.name !== name) {
        throw new XmlRefused("mismatched closing tag")
      }
      stack.pop()
      continue
    }
    const selfClosing = tag.endsWith("/")
    const body = selfClosing ? tag.slice(0, -1) : tag
    const nameEnd = body.search(/\s|$/)
    const node: XmlNode = {
      name: localName(body.slice(0, nameEnd)),
      attributes: attributesOf(body.slice(nameEnd)),
      children: [],
      text: "",
    }
    nodes += 1
    if (nodes > MAX_NODES) {
      throw new XmlRefused("too many elements")
    }
    top.children.push(node)
    if (!selfClosing) {
      if (stack.length > MAX_DEPTH) {
        throw new XmlRefused("too deep")
      }
      stack.push(node)
    }
  }
  if (stack.length !== 1) {
    throw new XmlRefused("unclosed element")
  }
  return root
}

function closeOf(source: string, from: number, marker: string): number {
  const end = source.indexOf(marker, from)
  if (end === -1) {
    throw new XmlRefused(`unclosed ${marker}`)
  }
  return end + marker.length
}

/** Every element of that name under the node, in document order. */
export function findAll(node: XmlNode, name: string): XmlNode[] {
  const found: XmlNode[] = []
  const visit = (each: XmlNode) => {
    for (const child of each.children) {
      if (child.name === name) {
        found.push(child)
      }
      visit(child)
    }
  }
  visit(node)
  return found
}

export const findFirst = (node: XmlNode, name: string): XmlNode | null =>
  findAll(node, name)[0] ?? null

/** The trimmed text of the first element of that name, or null when absent or empty. */
export function textOf(node: XmlNode, name: string): string | null {
  const text = findFirst(node, name)?.text.trim() ?? ""
  return text === "" ? null : text
}
