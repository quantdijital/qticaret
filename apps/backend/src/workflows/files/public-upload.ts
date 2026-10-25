import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"

/**
 * The URL of a file the shop uploaded, for a page to show (a logo, a
 * share image), or null. A job's result file is never one: it can hold
 * personal data and is served only through its own checked route
 * (adr/0014), so a page must not hand its URL out.
 */
export async function publicUploadUrl(
  container: MedusaContainer,
  fileId: string
): Promise<string | null> {
  const jobs = await container
    .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    .listAsyncJobs({ result_file_id: fileId }, { select: ["id"], take: 1 })
  if (jobs.length > 0) {
    return null
  }
  try {
    return (await container.resolve(Modules.FILE).retrieveFile(fileId)).url
  } catch {
    return null
  }
}
