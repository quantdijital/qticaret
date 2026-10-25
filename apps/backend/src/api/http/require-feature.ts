import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { featureDefinition } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { logRejection } from "./reject"
import { ensureRequestId } from "./request-id"
import { requestPath } from "./request-path"

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)

// encodeurl 2.0, which Express's final handler uses, rule for rule
const ENCODE_CHARS =
  /(?:[^\x21\x23-\x3B\x3D\x3F-\x5F\x61-\x7A\x7C\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g
const UNMATCHED_SURROGATE =
  /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g
const encodeUrl = (url: string): string =>
  url.replace(UNMATCHED_SURROGATE, "$1\uFFFD$2").replace(ENCODE_CHARS, encodeURI)

// The final handler names the path of an absolute-form target, not the URL
const ABSOLUTE_FORM = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i

/**
 * The page Express's final handler sends for a path no route matches. A
 * disabled feature answers with it, byte for byte, so it reads exactly like
 * a route that does not exist; a test compares the two, so an Express
 * upgrade that changes the page is caught.
 */
function notFoundPage(req: MedusaRequest): string {
  const path = requestPath(req).replace(ABSOLUTE_FORM, "") || "/"
  const text = escapeHtml(`Cannot ${req.method} ${encodeUrl(path)}`)
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>${text}</pre>\n</body>\n</html>\n`
}

/**
 * Routes behind a feature flag (adr/0012). While the flag is off the route
 * answers as if it did not exist: a disabled feature does not announce
 * itself. It must be the route's first middleware: a validator before it
 * would answer 400 first. An unknown key fails at start, not per request.
 */
export function requireFeature(key: string) {
  if (!featureDefinition(key)) {
    throw new Error(`requireFeature: "${key}" is not a registered feature flag`)
  }
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    let enabled: boolean
    try {
      const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      enabled = await service.isFeatureEnabled(key)
    } catch (error) {
      // Fails closed: the error handler answers, the route does not run
      next(error)
      return
    }
    if (enabled) {
      next()
      return
    }
    answerAsMissing(req, res, "feature_disabled")
  }
}

/** Answers as Express does for a route that does not exist, and logs why. */
export function answerAsMissing(req: MedusaRequest, res: MedusaResponse, reason: string): void {
  logRejection(req, ensureRequestId(req, res), { status: 404, type: undefined, reason })
  const page = notFoundPage(req)
  res.status(404)
  res.setHeader("Content-Security-Policy", "default-src 'none'")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Content-Length", String(Buffer.byteLength(page)))
  res.end(page)
}
