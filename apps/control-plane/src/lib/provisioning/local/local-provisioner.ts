import { existsSync } from "node:fs"
import { lstat, mkdir, readdir, readlink, rm, symlink } from "node:fs/promises"
import { join } from "node:path"
import type { RuntimeSecrets } from "../../vault/tenant-secrets"
import { ProvisioningError } from "../provisioner"
import type {
  CommandResult,
  HealthResult,
  ProvisionTarget,
  TenantCommand,
  TenantProvisioner,
} from "../provisioner"
import { localAdminUrlProblem } from "./admin-url"
import { assertFreshBuilds } from "./build-check"
import { COMMAND_TIMEOUT_MS, argvOf, runCommand } from "./commands"
import * as database from "./database"
import { composeEnv, databasePasswordOf, ownEnvFile, shopRedisUrl, writeEnvFile } from "./env-file"
import type { LocalSettings } from "./env-file"
import { databaseNameOf, layoutOf, repoRoot } from "./layout"
import type { ShopLayout } from "./layout"
import {
  healthOf,
  ownedPid,
  ownedProcessPid,
  panelEnv,
  panelProcess,
  startProcess,
  startShop,
  stopProcess,
  stopShop,
} from "./process"

export interface LocalProvisionerOptions {
  nodeEnv: string | undefined
  /** `CP_LOCAL_PG_ADMIN_URL`. */
  adminUrl: string
  /** The control plane's own Redis; shops get another logical database on it. */
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
 * A store, folder or database marked with another shop's id, or with
 * none, is never used or removed (review L1: `provisioning.foreign_shop`).
 */
export class LocalProvisioner implements TenantProvisioner {
  readonly kind = "local" as const
  private readonly root: string
  private readonly settings: LocalSettings

  constructor(private readonly options: LocalProvisionerOptions) {
    if (options.nodeEnv !== "development") {
      throw new ProvisioningError("provisioning.local_development_only")
    }
    const problem = localAdminUrlProblem(options.adminUrl)
    if (problem) {
      throw new ProvisioningError("provisioning.local_database_elsewhere")
    }
    this.root = options.root ?? repoRoot()
    this.settings = {
      pg_host: new URL(options.adminUrl).host,
      redis_url: options.redisUrl ? shopRedisUrl(options.redisUrl) : null,
      mailpit_url: options.mailpitUrl,
      control_plane_url: options.controlPlaneUrl,
    }
  }

  private layout(t: ProvisionTarget): ShopLayout {
    return layoutOf(t.slug, this.root)
  }

  /** The shop's env from its store; refused when there is none or it is another shop's. */
  private async shopEnv(layout: ShopLayout, t: ProvisionTarget): Promise<Record<string, string>> {
    const env = await ownEnvFile(layout.envFile, t.tenant_id)
    if (!env) {
      throw new ProvisioningError("provisioning.secrets_missing")
    }
    return env
  }

  /** What a shop's process gets: its own env, a path and a home, the compiled packages' condition. */
  private async processEnv(layout: ShopLayout, t: ProvisionTarget) {
    return {
      ...(await this.shopEnv(layout, t)),
      PATH: process.env["PATH"] ?? "/usr/bin:/bin",
      HOME: process.env["HOME"] ?? layout.dir,
      // The compiled backend loads the shared packages' dist (Ek C10), no ts-node needed
      NODE_OPTIONS: "--conditions=qt-compiled",
    }
  }

  /**
   * The shop's working folder: links into the compiled backend, its own
   * uploads. Refused while any build is missing or older than its sources.
   */
  private async prepareServer(layout: ShopLayout): Promise<void> {
    if (!existsSync(layout.cli)) {
      throw new ProvisioningError("provisioning.backend_not_built")
    }
    await assertFreshBuilds(layout.builds)
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
    const password = databasePasswordOf(await this.shopEnv(this.layout(t), t))
    if (!password) {
      throw new ProvisioningError("provisioning.secrets_missing")
    }
    const made = await database.ensureDatabase(
      this.options.adminUrl,
      databaseNameOf(t.slug),
      password,
      t.tenant_id
    )
    return { created: made.database }
  }

  async dropDatabase(t: ProvisionTarget): Promise<void> {
    await database.dropDatabase(this.options.adminUrl, databaseNameOf(t.slug), t.tenant_id)
  }

  /** A new store only: a folder already there (any shop's, or none's) is not written into. */
  async writeRuntimeSecrets(t: ProvisionTarget, secrets: RuntimeSecrets): Promise<void> {
    const layout = this.layout(t)
    if (await lstat(layout.dir).catch(() => null)) {
      throw new ProvisioningError("provisioning.foreign_shop")
    }
    await writeEnvFile(layout.envFile, composeEnv(t, secrets.values, this.settings))
  }

  /**
   * The store and the shop's folder with it: only this shop's (its store
   * names it), and not while a process of it runs.
   */
  async removeRuntimeSecrets(t: ProvisionTarget): Promise<void> {
    const layout = this.layout(t)
    if (!(await lstat(layout.dir).catch(() => null))) {
      return
    }
    if (!(await ownEnvFile(layout.envFile, t.tenant_id))) {
      throw new ProvisioningError("provisioning.foreign_shop")
    }
    if ((await ownedPid(layout, t.port)) !== null) {
      throw new ProvisioningError("provisioning.shop_running")
    }
    // Its panel keeps nothing of the shop's: stopped, so no process outlives the folder
    await stopProcess(panelProcess(layout, t.port))
    await rm(layout.dir, { recursive: true, force: true })
  }

  async runTenantCommand(t: ProvisionTarget, cmd: TenantCommand): Promise<CommandResult> {
    const layout = this.layout(t)
    const args = argvOf(cmd)
    const env = await this.processEnv(layout, t)
    await this.prepareServer(layout)
    return await runCommand({
      cli: layout.cli,
      cwd: layout.serverDir,
      env,
      args,
      ...(cmd.name === "plan-import" || cmd.name === "apply-profile"
        ? { stdin: cmd.document }
        : {}),
      timeoutMs: COMMAND_TIMEOUT_MS[cmd.name],
      // The owner's invitation token is in that output, the profile's values may be in an
      // error's: kept nowhere
      logFile:
        cmd.name === "invite-owner" || cmd.name === "apply-profile"
          ? null
          : join(layout.logDir, "commands.log"),
    })
  }

  async start(t: ProvisionTarget): Promise<void> {
    const layout = this.layout(t)
    if ((await ownedPid(layout, t.port)) === null) {
      const env = await this.processEnv(layout, t)
      await this.prepareServer(layout)
      await startShop(layout, t.port, env)
    }
    await this.startPanel(layout, t)
  }

  /**
   * The shop's panel beside it on this machine (adr/0061 Ek 2026-11-28,
   * Karar 8): Vite's dev server on the backend's port + 1000, pointed at
   * the shop's backend, so "Mağaza paneline geç" opens a working panel.
   * A convenience: a panel already running, a port taken (one opened by
   * hand) or no panel installed leaves the shop's start as it is.
   */
  private async startPanel(layout: ShopLayout, t: ProvisionTarget): Promise<void> {
    const panel = panelProcess(layout, t.port)
    if (!existsSync(layout.panelVite) || (await ownedProcessPid(panel)) !== null) {
      return
    }
    try {
      await startProcess(panel, panelEnv(t.port))
    } catch (error) {
      if (!(error instanceof ProvisioningError)) {
        throw error
      }
    }
  }

  async stop(t: ProvisionTarget): Promise<void> {
    const layout = this.layout(t)
    await stopProcess(panelProcess(layout, t.port))
    await stopShop(layout, t.port)
  }

  async probe(t: ProvisionTarget): Promise<HealthResult> {
    const layout = this.layout(t)
    const secrets = (await ownEnvFile(layout.envFile, t.tenant_id)) !== null
    const running = (await ownedPid(layout, t.port)) !== null
    // Another process on the port is not this shop: its answer is not asked
    const health = running ? await healthOf(t.port) : { status: null, latency_ms: null }
    return { secrets, running, healthy: health.status === 200, ...health }
  }
}
