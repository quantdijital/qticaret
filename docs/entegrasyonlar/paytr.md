# PayTR Payment Provider

> F5'in sağlayıcısı (2026-10-27 sıra değişikliği; adr/0026). **Ana kaynak dev.paytr.com** (kullanıcı, 2026-10-27). Aşağıdakiler oradan 2026-10-27'de doğrulandı; hata kodları ve panel yolları V1'de yeniden okundu.
> "Doğrulanamadı" işaretli maddeler test hesabıyla kontrol edilir. Resmi Node SDK'sı yok; kendi istemcimiz `lib/payments/paytr` (`lib/clients` üzerine).

## Hesap bilgileri (panelden, adr/0027)
- Mağaza sahibi bilgileri Ayarlar > Ödeme'den girer: mağaza no (`merchant_id`), mağaza parola (`merchant_key`), mağaza gizli anahtar (`merchant_salt`), test modu. Parola ve gizli anahtar `integration-credentials` modülünde şifreli durur, bir daha gösterilmez.
- PayTR'de yeri: Mağaza Paneli > Destek & Kurulum > Entegrasyon Bilgileri, "API Entegrasyon Bilgileri" başlığı.
- **Bağlantı kontrolü:** uydurma bir `merchant_oid` ile durum sorgusu. `004` (işlem bulunamadı) bilgilerin doğru olduğunu gösterir; `001` mağaza no hatalı ya da pasif, `003` parola ya da gizli anahtar hatalı. Kayıttan önce, "Bağlantıyı test et"te ve sağlık kontrolünde kullanılır; panelden yapılanı 8 saniyede kesilir. Ağ/5xx "ulaşılamadı", belgelenmemiş yanıt "başarısız" sayılır (ADR-0027 §4).
- **Canlıya geçiş:** test ödemesinden sonra Destek & Kurulum > Canlı Mod > "Evet, Entegrasyonu Tamamladım" ve "Canlı Moda Geçiş Talebi Gönder". Onay SMS ve e-postayla gelir. Test işlemleri İşlem & Rapor > İşlemler'de e-postayla aranır.

## Akış (iFrame API)
```
Storefront: POST /store/carts/:id/payment-session (kendi ucumuz, adr/0026)
  → sunucu: sepet hazır mı + sepet/alıcı/IP/dönüş adresleri sunucudaki sepetten
  → createPaymentSessionsWorkflow → initiatePayment → POST /odeme/api/get-token → iframe token
  → oturumda: token, merchant_oid, beklenen tutar (kuruş), para birimi
Storefront: iframe https://www.paytr.com/odeme/guvenli/{token}
PayTR → Bildirim URL (POST /hooks/paytr)
  → hash (sabit zamanlı) → webhook-events kaydı (tekil) → durum sorgusu (authorizePayment)
  → tutar/para birimi oturumla eşleşiyor mu → cart complete (sepet kilidi) → düz metin "OK"
PayTR → tarayıcı: merchant_ok_url / merchant_fail_url (yalnızca bilgilendirme; sipariş onaylamaz)
```

## Ödeme başlatma (F5 V2, 2026-10-27)
- Sağlayıcı `pp_paytr_paytr` (`src/modules/payment-paytr`, medusa-config'te `id: "paytr"`). Hesap çağrı anında `@medusajs/framework`'ün paylaşılan `container`'ından okunur (adr/0027); kurucuda okunmaz, modüller o sırada henüz kayıtlı değil.
- Bölgeye bağlama: bootstrap yeni bölgeye `pp_system_default` ile birlikte ekler; `paytr-region-provider` migration betiği mevcut bölgelere, bölgenin kendi sağlayıcılarını koruyarak ekler (Medusa kümenin tamamını değiştirir). Hesap yoksa başlatma `paytr.not_configured` ile reddedilir.
- Uç: `POST /store/carts/:id/payment-session` gövde `{ provider_id, return_urls: { success, failure } }`. Dönüş adresleri `STORE_CORS` origin'lerinden biri olmalı (`payments.return_url_invalid`). Hız profili `checkout` (adres ve sepet başına).
- Sepet hazır mı: kalem, teslimat adresi, kargo yöntemi (gerekiyorsa), e-posta ve telefon; eksik olan alan adıyla döner.
- Sepet (`lib/payments/basket`): F4.7 payları, kredi satırları (hediye kartı, mağaza kredisi) satırlara dağıtılır, 0 TL satır çıkar, toplam ödeme koleksiyonu tutarına kuruşu kuruşuna eşit. Adede bölünmeyen satır PayTR'ye tek satır olarak "(N adet)" adıyla gider.
- Oturum verisi herkese açık: `checkout` (alıcı, sepet, IP) çıktıda boşaltılır; oturumda `token`, `form_url`, `merchant_oid`, `amount` (kuruş), `currency_code`, `test_mode`, `expires_at` kalır (HTTP testi).
- Medusa'nın `/store/payment-collections/:id/payment-sessions` ucu PayTR için 400 (`payments.use_checkout_route`); sağlayıcı da bizim ucumuzun `context` işareti olmayan başlatmayı reddeder.
- `authorizePayment` durum sorgusudur: ödeme yoksa `pending`, tutar/para birimi/test modu oturumla eşleşirse `captured`, değilse `error`. Ödenen sepet `/store/carts/:id/complete` ile siparişe dönüşür (HTTP testi). İade ve iptal V5'e kadar `paytr.refund_unavailable`.
- Taksit sınırı V6'ya kadar `max_installment: 0` (hesabın en çoğu).

## Uçlar ve imzalar
Tüm imzalar `base64(HMAC-SHA256(key = merchant_key, mesaj))`.

| İş | Uç | İmza mesajı |
|---|---|---|
| Token | `POST https://www.paytr.com/odeme/api/get-token` | `merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + merchant_salt` |
| Bildirim (gelen) | Bizim `POST /hooks/paytr` | `merchant_oid + merchant_salt + status + total_amount` |
| Durum sorgusu | `POST https://www.paytr.com/odeme/durum-sorgu` | `merchant_id + merchant_oid + merchant_salt` |
| İade | `POST https://www.paytr.com/odeme/iade` | `merchant_id + merchant_oid + return_amount + merchant_salt` (`reference_no` imzada yok) |
| Taksit oranları | `POST https://www.paytr.com/odeme/taksit-oranlari` | `merchant_id + request_id + merchant_salt` |
| BIN | `POST https://www.paytr.com/odeme/api/bin-detail` | `bin_number + merchant_id + merchant_salt` |

İstekler form-encoded gönderilir (resmi örnekler). `test_mode` isteğe bağlı ama imzada; her zaman gönderilir.

## Alan kuralları
- **`merchant_oid`:** yalnızca harf ve rakam, en çok 64, işlem başına tekil. Medusa oturum kimliği alt çizgi içerdiği için olduğu gibi kullanılamaz; alt çizgisiz hali kullanılır (`payses01J…`, adr/0026).
- **Tutar biçimleri karışık; çeviri tek modülde (`lib/money` sınırı):**
  - `payment_amount` (token) ve bildirimdeki `total_amount`/`payment_amount`: kuruş tam sayı (34,56 TL → `3456`).
  - `user_basket` satır fiyatı ve iade `return_amount`: TL ondalık metin, nokta ile (`"18.00"`, `"11.97"`).
  - Durum sorgusu tutarları: örneklerde hem `"10,8"` hem `"9.76"`; okuyucu ikisini de kabul eder.
- **`user_basket`:** `base64(JSON.stringify([[ad, birim_fiyat, adet], …]))`. Toplamın `payment_amount`'a eşit olma şartı, 0 TL satır ve yalnızca gösterim mi olduğu: doğrulanamadı. Bizim kuralımız: satırlar toplamı tutara eşit, 0 TL satır yok (iyzico ile aynı sepet kurucusu).
- **Token yanıtı:** başarı `{"status":"success","token":"…"}`, red `{"status":"failed","reason":"Zorunlu alan degeri gecersiz: merchant_id"}`. `reason`'dan yalnızca alan adı tutulur (`token_refused_<alan>`); metnin geri kalanı alışveriş bilgisi taşıyabilir. `debug_on` yalnızca test modunda 1.
- **`user_ip`:** müşterinin gerçek IP'si; yanlışsa "geçersiz paytr_token". Alan 39 karakter (IPv6 uzunluğu) ama "ipv4" diye etiketli; IPv6: doğrulanamadı. Yerel testte dış IP gönderilmeli.
- **`email`:** en çok 100, Türkçe karakter yok. `user_name` 60, `user_address` 400, `user_phone` 20, ok/fail URL'leri 400 karakter.
- **`max_installment`:** 0 (hesabın izin verdiği en çok) ya da 2–12; `no_installment` 1 ise taksit gösterilmez. iFrame taksitleri kendisi gösterir.
- **`timeout_limit`:** dakika, varsayılan 30. Süre dolarsa ya da sayfa kapanırsa `failed_reason_code` 6 ile başarısız bildirimi gelir. Token ömrü: doğrulanamadı.
- **Para birimleri:** TL (TRY), EUR, USD, GBP, RUB. 1 TL altı işlem yapılamaz.

## Bildirim (Bildirim URL)
- Adres **mağaza hesabı başına tek**, panelden ayarlanır (Destek & Kurulum > Ayarlar > Bildirim URL Ayarları); istek başına verilemez. Aynı hesabı kullanan dev, staging ve canlı aynı adrese düşer. Bizim panelimiz adresi (`{mağaza adresi}/hooks/paytr`) kopyalanabilir gösterir.
- Oturum/giriş gerektirmemeli; SSL yoksa HTTPS adresi verilmemeli.
- Alanlar: `merchant_oid`, `status` (success/failed), `total_amount`, `hash`, `failed_reason_code`, `failed_reason_msg`, `test_mode`, `payment_type` (card/eft), `currency`, `payment_amount`. Taksit sayısı alanı yok (durum sorgusunda `taksit` var).
- **İmza yalnızca `merchant_oid`, `status`, `total_amount`'u kapsar;** diğer alanlar imzasız, oturumdaki kayıtla ve durum sorgusuyla karşılaştırılır.
- `total_amount`, vade farkı olan taksitte `payment_amount`'tan büyük olabilir; muhasebede `total_amount`.
- Yanıt yalnızca düz metin `OK`. "OK" alınmazsa PayTR bir süre tekrar dener (aralık ve süre: doğrulanamadı); işlem "Devam Ediyor"da kalır, durmuş bildirimler panelden yeniden başlatılabilir.
- Aynı sipariş için birden fazla bildirim gelebilir: ilki işlenir, sonrakilere yalnızca "OK" (`webhook-events`).
- Başarısız bildirime de "OK" dönülür.
- `failed_reason_code`: `0` değişken (mesajı oku, ör. limit), `1` telefon girilmedi, `2` SMS kodu hatalı, `3` güvenlik kontrolü onaylanmadı, `6` müşteri vazgeçti ya da `timeout_limit` doldu, `8` kartta taksit yok, `9` mağaza bu kartla ödeme alamaz, `10` 3D Secure zorunlu, `11` dolandırıcılık uyarısı, `99` teknik entegrasyon hatası (`debug_on` 0 iken).
- PayTR'nin IP listesi yayımlanmamış (IP allowlist yok; imza + hız sınırı).

## Durum sorgusu
- Başarılı yanıtta `payment_amount`, `payment_total`, `currency`, `taksit`, `kart_marka`, `masked_pan`, `odeme_tipi`, `test_mode`, `net_tutar`, `kesinti_tutari`, `returns[]` (her iade: `return_amount`, `return_date`, `reference_no`, …).
- Ayrıca `payment_date`, `auth_code`, `auth_date`. `payment_amount` ve `payment_total` virgüllü (`"10,8"`), `net_tutar` ve `kesinti_tutari` noktalı (`"9.76"`).
- Hata: `status: "error"`, `err_no`, `err_msg`. `001` geçersiz istek / mağaza no yok / mağaza pasif, `002` `merchant_oid` hatalı, `003` `paytr_token` hatalı, `004` hem "işlem bulunamadı" hem "başarılı ödeme bulunamadı": sorgu yalnızca başarılı ödemeyi doğrular.
- Kullanım: `authorizePayment` (bildirimden sonra yeniden sorgu, docs/04), sonucu belirsiz çağrılar ve bildirimi gelmeyen oturumlar için uzlaştırma işi.
- Panelde gösterilecek kart bilgisi buradan: marka ve `masked_pan`'den yalnızca son 4 hane saklanır.

## İade
- `merchant_oid` + `return_amount` (TL ondalık) + isteğe bağlı `reference_no` (en çok 64, harf/rakam). Tam ve kısmi iade var; birden çok kısmi iade, toplamı ödemeyi geçmedikçe (`009`).
- İptal API'si yok: aynı gün de iade ucu kullanılır; `cancelPayment` tam iadedir.
- Hata kodları (dev.paytr.com/hata-kodlari): `000` servis ödeme aktarımı sırasında kilitli (sonra dene), `001` geçersiz istek / mağaza pasif, `002` `merchant_oid` hatalı, `003` `return_amount` hatalı, `004` `paytr_token` hatalı, `005` başarılı ödeme yok, `007` ödeme henüz siteye onaylanmadı (bildirim "OK" almadan iade olmaz), `008` ödeme türü iadeyi desteklemiyor, `009` toplam iade ödemeyi aşıyor, `010` net bakiye yetersiz, `011` bir yıldan eski işlem. İade sayfası aşımı `006` diye anıyor; ikisi de aynı anahtara eşlenir.
- Aynı numara API'ye göre farklı anlam taşır (`004` iadede hatalı token, sorguda bulunamadı); eşleme API başına ayrı tablodur (`lib/payments/paytr/errors.ts`).
- İdempotency belgelenmemiş: `reference_no` = iade kaydının kimliği (harf/rakam); sonuç belirsizse yeniden denemeden önce durum sorgusunun `returns[]` listesinde aranır.
- Yanıtta `status` "success", `is_test` (test işlemi 1), `merchant_oid`, `return_amount`, gönderildiyse `reference_no`. Hata hem "failed" (sipariş yok) hem "error" olarak geçiyor, ikisi de karşılanır.
- İstemci iadeyi kendiliğinden yeniden göndermez: yanıt kaybolursa `outcome_unknown` döner, çağıran `reference_no`'yu durum sorgusunda arar.

## Taksit
- Oran API'si (`taksit-oranlari`) BIN istemez; ürün sayfası için genel tablo alınabilir. Oranlar günlük değişebilir: günde bir çekilip saklanır.
- Yanıt: `status`, `request_id`, `max_inst_non_bus` (mağazanın en çok taksiti), `oranlar` (kart ailesi: axess, world, maximum, cardfinans, paraf, advantage, combo, bonus). `oranlar`'ın iç yapısı belgelenmemiş; bilinen biçim `{aile: {taksit_<n>: oran}}`, istemci buna göre okur (doğrulanamadı, V6). Eksik alanda `err_no` `006`.
- Bu API Direkt API başlığı altında belgeli; yalnızca iFrame kullanan hesabın erişimi: doğrulanamadı (test hesabıyla). Erişim yoksa PayTR panelinin gömülebilir "taksit tablosu" kodu storefront'a (F18) bırakılır.
- BIN sorgusu yalnızca storefront kart numarası alanı olmadığı için F5'te kullanılmaz.

## Kayıtlı kart
Yalnızca Direkt API'de: kart bilgisi bizim sayfamızdaki formdan PayTR'ye gönderilir (SAQ-A dışı). Kapsam dışı (adr/0026).

## Test modu
- Ayrı test ortamı ya da ayrı test anahtarı belgelenmemiş: `test_mode=1` canlı `merchant_id`/`merchant_key`/`merchant_salt` ile çalışır. Yeni mağaza "Canlı Moda Geçiş Talebi" onaylanana kadar test modundadır.
- Bildirim adresi tek olduğu için **canlı satış yapan bir hesapla dev'de test edilemez** (canlı bildirimler dev'e gider). Test için ayrı mağaza ya da canlıya geçmemiş hesap gerekir (docs/12).
- Dev'de bildirim için herkese açık adres (tünel) gerekir.
- iFrame test kartları formda hazır gelir; başarılı/başarısız/3DS kartları: doğrulanamadı.

## Ters ibraz
PayTR'de ters ibraz API'si ya da bildirimi bulunamadı; F6.7 PayTR için elle kayıtla çalışır.

## Güvenlik notları
- Hash karşılaştırması `timingSafeEqual` (resmi örnekler `!=` kullanıyor; kopyalanmaz).
- `merchant_key` ve `merchant_salt` hiçbir istek gövdesine girmez (resmi Node örneği gönderiyor; kopyalanmaz).
- İstemci IP'si `trust proxy` ile çözülmüş `req.ip`'den; `X-Forwarded-For`'u doğrudan okumak yok (resmi PHP örneği okuyor).
- Log redaksiyonu: `merchant_key`, `merchant_salt`, `paytr_token`, `token`, `hash`, `utoken`, `ctoken`.

## Env
Hesap bilgileri env'de değil, panelde (adr/0027). Env'de yalnızca:
- `CREDENTIALS_ENCRYPTION_KEY`: hesap bilgilerini şifreleyen anahtar (canlıda zorunlu).
- `PAYTR_BASE_URL`: yalnızca geliştirici makinesinde ve testte sahte sunucu için; canlıda ve staging'de tanımlıysa açılış reddedilir. Gerçek adres kodda sabit (`https://www.paytr.com`).

## Testler
İmzalar bilinen-cevap vektörleriyle test edilir (Python `hmac` ve `openssl` ile ayrıca hesaplandı). Sahte sunucu imzaları kendi kodumuzdan bağımsız, dokümana göre doğrular; test hesapları her çalıştırmada üretilir (`fakePaytrAccount`).
Sahte sunucu senaryoları (`packages/testing`): başarı, taksitli başarı (vade farkı), 3DS başarısız, zaman aşımı (kod 6), mükerrer bildirim, imzası bozuk bildirim, tutarı farklı ödeme, bayat oturuma gelen ödeme, kısmi iadeler ve `009`, `007`, `010`, 5xx/timeout (belirsiz sonuç → durum sorgusu).
