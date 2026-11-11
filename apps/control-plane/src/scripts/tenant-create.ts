import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { parseEnv } from "../lib/env"
import { followRun } from "../lib/provisioning/progress"
import { ProvisioningError } from "../lib/provisioning/provisioner"
import { startRun } from "../lib/provisioning/runs"
import { platformHostname } from "../lib/tenants/hostname"
import { slugProblem } from "../lib/tenants/slug"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { plansIn, tenantsIn } from "../workflows/modules"
import { saveContactWorkflow } from "../workflows/tenants/tenant-contacts"
import { createTenantWorkflow } from "../workflows/tenants/create-tenant"
import { RUN_STEPS } from "../workflows/provisioning/workflows"

/**
 * `NODE_ENV=development pnpm --filter control-plane cp:tenant-create
 * slug=<slug> name=<name> owner-email=<address> [package=<code>]
 * [owner-name=<name>] [fail-at=<step>]` (adr/0061 §6.4, Ek C10).
 *
 * The same workflow as the panel: the shop's record (when there is none
 * with that slug), its owner contact (when it has none), then a `create`
 * run, followed step by step. Running it again changes nothing: every
 * step skips what is there. `fail-at=` (development only) makes that step
 * fail first, to watch the compensation undo the rest.
 *
 * Prints step names, statuses, codes and outputs: no secret, no link.
 */

const out = (line: string) => process.stdout.write(`${line}\n`)

const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]+$/u
const ArgsSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  name: z.string().trim().min(1).max(100).regex(CLEAN),
  "owner-email": z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  "owner-name": z.string().trim().min(1).max(100).regex(CLEAN).optional(),
  package: z.string().trim().min(1).max(64).optional(),
  "fail-at": z.enum(RUN_STEPS.create).optional(),
})

export function parseArgs(args: readonly string[]) {
  const pairs = Object.fromEntries(
    args.flatMap((arg) => {
      const at = arg.indexOf("=")
      return at > 0 ? [[arg.slice(0, at), arg.slice(at + 1)]] : []
    })
  )
  const parsed = ArgsSchema.safeParse(pairs)
  if (!parsed.success || slugProblem(parsed.data.slug)) {
    return null
  }
  return parsed.data
}

async function packageIdOf(container: MedusaContainer, code: string | undefined) {
  if (!code) {
    return null
  }
  const found = (await plansIn(container).packages({ archived: false })).find(
    (each) => each.code === code
  )
  if (!found) {
    throw new ProvisioningError("cp.package_unknown")
  }
  return found.id
}

const audit = (
  container: MedusaContainer,
  action: string,
  id: string,
  changes: Record<string, unknown>
) =>
  container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action,
    actor_type: "system",
    resource_type: "tenant",
    resource_id: id,
    changes,
  })

type Input = NonNullable<ReturnType<typeof parseArgs>>

/** The shop's record by its slug, made when there is none: its id. */
async function ensureRecord(container: MedusaContainer, input: Input): Promise<string> {
  const [found] = await tenantsIn(container).listTenants({ slug: input.slug }, { take: 1 })
  if (found) {
    out(`tenant ${found.id} ${found.slug} exists (${found.status})`)
    return found.id
  }
  const { result } = await createTenantWorkflow(container).run({
    input: {
      slug: input.slug,
      name: input.name,
      hostname: platformHostname(input.slug, parseEnv().PLATFORM_DOMAIN),
      created_by: null,
      package_id: await packageIdOf(container, input.package),
    },
  })
  await audit(container, "tenant.created", result.id, { slug: { to: result.slug } })
  out(`tenant ${result.id} ${result.slug} made (${result.status})`)
  return result.id
}

export default async function tenantCreate({ container, args }: ExecArgs) {
  const input = parseArgs(args)
  if (!input) {
    out(
      "usage: cp:tenant-create slug=<slug> name=<name> owner-email=<address> [package=<code>] [owner-name=<name>] [fail-at=<step>]"
    )
    process.exitCode = 2
    return
  }
  const tenantId = await ensureRecord(container, input)
  const contacts = await tenantsIn(container).contactsOf(tenantId)
  if (!contacts.some((contact) => contact.role === "owner")) {
    await saveContactWorkflow(container).run({
      input: {
        tenant_id: tenantId,
        contact_id: null,
        fields: {
          name: input["owner-name"] ?? input["owner-email"].split("@")[0] ?? "owner",
          role: "owner",
          email: input["owner-email"],
          phone: null,
        },
      },
    })
    out("owner contact added")
  } else {
    out("owner contact exists (kept as it is)")
  }
  const started = await startRun(container, {
    tenant_id: tenantId,
    kind: "create",
    requested_by: null,
    fail_at: input["fail-at"] ?? null,
  })
  await audit(container, "tenant.provisioning_create", tenantId, { run: { to: started.run.id } })
  const done = await followRun(container, started)
  process.exitCode = done.status === "succeeded" ? 0 : 1
}
