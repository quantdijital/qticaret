import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { Server } from "node:http"
import { connect } from "node:net"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { MedusaRequest } from "@medusajs/framework/http"
import type * as TempFiles from "../../../lib/media/video/temp-files"
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

// What the slots said each time a directory was removed (the order on the way out)
const mockRunningAtRemoval: number[] = []
const mockRemoval = { observe: (): void => undefined }
jest.mock("../../../lib/media/video/temp-files", () => {
  const actual = jest.requireActual<typeof TempFiles>("../../../lib/media/video/temp-files")
  return {
    ...actual,
    removeVideoTempDir: async (dir: string) => {
      mockRemoval.observe()
      await actual.removeVideoTempDir(dir)
    },
  }
})
mockRemoval.observe = () => {
  mockRunningAtRemoval.push(uploadSlotState().running)
}

const BOUNDARY = "----qtslot"

/**
 * Security review Y1/O2: an upload the client abandons gives its place back
 * and leaves no directory, as a refused one does, and in that order: the
 * directory goes while the place is still held. Each test's directories
 * are made under a root of its own, so no other test's show here.
 */
describe("a video upload's place among the uploads at once", () => {
  let server: Server
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "qt-test-slot-"))
    mockRunningAtRemoval.length = 0
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
      server.closeAllConnections()
    })
    rmSync(root, { recursive: true, force: true })
  })

  async function abandon(): Promise<string> {
    let settle: (code: string) => void = () => undefined
    const outcome = new Promise<string>((resolve) => {
      settle = resolve
    })
    server = createServer((req, res) => {
      const request = Object.assign(req, { scope: {} }) as unknown as MedusaRequest
      withCheckedVideo(request, "prod_01TEST", () => Promise.resolve("stored"), root).then(
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
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve()
      })
    })
    const socket = connect((server.address() as AddressInfo).port, "127.0.0.1")
    socket.on("error", () => undefined)
    await new Promise<void>((resolve) => {
      socket.once("connect", () => {
        resolve()
      })
    })
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
    expect(await abandon()).toBe("video.unreadable")
    expect(uploadSlotState()).toEqual({ running: 0, waiting: 0 })
    expect(readdirSync(root)).toEqual([])
  })

  it("removes the directory before it gives the place back", async () => {
    await abandon()
    // The place was still held (one upload running) when its directory went
    expect(mockRunningAtRemoval).toEqual([1])
    expect(uploadSlotState().running).toBe(0)
  })
})
