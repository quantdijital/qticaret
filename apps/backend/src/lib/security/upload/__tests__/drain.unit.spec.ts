import type { IncomingMessage } from "node:http"
import { Readable } from "node:stream"
import { MAX_CONCURRENT_DRAINS, activeDrains, drainBody } from "../drain"

/** A request body that sends `bytes` now and then nothing more until `end()`. */
function body(declared: number, bytes = 0) {
  const stream = new Readable({ read: () => undefined }) as Readable & {
    headers: Record<string, string>
    complete: boolean
  }
  stream.headers = { "content-length": String(declared) }
  stream.complete = false
  if (bytes > 0) {
    stream.push(Buffer.alloc(bytes, 1))
  }
  const end = () => {
    stream.complete = true
    stream.push(null)
  }
  return { req: stream as unknown as IncomingMessage, end, stream }
}

const MB = 1024 * 1024

describe("draining a refused upload's body (security review B1, B4)", () => {
  it("reads a body to its end and says so", async () => {
    const { req, end } = body(2 * MB, MB)
    const drained = drainBody(req, { maxBytes: 4 * MB })
    end()
    await expect(drained).resolves.toBe(true)
    expect(activeDrains()).toBe(0)
  })

  it("does not wait for a body declared past its bound, or of unknown length", async () => {
    await expect(drainBody(body(8 * MB).req, { maxBytes: 4 * MB })).resolves.toBe(false)
    const unknown = body(0)
    unknown.stream.headers = {}
    await expect(drainBody(unknown.req, { maxBytes: 4 * MB })).resolves.toBe(false)
    expect(activeDrains()).toBe(0)
  })

  it("gives up on a body that stops short of what it declared, after its time", async () => {
    const { req } = body(2 * MB, MB)
    const started = Date.now()
    await expect(drainBody(req, { maxBytes: 4 * MB, maxMs: 50 })).resolves.toBe(false)
    expect(Date.now() - started).toBeLessThan(1_000)
    expect(activeDrains()).toBe(0)
  })

  it("answers at once for a client already gone, or a body already read", async () => {
    const gone = body(2 * MB)
    gone.stream.destroy()
    await expect(drainBody(gone.req, { maxBytes: 4 * MB })).resolves.toBe(false)
    const read = body(2 * MB)
    read.stream.complete = true
    await expect(drainBody(read.req, { maxBytes: 4 * MB })).resolves.toBe(true)
  })

  it("stops waiting when the client goes away mid-body", async () => {
    const { req, stream } = body(2 * MB, MB)
    const drained = drainBody(req, { maxBytes: 4 * MB })
    stream.destroy()
    await expect(drained).resolves.toBe(false)
    expect(activeDrains()).toBe(0)
  })

  it("drains at most four at once; one more is answered without waiting", async () => {
    const held = Array.from({ length: MAX_CONCURRENT_DRAINS }, () => body(2 * MB))
    const waiting = held.map(({ req }) => drainBody(req, { maxBytes: 4 * MB }))
    expect(activeDrains()).toBe(MAX_CONCURRENT_DRAINS)
    const started = Date.now()
    await expect(drainBody(body(2 * MB).req, { maxBytes: 4 * MB })).resolves.toBe(false)
    expect(Date.now() - started).toBeLessThan(100)
    for (const { end } of held) {
      end()
    }
    await expect(Promise.all(waiting)).resolves.toEqual(held.map(() => true))
    expect(activeDrains()).toBe(0)
  })
})
