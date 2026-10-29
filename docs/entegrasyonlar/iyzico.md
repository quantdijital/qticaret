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
- **Callback:** iyzico `token`'ı alıcının tarayıcısından POST'lar; callback'in kendisi imzasız. Sonuç her zaman CF retrieve ile alınır.
- **Yanıt imzası (initialize ve retrieve sandbox'ta doğrulandı, 2026-10-27):** `HMAC-SHA256(secretKey, değerler ":" ile)` hex. Fiyatlarda sondaki sıfırlar atılır.
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

- **Sandbox'ta ölçüldü (2026-10-27, F5 V9):**
  - CF initialize `"10.5"` ve `"10.50"`'yi aynı kabul ediyor; biz iki ondalık gönderiyoruz. `paidPrice` `price`'tan küçük ya da büyük olabiliyor; biz ikisini de tutar olarak gönderiyoruz (indirim sepet satırlarında dağıtılmış).
  - `identityNumber` için `11111111111` (ve `00000000000`) kabul edildi; TCKN toplanmıyor.
  - Kalemler `price`'a eşit değilse `5062`.
  - Yanıt `tokenExpireTime: 1800` (saniye), `paymentPageUrl` `sandbox-cpp.iyzipay.com`; initialize imzası (`conversationId:token`) doğrulandı.
  - Ödenmemiş token için retrieve `5122`, bilinmeyen token `5124` (ikisi de imzasız).
  - `callbackUrl` olarak `http://localhost:9000/...` kabul edildi; callback tarayıcıdan geldiği için yerelde gerçek sandbox ödemesi çalışıyor.
  - Gerçek sandbox ödemesi (test kartı 5528790000000008, 3DS'siz) deneme sayfasından yapıldı: callback geldi, retrieve imzası (`paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`) doğrulandı, sipariş açıldı.

## Uygulama (F5 V9)
- `pp_iyzico_iyzico` (`modules/payment-iyzico`): oturum yalnızca kendi Store ucumuzdan başlar. `conversationId` = `basketId` = `buyer.id` = oturum kimliği. Oturum verisinde token, form adresi, tutar (kuruş), para birimi, test modu ve dönüş adresleri; kişisel veri yok.
- `callbackUrl` = `BACKEND_URL` + `/hooks/iyzico/callback?session=<oturum>&sig=<imza>`; imza oturumun mağazanın gizli anahtarıyla HMAC'i (yalnızca biz ve iyzico biliriz). Uç, imzası tutmayan adresi hiçbir şeye bakmadan ve iyzico'ya sormadan reddeder; kendi sınırı var (`payment_return`: adres başına dakikada 20, oturum başına 10 dakikada 10). `BACKEND_URL` staging ve canlıda zorunlu (https); yerelde `http://localhost:9000`.
- Callback (`iyzicoCallbackWorkflow`): oturumun token'ı sabit zamanlı karşılaştırılır; sonuç iyzico'ya sorulur (imza, sepet = oturum). Ödenmiş, tutarı ve para birimi tutan, `fraudStatus` 1 olan ödeme sepeti tamamlar (Medusa sepet kilidi; ikinci callback aynı siparişi bulur). Ardından tarayıcı oturumun dönüş adresine gider:
  - ödendi → başarı adresi;
  - kart reddi ya da `fraudStatus` -1 → hata adresi (iyzico -1'i kendisi iade eder);
  - `fraudStatus` 0 → başarı adresi + `payment_status=review` (sipariş, uzlaştırma işi onayı görünce açılır);
  - siparişe dönüşemeyen ödeme → başarı adresi + `payment_status=refund`; oturumu silinmişse vitrinin ilk kökeni.
- Sahipsiz ödeme `payment-recovery`'ye `provider: "iyzico"`, `reference` = iyzico'nun imzalı yanıtındaki `paymentId` ile yazılır. Kayıtlı bir ödeme bir daha asla siparişe dönüşmez (sonraki callback ya da iş, sepet yeniden tamamlanabilir olsa bile). İadesi V10'da; kurtarma işi şimdilik yalnızca PayTR satırlarını seçiyor (iyzico satırları PayTR'ninkileri bekletmesin).
- Verilen her form `payment-forms` tablosuna yazılır (oturum, sepet, token, son geçerlilik): Medusa yeniden başlatılan ödemenin eski oturumunu siler ama form iyzico'da ödenebilir kalır. `iyzico-reconcile` işi (10 dakikada bir) 5 dakikadan eski açık formların hepsini sayfa sayfa callback'in akışıyla sorar (tarayıcısı dönmeyen alıcı, incelemedeki ödeme, silinmiş oturumun ödenmiş formu). Form ödenince, iade kaydına girince ya da ödenmeden süresi dolunca kapanır; bir günü geçen açık form uyarıyla kapanır.
- Oturum verisi Store yanıtlarında görünür: Medusa'nın sakladığı ödeme verisinde kart bilgisi yok (yalnızca `payment_id`, taksit, fraud durumu ve satır işlemleri); panel kart bilgisini iyzico'ya sorarak gösterir (V10).
- Webhook (V3 imzası) kullanıcının kararıyla gerçek firmaya kadar ertelendi (2026-10-27); akış callback + uzlaştırmayla eksiksiz.
- Geliştirmede: deneme sayfası (`/dev/checkout`, ADR-0028) iyzico'yu paneldeki sandbox hesabıyla açar (tüm sayfa yönlendirmesi). Testler sahte iyzico'nun Checkout Form'unu ve tıklanabilir sayfasını (`/fake-cpp/<token>`: onayla, reddet, incelemede) kullanır.

- **Sandbox'ta ölçüldü (2026-10-27, F5 V10, deneme siparişi #212'nin ödemesinde 1 TL iade):**
  - Aynı gün iade sandbox'ta yapılabildi (`10223` görülmedi; canlıda görülürse tam tutar iptale düşülür).
  - İade yanıtının imzası `paymentId:price:currency:conversationId` (doğrulandı).
  - Satırın kalanını (önceki iadelerle) aşan iade `5093`.
  - Ödeme detayı (`/payment/detail`) iadeleri göstermiyor (tutarlar ve `merchantPayoutAmount` iade sonrası aynı); imzasının alan sırası belgelenmemiş, denenen iki sıra tutmadı. Detay yalnızca kimlikler ve kart bilgisi için okunur.

## İade, iptal, taksit ve panel (F5 V10)
- **İade:** kendi sipariş iademizden (satır bazlı defter, `pending_refund` referansı). Tutar kalem işlemlerine (`itemTransactions`) bölünür: önce ürünler, kargo en son, en az parçayla; her işlem kendi kalanını aşmaz. Medusa'nın kendi iadeleri (referanssız) reddedilir: `payments.use_order_refund`.
- **Kayıp yanıt (güvenlik incelemesiyle sıkılaştırıldı):** iyzico iadeyi tekilleştirmiyor ve iade listesi vermiyor. Her parça gönderilmeden önce defter satırına `sending` yazılır. iyzico'nun imzalı ve isteğe (ödeme, tutar, para birimi, referans) uyan yanıtından sonra `done` olur. Parça yalnızca iyzico açıkça reddettiyse ya da istek hiç gitmediyse silinir. Başka her hata (yanıtsızlık, okunamayan ya da imzası tutmayan yanıt) parçayı `sending` bırakır. Bir ödemede `sending` parça varken o ödemenin hiçbir iadesi yapılmaz, referans ne olursa olsun (`iyzico.refund_outcome_unknown`; çözüm aracı açık iş).
- **Paylaştırma:** her yeni iade, ödemenin bütün defter satırlarındaki bütün parçalar düşülerek paylaştırılır; başarısız ya da yarım kalan iadelerinkiler de dahil. Parça göndermiş bir iade başarısız olursa satırı `failed` değil `pending` + `refund_incomplete` kalır: satırları sayılmaya devam eder, aynı referans işi bitirir.
- **Sepet tamamlama:** iadeye yazılmış bir ödemeyi sağlayıcının yetkilendirmesi de `error` sayar; sepet bu ödemeyle tamamlanamaz.
- **Aynı gün:** iyzico aynı gün iadeyi reddederse (`10223`) ve iade ödemenin tamamıysa ödeme iptal edilir; kısmi iade için "yarın tekrar deneyin".
- **Sahipsiz ödemenin iadesi** (kurtarma işi, kayıt başına kilitle): önce iptal (aynı gün, tamamı). İptal açıkça reddedilirse her kalem işleminin tamamı iade edilir; iptalin yanıtı kaybolursa ödeme mağazaya bırakılır. Kalem tutarları imzasız detaydan gelir: toplamları imzalı sonucun tutarını karşılamıyorsa iade yapılmaz (`detail_mismatch`). Bir parça gittikten sonra hata ya da kayıp yanıt olursa ödeme tekrar denenmez, mağazaya bırakılır (uyarı + denetim kaydı).
- **Taksit:** vitrin tablosu öncelikli kart sağlayıcısından gelir. iyzico'da BIN'siz taksit sorgusu, aile başına iyzico'nun kendi toplamları; tutar başına 10 dakika süreç belleğinde saklanır.
- **Öncelikli sağlayıcı:** Ayarlar > Ödeme'de iki kart sağlayıcısı bağlıyken seçilir (`payments.card_provider`). `GET /store/payment/methods` bağlı sağlayıcıları seçilen önde olacak şekilde listeler; Medusa'nın kendi listesi bağlı olmayanları da sayar.
- **Panel:** sipariş sayfası iyzico ödemesini iyzico'ya sorarak gösterir (işlem no = `paymentId`, kart markası ve son 4 hane, taksit, sahtekârlık kontrolü 0/-1 ise uyarı); yapılan iadeler kendi kaydımızdan.

## Günlük işlem raporu (mutabakat, F11.3, 2026-10-29)
- **Uç:** `GET /v2/reporting/payment/transactions?transactionDate=YYYY-MM-DD&page=N` (docs.iyzico.com "Reporting Service"). Sayfalar 1'den başlar.
- **Yanıt:** `transactions[]`, `currentPage`, `totalPageCount`. Satır alanları `transactionType` (`PAYMENT`, `REFUND`, `CANCEL`), `transactionStatus` (1/2 onaylı, 0 incelemede, -1 incelemede reddedildi), `transactionDate` (`yyyy-MM-dd HH:mm:ss`), `paymentId`, `conversationId`, `basketId`, `price`, `paidPrice`, `transactionCurrency`, `installment`, `afterSettlement` ve diğerleri. Geriye en fazla 2 yıl gidilebilir.
- **İmza:** GET isteğinde imza yalnızca yol üzerinden atılır: `randomKey + "/v2/reporting/payment/transactions"`, sorgu ve gövde imzaya girmez. Belge bunu söylemiyor; resmî iyzipay-php `IyziAuthV2Generator::getPayload` ve `ReportingPaymentTransaction` (istek `null` ile imzalanır) böyle yapıyor.
- **Okuma:**
  - Satış `price` ile karşılaştırılır: sepet tutarı, taksit farkı hariç.
  - -1 durumlu ödeme para almamıştır, satılmış sayılmaz.
  - `CANCEL` ödemenin tamamının iadesidir.
  - Referans `paymentId`'dir; mağaza tarafında ödemenin verisindeki `payment_id` ile eşlenir.
  - Sayfa sayısı 200'de kesilir.

## Kritik noktalar
- Sepet ve alıcı sunucuda kurulur. Oturum verisi herkese açık sayılır; kişisel veri bırakılmaz (adr/0026).
- itemTransactions (kalem ↔ paymentTransactionId) ödeme verisinde saklanır; kısmi iadenin temeli. Her sağlayıcı çıktısı verinin tamamıdır.
- Sandbox ve canlı adresler kodda sabit; hesabın `test_mode`'u seçer. Her adresin kendi HTTP istemcisi ve devre kesicisi var. `IYZICO_BASE_URL` yalnızca yerelde sahte sunucu içindir (canlı ve staging'de açılış reddedilir).

## Hesap bilgileri
API anahtarı ve gizli anahtar panelden girilir (Ayarlar > Ödeme > iyzico, adr/0027; V8, 2026-10-27).
- Ayar yalnızca `test_mode` (panelde "Sandbox"); iki anahtar da gizli ve yalnızca yazılır. `test_mode` kimlik alanıdır: sandbox ↔ canlı geçişinde iki anahtar yeniden istenir.
- Kayıttan önce bağlantı kontrolü: 1 TL için BIN'siz taksit sorgusu (salt okunur), hesabın moduna ait adreste. `1001` → "API anahtarı tanınmadı", `1000` → "gizli anahtar kabul edilmedi"; ağ/5xx → ulaşılamadı (PayTR'deki kurallar).
- Panel bildirim adresini (`/hooks/iyzico/webhook`) ve iyzico panelindeki yerini (Ayarlar > Firma Ayarları > İşyeri Bildirimleri) gösterir; uç, webhook'larla birlikte gerçek firmaya kadar ertelendi.
- Kullanıcının sandbox hesabı 2026-10-27'de panelden bağlandı ve doğrulandı; `.env`'deki `IYZICO_*` satırları artık kullanılmıyor.

## Testler
Sahte sunucu senaryoları: başarı, 3DS başarısız, kullanıcı iptali, fraudStatus 0 → 1 ve 0 → -1, mükerrer callback, imzası bozuk yanıt, kısmi iade (satır kalanı), aynı gün iptal, 10223, 5xx/timeout.
