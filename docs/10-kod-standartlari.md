# 10 — Kod Standartları

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`. `any` yasak (zorunluysa `unknown` + daraltma).
- Dış servis yanıtları Zod ile parse edilir; tip "güvenmek" yerine doğrulanır.
- Enum yerine `as const` nesneler + union tipler.
- Para tutarları için tek yardımcı modül (`lib/money`); float aritmetiği yok, ondalık kütüphanesi veya tam sayı (kuruş) kullan.

## Medusa desenleri

```ts
// Workflow: dış çağrı + compensation
const createShipmentStep = createStep(
  "create-shipment",
  async (input: Input, { container }) => {
    const shipment = await provider.create(input)
    return new StepResponse(shipment, shipment.id) // ikinci arg: compensation girdisi
  },
  async (shipmentId, { container }) => {
    if (shipmentId) await provider.cancel(shipmentId)
  }
)
```

- Workflow ve step adları kebab-case, benzersiz, alan önekli: `invoice-create-for-order`.
- Subscriber'lar sadece workflow tetikler; iş mantığı içermez.
- **Çekirdek workflow hook'ları** (`src/workflows/hooks/`):
  - Medusa hook başına **tek handler** kabul eder; ikinci tanım hata verir. Yeni bir kural, o hook'un mevcut handler'ına eklenir. Dosya adı amacı ya da hook'u söyler.
  - `validate` hook'ları ana adımlardan önce çalışır.
  - `productsCreated`/`productsUpdated` gibi sonuç hook'ları ana adımlardan sonra çalışır: girdiyi değiştiremez, hata fırlatmak işlemi geri alır.
  - Handler'ın kendi yan etkileri (ör. `url-registry` claim'leri) compensation ile geri alınır.
- **Core route gövdesini doğrulamadan önce değiştiren middleware** `methods` belirtmez. Medusa onu `app.use` ile, core validator'dan önce bağlar. Path'i `routePath(req)` ile okur, çünkü `req.path` mount yolu kadar kısalır (ör. `api/validation/catalog-handles.ts`).
- Scheduled job'lar idempotent ve kilitli.

### Özellik bayrakları (adr/0012)
- Kod sektör adı kontrol etmez, bayrak okur. Yeni bayrak `modules/platform-settings/features.ts` içindeki `FEATURES`'a eklenir: varsayılan, `owner` (`tenant` ya da `platform`), i18n etiket ve açıklama anahtarı.
- Route: `requireFeature("anahtar")` route'un **ilk** middleware'i olur (önündeki bir doğrulayıcı önce 400 verirdi). Bayrak kapalıyken uç, var olmayan bir route ile bayt bayt aynı yanıtı verir. Bilinmeyen anahtar açılışta hata verir.
- Workflow: ilk adım `assertFeatureEnabledStep("anahtar")`. Bu workflow'u çağıran route da aynı bayrakla korunur; yoksa kapalı özellik 404 yerine 400 `features.disabled` ile kendini belli eder.
- Subscriber/job: `container.resolve(PLATFORM_SETTINGS_MODULE).isFeatureEnabled("anahtar")` false ise hiçbir şey yapmadan döner.
- Admin widget/sayfa bayrak kapalıyken gizlenir. Bu yalnızca kullanılabilirlik içindir; koruma API'dedir.
- Ayar bölümüne alan eklemek: `sections/<bölüm>.ts`'te alan ve varsayılan. Strict şema serbest alanı reddeder; secret alanı tanımlanmaz; sağlayıcı hesaplarının gizli alanları `integration-credentials/providers.ts`'e girer (adr/0027). Metin alanları `isCleanText` ile kontrol karakteri ve yalnız surrogate reddeder. Bir alanı kaldırmak, saklanan değeri okumada düşürür; geçmeyen alan tek başına varsayılana döner.
- Platform bayraklarında tenant override'ı okunmaz; bayrak tenant'tan platforma geçerse eski seçim etkisizdir.

## Hata yönetimi

- Sağlayıcı hataları `ProviderError` ile sarılır: `{ provider, providerCode, retryable, safeMessage }`. Alanın adı `code` değildir, çünkü Medusa'nın error handler'ı `error.code`'u yanıt gövdesine kopyalar.
- `safeMessage` her zaman bir i18n anahtarıdır (`billing_profile.tax_id_invalid`). Anahtar biçiminde olmayan bir değer istemciye gitmez, yerine varsayılan anahtar kullanılır.
- Kullanıcıya `safeMessage` (Türkçe, i18n), loga tam bağlam (redakte).
- `catch` edip yutmak yasak; ya ele al ya yeniden fırlat.
- Hata türü `instanceof` ile değil, `lib/errors` guard'larıyla (`isProviderError` vb.) kontrol edilir. Workflow'dan geçen hata düz nesneye dönüşür ve sınıf kimliği kaybolur; Medusa da kendi hatasını `MedusaError.isMedusaError` ile böyle tanır.
- HTTP hata yanıtları `src/api/http/error-handler.ts`'ten geçer (Medusa'nın handler'ının yerine):
  - Bizim tiplerimiz `toHttpError` ile eşlenir; `ProviderError` 502/503 ve `RetryableError` 503 kendi i18n gövdeleriyle döner, `RetryableError`'da `Retry-After` yazılır.
  - Medusa kaynaklı 5xx her yerde, admin dahil, genel gövde döner (`type: "unknown_error"`).
  - DB kaynaklı 4xx mesajları (unique/FK/not-null/kolon; kolon adı ve satır değeri içerir) `/admin/*` dışında i18n anahtarıyla değişir: `errors.duplicate`, `errors.invalid_reference`, `errors.invalid_data`.
  - Body-parser hataları (bozuk JSON, büyük gövde) sabit gövdeyle döner: 400 `errors.invalid_data`, 413 `errors.request_too_large`. V8'in JSON hata mesajı gövdeden alıntı yaptığı için mesaj ne gönderilir ne loglanır.
  - Kod tarafından fırlatılan bir ZodError 400 ve `errors.invalid_data` döner; şema yolları gönderilmez. Medusa'nın istek doğrulaması MedusaError fırlatır, onun mesajı korunur.
  - Her gövdede `request_id` bulunur ve `X-Request-Id` header'ıyla aynıdır. İsteği kendisi reddeden middleware'ler `src/api/http/reject.ts`'teki `rejectRequest`'i kullanır.
  - Handler'ın kendisi hata verirse genel 500 döner; yanıt akmaya başladıysa bağlantı kesilir. İki durumda da Express'in ham stack basan fallback'ine düşülmez.
  - Dashboard'a (session çereziyle, `Authorization` başlığı olmadan gelen admin isteği ya da `Origin`'li giriş isteği) i18n anahtarı Türkçe cümle olarak döner; anahtar `code`'da kalır (adr/0021). Çekirdek ekranlar mesajı çevirmeden basar. API istemcileri anahtarı `message`'da alır.
- **Yeni bir hata anahtarı** `src/lib/errors/messages/tr.ts` ve `en.ts`'e cümlesiyle eklenir. Admin çevirisi ve dashboard yanıtı bu tek kaynaktan gelir; cümlesi olmayan anahtar, kodu anan genel bir cümleye düşer.

## Dış servis çağrıları

- Sağlayıcılar `lib/clients` `createHttpClient`'ı kullanır. Sağlayıcı başına bir kez, modül seviyesinde oluşturulur; devre kesici bu yüzden süreç başınadır.
- **Yeniden deneme:**
  - GET, HEAD, PUT, DELETE ve OPTIONS yeniden denenir. POST ve PATCH yalnızca `idempotent: true` (idempotency key) ile denenir.
  - Gönderilmediği kesin hatalar (bağlantı reddi, DNS, TLS) her metotta denenir.
- **Sonucu belirsiz hata:** İdempotent olmayan bir istek zaman aşımı, bağlantı kopması ya da 500/502/504 alırsa `providerCode: "outcome_unknown"` ve `retryable: false` döner. Ödeme gibi akışlar bu durumda yeniden denemeden önce sağlayıcıda durum sorgular.
- **Path:** Girdi içeren path'ler segment dizisi olarak verilir (`["shipments", trackingNo]`); her segment ayrı kodlanır. Ham path'te `?`, `#`, `\` ve nokta segmenti reddedilir.
- **Log:** Her denemede sabit alanlı tek satır yazılır; header, sorgu, gövde ve hata metni yazılmaz. Secret'ı path'te taşıyan URL'ler (webhook) `hidePaths` ya da `logPath` kullanır.
- **Kullanıcı URL'leri:** Kullanıcı ya da tenant kontrollü URL'ler `safeTransport` üzerinden gider (SSRF kuralları, yönlendirme yok).
- **Sağlık kontrolü:** `/admin/integrations/health` kontrolleri `lib/integrations/health` `defaultHealthChecks()` listesine eklenir. Sonuç yalnızca durum ve neden kodu taşır.

## Loglama

- Tek logger `src/lib/logging`: pino, her ortamda stdout'a JSON satırı. Medusa'nın logger'ı da (`defineConfig({ logger })`) buna bağlıdır; çekirdek, modüller ve `medusa exec` script'leri aynı biçimde ve aynı redaksiyonla yazar.
- Platform kodu `logger.info({ event, orderId, provider }, "mesaj")` biçimini kullanır. `event` zorunludur ve olayı adlandırır (`bootstrap.region_created`). Mesaj verilmezse `event` mesaj olur; pino'nun mesajı `err.message`'tan türetmesi engellenir. Container'daki Medusa logger'ı yalnızca string kabul eder; yeni kodda kullanılmaz.
- İstek içinde yazılan her satır `request_id` taşır (AsyncLocalStorage). Alan adı, Medusa'nın erişim loguyla aynı anahtar olsun diye `request_id`'dir. Gelen `x-request-id` biçim kontrolünden geçer (`src/api/http/request-id.ts`); geçmezse UUID üretilir.
- Kişisel veri ve secret loglanmaz. Redaksiyon satır serileştirilmeden önce uygulanır; çıktı her zaman geçerli JSON kalır (`src/lib/logging/redact.ts`):
  - **Anahtar adı:** Her derinlikte, `cause` zinciri dahil uygulanır. Anahtar küçük harfe çevrilir ve ayırıcılardan arındırılır.
    - Secret, içeriyorsa: password, secret, token, apikey, authorization, cookie (`set-cookie` dahil), credential, signature, encryptionkey, hashkey, privatekey, tckn, taxid, identitynumber, cardnumber, cvv, cvc, merchantkey, merchantsalt, iban.
    - Kişisel veri, içeriyorsa: phone, gsm, msisdn, email, address, postalcode, firstname, lastname, fullname, legalname, contactname. `id`/`ids` ile bitenler (`address_id`) ve `email_verified` okunur kalır.
    - Tam olarak: body, rawbody, rawheaders, detail, query, sql, bindings, parameters (istek ve satır içeriği taşıyan alanlar), sessionid, sid, otp.
  - **Metin deseni:** Tutulan her string değerde ve mesajda uygulanır.
    - `Authorization:`/`Cookie:` başlık satırları (şema ne olursa olsun), `Bearer`/`Basic` kimlik bilgileri, JWT
    - Metin içindeki `ad=değer` ve `"ad":"değer"` biçimindeki secret'lar (form gövdesi, sorgu dizesi, string olarak tutulan JSON)
    - URL'deki `kullanıcı:şifre@` (kullanıcı boş da olabilir)
    - E-posta yerel kısmı (`%40` dahil), TR cep ve önekli sabit telefon
    - Checksum'ı geçen TCKN (sayı alanlarında da)
    - MikroORM hata mesajının başındaki SQL ifadesi (düz nesne hatalarda ve stack'te de)
  - Desenler doğrusal çalışır; her desen bir dizinin yalnızca başında denenir. 8 KB'tan uzun metin kesilir.
- Hata nesnesi `err` alanında loglanır. Düz nesneye çevrilir (`name`, `message`, `stack`, kendi alanları); `cause` ve `AggregateError.errors` da redakte edilir. Okunamayan nesne (throw eden getter) `[Unreadable]` olur; loglama hiçbir zaman isteği düşürmez.
- Çıktı pino'nun doğrudan fd yazıcısına değil `process.stdout`'a gider. Testler stdout'u yakalar (`integration-tests/helpers/logs.ts`); yakalayıcı logger'ın yoklama satırını görmezse hata verir, böylece "logda görünmüyor" testleri boşa geçemez.
- Seviye `LOG_LEVEL` ile ayarlanır: Medusa seviye adları, varsayılan `http`.

## İsimlendirme

- Dosya: `kebab-case.ts`; bileşen: `PascalCase.tsx`; fonksiyon/değişken: `camelCase`; sabit: `UPPER_SNAKE`.
- Boolean: `is/has/can` öneki.
- Kod ve commit İngilizce; UI metinleri i18n (tr varsayılan); dokümanlar Türkçe.

## Git

- Conventional commits: `feat(payment-iyzico): add partial refund`
- Küçük, tek amaçlı commit'ler. PR başına bir görev.
- PR şablonu: amaç, değişiklikler, test kanıtı, güvenlik etkisi, ilgili KK.

## Yapma listesi

- Medusa çekirdek dosyalarını patch'leme
- Modülden modüle doğrudan servis çağrısı
- Route içinde iş mantığı
- Request yolunda senkron ağır iş
- Sektöre özel `if` (`if (store.sector === "knife")`)
- Testsiz ödeme/kargo/fatura kodu
- Hafızadan Medusa API'si — Context7 ile doğrula
