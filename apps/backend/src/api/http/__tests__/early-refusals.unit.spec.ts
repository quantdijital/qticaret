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
      const req = Object.assign(incoming, { scope: {} }) as unknown as MedusaRequest
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

  const form = (length: number) => ({
    "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`,
    "Content-Length": String(length),
  })

  it.each([
    ["a body past 52 MB", form(53 * MB), 53 * MB, 413, "video.too_large"],
    [
      "a body that is not a form",
      { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(2 * MB) },
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
        "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`,
        "Transfer-Encoding": "chunked",
      },
      0
    )
    expect(answer.status).toBe(411)
    expect(answer.body).toContain("errors.length_required")
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
