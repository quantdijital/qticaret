import { entityFacts } from "../../../lib/ai/facts"
import type { AiEntityType, FactsContainer, RecordFacts } from "../../../lib/ai/facts"
import { postLinkFacts } from "../../../lib/ai/facts/post-links"
import type { PostDraftAllowed } from "../../../lib/ai/post-draft"
import { buildPrompt } from "../../../lib/ai/prompt"
import { factLengthsOf } from "../../../lib/ai/registry/tasks"
import type { AiTask } from "../../../lib/ai/registry/tasks"

/**
 * The post's facts a draft is written from (adr/0074 §5 madde 5): its
 * title, focus keyword and summary, and the shop's name. The body it may
 * replace and the current search texts are not sent: a draft starts anew
 * from what the writer set out to say.
 */
export const POST_DRAFT_FACTS = ["name", "focus_keyword", "summary", "shop"] as const

export interface PostDraftInput {
  system: string
  data: string
  allowed: PostDraftAllowed
}

const pick = (fields: RecordFacts): RecordFacts =>
  Object.fromEntries(
    POST_DRAFT_FACTS.filter((name) => Object.hasOwn(fields, name)).map((name) => [
      name,
      fields[name],
    ])
  )

/**
 * A post draft's messages: the link candidates first (so a block too long
 * would give up the summary, never the list), then the post's facts. The
 * candidates are held on the server too (`allowed`): the only links the
 * answer may name.
 */
export async function postDraftInput(
  container: FactsContainer,
  task: AiTask,
  instruction: string,
  input: { entity_type: AiEntityType; entity_id: string }
): Promise<PostDraftInput> {
  const record = await entityFacts(container, input.entity_type, input.entity_id)
  const fields = pick(record.fields)
  const words = [fields["name"], fields["focus_keyword"], fields["summary"]]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
  const links = await postLinkFacts(container, words)
  const prompt = buildPrompt({
    instruction,
    fields: { ...links.fields, ...fields },
    maxLengths: { ...factLengthsOf(task, record.maxLengths), ...links.maxLengths },
    maxItems: links.maxItems,
  })
  return { system: prompt.system, data: prompt.data, allowed: links.allowed }
}
