import { QueryClient } from "@tanstack/react-query"
import { isRedirect } from "@tanstack/react-router"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { requireStaff } from "@/routes/-require-staff"
import { CURRENT_USER_KEY, USER_STALE_MS } from "./me"
import { SessionUnavailableError, loadCurrentUser, signInPage } from "./session"
import { STAFF_KEY } from "./staff"

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch }, auth: { logout: vi.fn() } } }))

const USER = { id: "user_1", email: "elif@ornek.com", first_name: "Elif", last_name: "Kaya" }
const STAFF = {
  user_id: "user_1",
  role: "owner",
  can: {},
  mfa: { available: true, required: true, enabled: true, passed: true },
}

const answer = (status: number, headers: Record<string, string> = {}, body?: unknown) =>
  new Response(JSON.stringify(body ?? (status === 200 ? { user: USER } : { message: "x" })), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })

const fetchMock = vi.fn<(url: string) => Promise<Response>>()
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const userReads = () => fetchMock.mock.calls.filter(([url]) => url.startsWith("/admin/users/me"))
/** Read before, due again now, still within the grace. */
const readLately = (queryClient: QueryClient) => {
  queryClient.setQueryData(CURRENT_USER_KEY, USER, { updatedAt: Date.now() - USER_STALE_MS - 1 })
  queryClient.setQueryData(STAFF_KEY, STAFF)
}
const guard = (queryClient: QueryClient, href = "/orders") =>
  requireStaff({ context: { queryClient }, location: { href } }).catch((error: unknown) => error)

beforeEach(() => {
  fetchMock.mockReset()
  sdkFetch.mockReset()
  // The role read answers; the shop's colours do not (the guard goes on without them)
  sdkFetch.mockImplementation((path: string) =>
    path === "/admin/staff/me" ? Promise.resolve(STAFF) : Promise.reject(new Error("none"))
  )
  vi.mocked(toast.error).mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("the signed-in guard", () => {
  it("sends a signed-out visitor (401) to sign in, with nothing read kept", async () => {
    const queryClient = client()
    queryClient.setQueryData(["other"], "kept before")
    fetchMock.mockResolvedValue(answer(401))

    const thrown = await guard(queryClient)

    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: { to: string; search: unknown } }).options).toMatchObject({
      to: "/login",
      search: { redirect: "/orders" },
    })
    expect(queryClient.getQueryData(["other"])).toBeUndefined()
  })

  it("keeps the user read lately on a 429 and says too many requests, not sign-in", async () => {
    const queryClient = client()
    readLately(queryClient)
    fetchMock.mockResolvedValue(answer(429, { "retry-after": "120" }))

    const result = await guard(queryClient)

    expect(result).toEqual({ user: USER })
    expect(userReads()).toHaveLength(1)
    expect(toast.error).toHaveBeenCalledWith("Çok fazla istek, biraz sonra yeniden deneyin.", {
      id: "session-rate-limited",
    })
  })

  it("keeps the user read lately when the server fails, without a toast", async () => {
    const queryClient = client()
    readLately(queryClient)
    fetchMock.mockResolvedValue(answer(503))

    await expect(loadCurrentUser(queryClient)).resolves.toEqual(USER)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("stops standing on a user read too long ago: the try-again page", async () => {
    const queryClient = client()
    queryClient.setQueryData(CURRENT_USER_KEY, USER, {
      updatedAt: Date.now() - USER_STALE_MS - 5 * 60_000 - 1,
    })
    fetchMock.mockResolvedValue(answer(503))

    await expect(loadCurrentUser(queryClient)).rejects.toMatchObject({ reason: "unavailable" })
  })

  it("reads once more after a short Retry-After when a 429 meets a user read lately", async () => {
    vi.useFakeTimers()
    const queryClient = client()
    readLately(queryClient)
    fetchMock.mockResolvedValue(answer(429, { "retry-after": "2" }))

    await expect(loadCurrentUser(queryClient)).resolves.toEqual(USER)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(60_000)

    // One more, then none: no loop
    expect(userReads()).toHaveLength(2)
  })

  it("signs out here when that later read finds the session gone (401)", async () => {
    vi.useFakeTimers()
    const open = vi.spyOn(signInPage, "open").mockImplementation(() => undefined)
    const queryClient = client()
    readLately(queryClient)
    fetchMock.mockResolvedValueOnce(answer(429, { "retry-after": "1" }))
    fetchMock.mockResolvedValue(answer(401))

    await loadCurrentUser(queryClient)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?redirect=/u))
    expect(queryClient.getQueryData(CURRENT_USER_KEY)).toBeUndefined()
  })

  it("shows the try-again page, not sign-in, when the first read gets a 5xx", async () => {
    fetchMock.mockResolvedValue(answer(500))

    const thrown = await guard(client(), "/")

    expect(isRedirect(thrown)).toBe(false)
    expect(thrown).toBeInstanceOf(SessionUnavailableError)
    expect((thrown as SessionUnavailableError).reason).toBe("unavailable")
  })

  it("shows the try-again page when the first read cannot reach the panel at all", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(loadCurrentUser(client())).rejects.toMatchObject({ reason: "unavailable" })
  })

  it("takes no user from an answer without one", async () => {
    fetchMock.mockResolvedValue(answer(200, {}, { user: { email: "x@y.z" } }))

    await expect(loadCurrentUser(client())).rejects.toMatchObject({ reason: "unavailable" })
  })

  it("waits a short Retry-After once on the first read, then signs in with the answer", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(answer(429, { "retry-after": "3" }))
    fetchMock.mockResolvedValue(answer(200))

    const loading = loadCurrentUser(client())
    await vi.advanceTimersByTimeAsync(2_999)
    expect(userReads()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(loading).resolves.toEqual(USER)
    expect(userReads()).toHaveLength(2)
  })

  it("gives up after that one retry: too many requests, still not sign-in", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(answer(429, { "retry-after": "1" }))

    const loading = loadCurrentUser(client()).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(await loading).toMatchObject({ reason: "rateLimited" })
    expect(userReads()).toHaveLength(2)
  })

  it("does not wait a long Retry-After on the first read", async () => {
    fetchMock.mockResolvedValue(answer(429, { "retry-after": "120" }))

    await expect(loadCurrentUser(client())).rejects.toMatchObject({ reason: "rateLimited" })
    expect(userReads()).toHaveLength(1)
  })
})

describe("the guard's 2FA check when the role cannot be read", () => {
  it("never skips 2FA: no role read before, the try-again page", async () => {
    fetchMock.mockResolvedValue(answer(200))
    sdkFetch.mockRejectedValue(Object.assign(new Error("x"), { status: 503 }))

    const thrown = await guard(client())

    expect(isRedirect(thrown)).toBe(false)
    expect(thrown).toMatchObject({ reason: "unavailable" })
  })

  it("asks 2FA from the role read lately when the read fails now", async () => {
    const queryClient = client()
    queryClient.setQueryData(
      STAFF_KEY,
      { ...STAFF, mfa: { ...STAFF.mfa, enabled: false, passed: false } },
      {
        updatedAt: Date.now() - 2 * 60_000,
      }
    )
    fetchMock.mockResolvedValue(answer(200))
    sdkFetch.mockRejectedValue(Object.assign(new Error("x"), { status: 429 }))

    const thrown = await guard(queryClient)

    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: { to: string } }).options.to).toBe("/security/setup")
  })

  it("sends to sign-in when the role read says the session is gone", async () => {
    fetchMock.mockResolvedValue(answer(200))
    sdkFetch.mockRejectedValue(Object.assign(new Error("x"), { status: 401 }))

    const thrown = await guard(client())

    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: { to: string } }).options.to).toBe("/login")
  })
})
