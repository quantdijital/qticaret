import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import type {
  CredentialKeyStatus,
  default as IntegrationCredentialsModuleService,
} from "../modules/integration-credentials/service"
import { rewrapCredentialsWorkflow } from "../workflows/integration-credentials/rewrap-credentials"

/**
 * `pnpm --filter @qticaret/backend credentials:keys <command>` (adr/0061
 * Ek C17, the rotation runbook in docs/08):
 *
 * - `status`: per key fingerprint, how many provider accounts it holds and
 *   in which state; exits 1 while anything is left under an older, an
 *   old-format or a missing key (the check before removing a key from
 *   `CREDENTIALS_ENCRYPTION_KEYS`)
 * - `rewrap`: moves every account to the current key, then `status`
 *
 * Prints fingerprints and counts only: never a key, never a secret.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

export function statusLines(status: CredentialKeyStatus): string[] {
  if (!status.configured) {
    return [
      "credentials:keys: no key is configured (CREDENTIALS_ENCRYPTION_KEYS or CREDENTIALS_ENCRYPTION_KEY)",
    ]
  }
  const lines = status.keys.map(
    (key) => `  ${key.kek_id}  ${key.state.padEnd(7)}  accounts=${String(key.records)}`
  )
  if (status.stranded > 0) {
    lines.push(
      `credentials:keys: ${String(status.stranded)} accounts are under a key missing from ` +
        "CREDENTIALS_ENCRYPTION_KEYS and cannot be opened: put that key back (after the current one), then rewrap."
    )
  }
  if (status.pending > 0) {
    lines.push(
      `credentials:keys: ${String(status.pending)} accounts wait for a rewrap: do not remove their key yet.`
    )
  }
  for (const kekId of status.removable) {
    lines.push(
      `credentials:keys: ${kekId} holds nothing: it may be removed from CREDENTIALS_ENCRYPTION_KEYS ` +
        "(unless it is a new key still being rolled out behind the current one)."
    )
  }
  return lines
}

export async function runCredentialKeysCommand(
  container: MedusaContainer,
  command: string
): Promise<number> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  switch (command) {
    case "status": {
      const status = await credentials.keyStatus()
      statusLines(status).forEach(out)
      return !status.configured || status.pending + status.stranded > 0 ? 1 : 0
    }
    case "rewrap": {
      const { result } = await rewrapCredentialsWorkflow(container).run({ input: {} })
      out(
        `credentials:keys: rewrapped ${String(result.rewrapped)}, upgraded ${String(result.upgraded)}, ` +
          `failed ${String(result.failed)}, stranded ${String(result.stranded)}`
      )
      if (result.failed_providers.length > 0) {
        out(`credentials:keys: left as they are: ${result.failed_providers.join(", ")}`)
      }
      const status = await credentials.keyStatus()
      statusLines(status).forEach(out)
      return !status.configured || result.failed + status.pending + status.stranded > 0 ? 1 : 0
    }
    default:
      out("usage: credentials:keys status | rewrap")
      return 2
  }
}

export default async function credentialKeys({ container, args }: ExecArgs) {
  process.exitCode = await runCredentialKeysCommand(container, args[0] ?? "")
}
