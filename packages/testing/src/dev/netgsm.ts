import { startFakeNetgsm } from "../netgsm/fake-server"

/**
 * The fake Netgsm for a developer's machine (adr/0036): `pnpm dev:netgsm`,
 * with the backend started as `NETGSM_BASE_URL=http://127.0.0.1:9106`.
 * The account is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one.
 */
const account = {
  usercode: "8500000000",
  password: "gelistirme-sahte-netgsm-sifresi",
  headers: ["MAGAZA"],
}

const port = Number(process.env["FAKE_NETGSM_PORT"] ?? 9106)

void startFakeNetgsm(account, { port }).then((fake) => {
  process.stdout.write(
    [
      `Sahte Netgsm ${fake.url} adresinde.`,
      `Backend: NETGSM_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > SMS > Netgsm:",
      `  Kullanıcı kodu: ${account.usercode}`,
      `  Şifre: ${account.password}`,
      `  Gönderici adı: ${account.headers[0] ?? ""}`,
      "",
    ].join("\n")
  )
})
