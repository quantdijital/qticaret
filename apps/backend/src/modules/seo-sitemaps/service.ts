import type { Context, InferTypeOf } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { SitemapFile } from "./models/sitemap-file"
import { SitemapState } from "./models/sitemap-state"

export type SitemapFileRecord = InferTypeOf<typeof SitemapFile>
export type SitemapStateRecord = InferTypeOf<typeof SitemapState>

const STATE_KEY = "main"

/** Sitemap files and their refresh state (docs/13 §6). */
class SeoSitemapsModuleService extends MedusaService({ SitemapFile, SitemapState }) {
  @InjectManager()
  async currentState(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SitemapStateRecord | null> {
    const [state] = await this.listSitemapStates({ key: STATE_KEY }, { take: 1 }, sharedContext)
    return state ?? null
  }

  /** A page changed: the sitemap waits for a refresh, since now unless it already did. */
  async markDirty(): Promise<void> {
    const state = await this.currentState()
    if (state?.dirty_since) {
      return
    }
    try {
      if (state) {
        await this.updateSitemapStates({ id: state.id, dirty_since: new Date() })
      } else {
        await this.createSitemapStates({ key: STATE_KEY, dirty_since: new Date() })
      }
    } catch (error) {
      // Another process marked it at the same moment: marked either way
      if (!uniqueViolationKeys(error)?.includes("key")) {
        throw error
      }
    }
  }

  /**
   * Swaps every file for the new set at once, and clears the mark unless
   * a change came after `startedAt` (it waits for the next run).
   */
  @InjectTransactionManager()
  async replaceFiles(
    files: { name: string; content: string; url_count: number }[],
    startedAt: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const old = await this.listSitemapFiles({}, { select: ["id"] }, sharedContext)
    if (old.length > 0) {
      await this.deleteSitemapFiles(
        old.map(({ id }) => id),
        sharedContext
      )
    }
    const generatedAt = new Date()
    if (files.length > 0) {
      await this.createSitemapFiles(
        files.map((file) => ({ ...file, generated_at: generatedAt })),
        sharedContext
      )
    }
    const [state] = await this.listSitemapStates({ key: STATE_KEY }, { take: 1 }, sharedContext)
    const settled = !state?.dirty_since || state.dirty_since <= startedAt
    if (state) {
      await this.updateSitemapStates(
        { id: state.id, generated_at: generatedAt, ...(settled ? { dirty_since: null } : {}) },
        sharedContext
      )
    } else {
      await this.createSitemapStates({ key: STATE_KEY, generated_at: generatedAt }, sharedContext)
    }
  }
}

export default SeoSitemapsModuleService
