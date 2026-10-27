# PayTR Payment Provider

> F5'in sağlayıcısı (2026-10-27 sıra değişikliği; adr/0026). Aşağıdakiler dev.paytr.com'dan 2026-10-27'de doğrulandı.
> "Doğrulanamadı" işaretli maddeler sandbox/test hesabıyla kontrol edilir. Resmi Node SDK'sı yok; kendi istemcimizi yazıyoruz (`lib/clients` üzerine).

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
- **`user_ip`:** müşterinin gerçek IP'si; yanlışsa "geçersiz paytr_token". Alan 39 karakter (IPv6 uzunluğu) ama "ipv4" diye etiketli; IPv6: doğrulanamadı. Yerel testte dış IP gönderilmeli.
- **`email`:** en çok 100, Türkçe karakter yok. `user_name` 60, `user_address` 400, `user_phone` 20, ok/fail URL'leri 400 karakter.
- **`max_installment`:** 0 (hesabın izin verdiği en çok) ya da 2–12; `no_installment` 1 ise taksit gösterilmez. iFrame taksitleri kendisi gösterir.
- **`timeout_limit`:** dakika, varsayılan 30. Süre dolarsa ya da sayfa kapanırsa `failed_reason_code` 6 ile başarısız bildirimi gelir. Token ömrü: doğrulanamadı.
- **Para birimleri:** TL (TRY), EUR, USD, GBP, RUB. 1 TL altı işlem yapılamaz.

## Bildirim (Bildirim URL)
- Adres **mağaza hesabı başına tek**, panelden ayarlanır (Destek & Kurulum > Ayarlar > Bildirim URL Ayarları); istek başına verilemez. Aynı hesabı kullanan dev, staging ve canlı aynı adrese düşer.
- Oturum/giriş gerektirmemeli; SSL yoksa HTTPS adresi verilmemeli.
- Alanlar: `merchant_oid`, `status` (success/failed), `total_amount`, `hash`, `failed_reason_code`, `failed_reason_msg`, `test_mode`, `payment_type` (card/eft), `currency`, `payment_amount`. Taksit sayısı alanı yok (durum sorgusunda `taksit` var).
- **İmza yalnızca `merchant_oid`, `status`, `total_amount`'u kapsar;** diğer alanlar imzasız, oturumdaki kayıtla ve durum sorgusuyla karşılaştırılır.
- `total_amount`, vade farkı olan taksitte `payment_amount`'tan büyük olabilir; muhasebede `total_amount`.
- Yanıt yalnızca düz metin `OK`. "OK" alınmazsa PayTR bir süre tekrar dener (aralık ve süre: doğrulanamadı); işlem "Devam Ediyor"da kalır, durmuş bildirimler panelden yeniden başlatılabilir.
- Aynı sipariş için birden fazla bildirim gelebilir: ilki işlenir, sonrakilere yalnızca "OK" (`webhook-events`).
- Başarısız bildirime de "OK" dönülür.
- PayTR'nin IP listesi yayımlanmamış (IP allowlist yok; imza + hız sınırı).

## Durum sorgusu
- Başarılı yanıtta `payment_amount`, `payment_total`, `currency`, `taksit`, `kart_marka`, `masked_pan`, `odeme_tipi`, `test_mode`, `net_tutar`, `kesinti_tutari`, `returns[]` (her iade: `return_amount`, `return_date`, `reference_no`, …).
- Hata: `status: "error"`, `err_no`, `err_msg`. `004` hem "işlem bulunamadı" hem "başarılı ödeme bulunamadı": sorgu yalnızca başarılı ödemeyi doğrular.
- Kullanım: `authorizePayment` (bildirimden sonra yeniden sorgu, docs/04), sonucu belirsiz çağrılar ve bildirimi gelmeyen oturumlar için uzlaştırma işi.
- Panelde gösterilecek kart bilgisi buradan: marka ve `masked_pan`'den yalnızca son 4 hane saklanır.

## İade
- `merchant_oid` + `return_amount` (TL ondalık) + isteğe bağlı `reference_no` (en çok 64, harf/rakam). Tam ve kısmi iade var; birden çok kısmi iade, toplamı ödemeyi geçmedikçe (`009`).
- İptal API'si yok: aynı gün de iade ucu kullanılır; `cancelPayment` tam iadedir.
- Hata kodları: `000` servis kilitli (sonra dene), `007` ödeme henüz siteye onaylanmadı (bildirim "OK" almadan iade olmaz), `008` ödeme türü iadeyi desteklemiyor, `009` toplam iade ödemeyi aşıyor, `010` net bakiye yetersiz, `011` bir yıldan eski işlem.
- İdempotency belgelenmemiş: `reference_no` = iade kaydının kimliği (harf/rakam); sonuç belirsizse yeniden denemeden önce durum sorgusunun `returns[]` listesinde aranır.
- Yanıtta `status` "success"; hata hem "failed" hem "error" olarak geçiyor, ikisi de karşılanır.

## Taksit
- Oran API'si (`taksit-oranlari`) BIN istemez; ürün sayfası için genel tablo alınabilir. Oranlar günlük değişebilir: günde bir çekilip saklanır.
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
`PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, `PAYTR_TEST_MODE` (`on`/`off`), `PAYTR_BASE_URL` (yalnızca test/dev'de sahte sunucu için; canlıda `https://www.paytr.com` dışı reddedilir).

## Testler
Sahte sunucu senaryoları (`packages/testing`): başarı, taksitli başarı (vade farkı), 3DS başarısız, zaman aşımı (kod 6), mükerrer bildirim, imzası bozuk bildirim, tutarı farklı ödeme, bayat oturuma gelen ödeme, kısmi iadeler ve `009`, `007`, `010`, 5xx/timeout (belirsiz sonuç → durum sorgusu).
