# ADR-0051: Panelden sipariş ve ödeme bağlantısı

- **Durum:** Kabul (2026-11-03, kullanıcı: "önerilerine uyuyorum")
- **Tarih:** 2026-11-03
- **İlgili:** docs/20 (gerekli liste); adr/0026 (barındırılan ödeme formu), adr/0029 (havale, kapıda ödeme), adr/0044 (fraud guard), adr/0040 (roller), adr/0038 M10 (sepet bağlantısı deseni), adr/0041 (sözleşme onayı), adr/0034 (e-fatura), adr/0033 §7 (Medusa uçlarını kapatma), adr/0052 (ek seçenekler)

## Bağlam

Türkiye'de Instagram ve WhatsApp satışı yaygın bir kanal. Müşteri DM'den sipariş ister, personel sepeti kurar ve bir ödeme bağlantısı yollar.

- **Rakipler:** Shopify'da taslak sipariş var: "fatura gönder" ile ödeme bağlantısı, isteğe bağlı "ürünleri ayır", özel kalem, indirim, "ödendi işaretle". ikas ve Ticimax'ta ödeme bağlantısı var. **Bizde yok.**

**Medusa 2.21.2 taslak siparişi** (Context7, 2026-11-03):

- `POST /admin/draft-orders`: `region_id` (zorunlu); `email` ya da `customer_id`; `items` (`variant_id` ya da `variant_sku`, `unit_price`, `quantity`, `metadata`); `shipping_methods` (`shipping_option_id`, `amount`); `promo_codes`; adresler.
- Düzenleme sipariş değişikliğiyle yapılır (`beginOrderEditOrderWorkflow`).
- `POST /admin/draft-orders/:id/convert-to-order` gövdesizdir. `convertDraftOrderWorkflow` vergi satırlarını yeniden hesaplar, durumu `pending`, `is_draft_order`'ı `false` yapar.
- **Store API'de taslak sipariş ucu yok.** Ödeme taslağın parçası değil: dönüşümden sonra personelin işi.
- Dönüşümün stok ayırıp ayırmadığı ve `order.placed` yayıp yaymadığı Context7'de geçmiyor; kullanılırsa kaynaktan doğrulanır.

**Bizim ödeme yığınımız sepete bağlı.** Her yol `POST /store/carts/:id/payment-session`'dan geçer (adr/0026 §1): kara liste, hız kuralları ve iş kanıtı (adr/0044 §2), kapıda ödeme ücreti satırı (adr/0029), sözleşme ve yaş onayı (`completeCartWorkflow.hooks.validate`), sahipsiz ödemenin iadesi ve uzlaştırma. Kartla ödemede sipariş, PayTR/iyzico bildirimiyle sepetten açılır.

**Mevcut durum ve hazır desen:**

- `/admin/draft-orders` uçları bugün açık; yalnız denetim kaydının hassas yollar listesinde (`sensitive-routes.ts`). `@medusajs/draft-order` paketi bağımlılıklarda var ama eklenti olarak kayıtlı değil.
- Terk edilmiş sepet bağlantısı hazır desen (adr/0038 M10): 32 bayt rastgele token, yalnız özeti saklanır; vitrin token'ı sayfa açılınca değil düğmeyle kullanır; satırlar taze bir sepete kopyalanır.

## Karar

1. **Kayıt: `payment-links` modülü, `payment_link`.**
   - Kısa numara (`PL-1042`); durum `open`, `paid`, `expired`, `cancelled`; token özeti (SHA-256) ve bitiş; oluşturan personel; müşteri kimliği (varsa).
   - Satırlar: varyant, adet, kilitli birim fiyat (kuruş) ve ek seçenekler (adr/0052). İndirim: tür, değer, neden. Kargo seçeneği, iç not, açılma sayısı, ödenince sipariş kimliği.
   - E-posta, telefon, teslimat adresi ve fatura bilgisi tek şifreli alanda (`sealed`, `PII_ENCRYPTION_KEY`; adr/0047 deseni).
   - Medusa taslak siparişi kayıt olarak kullanılmaz (Alternatifler).

2. **Fiyat sunucuda (kural 5).**
   - Personel yalnız varyantı ve adedi seçer.
   - Birim fiyat oluşturma anında Medusa'nın fiyatlamasıyla hesaplanır: TRY bölgesi, müşterinin grubu, fiyat listeleri. Bu fiyat bağlantı süresince **kilitlidir** (Shopify gibi: teklif bu fiyattır). Kilit, satırın özel birim fiyatıdır; değer elle yazılmaz.
   - **İndirim** bağlantıya özel, tek kullanımlık, panel listelerinde gizli bir Medusa promosyonudur: yüzde ya da tutar, isteğe bağlı kargo bedava.
     - Faturada iskonto, raporda indirim olarak görünür.
     - `admin` en çok `pay_links.max_discount_percent` (varsayılan %20) indirim verebilir; üstünü `owner` verir.
     - Neden alanı zorunludur.
   - Katalogda olmayan özel kalem v1'de yok.
   - Toplamları panel değil backend hesaplar: `POST /admin/payment-links/preview` ara toplam, indirim, kargo tahmini ve KDV'yi döner.

3. **Bağlantı ve vitrin sayfası.**
   - **Adres:** `<vitrin>/ode/<token>`; 1 saat ile 7 gün arası geçerli, varsayılan 72 saat. Mağaza alan adı yoksa bağlantı oluşturulamaz.
   - **Sayfa:** mağaza, kalemler (görsel, ad, adet, fiyat), indirim, toplam ve bitiş. Kişisel veri gösterilmez; ad baş harfleriyle maskelenir. `Referrer-Policy: no-referrer` ve `noindex`.
   - **Kullanım:**
     - Token sayfa açılınca kullanılmaz; e-posta tarayıcıları bağlantıyı açabilir.
     - "Ödemeye geç" düğmesi `POST /store/payment-links/redeem`'i çağırır. Backend anlık görüntüden **taze bir sepet** kurar: özel fiyatlı satırlar, indirim kodu, e-posta, varsa adres ve fatura bilgisi, `qt_pay_link` işareti. Sepet kimliğini döner.
     - Vitrin sepeti hatırlar ve `/odeme`'ye geçer.
   - **Her kullanım yeni bir sepet açar.** Cihaz değiştiren müşteri ödemeye devam eder; bağlantıyı başkası görse de öncekinin sepetini izleyemez.
   - **Hız ve hata:** `pay_link` profili, IP başına 15 dakikada 30 istek. Bilinmeyen, süresi dolmuş ve ödenmiş bağlantı aynı 404'ü alır.

4. **Kilitli sepet.**
   - `qt_pay_link`'li sepette satır ekleme, silme, adet ve promosyon değişikliği `pay_links.cart_locked` ile reddedilir (kapıda ödeme ücret satırını koruyan `protectFeeLine` deseni).
   - Adres, kargo yöntemi, fatura bilgisi, izinler ve ödeme yöntemi müşteride kalır.
   - Ödeme başlatma ve tamamlama iki şeyi yeniden denetler:
     - bağlantı hâlâ `open` ve süresi içinde;
     - satırlar anlık görüntüyle aynı.

5. **Ödeme: vitrin ödemesinin tamamı.**
   - Yollar: kart (PayTR/iyzico), havale, hediye kartı; kapıda ödeme ayara bağlı (`pay_links.allow_cod`).
   - Bütün korumalar aynen geçerli: kara liste, hız, iş kanıtı, mesafeli satış ön bilgilendirmesi ve onayı, yaş beyanı.
   - **Tamamlanma bağlantının kilidi altındadır:**
     - Bağlantı `paid` olur, sipariş kimliği yazılır.
     - Siparişe `qt_source: pay_link`, `qt_pay_link_id` ve oluşturan personel yazılır.
     - Aynı bağlantıdan açılmış ikinci bir sepetin tamamlanması reddedilir. Kartla çekilmiş parası sahipsiz ödeme olarak kendiliğinden iade edilir (adr/0026 §6).

6. **Stok.** v1'de ayırma yok. Oluşturma ekranı stoğu gösterir ve yetersizse uyarır; ödeme anında Medusa'nın stok denetimi geçerlidir. Bağlantı sayfası stokta olmayan kalemi gösterir, ödemeyi kapatır ve personelin ziline düşer. Shopify'daki gibi "ürünleri ayır" (Medusa rezervasyonu, bağlantının bitişinde bırakılır) sonraki adımdır.

7. **Paylaşma.** Bağlantı oluşturulunca panel şunları sunar: bağlantının kendisi, "Kopyala", "SMS gönder", "E-posta gönder" ve "WhatsApp'ta aç".
   - **WhatsApp:** `https://wa.me/<telefon>?text=…` personelin kendi WhatsApp'ında açılır; API yok.
   - **Paylaşım metni** (i18n, hedef 160 karakter): "{mağaza_adı}: Siparişiniz hazır, toplam {tutar}. Ödeme bağlantısı ({süre} geçerli): {bağlantı}".
   - **SMS ve e-posta** işlemsel şablon `order.pay_link` ile gider: müşterinin kendi istediği sipariş iletisi, ticari değil. SMS kotasına sayılır; aynı bağlantı için 10 dakikada en çok bir gönderim.

8. **Yetki.**
   - Oluşturma ve iptal `owner` ve `admin`'de.
   - `operations` için öneri: yalnız indirimsiz bağlantı oluşturabilir (soru 1).
   - Her yazma denetim kaydına düşer. Liste ve ayrıntı kişisel veri okumasıdır (`SENSITIVE_READS`).
   - Hız sınırı: personel başına saatte 60 bağlantı.

9. **Medusa'nın taslak sipariş uçları kapanır.** `/admin/draft-orders*` yazmaları herkes için `orders.use_payment_link` ile reddedilir (adr/0033 §7 deseni). Sebep: izin ve sözleşme, dolandırıcılık ve fatura tetiklerini atlayan ikinci bir sipariş yolu olmasın.

10. **Dolandırıcılık ve suistimal.**
    - Bağlantıyla gelen sipariş de `fraud-review-order`'dan geçer. Personelin oluşturmuş olması puanı düşürmez.
    - Panelde "indirimli bağlantılar" süzgeci var: oluşturan, indirim, durum. Sahip personelin verdiği indirimleri buradan görür.

11. **E-fatura.**
    - Değişiklik yok; tetik ayarı (sipariş ya da kargo) aynı, havalede onay beklenir.
    - Alıcı fatura bilgisini ödemede kendisi girer. Personelin önceden girdiği kurumsal bilgi (VKN, unvan) sepete yazılır; müşteri değiştirebilir.
    - İndirim faturada iskontodur.

12. **Süre sonu.**
    - `payment-links-expiry` işi 15 dakikada bir çalışır. Süresi geçen bağlantıyı `expired` yapar ve promosyonunu kapatır.
    - Uzatma yok. "Kopyala" bugünkü fiyatlarla yeni bir bağlantı açar.

13. **Panel.**
    - **"Yeni sipariş":** Siparişler listesinin üstünde. Tam sayfa form iki sütundur:
      - solda: müşteri (ara ya da yeni), ürün arama ve adet (stok görünür), indirim, kargo, isteğe bağlı adres ve fatura, iç not, geçerlilik;
      - sağda: backend önizlemesinden özet ve "Bağlantı oluştur".
    - **Siparişler > "Ödeme bağlantıları"** (`/orders/links`):
      - sütunlar: numara, müşteri (maskeli), tutar, durum, oluşturan, bitiş, açılma sayısı;
      - satır işlemleri: kopyala, yeniden gönder, iptal.
    - **Sipariş sayfası** kaynağı gösterir: "Ödeme bağlantısından (PL-1042, oluşturan …)".

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kendi bağlantı kaydı + kilitli taze sepet + vitrin ödemesi (seçilen)** | Ödeme, izin, fraud, fatura yolu tek; yeni ödeme kodu yok | Kendi modülümüz; sepet kilidi ara katmanları |
| Medusa taslak siparişi + siparişe bağlı ödeme | Medusa'nın kaydı ve dönüşüm iş akışı | Ödeme yığını sepete bağlı: bildirim, sahipsiz iade, hız kuralları, sözleşme onayı ve kapıda ücret siparişe göre yeniden yazılır (ikinci ödeme yolu) |
| Taslak sipariş + "ödendi işaretle" (bağlantısız) | En ucuz | Mesafeli satış ön bilgilendirmesi ve onayı müşteriden alınmaz; para dışarıda, mutabakat yok |
| PayTR "Link ile Ödeme" / iyzico bağlantısı | Sağlayıcı panelinde hazır | Ödeme siparişe, stoğa, faturaya ve izinlere bağlanmaz; elle mutabakat |
| Bağlantı aynı sepeti açar (kopyasız) | Basit | Bağlantı sızarsa sepet ve adres paylaşılır; iki cihaz aynı sepeti değiştirir |

## Sonuçlar

- **Backend:** `modules/payment-links`; `workflows/payment-links/{create,preview,redeem,cancel,complete}.ts`; `/admin/payment-links*`, `POST /store/payment-links/redeem`, `GET /store/payment-links/:token`; sepet kilidi ara katmanı; `order.placed` aboneliği; `jobs/payment-links-expiry.ts`; `order.pay_link` şablonu; staff-guard'da taslak sipariş kapanışı.
- **Vitrin:** `/ode/[token]` sayfası ve "Ödemeye geç" eylemi (`sepet/geri-don` deseni).
- **Panel:** "Yeni sipariş" formu, "Ödeme bağlantıları" listesi, sipariş sayfasında kaynak.
- **Testler (HTTP `payment-links.spec`):**
  - fiyat istemciden alınmaz (gövdede fiyat reddedilir);
  - kilitli sepette satır, adet ve promosyon değişmez;
  - süresi dolmuş, ödenmiş ve iptal edilmiş bağlantı aynı 404'ü alır;
  - token iş akışı kaydında yok;
  - iki sepet yarışında tek sipariş açılır, ikinci ödeme iade edilir;
  - indirim sınırı role göre;
  - `/admin/draft-orders` yazmaları reddedilir;
  - sipariş fraud ve sözleşme denetiminden geçer.

  e2e: panelden bağlantı → vitrinde ödeme (sahte PayTR) → sipariş.
- **Belgeler:** KVKK envanteri (`payment_link` şifreli kişi verisi, saklama: ödenmeyen bağlantı bitişten 30 gün sonra silinir, ödenen siparişle kalır).

## Boyut ve bağımlılıklar

- **Boyut: M, yaklaşık 4 gün:** backend 2, panel 1, vitrin 0,5, test 0,5.
- **Bağımlılıklar:** vitrin ödemesi (D7, hazır); adr/0026, adr/0029, adr/0044 korumaları; adr/0041 sözleşme onayı; adr/0036 işlemsel şablon ve SMS kotası; adr/0040 roller; promosyon modülü (F4); mağaza alan adı. Ek seçenekli satırlar adr/0052'den sonra eklenir.

## Kullanıcıya sorular

1. **`operations` rolü:** Bu rol (ör. DM'lere bakan çalışan) indirimsiz ödeme bağlantısı oluşturabilsin mi? İndirim yalnız `owner` ve `admin`'de kalır.
2. **Stok ayırma:** v1'de stok ayrılmıyor; stok ödeme anında denetleniyor. Shopify'daki gibi isteğe bağlı "ürünleri ayır" şimdi gerekli mi?
3. **Dışarıda alınmış ödeme:** Ödemesi elden ya da IBAN'la önceden alınmış siparişi bağlantısız, panelden "ödendi" diye kapatmak istiyor musunuz? Bu durumda mesafeli satış onayı müşteriden alınmamış olur; öneri: v1'de yok.
4. **Kapıda ödeme:** Bağlantıyla gelen siparişte kapıda ödeme açık olsun mu? Öneri: kapalı başlasın, ayardan açılsın.

Cevaplar (2026-11-03): dört soruda da öneri kabul edildi. `operations` yalnız indirimsiz bağlantı oluşturur ve gönderir; v1'de stok ayrılmaz; dışarıda alınmış ödeme v1'de yok; kapıda ödeme bağlantı siparişinde kapalı.

## Uygulama notları (backend, 2026-11-03)

**Karardan sapmalar:**

- **Fiyat kilidi özel fiyat değil.** Satırlar oluşturma anında katalog fiyatıyla (TRY bölgesi, müşteri ve grupları, adet) anlık görüntüye yazılır. Sepet her açıldığında Medusa satırları kendi fiyatlar; fiyat anlık görüntüden farklıysa 409 `payment_link.prices_changed`, bağlantı `draft` olur ve personelin ziline düşer. Aynı denetim ödeme başlatmada ve tamamlamada yeniden yapılır (`cart.payment_link_prices_changed`). `draft` bağlantı müşteriye bir şey açmaz; personel "Kopyala" ile bugünkü fiyatlarla yeni bağlantı oluşturur.
- **Durumlar:** `draft`, `open`, `paid`, `expired`, `canceled` (`draft` = fiyat değişti).
- **Vitrin ucu:** `/redeem` yerine `POST /store/payment-links/:token/cart`.
- **Jeton:** `pl_<22 rastgele>.<bitiş>.<mac>`; `previewSigner("payment-link:v1")` ile `PII_HASH_KEY` altında imzalı. İmzası tutmayan jeton tabloya hiç sorulmaz. Kayıtta SHA-256 özeti (arama) ve şifreli kopyası (yeniden paylaşım) durur. Jeton iş akışı girdisine ya da çıktısına girmez: route jetonu çözer, iş akışına bağlantı kimliğini verir.
- **Uzatma var:** `POST /admin/payment-links/:id/extend`, ama bağlantının oluşturulmasından en çok 7 gün (jetonun kendi bitişi). Bağlantı ve paylaşım metni aynı kalır.
- **Şablon adı:** `order.pay_link` yerine `payment_link.sent` (işlemsel; e-posta ve SMS; `retry: true`, jeton kayıttaki şifreli kopyadan okunur). Yeniden gönderim bağlantı başına 10 dakikada bir.
- **Ayarlar bölümü `payment_links` (2026-11-03):** `pay_links.*` yerine `platform-settings` bölümü `payment_links`.
  - `admin_max_discount_percent`: tam sayı 0–99, varsayılan 20. `admin`'in bağlantıda verebileceği en büyük indirim (satırların yüzdesi). `owner`'ın sınırı kodda %99 kalır. 0, `admin`'in indirim veremeyeceği anlamına gelir.
  - `allow_cod`: varsayılan `false`. Açıkken bağlantı sepeti kapıda ödemeyi alır; kapıda ödemenin kendi bayrağı, tutar sınırı ve kurye seçimi yine geçerlidir. Kapalıyken ödeme başlatma 400 `cart.payment_link_no_cod` verir ve `GET /store/payment/methods?cart_id=` bağlantı sepetine `cash_on_delivery: null` döner.
  - Bölümü yalnız `owner` yazar (`OWNER_ONLY`): `admin` kendi sınırını yükseltemez.
  - Okuyan yerler: oluşturma ve önizlemedeki indirim denetimi (`plan.ts`, `discountProblem`'in dördüncü girdisi) ve sepet koruması (`cart-guard.ts` `linkCodProblem`; ödeme başlatma ara katmanı ve ödeme yolları listesi).
  - Kapıda ödeme ücreti satırı (`qt_fee`) bağlantı sepetinin "değişti" denetimine girmez; sunucunun satırıdır.
- **İndirim:** yüzde ya da tutar; kargo bedava v1'de yok. Promosyon `PL-XXXXXXXXXXXX` kodlu, `limit: 1`, KDV dahil, `qt-payment-links` kampanyasında. Promosyon listesi (`/admin/promotion-board`) bu kampanyayı göstermez. Kod başka bir sepette kullanılırsa ödeme başlatma ve tamamlama reddeder (`cart.payment_link_code_misused`).
- **Kurumsal fatura bilgisi (VKN, unvan) v1'de yok.** Yalnız teslimat adresi önceden girilebilir; fatura adresi de aynı adres olur.
- **Süre sonu işi saatlik** (`payment-links-expiry`, :17). Ödeme başlatma bağlantının bitişine kadar açıktır; başlamış bir ödeme bitişten sonra 1 saat daha siparişe dönebilir. İş bağlantıyı bu saatten sonra `expired` yapar ve kodunu kapatır.
- **Sipariş işareti:** `qt_source` yerine `order.metadata.qt_payment_link` (bağlantı kimliği) ve `qt_payment_link_by` (oluşturan personel).
- **Ek seçenekli satırlar (adr/0052)** v1'de yok. Bağlantı sepetinde `/line-items/:id/addons` kilitli.
- **Hız sınırları:** vitrin `pay_link` (IP başına 15 dakikada 30); personel başına oluşturma ve gönderim birlikte saatte 60; önizleme saatte 600.
- **Taslak siparişler:** `/admin/draft-orders*` yazmaları bayraktan bağımsız olarak herkese `orders.use_payment_link` (400) ile kapalı.
- **Bayrak:** `orders.payment_links` (mağaza, varsayılan kapalı). Kapalıyken admin ve vitrin uçları yokmuş gibi 404 verir. Sepet kilidi ve tamamlama denetimi bayraktan bağımsız çalışır.

**Sözleşme (vitrin, `/ode/[token]`):**

- Sayfa `noindex`, `Referrer-Policy: no-referrer`. Jeton sayfa açılınca kullanılmaz.
- `GET /store/payment-links/:token` (yayımlanabilir anahtar) → `{ payment_link: { number, state: "open" | "prices_changed", first_name, currency_code, lines: [{ variant_id, title, variant_title, thumbnail, quantity, unit_price, total, in_stock }], items_total, discount_total, total, shipping: { preset }, expires_at } }`. Tutarlar kuruş.
  - Bilinmeyen, imzası tutmayan, süresi dolmuş, ödenmiş ya da iptal edilmiş bağlantı aynı 404'ü alır (`payment_link.unavailable`). Bayrak kapalıysa Express'in 404 sayfası döner.
  - Kişisel veri olarak yalnız ad gelir.
- "Ödemeye geç" → `POST /store/payment-links/:token/cart` gövde `{}` → `{ cart_id }`. Vitrin sepet çerezini bu kimlikle yazar ve `/odeme`'ye geçer.
  - 409 `payment_link.prices_changed` ya da `payment_link.out_of_stock`: "mağazaya bildirildi" iletisi gösterilir.
  - Her basış yeni sepet açar; eski sepet artık tamamlanmaz (`cart.payment_link_superseded`). Kartla ödenmişse sahipsiz ödeme olarak kendiliğinden iade edilir (adr/0026 §6, mevcut yol).
- Ödeme adımında sepet `metadata.qt_payment_link` taşır. Satır ekleme, silme, adet ve kod değişikliği 400 `cart.payment_link_locked` alır; hediye kartı alıcısı (`/gift`) serbesttir. Kapıda ödeme yalnız `GET /store/payment/methods?cart_id=` onu döndürürse gösterilir (`payment_links.allow_cod`).
  - Ödeme başlatma ve tamamlama hataları: `cart.payment_link_closed`, `cart.payment_link_superseded`, `cart.payment_link_changed`, `cart.payment_link_prices_changed`, `cart.payment_link_no_cod`.

**Sözleşme (panel, Siparişler > "Ödeme bağlantıları" ve "Yeni sipariş"):**

- `capabilities.paymentLinks`: oluşturma ve gönderme (owner, admin, operations). `capabilities.paymentLinksManage`: indirim, iptal ve uzatma (owner, admin).
- `POST /admin/payment-links/preview` gövde `{ customer_id?, lines: [{ variant_id, quantity }], discount?, shipping_option_id? }` → `{ preview: { lines, items_total, discount, total, short_variant_ids, currency_code } }`. Formun özeti budur; fiyat gönderilirse 400 döner.
- `POST /admin/payment-links` yeniden doğrulamayla (`X-Reauth-*`; 428 → kod penceresi).
  - Gövde: `{ customer_id | guest: { first_name, last_name, email, phone? }, lines, discount?: { type: "percentage" (1–99) | "fixed" (kuruş), value, reason }, address?: { first_name, last_name, phone?, address_1, address_2?, city (ilçe), province (il), postal_code? }, shipping_option_id? (adresle), note?, expires_in_hours? (1–168, varsayılan 72) }`.
  - Yanıt 201 `{ payment_link, share }`.
  - Hatalar: 403 `payment_link.discount_not_allowed` / `discount_over_limit`; 400 `payment_link.discount_invalid`, `no_storefront`, `variant_unpriced`, `customer_required`, `customer_no_email`, `address_required`; 404 `variant_unknown`, `customer_unknown`, `shipping_option_unknown`.
- `GET /admin/payment-links?status&discounted=true|false&created_by&limit&offset` → `{ payment_links, count, limit, offset }`. Satır: `id, number ("PL-1042"), status, customer { id, name ("Ayşe Y."), email (maskeli) }, items_total, discount_total, total, discount, created_by, created_at, expires_at, opened_count, sent_count, order_id`. Denetim kaydına düşen okuma.
- `GET /admin/payment-links/:id` → `{ payment_link }`: listedeki alanlar ve `contact, address, lines, shipping_option_id, note, token_ends_at, cart_id, last_opened_at, last_sent_at, paid_at, canceled_by, closed_at`. Denetlenen okuma.
- `GET /admin/payment-links/:id/share` → `{ share: { url, sms_text, whatsapp_url, email_sent, sms_sent } }`. Bağlantı açık değilse metinler `null` olur. SMS metni kişi adı taşımaz. WhatsApp adresi müşterinin cep telefonuyla açılır, telefon yoksa numarasız.
- `POST /:id/resend { channels: ["email","sms"] }` → `{ outcomes }` (`sent`, `channel_off`, `invalid_recipient`, `over_quota`…). 10 dakika dolmadan 409 `payment_link.sent_recently`.
- `POST /:id/cancel {}`, `POST /:id/extend { hours }`: 409 `payment_link.not_open`; 400 `payment_link.extend_limit`.
- **Zil:** `payment_link_paid` (`order_id` ile), `payment_link_prices_changed`, `payment_link_out_of_stock`; `data.payment_link_id` ve `number` taşır.
- **Sipariş sayfası:** `order.metadata.qt_payment_link` varsa "Ödeme bağlantısından (PL-…, oluşturan …)" yazar; numara `GET /admin/payment-links/:id`'den okunur.

**KVKK:** `payment_link.sealed` alanında iletişim ve adres tutulur (Ş, `PII_ENCRYPTION_KEY`), e-posta ayrıca özetlenir (Ö). Kapanıştan 30 gün sonra kişisel alanlar silinir. Silme talebinde açık bağlantı iptal edilir; veri dökümüne `ödeme_bağlantıları` olarak girer (docs/kvkk-envanter.md).

**Açık konular:**

- **Grup fiyatı:** Misafir bağlantısı grup fiyatı olmadan fiyatlanır. Medusa sepeti aynı e-postalı kayıtlı müşteriye bağlarsa ve onun grup fiyatı farklıysa bağlantı `draft` olur (güvenli yön).
- **Kapsam dışı:** kurumsal fatura bilgisi, kargo bedava indirimi, ek seçenekli satır, "ürünleri ayır".
- **e2e testi** (panel → vitrin → sahte PayTR → sipariş) panel ve vitrin hazır olunca yazılır.
