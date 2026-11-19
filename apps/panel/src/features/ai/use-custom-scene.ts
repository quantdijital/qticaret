import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  OWN_SCENES_MAX,
  SCENE_TEXT_MAX,
  aiScenesQuery,
  sceneLength,
  sceneNameOf,
  useSaveAiScenes,
} from "@/features/ai/api/scenes"
import { errorText } from "@/lib/errors"

/** The "Özel" chip's value among the scene codes: never a code (`[a-z][a-z0-9_]*`). */
export const CUSTOM_SCENE = "__custom"

/** What a scene job is asked with: a scene by its code (a saved one's id), or words typed once. */
export type SceneAsk = { option: string } | { prompt: string }

/**
 * The picture dialog's "Özel" scene (docs/22 Aşama 7): a description of
 * the background typed for this once, at most 200 characters, and, when
 * "Sahnelerime kaydet" is ticked, kept among the shop's scenes first (a
 * name left empty is its first words) and then asked for by its id. The
 * server cleans the words either way; nothing here is trusted.
 */
export function useCustomScene() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveAiScenes()
  const [text, setText] = useState("")
  const [keep, setKeep] = useState(false)
  const [name, setName] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const words = text.trim()
  const ready = words !== "" && sceneLength(text) <= SCENE_TEXT_MAX

  /** The ask, or null when the scene could not be kept (the reason is shown). */
  const submit = async (): Promise<SceneAsk | null> => {
    setFailure(null)
    if (!keep) {
      return { prompt: words }
    }
    try {
      const current = (await client.query({ ...aiScenesQuery(), staleTime: 0 })).values
      if (current.scenes.length >= OWN_SCENES_MAX) {
        setFailure(t("ai.scene.custom.full", { count: OWN_SCENES_MAX }))
        return null
      }
      const before = new Set(current.scenes.map((scene) => scene.id))
      const saved = await save.mutateAsync({
        scenes: [...current.scenes, { name: name.trim() || sceneNameOf(words), prompt: words }],
      })
      const made = saved.values.scenes.find((scene) => !before.has(scene.id))
      if (!made) {
        return { prompt: words }
      }
      setKeep(false)
      setName("")
      setText("")
      return { option: made.id }
    } catch (error) {
      setFailure(errorText(t, error))
      return null
    }
  }

  return {
    text,
    setText,
    keep,
    setKeep,
    name,
    setName,
    ready,
    saving: save.isPending,
    failure,
    submit,
  }
}

export type CustomScene = ReturnType<typeof useCustomScene>
