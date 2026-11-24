import type { AssistantScreenRef } from "./api"

/**
 * A reply as the panel draws it (adr/0079 §7): plain text, nothing in it
 * read as Markdown, HTML or an address; a `[[key]]` marker becomes a
 * "Götür" chip only when its key is among the reply's own `screens` (and
 * the panel's map holds it), any other marker is dropped from the text.
 */
export type ReplyPart =
  { kind: "text"; text: string } | { kind: "screen"; screen: AssistantScreenRef }

const MARKER = /\[\[([^[\]\n]{1,100})\]\]/g

export function replyParts(
  text: string,
  screens: readonly AssistantScreenRef[],
  known: (key: string) => boolean
): ReplyPart[] {
  const offered = new Map(
    screens.filter((screen) => known(screen.key)).map((screen) => [screen.key, screen])
  )
  const parts: ReplyPart[] = []
  const pushText = (value: string) => {
    if (value === "") {
      return
    }
    const last = parts.at(-1)
    if (last?.kind === "text") {
      last.text += value
    } else {
      parts.push({ kind: "text", text: value })
    }
  }
  let at = 0
  for (const match of text.matchAll(MARKER)) {
    pushText(text.slice(at, match.index))
    at = match.index + match[0].length
    const screen = offered.get((match[1] ?? "").trim())
    if (screen) {
      parts.push({ kind: "screen", screen })
    }
  }
  pushText(text.slice(at))
  // A dropped marker leaves two spaces, or one before a full stop
  return parts.flatMap((part): ReplyPart[] => {
    if (part.kind !== "text") {
      return [part]
    }
    const tidy = part.text.replace(/[ \t]{2,}/g, " ").replace(/ ([.,;:!?])/g, "$1")
    return tidy === "" ? [] : [{ kind: "text", text: tidy }]
  })
}
