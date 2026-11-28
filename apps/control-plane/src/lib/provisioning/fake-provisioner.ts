import { randomBytes } from "node:crypto"
import { sectorPack, storefrontPreset, summaryOf } from "@qticaret/sector-packs"
import type { RuntimeSecrets } from "../vault/tenant-secrets"
import { ProvisioningError } from "./provisioner"
import type {
  BackupSummary,
  BuiltRelease,
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
  /** C12: the packs applied, by code: the version, as the shop's own record of them. */
  packs: Record<string, number>
  /** adr/0063 task 2.7: the looks applied (`pack/code`), and whether a design was published. */
  presets: string[]
  published: boolean
  /** The profiles handed over (the documents, as sent on stdin). */
  profiles: string[]
  /** Audit 3.2: the backups taken, oldest first. */
  backups: BackupSummary[]
}

export interface FakeState {
  shops: Map<string, FakeShop>
  /** Fails the first call that matches (a method, or `runTenantCommand:<command>`). */
  failOn: string | null
  calls: string[]
  /** Audit 3.1: the release a shop would start on (null: unknown). */
  built: BuiltRelease | null
}

const KEY = Symbol.for("qticaret.control-plane.fake-provisioner")

export function fakeState(): FakeState {
  const holder = globalThis as unknown as Record<symbol, FakeState | undefined>
  holder[KEY] ??= { shops: new Map(), failOn: null, calls: [], built: null }
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
        packs: {},
        presets: [],
        published: false,
        profiles: [],
        backups: [],
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
      case "apply-pack": {
        // As the shop's: every item the first time, none again (a newer version: none here)
        const pack = sectorPack(cmd.pack)
        if (!pack) {
          return await Promise.resolve({
            ...ok({ status: "unknown_pack" }),
            ok: false,
            exit_code: 1,
          })
        }
        // Presets are offered in the shop's theme editor, not written by the pack (adr/0063)
        const counts = Object.entries(summaryOf(pack).counts)
          .filter(([kind]) => kind !== "presets")
          .reduce((sum, [, n]) => sum + n, 0)
        const added = Object.hasOwn(shop.packs, pack.code) ? 0 : counts
        shop.packs[pack.code] = pack.version
        return await Promise.resolve(
          ok({
            status: "applied",
            pack: pack.code,
            version: pack.version,
            added,
            kept: 0,
            skipped: 0,
          })
        )
      }
      case "apply-preset": {
        // As the shop's: a look this build has, of a pack the shop was given
        const preset = storefrontPreset(cmd.pack, cmd.preset)
        if (!preset || !Object.hasOwn(shop.packs, cmd.pack)) {
          return await Promise.resolve({
            ...ok({ status: "unknown_preset" }),
            ok: false,
            exit_code: 1,
          })
        }
        const published = !shop.published
        shop.published = true
        shop.presets.push(`${cmd.pack}/${cmd.preset}`)
        return await Promise.resolve(
          ok({
            status: "applied",
            pack: cmd.pack,
            preset: cmd.preset,
            version: preset.version,
            skipped: 0,
            dropped: 0,
            published,
          })
        )
      }
      case "apply-profile": {
        // Every field the first time, none again (the shop fills only empty ones)
        const fields = Object.values(
          JSON.parse(cmd.document) as Record<string, Record<string, string>>
        ).reduce((sum, section) => sum + Object.keys(section).length, 0)
        const first = shop.profiles.length === 0
        shop.profiles.push(cmd.document)
        return await Promise.resolve(
          ok({
            status: "applied",
            filled: first ? fields : 0,
            kept: first ? 0 : fields,
            refused: 0,
          })
        )
      }
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

  async backup(t: ProvisionTarget): Promise<BackupSummary> {
    this.call("backup")
    const shop = this.shop(t)
    if (!shop.database) {
      throw new ProvisioningError("provisioning.backup_failed")
    }
    const taken = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
    const summary: BackupSummary = {
      manifest: `qt_tenant_${t.slug.replace(/-/g, "_")}-${taken.replace(/[-:]/g, "")}.manifest.json`,
      taken_at: taken,
      seconds: 1,
      bytes: 4096 * (shop.backups.length + 1),
      dump_sha256: randomBytes(32).toString("hex"),
      files: true,
    }
    shop.backups.push(summary)
    return await Promise.resolve(summary)
  }

  async availableRelease(): Promise<BuiltRelease | null> {
    this.call("availableRelease")
    return await Promise.resolve(fakeState().built)
  }
}
