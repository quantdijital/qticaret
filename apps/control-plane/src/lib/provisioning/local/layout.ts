import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { SLUG_PATTERN } from "../../tenants/slug"
import { ProvisioningError } from "../provisioner"

/**
 * Where a local shop lives (adr/0061 §6.3, Ek C10):
 *
 * - `infra/tenants/local/<slug>/` (0700, git-ignored): `.env` (0600, its
 *   runtime secrets and settings), `backend.pid`, `logs/`
 * - `…/<slug>/server/`: the shop's working directory. It links to the
 *   compiled backend (`apps/backend/.medusa/server`: `medusa-config.js`,
 *   `src`, …) and the backend's `node_modules`, and holds its own
 *   `static/`, where Medusa's local file provider keeps its uploads. Its own
 *   directory also means no `.env` of the main development shop is read.
 */

/** The repository's root: the nearest folder above `start` with `pnpm-workspace.yaml`. */
export function repoRoot(start: string = process.cwd()): string {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new ProvisioningError("provisioning.repo_unknown")
    }
    dir = parent
  }
}

export interface ShopLayout {
  dir: string
  envFile: string
  pidFile: string
  logDir: string
  serverDir: string
  staticDir: string
  /** The compiled backend every local shop runs. */
  backendDir: string
  backendModules: string
  /** Medusa's CLI, run with Node (no shell, no `npx`). */
  cli: string
  /**
   * What the shop runs, built, beside the sources it was built from: the
   * backend and the shared packages' copies it loads (`qt-compiled`). A
   * source newer than its build is a stale build (review, build safety).
   */
  builds: readonly { source: string; built: string }[]
}

/** The shop's paths; its slug checked again first, as it names folders. */
export function layoutOf(slug: string, root: string = repoRoot()): ShopLayout {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ProvisioningError("provisioning.slug_invalid")
  }
  const dir = join(root, "infra", "tenants", "local", slug)
  const backend = join(root, "apps", "backend")
  const serverDir = join(dir, "server")
  return {
    dir,
    envFile: join(dir, ".env"),
    pidFile: join(dir, "backend.pid"),
    logDir: join(dir, "logs"),
    serverDir,
    staticDir: join(serverDir, "static"),
    backendDir: join(backend, ".medusa", "server"),
    backendModules: join(backend, "node_modules"),
    cli: join(backend, "node_modules", "@medusajs", "cli", "cli.js"),
    builds: [
      {
        source: join(backend, "src"),
        built: join(backend, ".medusa", "server", "medusa-config.js"),
      },
      {
        source: join(root, "packages", "server-kit", "src"),
        built: join(root, "packages", "server-kit", "dist", "index.js"),
      },
      {
        source: join(root, "packages", "types", "src", "control-plane"),
        built: join(root, "packages", "types", "dist", "control-plane", "index.js"),
      },
    ],
  }
}

/** The database and role of a shop: `qt_tenant_<slug>`, hyphens as underscores (§6.3). */
export const databaseNameOf = (slug: string): string => {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ProvisioningError("provisioning.slug_invalid")
  }
  return `qt_tenant_${slug.replace(/-/g, "_")}`
}
