import { asValue } from "@medusajs/framework/awilix"
import { Modules, createMedusaContainer } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../../modules/media"
import type { RegisterMediaInput } from "../register-media"
import { registerMediaStep } from "../register-media"

jest.mock("../../../../lib/plan-limits", () => ({
  assertStorageWithinLimit: jest.fn(),
  forgetUsage: jest.fn(),
}))
jest.mock("../../../files/public-upload", () => ({
  // A file storage lacks has no address
  publicUploadUrl: jest.fn((_container: unknown, fileId: string) =>
    Promise.resolve(fileId.startsWith("lost") ? null : `http://files/${fileId}`)
  ),
}))
jest.mock("../../../../lib/media", () => ({
  displayName: (fileId: string) => fileId,
  readImage: () => ({ metadata: () => Promise.resolve({ width: 10, height: 10 }) }),
}))

const media = {
  listMediaAssets: jest.fn(),
  createMediaAssets: jest.fn(),
  updateMediaAssets: jest.fn(),
  deleteMediaAssets: jest.fn(),
}
const files = { getAsBuffer: jest.fn() }

function container() {
  const made = createMedusaContainer()
  made.register({ [MEDIA_MODULE]: asValue(media), [Modules.FILE]: asValue(files) })
  return made
}

const workflow = createWorkflow("test-media-register", (input: RegisterMediaInput) => {
  return new WorkflowResponse(registerMediaStep(input))
})

beforeEach(() => {
  jest.clearAllMocks()
  media.listMediaAssets.mockResolvedValue([])
  media.createMediaAssets.mockImplementation((data: { file_id: string }) =>
    Promise.resolve({ id: `media_${data.file_id}`, ...data })
  )
  media.updateMediaAssets.mockImplementation((data: unknown) => Promise.resolve(data))
  files.getAsBuffer.mockResolvedValue(Buffer.from("image"))
})

describe("registering uploaded files as media assets", () => {
  it("registers every file", async () => {
    const { result } = await workflow(container()).run({ input: { file_ids: ["a", "b"] } })
    expect(result.map((asset) => asset.id)).toEqual(["media_a", "media_b"])
    expect(media.deleteMediaAssets).not.toHaveBeenCalled()
  })

  it("undoes the records of earlier files when a later one fails", async () => {
    media.listMediaAssets.mockImplementation(({ url }: { url: string }) =>
      Promise.resolve(url.endsWith("/known") ? [{ id: "media_known", in_library: false }] : [])
    )
    const { errors } = await workflow(container()).run({
      input: { file_ids: ["a", "known", "b", "lost-c"], library: true },
      throwOnError: false,
    })
    expect(errors[0]?.error).toMatchObject({ message: "media.file_unknown" })
    // No record is left with no file, counted in the storage quota
    expect(media.deleteMediaAssets).toHaveBeenCalledWith(["media_a", "media_b"])
    // The record that joined the library now leaves it again
    expect(media.updateMediaAssets).toHaveBeenLastCalledWith([
      { id: "media_known", in_library: false },
    ])
  })

  it("undoes them when storage fails reading a later file", async () => {
    files.getAsBuffer.mockImplementation((fileId: string) =>
      fileId === "b" ? Promise.reject(new Error("storage down")) : Promise.resolve(Buffer.from("x"))
    )
    const { errors } = await workflow(container()).run({
      input: { file_ids: ["a", "b"] },
      throwOnError: false,
    })
    expect(errors).toHaveLength(1)
    expect(media.deleteMediaAssets).toHaveBeenCalledWith(["media_a"])
  })

  it("records an AI result beside its original and counts its bytes in the storage (Aşama 4)", async () => {
    const { assertStorageWithinLimit } = jest.requireMock<{ assertStorageWithinLimit: jest.Mock }>(
      "../../../../lib/plan-limits"
    )
    await workflow(container()).run({
      input: {
        file_ids: ["edited"],
        origin: { ai_source: "edited", derived_from_id: "media_original" },
      },
    })
    expect(media.createMediaAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        file_id: "edited",
        ai_source: "edited",
        derived_from_id: "media_original",
        in_library: false,
      })
    )
    expect(assertStorageWithinLimit).toHaveBeenCalledWith(expect.anything(), 5)
    // The original is not written
    expect(media.updateMediaAssets).not.toHaveBeenCalled()
  })
})
