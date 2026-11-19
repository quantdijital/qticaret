import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { aiServicesQuery } from "@/features/ai/api/ai"
import type { AiTaskView } from "@/features/ai/api/ai"
import { BACKGROUND_TASK, useBackgroundTask } from "@/features/ai/use-ai-background"

export const SCENE_TASK = "image_scene"

/** What the picture dialog does: clean the background, or set the product in a scene. */
export type AiImageMode = "background" | "scene"

export interface AiImageModeView {
  task: string
  view: AiTaskView | undefined
  /** The options this service offers for the mode (backgrounds it makes, or the shop's scenes). */
  optionsOf: (service: string) => string[]
  /** An option in words: a background by its key, a scene by its pack name in the panel's language. */
  labelOf: (option: string) => string
}

/**
 * The picture dialog's two modes (docs/22 Aşama 4, 7). The scenes come
 * through `GET /admin/ai/services`: the shop's own saved ones, then its
 * sector pack's, with their Turkish and English names; one can also be
 * typed once, so the mode is offered whenever the role may run it.
 */
export function useAiImageModes(enabled = true) {
  const { t, i18n } = useTranslation()
  const services = useQuery({ ...aiServicesQuery(), enabled })
  const background = useBackgroundTask(enabled)
  const sceneView = services.data?.tasks.find((each) => each.id === SCENE_TASK)
  const scenes = sceneView?.scenes ?? []
  const english = (i18n.language || "tr").toLowerCase().startsWith("en")

  const modes: Record<AiImageMode, AiImageModeView> = {
    background: {
      task: BACKGROUND_TASK,
      view: background.view,
      optionsOf: background.optionsOf,
      labelOf: (option) => t(`ai.options.${option}`, { defaultValue: option }),
    },
    scene: {
      task: SCENE_TASK,
      view: sceneView,
      optionsOf: () => scenes.map((scene) => scene.code),
      labelOf: (option) => {
        const scene = scenes.find((each) => each.code === option)
        return scene ? (english ? scene.name.en : scene.name.tr) : option
      },
    },
  }
  // A scene can always be typed: the mode needs no saved or pack scene
  return { modes, sceneOffered: sceneView?.allowed ?? false }
}
