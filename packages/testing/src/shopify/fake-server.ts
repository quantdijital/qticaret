import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A local stand-in for a Shopify store's GraphQL Admin API (docs/07: tests
 * never call the real provider; adr/0042): a day's token for the app's
 * client id and secret (client credentials grant), the shop's currency,
 * and bulk queries whose JSONL files it serves itself. Each record is a
 * node with its children (variants, media, addresses, line items,
 * articles): the file has a line per node, a child's after its parent with
 * `__parentId`, as Shopify writes it.
 */

export interface FakeShopifyNode {
  id: string
  /** Child nodes, a line each after this one. */
  children?: FakeShopifyNode[]
  [field: string]: unknown
}

export interface FakeShopifyData {
  currencyCode: string
  collections: FakeShopifyNode[]
  products: FakeShopifyNode[]
  customers: FakeShopifyNode[]
  orders: FakeShopifyNode[]
  pages: FakeShopifyNode[]
  blogs: FakeShopifyNode[]
}

export interface FakeShopifyApp {
  clientId: string
  clientSecret: string
}

/** A real 64×48 PNG: what the fake serves at `/images/{name}` (a store's picture). */
export const FAKE_SHOPIFY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAfUlEQVRoge2SAQkAURSDFsdMl9OAF2M8/sAAOhY/TpO6gQugvqK7EHdJ3cAFUF/RXYi7pG7gAqiv6C7EXVI3cAHUV3QX4i6pG7gA6iu6C3GX1A1cAPUV3YW4S+oGLoD6iu5C3CV1AxdAfUV3Ie6SuoELoL6iuxB3Sd3AxwN+3U6I0+Jnnj8AAAAASUVORK5CYII=",
  "base64"
)

export interface FakeShopify {
  /** The origin the backend takes as `SHOPIFY_BASE_URL`. */
  url: string
  /** Pictures asked for, by name: `/images/tava.png` → "tava.png". */
  imageHits: string[]
  data: FakeShopifyData
  /** The bulk queries asked for, by their list ("products"). */
  bulkRuns: string[]
  /** The store is another organization's: every token refused (`shop_not_permitted`). */
  refuseShop: (refused: boolean) => void
  /** The next `count` GraphQL calls are throttled. */
  throttle: (count: number) => void
  close: () => Promise<void>
}

const VERSION_PATH = /^\/admin\/api\/[0-9]{4}-[0-9]{2}\/graphql\.json$/
const LISTS = ["collections", "products", "customers", "orders", "pages", "blogs"] as const
type List = (typeof LISTS)[number]

interface Operation {
  id: string
  list: List
  polls: number
  file: string
}

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

/** The file Shopify writes: a line per node, children after their parent. */
export function jsonlOf(nodes: readonly FakeShopifyNode[]): string {
  const lines: string[] = []
  const write = (node: FakeShopifyNode, parent: string | null) => {
    const { children, ...fields } = node
    lines.push(JSON.stringify(parent ? { ...fields, __parentId: parent } : fields))
    for (const child of children ?? []) {
      write(child, node.id)
    }
  }
  for (const node of nodes) {
    write(node, null)
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : ""
}

const emptyData = (): FakeShopifyData => ({
  currencyCode: "TRY",
  collections: [],
  products: [],
  customers: [],
  orders: [],
  pages: [],
  blogs: [],
})

/** Starts the fake on a local port: a free one, or `port` for a dev backend's SHOPIFY_BASE_URL. */
export async function startFakeShopify(
  app: FakeShopifyApp,
  options: { port?: number; data?: Partial<FakeShopifyData> } = {}
): Promise<FakeShopify> {
  const data: FakeShopifyData = { ...emptyData(), ...options.data }
  const tokens = new Set<string>()
  const operations = new Map<string, Operation>()
  const bulkRuns: string[] = []
  const imageHits: string[] = []
  const sockets = new Set<Socket>()
  let refused = false
  let throttled = 0
  let origin = ""

  const grant = (fields: URLSearchParams) => {
    if (fields.get("grant_type") !== "client_credentials") {
      return { status: 400, body: { error: "unsupported_grant_type" } }
    }
    if (
      fields.get("client_id") !== app.clientId ||
      fields.get("client_secret") !== app.clientSecret
    ) {
      return { status: 400, body: { error: "invalid_client" } }
    }
    if (refused) {
      return { status: 400, body: { error: "shop_not_permitted" } }
    }
    const token = `fake-${randomBytes(16).toString("hex")}`
    tokens.add(token)
    return {
      status: 200,
      body: { access_token: token, scope: "read_products,read_customers", expires_in: 86399 },
    }
  }

  const graphql = (query: string, variables: Record<string, unknown>) => {
    if (query.includes("bulkOperationRunQuery")) {
      const inner = typeof variables["query"] === "string" ? variables["query"] : ""
      const list = /^\s*\{\s*([a-z]+)/.exec(inner)?.[1] as List | undefined
      if (!list || !LISTS.includes(list)) {
        return {
          data: {
            bulkOperationRunQuery: {
              bulkOperation: null,
              userErrors: [{ field: ["query"], message: "Invalid bulk query" }],
            },
          },
        }
      }
      const id = `gid://shopify/BulkOperation/${String(operations.size + 1)}`
      operations.set(id, { id, list, polls: 0, file: jsonlOf(data[list]) })
      bulkRuns.push(list)
      return {
        data: {
          bulkOperationRunQuery: { bulkOperation: { id, status: "CREATED" }, userErrors: [] },
        },
      }
    }
    if (query.includes("bulkOperation(id")) {
      const operation = operations.get(String(variables["id"]))
      if (!operation) {
        return { data: { bulkOperation: null } }
      }
      operation.polls += 1
      // Shopify is still at work on the first look
      const done = operation.polls > 1
      const lines = operation.file === "" ? 0 : operation.file.trimEnd().split("\n").length
      return {
        data: {
          bulkOperation: {
            id: operation.id,
            status: done ? "COMPLETED" : "RUNNING",
            errorCode: null,
            objectCount: String(done ? lines : 0),
            url:
              done && lines > 0
                ? `${origin}/files/${encodeURIComponent(operation.id.split("/").pop() ?? "")}.jsonl`
                : null,
          },
        },
      }
    }
    if (query.includes("shop")) {
      return { data: { shop: { name: "Sahte Mağaza", currencyCode: data.currencyCode } } }
    }
    return { errors: [{ message: "Unknown query", extensions: { code: "BAD_REQUEST" } }] }
  }

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake")
      const text = await readText(req)
      if (url.pathname === "/admin/oauth/access_token" && req.method === "POST") {
        const answer = grant(new URLSearchParams(text))
        json(res, answer.status, answer.body)
        return
      }
      // Any `.png`/`.jpg` name is a picture; `.txt` is a file that is not one
      const image = /^\/images\/([a-z0-9-]+\.(?:png|jpg|txt))$/.exec(url.pathname)?.[1]
      if (image && req.method === "GET") {
        imageHits.push(image)
        const picture = !image.endsWith(".txt")
        res.writeHead(200, { "content-type": picture ? "image/png" : "text/plain" })
        res.end(picture ? FAKE_SHOPIFY_PNG : "bir görsel değil")
        return
      }
      const file = /^\/files\/([0-9]+)\.jsonl$/.exec(url.pathname)?.[1]
      if (file && req.method === "GET") {
        const operation = operations.get(`gid://shopify/BulkOperation/${file}`)
        res.writeHead(operation ? 200 : 404, { "content-type": "application/jsonl" })
        res.end(operation?.file ?? "")
        return
      }
      if (!VERSION_PATH.test(url.pathname) || req.method !== "POST") {
        json(res, 404, { errors: "Not Found" })
        return
      }
      const token = req.headers["x-shopify-access-token"]
      if (typeof token !== "string" || !tokens.has(token)) {
        json(res, 401, {
          errors: "[API] Invalid API key or access token (unrecognized login or wrong password)",
        })
        return
      }
      if (throttled > 0) {
        throttled -= 1
        json(res, 200, { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] })
        return
      }
      const body = JSON.parse(text) as { query?: string; variables?: Record<string, unknown> }
      json(res, 200, graphql(body.query ?? "", body.variables ?? {}))
    })().catch(() => {
      json(res, 500, { errors: "Internal Server Error" })
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`

  return {
    url: origin,
    imageHits,
    data,
    bulkRuns,
    refuseShop: (value) => {
      refused = value
    },
    throttle: (count) => {
      throttled = count
    },
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve()
        })
      )
    },
  }
}
