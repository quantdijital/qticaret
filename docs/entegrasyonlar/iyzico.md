# iyzico Payment Provider

> F5.11: PayTR'den sonra, aynı ortak altyapının üzerine kurulur (adr/0026). Başvuru sürüyor; canlıya alınması sonra.
> Aşağıdakiler docs.iyzico.com ve resmi `iyzipay` SDK'sından 2026-10-27'de doğrulandı; iyzico görevinin başında yeniden kontrol edilir.
> "Doğrulanamadı" işaretli maddeler sandbox'ta kontrol edilir.

## Akış (Checkout Form)
```
Storefront: POST /store/carts/:id/payment-session (kendi ucumuz, adr/0026)
  → initiatePayment: CF initialize (sepet ve alıcı sunucudan) → { token, paymentPageUrl } oturuma
Storefront: kullanıcıyı ödeme sayfasına yönlendirir / iframe'de açar
iyzico → callbackUrl (POST /hooks/iyzico/callback, gövde: token)
  → token ile CF retrieve → yanıt imzası → paymentStatus + fraudStatus → oturum eşlemesi (conversationId)
  → tutar eşlemesi → cart complete workflow → dönüş adresine yönlendirme (storefront origin allowlist'i)
```

## Medusa metot eşlemesi
| Medusa | iyzico | Not |
|---|---|---|
| initiatePayment | CF Initialize | conversationId = oturum kimliği |
| authorizePayment | CF Retrieve | SUCCESS + fraudStatus 1 → captured; itemTransactions saklanır |
| capturePayment | — | iyzico anında çeker |
| refundPayment | Refund v1 | Kalem bazlı `paymentTransactionId`; tutar dağıtımı sağlayıcıda |
| cancelPayment | Cancel | Yalnızca aynı gün ve tam tutar; sonrası iade |
| getPaymentStatus / retrievePayment | Payment detail | |
| Webhook | Kendi ucumuz (adr/0026) | V3 imzası |

## Doğrulanan bilgiler (2026-10-27)
- **İmza (IYZWSv2):** `HMAC-SHA256(key = secretKey, randomKey + uri.path + body)` hex; başlık `Authorization: IYZWSv2 base64("apiKey:"+apiKey+"&randomKey:"+randomKey+"&signature:"+imza)` ve `x-iyzi-rnd: randomKey`. Sandbox `https://sandbox-api.iyzipay.com`, canlı `https://api.iyzipay.com`. Sandbox'ta denendi (2026-10-27): `body` gönderilen JSON metninin kendisi; taksit sorgusu `success`.
- **CF initialize:**
  - Zorunlu: `price`, `paidPrice`, `currency`, `callbackUrl` (geçerli SSL), `buyer` (`identityNumber` dahil), `billingAddress`, `basketItems`. Fiziksel kalem varsa `shippingAddress` de zorunlu.
  - Kalemlerin toplamı tam olarak `price` olmalı (hata 5062).
  - 0 ve altı fiyatlı kalem reddedilir (5050): bedava satırlar birleştirilir.
  - İndirim alanı yok: `price` kalemlerin toplamı, `paidPrice` son tutar. Kargo ayrı kalem (satır bazlı iade için).
  - `identityNumber` zorunlu, 5–50 karakter. SSS "dummy değer gönderebilirsiniz" diyor; `11111111111`'in kendisi doğrulanamadı.
  - Tutar biçimi: örnekler `"1.0"`, SDK `.0` ekliyor. `"10.50"` kabulü doğrulanamadı.
  - Token ömrü: örnekte `tokenExpireTime: 1800` (birim yazmıyor).
- **Callback:** iyzico `token`'ı POST'lar. Callback'in kendisinde imza: doğrulanamadı. Sonuç her zaman CF retrieve ile alınır.
- **Yanıt imzası (doğrulanmalı):** `HMAC-SHA256(secretKey, değerler ":" ile)` hex. Fiyatlarda sondaki sıfırlar atılır.
  - CF initialize: `conversationId:token`.
  - CF retrieve: `paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`.
  - Refund: `paymentId:price:currency:conversationId`.
  - Detail: `paymentId:currency:basketId:conversationId:paidPrice:price`.
- **fraudStatus:**
  - 1 onaylı: yalnızca bu durumda kargo.
  - 0 incelemede: ödeme bekletilir ve sorgulanır.
  - -1 red.
  - İnceleme sonucu ayrı bir JSON bildirimiyle gelir (`paymentId`, `fraudStatus: 2|-1`; imza belgelenmemiş). -1 durumunda iyzico iade eder.
- **Webhook:**
  - Panelden ayarlanır (Ayarlar > Firma Ayarları > İşyeri Bildirimleri, yalnızca HTTPS).
  - Başlık `X-IYZ-SIGNATURE-V3` = `HMAC-SHA256(secretKey, secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status)` hex (CF için).
  - **V3 imzası iyzico'ya e-postayla açtırılır** (entegrasyon@iyzico.com; docs/12).
  - Bildirim ödemeden 10–15 sn sonra gelir. Herhangi bir 2xx yanıt yeterli.
  - Yeniden deneme aralığı dokümanda çelişkili.
- **İade:**
  - v1: `POST /payment/refund` {`paymentTransactionId`, `price`}; satırın kalanını aşamaz.
  - v2 (`paymentId` ile) çok ürünlü sepette önerilmiyor; v1 kullanılır.
  - 365 gün içinde, kısmi ve tekrarlı iade yapılabilir.
  - Hatalar: 10223 aynı gün iade (gün sonu bekleniyor), 10245 satırın kalanını aşıyor, 10237 bu banka kartında iade yok.
- **İptal:** `POST /payment/cancel` {`paymentId`}; yalnızca aynı gün ve tam tutar.
- **İdempotency yok:** "servislerin çoğu idempotent değil". Sonuç belirsizse yeniden denemeden önce detail ya da CF retrieve sorgulanır.
- **Taksit:** `POST /payment/iyzipos/installment` {`price`, isteğe bağlı 8 haneli `binNumber`}. BIN'siz çağrı tüm seçenekleri döner (ürün sayfası tablosu; sandbox'ta 100 TL için 6 kart ailesi, 2026-10-27). CF taksitleri kendisi gösterir (`enabledInstallments`).
- **Kayıtlı kart:**
  - Satıcı tarafı kart saklama (`/cardstorage/card`) kart numarasını bize getirir: kapsam dışı (adr/0026).
  - CF'de kaydedilen kart müşterinin kendi iyzico cüzdanına gider; satıcıya `cardUserKey` gelmez.
- **Hata modeli:** `status: "failure"`, `errorCode`, `errorMessage`, `errorGroup`. Hata tablosunda kod başına "Retry" sütunu var.
- **Sandbox'ta ölçüldü (2026-10-27, F5 V8):**
  - Hatalar HTTP 200 ile döner; karar `status` alanından verilir.
  - `1000` "Geçersiz imza": API anahtarı tanınıyor, gizli anahtar tutmuyor.
  - `1001` "api bilgileri bulunamadı": API anahtarı bu adreste yok. Sandbox anahtarı canlı adrese gönderilince de `1001`.
  - `5004`: zorunlu alan eksik (ör. `price`).
  - Sandbox API ve gizli anahtarı `sandbox-` ile başlıyor (dokümanda yazmıyor; panel yalnızca "sandbox kapalıyken sandbox anahtarı" durumunu reddeder).
  - Taksit sorgusunun yanıtında `signature` alanı yok.
- **Sandbox:**
  - Kayıt sayfası https://sandbox-merchant.iyzipay.com/auth/register (firma ya da sözleşme şartı belgelenmemiş). Anahtarlar Settings > Merchant Settings > API Keys altında; OTP her zaman 123456.
  - Başarılı test kartları: 5528790000000008, 5890040000000016 (banka kartı).
  - Hata veren kartlar:
    - 4111111111111129 yetersiz bakiye;
    - 4131111111111117 3DS mdStatus 0;
    - 4151111111111112 3DS başlatılamadı.
  - 5406670000000009 başarılı ama iptal ve iade edilemez.
- **SDK:** `iyzipay` 2.0.71 (MIT) kullanılmaz:
  - postman-request üzerinden yaklaşık 20 bağımlılık getiriyor;
  - zaman aşımı, yeniden deneme ve yanıt imzası doğrulaması yok;
  - tipsiz.
  
  Kendi istemcimiz `lib/clients` üzerine yazılır. SDK'nın `lib/utils.js`'i ve dokümandaki örnek imza değerleri birim testinde referans alınır.

## Kritik noktalar
- Sepet ve alıcı sunucuda kurulur. Oturum verisi herkese açık sayılır; kişisel veri bırakılmaz (adr/0026).
- itemTransactions (kalem ↔ paymentTransactionId) ödeme verisinde saklanır; kısmi iadenin temeli. Her sağlayıcı çıktısı verinin tamamıdır.
- Sandbox ve canlı adresler kodda sabit; hesabın `test_mode`'u seçer. Her adresin kendi HTTP istemcisi ve devre kesicisi var. `IYZICO_BASE_URL` yalnızca yerelde sahte sunucu içindir (canlı ve staging'de açılış reddedilir).

## Hesap bilgileri
API anahtarı ve gizli anahtar panelden girilir (Ayarlar > Ödeme > iyzico, adr/0027; V8, 2026-10-27).
- Ayar yalnızca `test_mode` (panelde "Sandbox"); iki anahtar da gizli ve yalnızca yazılır. `test_mode` kimlik alanıdır: sandbox ↔ canlı geçişinde iki anahtar yeniden istenir.
- Kayıttan önce bağlantı kontrolü: 1 TL için BIN'siz taksit sorgusu (salt okunur), hesabın moduna ait adreste. `1001` → "API anahtarı tanınmadı", `1000` → "gizli anahtar kabul edilmedi"; ağ/5xx → ulaşılamadı (PayTR'deki kurallar).
- Panel bildirim adresini (`/hooks/iyzico/webhook`) ve iyzico panelindeki yerini (Ayarlar > Firma Ayarları > İşyeri Bildirimleri) gösterir; uç V9'da yazılır.
- Kullanıcının sandbox hesabı 2026-10-27'de panelden bağlandı ve doğrulandı; `.env`'deki `IYZICO_*` satırları artık kullanılmıyor.

## Testler
Sahte sunucu senaryoları: başarı, 3DS başarısız, kullanıcı iptali, fraudStatus 0 → 1 ve 0 → -1, mükerrer callback, imzası bozuk yanıt, kısmi iade (satır kalanı), aynı gün iptal, 10223, 5xx/timeout.
