import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { productBody } from "../create-product"
import { BLANK_VARIANT, defaultWizardValues } from "../schema"
import type { WizardValues } from "../schema"
import { VariantsTable } from "./variants-table"

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: {
      fetch: (url: string) =>
        Promise.resolve(
          url.startsWith("/admin/platform-settings/")
            ? { values: { weight_unit: "g", dimension_unit: "cm" } }
            : {}
        ),
    },
    admin: {
      store: { list: () => Promise.resolve({ stores: [{ default_location_id: "sloc_1" }] }) },
      shippingProfile: { list: () => Promise.resolve({ shipping_profiles: [] }) },
    },
  },
}))

const SHARED = "https://cdn/genel.jpg"
const PURPLE = "https://cdn/mor.jpg"
const GREEN = "https://cdn/yesil.jpg"

const start = (): WizardValues => ({
  ...defaultWizardValues(),
  title: "Şef Bıçağı",
  has_options: true,
  options: [{ title: "Renk", values: ["Mor", "Yeşil"] }],
  images: [
    { id: "file_1", url: SHARED },
    { id: "file_2", url: PURPLE },
    { id: "file_3", url: GREEN },
  ],
  variants: ["Mor", "Yeşil"].map((colour) => ({
    ...BLANK_VARIANT,
    key: colour,
    title: colour,
    options: { Renk: colour },
    price: "1.250,00",
  })),
})

function renderTable() {
  const held: { form: UseFormReturn<WizardValues> | null } = { form: null }
  function Harness() {
    const form = useForm<WizardValues>({ defaultValues: start() })
    held.form = form
    return (
      <FormProvider {...form}>
        <VariantsTable />
      </FormProvider>
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  )
  return () => {
    if (!held.form) {
      throw new Error("no form")
    }
    return held.form.getValues()
  }
}

/** The owner: "ürün eklerken varyant görselini ekleyemiyorum" — now in the same dialog as the product page's. */
describe("a new product's variant dialog", () => {
  it("picks the variant's pictures and its other fields before the product is saved", async () => {
    const user = userEvent.setup()
    const values = renderTable()
    await user.click(screen.getByRole("button", { name: /^Renk: Mor: maliyet/ }))
    const dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    expect(dialog).toHaveAccessibleDescription("Renk: Mor")
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument()

    // The price tab: the cost beside the price
    await user.type(within(dialog).getByLabelText("Maliyet"), "400")
    // The codes tab: the MPN and the variant's own weight
    await user.click(within(dialog).getByRole("tab", { name: "Kodlar ve ölçüler" }))
    await user.type(within(dialog).getByLabelText("Üretici kodu (MPN)"), "SB-MOR")
    await user.type(within(dialog).getByLabelText("Ağırlık"), "350")
    // The pictures tab: the form's pictures, the purple one picked for this variant
    await user.click(within(dialog).getByRole("tab", { name: "Görseller (0)" }))
    const purple = within(dialog).getByRole("button", {
      name: "2. görsel: Tüm varyantlarda görünür",
    })
    await user.click(purple)
    expect(purple).toHaveAttribute("aria-pressed", "true")
    expect(within(dialog).getByRole("tab", { name: "Görseller (1)" })).toBeInTheDocument()
    // No media record yet: the alt text waits for the save
    expect(within(dialog).queryByLabelText(/alt metni/i)).toBeNull()
    expect(
      within(dialog).getByText(
        "Görsellerin alt metinlerini ürünü kaydettikten sonra girebilirsiniz."
      )
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    const row = values().variants[0]
    expect(row).toMatchObject({ cost: "400", mpn: "SB-MOR", weight: "350", image_urls: [PURPLE] })
    // The row shows its picture count in place of "Ayrıntılar"
    expect(screen.getByRole("button", { name: /^Renk: Mor: maliyet/ })).toHaveTextContent(
      "1 görsel"
    )

    // Saving sends the ties with the product, in one request
    const body = productBody({
      values: values(),
      publish: false,
      defaults: { salesChannelId: null, locationId: "sloc_1", shippingProfileId: null },
      defaultOption: { title: "Seçenek", value: "Standart" },
    })
    expect(body.additional_data).toEqual({
      variant_images: [{ options: { Renk: "Mor" }, image_urls: [PURPLE] }],
    })
    expect(body.variants[0]).toMatchObject({ weight: 350 })
  })

  it("shows which other variant a picture is tied to, and walks to it", async () => {
    const user = userEvent.setup()
    const values = renderTable()
    await user.click(screen.getByRole("button", { name: /^Renk: Mor: maliyet/ }))
    let dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    await user.click(within(dialog).getByRole("tab", { name: "Görseller (0)" }))
    await user.click(
      within(dialog).getByRole("button", { name: "3. görsel: Tüm varyantlarda görünür" })
    )
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })

    await user.click(screen.getByRole("button", { name: /^Renk: Yeşil: maliyet/ }))
    dialog = screen.getByRole("dialog", { name: "Varyantı düzenle" })
    await user.click(within(dialog).getByRole("tab", { name: "Görseller (0)" }))
    expect(
      within(dialog).getByRole("button", { name: "3. görsel: Başka varyanta bağlı (Mor)" })
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Önceki varyant" }))
    expect(dialog).toHaveAccessibleDescription("Renk: Mor")
    expect(values().variants[1]?.image_urls).toEqual([])
  })
})
