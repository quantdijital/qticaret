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
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"

/**
 * The scenes a product photo can be set in (Aşama 7, docs/22): data of the
 * shop's sector packs (`packages/sector-packs/packs/<code>/scenes.json`),
 * never code. The first pack applied here that has scenes gives them; a
 * shop with none falls back to the general pack's two neutral ones. At
 * most two either way. A scene's code is the only thing a request names;
 * its prompt is read here, on the server, and is never taken from a client.
 */

export type AiScene = SceneData

/** The pack every shop has: its scenes are the neutral fallback. */
export const SCENE_FALLBACK_PACK = "general"

/**
 * A pack's scenes; one its loader refuses has none (logged by its code,
 * never its content). The packs are read together and once: one refused
 * fails the read of all, so each is then read on its own (as the preset
 * gallery does, `api/admin/storefront-presets/read.ts`).
 */
export function packScenes(code: string, dir: string = DEFAULT_PACKS_DIR): readonly AiScene[] {
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

/** This shop's scenes, read from the packs applied here. */
export async function shopScenes(
  container: Pick<MedusaContainer, "resolve">
): Promise<readonly AiScene[]> {
  const applied = await container
    .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
    .listSectorPackApplications(
      {},
      { select: ["pack", "applied_at"], order: { applied_at: "ASC" }, take: null }
    )
  return scenesOfPacks(applied.map((row) => row.pack))
}

/** The scene of this code among the shop's, or null: the allow-list a request is held to. */
export async function shopSceneOf(
  container: Pick<MedusaContainer, "resolve">,
  code: string
): Promise<AiScene | null> {
  return (await shopScenes(container)).find((scene) => scene.code === code) ?? null
}
