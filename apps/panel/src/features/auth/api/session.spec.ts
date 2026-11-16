import { QueryClient } from "@tanstack/react-query"
import { isRedirect } from "@tanstack/react-router"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { requireStaff } from "@/routes/-require-staff"
import { CURRENT_USER_KEY } from "./me"
import { SessionUnavailableError, loadCurrentUser } from "./session"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The staff and appearance reads: none here (the guard goes on without them)
vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: vi.fn(() => Promise.reject(new Error("none"))) } },
}))

const USER = { id: "user_1", email: "elif@ornek.com", first_name: "Elif", last_name: "Kaya" }

const answer = (status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(status === 200 ? { user: USER } : { message: "x" }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })

const fetchMock = vi.fn<(url: string) => Promise<Response>>()
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const userReads = () => fetchMock.mock.calls.filter(([url]) => url.startsWith("/admin/users/me"))

beforeEach(() => {
  fetchMock.mockReset()
  vi.mocked(toast.error).mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("the signed-in guard", () => {
  it("sends a signed-out visitor (401) to sign in", async () => {
    fetchMock.mockResolvedValue(answer(401))

    const thrown: unknown = await requireStaff({
      context: { queryClient: client() },
      location: { href: "/orders" },
    }).catch((error: unknown) => error)

    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: { to: string; search: unknown } }).options).toMatchObject({
      to: "/login",
      search: { redirect: "/orders" },
    })
  })

  it("keeps the user already read on a 429 and says too many requests, not sign-in", async () => {
    const queryClient = client()
    queryClient.setQueryData(CURRENT_USER_KEY, USER, { updatedAt: 0 })
    fetchMock.mockResolvedValue(answer(429, { "retry-after": "120" }))

    const result = await requireStaff({ context: { queryClient }, location: { href: "/orders" } })

    expect(result).toEqual({ user: USER })
    expect(userReads()).toHaveLength(1)
    expect(toast.error).toHaveBeenCalledWith("Çok fazla istek, biraz sonra yeniden deneyin.", {
      id: "session-rate-limited",
    })
  })

  it("keeps the user already read when the server fails, without a toast", async () => {
    const queryClient = client()
    queryClient.setQueryData(CURRENT_USER_KEY, USER, { updatedAt: 0 })
    fetchMock.mockResolvedValue(answer(503))

    await expect(loadCurrentUser(queryClient)).resolves.toEqual(USER)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("reads once more after a short Retry-After when a 429 meets a user already read", async () => {
    vi.useFakeTimers()
    const queryClient = client()
    queryClient.setQueryData(CURRENT_USER_KEY, USER, { updatedAt: 0 })
    fetchMock.mockResolvedValueOnce(answer(429, { "retry-after": "2" }))
    fetchMock.mockResolvedValue(answer(429, { "retry-after": "2" }))

    await expect(loadCurrentUser(queryClient)).resolves.toEqual(USER)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(60_000)

    // One more, then none: no loop
    expect(userReads()).toHaveLength(2)
  })

  it("shows the try-again page, not sign-in, when the first read gets a 5xx", async () => {
    fetchMock.mockResolvedValue(answer(500))

    const thrown: unknown = await requireStaff({
      context: { queryClient: client() },
      location: { href: "/" },
    }).catch((error: unknown) => error)

    expect(isRedirect(thrown)).toBe(false)
    expect(thrown).toBeInstanceOf(SessionUnavailableError)
    expect((thrown as SessionUnavailableError).reason).toBe("unavailable")
  })

  it("shows the try-again page when the first read cannot reach the panel at all", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

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
