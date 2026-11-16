import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { connect } from "node:net"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PlanLimitError, toHttpError } from "../../../lib/errors"
import { logger } from "../../../lib/logging"
import { activeDrains } from "../../../lib/security/upload/drain"
import { uploadSizeGate } from "../request-limits"
import { requireVideoForm } from "../video-routes"
import { uploadSlotState, withCheckedVideo } from "../video-upload"

// What the shop has: set per case
const mockShop: { videos: unknown[] | null; storageFull: boolean } = {
  videos: [],
  storageFull: false,
}
jest.mock("../../../workflows/media/video/read", () => ({
  productVideos: () => Promise.resolve(mockShop.videos),
}))
jest.mock("../../../lib/plan-limits", () => ({
  assertStorageFits: () =>
    mockShop.storageFull
      ? Promise.reject(new PlanLimitError("storage_mb", 1, 1))
      : Promise.resolve(),
}))
jest.mock("../../../lib/media/video/tools", () => ({
  ...jest.requireActual<object>("../../../lib/media/video/tools"),
  videoUploadAvailable: () => Promise.resolve(true),
}))

const MB = 1024 * 1024
const BOUNDARY = "----qtearly"

/**
 * Review of adr/0069 slice 1: an upload refused before its body is read
 * (too large, not a form, no length, no such product, no room, storage
 * full) is answered so that the client, still sending, reads the status
 * and the body: no reset in its place. Each over a real socket, with the
 * client sending as a browser does, a `Connection: close` request.
 */
describe("early refusals of a video upload, over a real socket", () => {
  let server: Server
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "qt-test-early-"))
    mockShop.videos = []
    mockShop.storageFull = false
    jest.spyOn(logger, "info").mockImplementation(() => undefined)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
      server.closeAllConnections()
    })
    rmSync(root, { recursive: true, force: true })
  })

  /** The route's chain as the app runs it: the gate, the form check, then the upload. */
  function serve(): Promise<number> {
    server = createServer((incoming: IncomingMessage, outgoing: ServerResponse) => {
      // Medusa's authentication runs before our middlewares: `x-test-actor` stands in for it
      const actor = incoming.headers["x-test-actor"]
      const req = Object.assign(incoming, {
        scope: {},
        ...(typeof actor === "string"
          ? { auth_context: { actor_id: actor, actor_type: "user" } }
          : {}),
      }) as unknown as MedusaRequest
      const res = Object.assign(outgoing, {
        status(code: number) {
          outgoing.statusCode = code
          return res
        },
        json(body: unknown) {
          outgoing.setHeader("content-type", "application/json")
          outgoing.end(JSON.stringify(body))
          return res
        },
      }) as unknown as MedusaResponse
      for (const step of [uploadSizeGate, requireVideoForm]) {
        const gate = { passed: false }
        const next: MedusaNextFunction = () => {
          gate.passed = true
        }
        step(req, res, next)
        if (!gate.passed) {
          return
        }
      }
      withCheckedVideo(req, "prod_01TEST", () => Promise.resolve("stored"), root).then(
        () => {
          res.status(202).json({ stored: true })
        },
        (error: unknown) => {
          const mapped = toHttpError(error)
          if (mapped) {
            res.status(mapped.status).json(mapped.body)
            return
          }
          const notFound =
            error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND
          res.status(notFound ? 404 : 500).json({ message: (error as Error).message })
        }
      )
    })
    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve((server.address() as AddressInfo).port)
      })
    })
  }

  /**
   * Sends the headers and `bodyBytes` of body (all of it, as the client means to), reading
   * whatever comes back; resolves with what was read and whether the client met a reset.
   */
  async function send(
    port: number,
    headers: Record<string, string>,
    bodyBytes: number
  ): Promise<{ status: number; body: string; reset: boolean }> {
    const socket = connect(port, "127.0.0.1")
    const chunks: Buffer[] = []
    const state = { reset: false }
    socket.on("data", (chunk: Buffer) => chunks.push(chunk))
    socket.on("error", () => {
      state.reset = true
    })
    const closed = new Promise<void>((resolve) => {
      socket.once("close", () => {
        resolve()
      })
    })
    await new Promise<void>((resolve) => {
      socket.once("connect", () => {
        resolve()
      })
    })
    const head = Object.entries({ Host: "localhost", Connection: "close", ...headers })
      .map(([name, value]) => `${name}: ${value}`)
      .join("\r\n")
    socket.write(`POST /admin/products/prod_01TEST/videos HTTP/1.1\r\n${head}\r\n\r\n`)
    const piece = Buffer.alloc(256 * 1024, 7)
    for (
      let sent = 0;
      sent < bodyBytes && !socket.destroyed && !state.reset;
      sent += piece.length
    ) {
      const part = piece.subarray(0, Math.min(piece.length, bodyBytes - sent))
      if (!socket.write(part)) {
        await Promise.race([new Promise((resolve) => socket.once("drain", resolve)), closed])
      }
    }
    if (!socket.destroyed) {
      socket.end()
    }
    await closed
    const text = Buffer.concat(chunks).toString("utf8")
    const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(text)?.[1] ?? 0)
    return { status, body: text.slice(text.indexOf("\r\n\r\n") + 4), reset: state.reset }
  }

  // A signed-in person's request (the only kind whose refused body is drained)
  const SIGNED_IN = { "X-Test-Actor": "user_01TEST" }

  const form = (length: number) => ({
    ...SIGNED_IN,
    "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`,
    "Content-Length": String(length),
  })

  it.each([
    ["a body past 52 MB", form(53 * MB), 53 * MB, 413, "video.too_large"],
    [
      "a body that is not a form",
      {
        ...SIGNED_IN,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(2 * MB),
      },
      2 * MB,
      415,
      "video.file_required",
    ],
  ])(
    "answers %s readably, after the client has sent it",
    async (_, headers, bytes, status, message) => {
      const port = await serve()
      const answer = await send(port, headers, bytes)
      expect(answer).toMatchObject({ status, reset: false })
      expect(JSON.parse(answer.body)).toMatchObject({ message })
      expect(uploadSlotState()).toEqual({ running: 0, waiting: 0 })
      expect(readdirSync(root)).toEqual([])
    }
  )

  it("answers a body of unknown length, and closes the connection after it", async () => {
    const port = await serve()
    const answer = await send(
      port,
      {
        ...SIGNED_IN,
        "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`,
        "Transfer-Encoding": "chunked",
      },
      0
    )
    expect(answer.status).toBe(411)
    expect(answer.body).toContain("errors.length_required")
  })

  /** A raw connection: headers and some body sent, then what the server does is watched. */
  async function open(port: number) {
    const socket = connect(port, "127.0.0.1")
    const chunks: Buffer[] = []
    socket.on("data", (chunk: Buffer) => chunks.push(chunk))
    socket.on("error", () => undefined)
    const closed = new Promise<void>((resolve) => {
      socket.once("close", () => {
        resolve()
      })
    })
    await new Promise<void>((resolve) => {
      socket.once("connect", () => {
        resolve()
      })
    })
    const text = () => Buffer.concat(chunks).toString("utf8")
    return { socket, closed, text }
  }

  const request = (headers: Record<string, string>) =>
    `POST /admin/products/prod_01TEST/videos HTTP/1.1\r\n${Object.entries({
      Host: "localhost",
      ...headers,
    })
      .map(([name, value]) => `${name}: ${value}`)
      .join("\r\n")}\r\n\r\n`

  const within = (promise: Promise<unknown>, ms: number) =>
    Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(false)
        }, ms)
      }),
    ])

  it("never drains a stranger's body: answers at once and closes the connection (B1)", async () => {
    const port = await serve()
    const client = await open(port)
    // Declared 53 MB, nothing sent: a drain would wait 30 s for it
    client.socket.write(
      request({
        "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`,
        "Content-Length": String(53 * MB),
      })
    )
    expect(await within(client.closed, 2_000)).toBe(true)
    expect(client.text()).toMatch(/^HTTP\/1\.1 413/)
    expect(client.text().toLowerCase()).toContain("connection: close")
  })

  it("lets go at once of a client that leaves mid-body: no drain, no place held (B4)", async () => {
    mockShop.videos = null
    const port = await serve()
    const client = await open(port)
    client.socket.write(request(form(4 * MB)))
    client.socket.write(Buffer.alloc(MB, 1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    client.socket.destroy()
    for (let tries = 0; tries < 50 && activeDrains() > 0; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    expect(activeDrains()).toBe(0)
    expect(uploadSlotState()).toEqual({ running: 0, waiting: 0 })
    expect(readdirSync(root)).toEqual([])
  })

  it("keeps a kept-alive connection usable after a drained refusal", async () => {
    const port = await serve()
    const client = await open(port)
    const notAForm = (length: number, connection: string) =>
      request({
        ...SIGNED_IN,
        Connection: connection,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(length),
      })
    client.socket.write(notAForm(MB, "keep-alive"))
    client.socket.write(Buffer.alloc(MB, 1))
    for (let tries = 0; tries < 200 && !client.text().includes("video.file_required"); tries++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    // The same connection takes a second request and answers it
    client.socket.write(notAForm(10, "close"))
    client.socket.write("x".repeat(10))
    await client.closed
    expect(client.text().match(/HTTP\/1\.1 415/g)).toHaveLength(2)
  })

  it.each([
    ["no such product", () => (mockShop.videos = null), 404],
    ["no room for a third video", () => (mockShop.videos = [{}, {}]), 400],
    ["the storage full", () => (mockShop.storageFull = true), 403],
  ])("answers %s readably while the client is still sending", async (_, set, status) => {
    set()
    const port = await serve()
    const answer = await send(port, form(4 * MB), 4 * MB)
    expect(answer).toMatchObject({ status, reset: false })
    expect(uploadSlotState()).toEqual({ running: 0, waiting: 0 })
    expect(readdirSync(root)).toEqual([])
  })
})
