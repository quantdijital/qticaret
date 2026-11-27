import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { KindCounts, MigrationJob } from "@/features/settings/api/migration"
import { RunResult } from "@/features/settings/components/migration/run-result"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const counted = (values: Partial<KindCounts>): KindCounts => ({
  read: 0,
  created: 0,
  found: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  ...values,
})

// A dry run of a WordPress export, as the server sums it up (migration-wordpress.spec.ts)
const counts = {
  category: counted({ read: 2, created: 2 }),
  brand: counted({ read: 1, created: 1 }),
  product: counted({ read: 4, created: 4 }),
  image: counted({ read: 3, created: 3 }),
  customer: counted({}),
  review: counted({ read: 2, created: 2 }),
  post_category: counted({ read: 1, created: 1 }),
  post_tag: counted({ read: 2, created: 2 }),
  post: counted({ read: 1, created: 1 }),
  page: counted({ read: 4, created: 2, skipped: 2 }),
}

const job = (summary: Record<string, unknown>): MigrationJob => ({
  id: "job_wp",
  type: "migration.run",
  status: "succeeded",
  progress: 100,
  result_summary: { run_id: "mrun_1", mode: "check", counts, ...summary },
  error_code: null,
  error_message: null,
  created_at: "2026-11-03T08:00:00.000Z",
  finished_at: "2026-11-03T08:01:00.000Z",
  expires_at: null,
  has_result: true,
})

const wordpress = {
  attributes: [
    { key: "pa_urun-turu", name: "Ürün türü", products: 201, values: 24 },
    { key: "pa_celik", name: "Çelik", products: 183, values: 22 },
  ],
  not_moved: { coupons: 1, menu_items: 14, product_tags: 640, blog_comments: 3 },
}

describe("Settings > Migration: a WordPress run's report", () => {
  it("counts the blog kinds beside the catalogue's", () => {
    render(<RunResult job={job({ wordpress })} source="wordpress" />)
    const table = screen.getByRole("table")
    for (const [kind, read] of [
      ["Ürünler", "4"],
      ["Blog kategorileri", "1"],
      ["Blog etiketleri", "2"],
      ["Blog yazıları", "1"],
      ["Diğer sayfalar", "4"],
    ] as const) {
      const row = within(table).getByText(kind).closest("tr") as HTMLElement
      expect(within(row).getAllByRole("cell")[1]).toHaveTextContent(read)
    }
    // Nothing of a kind the export does not hold
    expect(within(table).queryByText("Müşteriler")).toBeNull()
    expect(screen.getByRole("button", { name: "Raporu indir" })).toBeVisible()
  })

  it("shows the attributes left behind with their products and values", async () => {
    render(<RunResult job={job({ wordpress })} source="wordpress" />)
    await userEvent.click(screen.getByRole("tab", { name: "Özellikler" }))

    expect(screen.getByText(/özellik grubu kurulunca yazılabilir/)).toBeVisible()
    const table = screen.getByRole("table")
    const steel = within(table).getByText("Çelik").closest("tr") as HTMLElement
    expect(within(steel).getByText("pa_celik")).toBeVisible()
    expect(within(steel).getByText("183")).toBeVisible()
    expect(within(steel).getByText("22")).toBeVisible()
    expect(within(table).getByText("Ürün türü")).toBeVisible()
  })

  it("names the pages kept for their old addresses and what stays in the report only", async () => {
    render(<RunResult job={job({ wordpress })} source="wordpress" />)
    await userEvent.click(screen.getByRole("tab", { name: "Taşınmayanlar" }))

    const pages = screen.getByText("Yalnızca eski adresi tutulan sayfalar")
    expect(pages).toHaveTextContent("2")
    expect(screen.getByText(/Eski adresler ve yönlendirmeler kartında karar verin/)).toBeVisible()
    const coupons = screen.getByText("Kuponlar").closest("li") as HTMLElement
    expect(within(coupons).getByText("1")).toBeVisible()
    expect(within(coupons).getByText("Raporda, taşınmadı")).toBeVisible()
    for (const kind of ["Menü öğeleri", "Ürün etiketleri", "Blog yorumları"]) {
      expect(screen.getByText(kind)).toBeVisible()
    }
    expect(screen.getAllByText("Raporda, taşınmadı")).toHaveLength(4)
  })

  it("points to the report file when the summary carries no attributes", async () => {
    render(<RunResult job={job({})} source="wordpress" />)
    await userEvent.click(screen.getByRole("tab", { name: "Özellikler" }))

    expect(screen.getByText(/raporun Notlar sayfasında/)).toBeVisible()
    expect(screen.queryByRole("table")).toBeNull()
  })

  it("keeps another source's report as it was, without the tabs", () => {
    render(<RunResult job={job({})} source="bundle" />)

    expect(screen.queryByRole("tab")).toBeNull()
    expect(screen.getByRole("table")).toBeVisible()
    expect(screen.queryByText(/biçimiyle/)).toBeNull()
  })

  // ADR-0055: descriptions moved as documents, counted under the products
  it("says how many products' descriptions keep their formatting, any source", () => {
    const documented = { ...counts, product: { ...counted({ read: 4, created: 4 }), documents: 3 } }
    const { unmount } = render(
      <RunResult job={job({ counts: documented, wordpress })} source="wordpress" />
    )
    expect(screen.getByText("3 ürünün açıklaması biçimiyle taşınacak")).toBeVisible()
    unmount()

    render(<RunResult job={job({ mode: "apply", counts: documented })} source="shopify" />)
    expect(screen.getByText("3 ürünün açıklaması biçimiyle taşındı")).toBeVisible()
  })

  it("shows a description refresh as what it rewrote, not as a migration", () => {
    const refreshed = {
      product: { ...counted({ read: 6, updated: 4, found: 1, skipped: 1 }), documents: 4 },
    }
    render(
      <RunResult
        job={job({ mode: "apply", refresh: ["descriptions"], counts: refreshed })}
        source="wordpress"
      />
    )

    expect(screen.getByText("Açıklamalar yenilendi.")).toBeVisible()
    expect(screen.queryByRole("tab")).toBeNull()
    const line = (label: string) => screen.getByText(label).closest("li") as HTMLElement
    expect(line("Yenilenen açıklamalar")).toHaveTextContent("4")
    expect(line("Zaten aynı olanlar")).toHaveTextContent("1")
    expect(line("Önceki bir çalıştırmada taşınmamış ürünler")).toHaveTextContent(
      /1.*önce Aktarım ile taşıyın/
    )
    expect(line("Biçimli açıklamaya sahip olanlar")).toHaveTextContent("4")
    // Nothing refused: no line for it
    expect(screen.queryByText("Yenilenemeyenler")).toBeNull()
    expect(screen.getByRole("button", { name: "Raporu indir" })).toBeVisible()
  })

  // adr/0042 Ek 2026-11-27
  it("shows a blog picture refresh as the posts and pictures it added", () => {
    const added = {
      post: counted({ read: 54, updated: 40, found: 2, skipped: 12 }),
      image: counted({ read: 130, created: 120, found: 6, skipped: 4 }),
    }
    render(
      <RunResult
        job={job({ mode: "apply", refresh: ["post_images"], counts: added })}
        source="wordpress"
      />
    )

    expect(screen.getByText("Blog görselleri taşındı.")).toBeVisible()
    expect(screen.queryByRole("table")).toBeNull()
    const line = (label: string) => screen.getByText(label).closest("li") as HTMLElement
    expect(line("Görselleri eklenen yazılar")).toHaveTextContent("40")
    expect(line("Ortam kütüphanesine eklenen görseller")).toHaveTextContent("120")
    expect(line("Görselleri zaten eklenmiş yazılar")).toHaveTextContent("2")
    expect(line("İndirilemeyen görseller")).toHaveTextContent(/4.*raporda/)
    expect(screen.queryByText("Görselleri eklenemeyen yazılar")).toBeNull()
  })
})
