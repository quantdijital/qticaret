import { model } from "@medusajs/framework/utils"
import { QUERY_POLICIES, REDIRECT_MATCHES } from "../../../lib/seo/redirects"

/** Where a rule came from: written in the panel, a file, or a migration's address decisions (F14). */
export const REDIRECT_ORIGINS = ["manual", "import", "migration"] as const

/**
 * A redirect rule (adr/0017, docs/13 §4):
 * - `source`: a normalised path, a prefix or a safe pattern (`/eski/:slug`);
 * - `target`: a path on this site, maybe with a query; null for a 410;
 * - `status`: 301, 302, 307 or 410;
 * - `query_policy`/`query_keep`: what of the request's query string the
 *   target keeps;
 * - `hit_count`/`last_hit_at`: counted in batches, approximate.
 * Old paths of products, categories and collections are not rules: the
 * URL registry keeps them and resolution follows their owner (adr/0017
 * "Uygulama notu").
 */
export const SeoRedirect = model
  .define("seo_redirect", {
    id: model.id({ prefix: "redir" }).primaryKey(),
    source: model.text(),
    match: model.enum([...REDIRECT_MATCHES]).default("exact"),
    target: model.text().nullable(),
    status: model.number().default(301),
    query_policy: model.enum([...QUERY_POLICIES]).default("keep"),
    query_keep: model.array().nullable(),
    origin: model.enum([...REDIRECT_ORIGINS]).default("manual"),
    hit_count: model.number().default(0),
    last_hit_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["source", "match"], unique: true, where: "deleted_at IS NULL" },
    // Rules pointing at a path, found when that path gets a rule of its own (chains)
    { on: ["target"], where: "deleted_at IS NULL AND target IS NOT NULL" },
  ])
