import type { SheetCell, SheetSpec } from "../../lib/sheets"
import type { LinkRow } from "./link-plan"
import type { LinkRewriteResult } from "./link-rewrite"

/**
 * A link rewrite's report in the shop's words (adr/0042 Ek 2026-11-05):
 * the counts, every link moved (old → new), every link that answers
 * nothing and why, so the shop fixes those by hand or with a redirect.
 */

const KIND_TEXT: Readonly<Record<LinkRow["kind"], string>> = {
  page: "Sayfa",
  post: "Blog yazısı",
  product: "Ürün açıklaması",
  category: "Kategori açıklaması",
  brand: "Marka açıklaması",
  collection: "Koleksiyon açıklaması",
  post_category: "Blog kategorisi açıklaması",
  post_tag: "Blog etiketi açıklaması",
}

const REASON_TEXT: Readonly<Record<NonNullable<LinkRow["reason"]>, string>> = {
  gone: "Sayfa kalıcı olarak kaldırılmış (410)",
  not_found: "Bu adreste sayfa yok: yönlendirme ya da yeni bağlantı gerekir",
}

const row = (link: LinkRow, last: string): SheetCell[] => [
  KIND_TEXT[link.kind],
  link.title,
  link.href,
  last,
]

/** The links moved and those that answer nothing, as rows under one header. */
export function linkRows(result: Pick<LinkRewriteResult, "changed" | "unresolved">): {
  changed: SheetCell[][]
  unresolved: SheetCell[][]
} {
  return {
    changed: result.changed.map((link) => row(link, link.target ?? "")),
    unresolved: result.unresolved.map((link) =>
      row(link, link.reason ? REASON_TEXT[link.reason] : "")
    ),
  }
}

/** The job's report: the counts, the links moved, the links that answer nothing. */
export function linkReportSheets(dryRun: boolean, result: LinkRewriteResult): SheetSpec[] {
  const rows = linkRows(result)
  return [
    {
      name: "Özet",
      widths: [44, 12],
      rows: [
        [dryRun ? "Kontrol (hiçbir şey yazılmadı)" : "Uygulandı", ""],
        ["Okunan belge", result.documents],
        [dryRun ? "Değişecek belge" : "Değişen belge", result.rewritten],
        [dryRun ? "Düzeltilecek bağlantı" : "Düzeltilen bağlantı", result.changed.length],
        ["Çözülemeyen bağlantı", result.unresolved.length],
      ],
    },
    {
      name: dryRun ? "Düzeltilecekler" : "Düzeltilenler",
      widths: [18, 48, 60, 60],
      rows: [["Tür", "Başlık", "Eski bağlantı", "Yeni bağlantı"], ...rows.changed],
    },
    {
      name: "Çözülemeyenler",
      widths: [18, 48, 60, 56],
      rows: [["Tür", "Başlık", "Bağlantı", "Neden"], ...rows.unresolved],
    },
  ]
}
