# ADR-0076: Tarihli ürün ve rezervasyon: kontenjanlı kalkış, katılımcı, kargosuz ödeme

- **Durum:** Kabul edildi (sahip kararı 2026-11-22; Deniz telefonda onayladı, döndüğünde okuyup revize eder)
- **Tarih:** 2026-11-22
- **İlgili:** adr/0007 (KDV modeli), adr/0009 (kimlik no saklama), adr/0012 (özellik bayrakları), adr/0051 (ödeme bağlantısı), adr/0061 (sektör paketleri), adr/0066 (tema katmanları, biçim sözleşmesi), adr/0071 ve adr/0074 (yapay zekâ işleri), docs/kvkk-envanter.md
- **Dayanak:** sahip (2026-11-22): kendi turlarını satan bir seyahat acentası altyapıyı kullanmak istiyor (pazar yeri değil, kendi mağazası; kargolanan ürün yok). Altyapı bozulmasın; ileride otel, oda ve araç kiralama (tarih aralığı seçerek) da gelebilir, şimdi yazılmasa bile bugünkü temel ona uygun olsun.

## Bağlam

Platform sektörden bağımsızdır; sektörel ihtiyaç özellik bayrağı ve şablonla çözülür (CLAUDE.md). Tur, bilet, atölye, kurs, konaklama ve araç kiralamanın ortak noktası aynıdır: **satılan şey bir tarihe (ya da tarih aralığına) bağlı sınırlı kontenjandır** ve kargolanmaz. Bu ADR o ortak yeteneği tanımlar; "turizm" bir sektör paketidir, kodda adı geçmez.

Kapsam dışı (bilerek): başka sağlayıcıların envanterini anlık çeken seyahat acentesi motoru (binlerce otelin müsaitliği, uçuş arama, kanal yöneticisi). Bu ADR mağazanın **kendi** tarihli ürünlerini satmasını kapsar.

### Kodda bugün olan (2026-11-22 `dev`, okundu)

- **Kargosuz ürünün backend'i hazır.** `product_extension.kind = physical | digital | service` (`modules/catalog-extension/models/product-extension.ts`), bayrak `catalog.non_physical`; fiziksel olmayan üründe envanter kalemi `requires_shipping=false`, kargo profili bağı kalkar (`workflows/catalog/shipping-kind.ts`); sepet kargo yöntemi olmadan tamamlanır, kargo yöntemi verilirse reddedilir (`lib/checkout/rules.ts`, `workflows/hooks/complete-cart-validate.ts`; test `integration-tests/http/non-physical-products.spec.ts`).
- **Vitrin ödemesi kargosuz sepeti geçirmiyor.** Adımlar sabit `address → shipping → payment` (`apps/storefront/src/lib/views/checkout.ts`, sözleşme `packages/ui/src/checkout-views.ts` `CheckoutStep`, tema `packages/themes/atolye/src/checkout/CheckoutPage.tsx`); kargo yöntemi seçilmeden ödeme adımı yüklenmez. Adres formu tam teslimat adresi ister. iyzico her kalemi `itemType: "PHYSICAL"` ve teslimat adresiyle gönderir (`lib/payments/iyzico/checkout-form.ts`).
- **Tarih, kontenjan, kişi tipi, katılımcı kavramı yok.** Nitelik türlerinde tarih yok; stok Medusa envanteri + `stock-ledger` defteri; sepette süreli tutma yok (Medusa rezervasyonu yalnız sipariş oluşurken yapılır).
- **Sunucu fiyatlı sepet satırının emsali var:** ek seçenekler (`workflows/addons/set-line.ts`, `price-line.ts`, `checkout.ts`): ayrı rota, Zod, sunucu fiyatı, `is_custom_price`, `metadata.qt_addons`, tamamlamada yeniden doğrulama. İstemci satır metadata'sında yalnız `qt_` öneki korunur (`api/http/payment-routes.ts`).
- **Sipariş durumu:** kargosuz ve ödenmiş sipariş `delivered` sayılır (`lib/dashboard/lifecycle.ts`); iade penceresi gönderime bağlıdır (`lib/orders/returns.ts`); sipariş e-postası her zaman kargo ve adres gösterir.
- **Kimlik verisi deseni:** `billing_profile` (şifreli + özet + son 4 hane, `packages/server-kit/src/crypto/pii.ts`); satır metadata'sı birden çok kopyada durduğundan şifreli veri için uygun değil.
- **Sektör paketi:** bayrak, nitelik şablonu, kategori, SEO, sahne ve hazır görünüm taşır (`packages/sector-packs/src/schema.ts`), eklemeli uygulanır; üst panel sihirbazında seçilir.
- **Kapora yok:** ödeme bağlantısı sepet tabanlı ve tam tutardır (adr/0051).

### Dışarıda nasıl yapılıyor (kaynaklı araştırma, 2026-11-22)

- **Medusa v2** resmi bilet ve kiralama örneklerinde aynı yolu izler: kontenjan ayrı modülde, ürün varyantına module link ile bağlı; sepete eklerken ve tamamlarken denetim; satır fiyatı sunucuda `unit_price` ile. Çekirdek değişmez.
- **Shopify** fiziksel/fiziksel değil ayrımını ürün düzeyinde yapar; rezervasyon uygulamaları tarihi varyant yapmaz (varyant sayısı patlar), takvimi ayrı tutar. Kayıttaki sektör sorusu yalnız öneri üretir, kilitlemez.
- **Tur sistemlerinin ortak modeli (OCTO standardı, Bókun, FareHarbor, Checkfront):** ürün → seçenek → fiyat kategorisi (yetişkin/çocuk/bebek; yaş aralığı, kaç kişi saydığı) ve ayrı bir **kalkış** kaydı (kapasite, kalan, satış kapanışı); rezervasyon süreli tutmayla başlar (15–60 dk), sonra onaylanır; katılımcı soruları; iptal kademeleri; voucher.
- **Fazla satışı önleme:** sayaç satırı + koşullu `UPDATE` + `CHECK` kısıtı; tekil kaynakta (belirli araç, belirli ev) `tstzrange` + `EXCLUDE USING GIST`.
- **Türkiye:** paket turu yalnız belgeli seyahat acentası satar; belge no ve unvan sitede gösterilir; Paket Tur Sözleşmeleri Yönetmeliği ön bilgilendirme ister, kalkışa 30 günden fazla varken fesihte kesinti (vergi/harç dışında) yapılamaz, iade 14 gün içinde; paket tur Mesafeli Sözleşmeler Yönetmeliği kapsamı dışındadır, belirli tarihli konaklama/araç/etkinlik hizmetinde cayma hakkı yoktur; kimlik fotokopisi toplamanın dayanağı yoktur (KVKK ilke kararı 2025).

## Karar

### 1. İlke: yetenek ürün düzeyinde, sektör paket düzeyinde

- Kurulumda mağazaya kalıcı bir "sektör modu" seçtirilmez. Yetenek **ürünün üzerinde** açılır; aynı mağaza tur da bavul da satabilir.
- Kod hiçbir yerde "tur", "otel", "araç" demez; "tarihli ürün", "kalkış", "katılımcı", "fiyat kategorisi" der.
- Sektör paketi (§12) yalnız veridir: bayrakları açar, şablon ve görünüm getirir.
- Bayraklar kapalıyken hiçbir mevcut davranış değişmez; yeni tablolar boş kalır, yeni rotalar 404/403 döner.

### 2. Ürün alanı: `booking_mode`

`product_extension`'a yeni alan (yeni anlam yeni alan; `kind` okuyan kod bozulmaz):

- `booking_mode: "none" | "departure" | "range"`, varsayılan `none`.
- `departure`: sabit başlangıçlı kalkışlar (tur, etkinlik, kurs, atölye). **Bu ADR'de yazılan mod.**
- `range`: müşterinin seçtiği tarih aralığı (konaklama, kiralama). Değer şimdiden ayrılır, **yazılmaz**; doğrulayıcı reddeder (§11).
- `booking_mode ≠ none` yalnız `kind = service` ile ve bayrak açıkken kaydedilir (`workflows/catalog/kind-rules.ts`).
- Bayrak: `catalog.booking` (varsayılan kapalı, mağazanın; `catalog.non_physical`'ı gerektirir).

### 3. `booking` modülü (yeni, çekirdeğe dokunmaz)

| Model | Ne tutar |
|---|---|
| `bookable` | Ürüne bağlı ayar (module link `product ↔ bookable`): mod, satış kapanışı (kalkıştan N saat önce), tutma süresi, asgari katılımcı, istenen katılımcı alanları, iptal kademeleri, saat dilimi |
| `booking_slot` | Bir kalkış: `starts_at`, `ends_at`, `capacity`, `sold`, `held`, `status (open, closed, cancelled)`, isteğe bağlı fiyat farkı. `CHECK (sold + held <= capacity)` |
| `booking_hold` | Sepetteki süreli tutma: `cart_id`, `expires_at`; satırları `booking_hold_slot (slot_id, units)` |
| `booking` | Onaylı rezervasyon: `order_id`, satır kimliği, `status (confirmed, cancelled, completed)`; satırları `booking_slot_use (slot_id, units)` |
| `booking_traveler` | Katılımcı (§7) |

- Tutma ve rezervasyonun slotla bağı **liste** olarak tutulur (tek kalkışta bir satır). Böylece ileride "üç gece = üç slot" aynı tablolarla çalışır; `range` modu için şema değişmez.
- **Kontenjanın sahibi `booking_slot` sayacıdır.** Tarihli ürünün varyantlarında Medusa `manage_inventory` kapalıdır; düşük stok ve "gelince haber ver" uyarıları bu ürünleri görmez; ön sipariş açılamaz.
- Sayaç değişimi tek komutla: `UPDATE booking_slot SET held = held + :n WHERE id = :id AND status = 'open' AND sold + held + :n <= capacity`; sıfır satır = yer yok. Birden çok slot aynı işlemde, kimlik sırasıyla.

### 4. Varyant = fiyat kategorisi, tarih değil

- Tarih başına varyant üretilmez (çok tarihli üründe varyant sayısı patlar, kişi tipleri ortak kontenjanı paylaşamaz).
- Varyantlar fiyat kategorisidir: "Yetişkin", "Çocuk", "Bebek" ya da mağazanın seçenekleri (ör. otel sınıfı × kişi tipi). Fiyat, para birimi, fiyat listesi, KDV ve kampanya Medusa'nın olağan yolundan gelir.
- Varyant başına `pax` (kaç kişi sayar; bebek 0, aile bileti 4 olabilir) ve isteğe bağlı yaş aralığı `bookable` ayarında tutulur.
- Kalkışa özel fiyat: slot üzerinde varyant başına isteğe bağlı fark ya da sabit tutar (sezon, erken kalkış). Satır fiyatı her zaman sunucuda hesaplanır.

### 5. Sepet ve fiyat

- Tarihli ürün olağan "sepete ekle" ile eklenemez (kanca reddeder). Kendi rotası: `POST /store/carts/:id/bookings` (`slot_id`, `items: [{ variant_id, quantity }]`); fiyat, tarih ve kontenjan istemciden alınmaz.
- İş akışı (ek seçenek deseni): sepet kilidi → slot açık mı, satış kapanışı geçmiş mi → koşullu `UPDATE` ile tutma → satırlar `unit_price` (sunucu) ve `metadata.qt_booking { hold_id, slot_id }` ile eklenir. Telafi: tutma geri alınır.
- Satır adedi ya da silme yine aynı modülden geçer; tutma buna göre güncellenir.
- **Tutma süresi** varsayılan 20 dk (ayar, 10–60). Ödeme başlatılırken (`read-checkout-cart`) en az 30 dk'ya, tamamlama doğrulamasında 15 dk daha uzatılır; bir tutma oluşturulmasından en çok 120 dk yaşar, yalnız tamamlama uzatması bu sınırı 15 dk aşabilir (Ek D3 güvenlik). Yönlendirmeli ödemede (iyzico, PayTR) dönüş bu süreleri aşarsa tamamlama `booking.hold_expired` der, sipariş açılmaz ve alınan ödeme sahipsiz ödeme kurtarmasıyla iade edilir.
- Süresi dolan tutmayı zamanlanmış iş siler ve sayacı düşürür; okuma `expires_at > now()` süzgeciyle yapılır, iş gecikse de kontenjan bloklanmaz.
- **Tamamlama:** `complete-cart-validate` zincirine `assertBookingLinesCurrent` (tutma geçerli, fiyat güncel, katılımcı bilgisi tam). Sipariş oluşunca `held → sold` aktarımı ve `booking` kaydı kilit altında, yinelenebilir (idempotent) bir iş akışında. Tutma zaten sayacın içinde olduğundan bu aktarım kontenjan yüzünden düşemez.
- Sipariş iptali ya da tam iade: `booking` iptal olur, `sold` düşer.

### 6. Kargosuz ödeme (genel düzeltme; dijital ve hizmet ürününe de yarar)

- Vitrin: adımlar sepetten türetilir. Kargo gerektiren kalem yoksa kargo adımı yoktur; adres adımı "fatura ve iletişim" kipine iner.
- Tema sözleşmesi: `CheckoutView`'a `steps: CheckoutStep[]` alanı (okuma varsayılanı bugünkü üç adım). Mevcut biçim yerinde yeniden çizilmez; tema listede olmayan adımı çizmez (adr/0066 K6).
- Backend `shipping_address.country_code` zorunluluğunu korur (KDV); kargosuz sepette fatura adresi teslimat adresine de yazılır.
- iyzico: kargosuz kalem `itemType: "VIRTUAL"`; PayTR sepeti aynı kalır. Kapıda ödeme kargosuz sepette zaten kapalı.
- Sipariş e-postası kargosuz siparişte kargo satırını ve teslimat adresi bloğunu çizmez.

### 7. Katılımcı bilgisi ve KVKK

- Ürün ayarı hangi alanların istendiğini söyler: yok / yalnız ad soyad / + doğum tarihi / + kimlik ya da pasaport no / + uyruk. **Kimlik görseli yükleme yoktur.**
- Ödemede "Katılımcılar" adımı (`steps`'te yeni değer `travelers`; yalnız gerektiğinde görünür). Kişi sayısı satırlardaki `pax` toplamından gelir.
- Saklama: `booking_traveler`; ad ve doğum tarihi düz, kimlik/pasaport no **şifreli + özet + son 4 hane** (adr/0009 deseni). Satır metadata'sına kişi verisi yazılmaz.
- Panelde kimlik no maskeli; tam değeri görmek yetkiye bağlı ve denetim kaydına düşer. Loglara, e-faturaya, ödeme sağlayıcısına, yapay zekâ servislerine gitmez.
- Saklama süresi: hizmet tarihinden sonra ayarlanabilir süre (varsayılanı hukukçuyla netleşir; açık soru), `compliance-retention` işi siler; silme talebi mevcut silme iş akışına bağlanır. `docs/kvkk-envanter.md` §1'e satır.

### 8. Sipariş yaşam döngüsü, iptal, bildirim

- `lifecycleOf`: tarihli satırı olan ödenmiş sipariş hizmet tarihine kadar **"planlandı"**, tarih geçince "tamamlandı". Kargosuz diğer ürünlerin bugünkü davranışı değişmez.
- **İptal kademeleri** `bookable` ayarında: "hizmet tarihine N gün ve daha fazla kala %X kesinti". Mağaza ayarında "paket tur satıyorum" işaretliyse alt sınır kodlanır: 30 gün ve daha fazla kala kesinti yapılamaz; iade süresi 14 gün olarak gösterilir.
- Müşteri hesabından iptal talebi; iade tutarını sunucu kademeden hesaplar, iade `order-refunds` yolundan yapılır. Tarihli üründe cayma metni buna göre yazılır.
- Mağazanın kalkışı iptal etmesi (asgari katılımcı sağlanamadı): slot `cancelled`, etkilenen rezervasyonlara tam iade ve bildirim; panel kaç rezervasyonun etkileneceğini önce gösterir.
- Bildirimler: rezervasyon onayı (tarih, buluşma yeri, katılımcı sayısı, iptal koşulları, PDF voucher), hatırlatma (ayar: N gün önce), kalkış iptali. Voucher rezervasyon başına tektir, doğrulama kodu taşır.

### 9. Panel

- Ürün detayında, `booking_mode ≠ none` iken "Tarihler ve kontenjan" kartı: kalkış ekle (tek tek ya da yinelenen: her cumartesi, şu aralıkta), kapasite, kapat/iptal, kalkış başına satılan/tutulan/kalan.
- "Rezervasyonlar" ekranı: kalkışa göre katılımcı listesi (yazdırılabilir, dışa aktarım yetkiye bağlı), takvim görünümü.
- Arayüz sade: temel ayarlar görünür, iptal kademeleri ve katılımcı alanları ikinci planda (hafıza: panel ayar dili).

### 10. Vitrin, tema sözleşmesi, SEO

- Ürün sayfası: `ProductPageView`'a isteğe bağlı `booking` görünümü (kalkışlar, kalan yer, kategori fiyatları) ve `ThemeActions.addBookingToCart?`. Tema yeteneği yoksa çizmez; `product_main` bugünkü biçimi değişmez (özellik, biçim değil). Takvimli ayrı iskelet istenirse yeni biçim olarak gelir.
- Sepette tutma süresi geri sayımı; süre dolunca satır "süresi doldu, yeniden seç" durumuna geçer.
- Liste ve kartlarda "…'dan itibaren" fiyatı ve en yakın kalkış.
- JSON-LD: `booking_mode = departure` üründe `Product` + `Offer` yanında `Event` ya da `TouristTrip` (pakete göre) üretimi; kargo ve iade alanları yazılmaz. Google Merchant beslemesi tarihli ürünü göndermez. Geçmiş kalkışı kalan ürün yayından kalkmaz, "yakında yeni tarihler" gösterir (SEO değeri korunur).
- Yapay zekâ işleri: ürün açıklaması, SSS ve SEO işlerinin veri okuyucusu tarihli üründe süre, kalkış yeri ve dahil olanlar niteliklerini de verir (ayrı PR; adr/0074 veri sınırı aynen).

### 11. Tarih aralığı modu (yazılmıyor; temel buna hazır)

- **Oda tipi × gece:** gece başına bir `booking_slot` (kapasite = o tipteki oda sayısı). Rezervasyon, aralıktaki her gecenin slotunu aynı işlemde düşer; biri yoksa hiçbiri tutulmaz. §3'teki tablolar ve §5'teki tutma aynen kullanılır.
- **Tekil kaynak (belirli araç, belirli ev):** ek tablo `booking_resource` + `booking_resource_use (resource_id, during tstzrange)` ve `EXCLUDE USING GIST`; bakım/hazırlık payı aralık genişletilerek.
- Fiyat: gece/gün başına birim fiyat × süre, sezon kuralları; yine sunucuda.
- Bu mod ayrı ADR'de ayrıntılanır; bu ADR yalnız şunları garanti eder: `booking_mode` değeri ayrılmıştır, slot ve tutma tabloları çok slotlu kullanıma göre kurulur, sepet rotası `slot_id` yanında ileride `from/to` alabilecek biçimde sürümlenir.

### 12. Sektör paketi ve kurulum

- Yeni paket `travel` (`packages/sector-packs/packs/travel`): `flags.json` (`catalog.non_physical`, `catalog.booking`), nitelik şablonu (süre, kalkış yeri, dahil olanlar, dahil olmayanlar, vize/pasaport notu), örnek kategoriler, hazır görünüm, iptal koşulları sayfa şablonu.
- Paket şemasına küçük ek: `catalog.json` ile yeni ürünün varsayılan türü (`kind`, `booking_mode`). Eklemeli; mevcut paketler etkilenmez.
- Üst panel sihirbazındaki paket seçimi bugünkü gibi kalır; paket sonradan panelden de uygulanabilir. Paket uygulanmamış mağaza bayrağı elle açarak aynı yeteneği kullanır.
- Mağaza profili: "yasal belge satırı" (belge adı, numarası, unvan; ör. seyahat acentası işletme belgesi). Dolu ise vitrin alt bilgisinde ve ödeme sayfasında gösterilir. Sektöre özel değil, serbest etiketli alan.

### 13. Güvenlik

- Fiyat, tarih, kontenjan, kişi sayısı sunucuda (altın kural 5). `qt_booking` yalnız sunucu yazar.
- Fazla satış: koşullu `UPDATE` + `CHECK`; sepet ve slot işlemleri kilit altında; eşzamanlılık testi zorunlu.
- Tutma kötüye kullanımı: sepet başına ve IP başına hız sınırı (mevcut `lib/security`), tek sepetin tutabileceği en çok birim (ayar).
- Katılımcı verisi §7; voucher doğrulama kodu tahmin edilemez, kişi verisi taşımaz.
- Ödeme, migration ve KVKK dokunan her dilim birleşmeden önce `security-reviewer`.

## Dilimler

| # | Dilim | Not |
|---|---|---|
| D1 | Kargosuz vitrin ödemesi (§6) | Genel düzeltme; `catalog.non_physical` açık mağazalara hemen yarar. Ödeme dokunur → güvenlik incelemesi |
| D2 | `booking` modülü: modeller, migration, sayaç, tutma, süre işi, bayrak, `booking_mode` (§2, §3) | Yalnız backend; eşzamanlılık testleri |
| D3 | Sepet rotası, sunucu fiyatı, tamamlama doğrulaması, `held → sold`, iptalde geri verme (§4, §5) | Fiyat ve ödeme yolu → güvenlik incelemesi |
| D4 | Panel: tarihler ve kontenjan kartı, rezervasyon listesi (§9) | |
| D5 | Vitrin ve tema sözleşmesi: kalkış seçimi, kategori adetleri, sepette geri sayım (§10) | Görünüm kilidi testi hakem |
| D6 | Katılımcı bilgisi: şifreli saklama, ödeme adımı, panel, saklama süresi (§7) | KVKK → güvenlik incelemesi; envanter güncellenir |
| D7 | Yaşam döngüsü "planlandı", iptal kademeleri, onay/hatırlatma e-postası, voucher (§8) | |
| D8 | `travel` paketi, yasal belge satırı, JSON-LD, yapay zekâ veri okuyucusu (§10, §12) | |

D1–D3 bitince tur, yönetici API'siyle tanımlanıp vitrinden uçtan uca satılabilir; D4–D8 deneyimi tamamlar. Sıra tek tek, her dilim ayrı PR.

**Sonraya (ayrı ADR):** kapora ve bakiye tahsilatı (kısmi ödeme, bakiye bağlantısı, vadesinde ödenmezse iptal; sağlayıcıların ön provizyon desteği doğrulanacak), oda dağılımı ve tek kişi farkı, kalkışa bağlı ek hizmetler (mevcut ek seçenekler üzerine), tarih aralığı modu (§11), ön bilgilendirme broşürü ve sözleşme PDF'i, dış sistemlerle eşitleme (OCTO), "sizi arayalım" talep formu.

## Karar listesi (K)

- **K1** Sektör modu yok; yetenek ürün alanı (`booking_mode`) ve bayrakla açılır, sektör paketi yalnız veridir.
- **K2** Kontenjanın sahibi `booking` modülünün sayaç satırıdır; Medusa envanteri tarihli üründe kullanılmaz.
- **K3** Varyant fiyat kategorisidir; tarih varyant değildir.
- **K4** Tutma ve rezervasyon slot **listesine** bağlanır; tarih aralığı modu aynı tablolarla çalışır.
- **K5** Sepette süreli tutma vardır (varsayılan 20 dk); ödeme sırasında uzar.
- **K6** Tarihli satır yalnız kendi rotasıyla eklenir; fiyat ve tarih istemciden alınmaz.
- **K7** Kargosuz ödeme tema sözleşmesine `steps` alanıyla gelir; mevcut biçim yeniden çizilmez.
- **K8** Katılımcı kimlik verisi ayrı şifreli tabloda; görsel yükleme yok; satır metadata'sında kişi verisi yok.
- **K9** "Paket tur satıyorum" işaretli mağazada 30 gün kuralı alt sınır olarak kodlanır; kademeler onun üstünde ayardır.
- **K10** İlk sürüm tam ödemedir; kapora ayrı ADR.
- **K11** Bayraklar kapalıyken mevcut mağazalarda hiçbir davranış değişmez; her dilim bunu testle gösterir.

## Alternatifler

- **Tarih = varyant, kontenjan = Medusa envanteri** (Medusa bilet örneğindeki yol). Reddedildi: çok tarihli üründe varyant patlar; kişi tipleri ortak kontenjanı paylaşamaz; sepette tutma yine yazılmak zorunda; stok uyarıları gürültü üretir; tarih aralığına hiç taşınmaz.
- **Ayrı "turizm" uygulaması ya da sektöre özel kurulum.** Reddedildi: "hiçbir kod sektöre özel yazılmaz" kuralına aykırı; karışık mağazayı engeller; bilet, kurs, kiralama için yeniden yazım gerekir.
- **Tur ve kiralama için baştan tek genel "kaynak + aralık" motoru.** Ertelendi: tekil kaynak kısıtı ve gece fiyatı bugün ihtiyaç değil; sayaç modeli hem kalkışı hem oda tipi × geceyi karşılar, tekil kaynak eklenebilir bir tablodur (§11).
- **Hazır rezervasyon hizmetini gömmek (dış widget).** Reddedildi: ödeme, fatura, SEO ve müşteri kaydı platformun dışına çıkar; platformun değer önerisiyle çelişir.
- **Yolcu bilgisini sipariş notunda toplamak.** Reddedildi: düz metin kimlik verisi, saklama süresi ve silme uygulanamaz.

## Sonuçlar

- Platform fiziksel ürünün yanında tarihli hizmet satabilir; tur, etkinlik, kurs ve atölye aynı yeteneği kullanır, konaklama ve kiralama aynı temele eklenir.
- Yeni bir modül, bir ürün alanı, bir bayrak, tema sözleşmesinde iki isteğe bağlı ek gelir; Medusa çekirdeği ve mevcut mağazaların akışı değişmez.
- Süreli tutma yeni bir zamanlanmış iş ve yeni bir hata sınıfı ("süresi doldu") getirir; vitrin bunu göstermek zorundadır.
- Kimlik verisi işlemek yeni bir KVKK yükümlülüğüdür; envanter, saklama süresi ve yetki ayrımı D6'da birlikte gelir.

### Açık sorular (kod dışı, sahiple ve danışmanlarla)

- Paket turda KDV ve fatura kurgusu (yurt dışı hizmet payı, aracılık durumunda matrah): mali müşavir.
- Katılımcı kimlik verisinin saklama süresi ve paket tur ön bilgilendirme/sözleşme metinleri: hukukçu.
- Zorunlu paket tur sigortası poliçesinin müşteriye iletimi (voucher ekinde mi): acentayla.
- Kapora için iyzico ve PayTR'nin ön provizyon ya da sonradan tahsilat desteği: sağlayıcılarla (kapora ADR'sinden önce).
- İlk müşteri acentanın gerçek ürün yapısı (oda dağılımı, ek turlar, çocuk yaş sınırları): D4 öncesi görüşme.

## Ek 2026-11-22 (D2 uygulama notları)

- **Alanlar.** `product_extension.booking_mode` (`none | departure | range`, varsayılan `none`). `bookable`: `product_id` (tekil) + `product ↔ bookable` bağı, `mode`, `cutoff_hours`, `hold_minutes` (10–60, varsayılan 20, CHECK), `max_units_per_cart` (§13'teki "tek sepetin en çok birimi", varsayılan 20), `min_participants`, `traveler_fields` (`{ level: none | name | birth_date | identity | nationality }`, varsayılan `none`), `cancellation_tiers` (`[{ days_before, fee_percent }]`, en çok 10), `pax_by_variant` (`variant_id → { pax, min_age?, max_age? }`; listede olmayan varyant 1 yer sayar), `timezone` (varsayılan `Europe/Istanbul`). Şekiller `lib/booking/settings.ts`. `booking_slot.price_adjustments` kuruş tutulur, API lira alır/verir.
- **Kontenjan.** Sayaç değişimleri modül servisinde ham, bağlı (`?`) SQL, her çağrı tek işlem: `holdUnits` (verilen slotların adedini **ayarlar**, 0 bırakır, adı geçmeyen slot korunur; aynı slot iki kez gelirse toplanır), `releaseHold`, `extendHold` (süresi dolmuşu diriltmez, kısaltmaz), `confirmHold` (`booking.hold_id` tekil: aynı tutma ikinci kez = aynı kayıt, değişiklik yok; başka sipariş = `booking.hold_used`), `cancelBooking` (yalnız `confirmed`), `releaseExpiredHolds`, `updateSlot` (sayaçlara dokunmaz). Slot, tutma ve rezervasyon tablolarının üretilmiş yazıcıları (`create/update/delete/softDelete/restore` …`BookingSlots`, `BookingHolds`, `BookingHoldSlots`, `Bookings`, `BookingSlotUses`) serviste ezilir ve `not_allowed` fırlatır; slot `createSlots` ile (`sold = held = 0`) açılır, telafide yalnız boş slot silinir (`deleteEmptySlots`). Kilit sırası her yerde aynı: önce tutma satırları (sepetin kendi tutması beklenir; başkalarının süresi dolmuş tutmaları `SKIP LOCKED`), sonra değişikliğin dokunduğu bütün slotlar (istenenler ∪ bırakılacak tutmaların slotları) tek `ORDER BY id FOR UPDATE` ile; slot kilidinden sonra tutma kilidi alınmaz. Süpürme işi, `confirmHold`, `releaseHold` aynı sırada (tutma → slotlar kimlik sırasıyla). Sepetin süresi dolmuş tutması diriltilmez: yerleri geri verilir, yeni tutma açılır. Bir tutma, kaç kez uzatılırsa uzatılsın, açılışından en çok 120 dk yaşar (`HOLD_LIFETIME_MINUTES`; `hold_minutes`'tan bağımsız). Tablo kısıtları: `sold + held <= capacity`, `sold >= 0 AND held >= 0`, birim `> 0`.
- **Süresi dolan tutma.** Okuma (`available`) süresi dolmuş tutmaları saymaz; aynı slota yeni tutma ve kapasite değişikliği önce o slottaki süresi dolmuşları serbest bırakır; `booking-hold-expiry` işi her dakika kalanları süpürür.
- **Tür değişince.** Tarihli ürün başka türe ancak aynı kayıtta `booking_mode: "none"` gönderilerek geçer; yoksa `catalog.booking_kind` (kalkışlar ve rezervasyonlar sessizce düşmesin). `none`'a dönmek bayrak istemez; varyantların stok takibi kendiliğinden geri açılmaz (mağaza seçer).
- **Varyantlar.** Ürün `departure`'a geçerken varyantlarda `manage_inventory` ve `allow_backorder` kapatılır; sonradan eklenen ya da stok takibi açılan varyant, varyant kancalarında ve ürün güncelleme kancasında (`productsUpdated`, varyantlarıyla kaydedilen ürün) geri kapatılır. "Gelince haber ver" kaydı stok takibi kapalı varyantı zaten kabul etmez; düşük stok uyarısı stok hareketiyle tetiklenir ve takipsiz varyantta hareket olmaz. Panel ana sayfasındaki düşük stok sayısı envanter kalemlerinden okunur; türü değişmeden önce kalan eski kalemler sayılabilir (genel durum, bu dilimde değişmedi).
- **Bayrak.** `catalog.booking` (mağazanın, kapalı). `catalog.non_physical` bağımlılığı kayıt anında denetlenir: `booking_mode ≠ none` yapmak iki bayrağı da ister (`catalog.booking_disabled`). Admin rotaları yalnız `catalog.booking` arkasında; kapalıyken 404.
- **Admin API.** `GET/POST /admin/products/:id/bookable`, `GET/POST /admin/products/:id/booking-slots` (tek seferde en çok 100 kalkış; ayar satırı yoksa varsayılanlarla açılır), `POST /admin/booking-slots/:id`. Yazma sahibin ve yöneticinin (personel kuralının varsayılanı), okuma her rolün. Denetim kaydı `api/http/audit/resources/booking.ts`. Kısıtlı pakette `/admin/booking-slots*` kapalı alan.
- **Hata anahtarları.** `catalog.booking_disabled`, `catalog.booking_kind`, `catalog.booking_range_unavailable`, `booking.product_not_dated`, `booking.variant_unknown`, `booking.slot_unknown`, `booking.slot_full` (409), `booking.slot_closed` (409), `booking.slot_dates_invalid`, `booking.capacity_below_sold`, `booking.units_invalid`, `booking.hold_minutes_invalid`, `booking.hold_missing` (409), `booking.hold_used` (409), `booking.unknown`, `booking.cancellation_tiers_invalid`, `booking.pax_ages_invalid`, `booking.pax_invalid`, `booking.timezone_invalid`, `booking.price_adjustment_invalid`.

## Ek 2026-11-22 (D3 uygulama notları)

- **Olağan rota kapalı.** Tarihli ürünün varyantı `addToCartWorkflow.hooks.validate` ve `createCartWorkflow.hooks.validate` (sepet kalemlerle açılırken) ile reddedilir: `booking.use_booking_route`. Geçen tek satır `metadata.qt_booking` taşıyandır; `qt_` vitrinden yazılamaz (`cart.metadata_reserved`), yalnız rezervasyon rotası yazar. Tarihli satırda çekirdek satır rotasına `POST` (adet, metadata) reddedilir (`booking.use_booking_route`); ek seçenek rotası da tarihli satırı reddeder (kalkışa bağlı ek hizmetler sonraya). Silme (`DELETE`) açıktır: `cart.updated` aboneliği (`subscribers/booking-cart-sync.ts`) sepet kilidi altında tutmayı kalan satırlara indirir; yalnız geri verir, hiç almaz. Abonelik bayrak kapalıyken bir şey okumaz.
- **Rota.** `POST /store/carts/:id/bookings` (`slot_id`, `items: [{ variant_id, quantity 1–100 }]` 1–20, `.strict()`; fiyat/tarih/kişi alanı 400) ve `DELETE /store/carts/:id/bookings/:slot_id`. İkisi de `catalog.booking` arkasında (kapalı: 404), `booking` hız profiliyle IP ve sepet başına (bkz. güvenlik eki). İstek, o kalkışın sepetteki satırlarının **tamamını** söyler: aynı kalkış için ikinci istek eski satırları silip yenilerini ekler (Medusa'nın satır silme ve ekleme iş akışları iç içe, kilitsiz koşar). Sıra: sepet kilidi → plan (sepet bu vitrinin ve açık; kalkış yayımlanmış, tarihli, sepetin kanalındaki ürünün; açık; satış kapanışı geçmemiş [`booking.sales_closed`, 409]; varyantlar ürünün; birim = Σ adet × pax ≥ 1; aynı ürünün sepetteki diğer kalkışlarıyla toplam ≤ `max_units_per_cart` [`booking.max_units`]) → `holdUnits` → eski satırlar silinir → yeni satırlar eklenir. Telafi: kalkışın tutması eski adedine döner (o arada başkası yeri aldıysa günlüğe yazılır; süpürme işi kalanı temizler). Yanıt: `booking { slot_id, units }`, `hold { expires_at } | null` (geri sayım), tarihli satırlar, `shipping_method_stale`.
- **Fiyat.** Satır `unit_price` = varyantın sepetin fiyatlandırma bağlamındaki fiyatı (para birimi, bölge, müşteri grubu fiyat listesi, adet basamağı; ek seçeneklerin `variantPrice` yolu) + kalkışın `price_adjustments[variant]` farkı, **0'ın altına inmez**. Fark kuruş ve Türk lirası olarak tutulur: TRY dışı sepette fark sıfırsa olağan fiyat, sıfır değilse istek reddedilir (`booking.currency_unsupported`; yanlış fiyatla satmaktansa). Fiyat listesi varsa `compare_at_unit_price` aynı farkla yazılır. Fiyatı olmayan varyant: `booking.price_unavailable`.
- **Satır kaydı.** `metadata.qt_booking { hold_id, slot_id, starts_at, pax }`; kişi verisi yok. Tutma sepet başına tektir; süresi dolmuş tutma yeniden açılınca diğer kalkışların satırları eski `hold_id`'yi taşır ve ödeme/tamamlama `booking.hold_expired` der: vitrin o kalkışı yeniden seçtirir (D5).
- **Ödeme başlangıcı** (`read-checkout-cart`, sepet kilidi altında): tutma satırlara indirilir, `extendHold(30 dk)` (`PAYMENT_HOLD_MINUTES`; 120 dk mutlak sınır içinde) — tutma yoksa ya da bitmişse `booking.hold_expired` (409), ödeme başlamaz — sonra tamamlamadaki denetim aynen koşar.
- **Tamamlama** (`complete-cart-validate` → `assertBookingLinesCurrent`): bayrak kapalıyken tarihli satır `catalog.booking_disabled`; tutma canlı ve her satırın `hold_id`'si o (`booking.hold_expired`, 409); tutma kalkış kalkış tam olarak satırların birimini tutuyor (`booking.hold_mismatch`, 409); kalkış açık ve satışı kapanmamış; fiyat yeniden hesaplanınca aynı (`booking.price_changed`, 409). Geçerse tutma 15 dk uzatılır (`COMPLETION_HOLD_MINUTES`), sipariş onayı bulsun diye. Ödeme-tutar eşleşmesi mevcut `paymentMismatch`.
- **`held → sold`.** `order.placed` aboneliği (`subscribers/booking-orders.ts`; tamamlama kancası `orderCreated` sadakat eklentisinde) sipariş kilidi altında `confirmHold(hold_id, order_id, ilk tarihli sipariş satırı)`. Yinelenebilir: siparişin rezervasyonu varsa bir şey yapmaz. Tutma bulunamazsa (beklenmez: tamamlamada canlıydı ve uzatıldı) yerler sipariş anahtarıyla (`order:<id>`) yeniden tutulup onaylanır (`booking.confirm_retaken`, uyarı); yer kalmamışsa **sipariş durmaz**, `booking.confirm_failed` hata günlüğüne düşer (hata izleyicinin alarmı) ve mağaza elle çözer. Bir tutma birden çok kalkış taşıyabilir: tek `booking`, kalkış başına `booking_slot_use`; `line_item_id` ilk tarihli satırdır, diğer satırlar aynı `qt_booking` kaydıyla bulunur.
- **İptal.** `order.canceled` → siparişin `confirmed` rezervasyonları `cancelBooking` (yinelenebilir), `sold` düşer. Tam/kısmi iade ve iptal kademeleri D7'de (bu dilimde yalnız sipariş iptali).
- **Kargo yöntemi (D1 takibi).** Sepette fiziksel kalem kalmadığında kargo yöntemi sunucuda silinmez (ödeme tahsilatını ve mevcut kancaları değiştirmemek için); rezervasyon yanıtı `shipping_method_stale: true` döner, vitrin D5'te uyarır ya da yöntemi kaldırır.
- **Vitrin okuması.** `GET /store/products/:id/booking?region_id=` (bayrak arkasında, `Cache-Control: public, max-age=15`): yayımlanmış tarihli ürünün kategorileri (`variant_id`, `title`, `pax`, `min_age`, `max_age`), şimdiden sonraki en çok 100 kalkış (`starts_at`, `ends_at`, `status: open | closed` [satış kapanışı geçmiş ya da kapalı: `closed`, `available: 0`; iptal edilen listelenmez], `available` [süresi dolmuş tutmalar sayılmaz], kategori fiyatları sunucuda hesaplanmış, misafir fiyatı). Kişi verisi yok.
- **Modül.** `confirmHold`'a isteğe bağlı `lineItemId`; okuma `cartHold(cart_id)` (tutma, canlı mı, kalkış başına birim).
- **Yeni hata anahtarları.** `booking.use_booking_route`, `booking.sales_closed` (409), `booking.max_units`, `booking.currency_unsupported`, `booking.price_unavailable`, `booking.hold_expired` (409), `booking.hold_mismatch` (409), `booking.price_changed` (409), `booking.region_unknown`.

## Ek 2026-11-22 (D3 güvenlik incelemesi, PR #264)

- **KDV dahil bayrağı (O1).** Tarihli satır `unit_price` ile birlikte `is_tax_inclusive`'i açıkça taşır: varyantın sepet bağlamındaki fiyatının `calculated_price.is_calculated_price_tax_inclusive` değeri (`variantPrice`). Medusa 2.21.2 özel fiyatlı satırda bu bayrağı zaten hesaplanan fiyattan doldurur (`get-variants-and-items-with-prices`: `item.is_tax_inclusive ?? calculatedPriceSet.is_calculated_price_tax_inclusive`); açık yazmak bu iç davranışa bağlı kalmamak içindir. Tamamlama ve ödeme başlangıcı bayrağı da karşılaştırır: farklıysa `booking.price_changed`.
- **Sipariş düzenleme (O2).** Panelden sipariş düzenlemede `qt_booking` taşıyan satırın adedi değiştirilemez, satır kaldırılamaz; tarihli ürünün varyantı eklenemez: `booking.order_edit_unavailable`. Yer yalnız tüm siparişin iptaliyle geri verilir. İade, değişim ve talep (claim) yolları D7'de ele alınır; o zamana kadar tarihli siparişte bunlar kontenjanı değiştirmez.
- **Düz tarihli kalem (O3).** Ürün tarihliye geçmeden önce sepete olağan yoldan eklenmiş varyant, ödeme başlangıcında ve tamamlamada `booking.use_booking_route` ile reddedilir (sepet satırları için tek sorgu).
- **Tamamlama payı (O4).** Tutmanın 120 dk mutlak ömrünü yalnız tamamlama uzatması 15 dk aşabilir (`COMPLETION_GRACE_MINUTES`; `extendHold(..., { completion: true })`); diğer her uzatma ve değişiklik 120 dk'da kalır. Yer bulunamadığında (`booking.confirm_failed`) günlük kaydına ek olarak panel zilinde uyarı çıkar (`booking.confirm_failed`, herkese açık uyarı; yalnız sipariş numarası). Tarihli satırın tamamlamadaki her reddi (`booking.*`, `catalog.booking_disabled`) ödemesi alınmış sepette "sepet kuralı" sayılır: sipariş açılmaz, ödeme sahipsiz ödeme kurtarmasıyla iade edilir (`lib/payments/completion.ts`).
- **Tutma istifi (O5).** Bir sepet bir kalkışta en çok `min(max_units_per_cart, max(min(kapasite, 10), ceil(kapasite × 0,2)))` birim tutabilir (`CART_SHARE_OF_CAPACITY = 0.2`, `CART_GROUP_FLOOR = 10`, sabit; aşılırsa `booking.max_units` ve izin verilen sayı). Taban 10: bir aile ya da küçük grup kalkışın büyüklüğünden bağımsız birlikte rezervasyon yapabilir (10 kişilik turun tamamı tek sepette alınabilir; büyük kalkışta beşte bir geçerli). Gerekirse ileride ürün ayarı olur. IP başına canlı tutma sınırı bu PR'da yazılmadı (hız sınırı deposu birim sayamaz; tutmaya IP yazmak kişisel veri ve migration demekti); takip PR'ında tutmaya IP'nin anahtarlı özetiyle eklendi (bkz. Ek takip M1). Bu PR'da sepet payı + ayrı `booking` hız profili (IP başına 10 dk'da 30, sepet başına dakikada 20 ve tüm IP'lerden 10 dk'da 40 istek): bir IP 10 dk'da en çok 30 sepet × pay kadar yer tutabilir ve her tutma ödeme başlamadıkça `hold_minutes` (en çok 60 dk) sonra düşer.
- **İptal ve onay sırası (D1).** İptal aboneliği de `booking:order:<id>` kilidini alır; onay, sipariş `canceled` ise onaylamaz, tutmayı bırakır.
- **Adet sınırları (D2).** Birleştirme sonrası kategori başına en çok 100 (`booking.quantity_too_high`); yer tutmayan birimler (pax 0) yer tutan birim başına en çok 2 (`booking.too_many_free_units`).
- **Hız profili (D3).** Rezervasyon rotaları ödemenin `checkout` bütçesini değil kendi `booking` profilini harcar.
- **Yeni hata anahtarları.** `booking.order_edit_unavailable`, `booking.quantity_too_high`, `booking.too_many_free_units`.

## Ek 2026-11-22 (takip: M1, L1, L2)

- **IP başına canlı tutma sınırı (M1).** `booking_hold.client_hash`: ziyaretçinin IP kovasının (hız sınırıyla aynı; IPv6 /64) `PII_HASH_KEY` ile anahtarlı özeti (`hashPii`, amaç `booking.client`, 32 karakter); ham IP tutulmaz, IP bilinmiyorsa boş ve sınırsız. Yalnız vitrin rezervasyon rotası (`POST /store/carts/:id/bookings`) adresi verir; tutmayı yalnız indiren yollar (sepet eşitleme, ödeme başlangıcı, telafi, sipariş onayında yeniden tutma) sınıra takılmaz ve etiketi değiştirmez. `holdUnits` önce adresin danışma kilidini (`pg_advisory_xact_lock(hashtext('booking:client:<özet>'))`) alır, sonra tutma satırı ve slotlar (kilit sırası: adres kilidi → tutma satırları → slotlar `ORDER BY id FOR UPDATE`); aynı adresin eşzamanlı sepetleri sırayla sayılır. Red (`booking.client_share`, 400, `max`: bu kalkışa en çok kaç birim seçilebilir): aynı adresin süresi dolmamış tutmaları bir kalkışta sepet payını (`cartShareOf`, O5) ya da tüm kalkışlarda toplam 60 birimi (`CLIENT_LIVE_UNITS`) aşacaksa. Sepetin kendi canlı tutması adresin sayılır; yalnız artırma reddedilir. Süresi dolmuş tutma sayılmaz. KVKK: `docs/kvkk-envanter.md` (özet tutmayla silinir; en çok 120 dk + 15 dk).
- **Kalkış yok olunca iade (L1).** Tamamlamada `booking.slot_unknown` Medusa `NOT_FOUND` olarak gelir (vitrine 404 gerektiği için) ve `safeMessage` taşımaz; `completionFailureOf` artık `NOT_FOUND` türündeki `booking.<anahtar>` iletisini de sepet kuralı sayar: ödeme sahipsiz ödeme kurtarmasıyla iade edilir, sonsuz yeniden deneme olmaz. Diğer `NOT_FOUND`'lar (`cart.unknown`, Medusa'nın kendi iletileri) değişmedi.
- **Sipariş eşitleme uzlaştırması (L2).** `jobs/booking-reconcile.ts` (10 dk'da bir, `workflows/booking/reconcile.ts`): (a) son 48 saatte açılmış, en az 5 dk'lık, iptal edilmemiş, taslak olmayan, `qt_booking` satırı taşıyan ve `booking` kaydı olmayan siparişler → `confirmOrderBookingsWorkflow`; yer bulunamadığı için zili zaten çalmış (`booking.confirm_failed` bildirimi olan) sipariş atlanır, mağaza elle çözer; (b) iptal edilmiş siparişin `confirmed` rezervasyonları → `cancelOrderBookingsWorkflow`. Her taraf bir sayfa (50); olaylarla aynı sipariş kilidi ve yinelenebilir iş akışları, kilidi meşgul sipariş sayılıp sonraki koşuya kalır. Günlük yalnız sayı (tekil hata yalnız sipariş kimliğiyle).
- **Yeni hata anahtarı.** `booking.client_share`.
