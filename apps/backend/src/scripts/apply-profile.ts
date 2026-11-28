import type { ExecArgs } from "@medusajs/framework/types"
import { tenantResultLine } from "@qticaret/types/control-plane"
import type { ApplyProfileResult } from "@qticaret/types/control-plane"
import { readInput } from "./plan-import"
import { fillProfile, parseProfile } from "./tenant-profile/fill"

// A profile is a few short fields
const MAX_BYTES = 8 * 1024

/**
 * Usage: pnpm --filter @qticaret/backend tenant:apply-profile < profile.json
 *
 * The shop's details the control plane's wizard took (company title, tax
 * office, VKN, address, contact e-mail and phone; never a TCKN), from
 * stdin so they are on no command line, into the shop's settings: only
 * the fields the shop has nothing in. Prints one result line with counts
 * only (`QT_TENANT_RESULT {...}`); nothing of the values is printed or
 * logged. A body that is not a profile exits 1 and changes nothing.
 */
export default async function applyProfile({ container }: ExecArgs): Promise<void> {
  const profile = parseProfile(await readInput(process.stdin, MAX_BYTES))
  if (!profile) {
    const refused: ApplyProfileResult = { status: "refused" }
    process.stdout.write(`${tenantResultLine(refused)}\n`)
    process.exitCode = 1
    return
  }
  let result: ApplyProfileResult
  try {
    result = await fillProfile(container, profile)
  } catch {
    // Only a fixed code: nothing of the error (or the values) reaches the command's log
    process.stdout.write(`${tenantResultLine({ status: "refused" })}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`${tenantResultLine(result)}\n`)
}
