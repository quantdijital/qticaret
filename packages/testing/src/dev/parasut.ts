import { DEFAULT_PARASUT_COMPANY, startFakeParasut } from "../parasut/fake-server"
import { stateFileFor } from "./state-file"

/**
 * The local Paraşüt for a developer's machine (adr/0034): `pnpm dev:parasut`,
 * with the backend started as `PARASUT_BASE_URL=http://127.0.0.1:9108`
 * and the platform client below as `PARASUT_CLIENT_ID` and
 * `PARASUT_CLIENT_SECRET`. Invoices are numbered in the shop's series,
 * printed with the shop as seller, and go out as e-Fatura to the tax ids
 * registered below, as e-Arşiv to everyone else. Its tokens and invoices
 * are kept in a file between runs.
 *
 * Port 9108: 9106 is Netgsm's. The client is fixed so the backend's
 * `.env` keeps it between runs, and readable on purpose (docs/04): no
 * scanner takes it for a real one, and real Paraşüt refuses it.
 */
const client = { clientId: "gelistirme-parasut", clientSecret: "gelistirme-sahte-parasut-sirri" }
const user = { username: "muhasebe", password: "gelistirme-sahte-parasut-sifresi" }

/** A variable's value, an empty one counted as unset. */
const env = (name: string): string | undefined => {
  const value = process.env[name]?.trim()
  return value === "" ? undefined : value
}
const port = Number(env("FAKE_PARASUT_PORT") ?? 9108)
const series = (env("FAKE_PARASUT_SERIES") ?? "ARS").toUpperCase()
const inboxes = (env("FAKE_PARASUT_EFATURA_VKNS") ?? "")
  .split(",")
  .map((vkn) => vkn.trim())
  .filter(Boolean)
const company = {
  title: env("FAKE_PARASUT_COMPANY_TITLE") ?? DEFAULT_PARASUT_COMPANY.title,
  taxNumber: env("FAKE_PARASUT_COMPANY_VKN") ?? DEFAULT_PARASUT_COMPANY.taxNumber,
  taxOffice: env("FAKE_PARASUT_TAX_OFFICE") ?? DEFAULT_PARASUT_COMPANY.taxOffice,
  address: env("FAKE_PARASUT_COMPANY_ADDRESS") ?? DEFAULT_PARASUT_COMPANY.address,
}
const stateFile = stateFileFor("parasut", port)

const wrong = [
  ...(/^[A-Z0-9]{3}$/.test(series)
    ? []
    : ["FAKE_PARASUT_SERIES üç harf ya da rakam olmalı (ör. ABC)"]),
  ...inboxes
    .filter((vkn) => !/^\d{10,11}$/.test(vkn))
    .map(
      (vkn) =>
        `FAKE_PARASUT_EFATURA_VKNS içindeki "${vkn}" 10 haneli VKN ya da 11 haneli TCKN değil`
    ),
]
if (wrong.length > 0) {
  process.stderr.write(`${wrong.join("\n")}\n`)
  process.exit(1)
}

void startFakeParasut(client, user, {
  port,
  companyId: "123456",
  series,
  company,
  inboxes,
  inboxAlias: (vkn) => `urn:mail:defaultpk@${vkn}.com.tr`,
  stateFile,
}).then((fake) => {
  const year = String(new Date().getFullYear())
  process.stdout.write(
    [
      `Yerel Paraşüt ${fake.url} adresinde${port === 9108 ? " (9106'dan 9108'e taşındı: 9106 Netgsm'in)" : ""}.`,
      "Backend .env (eski PARASUT_BASE_URL satırını bununla değiştirin):",
      `  PARASUT_BASE_URL=${fake.url}`,
      `  PARASUT_CLIENT_ID=${client.clientId}`,
      `  PARASUT_CLIENT_SECRET=${client.clientSecret}`,
      "Panel > Ayarlar > E-Fatura > Paraşüt (panelde test modu yok; bu adres tanımlıyken",
      "faturalar buradan, canlıdaki gibi numara, ETTN ve PDF ile kesilir):",
      `  Firma numarası: ${fake.companyId}`,
      `  Yetki kodu: panelin Paraşüt bağlantısı ${fake.url}/oauth/authorize sayfasını açar;`,
      '  "İzin ver" deyip gösterilen kodu panele yapıştırın.',
      `Satıcı: ${company.title} · VKN ${company.taxNumber} · ${company.taxOffice} VD`,
      "  (FAKE_PARASUT_COMPANY_TITLE, FAKE_PARASUT_COMPANY_VKN, FAKE_PARASUT_TAX_OFFICE,",
      "   FAKE_PARASUT_COMPANY_ADDRESS ile mağazanın Paraşüt'teki bilgileri)",
      `Fatura serisi: ${series} → ${series}${year}000000001 (FAKE_PARASUT_SERIES=ABC ile mağazanın serisi)`,
      `e-Fatura mükellefi sayılanlar (bunlara e-Fatura, diğerlerine e-Arşiv): ${inboxes.length > 0 ? inboxes.join(", ") : "yok"}`,
      "  (FAKE_PARASUT_EFATURA_VKNS=1234567890,9876543210 ile)",
      `Bağlantı, faturalar ve numara sayacı yeniden başlatmada korunur: ${stateFile}`,
      "",
    ].join("\n")
  )
})
