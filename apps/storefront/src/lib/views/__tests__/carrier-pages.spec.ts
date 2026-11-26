import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { carrierPages } from "../carrier-pages"

/** The connected carriers' own tracking pages for the order lookup (adr/0046 Ek 2026-11-05). */

describe("the carriers' tracking pages", () => {
  it("lists only the connected carriers it knows a page for", () => {
    expect(carrierPages(["aras", "mng", "yurtici"], t)).toEqual([
      { label: "Aras Kargo", path: "https://kargotakip.araskargo.com.tr/" },
      {
        label: "Yurtiçi Kargo",
        path: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula",
      },
    ])
    expect(carrierPages(undefined, t)).toEqual([])
  })
})
