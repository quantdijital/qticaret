import { startFakeGoogle } from "../google/fake-server"
import { stateFileFor } from "./state-file"

/**
 * The local Google for a developer's machine (F10 M13):
 * `pnpm dev:google`, with the backend started as
 * `GOOGLE_BASE_URL=http://127.0.0.1:9109` and the platform client below as
 * `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. It shows
 * Google's consent screen in the browser, answers Merchant API and
 * Search Console, and keeps the shop's refresh token in a file between runs.
 *
 * Port 9109: 9108 is Paraşüt's. The client is fixed so the backend's
 * `.env` keeps it between runs, and readable on purpose (docs/04): no
 * scanner takes it for a real one, and real Google refuses it.
 */
const client = {
  clientId: "gelistirme-google-istemcisi.apps.googleusercontent.com",
  clientSecret: "gelistirme-google-sirri",
}

/** A variable's value, an empty one counted as unset. */
const env = (name: string): string | undefined => {
  const value = process.env[name]?.trim()
  return value === "" ? undefined : value
}
const port = Number(env("FAKE_GOOGLE_PORT") ?? 9109)
// Fixed, so Settings > Marketing takes the same Merchant Center account on every run
const merchantId = env("FAKE_GOOGLE_MERCHANT_ID") ?? "5432109876"

void startFakeGoogle({
  port,
  client,
  email: env("FAKE_GOOGLE_EMAIL") ?? "atolye.magaza@gmail.com",
  merchantId,
  stateFile: stateFileFor("google", port),
}).then((fake) => {
  process.stdout.write(
    [
      `Yerel Google ${fake.url} adresinde.`,
      "Backend .env:",
      `  GOOGLE_BASE_URL=${fake.url}`,
      `  GOOGLE_OAUTH_CLIENT_ID=${client.clientId}`,
      `  GOOGLE_OAUTH_CLIENT_SECRET=${client.clientSecret}`,
      `Bağlanan hesap: ${fake.email}`,
      `Merchant Center hesap kimliği: ${fake.merchantId}`,
      "Panel > Ayarlar > Pazarlama > Google: bağlan, sonra hesap kimliğini yaz",
      "",
    ].join("\n")
  )
})
