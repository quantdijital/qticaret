import { asValue } from "@medusajs/framework/awilix"
import { MedusaError, createMedusaContainer } from "@medusajs/framework/utils"
import { PlanLimitError } from "../../../../lib/errors"
import { MEDIA_MODULE } from "../../../../modules/media"
import { STORAGE_FULL } from "../edit-image"
import type { EditImageOutcome } from "../edit-image"
import { RESULT_NOT_KEPT, keepEditedImage } from "../keep-edited-image"

/**
 * The edited picture kept as a media record (altın kural 4): a result
 * that cannot be kept is removed from storage and the attempt goes on as
 * failed, so its usage row (the paid call) is still written.
 */

jest.mock("../../../media/files", () => ({ removeFiles: jest.fn() }))
jest.mock("../../../media/steps/register-media", () => ({
  registerMedia: jest.fn(),
  undoRegistration: jest.fn(),
}))
const { removeFiles } = jest.requireMock<{ removeFiles: jest.Mock }>("../../../media/files")
const { registerMedia } = jest.requireMock<{ registerMedia: jest.Mock }>(
  "../../../media/steps/register-media"
)

const STORED: EditImageOutcome = {
  status: "succeeded",
  model: "segment-v1",
  text: null,
  problems: [],
  input_tokens: null,
  output_tokens: null,
  duration_ms: 12,
  error_key: null,
  error_code: null,
  retry_after_ms: null,
  file_id: "stored-result.png",
  images: 1,
}
const INPUT = { outcome: STORED, media_id: "media_original", user_id: "user_1" }

const media = { listMediaAssets: jest.fn() }
function container() {
  const made = createMedusaContainer()
  made.register({ [MEDIA_MODULE]: asValue(media) })
  return made
}

beforeEach(() => {
  jest.clearAllMocks()
  removeFiles.mockResolvedValue(true)
  media.listMediaAssets.mockResolvedValue([])
})

describe("keeping an edited picture", () => {
  it("registers the result beside the original, out of the library", async () => {
    const undo = { created: ["media_new"], kept: [] }
    registerMedia.mockResolvedValueOnce({ assets: [{ id: "media_new" }], undo })

    const { kept, undo: returned } = await keepEditedImage(container(), INPUT)

    expect(registerMedia).toHaveBeenCalledWith(expect.anything(), {
      file_ids: ["stored-result.png"],
      library: false,
      uploaded_by: "user_1",
      origin: { ai_source: "edited", derived_from_id: "media_original" },
    })
    expect(kept).toMatchObject({ status: "succeeded", text: "media_new", images: 1 })
    expect(returned).toBe(undo)
    expect(removeFiles).not.toHaveBeenCalled()
  })

  it("records a generated scene as generated, as its file is marked", async () => {
    registerMedia.mockResolvedValueOnce({ assets: [{ id: "media_new" }], undo: null })
    await keepEditedImage(container(), {
      ...INPUT,
      outcome: { ...STORED, ai_source: "generated" },
    })
    expect(registerMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        origin: { ai_source: "generated", derived_from_id: "media_original" },
      })
    )
  })

  it("removes the stored file and goes on as failed when the record cannot be made", async () => {
    registerMedia.mockRejectedValueOnce(new MedusaError(MedusaError.Types.DB_ERROR, "db down"))

    const { kept, undo } = await keepEditedImage(container(), INPUT)

    expect(removeFiles).toHaveBeenCalledWith(expect.anything(), ["stored-result.png"])
    // The call was paid for: the usage row still counts the image
    expect(kept).toMatchObject({
      status: "failed",
      text: null,
      file_id: null,
      error_code: RESULT_NOT_KEPT,
      images: 1,
    })
    expect(undo).toBeNull()
  })

  it("keeps the file when a record still names it (the registration's undo failed)", async () => {
    registerMedia.mockRejectedValueOnce(new MedusaError(MedusaError.Types.DB_ERROR, "db down"))
    media.listMediaAssets.mockResolvedValueOnce([{ id: "media_left" }])

    const { kept } = await keepEditedImage(container(), INPUT)

    expect(media.listMediaAssets).toHaveBeenCalledWith(
      { file_id: "stored-result.png" },
      expect.anything()
    )
    expect(removeFiles).not.toHaveBeenCalled()
    // The attempt still goes on as failed, its usage row written
    expect(kept).toMatchObject({ status: "failed", error_code: RESULT_NOT_KEPT, images: 1 })
  })

  it("keeps the file when it cannot tell whether a record is left", async () => {
    registerMedia.mockRejectedValueOnce(new MedusaError(MedusaError.Types.DB_ERROR, "db down"))
    media.listMediaAssets.mockRejectedValueOnce(new Error("db down"))

    const { kept } = await keepEditedImage(container(), INPUT)

    expect(removeFiles).not.toHaveBeenCalled()
    expect(kept).toMatchObject({ status: "failed", error_code: RESULT_NOT_KEPT })
  })

  it("says the storage filled meanwhile, so the job stops", async () => {
    registerMedia.mockRejectedValueOnce(new PlanLimitError("storage_mb", 10, 10))
    const { kept } = await keepEditedImage(container(), INPUT)
    expect(kept).toMatchObject({ status: "failed", error_code: STORAGE_FULL, images: 1 })
    expect(removeFiles).toHaveBeenCalledTimes(1)
  })

  it("passes an outcome without a file through untouched", async () => {
    const failed: EditImageOutcome = {
      ...STORED,
      status: "failed",
      file_id: null,
      images: null,
      error_key: "ai.key_rejected",
    }
    const { kept, undo } = await keepEditedImage(container(), {
      ...INPUT,
      outcome: failed,
    })
    expect(kept).toMatchObject({ status: "failed", error_key: "ai.key_rejected", images: null })
    expect(undo).toBeNull()
    expect(registerMedia).not.toHaveBeenCalled()
  })
})
