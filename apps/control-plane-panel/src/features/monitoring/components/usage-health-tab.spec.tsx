import { screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { SHOP } from "@/test/shops"
import { SILENT, USAGE_HEALTH } from "@/test/usage-health"
import type { UsageHealth } from "../api"
import { UsageHealthTab } from "./usage-health-tab"

const PATH = "/admin/cp/tenants/ten_kahve/usage-health"

const answering =
  (body: UsageHealth) =>
  (call: Sent): Answer =>
    call.path === PATH ? { status: 200, body } : { status: 404, body: {} }

const lineOf = (name: string) => {
  const list = screen.getByRole("list", { name: "Kullanım ve limitler" })
  return within(list).getByText(name).closest("li") as HTMLElement
}

describe("UsageHealthTab: the shop's usage and health (Ek C13)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows each limit's use with its bar and words: 80 % warns, orders never block", async () => {
    const sent = stubApi(answering(USAGE_HEALTH))
    renderAs(<UsageHealthTab shop={SHOP} />, "readonly")

    await screen.findByRole("list", { name: "Kullanım ve limitler" })
    expect(sent.map((call) => call.path)).toEqual([PATH])
    // 1.650 of 2.000 products (the exception's value): near the limit
    const products = lineOf("Ürün")
    expect(within(products).getByText("1.650 / 2.000")).toBeInTheDocument()
    expect(within(products).getByText("Limite yaklaştı")).toBeInTheDocument()
    expect(within(products).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "83")
    // Orders past their limit: a warning in words, never "blocked"
    const orders = lineOf("Aylık sipariş")
    expect(within(orders).getByText("Limit aşıldı, engellenmez")).toBeInTheDocument()
    // 2 of 2 staff: at a blocking limit
    expect(within(lineOf("Personel")).getByText("Limitte")).toBeInTheDocument()
    expect(within(lineOf("Depolama")).getByText("820 MB / 20.480 MB")).toBeInTheDocument()
    expect(within(lineOf("Özel alan adı")).getByText("0 / 3")).toBeInTheDocument()
    // Its last order, release and report
    expect(screen.getByText("1.4.0 · 0123456789ab")).toBeInTheDocument()
    expect(screen.getByText("Son sipariş")).toBeInTheDocument()
    expect(screen.queryByText(/Rapor gelmiyor/)).not.toBeInTheDocument()
  })

  it("shows each target's health in words, its time, a day's share and the last probes", async () => {
    stubApi(answering(USAGE_HEALTH))
    renderAs(<UsageHealthTab shop={SHOP} />, "readonly")

    const backend = await screen.findByRole("region", { name: "Arka uç" })
    expect(within(backend).getByText("Sağlıklı")).toBeInTheDocument()
    expect(within(backend).getByText("42 ms")).toBeInTheDocument()
    expect(within(backend).getByText(/Son yoklama/)).toBeInTheDocument()
    expect(
      within(backend).getByRole("img", { name: "Son 3 yoklamanın 2 tanesi yanıt aldı" })
    ).toBeInTheDocument()
    const storefront = screen.getByRole("region", { name: "Vitrin" })
    expect(within(storefront).getByText("Sağlıksız")).toBeInTheDocument()
    expect(
      within(storefront).getByText("HTTP 503 yanıtı · art arda 4 başarısız yoklama")
    ).toBeInTheDocument()
    expect(within(storefront).getByText(/Son başarılı yanıt/)).toBeInTheDocument()
    expect(within(storefront).getByText(/%60/)).toBeInTheDocument()
  })

  it("warns when reports stop coming, and says what is not probed yet", async () => {
    stubApi(answering(SILENT))
    renderAs(<UsageHealthTab shop={SHOP} />, "readonly")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rapor gelmiyor: mağaza etkinleştiğinden beri kullanım raporu göndermedi."
    )
    expect(screen.getByText("Henüz kullanım raporu gelmedi.")).toBeInTheDocument()
    expect(within(lineOf("Ürün")).getByText("Raporda yok")).toBeInTheDocument()
    expect(screen.getByText("Henüz yoklanmadı")).toBeInTheDocument()
    expect(screen.getByText("Yoklanmıyor")).toBeInTheDocument()
    expect(screen.getByText(/yerel mağazaların vitrini yok/)).toBeInTheDocument()
  })
})
