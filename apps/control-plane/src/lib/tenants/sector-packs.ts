/**
 * The sector packs a new shop can be set up with (adr/0061 §8 F17.7). The
 * packs themselves are C12's (`packages/sector-packs/<code>/`); until then
 * only the general one exists, and it changes nothing (the setup's
 * `sector_pack` step is skipped). The choice is kept on the tenant so the
 * setup applies it once C12 lands. Code never branches on a pack's name.
 */
export const SECTOR_PACKS = ["general"] as const
export type SectorPack = (typeof SECTOR_PACKS)[number]
