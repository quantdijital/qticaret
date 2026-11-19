import { z } from "@medusajs/framework/zod"
import {
  OWN_SCENES_MAX,
  OWN_SCENE_ID,
  cleanSceneText,
  newOwnSceneId,
  sceneNameOf,
} from "../../../lib/ai/scene-text"
import { defineSection } from "./define"

/** A scene the shop saved: its name and the background it describes. */
export interface OwnScene {
  id: string
  name: string
  prompt: string
}

/**
 * The scenes a product photo can be set in (Aşama 7, docs/22; adr/0071
 * Ek): the shop's own first, then, unless it hides them, its sector pack's
 * starting ones (lib/ai/scenes.ts). Owner and admin write it, as any
 * section; the task is theirs alone too.
 */
export interface AiScenesSettings {
  /** The sector pack's starting scenes (or the general pack's neutral ones) are offered too. */
  show_pack_scenes: boolean
  /** At most `OWN_SCENES_MAX`, in the order the shop keeps them. */
  scenes: OwnScene[]
}

const INVALID = "ai.scene_text_invalid"

/**
 * One saved scene, held as a typed description is (`cleanSceneText`):
 * a new one gets its id here, a name left out is its first words. A
 * stored one passes unchanged: cleaning is idempotent.
 */
const scene = z
  .object({
    id: z.string().regex(OWN_SCENE_ID).optional(),
    name: z.string().max(200).optional(),
    prompt: z.string().max(1000),
  })
  .strict()
  .transform((value, ctx): OwnScene => {
    const prompt = cleanSceneText(value.prompt)
    const name = prompt === null ? null : sceneNameOf(value.name, prompt)
    if (prompt === null || name === null) {
      ctx.addIssue({ code: "custom", message: INVALID, input: value })
      return z.NEVER
    }
    return { id: value.id ?? newOwnSceneId(), name, prompt }
  })

export const aiScenesSection = defineSection<AiScenesSettings>(
  "ai_scenes",
  {
    show_pack_scenes: z.boolean(),
    scenes: z
      .array(scene)
      .max(OWN_SCENES_MAX * 4)
      // Twelve by a refinement, not `max`: Medusa words a size issue its own way, not by our key
      .refine((list) => list.length <= OWN_SCENES_MAX, { message: "ai.scenes_full" })
      .refine((list) => new Set(list.map((each) => each.id)).size === list.length, {
        message: INVALID,
      }),
  },
  { show_pack_scenes: true, scenes: [] }
)
