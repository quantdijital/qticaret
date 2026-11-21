import type { AiTask } from "./registry/tasks"

/**
 * A suggestion's candidates as its `content_draft` keeps them (adr/0074
 * §4): a short text's candidates one per line (each is a single line, the
 * gate holds it); a task with one text keeps it whole, line breaks and
 * all. Written and read only here, so the two cannot drift apart.
 */

/** The candidates as the draft's `text`. */
export const draftText = (candidates: readonly string[], text: string | null): string =>
  candidates.length > 1 ? candidates.join("\n") : (text ?? candidates[0] ?? "")

/** The candidates a draft's `text` holds, in the order offered; empty for an empty text. */
export function draftCandidates(task: Pick<AiTask, "candidates"> | null, text: string): string[] {
  if (text === "") {
    return []
  }
  return (task?.candidates ?? 1) > 1 ? text.split("\n").filter((line) => line !== "") : [text]
}

/** How many subject lines a bulk e-mail's stored JSON offers; 0 for anything else. */
function subjectCount(text: string): number {
  try {
    const subjects = (JSON.parse(text) as { subjects?: unknown } | null)?.subjects
    return Array.isArray(subjects) ? subjects.length : 0
  } catch {
    return 0
  }
}

/**
 * What accepting a draft takes (adr/0074 §4). A bulk e-mail is one JSON
 * text whose candidates are its subject lines: the index names the subject
 * picked (kept as `accepted_index`) and the whole JSON is returned, the
 * server's own text, never the client's. Any other task: its candidate.
 */
export function acceptedDraft(
  task: Pick<AiTask, "candidates" | "gate"> | null,
  text: string,
  index: number | undefined
): { index: number; text: string } | null {
  if (task?.gate !== "campaign_email") {
    return acceptedCandidate(draftCandidates(task, text), index)
  }
  const taken = acceptedCandidate(Array<string>(subjectCount(text)).fill(text), index)
  return taken === null ? null : { index: taken.index, text }
}

/**
 * The candidate accepted: by its place in the list (the first when none
 * is named); null when the suggestion offered no such candidate.
 */
export function acceptedCandidate(
  candidates: readonly string[],
  index: number | undefined
): { index: number; text: string } | null {
  const at = index ?? 0
  if (!Number.isInteger(at) || at < 0 || at >= candidates.length) {
    return null
  }
  const text = candidates[at]
  return text === undefined ? null : { index: at, text }
}
