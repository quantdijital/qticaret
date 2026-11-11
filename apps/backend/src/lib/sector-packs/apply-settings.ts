import { packItemKey } from "@qticaret/sector-packs"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { seoSection } from "../../modules/platform-settings/sections/seo"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { setFeatureFlagWorkflow } from "../../workflows/platform-settings/set-feature-flag"
import { updatePlatformSettingsWorkflow } from "../../workflows/platform-settings/update-platform-settings"
import type { ApplyContext } from "./context"

const settingsOf = (context: ApplyContext) =>
  context.container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

/**
 * The pack's flag presets (adr/0012, shop-owned flags only; the check
 * refused any other). A flag the shop has chosen (it has an override) is
 * kept; one at its default takes the preset, as the panel's switch sets it.
 */
export async function applyFlags(context: ApplyContext): Promise<void> {
  const settings = settingsOf(context)
  for (const preset of context.pack.flags) {
    const key = packItemKey.flag(preset.key)
    if (context.offered.has(key)) {
      continue
    }
    const chosen = await settings.listFeatureOverrides({ key: preset.key }, { take: 1 })
    if (chosen.length === 0) {
      await setFeatureFlagWorkflow(context.container).run({
        input: { key: preset.key, enabled: preset.enabled, actor_id: null },
      })
    }
    await context.record({
      key,
      kind: "flag",
      outcome: chosen.length === 0 ? "added" : "kept",
      record_id: null,
    })
  }
}

type Templates = Record<string, string>
type Group = "title_templates" | "description_templates"
const GROUPS: readonly Group[] = ["title_templates", "description_templates"]

const field = (values: unknown, group: Group, entity: string): string | undefined => {
  const templates = (values as Partial<Record<Group, Templates>> | null)?.[group]
  return templates && Object.hasOwn(templates, entity) ? templates[entity] : undefined
}

/**
 * The pack's SEO templates (docs/13 §3), saved through the settings
 * workflow (its schema checks the tokens again; cached page answers are
 * forgotten). A template the shop has changed from the platform's default
 * is kept: only one still at the default takes the pack's.
 */
export async function applySeoTemplates(context: ApplyContext): Promise<void> {
  const pending = GROUPS.flatMap((group) =>
    Object.entries(context.pack.seo[group] ?? {})
      .map(([entity, text]) => ({ group, entity, text, key: packItemKey.seo(group, entity) }))
      .filter((item) => !context.offered.has(item.key))
  )
  if (pending.length === 0) {
    return
  }
  const { values } = await settingsOf(context).readSection("seo")
  const patch: Partial<Record<Group, Templates>> = {}
  const outcomes = pending.map((item) => {
    const current = field(values, item.group, item.entity)
    const untouched = current === field(seoSection.defaults, item.group, item.entity)
    if (untouched && current !== item.text) {
      patch[item.group] = { ...patch[item.group], [item.entity]: item.text }
      return { ...item, outcome: "added" as const }
    }
    return { ...item, outcome: "kept" as const }
  })
  if (Object.keys(patch).length > 0) {
    await updatePlatformSettingsWorkflow(context.container).run({
      input: { section: "seo", values: patch, actor_id: null },
    })
  }
  for (const item of outcomes) {
    await context.record({
      key: item.key,
      kind: "seo_template",
      outcome: item.outcome,
      record_id: null,
    })
  }
}
