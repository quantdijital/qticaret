import { readdirSync } from "node:fs"
import { createServer } from "node:http"
import type { Server } from "node:http"
import { connect } from "node:net"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import type { MedusaRequest } from "@medusajs/framework/http"
import { uploadSlotState, withCheckedVideo } from "../video-upload"

// The machine's programs and the shop's records are not this test's: open, empty, room left
jest.mock("../../../lib/media/video/tools", () => ({
  ...jest.requireActual<object>("../../../lib/media/video/tools"),
  videoUploadAvailable: () => Promise.resolve(true),
}))
jest.mock("../../../workflows/media/video/read", () => ({
  productVideos: () => Promise.resolve([]),
}))
jest.mock("../../../lib/plan-limits", () => ({
  assertStorageFits: () => Promise.resolve(),
}))

const BOUNDARY = "----qtslot"
const uploadDirs = () => readdirSync(tmpdir()).filter((name) => /^qt-video-[^c]/.test(name))

/**
 * Security review Y1/O2: an upload the client abandons gives its place back
 * and leaves no directory, as a refused one does.
 */
describe("a video upload's place among the uploads at once", () => {
  let server: Server

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
      server.closeAllConnections()
    })
  })

  async function abandon(): Promise<string> {
    let settle: (code: string) => void = () => undefined
    const outcome = new Promise<string>((resolve) => {
      settle = resolve
    })
    server = createServer((req, res) => {
      const request = Object.assign(req, { scope: {} }) as unknown as MedusaRequest
      withCheckedVideo(request, "prod_01TEST", () => Promise.resolve("stored")).then(
        () => {
          settle("stored")
          res.end()
        },
        (error: unknown) => {
          settle((error as { safeMessage?: string }).safeMessage ?? "thrown")
          res.end()
        }
      )
    })
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => {
        resolve()
      })
    )
    const socket = connect((server.address() as AddressInfo).port, "127.0.0.1")
    socket.on("error", () => undefined)
    await new Promise<void>((resolve) =>
      socket.once("connect", () => {
        resolve()
      })
    )
    socket.write(
      `POST /v HTTP/1.1\r\nHost: x\r\nContent-Type: multipart/form-data; boundary=${BOUNDARY}\r\n` +
        "Content-Length: 1048576\r\n\r\n" +
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.mp4"\r\n\r\n`
    )
    socket.write(Buffer.alloc(64 * 1024, 1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    socket.destroy()
    return await outcome
  }

  it("gives its place back and leaves no directory when the client goes away", async () => {
    const before = uploadDirs()
    expect(await abandon()).toBe("video.unreadable")
    expect(uploadSlotState()).toEqual({ running: 0, waiting: 0 })
    expect(uploadDirs()).toEqual(before)
  })
})
