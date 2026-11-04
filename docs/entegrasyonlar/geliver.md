# Geliver Fulfillment Provider

> Doküman: docs.geliver.io (JS ile çiziliyor; uçlar resmi SDK'nın kaynağından okundu: `GeliverApp/geliver-js`, 2026-10-28). Karar: ADR-0031. SDK kullanılmıyor; kendi istemcimiz `apps/backend/src/lib/shipping/geliver`.

## API (SDK kaynağından, 2026-10-28)
- Adres `https://api.geliver.io/api/v1`, `Authorization: Bearer <token>`. Token Geliver panelinde: app.geliver.io/apitokens.
- Yanıt zarfı `{ result, data, code, message }`; `result: false` ret. Liste yanıtında `limit`, `page`, `totalRows`, `totalPages` da var.
- Adresler: `GET /addresses?isRecipientAddress=false&limit=` (hesap kontrolü bunu kullanır), `POST /addresses` (SDK tipinde `name`, `email`, `address1`, `countryCode`, `cityName`, `cityCode`, `districtName`; README: telefon iki tarafta da zorunlu, `zip` yalnız göndericide zorunlu, alıcıda isteğe bağlı; il `cityCode` ya da `cityName` ile, ikisi birlikte ya da ayrı, `cityCode` eşleşmede daha güvenli; `isRecipientAddress: false`; README ve `src/requests.ts` 2026-11-05'te okundu), `DELETE /addresses/:id`.
- Gönderi: `POST /shipments` (`senderAddressID` ya da satır içi `senderAddress`; ikisi de yoksa Geliver kurumun varsayılan gönderici adresini kullanır (README), `recipientAddress` ya da `recipientAddressID`, `length`/`width`/`height`/`distanceUnit`, `weight`/`massUnit` metin olarak, `order { orderNumber, totalAmount, totalAmountCurrency }`, `providerServiceCode`, `productPaymentOnDelivery`, test için `test: true`), `GET /shipments/:id`, `PATCH /shipments/:id` (koli ölçüsü), `DELETE /shipments/:id` (iptal), `POST /shipments/:id` gövdesiz (kopya) ya da `isReturn: true` ile (iade).
- Teklifler zaman uyumsuz: `offers.percentageCompleted` 100 olana ya da `offers.cheapest` gelene kadar `GET /shipments/:id` (SDK 1 sn aralıkla, 60 sn).
- Teklif kabulü `POST /transactions { offerID }` etiketi satın alır; yanıtta `shipment` (`barcode`, `trackingNumber`, `labelURL`, `responsiveLabelURL`, `trackingUrl`). Takip numarası sonra dolabilir (SDK 3 sn aralıkla, 180 sn).
- Fiyat listesi `GET /priceList?paramType=parcel&length=&width=&height=&weight=`.
- Bildirim: `POST /webhook { url, type }`; olay `TRACK_UPDATED`, gövde `{ event, data: <gönderi> }`. **İmza yok** (SDK'nın doğrulayıcısı yazılmamış): ADR-0031'e göre bildirim yalnızca yeniden okuma ipucu.
- Gönderi durumu (`statusCode`, liste süzgecinden): `CREATED`, `GOT_OFFERS`, `OFFER_ACCEPTED`, `TRACKING_CODE_CREATED`, `LABEL_PRINTED`, `SHIPPED`, `DELIVERED`, `CANCELED`, `RETURNED`, `RETURN_SHIPPED`, `FAILED`. Takip kodları (`trackingStatus.trackingStatusCode`) SDK'da listelenmiyor; gerçek hesapla doğrulanacak.
- Kapıda ödeme: `productPaymentOnDelivery: true` ve kapıda ödeme servis kodu (örnek: `PTT_KAPIDA_ODEME`).

## Medusa metot eşlemesi
| Medusa | Geliver | Not |
|---|---|---|
| getFulfillmentOptions | — | Statik seçenekler: standart, hızlı, (tenant ayarına göre) kapıda ödeme |
| validateFulfillmentData / validateOption | — | Seçenek ve adres doğrulama |
| canCalculate / calculatePrice | Teklif alma | Desi = (en×boy×yük)/3000 vs ağırlık, büyüğü; cache'li |
| createFulfillment | Gönderi oluştur + teklif kabul | Etiket PDF → S3; tracking no fulfillment data'ya |
| cancelFulfillment | İptal | |
| createReturnFulfillment | İade gönderisi | İade kodu müşteriye bildirilir |

## Takip
- Prod: webhook (`POST /hooks/geliver`), doğrulama + idempotency.
- Test ortamında takip durumu sorgu ile ilerler; polling job'u bu davranışla test edilir.
- Takip numarası teklif kabulünde hemen oluşmayabilir; paket şubeye verildiğinde dolar → UI bunu "bekleniyor" olarak gösterir.

## Durum eşlemesi
Sağlayıcı durumları → iç enum: `created`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `returned`, `failed`.

## Hesap ve ortam
- Mağazanın Geliver hesabı panelden bağlanır (ADR-0027): Ayarlar > Kargo > Geliver; API anahtarı şifreli, test gönderileri ayarı açık.
- `GELIVER_BASE_URL` yalnızca geliştirme ve testte sahte Geliver için (`pnpm dev:geliver`); staging ve canlıda reddedilir.

## Doğrudan taşıyıcı adaptörleri (F7.14)
Geliver bir aracıdır (komisyon + tek nokta bağımlılığı). Aynı `AbstractFulfillmentProviderService` arayüzüyle doğrudan kargo firması modülleri
(`fulfillment-yurtici`, `fulfillment-aras`, `fulfillment-mng`, `fulfillment-ptt`, `fulfillment-surat`) eklenir; ilk müşterinin anlaşmalı firması F7.14'te yazılır.
- Her taşıyıcı adaptörü ortak contract test paketini (F6.4 deseni) ve durum eşleme tablosunu kullanır.
- Takip: taşıyıcı webhook'u varsa kullanılır, yoksa polling job'u (F7.6).
- Etiket PDF/ZPL üretimi taşıyıcıdan gelir; yoksa biz üretiriz (şablon).
- Tenant birden fazla taşıyıcıyı aynı anda kullanabilir; kargo kuralları (F7.8) seçimi yapar.
- Tüm etiket/irsaliye dosyaları private depolamada, presigned erişimle (kişisel veri içerir).
