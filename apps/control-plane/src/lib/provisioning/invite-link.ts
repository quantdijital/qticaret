import { INVITE_TOKEN } from "@qticaret/types/control-plane"
import type { DomainRecord } from "../../modules/tenants/types"
import { ProvisioningError } from "./provisioner"
import type { ProvisionTarget, TenantProvisioner } from "./provisioner"

/**
 * The owner's invitation link, built here (Ek C10, review M1 and I1): the
 * shop hands over only its invitation's token; where the link points comes
 * from what the control plane already knows of the shop, never from the
 * shop's output.
 *
 * - local (and the tests' fake): the shop's own panel on this machine, on
 *   its backend port + 1000 (`PANEL_PORT=<port + 1000>
 *   PANEL_BACKEND_URL=http://localhost:<port> pnpm --filter panel dev`); the
 *   development panel on 5173 talks to the main shop and could not accept it
 * - deployed: the shop's primary verified domain, else its platform
 *   subdomain, over https (the panel shares the shop's host, adr/0022)
 */

export const LOCAL_PANEL_OFFSET = 1000

export function shopPanelOrigin(
  kind: TenantProvisioner["kind"],
  target: ProvisionTarget,
  domains: readonly Pick<DomainRecord, "hostname" | "kind" | "verification" | "is_primary">[]
): string {
  if (kind === "local" || kind === "fake") {
    return `http://localhost:${String(target.port + LOCAL_PANEL_OFFSET)}`
  }
  const verified = domains.filter((domain) => domain.verification === "verified")
  const host =
    verified.find((domain) => domain.is_primary)?.hostname ??
    verified.find((domain) => domain.kind === "platform_subdomain")?.hostname
  if (!host) {
    throw new ProvisioningError("provisioning.no_panel_host")
  }
  return `https://${host}`
}

/** `<origin>/invite#token=…`, the panel's own page; a token of any other shape is refused. */
export function ownerInviteLink(origin: string, token: string): string {
  if (token.length < 16 || token.length > 2048 || !INVITE_TOKEN.test(token)) {
    throw new ProvisioningError("provisioning.invite_token_invalid")
  }
  // The token after `#`: no server's access log keeps it (the shop's `inviteLink`)
  return `${origin}/invite#${new URLSearchParams({ token }).toString()}`
}
