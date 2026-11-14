import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { isLocalEnv, parseEnv } from "../lib/env"
import { loadDemoCatalog } from "./demo-catalog"

const FILE_ARG = "file="
const REPAIR_FLAG = "repair"

/**
 * Usage: NODE_ENV=development pnpm --filter @qticaret/backend medusa exec
 *   ./src/scripts/load-demo-catalog.ts file=/absolute/path/catalog.json [repair]
 *
 * Fills a development shop with a demo catalogue described by a data file
 * (`demo-catalog/schema.ts`; its pictures in `images/` beside it), so a
 * storefront can be judged with a full shop. The loader holds no sector:
 * what is sold is the file's. It needs `seed:demo` to have run (sales
 * channel, warehouse, shipping profile) and, for a file that names a
 * sector pack's attribute templates, that pack applied. Published, priced
 * and in stock, so customers could buy: development/test only.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv())) {
    throw new Error("load-demo-catalog: refusing to add demo products outside development/test")
  }
  const file = args.find((value) => value.startsWith(FILE_ARG))?.slice(FILE_ARG.length)
  if (!file || !path.isAbsolute(file)) {
    throw new Error("load-demo-catalog: file=<absolute path to the catalogue's JSON> is required")
  }
  const summary = await loadDemoCatalog(container, file, { repair: args.includes(REPAIR_FLAG) })
  process.stdout.write(`DEMO_CATALOG_RESULT ${JSON.stringify(summary)}\n`)
}
