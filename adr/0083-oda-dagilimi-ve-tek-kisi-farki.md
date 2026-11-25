# ADR-0083: Tarihli üründe oda dağılımı ve tek kişi farkı

- **Durum:** Kabul (sahip, 2026-11-25: "soruları kendin cevapla, devam et"; aşağıdaki öneriler karar oldu). T1 basit yol ve ürün ayarıyla açılan oda oda seçim, T2 tek tutar, T3 çocuk fiyatı için odada en az iki tam ücretli kişi (ayar), T4 ilk sürümde oda sınırı yok, T5 ilk sürümde oda arkadaşı yok. Hukukçu ya da mali müşavir doğrulaması isteyen maddeler doğrulanana kadar yazılı varsayılanla yürür; her dilim kendi PR'ında `security-reviewer` incelemesinden geçer.
- **Tarih:** 2026-11-25
- **İlgili:** adr/0076 (tarihli ürün; K3 "varyant fiyat kategorisidir", §7 katılımcı), adr/0052 (sunucu fiyatlı satır deseni), adr/0010 (kuruş), adr/0066 (tema sözleşmesi, biçim sözleşmesi), adr/0077 (kart fiyatı), adr/0082 (kapora), adr/0084 (tarih aralığı kipi), docs/kvkk-envanter.md
- **Dayanak:** adr/0076 "Sonraya" satırı (oda dağılımı ve tek kişi farkı) ve açık sorusu (ilk müşteri acentanın gerçek ürün yapısı: oda dağılımı, çocuk yaş sınırları). Konaklamalı turun fiyatı "iki kişilik odada kişi başı" verilir; tek gelen fark öder, çocuk indirimi çoğu zaman iki yetişkinle aynı odada geçerlidir.

## Kararlar (sahip, 2026-11-25; "Önerim" sütunu karardır)

Kısa liste; seçenekler ve gerekçe hemen altında. İkili tercihler **ayar** olarak gelir.

| # | Karar | Önerim |
|---|---|---|
| T1 | Müşteri odayı nasıl seçer | İki yol da olsun: basit yol (oda tipi bir fiyat kategorisidir, bugün de çalışır) ve ürün ayarıyla açılan "oda oda seçim" (varsayılan kapalı) |
| T2 | Tek kişi farkı nasıl girilir | Tek bir tutar olarak (ör. +2.500 TL); kalkışa özel fark ikinci planda |
| T3 | Çocuk ve üçüncü kişi kuralı | "Çocuk fiyatı iki tam ücretli kişiyle aynı odada geçerli" ayarı (varsayılan açık); üçüncü yetişkin indirimi ikinci planda; yaş kalkış gününe göre |
| T4 | Oda sayısı sınırı | İlk sürümde yok (yalnız kişi kontenjanı); sonra "kalkış başına en çok N tek kişilik oda" ayarı. Tam oda envanteri yapılmaz |
| T5 | Oda arkadaşı (paylaşımlı oda) | İlk sürümde yok; sonraki dilimde "Oda paylaşmak istiyorum" işareti, aç/kapa, varsayılan kapalı. Otomatik eşleştirme yapılmaz |

### T1. Müşteri odayı nasıl seçer

- **A. Basit yol: oda tipi bir fiyat kategorisi.** Mağaza kategorileri "Yetişkin (iki kişilik odada)", "Yetişkin (tek kişilik odada)", "Çocuk (2–12)" diye açar; müşteri adet seçer. Bugün kod yazmadan çalışır. Risk: sistem dağılımı denetlemez (tek kişi "iki kişilik odada" fiyatını seçebilir); oda listesi çıkmaz, mağaza müşteriyle teyitleşir.
- **B. Oda oda seçim.** Müşteri "1. oda: 2 yetişkin + 1 çocuk (7 yaş); 2. oda: 1 yetişkin" girer; fiyatı ve farkı sunucu hesaplar, mağaza hazır oda listesi alır. Risk: yeni fiyat yolu ve yeni vitrin arayüzü.
- **C. Yalnız B.** Küçük mağazayı ayrıntıya zorlar.
- **Önerim: A ve B.** A için yalnız küçük kolaylıklar yapılır (kategori şablonu, fiyat notu). B ürünün rezervasyon ayarında "Oda dağılımı sor" anahtarıyla açılır, varsayılan kapalı.

### T2. Tek kişi farkı nasıl girilir

- **A. Tek tutar.** "Tek kişi farkı: 2.500 TL". Sektörün fiyat tablosundaki dil; mağaza tek sayı girer, kuruş yuvarlaması olmaz.
- **B. Yüzde.** Fiyat değişince fark kendiliğinden değişir; yuvarlama ve "neyin yüzdesi" sorusu doğar (kampanyalı fiyat mı, liste fiyatı mı).
- **C. Her oda tipi için ayrı tam fiyat.** En esnek; kategori sayısı çarpılır (kişi tipi × oda tipi), panel kalabalıklaşır. T1 A zaten budur.
- **Önerim: A.** Kalkışa özel fark (sezon) ikinci planda; boşsa ürünün farkı geçerli.

### T3. Çocuk ve üçüncü kişi

- **A. Yalnız yaş kategorisi** (bugünkü): çocuk her durumda çocuk fiyatı öder. Risk: tek yetişkin + çocuk iki kişilik odayı yarı fiyata kapatır.
- **B. Çocuk fiyatı koşullu.** Çocuk kategorisi yalnız odada en az iki tam ücretli kişi varsa geçerli; değilse çocuk tam ücretli sayılır ve müşteri bunu fiyat dökümünde görür.
- **C. Koşul sağlanmıyorsa reddet.** Müşteri neden ekleyemediğini anlamaz; satış kaçar.
- **Önerim: B, ayar olarak** ("Çocuk fiyatı için odada en az [2] tam ücretli kişi", varsayılan 2; 0 = koşul yok). Üçüncü yetişkin indirimi tutar olarak ikinci planda (varsayılan 0). Çocuğun yaşı **hizmetin başladığı güne** göre hesaplanır (Jolly Tur'da "otele giriş tarihindeki yaş"; ilk müşteri acentanın uygulaması ayrıca sorulur).

### T4. Oda sayısı sınırı

- **A. Sınır yok, yalnız kişi kontenjanı.** Bugünkü sayaç yeter; mağaza tek kişilik oda bulamazsa müşteriyle çözer.
- **B. Kalkış başına en çok N tek kişilik oda.** Tek kişilik oda otellerde kıttır; sınır dolunca tek kişi seçeneği kapanır. Yeni bir sayaç gerekir.
- **C. Oda tipi başına tam envanter.** Otel sözleşmesindeki dağılımı birebir tutar; panel ağırlaşır, çoğu acenta bu ayrıntıyı sistemde tutmaz.
- **Önerim: A ile başla, B sonraki dilim (ayar, varsayılan boş = sınırsız), C yapılmaz.**

### T5. Oda arkadaşı

- **A. Yok.** Tek gelen fark öder.
- **B. "Oda paylaşmak istiyorum" işareti.** Müşteri fark ödemez; mağaza aynı kalkıştaki başka bir tek yolcuyla eşleştirir. Risk: eş çıkmazsa farkı mağaza üstlenir ya da müşteriden sonradan ister (adr/0082'nin bakiye altyapısı gerekir); eşleştirme için cinsiyet bilgisi gerekebilir (yeni kişi verisi).
- **C. Sistem kendiliğinden eşleştirir.** Yanlış eşleştirmenin bedeli yüksek; işletme kararıdır.
- **Önerim: ilk sürümde A; B sonraki dilimde aç/kapa, varsayılan kapalı; C yapılmaz.**

## Bağlam

### Kodda bugün olan (2026-11-25 `dev`, okundu)

- **Varyant fiyat kategorisidir** (adr/0076 K3): "Yetişkin", "Çocuk", "Bebek" ya da mağazanın seçenekleri. Kategori başına `pax` (kaç yer tutar) ve isteğe bağlı yaş aralığı `bookable.pax_by_variant`'ta (`variant_id → { pax, min_age?, max_age? }`). Yaş aralığı bugün yalnız bilgi olarak gösterilir; denetlenmez.
- **Satır fiyatı sunucudadır:** varyantın sepet bağlamındaki fiyatı + kalkışın `price_adjustments[variant]` farkı (kuruş, TRY; `workflows/booking/cart/target.ts`). Fark sıfır değilken TRY dışı sepet reddedilir.
- **Sepet rotası** `POST /store/carts/:id/bookings` `{ slot_id, items: [{ variant_id, quantity }] }`; istek o kalkışın satırlarının tamamını söyler.
- **Kontenjan kişi sayar** (`booking_slot.capacity/sold/held`); oda kavramı yok.
- **Katılımcı** kaydı var (`booking_traveler`: ad, doğum tarihi, şifreli kimlik no); kimin kiminle kaldığı bilgisi yok. Kalkışın katılımcı listesi panelden yazdırılır.
- **Kartın "…'den itibaren" fiyatı** ana kategoriden gelir (yer tutan ilk kategori; adr/0076 Ek "kart fiyatı ana kategoriden"). Fiyatın "iki kişilik odada kişi başı" olduğunu söyleyen bir not alanı yok.
- **Kısmi iptalin birimi kalkıştır**; rezervasyondan tek kişi çıkarılamaz (adr/0076 Ek D7a).

### Başkaları nasıl yapıyor (kaynaklı araştırma, 2026-11-25)

İşaretler: **(okundu)** sayfa açılıp okundu; **(arama özeti)** yalnız arama sonucundaki özetten; ikincisi karar dayanağı sayılmaz.

- **Türkiye'de fiyat tablosu.** Jolly Tur yayımladığı fiyatların "iki kişilik odada kişi başı en düşük program fiyatları" olduğunu, tek kişilik konaklamada fiyat farkı istendiğini yazar; yaş bantları çocuk 2–12, bebek 0–2; bebek sayısı yetişkin sayısını geçemez; çocuk yaşı "otele giriş tarihindeki" yaştır ([yasal uyarı](https://www.jollytur.com/yasal-uyari), okundu). Tatilsepeti'nde tablo dört sütunludur: iki kişilik odada kişi başı, ilave yatak, tek kişilik oda, çocuk ([örnek tur](https://www.tatilsepeti.com/marmaris-cikisli-rodos-adasi-turu-tr-173099), arama özeti).
- **Türkiye'de rezervasyon akışı.** Jolly Tur'un yurt dışı tur formunda kişi seçimi **oda oda** yapılır: her oda için yetişkin ve çocuk sayısı, her çocuğa yaş; bir oda en çok 3 kişi, fazlası için "Oda ekle". Koşul metni: çocuk fiyatı, çocuğun **iki yetişkin yanında** konaklaması halinde geçerlidir ([örnek tur](https://www.jollytur.com/elegant-guney-kore-japonya-turu-turk-hava-yollari-ile-9-gece-icn-nrt), okundu).
- **Oda paylaşımı.** G Adventures tek gelen gezginden fark almaz, aynı cinsiyetten biriyle eşleştirir; "My Own Room" ek ücretle tek oda verir ([solo travel](https://www.gadventures.com/about-us/why-travel-with-gadventures/solo-travel/), okundu). Intrepid'de oda varsayılan olarak iki kişilik paylaşımlıdır, eşleştirme pasaporttaki cinsiyete göredir, tek oda ek ücretlidir ([SSS](https://intrepidtravel.com/en/contact-us/frequently-asked-questions), okundu). Trafalgar benzer düzeni sunar; eş bulunamazsa ne olduğu sayfada yazmaz ([solo travel](https://www.trafalgar.com/en-ca/ways-to-go/solo-travel), okundu).
- **TourRadar.** Gezgine: konaklama iki kişilik paylaşımlı fiyatlanır, tek kişi farkı tek kullanımın bedelidir; oda seçenekleri tarih seçilince görünür ([single supplement](https://support.tourradar.com/faq/what-is-a-single-supplement), okundu). Operatöre: oda tipleri bir kez tanımlanır (kişi sayısı, 2 kişilikte yatak tipi double/twin, paylaşım private/shared, isteğe bağlı cinsiyet kısıtı); fiyat kalkış bazında ve "kişi başı" girilir ([oda tipleri](https://help.tourradar.com/en/operators/how-to-add/edit-room-types), okundu). Oda tipine göre ayrı stok tutulup tutulmadığı: doğrulanamadı.
- **Rezervasyon yazılımları ve standart.** OCTO'da kişi tipleri "unit"tir (`minAge`, `maxAge`, `paxCount`, `accompaniedBy`); **oda kavramı yoktur** ([OCTO products](https://docs.octo.travel/octo-api-core/products), okundu). Bókun'da fiyat kişi başı ya da rezervasyon başıdır, fiyat kategorisine bağlıdır; odadan söz edilmez ([rates](https://bokun.dev/restful-api-for-creating-updating-and-accessing-experience-products/bhqyxa7kEuAYtM7J2go3Kh/component-rates/nM7ytZugtr68WsxXYfV5z7), okundu); kategoriye yaş sınırı ve "her yetişkin başına en çok bir çocuk" gibi bağımlılık konabildiği: arama özeti. WeTravel'da her paketin stoğu ayrı sınırlanabilir ([availability](https://help.wetravel.com/en/articles/8612916-managing-trip-availability-within-the-trip-builder), okundu); tek kişilik odanın ayrı paket olarak kotalanması buradan çıkarımdır. Rezdy, FareHarbor, Checkfront: yalnız arama özeti (fiyat seçeneği, kişi tipi ve ücretli özel alan; oda modeli görülmedi).
- **Oda listesi (rooming list).** Her satır bir odadır: oda tipi, yatak tipi (twin iki ayrı yatak, double tek yatak), kişilerin pasaporttaki adları, çocuk yaşları (giriş günündeki), özel istek ([rehber](https://dmcquote.com/guides/hotel-rooming-list-template), okundu).
- **Fiyat gösterimi.** AB Paket Tur Direktifi 2015/2302 md. 5(1)(c) sözleşme öncesinde vergiler ve bütün ek ücretler dahil toplam fiyatı ister ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32015L2302), okundu). Türkiye'de Paket Tur Sözleşmeleri Yönetmeliği md. 5 (ön bilgilendirmede vergiler dahil toplam fiyat), Fiyat Etiketi Yönetmeliği md. 4–5 ve Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği'nin fiyat hükümleri: yalnız arama özeti, **doğrulanmalı** (resmî metin: mevzuat.gov.tr). "…'den itibaren" gösterimini açıkça düzenleyen bir madde bulunamadı.
- **Doğrulanamayanlar:** ETS Tur, Setur, Prontotour, Tatilbudur ve Gezinomi'nin tablo ve akışı; Contiki ve Exodus; Tourplan ve Kaptio'nun oda modeli; bebeğin kontenjandan yer düşüp düşmediğine dair kaynaklı örnek.

**Çıkarılan dersler:** (1) sektör dili "iki kişilik odada kişi başı + tek kişi farkı"dır, tasarım bunu tek sayıyla karşılamalı; (2) oda oda seçim, oda başına en çok 3 kişi ve "çocuk fiyatı iki yetişkin yanında" Türkiye'de alışılmış akıştır; (3) rezervasyon yazılımlarının çoğu odayı modellemez, yalnız kişi kontenjanı tutar: tam oda envanterine girmemek savunulabilir; (4) çocuk yaşı hizmetin başladığı güne göre sayılır; (5) oda paylaşımı büyük operatörlerde vardır ama eşleştirme insan işidir.

## Karar (önerilen tasarım)

### 1. İlke ve adlandırma

- Kodda "oda", "otel" denmez. Kavram **yerleşim birimidir** (`occupancy unit`): kişilerin birlikte kaldığı ya da oturduğu paylaşılan birim. Vitrindeki adı ürün ayarından gelir: Oda, Kabin, Çadır, Masa. Tur odası, tekne kabini, kamp çadırı ve yemekli etkinliğin masası aynı yeteneği kullanır.
- K3 bozulmaz: varyant yine fiyat kategorisidir. Yerleşim, kategorinin üstüne **sunucuda hesaplanan bir fark** ekler; oda tipi varyant olmaz.
- Bayrak **`catalog.booking_occupancy`** (mağazanın, varsayılan kapalı; `catalog.booking`'i gerektirir). Kapalıyken ve ürün ayarı kapalıyken hiçbir davranış değişmez.
- Basit yol (T1 A) bayraktan bağımsızdır; bugünkü kategorilerle çalışır.

### 2. Basit yol için küçük kolaylıklar (O0)

- **Fiyat notu:** ürün ayarında kısa metin (60 karakter, temiz tek satır; ör. "kişi başı, iki kişilik odada"). Ürün sayfasında fiyatın yanında, kartta "…'den itibaren" fiyatının altında çıkar. Boşsa bugünkü görünüm.
- **Kategori şablonu:** panelde tarihli ürünün fiyat kategorileri kartında "Oda tiplerine göre kategoriler ekle" kısayolu: iki kişilik odada yetişkin, tek kişilik odada yetişkin, çocuk, bebek (adlar ve yaşlar düzenlenebilir; fiyatları mağaza girer).
- Denetim yoktur; e-postada ve sipariş sayfasında "oda dağılımınız için sizinle iletişime geçeceğiz" notu ayarlanabilir (mevcut `booking` ayar bölümüne `rooming_off_note`).

### 3. Ürün ayarı: `bookable.occupancy` (yeni JSON sütunu; migration gerekir)

| Alan | Anlam | Varsayılan |
|---|---|---|
| `enabled` | "Oda dağılımı sor" | kapalı |
| `unit_label` | Birimin adı: `room`, `cabin`, `tent`, `table` ya da serbest metin (30 karakter) | `room` |
| `base_size` | Fiyatın esas aldığı kişi sayısı | 2 |
| `max_size` | Bir birimde en çok yer tutan kişi (1–8) | 3 |
| `single_supplement` | Tek kişi farkı, kuruş, TRY (≥ 0) | 0 |
| `extra_person_discount` | `base_size`'ı aşan her tam ücretli kişiye indirim, kuruş (≥ 0) | 0 |
| `reduced_needs_full` | İndirimli kategori (çocuk) için birimde gereken tam ücretli kişi sayısı; 0 = koşul yok | 2 |
| `max_units` | Bir rezervasyonda en çok birim (1–10) | 5 |
| `ask_bed` | Yatak tercihi sorulsun (çift kişilik yatak / iki ayrı yatak) | kapalı |
| `price_note` | §2'deki fiyat notu | boş |

- İndirimli kategorinin tam ücretli karşılığı `pax_by_variant[variant].reduced_of` ile söylenir (ör. "Çocuk" → "Yetişkin"). JSON alanına ek; migration gerektirmez. Yaş aralığı (`min_age`, `max_age`) oda dağılımı açıkken **denetlenir**.
- Kalkışa özel fark: `booking_slot.occupancy_adjustments` (yeni, boş olabilen JSON: `{ single_supplement?, extra_person_discount? }`). Yeni anlam yeni alandır; `price_adjustments` anlamı değişmez.
- Panelde görünür olan: anahtar, tek kişi farkı, "bir odada en çok kişi". Gerisi ikinci planda.

### 4. Sepet rotası

- `POST /store/carts/:id/bookings` gövdesi `items` yerine `rooms` alabilir (ikisi birden 400):

```
{ slot_id, rooms: [ { people: [ { variant_id, age? } ], bed?: "double" | "twin" } ] }
```

- İstemci yalnız **kimin hangi kategoride** olduğunu ve çocukların yaşını söyler; fiyat, fark, oda tipi alanı yoktur (`.strict()`).
- Oda dağılımı açık üründe `items` reddedilir (`booking.rooms_required`); kapalı üründe `rooms` reddedilir (`booking.rooms_unavailable`).
- İstek o kalkışın bütün odalarını söyler (bugünkü "tamamını söyler" kuralı); ikinci istek öncekinin yerine geçer.

### 5. Kurallar ve fiyat (yalnız sunucu)

Her birim için, sepet kilidi altında:

1. **Büyüklük** = birimdeki kişilerin `pax` toplamı (bebek 0 sayar). `1 ≤ büyüklük ≤ max_size`, değilse `booking.room_size_invalid`. Birimde en az bir tam ücretli kişi olmalı ve yer tutmayan kişi (bebek) sayısı tam ücretli kişi sayısını geçmemeli (`booking.room_needs_adult`).
2. **Yaş:** yaş aralığı olan kategoride `age` zorunlu ve aralıkta olmalı (`booking.room_age_invalid`). Yaş, kalkış gününde doldurulmuş yaştır; katılımcı doğum tarihi isteniyorsa tamamlamada onunla karşılaştırılır (`booking.travelers_invalid`).
3. **İndirimli kategori koşulu:** birimdeki tam ücretli kişi sayısı `reduced_needs_full`'dan azsa, indirimli kişiler sırayla tam ücretli karşılığına (`reduced_of`) çevrilir, ta ki koşul sağlanana ya da indirimli kişi kalmayana dek. Çevrilen kişi yanıtta işaretlenir (vitrin "çocuk indirimi iki yetişkinle aynı odada geçerlidir" der).
4. **Tek kişi farkı:** büyüklük `base_size`'dan küçükse (tipik: 1) birimdeki her tam ücretli kişiye `single_supplement` eklenir.
5. **Fazla kişi indirimi:** tam ücretli kişi sayısı `base_size`'ı aşıyorsa, aşan her kişiden `extra_person_discount` düşülür.
6. **Birim fiyat** = kategorinin sepet bağlamındaki fiyatı + kalkış farkı (`price_adjustments`) + yerleşim farkı; 0'ın altına inmez.

- Farklar tutardır, yüzde değildir: kuruş yuvarlaması doğmaz. TRY dışı sepette fark sıfır değilse istek reddedilir (`booking.currency_unsupported`; mevcut kural).
- **Satırlar:** aynı kategori ve aynı yerleşim farkı tek Medusa satırıdır; fark değişince ayrı satır (özel fiyatlı satır yalnız aynı metadata ve fiyatla birleşir). `metadata.qt_booking` içine `occ: { tag: "single" | "base" | "extra", adj }` yazılır; kişi verisi yazılmaz.
- **Kampanya ve fiyat listesi:** fiyat listesi (müşteri grubu, toptancı) kategori fiyatına uygulanır, fark sabit kalır. Yüzde kampanya satırın birim fiyatına, yani farka da uygulanır (bugünkü kalkış farkıyla aynı davranış).
- **Yanıt:** birim birim döküm (kişi, kategori, fiyat, fark, çevrilen kişi) ve toplam. Vitrin hesap yapmaz.
- **Tamamlama** (`assertBookingLinesCurrent`): odalar yeniden fiyatlanır; satırlarla kuruşu kuruşuna aynı değilse `booking.price_changed`; oda kayıtları satırlarla örtüşmüyorsa `booking.rooms_mismatch`.

### 6. Veri modeli: `booking_room` (yeni tablo, `booking` modülü)

| Alan | Ne tutar |
|---|---|
| `cart_id`, `slot_id`, `booking_id` | Sepette doğar; sipariş onayında rezervasyona bağlanır (katılımcı kaydının yolu) |
| `position` | Birimin sırası (1., 2. oda) |
| `size`, `people` | Büyüklük; `[{ variant_id, age?, charged_variant_id }]` |
| `bed`, `share` | Yatak tercihi; paylaşım isteği (O5) |
| `purge_after` | Katılımcı kaydıyla aynı saklama süresi |

- `booking_traveler.room_id` (yeni, boş olabilen alan): katılımcı hangi birimde. Katılımcı adımı odalara göre gruplanır ("1. oda: 2 yetişkin").
- Satır metadata'sına yaş ve oda içeriği yazılmaz (metadata birden çok kopyada durur; adr/0076 §7).
- Kontenjan değişmez: yer sayacı kişi sayar. T4 B gelirse `booking_slot`'a `single_cap`, `single_sold`, `single_held` ve `CHECK (single_sold + single_held <= single_cap)` eklenir; sayaç aynı koşullu `UPDATE` ve kilit sırasıyla, yer sayacıyla aynı işlemde değişir.

### 7. Vitrin ve tema sözleşmesi

- Ürün sayfasında, oda dağılımı açıkken kategori adetleri yerine **birim birim seçim**: "1. oda" kartı (yetişkin sayısı, çocuk sayısı ve yaşları, bebek sayısı), "Oda ekle". Her değişiklikte fiyat dökümü sunucudan.
- Tema sözleşmesi (tümü isteğe bağlı; yeteneği olmayan tema eski kategori adetlerini çizmez, ürün "seçilemiyor" yerine "Sizi arayalım" formuna düşer): `BookingView.occupancy?` (birim adı, sınırlar, kategoriler, farklar), `ProductActions.quoteBookingRooms?` (fiyat sorusu, sepete dokunmaz), `ProductActions.addBookingRooms?`.
- `product_main` biçimi yeniden çizilmez; bu bir özelliktir, biçim değildir (adr/0066). Görünüm kilidi testi hakemdir.
- Sepet, ödeme özeti, sipariş sayfası ve e-postada birim özeti: "1. oda: 2 yetişkin, 1 çocuk (7)".
- Fiyat sorusu ucu `POST /store/products/:id/booking/quote` (`catalog.booking_occupancy` arkasında; hız sınırı `booking` profili; önbelleksiz, sepete ve kontenjana dokunmaz).

### 8. Panel

- Ürünün rezervasyon ayarında "Oda dağılımı" bloğu (§3).
- Kalkış ekranında tek kişi farkının kalkışa özel değeri (ikinci plan).
- **Oda listesi:** kalkışın rezervasyon diyaloğunda birimlere göre gruplanmış liste (birim no, büyüklük, kişiler ve adları, yatak tercihi, sipariş no); yazdırma ve dışa aktarma mevcut katılımcı listesinin yetkisiyle. Otele gönderilen "rooming list" budur.
- Sipariş sayfasında birim özeti.

### 9. İptal, değişiklik, bildirim

- İptalin birimi yine kalkıştır. Oda dağılımlı rezervasyonda tek kişinin ya da tek odanın çıkarılması ilk sürümde yoktur (kalan kişinin fiyatı değişir: fark doğar); personel kalkışı iptal edip yeniden satar ya da farkı elle çözer. "Rezervasyon değişikliği" ayrı iştir.
- İptal kademesi satır toplamı üzerinden hesaplandığından tek kişi farkı kesintiye ve iadeye kendiliğinden girer.
- Onay e-postası ve voucher birim özetini taşır; kişi adı taşımaz (bugünkü kural).

### 10. Kapora, tarih aralığı, fatura, KVKK, SEO

- **Kapora (adr/0082):** bağımsızdır. Kapora sepet toplamından hesaplanır; yerleşim farkı toplamın içindedir.
- **Tarih aralığı (adr/0084):** konaklamada "kişi sayısına göre fiyat" aynı kuralları kullanır (birim = oda, büyüklük = misafir sayısı). Bu ADR'nin fiyat fonksiyonu kalkışa değil satıra bağlı yazılır ki orada yeniden kullanılsın.
- **Fatura:** yeni kalem türü yok; fark satırın birim fiyatındadır, fatura satırı ürün ve kategori adıyla çıkar. Tek kişi farkının faturada ayrı satır olması gerekip gerekmediği: mali müşavir.
- **KVKK:** yeni veri çocuğun yaşı (tam yıl), yatak tercihi ve (O5'te) paylaşım isteği. `booking_room` envantere yazılır; saklama ve silme katılımcı kaydınınkiyle aynıdır; alıcının veri dökümüne ve katılımcı başvurusu aramasına eklenir. Cinsiyet toplanmaz.
- **SEO ve JSON-LD:** `Offer.price` ana kategorinin fiyatıdır (bugünkü kural); fark yapılandırılmış veriye girmez. Fiyat notu ("kişi başı, iki kişilik odada") görünür metindir, kartta ve ürün sayfasında fiyatın yanında durur; tüketiciye gösterilen fiyatın neyi kapsadığının açık yazılması gereği (Fiyat Etiketi Yönetmeliği; Paket Tur Sözleşmeleri Yönetmeliği'nin ön bilgilendirme maddesi): doğrulanmalı.

## Para güvenliği ve kabul ölçütleri

| # | Risk | Kural | Kabul testi |
|---|---|---|---|
| G1 | Fiyatın ya da farkın istemciden gelmesi | Gövde yalnız kategori ve yaş taşır | Fiyat, fark ya da oda tipi alanı 400; `qt_booking` vitrinden yazılamaz |
| G2 | Tek kişinin farksız fiyat alması | Fark büyüklükten türetilir | 1 yetişkinlik oda: fark eklenir; 2 yetişkin: eklenmez; iki ayrı tek oda: iki fark |
| G3 | Çocuk fiyatının kötüye kullanımı | Yaş aralığı ve `reduced_needs_full` sunucuda | 1 yetişkin + 1 çocuk: çocuk tam ücretli; yaşı aralık dışı çocuk 400; 30 yaşında "çocuk" 400 |
| G4 | Kişilerin odalara bölünerek indirim kovalanması | Her birim ayrı fiyatlanır; kişi sayısı sınırı | 3 yetişkinin 3 tek odaya bölünmesi üç fark öder; `max_units` ve `max_units_per_cart` aşılırsa 400 |
| G5 | Fiyatın sepetle ödeme arasında değişmesi | Tamamlamada yeniden hesap | Fark panelden değişince açık sepet 409 `booking.price_changed` |
| G6 | Oda kaydı ile satırın ayrışması | Aynı iş akışı, aynı kilit; telafi ikisini de geri alır | Satır silinince oda kaydı da silinir; ekleme ortasında hata: ne tutma ne oda kalır |
| G7 | Kuruş ve para birimi | Fark tam sayı kuruş; TRY dışı sepette sıfır olmayan fark ret | Satır toplamlarının toplamı dökümün toplamına eşit; EUR sepette `booking.currency_unsupported` |
| G8 | Kontenjan | Yer sayacı değişmez; bebek yer tutmaz | Oda dağılımıyla dolu kalkışta ek kişi reddedilir; eşzamanlı iki sepet son yeri paylaşamaz |
| G9 | Bayrak kapalı | Hiçbir yeni yol açık değil | Bayrak kapalıyken `rooms` gövdesi 404/400; mevcut rezervasyon testleri değişmeden geçer |
| G10 | Kişi verisinin sızması | Yaş ve oda içeriği yalnız `booking_room`'da | Satır metadata'sı, log ve e-posta yaş listesi ya da ad taşımaz (mevcut izin listesi testi genişler) |

## Dilimler

| # | Dilim | Büyüklük | Bağımlılık | Not |
|---|---|---|---|---|
| O0 | **Basit yol:** fiyat notu, kategori şablonu, `rooming_off_note` | S | yok | Tek başına yayınlanır; fiyat yoluna dokunmaz |
| O1 | Backend: `bookable.occupancy`, kurallar ve fiyat, `rooms` gövdesi, fiyat sorusu ucu, `booking_room`, tamamlama ve onay aktarımı | L | O0 (aynı sütun) | Fiyat yolu ve migration: güvenlik incelemesi; eşzamanlılık testleri |
| O2 | Vitrin: birim birim seçim, döküm, sepet ve sipariş özeti, katılımcı adımında gruplama; tema sözleşmesi | M | O1 | Görünüm kilidi testi |
| O3 | Panel: ayar bloğu, kalkışa özel fark, oda listesi (yazdır, dışa aktar), e-posta ve voucher özeti | M | O1 | |
| O4 | Tek kişilik oda sınırı (sayaç) | M | O1 | Migration; eşzamanlılık testi |
| O5 | Oda paylaşma isteği (aç/kapa) | M | O3; farkın sonradan tahsili için adr/0082 K1 | Sahip T5'te isterse |

O1–O3 bitince konaklamalı tur oda dağılımıyla uçtan uca satılır. O2 ve O3 birbirinden bağımsızdır.

**Üç ADR arasındaki sıra:** adr/0082'de yazıldığı gibi 0082 K0–K3 → 0083 → 0082 K4–K7 → 0084. Bu ADR kaporaya bağlı değildir (O5 dışında); O0 herhangi bir anda araya alınabilir.

## Kapsam dışı

- Oda tipi başına envanter ve otel sözleşmesi kotası (T4 C); otelle eşitleme.
- Otomatik oda arkadaşı eşleştirme (T5 C); cinsiyet toplama.
- Rezervasyondan kişi çıkarma, oda değiştirme, ad değişikliği (ayrı "rezervasyon değişikliği" işi).
- Oda sınıfı yükseltme (deniz manzaralı oda gibi): mevcut seçenek/kategori ya da ileride "kalkışa bağlı ek hizmetler" (adr/0076 "Sonraya").
- Yüzde olarak tek kişi farkı (T2 B).

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kategori + sunucuda yerleşim farkı (seçilen)** | K3 korunur; mağaza tek sayı girer; fiyat listesi, KDV ve kampanya olağan yoldan | Fark TRY ve tutar; yeni fiyat adımı |
| Oda tipi = varyant (kişi tipi × oda tipi) | Kod gerekmez (basit yol) | Kategori sayısı çarpılır; dağılım denetlenmez; oda listesi çıkmaz |
| Oda = ürün, kişi = adet (oda başına fiyat) | Konaklamaya yakın | Tur kişi başı satılır; çocuk ve bebek fiyatı, kişi kontenjanı ve katılımcı adımı bozulur |
| Tek kişi farkı ek seçenek olarak (adr/0052) | Hazır altyapı | Ek seçenek tarihli satırda kapalı; müşterinin seçtiği bir ektir, sunucunun dağılımdan çıkardığı bir kural değil (müşteri "seçmeyebilir") |
| Tam oda envanteri | Otel kotasıyla birebir | İlk müşterinin ihtiyacı değil; panel ve sayaç karmaşası |

## Sonuçlar

- Konaklamalı tur sektörün alıştığı fiyat tablosuyla satılır; mağaza otele hazır oda listesi verir.
- Küçük mağaza hiçbir şeyi açmadan basit yolu kullanmaya devam eder.
- Fiyat yoluna üçüncü bir bileşen (yerleşim farkı) girer; her fiyat gösteren yer (ürün sayfası, sepet, tamamlama) aynı fonksiyondan geçmek zorundadır.
- Yeni kişi verisi (çocuk yaşı) envantere ve saklama işine eklenir.

## Açık kalanlar

**Sahibe ve ilk müşteri acentaya:**

- Gerçek fiyat tablosu: tek kişi farkı kalkışa göre değişiyor mu; üçüncü kişi indirimi var mı; çocuk yaş sınırları (0–2, 2–12 mi); çocuk indirimi "iki yetişkin yanında" koşullu mu; iki çocuk aynı odada olabilir mi.
- Çocuk yaşı kalkış gününe göre mi, dönüş gününe göre mi hesaplanıyor.
- Tek yetişkin + çocuk durumunda bugünkü uygulamaları (öneri: çocuk tam ücret öder, tek kişi farkı alınmaz).
- Yatak tercihi (çift kişilik yatak / iki ayrı yatak) soruluyor mu.

**Hukukçuya:**

- "Kişi başı, iki kişilik odada" fiyatının ilan ve kartta gösteriminde toplam fiyat yükümlülüğü (Fiyat Etiketi Yönetmeliği; Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği; Paket Tur Sözleşmeleri Yönetmeliği ön bilgilendirme): tek kişi farkının ön bilgilendirmede nasıl yazılacağı.
- Oda paylaşımında (O5) eşleştirme için cinsiyet sorulmasının KVKK dayanağı.

**Mali müşavire:**

- Tek kişi farkının faturada ayrı satır olması gerekir mi; KDV oranı ana hizmetle aynı mı.

**Teknik (kodlamadan önce):**

- Medusa 2.21.2'de aynı varyantın farklı birim fiyatlı iki özel satırının birleşmediği (adr/0052'de doğrulanan `findMatchingLineItem` davranışı) rezervasyon rotasında da testle sabitlenir.
