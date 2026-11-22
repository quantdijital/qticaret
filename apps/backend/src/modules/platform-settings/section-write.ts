import type { Context } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { lockSection } from "./section-lock"
import { mergePatch, sectionOf } from "./sections"
import { parseStored, toValidationError } from "./sections/stored"
import type { SectionName } from "./sections"
import type { PlatformFlagStore } from "./service-platform-flags"
import type { SectionChange, SectionValues, StoredSection } from "./types"

/** The generated settings-section methods a write needs (the module service). */
export type SectionRowStore = Pick<
  PlatformFlagStore,
  | "listSettingsSections"
  | "createSettingsSections"
  | "updateSettingsSections"
  | "deleteSettingsSections"
>

/**
 * A section save's body: takes the section's lock, merges `patch` over the
 * latest row, checks it and writes it (version + 1). Runs inside the
 * service's transaction (`saveSectionInTransaction_`, service.ts).
 */
export async function writeSection(
  store: SectionRowStore,
  sharedContext: Context,
  name: SectionName,
  patch: SectionValues,
  actorId: string | null
): Promise<SectionChange> {
  const section = sectionOf(name)
  // Another save of this section waits here: the merge below is over the latest row
  await lockSection(sharedContext, name)
  const [row] = await store.listSettingsSections({ section: name }, { take: 1 }, sharedContext)
  const before = parseStored(name, row?.values)
  let after: SectionValues
  try {
    const merged = section.merge ? section.merge(before, patch) : mergePatch(before, patch)
    after = section.full.parse(merged)
  } catch (error) {
    throw toValidationError(error)
  }
  const issue = section.saveIssue?.(after, before)
  if (issue) {
    throw new ValidationError(issue.message, { field: issue.path.join(".") })
  }
  if (row) {
    await store.updateSettingsSections(
      { id: row.id, values: after, version: row.version + 1, updated_by: actorId },
      sharedContext
    )
  } else {
    await store.createSettingsSections(
      { section: name, values: after, updated_by: actorId },
      sharedContext
    )
  }
  return {
    before,
    after,
    previous: row ? { values: row.values, version: row.version } : null,
    // A new row starts at the model's default, 1
    version: row ? row.version + 1 : 1,
  }
}

/**
 * A restore's body (workflow compensation): under the section's lock, puts
 * `previous` back only while the row still holds `savedVersion`; a save
 * that came in between is kept. Runs inside the service's transaction
 * (`restoreSectionInTransaction_`, service.ts).
 */
export async function restoreStoredSection(
  store: SectionRowStore,
  sharedContext: Context,
  name: SectionName,
  previous: StoredSection | null,
  savedVersion: number
): Promise<void> {
  await lockSection(sharedContext, name)
  const [row] = await store.listSettingsSections({ section: name }, { take: 1 }, sharedContext)
  if (row?.version !== savedVersion) {
    logger.warn({
      event: "platform_settings.restore_skipped",
      section: name,
      savedVersion,
      storedVersion: row?.version ?? null,
    })
    return
  }
  if (previous === null) {
    await store.deleteSettingsSections(row.id, sharedContext)
    return
  }
  await store.updateSettingsSections(
    { id: row.id, values: previous.values, version: row.version + 1 },
    sharedContext
  )
}
