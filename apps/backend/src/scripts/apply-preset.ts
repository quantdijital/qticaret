import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { PACK_CODE, PRESET_CODE } from "@qticaret/sector-packs"
import { tenantResultLine } from "@qticaret/types/control-plane"
import type { ApplyPresetResult } from "@qticaret/types/control-plane"
import { isValidationError } from "../lib/errors"
import { layoutRow } from "../workflows/storefront/layout-row"
import { publishLayoutWorkflow } from "../workflows/storefront/layout"
import { applyPresetWorkflow } from "../workflows/storefront/preset-apply"

export interface PresetArgs {
  pack: string
  preset: string
  demo: boolean
}

const value = (args: readonly string[], name: string): string | undefined =>
  args.find((each) => each.startsWith(`${name}=`))?.slice(name.length + 1)

/** `pack= preset= demo=` from `medusa exec`'s plain arguments; throws without well-formed ones. */
export function presetArgs(args: readonly string[]): PresetArgs {
  const pack = value(args, "pack")
  const preset = value(args, "preset")
  const demo = value(args, "demo") ?? "false"
  if (!pack || !PACK_CODE.test(pack) || !preset || !PRESET_CODE.test(preset)) {
    throw new Error("apply-preset: pack=<code> preset=<code> are required")
  }
  if (demo !== "true" && demo !== "false") {
    throw new Error("apply-preset: demo= is true or false")
  }
  return { pack, preset, demo: demo === "true" }
}

const isUnknown = (error: unknown): boolean =>
  // By its shape: a workflow's error may come back as another instance
  (error as { type?: unknown } | null)?.type === MedusaError.Types.NOT_FOUND ||
  (isValidationError(error) && error.safeMessage === "storefront_preset.pack_not_applied")

/**
 * Usage: pnpm --filter @qticaret/backend tenant:apply-preset pack=<code> preset=<code> [demo=true]
 *
 * The shop's ready-made look (adr/0063 §7), the provisioner's `preset`
 * step after `sector_pack`: written into the design's draft through the
 * panel's workflow. Only a shop that has never published a design (a new
 * shop) gets it published, so it opens with the look; anywhere else it
 * stays in the draft for the owner to preview and publish. Prints one
 * result line (`QT_TENANT_RESULT {...}`); a preset this build does not
 * have, or whose pack the shop was not given, prints `unknown_preset` and
 * exits 1. A preset the shop's schemas refuse throws before writing anything.
 */
export default async function applyPreset({ container, args }: ExecArgs): Promise<void> {
  const { pack, preset, demo } = presetArgs(args)
  const fresh = !(await layoutRow(container))?.published
  let outcome
  try {
    outcome = (
      await applyPresetWorkflow(container).run({
        input: { pack, code: preset, demo, actor: null },
      })
    ).result
  } catch (error) {
    if (!isUnknown(error)) {
      throw error
    }
    const result: ApplyPresetResult = { status: "unknown_preset" }
    process.stdout.write(`${tenantResultLine(result)}\n`)
    process.exitCode = 1
    return
  }
  if (fresh) {
    await publishLayoutWorkflow(container).run({ input: null })
  }
  const result: ApplyPresetResult = {
    status: "applied",
    pack: outcome.pack,
    preset: outcome.preset,
    version: outcome.version,
    skipped: outcome.skipped.length,
    dropped: outcome.dropped.length,
    published: fresh,
  }
  process.stdout.write(`${tenantResultLine(result)}\n`)
}
