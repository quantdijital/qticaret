# ADR-0051: Panelden sipariş ve ödeme bağlantısı

- **Durum:** Öneri (kullanıcı kararı bekliyor; 2026-11-03 gece taslağı)
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
