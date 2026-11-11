import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { kekStatus } from "../lib/vault/kek-status"
import type { KekStatus } from "../lib/vault/kek-status"
import { publishedKeys } from "../lib/vault/signing"
import { vaultIn } from "../workflows/modules"
import { prepareSigningKeyWorkflow } from "../workflows/vault/signing-keys"
import { rewrapSealedWorkflow } from "../workflows/vault/rewrap"

/**
 * `pnpm --filter control-plane cp:keys <command>` (adr/0061 §4, Ek C8):
 *
 * - `status`: per KEK fingerprint, how many sealed values it holds and
 *   whether it is configured; exits 1 while anything is left under an old
 *   or missing key (a check before removing a key from `CP_MASTER_KEY`)
 * - `rewrap`: moves every sealed value to the current KEK, then `status`
 * - `public-keys`: the `CONTROL_PLANE_PUBLIC_KEYS` line for the shops
 * - `signing-init`: the first signing key, when there is none
 *
 * Prints fingerprints, key ids, public keys and counts only: never a
 * secret. Mutations are recorded as the system's.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

function printStatus(status: KekStatus): void {
  for (const kek of status.keks) {
    out(
      `  ${kek.kek_id}  ${kek.state.padEnd(7)}  secrets=${String(kek.records.secret_record)}` +
        `  tckn=${String(kek.records.tenant_company)}`
    )
  }
  if (status.stranded > 0) {
    out(
      `cp:keys: ${String(status.stranded)} sealed values are under a key missing from ` +
        "CP_MASTER_KEY and cannot be opened: put that key back (after the current one), then rewrap."
    )
  }
  if (status.pending > 0) {
    out(
      `cp:keys: ${String(status.pending)} sealed values wait for a rewrap: do not remove their key yet.`
    )
  }
  for (const kekId of status.removable) {
    out(`cp:keys: ${kekId} holds nothing now and may be removed from CP_MASTER_KEY.`)
  }
}

async function recordSystem(
  container: MedusaContainer,
  action: string,
  resourceType: string,
  changes: Record<string, unknown>
) {
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action,
    actor_type: "system",
    resource_type: resourceType,
    changes,
  })
}

export async function runKeysCommand(container: MedusaContainer, command: string): Promise<number> {
  switch (command) {
    case "status": {
      const status = await kekStatus(container)
      printStatus(status)
      return status.pending + status.stranded > 0 ? 1 : 0
    }
    case "rewrap": {
      const { result } = await rewrapSealedWorkflow(container).run()
      const rewrapped = result.secret_record.rewrapped + result.tenant_company.rewrapped
      const failed = result.secret_record.failed + result.tenant_company.failed
      await recordSystem(container, "cp_kek.rewrapped", "cp_kek", { rewrapped, failed })
      out(`cp:keys: rewrapped ${String(rewrapped)}, failed ${String(failed)}`)
      const status = await kekStatus(container)
      printStatus(status)
      return failed + status.pending + status.stranded > 0 ? 1 : 0
    }
    case "public-keys": {
      const published = await publishedKeys(container)
      for (const key of published.keys) {
        out(`# ${key.kid} ${key.status}`)
      }
      out(`CONTROL_PLANE_PUBLIC_KEYS=${published.env_value}`)
      return published.keys.length > 0 ? 0 : 1
    }
    case "signing-init": {
      if (await vaultIn(container).signingKeyIn("active")) {
        out("cp:keys: a signing key is active already; rotate it from the panel (Anahtarlar)")
        return 0
      }
      const { result } = await prepareSigningKeyWorkflow(container).run()
      await recordSystem(container, "cp_signing_key.prepared", "cp_signing_key", {
        kid: { to: result.kid },
        status: { to: result.status },
      })
      out(`cp:keys: signing key ${result.kid} is ${result.status}`)
      return 0
    }
    default:
      out("usage: cp:keys status | rewrap | public-keys | signing-init")
      return 2
  }
}

export default async function keys({ container, args }: ExecArgs) {
  process.exitCode = await runKeysCommand(container, args[0] ?? "")
}
