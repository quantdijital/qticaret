import { z } from "@medusajs/framework/zod"
import { ProviderError } from "../../errors"
import { safeFetch } from "../../security/safe-fetch"
import { fakeOrigin } from "../fetch"
import { SHOPIFY_PROVIDER } from "./client"
import type { ShopifyApi } from "./client"

/**
 * A bulk query (shopify.dev/docs/api/usage/bulk-operations/queries): Shopify
 * reads the whole list itself, past the per-call cost and the 25,000 a
 * page walk can reach, and leaves a JSONL file of its nodes, each child on
 * its own line after its parent with `__parentId`. The file's link, signed
 * for a week, is fetched over HTTPS from Google's storage only; a fake
 * Shopify's (development, tests) directly.
 */

export interface BulkNode {
  id?: string
  __parentId?: string
  [field: string]: unknown
}

const RUN = `mutation run($query: String!) {
  bulkOperationRunQuery(query: $query) {
    bulkOperation { id status }
    userErrors { field message }
  }
}`

const POLL = `query poll($id: ID!) {
  bulkOperation(id: $id) { id status errorCode objectCount url }
}`

const Started = z.object({
  bulkOperationRunQuery: z.object({
    bulkOperation: z.object({ id: z.string().max(200) }).nullable(),
    userErrors: z.array(z.looseObject({ message: z.string().max(2000) })),
  }),
})

const Polled = z.object({
  bulkOperation: z
    .object({
      id: z.string().max(200),
      status: z.enum([
        "CANCELED",
        "CANCELING",
        "COMPLETED",
        "CREATED",
        "EXPIRED",
        "FAILED",
        "RUNNING",
      ]),
      errorCode: z.string().max(100).nullable().optional(),
      objectCount: z.union([z.string(), z.number()]).optional(),
      url: z.string().max(4096).nullable().optional(),
    })
    .nullable(),
})

// A shop of a few hundred thousand records: its largest list, as JSONL
const MAX_FILE_BYTES = 512 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
const POLL_EVERY_MS = 3_000
// Shopify allows ten days; a migration that waits a day is stopped and run again
const MAX_WAIT_MS = 24 * 60 * 60 * 1000

const failure = (providerCode: string) =>
  new ProviderError({ provider: SHOPIFY_PROVIDER, providerCode, retryable: false })

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

async function download(address: string, fake: string | undefined): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw failure("bulk_url_invalid")
  }
  if (fake && new URL(fake).origin === url.origin) {
    const answer = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })
    if (answer.status !== 200) {
      throw failure(`bulk_http_${String(answer.status)}`)
    }
    const bytes = Buffer.from(await answer.arrayBuffer())
    if (bytes.length > MAX_FILE_BYTES) {
      throw failure("bulk_too_large")
    }
    return bytes
  }
  // Shopify's files live in Google's storage; a link elsewhere is not followed
  if (url.protocol !== "https:" || url.hostname !== "storage.googleapis.com") {
    throw failure("bulk_url_invalid")
  }
  const answer = await safeFetch(url, {
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    maxResponseBytes: MAX_FILE_BYTES,
    redirect: "error",
  })
  if (answer.status !== 200) {
    throw failure(`bulk_http_${String(answer.status)}`)
  }
  return answer.body
}

/** The file's lines as nodes; a line that is not a JSON object is refused. */
export function nodesOf(file: Buffer): BulkNode[] {
  const nodes: BulkNode[] = []
  for (const line of file.toString("utf8").split("\n")) {
    if (line.trim() === "") {
      continue
    }
    let node: unknown
    try {
      node = JSON.parse(line)
    } catch {
      throw failure("bulk_line_invalid")
    }
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw failure("bulk_line_invalid")
    }
    nodes.push(node as BulkNode)
  }
  return nodes
}

export interface BulkOptions {
  /** Called while Shopify works: the job's heartbeat. */
  beat: () => Promise<void>
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** A fake Shopify's origin, reached directly (the environment's, or a test's own). */
  fake?: string | undefined
}

/** Runs one bulk query to its end and returns its nodes, in the file's order. */
export async function bulkNodes(
  api: ShopifyApi,
  query: string,
  options: BulkOptions
): Promise<BulkNode[]> {
  const sleep = options.sleep ?? wait
  const now = options.now ?? Date.now
  const fake = "fake" in options ? options.fake : fakeOrigin()
  const started = await api.graphql(RUN, { query }, Started, { read: false })
  const operation = started.bulkOperationRunQuery.bulkOperation
  if (!operation || started.bulkOperationRunQuery.userErrors.length > 0) {
    throw failure("bulk_refused")
  }
  const until = now() + MAX_WAIT_MS
  for (;;) {
    await options.beat()
    const { bulkOperation: state } = await api.graphql(POLL, { id: operation.id }, Polled, {
      read: true,
    })
    if (!state) {
      throw failure("bulk_missing")
    }
    if (state.status === "COMPLETED") {
      // No url: the list was empty
      return state.url ? nodesOf(await download(state.url, fake)) : []
    }
    if (!["CREATED", "RUNNING"].includes(state.status)) {
      throw failure(`bulk_${(state.errorCode ?? state.status).toLowerCase()}`)
    }
    if (now() > until) {
      throw failure("bulk_timeout")
    }
    await sleep(POLL_EVERY_MS)
  }
}
