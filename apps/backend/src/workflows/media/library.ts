import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  assertMediaUnusedStep,
  removeDeletedMediaFilesStep,
  softDeleteMediaStep,
  storeImportedImageStep,
} from "./steps/library"
import { registerMediaStep } from "./steps/register-media"

/**
 * An image at an address the shop gave, brought into the media library
 * (docs/06 Ortam kütüphanesi): fetched safely, checked and cleaned as an
 * upload, stored, recorded. A failed record removes the stored file.
 */
export const importMediaWorkflow = createWorkflow(
  "media-import",
  (input: { url: string; uploaded_by: string | null }) => {
    const fileId = storeImportedImageStep(transform({ input }, ({ input }) => ({ url: input.url })))
    const assets = registerMediaStep(
      transform({ input, fileId }, ({ input, fileId }) => ({
        file_ids: [fileId],
        library: true,
        uploaded_by: input.uploaded_by,
      }))
    )
    return new WorkflowResponse(assets)
  }
)

/**
 * An image deleted from the library: refused while anything shows it
 * (409 `media.in_use`), else its record and then its files go. Storage
 * refusing brings the record back.
 */
export const deleteMediaWorkflow = createWorkflow("media-delete", (input: { id: string }) => {
  const doomed = assertMediaUnusedStep(transform({ input }, ({ input }) => input.id))
  softDeleteMediaStep(transform({ doomed }, ({ doomed }) => doomed.id))
  const removed = removeDeletedMediaFilesStep(doomed)
  return new WorkflowResponse(removed)
})
