import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readlinkSync } from "node:fs"
import { createServer } from "node:http"
import type { IncomingMessage, Server } from "node:http"
import { connect } from "node:net"
import type { AddressInfo } from "node:net"
import { makeVideoTempDir, receiveVideo, removeVideoTempDir } from ".."

/**
 * A real socket under the receiver (security review Y1): a browser tab
 * closed in the middle of an upload, a client gone silent, a body past the
 * limit, a broken body. Whatever happens the upload's file is closed (no
 * descriptor left open) and its directory can be removed.
 */

const FD_DIR = existsSync("/proc/self/fd") ? "/proc/self/fd" : "/dev/fd"
const openFds = () => readdirSync(FD_DIR).length

/** Files of uploads this process still holds open, by their path (removed ones too). */
function openUploadFiles(): string[] {
  if (existsSync("/proc/self/fd")) {
    return readdirSync("/proc/self/fd").flatMap((fd) => {
      try {
        const target = readlinkSync(`/proc/self/fd/${fd}`)
        return target.includes("qt-video-") ? [target] : []
      } catch {
        return []
      }
    })
  }
  const listed = spawnSync("lsof", ["-p", String(process.pid)], { encoding: "utf8" })
  return listed.stdout.split("\n").filter((line) => line.includes("qt-video-"))
}
const BOUNDARY = "----qtsocket"

interface Outcome {
  code: string | null
  dir: string
}

/** A server that hands each request to the receiver and reports how it ended. */
function receiver(maxBytes?: number, timeouts?: { idleMs: number; totalMs: number }) {
  const outcomes: Promise<Outcome>[] = []
  const server: Server = createServer((req: IncomingMessage, res) => {
    outcomes.push(
      (async () => {
        const dir = await makeVideoTempDir()
        try {
          await receiveVideo(req, dir, maxBytes, timeouts)
          res.end("ok")
          return { code: null, dir }
        } catch (error) {
          if (!res.headersSent && !res.destroyed) {
            res.statusCode = 400
            res.end("refused")
          }
          return { code: (error as { safeMessage?: string }).safeMessage ?? "thrown", dir }
        } finally {
          await removeVideoTempDir(dir)
        }
      })()
    )
  })
  return { server, outcomes }
}

const listen = (server: Server) =>
  new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port)
    })
  })

const head = (length: number) =>
  `POST /up HTTP/1.1\r\nHost: localhost\r\nContent-Type: multipart/form-data; boundary=${BOUNDARY}\r\n` +
  `Content-Length: ${String(length)}\r\nConnection: close\r\n\r\n`

const partHead =
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.mp4"\r\n` +
  "Content-Type: video/mp4\r\n\r\n"

/** Sends `chunks` on a raw socket, then destroys it (or ends it) after `pauseMs`. */
async function send(
  port: number,
  chunks: (string | Buffer)[],
  end: "destroy" | "end",
  pauseMs = 50
) {
  const socket = connect(port, "127.0.0.1")
  socket.on("error", () => undefined)
  // The answer is read, so the server's close reaches this side and its socket closes too
  socket.resume()
  await new Promise<void>((resolve) =>
    socket.once("connect", () => {
      resolve()
    })
  )
  for (const chunk of chunks) {
    socket.write(chunk)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  await new Promise((resolve) => setTimeout(resolve, pauseMs))
  if (end === "destroy") {
    socket.destroy()
  } else {
    socket.end()
  }
}

async function settled(outcomes: Promise<Outcome>[]): Promise<Outcome> {
  for (let tries = 0; tries < 200 && outcomes.length === 0; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const [outcome] = outcomes
  if (!outcome) {
    throw new Error("the server saw no request")
  }
  return await outcome
}

describe("the receiver on a real socket (security review Y1, O2)", () => {
  let server: Server | null = null

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => {
          resolve()
        })
        server.closeAllConnections()
      } else {
        resolve()
      }
    })
    server = null
  })

  async function run(
    chunks: (string | Buffer)[],
    end: "destroy" | "end",
    options: {
      maxBytes?: number
      timeouts?: { idleMs: number; totalMs: number }
      pauseMs?: number
    } = {}
  ) {
    const before = openFds()
    const made = receiver(options.maxBytes, options.timeouts)
    server = made.server
    const port = await listen(made.server)
    await send(port, chunks, end, options.pauseMs)
    const outcome = await settled(made.outcomes)
    // The sockets closed first: only a file left open can count
    await new Promise<void>((resolve) => {
      made.server.close(() => {
        resolve()
      })
      made.server.closeAllConnections()
    })
    server = null
    await new Promise((resolve) => setTimeout(resolve, 50))
    // No upload's file open, whatever else the process holds
    expect(openUploadFiles()).toEqual([])
    return { outcome, leaked: openFds() - before }
  }

  it("closes the file when the client goes away in the middle of the file", async () => {
    const { outcome, leaked } = await run(
      [head(10 * 1024 * 1024), partHead, Buffer.alloc(256 * 1024, 1)],
      "destroy"
    )
    expect(outcome.code).toBe("video.unreadable")
    expect(existsSync(outcome.dir)).toBe(false)
    expect(leaked).toBeLessThanOrEqual(0)
  })

  it("closes the file when the client goes away right after the headers", async () => {
    const { outcome, leaked } = await run([head(1024 * 1024), partHead], "destroy")
    expect(outcome.code).toBe("video.unreadable")
    expect(existsSync(outcome.dir)).toBe(false)
    expect(leaked).toBeLessThanOrEqual(0)
  })

  it("closes the file when the body passes the limit", async () => {
    const { outcome, leaked } = await run(
      [head(10 * 1024 * 1024), partHead, Buffer.alloc(300 * 1024, 1)],
      "destroy",
      { maxBytes: 64 * 1024 }
    )
    expect(outcome.code).toBe("video.too_large")
    expect(existsSync(outcome.dir)).toBe(false)
    expect(leaked).toBeLessThanOrEqual(0)
  })

  it("closes the file on a broken body", async () => {
    const broken = `${partHead}${"x".repeat(1000)}\r\n--${BOUNDARY}\r\nnot a header line\r\n\r\n`
    const { outcome, leaked } = await run([head(broken.length), broken], "end")
    expect(outcome.code).not.toBeNull()
    expect(existsSync(outcome.dir)).toBe(false)
    expect(leaked).toBeLessThanOrEqual(0)
  })

  it("gives up on a client gone silent, and on one too slow in all", async () => {
    const silent = await run([head(1024 * 1024), partHead, "abc"], "end", {
      timeouts: { idleMs: 100, totalMs: 10_000 },
      pauseMs: 400,
    })
    expect(silent.outcome.code).toBe("video.upload_timeout")
    expect(silent.leaked).toBeLessThanOrEqual(0)
    // A trickle: never silent long, too long in all
    const trickle = Array.from({ length: 60 }, () => "x".repeat(16))
    const slow = await run([head(1024 * 1024), partHead, ...trickle], "end", {
      timeouts: { idleMs: 1_000, totalMs: 300 },
    })
    expect(slow.outcome.code).toBe("video.upload_timeout")
    expect(existsSync(slow.outcome.dir)).toBe(false)
  })
})
