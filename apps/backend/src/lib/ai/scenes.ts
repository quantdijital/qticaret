import { existsSync } from "node:fs"
import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  DEFAULT_PACKS_DIR,
  MAX_SCENES,
  PACK_CODE,
  SectorPackError,
  readPack,
  sectorPack,
} from "@qticaret/sector-packs"
import type { SceneData } from "@qticaret/sector-packs"
import { logger } from "../logging"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { AiScenesSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import {
  CUSTOM_SCENE_CODE,
  OWN_SCENES_MAX,
  OWN_SCENE_ID,
  cleanSceneText,
  ownSceneSetting,
  sceneNameOf,
} from "./scene-text"

/**
 * The scenes a product photo can be set in (Aşama 7, docs/22), in this
 * order: the shop's own saved ones (the `ai_scenes` settings section, at
 * most twelve), then, unless the shop hides them, its sector packs'
 * starting ones (`packages/sector-packs/packs/<code>/scenes.json`, data,
 * never code): the first pack applied here that has scenes gives them, a
 * shop with none falls back to the general pack's two neutral ones, at
 * most two either way. A scene's code (a saved one's id) is the only thing
 * a request names; its prompt is read here, on the server. A one-off
 * description typed in the dialog is held by `lib/ai/scene-text.ts`.
 */

export type AiScene = SceneData

/** A scene as the shop is offered it: `own` when the shop wrote it (its prompt is client data). */
export interface ShopScene extends AiScene {
  own: boolean
}

/** The pack every shop has: its scenes are the neutral fallback. */
export const SCENE_FALLBACK_PACK = "general"

/** Each pack's scenes by folder and code, for the life of the process (`packScenes`). */
const sceneCache = new Map<string, readonly AiScene[]>()

/**
 * A pack's scenes; one its loader refuses has none (logged by its code,
 * never its content). The packs are read together and once: one refused
 * fails the read of all, so each is then read on its own (as the preset
 * gallery does, `api/admin/storefront-presets/read.ts`). The packs ship
 * with the build, so each pack's answer (none included) is kept for the
 * process: a refused pack is read and logged once, not on every request.
 */
export function packScenes(code: string, dir: string = DEFAULT_PACKS_DIR): readonly AiScene[] {
  const key = `${dir}\u0000${code}`
  const known = sceneCache.get(key)
  if (known) {
    return known
  }
  const scenes = readScenes(code, dir)
  sceneCache.set(key, scenes)
  return scenes
}

function readScenes(code: string, dir: string): readonly AiScene[] {
  try {
    return sectorPack(code, dir)?.scenes ?? []
  } catch (error) {
    if (!(error instanceof SectorPackError)) {
      throw error
    }
  }
  const folder = join(dir, code)
  if (!PACK_CODE.test(code) || !existsSync(folder)) {
    return []
  }
  try {
    return readPack(folder, code).scenes
  } catch (error) {
    if (!(error instanceof SectorPackError)) {
      throw error
    }
    logger.error({ event: "ai.scene_pack_unreadable", pack: code })
    return []
  }
}

/** The scenes of these applied packs (in the order they were applied), else the fallback's. */
export function scenesOfPacks(applied: readonly string[], dir?: string): readonly AiScene[] {
  for (const code of applied) {
    if (code === SCENE_FALLBACK_PACK) {
      continue
    }
    const scenes = packScenes(code, dir)
    if (scenes.length > 0) {
      return scenes.slice(0, MAX_SCENES)
    }
  }
  return packScenes(SCENE_FALLBACK_PACK, dir).slice(0, MAX_SCENES)
}

/**
 * The shop's scenes from its settings and applied packs: its own first (a
 * stored one cleaned again, as a request's text is; one that no longer
 * passes is left out), then the packs' unless hidden.
 */
export function scenesFor(
  settings: Pick<AiScenesSettings, "show_pack_scenes" | "scenes">,
  applied: readonly string[],
  dir?: string
): ShopScene[] {
  const own: ShopScene[] = []
  for (const scene of settings.scenes.slice(0, OWN_SCENES_MAX)) {
    const prompt = cleanSceneText(scene.prompt)
    const name = prompt === null ? null : sceneNameOf(scene.name, prompt)
    if (OWN_SCENE_ID.test(scene.id) && prompt !== null && name !== null) {
      own.push({ code: scene.id, name: { tr: name, en: name }, prompt, own: true })
    }
  }
  const packs = settings.show_pack_scenes
    ? scenesOfPacks(applied, dir).map((scene) => ({ ...scene, own: false }))
    : []
  return [...own, ...packs]
}

/** This shop's scenes: its saved ones, then its packs' (lib/ai/scenes.ts head). */
export async function shopScenes(
  container: Pick<MedusaContainer, "resolve">
): Promise<ShopScene[]> {
  const [settings, applied] = await Promise.all([
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .readSection("ai_scenes"),
    container
      .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      .listSectorPackApplications(
        {},
        { select: ["pack", "applied_at"], order: { applied_at: "ASC" }, take: null }
      ),
  ])
  return scenesFor(
    settings.values as unknown as AiScenesSettings,
    applied.map((row) => row.pack)
  )
}

/** The scene of this code among the shop's, or null: the allow-list a request is held to. */
export async function shopSceneOf(
  container: Pick<MedusaContainer, "resolve">,
  code: string
): Promise<ShopScene | null> {
  return (await shopScenes(container)).find((scene) => scene.code === code) ?? null
}

/** A one-off description as a scene, or null when it may not be sent (`cleanSceneText`). */
export function customScene(text: unknown): ShopScene | null {
  const prompt = cleanSceneText(text)
  return prompt === null
    ? null
    : { code: CUSTOM_SCENE_CODE, name: { tr: "", en: "" }, prompt, own: true }
}

/**
 * What a scene is sent as: a pack's description as it is (platform data),
 * one the shop wrote behind the server's fixed words (`ownSceneSetting`).
 */
export const settingOf = (scene: ShopScene): string =>
  scene.own ? ownSceneSetting(scene.prompt) : scene.prompt
