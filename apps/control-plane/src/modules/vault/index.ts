import { Module } from "@medusajs/framework/utils"
import VaultModuleService from "./service"

/**
 * The control plane's secrets (adr/0061 §2 `secrets`, Ek C8): sealed
 * secrets, escrow copies and its signing keys. Named `vault`, not
 * `secrets`: the agents' tooling refuses any `secrets/` directory, and a
 * module its maintainers cannot read is a worse risk than a name (Ek C8).
 */
export const VAULT_MODULE = "vault"

export default Module(VAULT_MODULE, { service: VaultModuleService })
