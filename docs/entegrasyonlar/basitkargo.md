# BasitKargo Fulfillment Provider

> Kaynak: BasitKargo API belgesi `https://basitkargo.com/api` (tek sayfa, cURL/JS/Python örnekli) ve tanıtım sayfası `https://basitkargo.com/` (ikisi de 2026-11-16'da okundu). Resmî SDK yok (npm ve GitHub'da da bulunamadı); kendi istemcimiz yazılır. Durum: **araştırma, kod yok.** İlgili kararlar: ADR-0027 (hesaplar panelden), ADR-0031 (kargo altyapısı ve takip), ADR-0035 (taşıyıcı kaydı), ADR-0054 (ölçüler isteğe bağlı). Uygulama planı: `docs/entegrasyonlar/plan-basitkargo-birfatura.md`.
>
> "Doğrulanmadı" diye işaretli her şey belgede yazmıyor ya da çelişkili. Gerçek hesapla ya da BasitKargo desteğinden (`destek@basitkargo.com`) cevapla kapanır.

## Amaç ve kapsam

Sahibin isteği (2026-11-16): "kargo entegrasyonunda https://basitkargo.com/api entegrasyonu … yapmalıyız."

- **Amaç:** BasitKargo'yu Geliver, Aras ve Yurtiçi'nin yanına dördüncü kargo sağlayıcısı olarak eklemek (`basitkargo_basitkargo`). Kargoya verme, etiket, takip, iptal, kapıda ödeme ve iade kodu aynı akışlardan geçer.
- **Kapsam:** fiyat (canlı teklif ya da mağazanın desi tablosu), gönderi açma, etiket, iptal, takip (web kancası + sorgu işi), kapıda ödeme tutarı, iade kodu, panelde hesap bağlantısı, sahte sunucu, testler.
- **Kapsam dışı (ilk sürüm):** BasitKargo'nun müşteri (`/customer`) ve marka (`/firm/brand`) yönetimi panelimize taşınmaz; gönderici adresleri BasitKargo panelinde açılır, biz yalnızca listeden seçeriz. Kapıda ödeme tahsilatının mutabakatı (`codInfo`) yalnızca okunur, ödeme defterine yazılmaz (ayrı dilim). Toplu sipariş içe aktarma yok: siparişi biz göndeririz.

## Sağlayıcı özeti

- **Ne:** Türkiye'de çok taşıyıcılı bir **aracı** (Geliver gibi). Tek hesapla PTT, MNG, Yurtiçi, Aras, Sürat, HepsiJet, Kolay Gelsin ve bölgesel Birgünde Kargo.
- **Fiyat modeli:**
  - Üyelik ve aidat yok, taahhüt yok (tanıtım sayfası SSS).
  - BasitKargo'nun anlaşmalı fiyatları KDV dahildir ve hesabın indirimi uygulanmıştır.
  - Ücret **ön ödemeli bakiyeden** düşer (havale ya da kartla yüklenir), ay sonunda tek fatura kesilir.
  - "Alıcı öder" ve "şubede nakit" ödeme yöntemlerinde bakiye kullanılmaz (`paymentMethod`: `ADVANCE`, `CASH`, `RECIPIENT`).
- **Kendi anlaşması:** Mağaza kendi taşıyıcı sözleşmesini BasitKargo'ya ekleyebilir. Taşıyıcı kodu `SELF_` önekiyle kullanılır (ör. `SELF_SURAT`); ücreti taşıyıcı doğrudan mağazaya fatura eder.
- **Otomatik seçim:** `ECONOMIC` (en ucuz), `FAST` (en hızlı).
- **E-ticaret eklentileri:** WooCommerce, Shopify, ikas, Ticimax ve 7 platform daha. Bu eklentiler siparişi BasitKargo paneline taşıyor ve takip numarasını platforma geri yazıyor. Mekanizması belgelenmemiş. **Bizim modelimiz bu değil:** siparişi BasitKargo'ya biz göndeririz (REST API), BasitKargo bizden sipariş çekmez.

### Geliver ile farkı

| | Geliver | BasitKargo |
|---|---|---|
| Model | Aracı, teklif al → kabul et | Aracı, sipariş aç → barkod üret |
| Fiyat sorgusu | Gönderi açılınca zaman uyumsuz teklifler | Eşzamanlı: `POST /v2/quotes`, `/handlers/fee/...`, `GET /v2/tariffs` |
| Ödeme | Geliver hesabı | Ön ödemeli bakiye |
| Kendi sözleşme | Yok | `SELF_<taşıyıcı>` |
| Tekrar önleme | Yok | `Idempotency-Key` başlığı (24 saat) |
| Etiket | PDF bağlantısı | Yalnızca SVG (`GET /label/svg/{id}`) |
| Web kancası | İmzasız `TRACK_UPDATED` | İmzasız, iki olay türü |
| Deneme ortamı | Aynı jetonla `test: true` | **Belgelenmemiş** |

Sahibin notu "Geliver'e bağlı kalma" (2026-10-28) tek aracıya bağımlı kalmama kararıydı ve Aras + Yurtiçi doğrudan entegrasyonuyla karşılandı (ADR-0035). BasitKargo ikinci bir aracı ekler: Geliver'e bağımlılığı daha da azaltır, ayrıca mağazanın kendi sözleşmesini (`SELF_`) aracı paneli üzerinden kullanma yolu açar.

## API (belgeden, 2026-11-16)

- **Adres:** `https://basitkargo.com/api`. Yalnızca HTTPS. Bazı başlıklarda `/api` öneki yazılmamış, örneklerde var.
- **Kimlik:** `Authorization: Bearer <jeton>`. Jeton BasitKargo panelinde hesap ayarlarından üretilir. JSON isteklerde `Content-Type: application/json`.
- **Deneme ortamı:** belgede yok (**doğrulanmadı**). `POST /v2/order` taslak açar (`NEW`) ve ücret düşmez; taslak `DELETE /order/{id}` ile silinir. Barkod üretmek gerçek ücrettir.
- **Hız sınırı:** jeton başına dakikada 600 istek. Aşımda `429` ve `Retry-After` (saniye).
- **Tekrar önleme:** `POST /v2/order`, `POST /v2/order/barcode` ve `POST /v2/order/{id}/barcode` `Idempotency-Key` başlığı alır (1–255 karakter, büyük/küçük harf duyarlı, UUID önerilir, 24 saat saklanır).
  - Aynı anahtar ve aynı gövde: `200` ve `Idempotency-Replayed: true` (ilk sonucun aynısı).
  - Anahtar hâlâ işleniyor: `409`.
  - Aynı anahtar farklı gövde ya da uç: `422`.
  - Barkod üretimi için 90 saniyelik istemci zaman aşımı öneriliyor.
- **Hata biçimi:** standart bir hata gövdesi belgelenmemiş (**doğrulanmadı**). Geçen kodlar: `400` (geçersiz girdi), `409`, `422`, `429`. Doğrulama mesajları Türkçe metin.

### Uçlar

| Grup | Uç | Not |
|---|---|---|
| Taşıyıcı | `GET /handlers` | Hesapta açık taşıyıcılar: `name`, `code`, `logo` |
| Fiyat | `GET /handlers/fee/desiKg/{desiKg}` | Bütün taşıyıcıların desi fiyatı; `codAmount`, `codType` sorgu parametresi; `price`, `inCityPrice`, `codFee` |
| Fiyat | `POST /handlers/fee/packages` | Ölçülerden fiyat (`height`, `width`, `depth`, `weight`) |
| Fiyat | `POST /v2/quotes` | Adrese göre teklif: `price.total`, uygunluk, ret `reasons`; girdi gönderici/alıcı il-ilçe, `cargoType`, `paymentMethod`, `cod`, `extraServices`, `brandId`, `handlerCodes`, `includeUnavailable` |
| Fiyat | `GET /v2/tariffs` | Taşıyıcı başına tam tarife; `ETag`/`If-None-Match` (`304`) |
| Sipariş | `POST /v2/order` | Taslak sipariş (`NEW`) |
| Sipariş | `POST /v2/order/barcode` | Sipariş + barkod tek çağrıda; `handlerCode` zorunlu |
| Sipariş | `POST /v2/order/{id}/barcode` | Taslağa barkod; `handlerCode` zorunlu; durum `READY_TO_SHIP` |
| Sipariş | `GET /v2/order/{id}/fee` | Açık siparişin taşıyıcı fiyatları (ucuzdan pahalıya) |
| Sipariş | `PUT /v2/order` | Yalnızca `NEW` siparişi günceller (`id`, `content`) |
| Sipariş | `GET /v2/order/{id}`, `GET /v2/order/barcode/{barcode}`, `GET /v2/order/handler-shipment-code/{code}` | Okuma |
| Sipariş | `POST /v2/order/filter` | Liste; sayfa en çok 100; toplam `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size` başlıklarında |
| İptal | `DELETE /order/barcode/{barcode}` | Barkodu iptal eder, sipariş taslağa döner, ücret iade edilir; önce taşıyıcıdaki durum kontrol edilir; teslim edilmiş iptal edilemez |
| İptal | `DELETE /order/{id}` | Yalnızca taslak (`NEW`) silinir |
| İade | `GET /v2/order/return/barcode/{barcode}` | Teslim edilmiş gönderiye iade kodu |
| Etiket | `GET /label/svg/{id}` | **Yalnızca SVG** belgelenmiş |
| Konum | `GET /country/TR/cities`, `GET /city/{id}/towns`, `GET /city/{cityName}/town/{townName}/neigborhoods` | Yol belgede bu yazımla (`neigborhoods`) |
| Konum | `POST /address/validate` | İl, ilçe, adres (11–200 karakter) denetimi; geçersizde de `200`, `valid`, `message` ve resmî adlar |
| Hesap | `GET /firm/balance` | Bakiye, çıplak sayı (para birimi yazmıyor; teklifler TRY) |
| Hesap | `GET /firm/status` | Hesap tipi, onay durumu, belge eksikleri |
| Hesap | `GET/POST /firm/address` | Gönderici adresleri (hesap başına en çok 100) |
| Hesap | `GET/POST /firm/brand` | Markalar (yenisi onay bekler) |

### Gönderi isteği (`POST /v2/order`, belgedeki örnekten)

- `type`: `OUTGOING` (varsayılan) ya da `INCOMING`.
- `content`: `name`, `code` (sipariş numarası), `items[]` (`name`, `code`, `quantity`), `packages[]` (`height`, `width`, `depth` cm, `weight` kg).
- `client`: `name`, `phone` (rakam dışı atılınca 10 hane), `email` (isteğe bağlı), `city`, `town`, `address`. Mahalle alanı yok (**doğrulanmadı**: adreste mi gitmeli).
- `collect` (kapıda tahsil tutarı, TL ondalık), `collectOnDeliveryType` (`CASH` | `CREDIT_CARD`).
- `orderTotal`, `orderPaymentType` (`COLLECT_ON_DELIVERY` | `BANK_TRANSFER` | `CREDIT_CARD` | `OTHER`). `COLLECT_ON_DELIVERY` `collect`'siz gelirse tutar `orderTotal` sayılır. `orderPaymentStatus` (`PAID` | `PENDING` | `UNPAID`) yalnızca ön ödemeli türlerde saklanır.
- `addressId` (gönderici adresi; verilmezse **doğrulanmadı**: hesabın varsayılanı mı), `brandId` (verilmezse varsayılan profil).
- Not, fatura numarası, ek hizmet alanları gönderi isteğinde belgelenmemiş.

Barkodlu yanıt (`POST /v2/order/{id}/barcode` örneği): `id`, `barcode`, `status: READY_TO_SHIP`, `shipmentInfo.handler { name, code }`, `shipmentInfo.handlerShipmentCode` (taşıyıcı takip kodu; bazı taşıyıcılarda alımdan sonra dolar, önce `null`), `priceInfo` (`paymentMethod`, `shipmentFee`, `extraFee`, `returnFee`, `extraServicesFee`, `totalCost`; `totalCost` kapıda ödeme ücretini içermez), `codInfo` (`collectOnDelivery`, `type`, `amount`, `collectionStatus`, `collectionStatusText`, `releaseDate`). `POST /v2/order/barcode`'un yanıt örneği belgede yok (**doğrulanmadı**: aynısı varsayılır).

### Durumlar

- Gönderi: `NEW`, `READY_TO_SHIP`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `NEEDS_SUPPORT`, `DELAYED`, `RETURNING`, `RETURNED`, `LOST`.
- Kapıda ödeme tahsilatı (`codInfo.collectionStatus`): `TO_BE_COLLECTED`, `COLLECTION_PENDING`, `COLLECTED`, `TRANSFERRED`, `COLLECTED_DIRECT`, `NOT_COLLECTED`; `releaseDate` paranın bakiyeye geçeceği gün.

### Web kancası

- BasitKargo panelinde Ayarlar → Webhook'tan adres ve olay türü seçilir (API'den kurulamıyor; **doğrulanmadı**).
- İki olay: "Durum Değişikliği" (ana durum değişince; gövde `id`, `orderNumber`, `orderId`, `barcode`, `status`, `handler`, `handlerShipmentCode`) ve "Kargo Hareketi" (her aktarmada; gövdede siparişin tamamı, alıcı dahil, `traces[]` `status`, `time`, `location`). `null` alanlar gönderilmez.
- **İmza, gizli anahtar, IP listesi ve yeniden deneme belgelenmemiş** (doğrulanmadı).

### Desi

- Desi/kg yukarı yuvarlanır (2,5 → 3). Taşıyıcı başına `minDesiKg`/`maxDesiKg`; tarifenin üstünde ek desi kuralı.
- Ölçülerden desi formülü belgede yok (**doğrulanmadı**; bizdeki gibi hacim/3000 varsayılır).
- Beyan edilen ile ölçülen desi farkı sonradan `extraFee` olarak kesilebilir.

## Kimlik bilgileri ve panel bağlantı akışı

Her mağaza **kendi BasitKargo hesabıyla** bağlanır (ADR-0027; bakiye, sözleşme ve tahsilat mağazanındır). Platform hesabı yok.

`integration-credentials` (`apps/backend/src/modules/integration-credentials/providers.ts`) içine yeni sağlayıcı:

| Alan | Tür | Not |
|---|---|---|
| `api_token` | gizli | BasitKargo panelindeki API jetonu; Geliver'deki gibi uzunluk denetimi (16–2048 yazdırılabilir ASCII; gerçek jeton biçimi **doğrulanmadı**) |
| `address_id` | ayar | Gönderici adresi; bağlantıdan sonra `GET /firm/address` listesinden seçilir. Boşsa hesabın varsayılanı (doğrulanmadı) |
| `brand_id` | ayar, isteğe bağlı | `GET /firm/brand` listesinden |
| `handler` | ayar | Varsayılan taşıyıcı kodu (`ECONOMIC`, `FAST`, `ARAS`, `SELF_SURAT` …); seçenek kendi kodunu taşıyorsa o geçerli |

- `identity`: boş (tek jeton). `test_mode` yok: deneme ortamı belgelenmemiş. BasitKargo bir deneme ortamı verirse `test_mode` kimlik alanı olur (iyzico'daki gibi; değişince jeton yeniden istenir).
- **Bağlantı testi** (kaydetmeden önce, ADR-0027 §4): `GET /firm/status`. `200` ve onaylı hesap: doğrulandı. `401`/`403`: `secret_invalid` (kod **doğrulanmadı**). Onaysız hesap ya da belge eksiği: kaydedilir, panelde uyarı ("engel değil uyarı"). Ulaşılamazsa ADR-0027 §4 kuralı (ilk bağlantı "doğrulanamadı", çalışan hesap korunur). Kontrol `provider_check` hız profilinde, 8 saniyede kesilir.
- **Sağlık kontrolü** (`apps/backend/src/lib/integrations/health/basitkargo-check.ts`, diğerleri gibi): `GET /firm/status`; panelde bakiye (`GET /firm/balance`) gösterilebilir: mağazanın işi, "panel mağaza içindir" kuralına uyar.
- **Panel:** Ayarlar > Kargo > BasitKargo (`apps/panel/src/features/settings/`; `shipping-carriers.ts`, `pages/shipping-carrier-page.tsx`, Yurtiçi'nin `yurtici-settings.tsx` kalıbı). Alanlar: jeton (yalnızca yazılır), gönderici adresi ve varsayılan taşıyıcı açılır listesi, BasitKargo panelinde yapılacaklar (web kancası adresi, bakiye). Bağlama, değiştirme ve kaldırma yalnızca sahip ve yeniden doğrulamayla (adr/0040).
- **Adres kodda:** `https://basitkargo.com/api`. `BASITKARGO_BASE_URL` yalnızca geliştirme ve testte sahte sunucu için; staging ve canlıda tanımlıysa açılış reddedilir (`apps/backend/src/lib/env.ts`, `lib/fake-providers.ts` kalıbı).

## Medusa ve bizim soyutlamamız → BasitKargo

Medusa v2.21 `AbstractFulfillmentProviderService` (Context7, 2026-11-16; kod tabanındaki Aras/Geliver sağlayıcılarıyla aynı imzalar).

| Bizim işlem | BasitKargo | Not |
|---|---|---|
| `getFulfillmentOptions` | — | Statik: `basitkargo-quote` (canlı teklif; seçeneğin `handler`'ı ya da `ECONOMIC`/`FAST`), `basitkargo-table` (mağazanın desi tablosu), `basitkargo-flat` (sabit fiyat; Medusa'nın düz fiyatı) |
| `validateOption` / `validateFulfillmentData` | — | Seçenek kimliği ve taşıyıcı kodu kayıtlı seçenekten okunur, istekten değil (Geliver'deki gibi) |
| `canCalculate` / `calculatePrice` | `POST /v2/quotes` (il-ilçe + koli) ya da `POST /handlers/fee/packages` | KDV dahil (`is_calculated_price_tax_inclusive: true`). Fiyat kilitlenmez, barkodda yeniden hesaplanır: sepetteki fiyat ile kesilen ücret farklı olabilir (mağazanın zararı; kısa önbellek, 5–15 dk). Tablo seçeneği `lib/shipping/rates.ts` |
| `createFulfillment` | `POST /v2/order` (anahtar A) → `POST /v2/order/{id}/barcode` (anahtar B) → `GET /label/svg/{id}` | Ayrıntı ve telafi aşağıda. `data`: `shipment_id` (BasitKargo `id`), `barcode`, `handler_code`, `cash_on_delivery`, etiket |
| `cancelFulfillment` | `DELETE /order/barcode/{barcode}` ardından `DELETE /order/{id}` | Ücret bakiyeye iade; teslim edilmişte hata (Yurtiçi'deki `status_dlv` gibi) |
| `createReturnFulfillment` | — | Medusa'nın iade gönderimi kullanılmıyor; iade kodu bizim iade onayı akışında (aşağıda) |
| `getFulfillmentDocuments` vb. | — | Kullanılmıyor: etiket `workflows/shipping/steps/store-label.ts` ile özel depoya yazılır |
| Taşıyıcı okuma (`workflows/shipping/carrier-status.ts` `READERS`) | `GET /v2/order/{id}` | Durum eşlemesi aşağıda |
| Taşıyıcı adı (`lib/shipping/carriers.ts` `carrierNameOf`) | `shipmentInfo.handler.name` | Geliver'in `provider_code` eşlemesi gibi; `SELF_` önekli kod da adlandırılır |
| İade kodu (`workflows/returns/approve-return.ts`) | `GET /v2/order/return/barcode/{barcode}` | Bugün yalnız Geliver açıyor (`handover.ts` `carrierReader("geliver")` sabit). Genelleştirme ayrı dilim |
| Web kancası | `POST /hooks/basitkargo` | Yalnızca ipucu; aşağıda |

**Eksik kalanlar:** PDF/ZPL etiket (yalnızca SVG), deneme ortamı, web kancası imzası, standart hata kodları, takip sayfası bağlantısı (yanıtta takip adresi alanı yok; `handlerShipmentCode`'dan taşıyıcının kendi sayfası kurulur: vitrinde `apps/storefront/src/lib/views/carrier-pages.ts` var), toplu barkod ucu (toplu kargoya verme bizde tek tek çağrı; 600/dk sınırı yeter).

### Etiket

- BasitKargo yalnızca SVG veriyor. Bizim etiket hattı PDF bekliyor: Aras ve Geliver PDF'i ve Yurtiçi'nin bizim çizdiğimiz PDF'i toplu yazdırmada `pdf-lib` ile tek dosyada birleşiyor (`lib/shipping/label-sheet.ts`, ADR-0035 uygulama notu).
- `pdf-lib` rastgele SVG çizemez (yalnızca yol). Seçenekler:
  1. BasitKargo'dan PDF ya da ZPL istemek (destek sorusu; belgede yok).
  2. SVG'yi sunucuda PDF'e çevirmek: yeni bağımlılık (ör. `resvg` ile yüksek çözünürlüklü PNG → `pdf-lib`'e gömme). Yeni paket sahip onayı ister (`pnpm-lock.yaml` kuralı); SVG dış kaynak çağırmamalı (SVG içindeki `href` ve yazı tipleri temizlenir, SSRF ve XXE yok).
  3. Yurtiçi gibi kendi etiketimizi çizmek: **önerilmez**, çünkü BasitKargo arkasındaki her taşıyıcının şube okutması kendi barkod biçimini bekler (doğrulanmadı).
- Öneri: önce 1'i sor; cevap olumsuzsa 2, ADR-0035'e ek olarak.
- SVG kişisel veri içerir (alıcı adı, adres): özel depoda, kısa ömürlü bağlantıyla (mevcut kural).

### Durum eşlemesi (`SHIPMENT_STATUSES`, `modules/shipment-tracking/states.ts`)

| BasitKargo | Bizde | Not |
|---|---|---|
| `NEW`, `READY_TO_SHIP` | `created` | |
| `SHIPPED` | `picked_up`, sonraki okumalarda `in_transit` | `traces` ilk hareketse alındı |
| `DELAYED`, `NEEDS_SUPPORT` | `in_transit` (durum metni `provider_status`'ta) | Personel uyarısı ayrı karar |
| `OUT_FOR_DELIVERY` | `out_for_delivery` | |
| `DELIVERED` | `delivered` | |
| `RETURNING` | `in_transit` + iade işareti | `returned` son durum olduğu için dönüş yolunda işaretlenmez (Yurtiçi'deki tartışma, ADR-0035 ek) |
| `RETURNED` | `returned` | |
| `LOST` | `failed` | |

Durum yalnızca `status` alanından okunur; serbest metin (alıcı adı, adres, `traces[].location`) asla duruma çevrilmez (ADR-0035 K11d dersi).

## Veri eşlemesi

- **Alıcı:** `lib/shipping/fill.ts` boşlukları doldurduktan sonra (`shipInput.receiver`):
  - `client.name`: ad + soyad (şirket varsa şirket adı ayrı satır değil; **doğrulanmadı** nasıl basılacağı).
  - `client.phone`: Yurtiçi'deki gibi 10 hane (`+90`, `0090`, baştaki 0 atılır).
  - `client.city` = il (`province`), `client.town` = ilçe (`city`; ADR-0008 alan eşlemesi). Adlar `tr-address` verisinden resmî yazımla; gerekirse `POST /address/validate` ile kargoya vermeden önce denetlenir ve resmî ad alınır (workflow'da, sağlayıcıda değil: `apps/backend/CLAUDE.md`).
  - `client.address`: mahalle + `address_1` + `address_2`; 11–200 karakter (BasitKargo'nun denetim kuralı). Kısa adres `shipping.address_incomplete` (alan adıyla) ile BasitKargo'ya gitmeden döner.
  - `client.email`: **gönderilmez** (isteğe bağlı; KVKK veri azaltma). BasitKargo alıcıya e-posta bildirimi gönderiyorsa ve mağaza isterse ayar olur.
- **İçerik:** `content.code` = sipariş numarası (`display_id`), `content.name` = `Sipariş <no>`; `content.items` yalnız gerekiyorsa (zorunluluğu **doğrulanmadı**): ürün adı ve SKU, kişisel veri değil.
- **Koli:** `lib/shipping/shop.ts` `packedParcelOf`: cm ve kg; ölçüsüz ürün mağazanın varsayılan paketiyle (ADR-0054). Desiyi BasitKargo yukarı yuvarlar; ölçülen farkı `extraFee` olarak keser (panelde gönderinin ücret satırında görünebilir).
- **Kapıda ödeme:** `shipInput.cash_on_delivery` kuruş → `collect` lira (iki ondalık, nokta); `collectOnDeliveryType: CASH` (mevcut sağlayıcılar da yalnız nakit). `orderPaymentType: COLLECT_ON_DELIVERY`. Ödenmiş siparişte `orderPaymentType` ödeme türümüzden (`CREDIT_CARD`, `BANK_TRANSFER`, diğerleri `OTHER`), `orderPaymentStatus: PAID`.
- **Tutar:** `orderTotal` siparişin genel toplamı (lira). Tutarlar sunucuda; istemciden gelmez. Dönüşüm yalnız sağlayıcı sınırında (`lib/money`).
- **Ödeme yöntemi (kargo ücreti):** her zaman `ADVANCE` (bakiye). Alıcı ödemeli gönderi desteklenmez (Yurtiçi'deki gibi).

## Gönderi açma, hata ve telafi

Barkod parayı bakiyeden düşürür; bu yüzden iki adım:

1. `POST /v2/order`, `Idempotency-Key: <gönderi kodu>-o`. Taslak, ücretsiz. Sonuç bilinmezse aynı anahtarla tekrar: `200` + `Idempotency-Replayed` ilk sonucu verir; `409` hâlâ işleniyor (kısa bekle, tekrar).
2. `POST /v2/order/{id}/barcode`, `Idempotency-Key: <gönderi kodu>-b`, `handlerCode`, 90 sn zaman aşımı. Sonuç bilinmezse aynı anahtarla tekrar sorulur; **ikinci barkod üretilmez**. Bu, Aras ve Yurtiçi'deki `outcome_unknown` sorununu sağlayıcı tarafında çözer.
3. `GET /label/svg/{id}` (+ çeviri). Etiket alınamazsa:
   - barkod iptal (`DELETE /order/barcode/{barcode}`, ücret iade), sonra taslak silinir (`DELETE /order/{id}`), hata yükselir (Aras'taki "etiketsiz gönderi bırakılmaz" kuralı).

**Telafi tablosu:**

| Düşen adım | Telafi |
|---|---|
| Taslak açıldı, barkod reddedildi (bakiye yetersiz, taşıyıcı uygun değil) | `DELETE /order/{id}`; hata mağazaya açık mesajla (`basitkargo.balance_insufficient` gibi, metin eşlemesi gerçek yanıtla **doğrulanacak**) |
| Barkod üretildi, etiket alınamadı | Barkod iptal + taslak sil |
| Sağlayıcı döndü, Medusa gönderimi ya da takip kaydı yazılamadı (workflow'un sonraki adımı) | Medusa'nın `createFulfillment` adımının telafisi `cancelFulfillment`'ı çağırır → barkod iptal + taslak sil. İptal de düşerse log (yalnız kimlikler: BasitKargo `id`, sipariş no) ve personel uyarısı; ücret BasitKargo panelinden iade istenir |
| İptal edilecek gönderi teslim edilmiş | Hata (`status_dlv` karşılığı), gönderim kalır |

Yeniden deneme: okumalar (`GET`) `lib/clients` kuralıyla artan aralıkla; yazmalar yalnız aynı `Idempotency-Key` ile. `429`'da `Retry-After` beklenir. 5xx'te yazma "sonucu bilinmez" sayılır ve aynı anahtarla sorulur.

## Web kancası güvenliği

- Uç: `POST /hooks/basitkargo` (`apps/backend/src/api/hooks/basitkargo/route.ts`), `webhook` hız profili (`apps/backend/src/api/http/shipping-routes.ts`, IP başına dakikada 600).
- **İmza yok** (belgelenmemiş): Geliver kalıbı uygulanır (`workflows/shipping/geliver-notification.ts`). Gövdeden yalnız `id` (ve `barcode`) okunur; durum gövdeden alınmaz, gönderi `GET /v2/order/{id}` ile yeniden okunur. Bizim takip etmediğimiz, bitmiş ya da son bir dakikada okunmuş gönderi için hiçbir şey yapılmaz. Gövde loglanmaz ("Kargo Hareketi" alıcı bilgisi taşır).
- Ek savunma (isteğe bağlı, ucuz): mağazaya özel tahmin edilemez yol parçası (`/hooks/basitkargo/<rastgele>`; panelde gösterilir, BasitKargo paneline yapıştırılır). İmza yerine geçmez, ipucu modeli zaten zararsız.
- Yanıt hızlı: işlenemeyen bildirime 503 (yeniden deneme olursa gelsin), sorgu işi zaten okur.

## Hız sınırı

- BasitKargo: jeton başına 600/dk. Bizim kullanımımız: sepette fiyat sorgusu (önbellekli), kargoya vermede gönderi başına 3–4 çağrı, takip işi gönderi başına en çok dakikada bir.
- Sepet fiyatı mağaza başına Redis sayacıyla 300/dk ile sınırlanır; aşımda tablo fiyatına düşmez, `shipping.no_offer` döner (fiyat uydurulmaz).

## Sahte sunucu (`packages/testing/src/basitkargo`, `pnpm dev:basitkargo`)

"Sahteler canlı gibi görünmeli": hiçbir yanıtta, etikette ya da takip sayfasında "sahte/demo/test" yazmaz.

- Yollar ve gövdeler belgedeki gibi: `/api/handlers`, `/api/v2/quotes`, `/api/handlers/fee/packages`, `/api/v2/order`, `/api/v2/order/{id}/barcode`, `/api/v2/order/{id}`, `/api/order/barcode/{barcode}` (DELETE), `/api/order/{id}` (DELETE), `/api/v2/order/return/barcode/{barcode}`, `/api/label/svg/{id}`, `/api/firm/status`, `/api/firm/balance`, `/api/firm/address`.
- Gerçekçi değerler: sipariş kimliği `888-6AR-OUP` biçiminde, 10 haneli sayısal barkod, gerçek taşıyıcı adları ve kodları, Türkiye fiyatlarına benzeyen tarife (desi bantları, il içi fiyat).
- `Idempotency-Key` davranışı (tekrar, `409`, `422`), `429` + `Retry-After`, bakiye (yetersizde barkod reddi), bilinen Türkçe doğrulama mesajları.
- Durum her okumada ilerler (Geliver sahtesi gibi); `traces[]` gerçekçi şube adlarıyla.
- Web kancası gönderici: durum ilerleyince yapılandırılmış adrese "Durum Değişikliği" gövdesini yollar.
- SVG etiket: barkod (Code128), alıcı, gönderici, desi; taşıyıcı adı.
- Takip sayfası `/takip/<no>` (`packages/testing/src/carrier/page.ts` ortak sayfası).
- Hata senaryoları özel değerlerle (ör. belirli bir alıcı adı zaman aşımı üretir), Yurtiçi sahtesindeki gibi kurallar tek dosyada (`rules.ts`).

## Test planı

- **Birim** (`lib/shipping/basitkargo/__tests__`): eşleme (alıcı, telefon, il/ilçe, adres uzunluğu, kapıda ödeme kuruş → lira, ödeme türü), durum eşlemesi (her durum; serbest metnin durum sayılmaması), istemci (Bearer başlığı, `Idempotency-Key` tekrarı, `409` bekleme, `422` hatası, `429` + `Retry-After`, 5xx'te yazmanın tekrarlanmaması, jeton ve alıcı verisinin loglarda maskelenmesi), etiket çevirisi (SVG'de dış kaynak reddi).
- **HTTP** (`integration-tests/http/basitkargo-shipping.spec.ts`, sahte sunucuyla): hesap bağlama ve reddi; sepette teklif fiyatı ve tablo fiyatı; kargoya verme → etiket → takip ilerlemesi → teslim; etiket alınamazsa barkod iptali ve taslağın silinmesi; yanıtı kaybolan barkodda tek barkod; iptal; teslim edilmişte iptal hatası; kapıda ödemeli gönderi; web kancası (takip edilmeyen gönderi, sık bildirim, bitmiş gönderi).
- **Sözleşme:** `integration-tests/http/carrier-contract.spec.ts` paketine dördüncü sağlayıcı (bugün Geliver, Aras, Yurtiçi aynı 4 sözleşmeyi geçiyor; F7 KK7).
- **Panel:** bağlantı formu (`*-settings.spec.tsx` kalıbı), taşıyıcı listesi.
- Gerçek hesapla (canlıya çıkışta): taslak aç + sil (ücretsiz); bir gerçek barkod + iptal (ücret iadesi görülür).

## KVKK

BasitKargo'ya giden kişisel veri: alıcının adı soyadı, telefonu, teslimat adresi (il, ilçe, açık adres); sipariş numarası; kapıda tahsil tutarı. E-posta gönderilmez. Etiket SVG'si aynı verileri taşır (özel depoda).

`docs/kvkk-envanter.md`'ye eklenecek satır (kargo aktarımları bölümüne):

| Alıcı | Aktarılan veri | Amaç | Hukuki sebep | Yer | Not |
|---|---|---|---|---|---|
| BasitKargo (aracı kargo) ve seçilen taşıyıcı | Alıcı adı soyadı, telefon, teslimat adresi; sipariş no; kapıda tahsil tutarı | Teslimat, kapıda tahsilat, iade | Sözleşmenin ifası (KVKK md. 5/2-c) | Yurt içi (doğrulanmadı: BasitKargo'nun barındırma yeri) | Mağaza BasitKargo'yu bağladıysa; e-posta gitmez. KVKK silme akışında bizdeki kargo kaydı ve etiket temizlenir, BasitKargo'daki kopya mağazanın talebiyle silinir |

Aydınlatma metni ve mesafeli satış ön bilgilendirmesindeki taşıyıcı listesi (`lib/legal/starters/*`) BasitKargo'yu "anlaşmalı kargo aracısı" olarak anar (avukat onayı açık, docs/12).

## Kod dışı gereksinimler (sahibin yapacakları)

- Mağaza adına BasitKargo hesabı açmak (ücretsiz), hesap onayı ve belgeleri (`GET /firm/status` belge eksiklerini gösterir).
- BasitKargo panelinde: gönderici adresi, isteğe bağlı marka, API jetonu üretmek, Ayarlar → Webhook'a bizim adresimizi yazmak, bakiye yüklemek. Kendi sözleşmesi varsa (`SELF_`) sözleşmeyi eklemek.
- Jetonu **yalnızca panelimizden** girmek; belgeye, sohbete, koda yazmamak.
- BasitKargo desteğine sorular (aşağıda). Kullanım koşulları ve üyelik sözleşmesi sitede bulunamadı (2026-11-16); çok müşterili kullanımı kısıtlayan madde olup olmadığı okunmalı.

## Açık sorular

1. Deneme (sandbox) ortamı ya da test jetonu var mı? Yoksa barkod üretmeden uçtan uca nasıl denenir? (Öneri: taslak + sil ile bağlantı; ilk gerçek barkodu iptal ederek.)
2. Etiket PDF ya da ZPL olarak alınabiliyor mu? SVG ölçüsü (100×150 mm mi)?
3. Web kancası imzalı mı, sabit IP'lerden mi geliyor, yeniden deneme var mı? API'den kurulabiliyor mu?
4. Standart hata gövdesi ve kodları (yetersiz bakiye, geçersiz jeton, taşıyıcı uygun değil).
5. `POST /v2/order/barcode` yanıt gövdesi; `addressId` verilmezse hangi gönderici kullanılıyor; `client`'ta mahalle alanı var mı; `content.items` zorunlu mu.
6. Takip sayfası bağlantısı yanıtta var mı?
7. Çok müşterili kullanım: platform olarak birçok mağazanın kendi hesabıyla bağlanmasına engel bir koşul var mı? Platform için "partner/alt hesap" modeli var mı?
8. Kapıda ödeme tahsilatlarının bakiyeye geçiş günü (`releaseDate`) ve mutabakat ucu.
9. Desi formülü (hacim/3000 mü) ve `extraFee`'nin bildirimi.
