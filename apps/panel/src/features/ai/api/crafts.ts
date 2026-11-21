import { queryOptions } from "@tanstack/react-query"
import { AI_KEY } from "@/features/ai/api/ai"
import type { AiTaskGuidance } from "@/features/ai/api/guidance"
import { sdk } from "@/lib/sdk"

/**
 * A text task's default instruction (adr/0074 §3), as the backend answers
 * it (`GET /admin/ai/guidance/crafts`): the text the "Gelişmiş" editor
 * starts from, its version, and what is always added around it whatever
 * the owner writes (the data rule first, the fixed rules last).
 */
export interface DefaultCraft {
  task: string
  craft: string
  version: string
  data_rule: string
  rules: string
}

export const craftsQuery = () =>
  queryOptions({
    queryKey: [...AI_KEY, "crafts"],
    queryFn: async () =>
      (await sdk.client.fetch<{ crafts?: DefaultCraft[] }>("/admin/ai/guidance/crafts")).crafts ??
      [],
    // Written in code: it changes with a deploy only
    staleTime: Infinity,
  })

/**
 * Whether the default moved past the version the owner's instruction was
 * written against: the owner is warned and shown the new default. No
 * instruction of one's own, or no default known yet: nothing to say.
 */
export const craftOutdated = (
  saved: Pick<AiTaskGuidance, "craft" | "craft_base"> | undefined,
  standard: Pick<DefaultCraft, "version"> | undefined
): boolean =>
  Boolean(saved?.craft) &&
  standard !== undefined &&
  (saved?.craft_base ?? null) !== standard.version
