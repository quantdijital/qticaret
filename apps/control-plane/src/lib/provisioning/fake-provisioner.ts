import { randomBytes } from "node:crypto"
import type { RuntimeSecrets } from "../vault/tenant-secrets"
import { ProvisioningError } from "./provisioner"
import type {
  CommandResult,
  HealthResult,
  ProvisionTarget,
  TenantCommand,
  TenantProvisioner,
} from "./provisioner"

/**
 * The tests' provisioner (Ek C10, `CP_PROVISIONER=fake`, `NODE_ENV=test`
 * only): the shops' databases, stores and processes as a record in this
 * process, so the HTTP tests run the real workflow without spawning
 * shops. Its state hangs on `globalThis`, which the test file and the
 * server it starts share whatever module registry loaded each.
 */

export interface FakeShop {
  database: boolean
  /** The values written, kept so a test can look for them where they must not be. */
  secrets: RuntimeSecrets["values"] | null
  running: boolean
  healthy: boolean
  /** Owner invitations handed out (their tokens), plan documents imported (their serials). */
  invites: string[]
  imported: number[]
}

export interface FakeState {
  shops: Map<string, FakeShop>
  /** Fails the first call that matches (a method, or `runTenantCommand:<command>`). */
  failOn: string | null
  calls: string[]
}

const KEY = Symbol.for("qticaret.control-plane.fake-provisioner")

export function fakeState(): FakeState {
  const holder = globalThis as unknown as Record<symbol, FakeState | undefined>
  holder[KEY] ??= { shops: new Map(), failOn: null, calls: [] }
  return holder[KEY]
}

const ok = (result: unknown = null): CommandResult => ({
  ok: true,
  exit_code: 0,
  timed_out: false,
  duration_ms: 1,
  result,
})

export class FakeProvisioner implements TenantProvisioner {
  readonly kind = "fake" as const

  constructor(nodeEnv: string | undefined) {
    if (nodeEnv !== "test") {
      throw new ProvisioningError("provisioning.fake_tests_only")
    }
  }

  private shop(t: ProvisionTarget): FakeShop {
    const shops = fakeState().shops
    let shop = shops.get(t.tenant_id)
    if (!shop) {
      shop = {
        database: false,
        secrets: null,
        running: false,
        healthy: false,
        invites: [],
        imported: [],
      }
      shops.set(t.tenant_id, shop)
    }
    return shop
  }

  private call(name: string): void {
    const state = fakeState()
    state.calls.push(name)
    if (state.failOn === name) {
      state.failOn = null
      throw new ProvisioningError("provisioning.fake_failure")
    }
  }

  async ensureDatabase(t: ProvisionTarget) {
    this.call("ensureDatabase")
    const shop = this.shop(t)
    if (!shop.secrets) {
      throw new ProvisioningError("provisioning.secrets_missing")
    }
    const created = !shop.database
    shop.database = true
    return await Promise.resolve({ created })
  }

  async dropDatabase(t: ProvisionTarget) {
    this.call("dropDatabase")
    this.shop(t).database = false
    await Promise.resolve()
  }

  async writeRuntimeSecrets(t: ProvisionTarget, secrets: RuntimeSecrets) {
    this.call("writeRuntimeSecrets")
    this.shop(t).secrets = { ...secrets.values }
    await Promise.resolve()
  }

  async removeRuntimeSecrets(t: ProvisionTarget) {
    this.call("removeRuntimeSecrets")
    this.shop(t).secrets = null
    await Promise.resolve()
  }

  async runTenantCommand(t: ProvisionTarget, cmd: TenantCommand): Promise<CommandResult> {
    this.call(`runTenantCommand:${cmd.name}`)
    const shop = this.shop(t)
    if (!shop.database) {
      throw new ProvisioningError("provisioning.fake_no_database")
    }
    switch (cmd.name) {
      case "invite-owner": {
        const token = randomBytes(24).toString("base64url")
        shop.invites.push(token)
        return await Promise.resolve(ok({ status: "invited", token }))
      }
      case "plan-import": {
        const serial = (JSON.parse(cmd.document) as { document: { serial: number } }).document
          .serial
        const status = shop.imported.includes(serial) ? "same" : "applied"
        shop.imported.push(serial)
        return await Promise.resolve(ok({ status, serial }))
      }
      case "apply-pack":
        throw new ProvisioningError("provisioning.command_unavailable")
      case "migrate":
      case "bootstrap":
        return await Promise.resolve(ok())
    }
  }

  async start(t: ProvisionTarget) {
    this.call("start")
    const shop = this.shop(t)
    shop.running = true
    shop.healthy = true
    await Promise.resolve()
  }

  async stop(t: ProvisionTarget) {
    this.call("stop")
    const shop = this.shop(t)
    shop.running = false
    shop.healthy = false
    await Promise.resolve()
  }

  async probe(t: ProvisionTarget): Promise<HealthResult> {
    this.call("probe")
    const shop = this.shop(t)
    return await Promise.resolve({
      secrets: shop.secrets !== null,
      running: shop.running,
      healthy: shop.running && shop.healthy,
      status: shop.running ? (shop.healthy ? 200 : 503) : null,
      latency_ms: shop.running ? 1 : null,
    })
  }
}
