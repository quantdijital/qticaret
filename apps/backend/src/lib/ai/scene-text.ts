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

// An address of any kind: a scheme, `www.` or a host with a common top-level domain
const LINK =
  /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[\p{L}\p{N}-]+\.(?:com|net|org|info|biz|io|co|me|ai|app|dev|shop|store|site|online|xyz|tr)\b)/iu

/**
 * The text as it may be kept and sent, or null when it may not: spaces
 * folded, at most `max` characters, no control character, no link, no
 * markup. Personal data (an e-mail, a phone, an IBAN, a card or identity
 * number) is taken out and left as "…", so the result passes this check
 * again unchanged.
 */
export function cleanSceneText(raw: unknown, max: number = SCENE_TEXT_MAX): string | null {
  if (typeof raw !== "string") {
    return null
  }
  const folded = raw.normalize("NFC").replace(/\s+/gu, " ").trim()
  if (folded === "" || Array.from(folded).length > max || !isCleanText(folded)) {
    return null
  }
  if (LINK.test(folded)) {
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
