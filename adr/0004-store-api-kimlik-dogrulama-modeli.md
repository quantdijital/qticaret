# ADR-0004: Store API kimlik doğrulama modeli

- **Durum:** Önerildi (F1.8'de Context7 ile Medusa'nın güncel davranışı doğrulanıp kabul edilecek)
- **Tarih:** 2026-10-22

## Bağlam
`docs/04-guvenlik.md` "localStorage'da token yok" der. Medusa v2 Store API'de müşteri kimlik doğrulaması
varsayılan olarak bearer JWT döndürür; cookie/session desteği de vardır (doğrulanacak). Seçim şunları etkiler:
- Storefront (F18) ve mobil uygulama (F19) istemcilerinin token saklama biçimi (XSS'e maruz kalma)
- CSRF gereksinimi (cookie seçilirse)
- Çoklu tema ve headless istemcilerin tek sözleşmeye bağlanması (`packages/types`)
- SSR'de (Next.js) sunucu tarafı istek yaparken kimliğin taşınması

## Karar (öneri)
- **Web storefront:** httpOnly + Secure + SameSite=Lax cookie oturumu. Storefront sunucusu (SSR) cookie'yi Medusa'ya iletir.
  Cookie kullanılan tüm mutasyonlarda CSRF token (double-submit veya Origin kontrolü + custom header).
- **Mobil/üçüncü taraf istemciler:** Bearer JWT, kısa ömürlü access + refresh (Medusa'nın yerleşik desteği doğrulanır);
  token'lar güvenli depoda (Keychain/Keystore), asla web localStorage'da.
- Her iki modda da müşteri `customer_id` çözümü aynı middleware'den geçer; route kodu farkı bilmez.
- Misafir sepeti: cart_id cookie/sunucu tarafı; sepet başka müşteriye aktarılırken sahiplik kontrolü.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Yalnızca JWT (localStorage) | Basit, Medusa varsayılanı | XSS'te token çalınır; dokümandaki kuralla çelişir |
| **Cookie (web) + JWT (mobil)** | Web'de XSS'e dayanıklı, mobilde standart | CSRF koruması gerekir, iki yol test edilir |
| Yalnızca cookie | Tek yol | Mobil istemciler için uygunsuz |

## Medusa 2.21.2'de doğrulananlar (2026-10-24, F1 planlaması)
**Yerleşik olarak gelenler:**
- `POST /auth/customer/emailpass` JWT döner.
- `POST /auth/session` (bearer) JWT'yi express-session cookie'sine çevirir; `DELETE /auth/session` çıkış yapar.
- Core route'lar `authenticate("customer", ["session", "bearer"])` kullanır. İki modda da `req.auth_context.actor_id` aynı şekilde çözülür.
- Ayarlar: `projectConfig.cookieOptions` ile `httpOnly`, `secure`, `sameSite`; `http.jwtExpiresIn` (varsayılan `1d`).
  - `sameSite: lax` ve `secure` yalnızca production/staging'de varsayılan olarak açık.
- 2.21.2'de `/auth/mfa/*` ve `/auth/verification/*` endpoint'leri de var (F10.1, F12.6 için).

**Özel iş gerektirenler:**
- **CSRF:** Medusa'da CSRF koruması yok, `sameSite: lax` tek önlem. Origin kontrolü + custom header (F2.10).
- **Refresh token:** `POST /auth/token/refresh` geçerli bir token'dan yeni bir JWT üretir. Ayrı bir refresh token yok, eski token iptal edilmiyor. Kısa ömürlü access + dönen refresh + iptal mekanizması bizim işimiz (mobil, F19).
- **Session store:** `redisUrl` yoksa session bellekte tutulur. Prod'da `projectConfig.redisUrl` zorunlu (F1.8'de config'e eklenir, F16'da TLS ve auth ile).
- **Misafir sepeti:** Sahiplik kontrolü.

## Sonuçlar
- F1.8: Medusa'nın auth modülü ve session/JWT seçenekleri doğrulanır; karar buraya işlenir.
- F2.10 CSRF middleware'i bu karara göre yazılır. F10.1 müşteri hesabı bu modeli uygular.
- `packages/types` istemci sözleşmesinde kimlik taşıma biçimi belgelenir.
