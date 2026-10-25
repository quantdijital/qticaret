import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { redactText } from "../../../../lib/logging"
import { parseRequestPath } from "../../../../lib/seo/redirects"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import { followPath } from "../../../../workflows/seo/redirects/resolve"
import type { StorePostNotFoundType } from "../validators"

const MAX_HOST = 253

/** The referrer's host only: the page and its query may carry a visitor's data. */
function hostOf(referrer: string | undefined): string | null {
  if (!referrer) {
    return null
  }
  try {
    const url = new URL(referrer)
    const host = url.hostname.toLowerCase()
    return (url.protocol === "https:" || url.protocol === "http:") && host.length <= MAX_HOST
      ? host
      : null
  } catch {
    return null
  }
}

/**
 * `POST /store/seo/not-found` (docs/13 §4): the storefront reports a path
 * it answered with 404. Only paths that resolve to nothing are counted, so
 * a report cannot fill the log with the shop's own pages, and a path that
 * carries personal data (an e-mail, a phone number, a token) is not kept
 * at all. The answer is the same either way.
 */
export async function POST(
  req: MedusaRequest<StorePostNotFoundType>,
  res: MedusaResponse
): Promise<void> {
  const { path, referrer } = req.validatedBody
  const request = parseRequestPath(path)
  if (request) {
    const { resolution } = await followPath(req.scope, request, { countHits: false })
    if (resolution.type === "not_found" && redactText(request.path) === request.path) {
      req.scope
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .recordNotFound(request.path, hostOf(referrer))
    }
  }
  res.sendStatus(204)
}
