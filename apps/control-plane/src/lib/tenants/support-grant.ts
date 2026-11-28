import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  SUPPORT_GRANT_AUDIENCE,
  SUPPORT_GRANT_PURPOSE,
  SUPPORT_GRANT_VERSION,
  SUPPORT_OPERATOR_NAME_MAX,
  supportAccessLink,
  supportGrantDocumentSchema,
} from "@qticaret/types/control-plane"
import type {
  SignedSupportGrant,
  SupportGrantDocument,
  SupportSessionMinutes,
  TenantStatus,
} from "@qticaret/types/control-plane"
import type { DocumentSignature } from "@qticaret/server-kit"
import type { TenantRecord } from "../../modules/tenants/types"
import { fleetIn, provisioningIn, tenantsIn } from "../../workflows/modules"
import { shopPanelOrigin } from "../provisioning/invite-link"
import { provisioner } from "../provisioning/provider"
import { ProvisioningError } from "../provisioning/provisioner"
import type { TenantProvisioner } from "../provisioning/provisioner"
import { signWithActiveKey } from "../vault/signing"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The support grant (adr/0061 Ek "Destek erişimi" 2026-11-28, Karar 7): a
 * signed, single-use permission for one staff member to open a time-limited
 * "Platform desteği" session in one shop's panel. Built and signed here,
 * handed back once in the answer, never stored: only the reason (as a note)
 * and the grant's id (in the audit) stay.
 */

/** A shop being set up has no panel yet; a closing or closed one takes no one in. */
const NO_SUPPORT: readonly TenantStatus[] = ["provisioning", "closing", "closed"]

export interface SupportOperator {
  id: string
  name: string
  role: "owner" | "operator"
}

// Control and invisible format characters out, one line, the contract's bound
const plainName = (value: string): string =>
  value
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUPPORT_OPERATOR_NAME_MAX)
    .trim()

/** The grant's document, checked against the contract; `now` in milliseconds. */
export function buildSupportGrant(input: {
  tenantId: string
  operator: SupportOperator
  reason: string
  minutes: SupportSessionMinutes
  now: number
  grantId?: string
}): SupportGrantDocument {
  const issuedAt = Math.floor(input.now / 1000)
  return supportGrantDocumentSchema.parse({
    version: SUPPORT_GRANT_VERSION,
    audience: SUPPORT_GRANT_AUDIENCE,
    tenant_id: input.tenantId,
    grant_id: input.grantId ?? `sgr_${randomBytes(24).toString("base64url")}`,
    operator: {
      id: input.operator.id,
      name: plainName(input.operator.name) || input.operator.id,
      role: input.operator.role,
    },
    reason: input.reason.trim(),
    issued_at: issuedAt,
    expires_at: issuedAt + input.minutes * 60,
  })
}

/** The grant as the link's fragment carries it: base64url of its JSON. */
export const encodeSupportGrant = (grant: SignedSupportGrant): string =>
  Buffer.from(JSON.stringify(grant), "utf8").toString("base64url")

/** Whether a shop in this status may be entered (409 `cp.support_unavailable` otherwise). */
export const supportAllowed = (status: TenantStatus): boolean => !NO_SUPPORT.includes(status)

/** The provisioner's kind, or a deployed one when none is configured (the domain rule applies). */
function provisionerKind(): TenantProvisioner["kind"] {
  try {
    return provisioner().kind
  } catch {
    return "docker"
  }
}

/** Where the shop's panel is: local, its port + 1000; deployed, its verified domain. */
async function panelOriginOf(container: Container, tenant: TenantRecord): Promise<string> {
  const kind = provisionerKind()
  const port = await provisioningIn(container).portOf(tenant.id)
  if ((kind === "local" || kind === "fake") && port === null) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.support_no_panel")
  }
  try {
    return shopPanelOrigin(
      kind,
      { tenant_id: tenant.id, slug: tenant.slug, port: port ?? 0, public_keys: "" },
      await tenantsIn(container).domainsOf(tenant.id)
    )
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.support_no_panel")
    }
    throw error
  }
}

/** The staff member as the shop's panel names them: their name, else their e-mail. */
export async function operatorName(container: Container, userId: string): Promise<string> {
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ id: userId }, { select: ["first_name", "last_name", "email"], take: 1 })
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  return plainName(name) || plainName(user?.email ?? "") || userId
}

export interface IssuedSupportGrant {
  url: string
  grant_id: string
  expires_at: string
  /**
   * The shop's last usage report counted no staff: its owner has not joined
   * yet, and the shop refuses support until one has (`support.no_owner`,
   * security review H-A). A warning only: the report is up to an hour old.
   */
  owner_pending: boolean
}

/**
 * A grant for `tenant`: refused for a shop with no panel to enter, signed
 * with the control plane's active key, as the link the shop's panel opens.
 */
export async function issueSupportGrant(
  container: Container,
  input: {
    tenant: TenantRecord
    operator: SupportOperator
    reason: string
    minutes: SupportSessionMinutes
    now?: number
    sign?: (document: SupportGrantDocument) => Promise<DocumentSignature>
  }
): Promise<IssuedSupportGrant> {
  if (!supportAllowed(input.tenant.status)) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "cp.support_unavailable")
  }
  const origin = await panelOriginOf(container, input.tenant)
  const document = buildSupportGrant({
    tenantId: input.tenant.id,
    operator: input.operator,
    reason: input.reason,
    minutes: input.minutes,
    now: input.now ?? Date.now(),
  })
  const signature = await (
    input.sign ?? ((doc) => signWithActiveKey(container, SUPPORT_GRANT_PURPOSE, doc))
  )(document)
  const usage = await fleetIn(container).latestUsage(input.tenant.id)
  return {
    url: supportAccessLink(origin, encodeSupportGrant({ document, ...signature })),
    grant_id: document.grant_id,
    expires_at: new Date(document.expires_at * 1000).toISOString(),
    owner_pending: usage !== null && usage.staff === 0,
  }
}
