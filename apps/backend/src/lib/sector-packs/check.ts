import type { SectorPack } from "@qticaret/sector-packs"
import { AdminPostAttributeTemplate } from "../../api/admin/attribute-templates/validators"
import type { AdminPostAttributeTemplateType } from "../../api/admin/attribute-templates/validators"
import { featureRegistry } from "../../modules/platform-settings/features"
import { mergePatch } from "../../modules/platform-settings/sections/define"
import { seoSection } from "../../modules/platform-settings/sections/seo"
import { duplicateKeys, strayGroups } from "../../modules/product-attributes/validation"
import { isCleanText } from "../security/text"

/**
 * A sector pack checked with this shop's own rules (adr/0061 C12): every
 * attribute template as the panel's save takes it (`AdminPostAttributeTemplate`,
 * strict, with the create step's key and section checks), every flag as
 * one of the registry's shop-owned flags (adr/0012 `owner: tenant`; a
 * platform flag is the control plane's, never a pack's), every SEO
 * template as the settings section takes it (strict, tokens checked).
 * The pack package checks only the frame; this is what decides.
 */

export type PackTemplate = AdminPostAttributeTemplateType

export interface CheckedPack extends Omit<SectorPack, "attribute_templates"> {
  attribute_templates: PackTemplate[]
}

export class SectorPackInvalidError extends Error {
  constructor(
    readonly code: string,
    readonly problems: string[]
  ) {
    super(`sector pack ${code}: ${problems.join("; ")}`)
    this.name = "SectorPackInvalidError"
  }
}

const issueText = (path: readonly PropertyKey[], message: string) =>
  `${path.map(String).join(".")}: ${message}`

function templateProblems(pack: SectorPack, out: PackTemplate[]): string[] {
  const problems: string[] = []
  for (const raw of pack.attribute_templates) {
    const parsed = AdminPostAttributeTemplate.safeParse(raw)
    if (!parsed.success) {
      problems.push(
        ...parsed.error.issues.map(
          (issue) => `template ${raw.handle} ${issueText(issue.path, issue.message)}`
        )
      )
      continue
    }
    const template = parsed.data
    for (const key of duplicateKeys(template.definitions)) {
      problems.push(`template ${template.handle} definitions: ${key} twice`)
    }
    for (const group of strayGroups(template.definitions, template.groups ?? [])) {
      problems.push(`template ${template.handle} definitions: section ${group} unknown`)
    }
    out.push(template)
  }
  return problems
}

function flagProblems(pack: SectorPack, env: NodeJS.ProcessEnv): string[] {
  const registry = featureRegistry(env)
  return pack.flags.flatMap((preset) => {
    const definition = Object.hasOwn(registry, preset.key) ? registry[preset.key] : undefined
    if (!definition) {
      return [`flag ${preset.key}: unknown`]
    }
    if (definition.owner !== "tenant") {
      return [`flag ${preset.key}: owned by the platform`]
    }
    // A preset that is the default says nothing
    return preset.enabled === definition.default ? [`flag ${preset.key}: is the default`] : []
  })
}

function seoProblems(pack: SectorPack): string[] {
  const patch = seoSection.patch.safeParse(pack.seo)
  if (!patch.success) {
    return patch.error.issues.map((issue) => `seo ${issueText(issue.path, issue.message)}`)
  }
  const full = seoSection.full.safeParse(mergePatch(seoSection.defaults, pack.seo))
  return full.success
    ? []
    : full.error.issues.map((issue) => `seo ${issueText(issue.path, issue.message)}`)
}

function categoryProblems(pack: SectorPack): string[] {
  return pack.categories.flatMap((category) =>
    isCleanText(category.name) && (!category.description || isCleanText(category.description))
      ? []
      : [`category ${category.handle}: text_invalid`]
  )
}

/** Everything wrong with `pack` here; none for a pack this shop can apply. */
export function packProblems(pack: SectorPack, env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    ...templateProblems(pack, []),
    ...flagProblems(pack, env),
    ...seoProblems(pack),
    ...categoryProblems(pack),
  ]
}

/** The pack with its templates as this shop reads them; throws naming every problem. */
export function checkedPack(pack: SectorPack, env: NodeJS.ProcessEnv = process.env): CheckedPack {
  const templates: PackTemplate[] = []
  const problems = [
    ...templateProblems(pack, templates),
    ...flagProblems(pack, env),
    ...seoProblems(pack),
    ...categoryProblems(pack),
  ]
  if (problems.length > 0) {
    throw new SectorPackInvalidError(pack.code, problems)
  }
  return { ...pack, attribute_templates: templates }
}
