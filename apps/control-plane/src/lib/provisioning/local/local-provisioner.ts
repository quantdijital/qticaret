import { existsSync } from "node:fs"
import { lstat, mkdir, readdir, readlink, rm, symlink } from "node:fs/promises"
import { join } from "node:path"
import { isLoopbackUrl } from "@qticaret/server-kit"
import type { RuntimeSecrets } from "../../vault/tenant-secrets"
import { ProvisioningError } from "../provisioner"
import type {
  CommandResult,
  HealthResult,
  ProvisionTarget,
  TenantCommand,
  TenantProvisioner,
} from "../provisioner"
import { COMMAND_TIMEOUT_MS, argvOf, runCommand } from "./commands"
import * as database from "./database"
import { composeEnv, databasePasswordOf, readEnvFile, writeEnvFile } from "./env-file"
import type { LocalSettings } from "./env-file"
import { databaseNameOf, layoutOf, repoRoot } from "./layout"
import type { ShopLayout } from "./layout"
import { healthOf, ownedPid, startShop, stopShop } from "./process"

export interface LocalProvisionerOptions {
  nodeEnv: string | undefined
  /** `CP_LOCAL_PG_ADMIN_URL`. */
  adminUrl: string
  redisUrl: string | null
  mailpitUrl: string | null
  controlPlaneUrl: string
  root?: string
}

// Never a link into the backend: what a shop keeps for itself
const OWN_ENTRIES = new Set(["static", "node_modules"])

/**
 * The developer's machine's provisioner (adr/0061 §6.3, Ek C10): a real
 * shop in the dev Postgres, its secrets in a 0600 env file, the compiled
 * backend started as its own process on a port in 9200–9299. Refused
 * outside `NODE_ENV=development` and for a Postgres not on this machine.
 */
export class LocalProvisioner implements TenantProvisioner {
  readonly kind = "local" as const
  private readonly root: string
  private readonly settings: LocalSettings

  constructor(private readonly options: LocalProvisionerOptions) {
    if (options.nodeEnv !== "development") {
      throw new ProvisioningError("provisioning.local_development_only")
    }
    let here: boolean
    try {
      here = isLoopbackUrl(options.adminUrl)
    } catch {
      here = false
    }
    if (!here) {
      throw new ProvisioningError("provisioning.local_database_elsewhere")
    }
    this.root = options.root ?? repoRoot()
    this.settings = {
      pg_host: new URL(options.adminUrl).host,
      redis_url: options.redisUrl,
      mailpit_url: options.mailpitUrl,
      control_plane_url: options.controlPlaneUrl,
    }
  }

  private layout(t: ProvisionTarget): ShopLayout {
    return layoutOf(t.slug, this.root)
  }

  /** The shop's env from its store; refused when there is none. */
  private async shopEnv(layout: ShopLayout): Promise<Record<string, string>> {
    const env = await readEnvFile(layout.envFile)
    if (!env) {
      throw new ProvisioningError("provisioning.secrets_missing")
    }
    return env
  }

  /** What a shop's process gets: its own env, a path and a home, the compiled packages' condition. */
  private async processEnv(layout: ShopLayout): Promise<Record<string, string>> {
    return {
      ...(await this.shopEnv(layout)),
      PATH: process.env["PATH"] ?? "/usr/bin:/bin",
      HOME: process.env["HOME"] ?? layout.dir,
      // The compiled backend loads the shared packages' dist (Ek C10), no ts-node needed
      NODE_OPTIONS: "--conditions=qt-compiled",
    }
  }

  /** The shop's working folder: links into the compiled backend, its own uploads. */
  private async prepareServer(layout: ShopLayout): Promise<void> {
    const built = [join(layout.backendDir, "medusa-config.js"), ...layout.compiledPackages]
    if (!built.every((path) => existsSync(path)) || !existsSync(layout.cli)) {
      throw new ProvisioningError("provisioning.backend_not_built")
    }
    await mkdir(layout.staticDir, { recursive: true, mode: 0o700 })
    const links = (await readdir(layout.backendDir))
      .filter((entry) => !OWN_ENTRIES.has(entry) && !entry.startsWith(".env"))
      .map((entry) => [entry, join(layout.backendDir, entry)] as const)
    for (const [entry, target] of [...links, ["node_modules", layout.backendModules] as const]) {
      const path = join(layout.serverDir, entry)
      const current = await lstat(path).catch(() => null)
      if (current?.isSymbolicLink() && (await readlink(path)) === target) {
        continue
      }
      if (current) {
        await rm(path, { recursive: false, force: true })
      }
      await symlink(target, path)
    }
  }

  async ensureDatabase(t: ProvisionTarget): Promise<{ created: boolean }> {
    const password = databasePasswordOf(await this.shopEnv(this.layout(t)))
    if (!password) {
      throw new ProvisioningError("provisioning.secrets_missing")
    }
    const made = await database.ensureDatabase(
      this.options.adminUrl,
      databaseNameOf(t.slug),
      password
    )
    return { created: made.database }
  }

  async dropDatabase(t: ProvisionTarget): Promise<void> {
    await database.dropDatabase(this.options.adminUrl, databaseNameOf(t.slug))
  }

  async writeRuntimeSecrets(t: ProvisionTarget, secrets: RuntimeSecrets): Promise<void> {
    await writeEnvFile(this.layout(t).envFile, composeEnv(t, secrets.values, this.settings))
  }

  /** The store, and the shop's folder with it, unless a process of it still runs. */
  async removeRuntimeSecrets(t: ProvisionTarget): Promise<void> {
    const layout = this.layout(t)
    if ((await ownedPid(layout, t.port)) !== null) {
      throw new ProvisioningError("provisioning.shop_running")
    }
    await rm(layout.dir, { recursive: true, force: true })
  }

  async runTenantCommand(t: ProvisionTarget, cmd: TenantCommand): Promise<CommandResult> {
    const layout = this.layout(t)
    const args = argvOf(cmd)
    await this.prepareServer(layout)
    await mkdir(layout.logDir, { recursive: true, mode: 0o700 })
    return await runCommand({
      cli: layout.cli,
      cwd: layout.serverDir,
      env: await this.processEnv(layout),
      args,
      ...(cmd.name === "plan-import" ? { stdin: cmd.document } : {}),
      timeoutMs: COMMAND_TIMEOUT_MS[cmd.name],
      // The owner's invitation link is in that output: kept nowhere
      logFile: cmd.name === "invite-owner" ? null : join(layout.logDir, "commands.log"),
    })
  }

  async start(t: ProvisionTarget): Promise<void> {
    const layout = this.layout(t)
    if ((await ownedPid(layout, t.port)) !== null) {
      return
    }
    await this.prepareServer(layout)
    await startShop(layout, t.port, await this.processEnv(layout))
  }

  async stop(t: ProvisionTarget): Promise<void> {
    await stopShop(this.layout(t), t.port)
  }

  async probe(t: ProvisionTarget): Promise<HealthResult> {
    const layout = this.layout(t)
    const secrets = (await readEnvFile(layout.envFile)) !== null
    const running = (await ownedPid(layout, t.port)) !== null
    // Another process on the port is not this shop: its answer is not asked
    const health = running ? await healthOf(t.port) : { status: null, latency_ms: null }
    return { secrets, running, healthy: health.status === 200, ...health }
  }
}
