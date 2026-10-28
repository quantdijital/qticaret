import { startFakeAras } from "../aras/fake-server"

/**
 * The fake Aras Kargo for a developer's machine (adr/0035): `pnpm dev:aras`,
 * with the backend started as `ARAS_BASE_URL=http://127.0.0.1:9104`.
 *
 * The account is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one, and real Aras
 * refuses it.
 */
const account = { username: "gelistirme-aras", password: "gelistirme-sahte-aras-sifresi" }

const port = Number(process.env["FAKE_ARAS_PORT"] ?? 9104)

void startFakeAras(account, { port }).then((fake) => {
  process.stdout.write(
    [
      `Sahte Aras Kargo ${fake.url} adresinde.`,
      `Backend: ARAS_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > Aras Kargo (test modu açık):",
      `  Kullanıcı adı: ${account.username}`,
      `  Şifre: ${account.password}`,
      "",
    ].join("\n")
  )
})
