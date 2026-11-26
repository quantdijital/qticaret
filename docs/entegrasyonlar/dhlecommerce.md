# DHL eCommerce Türkiye (eski MNG Kargo) Fulfillment Provider

> Durum: **kodlanıyor** (2026-11-26): istemci, ortak etiket ve sahte servis PR 1'de; sağlayıcı ve panel PR 2'de. Kullanıcıya görünen her yerde ad **"DHL eCommerce"**; "MNG Kargo" yazılmaz (sahip, 2026-11-26). İç ad `dhlecommerce`; API alan adları hâlâ `mngkargo.com.tr`.
>
> İlk durum (2026-11-26): **araştırma, kod yok**. Sahip MNG, Sürat ve PTT'yi doğrudan taşıyıcı olarak sıraya aldı (ADR-0035 Ek 2026-11-26; sıra MNG → Sürat → PTT). Bu belge kodlayıcının arama yapmadan başlaması içindir; gerçek hesapla doğrulanmamış her bilgi "doğrulanmadı" diye işaretli.
>
> Kaynaklar (hepsi 2026-11-26'da okundu):
> - MNG'nin geliştirici portalı `https://apizone.mngkargo.com.tr` (herkese açık ana sayfa: "Kargo Takip", "Gönderi Hazırla", "Barkod Oluştur" ürünleri, test portalı bağlantısı `sandbox.mngkargo.com.tr`, "hesap aç → onay → API'yi uygulamana ekle → API KEY"). Ayrıntılı belge (swagger) üyelikle açılıyor, okunmadı.
> - `tcgunel/omniship-mng` (PHP, MIT, son push 2026-07-30): README ve kaynak. Yeni REST API'yi kullanan en ayrıntılı açık kaynak; "Gotchas" bölümü gerçek hesapla yaşanmış sorunları anlatıyor.
> - `logedosoft/DHL-Cargo-ERPNext` wiki'si (son push 2026-11-25): aynı akış, ERPNext'te.
> - omniship-mng deposundaki `mng-docs.pdf`: **eski** SOAP servisinin (`service.mngkargo.com.tr/musterikargosiparis/musterisiparisnew.asmx`) belgesi; yalnız iade metotları için bakıldı.
> - Sahibin verdiği WooCommerce eklentisinde (`kargo-entegrasyon` v0.1.0) MNG **yok**.

## Amaç ve kapsam

Mağaza kendi MNG (DHL eCommerce) sözleşmesiyle gönderi açar, etiket basar, takip eder, iptal eder; kapıda ödemede tutarı MNG tahsil eder. Aras/Yurtiçi ile aynı arayüz: `mng_mng` sağlayıcısı, taşıyıcı kaydında `mng`, panelde hesap sayfası, sahte servis. Fiyat mağazanın sabit tutarı ya da desi tablosu (ADR-0035 §7); MNG'den anlık fiyat sorulmaz.

Kapsam dışı (ADR-0035 §8 ile aynı): toplu manifesto, şubeden teslim (`deliveryType` 2), alıcı ödemeli gönderi. İade gönderisi için MNG'nin API'si var (aşağıda), ama şimdilik kapsam dışı; istenirse eklenir.

## Sağlayıcı özeti

- MNG 2023'te DHL Group'a geçti, Mayıs 2025'ten beri Türkiye'de "DHL eCommerce" adını kullanıyor (omniship-mng README). Alan adları hâlâ `mngkargo.com.tr`.
- **Eski SOAP servisi** (`service.mngkargo.com.tr/...asmx`) kapatılıyor; omniship-mng v0.1.x onu kullanıyordu ve "deprecated". **Yeni entegrasyon REST/JSON** (IBM API Connect önünde). Biz yalnız REST'i kullanırız. Sonuç: SOAP istemcisine gerek yok, mevcut JSON HTTP istemcimiz (`lib/clients`) yeter.
- İki katmanlı kimlik:
  1. **Uygulama anahtarları** (`X-IBM-Client-Id`, `X-IBM-Client-Secret`): apizone'da açılan "uygulama"nın; entegre eden **platformu** tanır, mağazayı değil.
  2. **Mağaza hesabı**: MNG müşteri numarası + şifre (mağazanın MNG/DHL "Online Şube" paneline giriş bilgisi). Bunlarla JWT alınır.
- Uygulama altı (6) API ürününe ayrı ayrı abone olmalı; eksik olan `401 Unauthorized — Cannot find valid subscription` döner:

| Ürün | Kullanım |
|---|---|
| Identity 1.0.1 | JWT |
| Standard Command 1.0.0 | `createOrder`, `cancelorder`, `createReturnOrder` |
| Standard Query 1.0.0 | takip |
| Barcode Command 1.0.0 | `createbarcode`, `cancelshipment` |
| Plus Command 1.0.0 | `createRecipient` |
| CBS Info 1.0.0 | il/ilçe kodları |

- **Canlıya geçiş:** canlı portalda aynı adımlar tekrarlanır; sonra `entegrasyon@mngkargo.com.tr` adresine **uygulama adı + DHL eCommerce müşteri numarası + sabit çıkış IP'si** yazılır. Canlı abonelikler MNG tarafından **API başına elle onaylanır**; IP izin listesine alınır. Test portalında abonelik otomatik onaylı; test müşteri bilgilerini entegrasyon ekibi verir (omniship-mng, doğrulanmadı).
- **Geçici şifre tuzağı:** MNG yeni hesaba geçici şifre gönderir, çabuk süresi dolar. Mağaza panele bir kez girip kalıcı şifre koymalı; panel şifresi değişirse API şifresi de değişir (aynı bilgi).

### Açık karar: uygulama anahtarları kimin?

Bizim modelimizde her mağaza ayrı instance. İki yol:

- **(Önerilen) Platformun tek apizone uygulaması:** Quant bir kez kayıt olur, anahtarlar sunucu ortam değişkeni (`MNG_CLIENT_ID`, `MNG_CLIENT_SECRET`; `.env.example`'a). Mağaza panelden yalnız müşteri no + şifre girer. Canlı onay e-postasında her yeni mağazanın müşteri numarası ve instance'ının çıkış IP'si bildirilir.
- **Mağazanın kendi uygulaması:** dört alan da panelden (ADR-0027 kalıbı). Mağaza sahibine apizone kaydı, abonelik ve e-posta yükü düşer.

İlki ADR-0027'den sapma (sağlayıcı anahtarı ortamdan); kodlamaya başlamadan sahibe sorulur ve ADR-0035'e ek yazılır.

## API

| | Test | Canlı |
|---|---|---|
| Portal | `https://sandbox.mngkargo.com.tr` | `https://apizone.mngkargo.com.tr` |
| API kökü | `https://testapi.mngkargo.com.tr` | `https://api.mngkargo.com.tr` |
| Hesap | ayrı kayıt | ayrı kayıt |
| Abonelik onayı | otomatik | `entegrasyon@mngkargo.com.tr`, API başına elle |

Test anahtarı canlı köke (ya da tersi) giderse Identity HTTP 500 ve kod `20013` döner, mesajı anlamsız.

Her istekte başlıklar: `X-IBM-Client-Id`, `X-IBM-Client-Secret`, `Accept: application/json`; gövdeli isteklerde `Content-Type: application/json`; CBS Info dışında `Authorization: Bearer <jwt>`.

| İş | Uç | Not |
|---|---|---|
| JWT | `POST /mngapi/api/token` gövde `{customerNumber, password, identityType: 1}` → `{jwt}` | 8 saat geçerli. Önbellek: müşteri no + ortam başına, ~7 saat. Loga girmez |
| Alıcıyı önceden kaydet | `POST /mngapi/api/pluscmdapi/createRecipient` | MNG tarafında tekrar güvenli (idempotent) |
| Sipariş | `POST /mngapi/api/standardcmdapi/createOrder` | gövde `{order, orderPieceList, recipient}` |
| Barkod + etiket | `POST /mngapi/api/barcodecmdapi/createbarcode` | siparişi "faturalar", ZPL etiket döner |
| Barkod iptali | `PUT /mngapi/api/barcodecmdapi/cancelshipment` gövde `{referenceId, shipmentId}` | yalnız şube kabulünden önce, barkodun basıldığı gün |
| Sipariş iptali | `PUT /mngapi/api/standardcmdapi/cancelorder/{referenceId}` gövdesiz | barkod varsa önce barkod iptali |
| Durum | `GET /mngapi/api/standardqueryapi/getshipmentstatus/{referenceId}` (ya da `getshipmentstatusByShipmentId/{id}`) | başlık durumu |
| Hareketler | `GET /mngapi/api/standardqueryapi/trackshipment/{referenceId}` (ya da `trackshipmentByShipmentId/{id}`) | olay listesi |
| İade siparişi | `POST /mngapi/api/standardcmdapi/createReturnOrder` | `returnOrderLabelURL` döner (`https://mn.tc?rtnid=...`) |
| İl / ilçe | `GET /mngapi/api/cbsinfoapi/getcities`, `GET .../getdistricts/{cityCode}` | JWT gerekmez; durağan veri, önbelleğe |

- **Yanıtlar dizi içinde gelir:** swagger tek nesne gösteriyor ama `createOrder`, `createbarcode`, `getshipmentstatus` `[{...}]` döndürüyor. İstemci ikisini de okur.
- **Hata gövdesi:** `{error: {Code, Description, ...}}` (büyük/küçük harf karışık okunur). Bilinen kodlar: `3002` "BU SİPARİS NUMARASINA AİT KAYIT ZATEN VAR!" (aynı `referenceId` daha önce kabul edilmiş, HTTP 500), `20001` "VARIŞ ŞUBESİ BULUNAMADI" (aşağıda), `26056` alıcı vergi/TC no boş, `20013` yanlış ortam anahtarı.
- **Hız sınırı:** belgelenmemiş (doğrulanmadı). Takip işi gönderi başına dakikada en çok bir okuma kuralıyla zaten seyrek.

### Gönderi açma: üç aşama ve "VARIŞ ŞUBESİ BULUNAMADI"

MNG entegrasyon ekibi üç aşama öneriyor; omniship-mng'ye göre pratikte **zorunlu**:

1. `createRecipient`: sipariş gelir gelmez alıcı adresi önceden kaydedilir; MNG varış şubesini arka planda çözer.
2. `createOrder`: kargoya verilirken.
3. `createbarcode`: koli hazır, gerçek desi/kg biliniyor; etiket alınır.

1. aşama atlanırsa 2 ve 3 art arda çağrıldığında sık sık `20001 VARIŞ ŞUBESİ BULUNAMADI` gelir; 10–15 saniye beklemek yetmiyor, MNG'nin **dakikalar** sürebilen arka plan işine ihtiyaç var. omniship-mng `20001`'de 5 ve 10 saniye arayla iki kez yeniden deniyor.

Bizim için öneri:

- `createRecipient` sipariş verildiğinde değil, **"Kargoya ver" kuyruğa alınınca ya da sipariş hazırlanmaya geçince** (doğrulanacak: ne kadar önce yeter). Sipariş anında göndermek alıcının adresini, sipariş kargoya verilmeden ve belki iptal edilecekken MNG'ye aktarır (KVKK: veri azaltma; aydınlatma metnine etkisi). Sahibe sorulacak; en sade hali "Kargoya ver"de `createRecipient` → `createOrder` → `createbarcode`, `20001`'de birkaç dakikaya yayılan yeniden deneme ve o sürede gönderi "etiket bekleniyor" görünür.
- `createOrder` `3002` dönerse sipariş MNG'de var demektir: başarı sayılıp `createbarcode`'a geçilir (belirsiz sonuçtan sonra tekrar denemede işe yarar).
- `createOrder` yanıtı gelmezse (`outcome_unknown`) ya da barkod alınamazsa: `cancelorder/{referenceId}` ile geri çekilir (ADR-0035 belirsiz sonuç kuralı; Aras'taki `CancelDispatch` gibi).

### `createOrder` gövdesi (omniship-mng'nin gönderdiği)

`order`:

| Alan | Değer / kural | Bizde |
|---|---|---|
| `referenceId` | Müşteri başına tekil, büyük harfe çevrilir, ≤30 karakter (omniship) | `shipmentCode()` (`QT…`) |
| `barcode` | `referenceId` ile aynı | aynı |
| `billOfLandingId` | irsaliye/fatura no, boş olabilir | sipariş no ya da boş (doğrulanacak) |
| `isCOD` / `codAmount` | 0/1, tutar sayı | kapıda ödemede 1 ve TL tutar (noktalı) |
| `shipmentServiceType` | 1 = STANDART | 1 |
| `packagingType` | 3 = PAKET (1 dosya, 2 mi? doğrulanmadı) | 3 |
| `content`, `description` | serbest metin | `Sipariş <no>` |
| `smsPreference1/2/3` | alıcıya varış / hazırlandı, göndericiye teslim SMS'i | 0 (bildirimleri biz atıyoruz) |
| `paymentType` | 1 gönderici, 2 alıcı, 3 platform (yalnız `createDetailedOrder`'da geçerli) | 1 |
| `deliveryType` | 1 adrese teslim, 2 şubeden teslim | 1 |
| `marketPlaceShortCode`, `marketPlaceSaleCode` | boş | boş |

`orderPieceList[]`: `barcode` (`<referenceId>_PARCA<n>`), `desi`, `kg` (omniship **tam sayıya yuvarlıyor**; ondalık kabul ediliyor mu doğrulanmadı), `content`.

`recipient`:

| Alan | Kural | Bizde |
|---|---|---|
| `fullName` | `customerId` doluysa boş olmalı; ikisi birden gönderilmez | ad + soyad, `customerId` hiç gönderilmez |
| `cityCode`, `districtCode` | CBS Info kodları (sayı) | il/ilçeden eşlenir (aşağıda) |
| `cityName`, `districtName` | | il `province`, ilçe `city` (ADR-0008) |
| `address` | | mahalle + `address_1` |
| `mobilePhoneNumber` | **10 rakam**, başta 0 ya da 90 yok | `receiver.ts`'teki gibi |
| `email` | kavramsal olarak isteğe bağlı ama **boşsa reddediliyor** | siparişin e-postası (KVKK notu: Yurtiçi'ne göndermiyoruz; burada zorunlu) |
| `taxNumber` | 11 hane TCKN ya da 10 hane VKN; **boşsa `26056`** | aşağıda |
| `taxOffice` | bireyde `SAHIS` | `SAHIS` (kurumsal fatura adresinde vergi dairesi) |
| `refCustomerId`, `homePhoneNumber`, `bussinessPhoneNumber` | boş | boş (`bussiness` yazımı API'nin) |

- **Vergi/TC no zorunluluğu:** omniship, TC'si olmayan tüketici siparişinde sağlama toplamını geçen `11111111110`'u yer tutucu olarak öneriyor. Bunu kendi kararımızla kullanmayız: MNG'ye "bireysel alıcıda ne gönderelim" diye sorulur (Doğrulanacaklar). Fatura adresinde TCKN/VKN varsa o gönderilir (KVKK: kimlik numarası taşıyıcıya gider; aydınlatma metni).
- **İl/ilçe kodları:** CBS Info adları `"ADANA  11"` gibi plaka sonekiyle döner. İki tarafı da normalize ederek (küçük harf, Türkçe harf dönüşümü, sondaki boşluk+rakam atılır, iç boşluk tekilleşir) eşleriz. Liste durağan: süreç önbelleği (`registerProcessCache`) ya da günlük yenilenen küçük tablo. Eşleşmeyen il/ilçe gönderimden önce açık hata (`shipping.receiver_*`), MNG'ye gitmez.

### `createbarcode` gövdesi

`{referenceId, billOfLandingId, isCOD, codAmount, printReferenceBarcodeOnError: 0, message: "", additionalContent1..4: "", orderPieceList, packagingType}`.

Yanıt (dizi içinde): `shipmentId` (12 haneli sayı, MNG'nin gönderi no'su; takip no da bu), `invoiceId` (`FM378349` gibi), `barcodes[]`: her kolide **iki alan**: `value` = ZPL etiketin tamamı (`^XA...^XZ`, birkaç KB), `barcode` = okutulan barkod metni (`C@6B@H21FMLRPNAAA6J` gibi). Karıştırılmamalı.

Barcode Command ürünü hesap başına açılıyor; açık olmayan hesapta `createbarcode` başarısız olur. omniship "barkodsuz" kipte yalnız `createOrder` yapıp `referenceId` ile takip ediyor. Biz etiketi zorunlu sayıyoruz (Aras gibi): barkod alınamazsa gönderi geri çekilir, panelde açık hata.

## Medusa metot eşlemesi

| Medusa | MNG | Not |
|---|---|---|
| getFulfillmentOptions | — | `mng-flat`, `mng-table` |
| validateOption / validateFulfillmentData / canCalculate | — | Aras ile aynı kalıp |
| calculatePrice | — | `flatQuoteOf` / `tableQuoteOf` (`lib/shipping/shop`) |
| createFulfillment | (`createRecipient`) → `createOrder` → `createbarcode` | `qt_ship` işareti zorunlu (`shipInputOf`); `20001`'de yeniden deneme; başarısızlıkta `cancelorder`. `data`: `shipment_id` = `referenceId`, `mng_shipment_id`, `label_base64` (PDF, aşağıda), `label_zpl` (isteğe bağlı), `test`, `cash_on_delivery` |
| cancelFulfillment | `cancelshipment` (+ `cancelorder`) | Barkod varsa ikisi sırayla. Şube kabul ettiyse ya da gün geçtiyse reddedilir → gönderim kalır, takip sürer (Yurtiçi'nin `IND` kuralı gibi) |
| takip işi (`carrier-status.ts` `READERS.mng`) | `getshipmentstatus/{referenceId}` (+ gerekirse `trackshipment`) | Durum eşlemesi aşağıda; `trackingUrl` yanıtta |
| hesap kontrolü | `POST /mngapi/api/token` | 200 + `jwt` → geçerli; 401/403 ya da kimlik hatası → `secret_invalid`; `401 Cannot find valid subscription` → ayrı hata (uygulama aboneliği eksik, mağazanın değil); 5xx → ulaşılamadı |
| taşıyıcı kaydı | — | `carriers.ts`: `MNG_FULFILLMENT_PROVIDER_ID = "mng_mng"`, `CarrierName` += `"mng"`, `carrierNameOf` → "MNG Kargo" (vitrinde "DHL eCommerce" mi yazacağı sahibe sorulur) |
| hesap | — | `integration-credentials` sağlayıcısı `mng`: gizli `customer_number`, `password`; ayar `test_mode` (+ seçilen yola göre client id/secret) |

## Durum eşlemesi

`getshipmentstatus` yanıtında `shipmentStatusCode` (omniship-mng tablosu; MNG belgesiyle doğrulanmadı):

| Kod | MNG metni | Bizim durum |
|---|---|---|
| 1 | Gönderi Hazırlandı | `created` |
| 2 | Transfer Aşamasında | `in_transit` (ilk kez görülüyorsa koli alınmış demektir; `picked_up` atlanır, `movesOn` ileri gider) |
| 3 | Teslimat Birimine Ulaştı | `in_transit` |
| 4 | Alıcı Adresine Yönlendirildi | `out_for_delivery` |
| 5 | Teslim Edildi | `delivered` |
| 6 | Teslim Edilemedi | **`in_transit`** önerilir, `failed` değil: bizde `failed` son durum, MNG ise genelde yeniden dener (doğrulanacak) |
| 7 | Geri Geliyor | `returned` |
| 8 | Destek Gerekiyor | durum değişmez, `provider_status`'a yazılır (doğrulanacak) |

- Diğer yanıt alanları: `shipmentStatus`, `isDelivered`, `deliveryTo` (teslim alan; KVKK: saklamıyoruz), `trackingUrl`; `trackshipment` olayları `eventStatus`, `eventStatusEn`, `eventDateTime`, `location`, `locationAddress`.
- "Kabul edildi / şubeye verildi" ayrı bir kod olarak görünmüyor; `picked_up` için `trackshipment` olay metnine bakmak gerekebilir (doğrulanacak).
- İptal edilen gönderinin hangi kodla döndüğü bilinmiyor (doğrulanacak).
- `trackingUrl` yalnız https ve MNG/DHL alanındaysa alınır (Yurtiçi kuralı gibi); yoksa herkese açık takip sayfası gönderi no'dan kurulur (adres doğrulanmadı).

## Kapıda ödeme

- `order.isCOD` = 1, `order.codAmount` = tutar; aynı iki alan `createbarcode`'da da gider. Tahsil şekli (nakit/kart) alanı yok; sözleşmede belirlenir (doğrulanacak).
- Tutar biçimi JSON sayı (TL, noktalı ondalık). Kuruştan `toMedusaAmount` ile.
- Kapıda ödemenin ayrı müşteri numarası isteyip istemediği bilinmiyor (Yurtiçi'nde ayrı kullanıcı) — doğrulanacak.

## Etiket

MNG etiketi **ZPL** verir (Zebra yazıcı dili), PDF vermez. Tarayıcı ZPL'yi gösteremez; bizim toplu yazdırmamız PDF birleştiriyor (`lib/shipping/label-sheet.ts`).

Seçenekler:

1. **(Önerilen) Kendi PDF etiketimiz** (Yurtiçi'deki gibi, `pdf-lib` + `lib/shipping/code128.ts`): MNG'nin `barcode` değerini Code 128 barkod ve metin olarak, alıcı, sipariş no, desi/kg, kapıda tahsil tutarı ve `shipmentId` ile basarız. Barkod `@` gibi karakterler içeriyor; Code 128 B bunları kodlar. **MNG'nin kendi etiketi yerine bizimkini şubede kabul edip etmediği doğrulanmalı** (ZPL'deki barkod simgelemesi ve zorunlu alanlar ZPL'den okunup karşılaştırılır).
2. ZPL'yi ayrıca saklayıp panelde "Zebra için indir" sunmak (Zebra yazıcısı olan mağaza için). Kolay, ek iş küçük.
3. ZPL → PDF'i bir dış servise (Labelary) çevirtmek: omniship ve ERPNext böyle yapıyor. **Yapmayız**: alıcının adı/adresi üçüncü bir tarafa gider (KVKK) ve dış servise bağımlılık.

## İade kodu

- MNG'de **iade başına API var**: `createReturnOrder` tüketiciyi gönderici, mağazayı alıcı yapar ve tüketicinin koliyi bırakırken kullanacağı `returnOrderLabelURL` döndürür. Eski SOAP'ta karşılığı `GelecekGonderiKayit` / `GelecekIadeSiparisKontrol` / `GelecekIadeSiparisIptali`.
- ADR-0035 §8 gereği şimdilik kapsam dışı: mağaza sözleşmesindeki **sabit iade kodunu** iade sayfasında gösterir (Aras/Yurtiçi ile aynı). İade akışına (ADR-0032) bağlanması ayrı iş; bu API onu kolaylaştırır.

## Test planı

- **Sahte MNG** `packages/testing/src/mng` (Aras/Yurtiçi kalıbı: `fake-server.ts`, `rules.ts`, `shipments.ts`), `pnpm dev:mng`, `MNG_BASE_URL` (yayında reddedilir; `lib/env.ts`). Sahte şunları taklit eder:
  - IBM başlıkları eksik/yanlış → 401; abonelik eksik → `401 Cannot find valid subscription`; yanlış şifre → token reddi; JWT süresi.
  - `createOrder`: tekrar `referenceId` → HTTP 500 + `3002`; boş e-posta / boş vergi no (`26056`) / bozuk telefon reddi; yanıt dizi içinde.
  - `createbarcode`: ilk N çağrıda `20001` (yeniden deneme yolu), sonra ZPL `value` + `barcode` + `shipmentId`.
  - `cancelshipment` / `cancelorder`: kabulden sonra red.
  - `getshipmentstatus`: zamanla 1→2→4→5; `trackingUrl` sahte sayfaya (`/takip/<no>`, `fakeTrackingUrl`).
  - `getcities` / `getdistricts`: `"ADANA  11"` biçimiyle küçük liste.
- **Birim testleri:** gövde eşleme (telefon, il/ilçe normalizasyonu, `customerId`'siz alıcı, kapıda ödeme), dizi/nesne yanıt okuma, hata kodu okuma, durum eşlemesi, JWT önbelleği (müşteri no + ortam anahtarı, süre), etiket PDF'i.
- **HTTP entegrasyon testi:** "Kargoya ver" rotası sahte MNG ile; `20001` yeniden denemesi; belirsiz sonuçta `cancelorder`.
- **Ortak sözleşme test paketi** (ADR-0035 §1, F7 KK7) MNG'de de koşar.
- Güvenlik: şifre, JWT ve client secret hiçbir loga girmez (HTTP istemcisinin `secrets`'i); `trackingUrl` süzgeci; panelde maskeli.

## Doğrulanacaklar (gerçek hesapla)

- Uygulama anahtarlarının platformda mı mağazada mı duracağı (yukarıdaki açık karar) ve canlı onay e-postasının her yeni mağazada tekrarlanıp tekrarlanmadığı.
- Canlı IP izni: instance-per-tenant'ta her instance'ın sabit çıkış IP'si mi, ortak bir çıkış mı (F16 altyapısı).
- `createRecipient`'in `createOrder`'dan ne kadar önce çağrılması gerektiği; sipariş anında çağırmanın KVKK etkisi.
- Bireysel alıcıda `taxNumber` için MNG'nin kabul ettiği değer.
- `orderPieceList` `desi`/`kg` ondalık kabul ediyor mu; desi böleni (3000) sözleşmede aynı mı.
- `packagingType` değerleri (1/2/3) ve e-ticaret kolisi için doğru olanı.
- Durum kodları 1–8'in tam listesi; iptal ve "şubeye verildi" nasıl görünüyor; `6` sonrası yeniden deneme.
- Kendi PDF etiketimizin (Code 128) şubede kabulü; ZPL'deki barkod simgelemesi.
- `cancelshipment` "aynı gün, kabulden önce" kuralı ve red yanıtının biçimi.
- Kapıda ödeme: tahsil şekli, ayrı hesap gerekip gerekmediği, tutar biçimi.
- Hız sınırları; JWT süresinin gerçekten 8 saat olduğu.
- Herkese açık takip sayfasının adresi (`trackingUrl` gelmezse).
- Vitrinde marka adı: "MNG Kargo" mu "DHL eCommerce" mi.

## Mağazadan istenecekler

- [ ] MNG Kargo (DHL eCommerce) ile imzalı kurumsal kargo sözleşmesi.
- [ ] MNG **müşteri numarası** ve "Online Şube" paneli **şifresi**. Şifre, MNG'nin e-postayla gönderdiği geçici şifre değil: panele bir kez girip kendi koyduğunuz kalıcı şifre olmalı. Panel şifresini değiştirirseniz bize de bildirin.
- [ ] Sözleşmenizde **kapıda ödeme** var mı; varsa nakit mi kartlı mı, tahsil edilen paranın hangi hesaba ve kaç günde yattığı.
- [ ] MNG'den "web servis / API entegrasyonu" için **Barkod Oluşturma** yetkisinin hesabınızda açık olduğunun teyidi (yoksa etiket basılamaz).
- [ ] Bireysel müşterilerde TC kimlik numarası istenmiyorsa MNG'nin bunun yerine ne kabul ettiğini satış temsilcinize sorun.
- [ ] Desi hesabınız (genelde en × boy × yükseklik / 3000) ve sözleşmedeki desi/kg fiyat tablonuz (sitedeki kargo ücreti tablosu için).
- [ ] İade için anlaşmalı **iade kodunuz** varsa o kod.
- [ ] (Uygulama anahtarları mağazada kalırsa) apizone'da açtığınız uygulamanın **Client ID** ve **Client Secret** bilgisi; biz yönlendiririz.
