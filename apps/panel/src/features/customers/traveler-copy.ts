import type { FoundTraveler } from "@/features/customers/api/traveler-requests"

/**
 * A traveler's copy of what the shop keeps of them (adr/0076 Ek D6b), in
 * the shape of the customers' own copy: Turkish keys, the number masked.
 */
export function travelerCopyOf(rows: readonly FoundTraveler[], now: Date = new Date()) {
  return {
    hazırlanma: now.toISOString(),
    katılımcı_kayıtları: rows.map((row) => ({
      ad: row.first_name,
      soyad: row.last_name,
      doğum_tarihi: row.birth_date,
      uyruk: row.nationality,
      kimlik_ya_da_pasaport_no: row.document_masked,
      ürün: row.product_title,
      hizmet_tarihi: row.starts_at,
      sipariş: row.display_id,
      kayıt_tarihi: row.created_at,
      silinme_tarihi: row.purge_after,
    })),
  }
}

/** The copy as a file the browser saves; nothing leaves the panel but this download. */
export function downloadTravelerCopy(rows: readonly FoundTraveler[]): void {
  const blob = new Blob([JSON.stringify(travelerCopyOf(rows), null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "katilimci-verisi.json"
  link.click()
  URL.revokeObjectURL(url)
}
