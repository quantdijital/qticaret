import { startFakeParasut } from "../parasut/fake-server"

/**
 * The fake Paraşüt for a developer's machine (adr/0034): `pnpm dev:parasut`,
 * with the backend started as `PARASUT_BASE_URL=http://127.0.0.1:9106`
 * and the platform client below as `PARASUT_CLIENT_ID` and
 * `PARASUT_CLIENT_SECRET`.
 *
 * The values are fixed so the panel keeps its connection between runs,
 * and readable on purpose (docs/04): no scanner takes them for real ones,
 * and real Paraşüt refuses them.
 */
const client = { clientId: "gelistirme-parasut", clientSecret: "gelistirme-sahte-parasut-sirri" }
const user = { username: "gelistirme@ornek.com", password: "gelistirme-sahte-parasut-sifresi" }

const port = Number(process.env["FAKE_PARASUT_PORT"] ?? 9106)

void startFakeParasut(client, user, { port, companyId: "123456" }).then((fake) => {
  process.stdout.write(
    [
      `Sahte Paraşüt ${fake.url} adresinde.`,
      `Backend: PARASUT_BASE_URL=${fake.url}`,
      `         PARASUT_CLIENT_ID=${client.clientId}`,
      `         PARASUT_CLIENT_SECRET=${client.clientSecret}`,
      "Panel > Ayarlar > E-Fatura > Paraşüt:",
      `  Firma numarası: ${fake.companyId}`,
      `  Yetki kodu: ${fake.url}/oauth/authorize adresini açıp kodu kopyalayın`,
      `  E-Fatura mükellefi sayılan VKN'ler: Panelden değil, testte fake.inboxes ile`,
      "",
    ].join("\n")
  )
})
