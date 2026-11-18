import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { FormProvider, useForm } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AI_HINT_KEY } from "@/features/ai/hint-state"
import { defaultWizardValues } from "../schema"
import type { WizardValues } from "../schema"
import { PhotoFillButton } from "./photo-fill"

/**
 * docs/22 "Aşama 6": "Fotoğraftan doldur" on the new product form. The
 * photo is uploaded, the card suggested and shown field by field, and
 * "Kullan" fills the form only: no product, attribute or image route is
 * written by the suggestion.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
const upload = vi.hoisted(() => vi.fn())
const categories = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: sdkFetch },
    admin: { upload: { create: upload }, productCategory: { list: categories } },
  },
}))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const task = (usable: string[], allowed = true) => ({
  services: [],
  tasks: [
    {
      id: "product_from_photo",
      capability: "vision",
      mode: "sync",
      options: [],
      allowed,
      usable,
      preference: null,
    },
  ],
  flags: { own_keys: true },
})

const TEMPLATE = {
  id: "atpl_1",
  name: "Mutfak",
  handle: "mutfak",
  description: null,
  definitions: [
    {
      id: "def_1",
      key: "material",
      label: "Malzeme",
      type: "select",
      unit: null,
      options: [
        { value: "wood", label: "Ahşap" },
        { value: "steel", label: "Çelik" },
      ],
      rank: 0,
      is_required: false,
      is_filterable: false,
      is_seo_highlight: false,
      scope: "product",
      option_title: null,
      varies_by: null,
    },
  ],
}

const CARD = {
  title: "Ahşap kesme tahtası",
  short_description: "Zeytin ağacından, yağlı yüzeyli.",
  category_id: "pcat_2",
  attributes: { material: "wood" },
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const netFetch = vi.fn()
let services = task(["gemini"])

function harness() {
  let form: UseFormReturn<WizardValues> | null = null
  function Form() {
    const methods = useForm<WizardValues>({
      defaultValues: { ...defaultWizardValues(), template_id: "atpl_1" },
    })
    form = methods
    return (
      <FormProvider {...methods}>
        <PhotoFillButton />
      </FormProvider>
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>
  )
  return { user: userEvent.setup(), values: () => form?.getValues() }
}

const file = () => new File([new Uint8Array([1, 2, 3])], "tahta.jpg", { type: "image/jpeg" })
const chooseFile = async (user: ReturnType<typeof userEvent.setup>) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) {
    throw new Error("no file input")
  }
  await user.upload(input, file())
}
const asked = () =>
  netFetch.mock.calls
    .filter(([url]) => String(url) === "/admin/ai/suggestions")
    .map(([, init]) => JSON.parse((init as { body: string }).body) as Record<string, unknown>)

beforeEach(() => {
  window.localStorage.removeItem(AI_HINT_KEY)
  services = task(["gemini"])
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: JSON.stringify(CARD) } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "product_from_photo",
            service: "gemini",
            status: "draft",
            text: JSON.stringify(CARD),
            card: { ...CARD, price: 1 },
            alternatives: [],
          },
        })
  )
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services)
    }
    if (url === "/admin/attribute-templates") {
      return Promise.resolve({ attribute_templates: [TEMPLATE], count: 1 })
    }
    if (url === "/admin/media") {
      return Promise.resolve({ media: [{ id: "media_1", url: "https://cdn.example.com/t.webp" }] })
    }
    return Promise.resolve({})
  })
  upload.mockReset()
  upload.mockResolvedValue({ files: [{ id: "file_1", url: "https://cdn.example.com/t.jpg" }] })
  categories.mockReset()
  categories.mockResolvedValue({
    product_categories: [
      { id: "pcat_1", name: "Bahçe" },
      { id: "pcat_2", name: "Mutfak" },
    ],
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Fotoğraftan doldur", () => {
  it("uploads the photo, shows the card's fields and fills the form without saving", async () => {
    const { user, values } = harness()
    await user.click(await screen.findByRole("button", { name: "Fotoğraftan doldur" }))
    expect(screen.getByRole("dialog", { name: "Fotoğraftan doldur" })).toBeInTheDocument()
    await chooseFile(user)

    expect(await screen.findByText("Ahşap kesme tahtası")).toBeInTheDocument()
    expect(screen.getByText("Zeytin ağacından, yağlı yüzeyli.")).toBeInTheDocument()
    expect(await screen.findByText("Mutfak")).toBeInTheDocument()
    expect(screen.getByText("Ahşap")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Seçilen ürün fotoğrafı" })).toBeInTheDocument()
    expect(asked()).toEqual([
      {
        task: "product_from_photo",
        entity_type: "media",
        entity_id: "media_1",
        template_id: "atpl_1",
      },
    ])

    await user.click(screen.getByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(values()?.title).toBe("Ahşap kesme tahtası")
    })
    expect(values()).toMatchObject({
      category_ids: ["pcat_2"],
      attributes: { material: "wood" },
      images: [{ id: "file_1", url: "https://cdn.example.com/t.webp" }],
    })
    // The answer's price never reaches a price field: prices are typed by a person
    expect(values()?.variants[0]?.price).toBe("")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // Only the upload, its media record and the suggestion: no product or attribute write
    const writes = sdkFetch.mock.calls
      .filter((call) => (call[1] as { method?: string } | undefined)?.method === "POST")
      .map(([url]) => String(url))
    expect(writes).toEqual(["/admin/media"])
    // Registered outside the media library: a photo dropped or swapped, which no product
    // takes, goes with the nightly sweep's abandoned uploads (jobs/media-sweep.ts)
    const registered = sdkFetch.mock.calls.find(([url]) => url === "/admin/media")?.[1] as {
      body: Record<string, unknown>
    }
    expect(registered.body).toEqual({ file_ids: ["file_1"] })
    expect(registered.body).not.toHaveProperty("library")
    expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
  })

  it("says why when the card was refused, and fills nothing", async () => {
    netFetch.mockImplementation(() =>
      json(422, { type: "invalid_data", message: "ai.suggestion_refused", problems: ["format"] })
    )
    const { user, values } = harness()
    await user.click(await screen.findByRole("button", { name: "Fotoğraftan doldur" }))
    await chooseFile(user)
    expect(await screen.findByText(/Uygun bir öneri çıkmadı/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kullan" })).not.toBeInTheDocument()
    expect(values()?.title).toBe("")
  })

  it("offers a service picker with two services and asks with the one picked", async () => {
    services = task(["gemini", "minimax"])
    const { user } = harness()
    await user.click(await screen.findByRole("button", { name: "Fotoğraftan doldur" }))
    const picker = screen.getByRole("radiogroup", { name: "Servis" })
    expect(picker).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "MiniMax" }))
    await chooseFile(user)
    await screen.findByText("Ahşap kesme tahtası")
    expect(asked()[0]).toMatchObject({ service: "minimax" })
  })

  it("opens the connect tip without a service, and draws nothing for a role the task does not allow", async () => {
    services = task([])
    const { user } = harness()
    await user.click(await screen.findByRole("button", { name: "Fotoğraftan doldur" }))
    expect(screen.getByText(/ürün formunu bir fotoğraftan doldurabilirsiniz/)).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it("is not drawn for a role the task does not allow", async () => {
    services = task(["gemini"], false)
    harness()
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: "Fotoğraftan doldur" })).not.toBeInTheDocument()
  })
})
