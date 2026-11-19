import { useQueryClient } from "@tanstack/react-query"
import { AI_KEY } from "@/features/ai/api/ai"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"

/** The longest scene description, as the server holds it (`SCENE_TEXT_MAX`). */
export const SCENE_TEXT_MAX = 200

/** The longest saved scene's name (`SCENE_NAME_MAX`). */
export const SCENE_NAME_MAX = 40

/** The most scenes a shop may save (`OWN_SCENES_MAX`). */
export const OWN_SCENES_MAX = 12

/** A scene the shop saved; the server gives a new one its id and cleans its words. */
export interface OwnScene {
  id: string
  name: string
  prompt: string
}

/**
 * The `ai_scenes` settings section (docs/22 Aşama 7): the shop's own
 * scenes, offered first in the picture dialog, and whether its sector
 * pack's starting scenes are offered too. Owner and admin write it.
 */
export interface AiScenesSettings {
  show_pack_scenes: boolean
  scenes: OwnScene[]
}

/** A scene as sent: a new one has no id yet. */
export type OwnSceneInput = Omit<OwnScene, "id"> & { id?: string }

export const aiScenesQuery = () => sectionQuery<AiScenesSettings>("ai_scenes")

/**
 * Saves the section (the scenes list is sent whole); the dialog's scene
 * list is read again, as it follows the saved scenes.
 */
export function useSaveAiScenes() {
  const client = useQueryClient()
  const save = useSaveSection<{ show_pack_scenes: boolean; scenes: OwnSceneInput[] }>("ai_scenes")
  return {
    ...save,
    mutateAsync: async (
      values: Partial<{ show_pack_scenes: boolean; scenes: OwnSceneInput[] }>
    ) => {
      const saved = await save.mutateAsync(values)
      void client.invalidateQueries({ queryKey: [...AI_KEY, "services"] })
      return saved as unknown as { values: AiScenesSettings }
    },
  }
}

/** A name from a description's first words, as the server makes one. */
export function sceneNameOf(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 4).join(" ")
  return Array.from(words)
    .slice(0, SCENE_NAME_MAX)
    .join("")
    .replace(/[,;:]+$/, "")
    .trim()
}

/** A text's length in characters (code points), as the server counts it. */
export const sceneLength = (text: string): number => Array.from(text).length
