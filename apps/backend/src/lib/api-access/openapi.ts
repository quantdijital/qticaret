import { z } from "@medusajs/framework/zod"
import { SCOPED_ROUTES } from "./scopes"
import type { ScopedRoute } from "./scopes"

/**
 * The OpenAPI document of what an API key can reach (F11.6, adr/0039 §6),
 * made from the scope table and Zod schemas with Zod 4's `toJSONSchema`
 * (no new dependency). The bodies and queries are Medusa's own routes';
 * the schemas here describe the parts an integration uses.
 */

const LIST_QUERY = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Sayfadaki kayıt (en çok 100)"),
  offset: z.number().int().min(0).optional().describe("Atlanan kayıt"),
  order: z.string().optional().describe("Sıralama alanı; azalan için başına `-`"),
})

const LEVEL_BODY = z.object({
  stocked_quantity: z.number().int().min(0).describe("Depodaki adet"),
})

const LEVEL = z.object({
  inventory_item_id: z.string(),
  location_id: z.string(),
  stocked_quantity: z.number().int().min(0),
})

const BATCH_BODY = z.object({
  create: z.array(LEVEL).optional(),
  update: z.array(LEVEL).optional(),
  delete: z.array(z.string()).optional().describe("Silinecek seviye kimlikleri"),
})

const WEBHOOK_BODY = z.object({
  url: z.url().describe("Olayların gönderileceği https adresi"),
  events: z.array(z.string()).min(1).describe("Abone olunan olaylar"),
})

const schemaOf = (schema: z.ZodType) => z.toJSONSchema(schema, { target: "openapi-3.0" })

function bodyOf(route: ScopedRoute): z.ZodType | null {
  if (route.method !== "POST") {
    return null
  }
  if (route.path.endsWith("/batch")) {
    return BATCH_BODY
  }
  return route.scope === "stock:write" ? LEVEL_BODY : WEBHOOK_BODY
}

function operation(route: ScopedRoute) {
  const params = [...route.path.matchAll(/:(\w+)/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }))
  const listing = route.method === "GET" && !route.path.endsWith("/:id")
  const query = listing
    ? Object.entries(LIST_QUERY.shape).map(([name, schema]) => ({
        name,
        in: "query",
        required: false,
        schema: schemaOf(schema),
      }))
    : []
  const body = bodyOf(route)
  return {
    summary: route.summary,
    tags: [route.scope],
    "x-scope": route.scope,
    parameters: [...params, ...query],
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: schemaOf(body) } },
          },
        }
      : {}),
    responses: {
      "200": { description: "Medusa'nın yanıtı" },
      "401": { description: "Anahtar yok, yanlış ya da iptal edilmiş" },
      "400": { description: "Gövde ya da sorgu geçersiz; `fields` gönderildi" },
      "403": { description: "Bu uç anahtarın kapsamında değil" },
      "429": { description: "Anahtarın dakikalık istek sınırı aşıldı" },
    },
  }
}

export function openApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const route of SCOPED_ROUTES) {
    const path = route.path.replace(/:(\w+)/g, "{$1}")
    paths[path] = { ...paths[path], [route.method.toLowerCase()]: operation(route) }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Mağaza dış API'si",
      version: "1",
      description:
        "Anahtar Basic kimlik doğrulamada kullanıcı adı olarak gönderilir (parola boş). Her anahtar yalnızca kapsamındaki uçlara erişir ve her ucun kendi alanlarını okur: `fields` parametresi anahtarla kabul edilmez.",
    },
    servers: [{ url: serverUrl }],
    components: { securitySchemes: { apiKey: { type: "http", scheme: "basic" } } },
    security: [{ apiKey: [] }],
    paths,
  }
}
