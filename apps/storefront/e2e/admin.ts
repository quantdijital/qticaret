import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { request } from "@playwright/test"
import type { APIRequestContext, APIResponse } from "@playwright/test"
import { currentStep, totpAt } from "./totp"

/**
 * The backend's admin API for a storefront e2e test that needs the shop
 * set up first (a payment link, adr/0051). The admin is made the way the
 * panel's e2e makes its own (`apps/panel/e2e/support/admin.ts`): a fresh
 * one per run through Medusa's CLI, its password random and never stored,
 * removed when the run ends. Nobody's own account is used.
 */

export const BACKEND_URL = process.env["E2E_BACKEND_URL"] ?? "http://localhost:9000"

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..")

// Medusa's CLI in the backend, against its database (its `.env`). The local
// `.env` points providers at the fake servers, which the backend refuses
// unless NODE_ENV is development or test (an unset one counts as live).
const backend = (args: string[]) =>
  execFileSync("pnpm", ["--filter", "@qticaret/backend", "medusa", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: "development" },
    stdio: "pipe",
  })

export interface TemporaryAdmin {
  email: string
  password: string
}

/** A fresh owner for one run (the only address `remove-e2e-admin.ts` takes away). */
export function createTemporaryAdmin(): TemporaryAdmin {
  const email = `e2e-${String(Date.now())}-${randomBytes(3).toString("hex")}@example.com`
  const password = randomBytes(18).toString("base64url")
  // `--password=`, joined: a password starting with "-" would read as an option
  backend(["user", `--email=${email}`, `--password=${password}`])
  backend(["exec", "./src/scripts/set-staff-role.ts", email, "owner"])
  return { email, password }
}

/** The run's admin removed with its login: a user cannot delete itself through the API. */
export function removeTemporaryAdmin(email: string): void {
  backend(["exec", "./src/scripts/remove-e2e-admin.ts", email])
}

export interface AdminApi {
  get: <T>(path: string) => Promise<T>
  post: <T>(path: string, body: unknown) => Promise<T>
  /**
   * A change the backend asks the person to prove themselves again for
   * (adr/0040 §3, a 428 without it): their app's code with 2FA, else their
   * password, in the request's headers.
   */
  postProved: <T>(path: string, body: unknown) => Promise<T>
  del: <T>(path: string) => Promise<T>
  dispose: () => Promise<void>
}

interface Login {
  token?: string
  mfa_challenge?: { id: string }
}

interface StaffMe {
  mfa: { required: boolean; passed: boolean }
}

/** The body of a 2xx answer; otherwise an error naming the call and the backend's message key. */
async function bodyOf<T>(response: APIResponse, call: string): Promise<T> {
  if (!response.ok()) {
    const body = (await response.json().catch(() => ({}))) as { message?: unknown }
    const message = typeof body.message === "string" ? body.message : ""
    throw new Error(`${call} answered ${String(response.status())} ${message}`.trim())
  }
  return (await response.json()) as T
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

/**
 * App codes for one identity. The backend takes each once (a sign-in's or
 * a step-up's, two minutes), from its step or one either side: every call
 * gets one not given yet, this step's first, so it does not age out on the way.
 */
function codeSource(key: string): () => string {
  const given = new Set<number>()
  return () => {
    const now = currentStep()
    const step = [now, now + 1, now - 1].find((each) => !given.has(each))
    if (step === undefined) {
      throw new Error("no unused app code in this step")
    }
    given.add(step)
    return totpAt(key, step)
  }
}

/**
 * Signs the admin in through the auth API. With the shop's 2FA asked of
 * everyone (adr/0040 §2), it is set up as the panel's setup page does: a
 * TOTP factor confirmed with its first code and the password, then in
 * again with a code; the key stays in memory for the step-ups.
 */
export async function signInAdmin(admin: TemporaryAdmin): Promise<AdminApi> {
  const auth = await request.newContext({ baseURL: BACKEND_URL })
  const credentials = { email: admin.email, password: admin.password }
  const passwordProof = {
    "x-reauth-method": "password",
    "x-reauth-secret": encodeURIComponent(admin.password),
  }
  let code: (() => string) | null = null
  try {
    const login = await bodyOf<Login>(
      await auth.post("/auth/user/emailpass", { data: credentials }),
      "sign-in"
    )
    let token = login.token ?? ""
    const me = await bodyOf<StaffMe>(
      await auth.get("/admin/staff/me", { headers: bearer(token) }),
      "GET /admin/staff/me"
    )
    if (me.mfa.required && !me.mfa.passed) {
      const started = await bodyOf<{ mfa_factor: { id: string }; secret: string }>(
        await auth.post("/auth/mfa/factors", {
          headers: bearer(token),
          data: { provider: "totp", label: "e2e" },
        }),
        "2FA setup"
      )
      // Confirming the factor is not a sign-in nor a step-up: its code is not spent
      await bodyOf(
        await auth.post(`/auth/mfa/factors/${started.mfa_factor.id}/verify`, {
          headers: { ...bearer(token), ...passwordProof },
          data: { code: totpAt(started.secret, currentStep()) },
        }),
        "2FA confirm"
      )
      code = codeSource(started.secret)
      const again = await bodyOf<Login>(
        await auth.post("/auth/user/emailpass", { data: credentials }),
        "sign-in with 2FA"
      )
      const passed = await bodyOf<{ token: string }>(
        await auth.post(`/auth/mfa/challenges/${again.mfa_challenge?.id ?? ""}/verify`, {
          headers: bearer(again.token ?? ""),
          data: { method: "totp", code: code() },
        }),
        "2FA sign-in"
      )
      token = passed.token
    }
    const api: APIRequestContext = await request.newContext({
      baseURL: BACKEND_URL,
      extraHTTPHeaders: bearer(token),
    })
    const proof = (): Record<string, string> =>
      code ? { "x-reauth-method": "totp", "x-reauth-secret": code() } : passwordProof
    return {
      get: async <T>(path: string) => bodyOf<T>(await api.get(path), `GET ${path}`),
      post: async <T>(path: string, body: unknown) =>
        bodyOf<T>(await api.post(path, { data: body }), `POST ${path}`),
      postProved: async <T>(path: string, body: unknown) => {
        let response = await api.post(path, { data: body, headers: proof() })
        // A code given at a step's edge may age out on the way (the check runs before the change)
        if (response.status() === 428 && code) {
          response = await api.post(path, { data: body, headers: proof() })
        }
        return bodyOf<T>(response, `POST ${path}`)
      },
      del: async <T>(path: string) => bodyOf<T>(await api.delete(path), `DELETE ${path}`),
      dispose: () => api.dispose(),
    }
  } finally {
    await auth.dispose()
  }
}
