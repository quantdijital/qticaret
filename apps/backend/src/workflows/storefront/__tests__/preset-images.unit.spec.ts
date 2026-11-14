import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import sharp from "sharp"
import { MEDIA_MODULE } from "../../../modules/media"
import type { MediaAssetRecord } from "../../../modules/media/service"
import { SECTOR_PACKS_MODULE } from "../../../modules/sector-packs"
import {
  planPresetImagesStep,
  recordPresetImagesStep,
  storePresetImagesStep,
} from "../preset-images"

jest.mock("../../../lib/plan-limits", () => ({ assertStorageFits: jest.fn() }))

const ledger = {
  listSectorPackItems: jest.fn(),
  createSectorPackItems: jest.fn(),
  updateSectorPackItems: jest.fn(),
  deleteSectorPackItems: jest.fn(),
}
const media = { listMediaAssets: jest.fn() }
const files = { getUploadStream: jest.fn(), deleteFiles: jest.fn() }
let stored = 0

function container() {
  const made = createMedusaContainer()
  made.register({
    [SECTOR_PACKS_MODULE]: asValue(ledger),
    [MEDIA_MODULE]: asValue(media),
    [Modules.FILE]: asValue(files),
  })
  return made
}

// The library's registration stands in here: each stored file becomes a record
const registerStep = createStep("test-preset-register", (fileIds: string[]) => {
  const assets = fileIds.map((id) => ({ id: `media_${id}`, url: `http://files/${id}` }))
  return new StepResponse(assets as unknown as MediaAssetRecord[])
})
const failStep = createStep("test-preset-fail", (fail: boolean) => {
  if (fail) {
    throw new Error("the draft refused")
  }
  return new StepResponse(undefined)
})

interface Input {
  dir: string
  images: string[]
  fail: boolean
}

const workflow = createWorkflow("test-preset-images", (input: Input) => {
  const plan = planPresetImagesStep(
    transform({ input }, ({ input }) => ({ pack: "general", code: "vitrin", images: input.images }))
  )
  const fileIds = storePresetImagesStep(
    transform({ input, plan }, ({ input, plan }) => ({ dir: input.dir, upload: plan.upload }))
  )
  const assets = registerStep(fileIds)
  const recorded = recordPresetImagesStep(
    transform({ plan, assets }, ({ plan, assets }) => ({
      pack: "general",
      code: "vitrin",
      version: 3,
      plan,
      assets,
    }))
  )
  failStep(transform({ input }, ({ input }) => input.fail))
  return new WorkflowResponse(recorded)
})

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "preset-images-"))
  mkdirSync(join(dir, "images"))
  const png = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 90, b: 96 } },
  })
    .png()
    .toBuffer()
  writeFileSync(join(dir, "images", "hero.png"), png)
  writeFileSync(join(dir, "images", "kart.png"), png)
  writeFileSync(join(dir, "images", "eski.png"), png)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  jest.clearAllMocks()
  stored = 0
  files.getUploadStream.mockImplementation(() => {
    stored += 1
    const fileKey = `file_${String(stored)}`
    return Promise.resolve({
      writeStream: { end: jest.fn() },
      promise: Promise.resolve(),
      fileKey,
      url: `http://files/${fileKey}`,
    })
  })
  files.deleteFiles.mockResolvedValue(undefined)
  ledger.createSectorPackItems.mockImplementation((row: { key: string }) =>
    Promise.resolve({ id: `spitm_${row.key}` })
  )
  ledger.updateSectorPackItems.mockResolvedValue({})
  ledger.deleteSectorPackItems.mockResolvedValue(undefined)
  // hero.png uploaded before and still there; eski.png uploaded before, deleted since
  ledger.listSectorPackItems.mockImplementation((filters: { id?: string }) =>
    Promise.resolve(
      filters.id
        ? [{ id: filters.id, record_id: "media_gone" }]
        : [
            {
              id: "spitm_hero",
              key: "preset_image:vitrin/images/hero.png",
              record_id: "media_hero",
            },
            {
              id: "spitm_eski",
              key: "preset_image:vitrin/images/eski.png",
              record_id: "media_gone",
            },
          ]
    )
  )
  media.listMediaAssets.mockResolvedValue([{ id: "media_hero", url: "http://files/hero" }])
})

const run = (fail: boolean) =>
  workflow(container()).run({
    input: { dir, images: ["images/eski.png", "images/hero.png", "images/kart.png"], fail },
    throwOnError: false,
  })

describe("a preset's images in the media library (adr/0063 §4.3)", () => {
  it("uploads only what is not in the library, recording each by its path", async () => {
    const { result, errors } = await run(false)
    expect(errors).toEqual([])
    expect(files.getUploadStream).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      images: {
        "images/hero.png": "http://files/hero",
        "images/eski.png": "http://files/file_1",
        "images/kart.png": "http://files/file_2",
      },
      added: 2,
      kept: 1,
    })
    // The one deleted since: its record names the new image; the new one is recorded
    expect(ledger.updateSectorPackItems).toHaveBeenCalledWith({
      id: "spitm_eski",
      record_id: "media_file_1",
    })
    expect(ledger.createSectorPackItems).toHaveBeenCalledWith({
      pack: "general",
      key: "preset_image:vitrin/images/kart.png",
      kind: "preset_image",
      outcome: "added",
      version: 3,
      record_id: "media_file_2",
    })
    expect(files.deleteFiles).not.toHaveBeenCalled()
  })

  it("uploads nothing when every image is still there", async () => {
    media.listMediaAssets.mockResolvedValue([{ id: "media_hero", url: "http://files/hero" }])
    const { result } = await workflow(container()).run({
      input: { dir, images: ["images/hero.png"], fail: false },
    })
    expect(result).toEqual({
      images: { "images/hero.png": "http://files/hero" },
      added: 0,
      kept: 1,
    })
    expect(files.getUploadStream).not.toHaveBeenCalled()
    expect(ledger.createSectorPackItems).not.toHaveBeenCalled()
  })

  it("undone, removes the files it stored and puts the records back", async () => {
    const { errors } = await run(true)
    expect(errors).toHaveLength(1)
    expect(files.deleteFiles).toHaveBeenCalledWith(["file_1", "file_2"])
    expect(ledger.deleteSectorPackItems).toHaveBeenCalledWith([
      "spitm_preset_image:vitrin/images/kart.png",
    ])
    expect(ledger.updateSectorPackItems).toHaveBeenLastCalledWith({
      id: "spitm_eski",
      record_id: "media_gone",
    })
  })

  it("refuses a file that is not the image it claims, storing nothing", async () => {
    writeFileSync(join(dir, "images", "kart.png"), "not an image")
    const { errors } = await run(false)
    expect(String((errors[0]?.error as { message?: unknown } | undefined)?.message)).toMatch(
      /upload\.unsupported_type/
    )
    expect(files.getUploadStream).not.toHaveBeenCalled()
    expect(ledger.createSectorPackItems).not.toHaveBeenCalled()
  })
})
