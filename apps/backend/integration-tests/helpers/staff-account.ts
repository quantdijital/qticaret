import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { eventually } from "./eventually"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"

/** What our routes answer with on a refusal: the key in `message` (bearer) or `code` (session). */
export interface Answer {
  message?: string
  code?: string
}

export const keyOf = (answer: Answer): string | undefined => answer.code ?? answer.message

/** The session cookie a response set, as a request sends it back. */
export function sessionCookie(response: HttpResponse<unknown>): string {
  const header = response.headers["set-cookie"]
  const cookies = Array.isArray(header) ? header : header ? [header] : []
  return (cookies.find((value) => value.startsWith("connect.sid=")) ?? "").split(";")[0] ?? ""
}

/** The token after `#` in a confirmation e-mail's link: no access log keeps it. */
export function confirmTokenIn(html: string): string {
  const link = /href="([^"]*\/confirm-email#[^"]*)"/.exec(html)?.[1] ?? ""
  return new URLSearchParams(new URL(link.replace(/&amp;/g, "&")).hash.slice(1)).get("token") ?? ""
}

/** A browser's origin, as CSRF protection (F2.10) asks of a cookie's mutation. */
export const adminOrigin = () =>
  new URL((process.env["ADMIN_CORS"] ?? "").split(",")[0]?.trim() ?? "").origin

/** Requests with these headers, answered whatever their status. */
export const caller = (http: HttpClient, headers: Record<string, string>) => ({
  get: <T>(url: string) => settle(http.get<T & Answer>(url, { headers })),
  post: <T>(url: string, body: unknown = {}) =>
    settle(http.post<T & Answer>(url, body, { headers })),
})

const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]

/** A fake mail service the shop sends through for the file's tests. */
export function useFakeMail(): {
  mail: () => FakeMail
  mailTo: (to: string, template: string) => Promise<FakeMail["messages"]>
} {
  let fake: FakeMail | undefined
  beforeAll(async () => {
    fake = await startFakeMail()
    Object.assign(process.env, {
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: fake.apiKey,
      RESEND_BASE_URL: fake.url,
      EMAIL_FROM: "bildirim@platform.example",
    })
  })
  afterAll(async () => {
    for (const name of MAIL_ENV) {
      Reflect.deleteProperty(process.env, name)
    }
    await fake?.close()
  })
  const mail = () => {
    if (!fake) {
      throw new Error("the fake mail service is not started")
    }
    return fake
  }
  return {
    mail,
    mailTo: (to, template) =>
      eventually(
        () =>
          Promise.resolve(
            mail().messages.filter((each) => each.to.includes(to) && each.template === template)
          ),
        (found) => found.length > 0
      ),
  }
}
