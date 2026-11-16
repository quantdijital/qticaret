import { readFile, readdir, stat } from "node:fs/promises"
import type { IncomingMessage } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { makeVideoTempDir, readHead, receiveVideo, removeVideoTempDir } from ".."

const BOUNDARY = "----qtvideotest"

interface Part {
  name: string
  filename?: string
  type?: string
  body: Buffer | string
}

const multipart = (parts: Part[]): Buffer =>
  Buffer.concat([
    ...parts.flatMap((part) => [
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"` +
          (part.filename === undefined ? "" : `; filename="${part.filename}"`) +
          `\r\n${part.type ? `Content-Type: ${part.type}\r\n` : ""}\r\n`
      ),
      typeof part.body === "string" ? Buffer.from(part.body) : part.body,
      Buffer.from("\r\n"),
    ]),
    Buffer.from(`--${BOUNDARY}--\r\n`),
  ])

/** A request carrying `body` in chunks, as the network gives it. */
function request(body: Buffer, contentType = `multipart/form-data; boundary=${BOUNDARY}`) {
  const chunks: Buffer[] = []
  for (let at = 0; at < body.length; at += 64 * 1024) {
    chunks.push(body.subarray(at, at + 64 * 1024))
  }
  const stream = Readable.from(chunks) as Readable & { headers: Record<string, string> }
  stream.headers = { "content-type": contentType, "content-length": String(body.length) }
  return stream as unknown as IncomingMessage
}

const file = (body: Buffer | string, filename = "klip.mp4"): Part => ({
  name: "file",
  filename,
  type: "video/mp4",
  body,
})

const codeOf = async (promise: Promise<unknown>): Promise<string | null> => {
  try {
    await promise
    return null
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage ?? String(error)
  }
}

describe("a video upload's body, streamed to a private file (adr/0069 §3)", () => {
  let dir: string

  beforeEach(async () => {
    dir = await makeVideoTempDir()
  })

  afterEach(async () => {
    await removeVideoTempDir(dir)
  })

  it("writes the file 0600 in a 0700 directory, counts its bytes, keeps the title", async () => {
    const clip = Buffer.alloc(300 * 1024, 7)
    const received = await receiveVideo(
      request(multipart([{ name: "title", body: "  Bıçak ağzı yakın çekim " }, file(clip)])),
      dir
    )
    expect(received).toEqual({
      path: join(dir, "source"),
      bytes: clip.length,
      title: "Bıçak ağzı yakın çekim",
    })
    expect((await readFile(received.path)).equals(clip)).toBe(true)
    expect((await stat(received.path)).mode & 0o777).toBe(0o600)
    expect((await stat(dir)).mode & 0o777).toBe(0o700)
    expect(dir.startsWith(join(tmpdir(), "qt-video-"))).toBe(true)
    expect([...(await readHead(received.path, 4))]).toEqual([7, 7, 7, 7])
  })

  it("ignores the name and the MIME type sent with the file", async () => {
    const received = await receiveVideo(
      request(multipart([{ ...file("abc"), filename: "../../etc/passwd", type: "text/html" }])),
      dir
    )
    expect(received.path).toBe(join(dir, "source"))
    expect(await readdir(dir)).toEqual(["source"])
  })

  it("cuts the upload the moment it passes the limit", async () => {
    const body = multipart([file(Buffer.alloc(2048, 1))])
    expect(await codeOf(receiveVideo(request(body), dir, 1024))).toBe("video.too_large")
  })

  it("takes a file of exactly the limit", async () => {
    const received = await receiveVideo(
      request(multipart([file(Buffer.alloc(1024, 1))])),
      dir,
      1024
    )
    expect(received.bytes).toBe(1024)
  })

  it.each([
    ["no file part", [{ name: "title", body: "Başlık" }], "video.file_required"],
    ["a file under another name", [{ ...file("abc"), name: "files" }], "video.file_required"],
    ["two files", [file("abc"), file("def", "b.mp4")], "upload.too_many_files"],
    ["an unknown field", [{ name: "kind", body: "youtube" }, file("abc")], "video.file_required"],
    [
      "a title past 200 characters",
      [{ name: "title", body: "a".repeat(201) }, file("abc")],
      "video.title_invalid",
    ],
    ["a title on two lines", [{ name: "title", body: "a\nb" }, file("abc")], "video.title_invalid"],
    ["an empty file", [file("")], "video.unreadable"],
    [
      "three parts",
      [{ name: "title", body: "a" }, file("abc"), { name: "x", body: "y" }],
      "upload.too_many_files",
    ],
  ])("refuses %s", async (_, parts, code) => {
    expect(await codeOf(receiveVideo(request(multipart(parts as Part[])), dir))).toBe(code)
  })

  it("refuses a body that is not multipart, or has no boundary", async () => {
    expect(await codeOf(receiveVideo(request(Buffer.from("{}"), "application/json"), dir))).toBe(
      "video.file_required"
    )
    expect(await codeOf(receiveVideo(request(Buffer.from("x"), "multipart/form-data"), dir))).toBe(
      "video.file_required"
    )
  })

  it("refuses a body cut off in the middle", async () => {
    const body = multipart([file(Buffer.alloc(4096, 3))])
    expect(await codeOf(receiveVideo(request(body.subarray(0, 2000)), dir))).toBe(
      "video.unreadable"
    )
  })

  it("leaves nothing behind once the directory is removed, whatever happened", async () => {
    await codeOf(receiveVideo(request(multipart([file(Buffer.alloc(2048, 1))])), dir, 1024))
    await removeVideoTempDir(dir)
    await expect(stat(dir)).rejects.toMatchObject({ code: "ENOENT" })
    // Removing again is harmless
    await removeVideoTempDir(dir)
  })
})
