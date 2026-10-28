import { startFakeYurtici } from "../yurtici/fake-server"

/**
 * The fake Yurtiçi Kargo for a developer's machine (adr/0035):
 * `pnpm dev:yurtici`, with the backend started as
 * `YURTICI_BASE_URL=http://127.0.0.1:9105`.
 *
 * The logins are fixed so the panel keeps them between runs, and readable
 * on purpose (docs/04): no scanner takes them for real ones, and real
 * Yurtiçi refuses them.
 */
const accounts = {
  main: { username: "gelistirme-yurtici", password: "gelistirme-sahte-yurtici-sifresi" },
  cod: { username: "gelistirme-yurtici-tahsilat", password: "gelistirme-sahte-tahsilat-sifresi" },
}

const port = Number(process.env["FAKE_YURTICI_PORT"] ?? 9105)

void startFakeYurtici(accounts, { port }).then((fake) => {
  process.stdout.write(
    [
      `Sahte Yurtiçi Kargo ${fake.url} adresinde.`,
      `Backend: YURTICI_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > Yurtiçi Kargo (test modu açık):",
      `  Kullanıcı adı: ${accounts.main.username}`,
      `  Şifre: ${accounts.main.password}`,
      `  Tahsilatlı hesap kullanıcı adı: ${accounts.cod.username}`,
      `  Tahsilatlı hesap şifresi: ${accounts.cod.password}`,
      "",
    ].join("\n")
  )
})
