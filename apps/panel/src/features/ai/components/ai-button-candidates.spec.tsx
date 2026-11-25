import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AiButton } from "./ai-button"

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true, useStaff: () => undefined }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const SERVICES = {
  services: [],
  tasks: [
    {
      id: "focus_keyword",
      capability: "text",
      mode: "sync",
      options: [],
      allowed: true,
      usable: ["deepseek"],
      preference: null,
    },
  ],
  flags: { own_keys: true },
}

const CANDIDATES = ["keten gömlek", "yazlık keten gömlek", "bej keten gömlek"]
// The backend answers an accept with the candidate taken (`candidate_index`, the first when left out)
const takenOf = (body: string | undefined) =>
  CANDIDATES[(JSON.parse(body ?? "{}") as { candidate_index?: number }).candidate_index ?? 0]

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const netFetch = vi.fn()

function setup(onUseAll?: (texts: string[]) => void) {
  sdkFetch.mockResolvedValue(SERVICES)
  const onUse = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiButton
        task="focus_keyword"
        entity={{ type: "category", id: "pcat_1" }}
        onUse={onUse}
        onUseAll={onUseAll}
      />
    </QueryClientProvider>
  )
  return { onUse, user: userEvent.setup() }
}

beforeEach(() => {
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  netFetch.mockImplementation((url: string, init?: { body?: string }) =>
    json(url.endsWith("/accept") ? 200 : 201, {
      suggestion: {
        id: "sug_1",
        task: "focus_keyword",
        service: "deepseek",
        status: url.endsWith("/accept") ? "accepted" : "draft",
        text: url.endsWith("/accept") ? takenOf(init?.body) : CANDIDATES[0],
        ...(url.endsWith("/accept") ? {} : { candidates: CANDIDATES }),
        problems: [],
        alternatives: [],
      },
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Several candidates (adr/0074 §4): a radio list, the first picked; one "Kullan" takes the pick. */
describe("AiButton with candidates", () => {
  it("lists the candidates as radios, the main one first and picked, with one Kullan", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))

    const group = await screen.findByRole("radiogroup", { name: "Öneriler" })
    const radios = within(group).getAllByRole("radio")
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ])
    expect(within(group).getByLabelText(/^keten gömlek/)).toBe(radios[0])
    expect(group).toHaveTextContent("keten gömlekana öneri")
    expect(screen.getAllByRole("button", { name: "Kullan" })).toHaveLength(1)
    // The cancel button is red (`cancel`), as everywhere in the panel
    expect(screen.getByRole("button", { name: "Vazgeç" })).toHaveAttribute("data-variant", "cancel")
  })

  it("hands the first candidate to the form when nothing else is picked", async () => {
    const { onUse, user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    await user.click(await screen.findByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(onUse).toHaveBeenCalledWith("keten gömlek")
    })
  })

  it("hands the picked candidate to the form and records the decision, writing no record", async () => {
    const { onUse, user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    await user.click(await screen.findByLabelText("yazlık keten gömlek"))
    await user.click(screen.getByRole("button", { name: "Kullan" }))

    await waitFor(() => {
      expect(onUse).toHaveBeenCalledWith("yazlık keten gömlek")
    })
    expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
    expect(JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
      task: "focus_keyword",
      entity_type: "category",
      entity_id: "pcat_1",
    })
    // The pick recorded by its place among those offered (adr/0074 §4, B2)
    expect(JSON.parse((netFetch.mock.calls[1]?.[1] as { body: string }).body)).toEqual({
      candidate_index: 1,
    })
    expect(screen.queryByRole("radiogroup", { name: "Öneriler" })).not.toBeInTheDocument()
  })

  it("offers no Hepsini ekle unless the field takes a list", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    await screen.findByRole("radiogroup", { name: "Öneriler" })
    expect(screen.queryByRole("button", { name: "Hepsini ekle" })).not.toBeInTheDocument()
  })

  it("hands every candidate to a list field with Hepsini ekle, recording the first as taken", async () => {
    const onUseAll = vi.fn()
    const { onUse, user } = setup(onUseAll)
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    await user.click(await screen.findByRole("button", { name: "Hepsini ekle" }))

    await waitFor(() => {
      expect(onUseAll).toHaveBeenCalledWith(CANDIDATES)
    })
    expect(onUse).not.toHaveBeenCalled()
    expect(JSON.parse((netFetch.mock.calls[1]?.[1] as { body: string }).body)).toEqual({
      candidate_index: 0,
    })
  })

  it("shows one candidate as today: the text, no radios", async () => {
    netFetch.mockImplementation(() =>
      json(201, {
        suggestion: {
          id: "sug_2",
          task: "focus_keyword",
          service: "deepseek",
          status: "draft",
          text: "keten gömlek",
          candidates: ["keten gömlek"],
          alternatives: [],
        },
      })
    )
    const { onUse, user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText("keten gömlek")).toBeInTheDocument()
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(onUse).toHaveBeenCalledWith("keten gömlek")
    })
  })
})
