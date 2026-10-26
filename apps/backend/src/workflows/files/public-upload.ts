import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { parseEnv, s3Settings } from "../../lib/env"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"

/** A public file's address under the S3 provider's `file_url`, as the provider builds it. */
export const s3PublicUrl = (fileUrl: string, key: string): string =>
  `${fileUrl.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`

let s3FileUrl: string | null | undefined
// As medusa-config decides: files stay local in tests, S3 when it is set
const s3Base = (): string | null => {
  if (s3FileUrl === undefined) {
    const env = parseEnv()
    s3FileUrl = env.NODE_ENV === "test" ? null : (s3Settings(env)?.fileUrl ?? null)
  }
  return s3FileUrl
}

/**
 * The URL of a file the shop uploaded, for a page to show (a logo, a
 * share image, a product image), or null. A job's result file is never
 * one: it can hold personal data and is served only through its own
 * checked route (adr/0014), so a page must not hand its URL out.
 *
 * Medusa's `retrieveFile` answers with a download link, which under S3 is
 * presigned and expires in minutes; a page needs the file's lasting public
 * address, which the S3 provider builds from its `file_url` and the key.
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
    const { url } = await container.resolve(Modules.FILE).retrieveFile(fileId)
    const base = s3Base()
    return base ? s3PublicUrl(base, fileId) : url
  } catch {
    return null
  }
}
