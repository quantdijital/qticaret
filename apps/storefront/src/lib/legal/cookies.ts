import "server-only"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { storefrontEnv } from "../env"
import { isStoreApiError } from "../store-api/errors"
import { storeCall, storeCallWithHeaders } from "../store-api/server"
import { COOKIE_PREFERENCES_PATH } from "../views/cookies"
import type { CookieConsent } from "../views/cookies"

export type { CookieConsent }

/**
 * The cookie banner's answers (F13.8, adr/0041 §5, D9). The backend keys
 * each visitor's answers by a random id in its `qt_vid` cookie; the
 * storefront keeps that cookie on its own domain (same name, `__Host-`
 * over HTTPS) and hands it over on the two calls that read or write it.
 */
const production = () => storefrontEnv().NODE_ENV === "production"
const NAME = () => (production() ? "__Host-qt_vid" : "qt_vid")
const ID = /^[A-Za-z0-9_-]{32}$/
const MAX_AGE = 396 * 24 * 60 * 60

async function visitorHeader(): Promise<Record<string, string>> {
  const id = (await cookies()).get(NAME())?.value
  return id && ID.test(id) ? { cookie: `${NAME()}=${id}` } : {}
}

/**
 * The answer in force and the policy now; the banner asks when there is
 * none, or one under an older policy. Once per request: the frame and the
 * preferences page read the same.
 */
export const cookieConsent = cache(async (): Promise<CookieConsent | null> => {
  try {
    return await storeCall<CookieConsent>("/store/consents/cookies", {
      headers: await visitorHeader(),
    })
  } catch (error) {
    // No answer to show is better than no page
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
})

/** Whether this request is the preferences page, which asks itself (the banner waits there). */
export async function onCookiePreferencesPage(): Promise<boolean> {
  const url = (await headers()).get("x-qt-url") ?? ""
  return url === COOKIE_PREFERENCES_PATH || url.startsWith(`${COOKIE_PREFERENCES_PATH}?`)
}

/** Records the answer; the visitor's id cookie, new or renewed, is the backend's. */
export async function recordCookieConsent(answer: {
  analytics: boolean
  marketing: boolean
  policy_version: number | null
}): Promise<void> {
  const { headers } = await storeCallWithHeaders("/store/consents/cookies", {
    method: "POST",
    body: answer,
    headers: await visitorHeader(),
  })
  const set = headers.get("set-cookie") ?? ""
  const id = new RegExp(`(?:^|\\s)${NAME()}=([A-Za-z0-9_-]{32})`).exec(set)?.[1]
  if (id) {
    ;(await cookies()).set(NAME(), id, {
      httpOnly: true,
      secure: production(),
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    })
  }
}
