import { parseAgeRecipients } from "@qticaret/server-kit/escrow"
import { parseEnv } from "../env"
import { FakeProvisioner } from "./fake-provisioner"
import { LocalProvisioner } from "./local/local-provisioner"
import { ProvisioningError } from "./provisioner"
import type { TenantProvisioner } from "./provisioner"

/** Where a local shop reaches the control plane (adr/0061 §6.3: this machine's port 9100). */
export const LOCAL_CONTROL_PLANE_URL = "http://localhost:9100"

let held: { key: string; provisioner: TenantProvisioner } | undefined

/**
 * The provisioner `CP_PROVISIONER` names (Ek C10); its own checks run when
 * it is made (local: development and a Postgres here only; fake: tests
 * only). None configured: `cp.provisioner_unavailable`.
 */
export function provisioner(): TenantProvisioner {
  const env = parseEnv()
  const key = [
    env.CP_PROVISIONER,
    env.NODE_ENV,
    env.CP_LOCAL_PG_ADMIN_URL,
    env.REDIS_URL,
    env.MAILPIT_URL,
    env.CP_LOCAL_CONTROL_PLANE_URL,
    env.CP_LOCAL_PG_EXEC,
    env.CP_ESCROW_RECIPIENTS,
  ].join("|")
  if (held?.key === key) {
    return held.provisioner
  }
  let made: TenantProvisioner
  switch (env.CP_PROVISIONER) {
    case "local":
      made = new LocalProvisioner({
        nodeEnv: env.NODE_ENV,
        adminUrl: env.CP_LOCAL_PG_ADMIN_URL ?? "",
        redisUrl: env.REDIS_URL ?? null,
        mailpitUrl: env.EMAIL_TRANSPORT === "mailpit" ? (env.MAILPIT_URL ?? null) : null,
        controlPlaneUrl: new URL(env.CP_LOCAL_CONTROL_PLANE_URL ?? LOCAL_CONTROL_PLANE_URL).origin,
        // Audit 3.2: backups go to the same offline keys as the escrow
        backupRecipients: parseAgeRecipients(env.CP_ESCROW_RECIPIENTS, "CP_ESCROW_RECIPIENTS"),
        pgExec: env.CP_LOCAL_PG_EXEC ?? null,
      })
      break
    case "fake":
      made = new FakeProvisioner(env.NODE_ENV)
      break
    case "docker":
    case undefined:
      throw new ProvisioningError("cp.provisioner_unavailable")
  }
  held = { key, provisioner: made }
  return made
}
