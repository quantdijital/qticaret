import { isCleanText } from "../security/text"
import { redactPersonalData } from "./redact"

/**
 * A scene the shop writes itself (Aşama 7, docs/22): a one-off description
 * typed in the picture dialog, or one of its saved scenes (Settings >
 * Yapay zekâ). Both are client data, so each is held here before it is
 * stored or sent: one plain line, a short length, no link and no markup,
 * and what reads as personal data taken out. What reaches a service is
 * never the text alone: `ownSceneSetting` puts the server's fixed words in
 * front of it, and the connector's own instruction keeps the product as it is.
 */

/** The longest description, in characters (the panel's counter shows the same). */
export const SCENE_TEXT_MAX = 200

/** The longest saved scene's name. */
export const SCENE_NAME_MAX = 40

/** The most scenes a shop may save. */
export const OWN_SCENES_MAX = 12

/** A saved scene's id: made by the server (`newOwnSceneId`), never a pack scene's code. */
export const OWN_SCENE_ID = /^own_[a-z0-9]{8,24}$/

/** The option a one-off description is recorded under; its words are never recorded. */
export const CUSTOM_SCENE_CODE = "custom"

// Letters, marks and digits of any script, spaces and plain punctuation; no markup
// (`< > { } [ ] \` | \\`), no quotes that could close the server's own words
const ALLOWED = /^[\p{L}\p{M}\p{N} .,;:!?'’()&/%+\-–…]*$/u

// Characters that draw nothing yet count as letters or marks: every default-ignorable
// code point (variation selectors U+FE00–FE0F and U+E0100–E01EF, the grapheme joiner
// U+034F, the Hangul fillers U+115F, U+1160, U+3164 and U+FFA0, zero-width and bidi
// controls, tags) and the blank Braille pattern U+2800
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\u2800]/u

// A mark with no letter before it, or more than three marks on one letter: Turkish and
// other Latin letters need one or two, a heap of them only covers the text around it
const MARK_HEAP = /(?:^|[^\p{L}\p{M}])\p{M}|\p{M}{4,}/u

// An address, read on the NFKC form (full-width letters and dots fold to plain ones):
// - a scheme (`https://`);
// - letters or digits, a dot and two letters or more, with no space after the dot, of
//   any script (`ğüş.com`, `evil.de`, `x.ru`, `www.example`);
// - the same with spaces before the dot (`evil . com`), which prose never writes;
// - a sentence-like dot followed by a well-known top-level domain alone (`evil. com`);
// - four dotted numbers (an IP address).
// A sentence's own full stop, a dot then a space then words ("yumuşak ışık. arka
// plan", "örn. ahşap"), is not an address; neither is a decimal ("1.5 m").
const LINK = new RegExp(
  [
    String.raw`[a-z][a-z0-9+.-]*:\/\/`,
    String.raw`[\p{L}\p{N}]\.\p{L}{2}`,
    String.raw`[\p{L}\p{N}]\s+\.\s*\p{L}{2}`,
    String.raw`[\p{L}\p{N}]\.\s*(?:com|org|io|ru|biz|info|xyz)(?![\p{L}\p{N}])`,
    String.raw`\d{1,3}(?:\s*\.\s*\d{1,3}){3}`,
  ].join("|"),
  "iu"
)

/** Whether the text holds something that reads as an address (see LINK). */
export function looksLikeLink(text: string): boolean {
  return LINK.test(text.normalize("NFKC"))
}

/** Whether the text holds a character that draws nothing or a heap of marks. */
export function hidesCharacters(text: string): boolean {
  return INVISIBLE.test(text) || MARK_HEAP.test(text) || INVISIBLE.test(text.normalize("NFKC"))
}

/**
 * The text as it may be kept and sent, or null when it may not: spaces
 * folded, at most `max` characters, no control character, nothing that
 * reads as an address, no character that draws nothing, no heap of marks,
 * no markup. Patterns of personal data (an e-mail, a phone, an IBAN, a card
 * or identity number) are taken out and left as "…", so the result passes
 * this check again unchanged; names and street addresses are not caught,
 * so the panel asks for none.
 */
export function cleanSceneText(raw: unknown, max: number = SCENE_TEXT_MAX): string | null {
  if (typeof raw !== "string") {
    return null
  }
  const folded = raw.normalize("NFC").replace(/\s+/gu, " ").trim()
  if (folded === "" || Array.from(folded).length > max || !isCleanText(folded)) {
    return null
  }
  if (looksLikeLink(folded) || hidesCharacters(folded)) {
    return null
  }
  const redacted = redactPersonalData(folded).replaceAll("[…]", "…")
  if (!ALLOWED.test(redacted)) {
    return null
  }
  const kept = redacted.replace(/ {2,}/g, " ").trim()
  return kept === "" || kept === "…" ? null : kept
}

/** A saved scene's name: its own, else the description's first words. */
export function sceneNameOf(name: unknown, prompt: string): string | null {
  if (typeof name === "string" && name.trim() !== "") {
    return cleanSceneText(name, SCENE_NAME_MAX)
  }
  const words = prompt.split(" ").slice(0, 4).join(" ")
  const cut = Array.from(words).slice(0, SCENE_NAME_MAX).join("").trim()
  return cleanSceneText(cut.replace(/[,;:]+$/u, ""), SCENE_NAME_MAX)
}

/** A new saved scene's id. */
export function newOwnSceneId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `own_${Array.from(bytes, (byte) => (byte % 36).toString(36)).join("")}`
}

/**
 * What a scene the shop wrote is sent as: the server's fixed words first,
 * then the description, which can only say what the background is. The
 * connector's instruction (Gemini) puts its own rules in front of this
 * too; Photoroom keeps the cut-out product and makes only the background.
 */
export function ownSceneSetting(text: string): string {
  return (
    "Background only, with no people, no hands, no brand names, no logos and no lettering. " +
    `The background: ${text}`
  )
}
