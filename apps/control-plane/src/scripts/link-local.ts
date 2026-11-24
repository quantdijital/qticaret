import { existsSync } from "node:fs"
import { join } from "node:path"
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { generateEd25519KeyPair, parseSigningKey, rawPublicKey } from "@qticaret/server-kit"
import { parseEnv } from "../lib/env"
import {
  envTargetProblem,
  linkLocalProblem,
  mergeEnvText,
  parseShopEnv,
  readShopEnv,
  realOrNull,
  shopEnvPath,
  shopEnvProblem,
  writeShopEnv,
} from "../lib/fleet/local-link"
import { tenantApiUrlProblem } from "../lib/fleet/push-target"
import { reissuePlanDocuments } from "../lib/fleet/reissue"
import { layoutOf, repoRoot } from "../lib/provisioning/local/layout"
import { LOCAL_CONTROL_PLANE_URL } from "../lib/provisioning/provider"
import { publishedKeys } from "../lib/vault/signing"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { fleetIn, provisioningIn, tenantsIn } from "../workflows/modules"

/**
 * `pnpm --filter control-plane cp:link-local <slug> [env=<path>] [api=<url>]`:
 * a developer's own shop backend (default `apps/backend/.env`, port 9000)
 * linked to a tenant here, so it runs managed on this machine. Development
 * or test only, against a database on this machine; never a tenant the
 * provisioner has touched, never a provisioned shop's or this control
 * plane's own env file.
 *
 * - writes `CONTROL_PLANE_URL`, `CONTROL_PLANE_PUBLIC_KEYS`, `TENANT_ID`
 *   and `TENANT_SIGNING_KEY` into the shop's env file (a symlink is
 *   followed and its target rewritten, owner-only mode; other lines kept)
 * - the shop's signing key: the one the file holds when it is this
 *   tenant's active key, else a new pair registered first (as `next` when
 *   an active key exists), the file written, then promoted; a failed write
 *   removes the new key. The private half exists only in that file (a
 *   developer's link, no escrow copy)
 * - the tenant's push target (`api_base_url`, default `http://localhost:9000`)
 * - its plan document issued again if its content changed (not pushed: the
 *   shop pulls it within a minute of its restart)
 *
 * Prints key names, key ids and statuses only: never a value.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

const USAGE = "usage: cp:link-local <slug> [env=<path to the shop's .env>] [api=<shop base URL>]"
const DEFAULT_API = "http://localhost:9000"

const option = (args: readonly string[], name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1)

/** The shop's public key of a `TENANT_SIGNING_KEY` value; null when it is not one. */
function publicKeyOf(seed: string | undefined): { kid: string; public_key: string } | null {
  if (!seed) {
    return null
  }
  try {
    const signer = parseSigningKey(seed, "TENANT_SIGNING_KEY")
    return { kid: signer.kid, public_key: rawPublicKey(signer.privateKey).toString("base64url") }
  } catch {
    return null
  }
}

interface SigningKey {
  seed: string
  kid: string
  /** The new key's row, while it waits for the file: removed if the write fails. */
  registered: { id: string; status: string } | null
}

/** The file's key when it is this tenant's active one, else a new pair registered. */
async function signingKeyFor(
  container: MedusaContainer,
  tenantId: string,
  shop: Record<string, string>
): Promise<SigningKey> {
  const fleet = fleetIn(container)
  const held = shop["TENANT_ID"] === tenantId ? shop["TENANT_SIGNING_KEY"] : undefined
  const own = publicKeyOf(held)
  if (held && own) {
    const active = (await fleet.tenantKeys(tenantId)).find((key) => key.status === "active")
    if (active?.kid === own.kid && active.public_key === own.public_key) {
      return { seed: held, kid: own.kid, registered: null }
    }
  }
  const pair = generateEd25519KeyPair()
  const row = await fleet.registerTenantKey({
    tenant_id: tenantId,
    kid: pair.kid,
    public_key: pair.publicKey,
  })
  return { seed: pair.seed, kid: pair.kid, registered: { id: row.id, status: row.status } }
}

/** Every refusal that needs no change made: the env file's path and text, the tenant's history. */
async function shopFile(
  container: MedusaContainer,
  tenantId: string,
  root: string,
  raw: string | undefined
): Promise<{ target: string; text: string } | string> {
  if ((await provisioningIn(container).runsOf(tenantId, 1)).length > 0) {
    return "this tenant has provisioning runs (a provisioned shop); not linked"
  }
  const defaultPath = shopEnvPath(undefined, root)
  const path = shopEnvPath(raw, root, process.env["INIT_CWD"])
  let file: { target: string; text: string }
  try {
    file = await readShopEnv(path)
  } catch {
    return "the shop's env file cannot be read (missing, or not a plain file)"
  }
  const refused = envTargetProblem(file.target, {
    tenantsDir:
      (await realOrNull(join(root, "infra", "tenants"))) ?? join(root, "infra", "tenants"),
    controlPlaneEnv: await realOrNull(join(root, "apps", "control-plane", ".env")),
  })
  const isDefault = path === defaultPath || file.target === (await realOrNull(defaultPath))
  return refused ?? shopEnvProblem(file.text, isDefault) ?? file
}

async function audit(
  container: MedusaContainer,
  tenantId: string,
  action: string,
  changes: object
) {
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action,
    actor_type: "system",
    resource_type: "tenant",
    resource_id: tenantId,
    changes: changes as Record<string, unknown>,
  })
}

export async function runLinkLocal(
  container: MedusaContainer,
  args: readonly string[]
): Promise<number> {
  const env = parseEnv()
  const problem = linkLocalProblem(env)
  if (problem) {
    out(`cp:link-local: runs ${problem}`)
    return 1
  }
  const slug = args[0] ?? ""
  const [tenant] = slug ? await tenantsIn(container).listTenants({ slug }, { take: 1 }) : []
  if (!tenant || slug.includes("=")) {
    out(USAGE)
    return 2
  }
  out(`tenant ${tenant.id} ${tenant.slug} (${tenant.status})`)
  const api = option(args, "api") ?? DEFAULT_API
  const apiRefused = tenantApiUrlProblem(api)
  if (apiRefused) {
    out(`cp:link-local: api=${apiRefused}: a base URL on this machine (port 9000 or 9200-9299)`)
    return 1
  }
  const root = repoRoot()
  if (existsSync(layoutOf(tenant.slug, root).envFile)) {
    out("cp:link-local: this tenant has a local provisioned shop (infra/tenants/local); not linked")
    return 1
  }
  const published = await publishedKeys(container)
  if (published.keys.length === 0) {
    out("cp:link-local: no control plane signing key yet: run cp:keys signing-init first")
    return 1
  }
  const file = await shopFile(container, tenant.id, root, option(args, "env"))
  if (typeof file === "string") {
    out(`cp:link-local: ${file}`)
    return 1
  }
  const signing = await signingKeyFor(container, tenant.id, parseShopEnv(file.text))
  const fleet = fleetIn(container)
  let merged
  try {
    merged = mergeEnvText(file.text, {
      CONTROL_PLANE_URL: new URL(env.CP_LOCAL_CONTROL_PLANE_URL ?? LOCAL_CONTROL_PLANE_URL).origin,
      CONTROL_PLANE_PUBLIC_KEYS: published.env_value,
      TENANT_ID: tenant.id,
      TENANT_SIGNING_KEY: signing.seed,
    })
    if (merged.changes.some((each) => each.change !== "unchanged")) {
      await writeShopEnv(file.target, merged.text)
    }
  } catch (error) {
    if (signing.registered) {
      await fleet.removeTenantKey(signing.registered.id)
    }
    out(`cp:link-local: the shop's env file was not written; a new key was removed`)
    throw error
  }
  for (const { key, change } of merged.changes) {
    out(`${key} ${change}`)
  }
  if (signing.registered?.status === "next") {
    const moved = await fleet.promoteTenantKey(tenant.id)
    out(`signing key ${moved.to} active (previous ${moved.from ?? "-"} retired)`)
  } else {
    out(`signing key ${signing.kid} active${signing.registered ? "" : " (kept)"}`)
  }
  if (tenant.api_base_url === api) {
    out("api_base_url unchanged")
  } else {
    await tenantsIn(container).updateTenants({ id: tenant.id, api_base_url: api })
    await audit(container, tenant.id, "tenant.api_base_url_set", {
      api_base_url: { from: tenant.api_base_url, to: api },
    })
    out(`api_base_url ${tenant.api_base_url ? "updated" : "set"}`)
  }
  const issued = (await reissuePlanDocuments(container, [tenant.id], { push: false })).get(
    tenant.id
  )
  await audit(container, tenant.id, "tenant.local_linked", {
    tenant_key: { to: signing.kid },
    fresh: { to: signing.registered !== null },
  })
  out(
    issued?.id
      ? `plan document serial ${String(issued.serial)} ${issued.issued ? "issued" : "unchanged"}`
      : "cp:link-local: no plan document (no package, or the issue failed: see the log)"
  )
  out("next: restart the shop backend; it pulls the plan document within a minute of boot")
  out(`      (to push it at once afterwards: pnpm --filter control-plane cp:fleet issue ${slug})`)
  return issued?.id ? 0 : 1
}

export default async function linkLocal({ container, args }: ExecArgs) {
  process.exitCode = await runLinkLocal(container, args)
}
