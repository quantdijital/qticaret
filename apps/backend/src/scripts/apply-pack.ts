import type { ExecArgs } from "@medusajs/framework/types"
import { PACK_CODE, sectorPack } from "@qticaret/sector-packs"
import { tenantResultLine } from "@qticaret/types/control-plane"
import type { ApplyPackResult } from "@qticaret/types/control-plane"
import { applySectorPack } from "../lib/sector-packs/apply"

const ARG = "pack="

/** `pack=<code>` from `medusa exec`'s plain arguments; throws without a well-formed one. */
export function packArg(args: readonly string[]): string {
  const code = args.find((value) => value.startsWith(ARG))?.slice(ARG.length)
  if (!code || !PACK_CODE.test(code)) {
    throw new Error("apply-pack: pack=<code> is required")
  }
  return code
}

/**
 * Usage: pnpm --filter @qticaret/backend tenant:apply-pack pack=<code>
 *
 * The shop's sector pack (adr/0061 F17.7, C12), one of the provisioner's
 * closed list of commands (§3.4): at setup, and again from the control
 * plane's "Paketi yeniden uygula" on a shop already running. Adds what the
 * shop never had and nothing else. Prints one result line
 * (`QT_TENANT_RESULT {...}`); a pack this build does not have prints
 * `unknown_pack` and exits 1, as does a pack the shop's schemas refuse
 * (it throws, naming the problems, before writing anything).
 */
export default async function applyPack({ container, args }: ExecArgs): Promise<void> {
  const pack = sectorPack(packArg(args))
  if (!pack) {
    const result: ApplyPackResult = { status: "unknown_pack" }
    process.stdout.write(`${tenantResultLine(result)}\n`)
    process.exitCode = 1
    return
  }
  const outcome = await applySectorPack(container, pack)
  const result: ApplyPackResult = { status: "applied", ...outcome }
  process.stdout.write(`${tenantResultLine(result)}\n`)
}
