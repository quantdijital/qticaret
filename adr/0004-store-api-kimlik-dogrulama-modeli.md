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

## Sonuçlar
- F1.8: Medusa'nın auth modülü ve session/JWT seçenekleri doğrulanır; karar buraya işlenir.
- F2.10 CSRF middleware'i bu karara göre yazılır. F10.1 müşteri hesabı bu modeli uygular.
- `packages/types` istemci sözleşmesinde kimlik taşıma biçimi belgelenir.
