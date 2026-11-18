import { Readable } from "node:stream"
import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import sharp from "sharp"
import { resetAiBreakers } from "../../../../lib/ai/breaker"
import { VISION_SOURCE_MAX_BYTES } from "../../../../lib/ai/image-input"
import { PlanLimitError } from "../../../../lib/errors"
import { DIGITAL_SOURCE_TYPES, digitalSourceTypeOf } from "../../../../lib/media"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import { MEDIA_MODULE } from "../../../../modules/media"
import { STORAGE_FULL, editImage } from "../edit-image"

/**
 * One picture's edit (Aşama 4) with the fake service: the original is
 * read and never written, the result is a new file marked as AI edited,
 * the package's storage is asked before the call and before the file is
 * kept, and nothing is called for a picture no service may read.
 */

jest.mock("../../../../lib/plan-limits", () => ({ assertStorageFits: jest.fn() }))
const { assertStorageFits } = jest.requireMock<{ assertStorageFits: jest.Mock }>(
  "../../../../lib/plan-limits"
)

jest.setTimeout(30_000)

const media = { listMediaAssets: jest.fn() }
const credentials = { read: jest.fn() }
const uploads: { filename: string; mimeType: string; bytes: Buffer }[] = []
const files = {
  getDownloadStream: jest.fn((): Promise<Readable> => Promise.resolve(Readable.from([original]))),
  deleteFiles: jest.fn(),
  getUploadStream: jest.fn((input: { filename: string; mimeType: string }) => {
    let bytes: Buffer = Buffer.alloc(0)
    return Promise.resolve({
      fileKey: `stored-${input.filename}`,
      url: `http://files/${input.filename}`,
      promise: Promise.resolve(),
      writeStream: {
        end: (chunk: Buffer) => {
          bytes = chunk
          uploads.push({ ...input, bytes })
        },
      },
    })
  }),
}

function container() {
  const made = createMedusaContainer()
  made.register({
    [MEDIA_MODULE]: asValue(media),
    [Modules.FILE]: asValue(files),
    [INTEGRATION_CREDENTIALS_MODULE]: asValue(credentials),
  })
  return made
}

const INPUT = {
  task: "image_background",
  service: "fake",
  background: "white" as const,
  media_id: "media_original",
}

let original: Buffer
beforeAll(async () => {
  original = await sharp({
    create: { width: 80, height: 60, channels: 4, background: { r: 0, g: 90, b: 160, alpha: 0.5 } },
  })
    .png()
    .toBuffer()
})

beforeEach(() => {
  jest.clearAllMocks()
  resetAiBreakers()
  uploads.length = 0
  assertStorageFits.mockResolvedValue(undefined)
  media.listMediaAssets.mockResolvedValue([
    {
      id: "media_original",
      file_id: "original-key",
      filename: "Kupa Fotoğrafı.png",
      mime_type: "image/png",
    },
  ])
  credentials.read.mockResolvedValue({ secrets: { api_key: "test-key-fake-service" } })
  files.getDownloadStream.mockImplementation(() =>
    Promise.resolve(Readable.from([Buffer.from(original)]))
  )
})

describe("editing one picture's background", () => {
  it("keeps the original's bytes and stores the result as a new marked file", async () => {
    const outcome = await editImage(container(), INPUT)

    expect(outcome).toMatchObject({ status: "succeeded", error_key: null, model: "fake-image" })
    expect(outcome.file_id).toBe(uploads[0] ? `stored-${uploads[0].filename}` : "none")
    // One new file; the original's key is only read
    expect(uploads).toHaveLength(1)
    expect(files.getDownloadStream).toHaveBeenCalledWith("original-key")
    expect(uploads[0]?.filename).toMatch(/^kupa-fotografi-ai.*\.png$/)
    expect(uploads[0]?.bytes.equals(original)).toBe(false)
    const meta = await sharp(uploads[0]?.bytes).metadata()
    expect(digitalSourceTypeOf(meta.xmp)).toBe(DIGITAL_SOURCE_TYPES.edited)
    // The step's outcome carries the file's key, never bytes or the key
    expect(JSON.stringify(outcome)).not.toContain("test-key")
    expect(JSON.stringify(outcome).length).toBeLessThan(1000)
  })

  it("asks the storage before the call and again with the result's size", async () => {
    await editImage(container(), INPUT)
    expect(assertStorageFits).toHaveBeenCalledTimes(2)
    const calls = assertStorageFits.mock.calls as [unknown, number][]
    expect(calls[0]?.[1]).toBe(original.length)
    expect(calls[1]?.[1]).toBe(uploads[0]?.bytes.length)
  })

  it("calls nothing and keeps nothing when the storage is full", async () => {
    assertStorageFits.mockRejectedValueOnce(new PlanLimitError("storage_mb", 100, 100))
    const outcome = await editImage(container(), INPUT)
    expect(outcome).toMatchObject({
      status: "failed",
      error_code: STORAGE_FULL,
      file_id: null,
      images: null,
    })
    expect(credentials.read).not.toHaveBeenCalled()
    expect(uploads).toHaveLength(0)
  })

  it("counts the image the service gave back when the storage fills after the call", async () => {
    assertStorageFits
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new PlanLimitError("storage_mb", 100, 100))
    const outcome = await editImage(container(), INPUT)
    expect(outcome).toMatchObject({
      status: "failed",
      error_code: STORAGE_FULL,
      file_id: null,
      images: 1,
    })
    expect(uploads).toHaveLength(0)
  })

  it("counts one image on a kept result", async () => {
    expect(await editImage(container(), INPUT)).toMatchObject({ status: "succeeded", images: 1 })
  })

  it("refuses a stored file past the AI source limit without reading it whole", async () => {
    const big = Buffer.alloc(VISION_SOURCE_MAX_BYTES / 4)
    files.getDownloadStream.mockResolvedValueOnce(Readable.from([big, big, big, big, big]))
    expect(await editImage(container(), INPUT)).toMatchObject({
      error_key: "ai.input_unsupported",
      error_code: "image_size",
    })
    expect(credentials.read).not.toHaveBeenCalled()
  })

  it("sends no SVG and no picture without a master; the quota claim is given back for both", async () => {
    files.getDownloadStream.mockResolvedValueOnce(
      Readable.from([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')])
    )
    expect(await editImage(container(), INPUT)).toMatchObject({
      error_key: "ai.input_unsupported",
      error_code: "svg",
    })
    media.listMediaAssets.mockResolvedValueOnce([{ id: "media_original", file_id: null }])
    expect(await editImage(container(), INPUT)).toMatchObject({
      error_key: "ai.unknown_entity",
      error_code: "no_master",
    })
    expect(credentials.read).not.toHaveBeenCalled()
    expect(uploads).toHaveLength(0)
  })

  it("refuses a service with no key, a text task, an unknown service", async () => {
    credentials.read.mockResolvedValueOnce(null)
    expect(await editImage(container(), INPUT)).toMatchObject({
      error_key: "ai.service_unavailable",
      error_code: "no_credentials",
    })
    expect(await editImage(container(), { ...INPUT, task: "seo_title" })).toMatchObject({
      error_key: "ai.service_unavailable",
      error_code: "not_registered",
    })
    expect(await editImage(container(), { ...INPUT, service: "deepseek" })).toMatchObject({
      error_key: "ai.service_unavailable",
    })
    expect(uploads).toHaveLength(0)
  })
})
