/**
 * The mark an AI made picture carries (adr/0071 §10, docs/13 §9): IPTC
 * `DigitalSourceType` in the file's XMP, which Merchant Center and search
 * read. Upload cleaning drops every metadata block (lib/media/sanitize.ts);
 * this one value alone is written back, from a fixed list, so nothing a
 * file brought in survives but the fact that a machine made it.
 */

export const AI_SOURCES = ["edited", "generated"] as const
export type AiSource = (typeof AI_SOURCES)[number]

const VOCABULARY = "http://cv.iptc.org/newscodes/digitalsourcetype/"

/** The IPTC term for each kind of AI picture (adr/0071 §10). */
export const DIGITAL_SOURCE_TYPES: Readonly<Record<AiSource, string>> = {
  edited: `${VOCABULARY}compositeWithTrainedAlgorithmicMedia`,
  generated: `${VOCABULARY}trainedAlgorithmicMedia`,
}

const KNOWN: ReadonlySet<string> = new Set(Object.values(DIGITAL_SOURCE_TYPES))

/** The kind a term names; null for any other term. */
export function aiSourceOf(term: string | null): AiSource | null {
  const found = AI_SOURCES.find((source) => DIGITAL_SOURCE_TYPES[source] === term)
  return found ?? null
}

/** The XMP packet that says the term and nothing else. */
export function digitalSourceXmp(term: string): string {
  if (!KNOWN.has(term)) {
    throw new Error("media: unknown digital source type")
  }
  return (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" ' +
    `Iptc4xmpExt:DigitalSourceType="${term}"/>` +
    "</rdf:RDF></x:xmpmeta>" +
    '<?xpacket end="w"?>'
  )
}

// A packet past this is not read: the term sits near its start in every writer we know
const MAX_XMP_READ = 256 * 1024

// The three ways XMP writes a simple property: attribute, element text, resource
const PATTERNS: readonly RegExp[] = [
  /DigitalSourceType\s{0,8}=\s{0,8}"([^"<>]{1,200})"/,
  /DigitalSourceType(?:\s[^>]{0,200})?>\s{0,8}([^<\s]{1,200})\s{0,8}</,
  /DigitalSourceType\s[^>]{0,200}?rdf:resource\s{0,8}=\s{0,8}"([^"<>]{1,200})"/,
]

/**
 * The file's DigitalSourceType when it is one of ours (the two AI terms);
 * null for none, any other term or an unreadable packet. Read with bounded
 * patterns: a packet is untrusted input.
 */
export function digitalSourceTypeOf(xmp: Buffer | string | undefined | null): string | null {
  if (xmp === undefined || xmp === null) {
    return null
  }
  const text =
    typeof xmp === "string"
      ? xmp.slice(0, MAX_XMP_READ)
      : xmp.subarray(0, MAX_XMP_READ).toString("utf8")
  for (const pattern of PATTERNS) {
    const term = pattern.exec(text)?.[1]?.trim()
    if (term && KNOWN.has(term)) {
      return term
    }
  }
  return null
}
