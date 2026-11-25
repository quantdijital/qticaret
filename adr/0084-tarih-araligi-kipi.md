# ADR-0084: Tarih aralığı kipi: konaklama ve kiralama

- **Durum:** Kabul (sahip, 2026-11-25: "soruları kendin cevapla, devam et"; aşağıdaki öneriler karar oldu). A1 gün tanecikli sayılı kaynak, A2 ilk dilim tarih aralığıyla talep, A3 taban fiyat ve tarihe özel fiyat, A4 ilk sürüm kuralları (en az/en çok gece, pencere, son dakika), A5 her oda tipi ayrı ürün, A6 teminat ilk sürümde bilgi satırı. Bu kipi bekleyen müşteri yok; uygulama sırası 0082 ve 0083'ten sonradır. Hukukçu ya da mali müşavir doğrulaması isteyen maddeler doğrulanana kadar yazılı varsayılanla yürür; her dilim kendi PR'ında `security-reviewer` incelemesinden geçer.
- **Tarih:** 2026-11-25
- **İlgili:** adr/0076 (tarihli ürün; §11 "tarih aralığı modu yazılmıyor, temel buna hazır", K4 "tutma ve rezervasyon slot listesine bağlanır"), adr/0077 (tarih araması, ay takvimi), adr/0082 (kapora ve bakiye), adr/0083 (yerleşim birimi), adr/0007 (KDV), adr/0066 (tema sözleşmesi), docs/13 (SEO)
- **Dayanak:** sahip (2026-11-22, adr/0076 dayanağı): ileride otel, oda ve araç kiralama (tarih aralığı seçerek) da gelebilir; bugünkü temel ona uygun olsun. Bugün bu kipi bekleyen bir müşteri yok; bu ADR temeli harcamadan nasıl tamamlanacağını ve hangi sırayla yazılacağını karara bağlar.

## Kararlar (sahip, 2026-11-25; "Önerim" sütunu karardır)

Kısa liste; seçenekler ve gerekçe hemen altında. İkili tercihler **ayar** olarak gelir.

| # | Karar | Önerim |
|---|---|---|
| A1 | İlk sürüm neyi kapsasın | Gecelik ve günlük, "aynı tipten N adet" satış (oda tipi, araç sınıfı, ekipman; N = 1 ile tek ev ya da tek araç). Saatlik kiralama ve belirli birimin atanması sonraya |
| A2 | Basit yol | İlk dilim: "Sizi arayalım" formuna giriş ve çıkış tarihi. Takvim, ödeme, kontenjan yok; mağaza döner |
| A3 | Fiyat | Gecelik taban fiyat + takvimden tarihe özel fiyat (sezon, hafta sonu). Uzun kalış indirimi ve kişi sayısına göre fiyat sonraki dilim |
| A4 | Kurallar | İlk sürümde: en az gece, en çok gece, rezervasyon penceresi, son dakika kapanışı. Giriş/çıkış günü kısıtı ve hazırlık günü sonraki dilim |
| A5 | Ürün yapısı | Her oda tipi, araç sınıfı ya da ev **ayrı üründür** (ayrı sayfa, ayrı takvim); varyant fiyat seçeneğidir (ör. kahvaltılı, kahvaltısız) |
| A6 | Kiralamada hasar teminatı | İlk sürümde yalnız bilgi satırı ("teslimde 5.000 TL teminat alınır"); mağaza kendi POS'undan provizyonla alır. Çevrim içi teminat ayrı karar: sağlayıcının ön provizyon desteğine bağlı |

### A1. Kapsam

- **A. Gün tanecikli, sayılı kaynak.** Müşteri giriş ve çıkış günü seçer; her günün "kaç adet kaldı" sayacı vardır. N = 1 yapılırsa tek ev ya da tek araç da aynı yolla satılır. adr/0076'nın sayaç, tutma ve iptal altyapısını aynen kullanır.
- **B. Saatlik kiralama ve belirli birim.** "Bu plakalı araç, 10.00–16.00". Çakışmayı veritabanı kısıtı önler (`EXCLUDE USING GIST`); yeni tablo ve yeni tutma yolu gerekir.
- **C. İkisi birden.** Aynı anda iki kontenjan motoru; ilk sürüm büyür.
- **Önerim: A.** Konaklama, günlük araç ve ekipman kiralamanın tamamını karşılar. B gerçek bir müşteri isteyince ayrı dilim olarak eklenir; A'nın şeması onu engellemez.
- **Ayar (soru değil):** sayım biçimi ürün ayarıdır: "Gecelik" (konaklama; çıkış günü yeni girişe açıktır) ya da "Günlük" (kiralama; alış ve iade günü ikisi de sayılır). Varsayılan gecelik.

### A2. Basit yol

- **A. Tarih aralığıyla talep.** Müşteri giriş, çıkış ve kişi sayısını yazar, telefonunu bırakır; mağaza müsaitliği kendi defterinden bakar ve döner. Mevcut "Sizi arayalım" yolunun (adr/0076 Ek 2026-11-23) tarih aralığı alan hali.
- **B. Yalnız çevrim içi satış.** Küçük işletmeyi takvim tutmaya zorlar.
- **Önerim: A ilk dilim olarak, tek başına yayınlanır.** Ürünün "Satış biçimi" ayarı bugünkü gibi üç değerlidir: çevrim içi, talep, ikisi de.

### A3. Fiyat

- **A. Tek gecelik fiyat.** En basit; sezonu olan işletmeye yetmez.
- **B. Taban fiyat + tarihe özel fiyat.** Panel takviminde gün aralığı seçilir, "bu günlerde gecelik +500 TL" ya da "şu fiyat" denir; "her cuma ve cumartesi" kısayolu vardır. Müşteri gece gece dökümü görür.
- **C. B + uzun kalış indirimi (7 gece ve üstü %10), kişi sayısına göre fiyat, temizlik ücreti.** Tam konaklama fiyatlaması; her biri ayrı kural ve ayrı test.
- **Önerim: ilk sürümde B.** C'nin parçaları ikinci planda ayar olarak sonraki dilimde: uzun kalış indirimi (yüzde), kişi sayısına göre fiyat (adr/0083 kuralları), sabit ek ücret ("kalkışa bağlı ek hizmetler" işi).

### A4. Kurallar

- **İlk sürüm (hepsi ürün ayarı, varsayılanlı):** en az gece (1), en çok gece (30), rezervasyon penceresi (bugünden 365 gün), son dakika kapanışı (mevcut `cutoff_hours`).
- **Sonraki dilim (ikinci planda):** giriş yapılabilen günler (ör. yalnız cumartesi), çıkış yapılabilen günler, hazırlık günü (çıkıştan sonra N gün kapalı), tarihe özel en az gece (bayramda en az 3 gece).
- **Önerim: böyle bölünsün.** Panelde görünür ayar yalnız "en az gece"dir.

### A5. Ürün yapısı

- **A. Her oda tipi ya da araç sınıfı ayrı ürün.** Ayrı fotoğraf, ayrı açıklama, ayrı SEO sayfası, ayrı takvim. Varyantlar aynı adedi paylaşan fiyat seçenekleridir ("kahvaltı dahil", "iade edilemez, %10 indirimli").
- **B. Tek ürün (otel), varyant = oda tipi.** Tek sayfa; ama her varyantın ayrı sayacı gerekir, bu adr/0076 K3'ü ("varyant kontenjan değildir") bozar.
- **Önerim: A.** Otelin bütün odalarını bir arada gösteren sayfa bir kategori ya da koleksiyon sayfasıdır.

### A6. Hasar teminatı

- **A. Bilgi satırı.** Ürün sayfasında ve onay e-postasında "Teslimde 5.000 TL teminat alınır, iadede geri verilir". Mağaza teminatı teslimde kendi POS'undan alır.
- **B. Çevrim içi ayrı tahsilat ve iade.** Teminat kiradan ayrı bir ödeme olarak çekilir, iade sonrası personel "Teminatı geri ver" der. adr/0082 K4'ün siparişe bağlı ödeme yolunu kullanır. Risk: araç kiralamada 2027'den itibaren teminatın "ön provizyon veya blokaj" olması isteniyor (yukarıdaki yönetmelik; doğrulanmalı); para çekip iade etmek buna uymayabilir.
- **C. Kart provizyonu.** Para çekilmez, bloke edilir; kiralama yazılımlarının ortak yolu. Risk: bugün iki sağlayıcıda da ön provizyon kullanmıyoruz; PayTR'de kapama 7–25 gün, iyzico'da süre belgesiz (adr/0082 araştırması). Provizyon teslim günü alınmalı, satış günü değil.
- **Önerim: A ile başla.** B ve C ayrı kararla: önce sağlayıcılardan provizyon koşulları, hukukçudan yönetmeliğin kapsamı. Teminat ön ödeme (kapora) değildir: kapora bedelin parçasıdır, teminat geri verilmek üzere alınır ve gelir değildir (muhasebesi: mali müşavir).

## Bağlam

### Kodda bugün olan (2026-11-25 `dev`, okundu)

- **`booking_mode: "range"` değeri ayrılmış, yazılmamıştır.** Doğrulayıcı reddeder (`catalog.booking_range_unavailable`); `bookable.mode` enum'unda `range` vardır.
- **Kontenjan sayaçtır:** `booking_slot (capacity, sold, held)`, `CHECK (sold + held <= capacity)`, koşullu `UPDATE`. Tutma ve rezervasyon slot **listesine** bağlıdır (`booking_hold_slot`, `booking_slot_use`); bir tutma birden çok slotu tek işlemde, hep aynı kilit sırasıyla alır. adr/0076 §11 bunu "gece başına bir slot" için bilerek böyle kurdu.
- **Slot fiyat farkı** `booking_slot.price_adjustments[variant]` (kuruş, TRY): gece başına slotla birleşince sezon fiyatının kendisidir.
- **Sepet rotası** `POST /store/carts/:id/bookings` `slot_id` alır; adr/0076 rotanın `from/to` alacak biçimde sürümleneceğini söyler.
- **İptalin, hatırlatmanın ve voucher'ın birimi** bir kalkıştır (`booking_slot_use`). Çok geceli konaklamada bu birim "bir gece" olur; yanlış birimdir.
- **Arama ve takvim** (adr/0077): tarih aralığıyla arama ve ay takvimi kalkış için yazıldı; uygunluk kuralı "aralıkta bir kalkış var mı"dır.
- **"Sizi arayalım"** talebi tek gün, ay ya da "tarih esnek" alır; giriş-çıkış aralığı almaz.
- **Yasal belge satırı** (belge adı, numarası, unvan) mağaza profilinde serbest etiketli alan olarak var (adr/0076 §12).

### Başkaları nasıl yapıyor (kaynaklı araştırma, 2026-11-25)

İşaretler: **(okundu)** sayfa açılıp okundu; **(arama özeti)** yalnız arama sonucundaki özetten; ikincisi karar dayanağı sayılmaz. Mevzuat maddeleri hüküm değildir: hepsi **doğrulanmalı**.

- **Airbnb (ev sahibi ayarları).** En az ve en çok gece (giriş gününe göre ayrı verilebilir); ön bildirim (aynı gün, 1, 2, 3 ya da 7 gün); hazırlık süresi (her rezervasyonun önünde ve arkasında 1 ya da 2 gece bloklanır); rezervasyon penceresi (3–24 ay); haftanın belirli günlerinde giriş ya da çıkış kapatma ([availability settings](https://www.airbnb.com/resources/hosting-homes/a/update-your-availability-settings-708), okundu). Fiyat: gecelik taban, hafta sonu farkı (cuma, cumartesi), özel güne özel fiyat, haftalık ve aylık indirim, temizlik ücreti ([fiyat](https://www.airbnb.com/help/article/2061), okundu).
- **Booking.com.** Envanter **oda tipi başına** tutulur ve o tipin bütün fiyat planları aynı sayıyı paylaşır; gün gün fiyat, en az/en çok kalış, "girişe kapalı" ve "çıkışa kapalı" kısıtları oda tipi × fiyat planı × gün düzeyindedir ([availability](https://developers.booking.com/connectivity/docs/b_xml-availability/), okundu). Kişi sayısına göre fiyatın dört modeli vardır: tam oda + tek kişi fiyatı, taban üstüne fark, kişi sayısı başına ayrı fiyat, kalış süresine göre fiyat ([pricing models](https://developers.booking.com/connectivity/docs/pricing-models), okundu).
- **Shopify.** Tarih aralığı rezervasyonu uygulamalarla çözülür; Shopify'ın kendi blogu da uygulamaya yönlendirir ([blog](https://www.shopify.com/in/blog/appointment-booking-app), okundu; "yerelde yok" diyen birinci taraf cümle bulunamadı). Sepet satırının fiyatını değiştiren Cart Transform yalnız Plus'ta çalışır ([cart transform](https://shopify.dev/docs/api/functions/latest/cart-transform), okundu). Uygulamalar: BookThatApp süre basamaklarını varyantla kurar, adet alanını gizler (arama özeti); IzyRent tarihe özel fiyat ve "kaparo, sonra öde" sunar ([liste](https://apps.shopify.com/rental-booking-izyrent), okundu); Easy Rentals çift rezervasyonu engellediğini, iade sonrası boşluk süresi ve kartta "güvenlik blokajı" tuttuğunu söyler ([liste](https://apps.shopify.com/easy-rentals), okundu). Bu uygulamaların çakışmayı teknik olarak nasıl önlediği: doğrulanamadı.
- **Medusa v2 resmî kiralama örneği.** Ayrı modül (`RentalConfiguration`: en az ve en çok gün; `Rental`: varyant, sipariş satırı, başlangıç ve bitiş günü, durum); sepete ekleme kendi iş akışıyla ve kilitle; `unit_price` = varyant fiyatı × gün; tarihler satır metadata'sında; çakışma **uygulama kodunda** sayılır; kiralama satırında adet 1 zorunludur, yani her varyant tek parçadır ([tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-rentals), okundu). Bizim sayaçlı modelimiz bunun üstündedir (N adet, veritabanı kısıtı, süreli tutma).
- **Kiralama yazılımları.** Booqable stokta "tek tek izlenen" ile "toplu adet" ayrımı yapar; fiyat süre basamaklarıyla kurulur ([stok](https://help.booqable.com/en/articles/3461344), [fiyat](https://help.booqable.com/en/articles/99366), okundu). Hasar teminatı Booqable'da ve TWICE'ta **kartta ön provizyon** olarak tutulur, kira ödemesinden ayrı bir kayıttır, yaklaşık 7 gün geçerlidir; iadesi "blokajın kaldırılması"dır ([Booqable](https://booqable.com/blog/authorize-credit-card-holds/), [TWICE](https://www.twicecommerce.com/docs/concepts/orders/deposits), okundu).
- **PostgreSQL.** `EXCLUDE USING GIST (room WITH =, during WITH &&)` aynı kaynağın çakışan aralıklarını veritabanında reddeder; `=` için `btree_gist` eklentisi gerekir; `daterange` varsayılan olarak yarı açıktır (`[)`), aynı gün çıkış ve giriş çakışma sayılmaz ([rangetypes §8.17.10](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT), okundu). Sayaçlı yaklaşımla karşılaştıran güvenilir bir yazı bulunamadı; aşağıdaki karşılaştırma bizim değerlendirmemizdir.
- **Türkiye: kısa süreli konut.** 7464 sayılı Kanun: 100 güne kadar kiralama izin belgesine bağlıdır (md. 2, md. 3); izinli konutta kimlik bildirimi izin sahibinindir (md. 3/8); izinsiz konuta aracılık edene ve uyarıya rağmen içeriği kaldırmayan aracı hizmet sağlayıcıya ceza vardır (md. 4) ([RG 02.11.2023](https://www.resmigazete.gov.tr/eskiler/2023/11/20231102-16.htm), okundu). 31.12.2025 tarihli Bakanlık tebliği ilanda belge numarasının açıkça gösterilmesini ister ([RG](https://www.resmigazete.gov.tr/eskiler/2025/12/20251231-7.htm), okundu).
- **Türkiye: konaklama vergisi.** Gider Vergileri Kanunu md. 34; oran 31.12.2026'ya kadar %2'den %1'e indirilmiş; faturada ayrıca gösterilir ve KDV matrahına girmez (ikincil kaynaklar: [alomaliye](https://www.alomaliye.com/2026/06/19/konaklama-vergisi-rehberi-2026/) okundu, KPMG arama özeti). İzin belgeli konutun bu vergiye tabi olup olmadığı: doğrulanamadı.
- **Türkiye: araç kiralama.** Motorlu Kara Taşıtlarının Kiralanması Hakkında Yönetmelik (RG 15.08.2026, yürürlük 01.01.2027): depozito "ön provizyon veya blokaj şeklinde" alınır (md. 4); 6 güne kadar kiralamada en çok 3 günlük, daha uzun kiralamada en çok 7 günlük kira bedeli kadar olabilir, çek ve senet alınamaz, araç iadesinden sonra 7 gün içinde geri verilir (md. 14); hasar belgelenmeden kesinti yapılamaz (md. 16) ([RG](https://www.resmigazete.gov.tr/eskiler/2026/08/20260815-1.htm), okundu).
- **Yapılandırılmış veri.** Google'ın `VacationRental` işaretlemesinde **fiyat alanı yoktur** ve yalnız Google'la çalışan (Hotel Center erişimli) siteler kullanabilir ([Google](https://developers.google.com/search/docs/appearance/structured-data/vacation-rental), okundu). Gecelik fiyatın yapılandırılmış veriden arama sonucunda gösterildiğine dair kaynak bulunamadı. schema.org `UnitPriceSpecification` birim kodu (`unitCode`) alır ([schema.org](https://schema.org/UnitPriceSpecification), okundu).

**Çıkarılan dersler:** (1) konaklamanın ortak modeli "tip başına gün gün adet + gün gün fiyat"tır ve fiyat planları aynı adedi paylaşır: A5 ve gün slotu bununla örtüşür; (2) ilk sürümün kural seti Airbnb'nin temel ayarlarıdır (en az gece, pencere, ön bildirim), hazırlık günü ve giriş günü kısıtı ikinci halkadır; (3) Medusa'nın kendi örneği tek parçalı ve kısıtsızdır, bizim sayaç modelimiz daha güçlüdür; (4) hasar teminatı her yerde **ön provizyondur**, ayrı bir tahsilat değil; Türkiye'de araç kiralamada 2027'den itibaren biçimi ve tavanı yönetmelikle belirlenmiş: teminatı çevrim içi almak sağlayıcının provizyon desteğine bağlıdır; (5) kısa süreli konutta ilanda belge numarası zorunludur: ürün düzeyinde alan gerekir; (6) arama sonucunda gecelik fiyat için yapılandırılmış veriye bel bağlanmaz.

## Karar (önerilen tasarım)

### 1. İlke

- Kodda "otel", "oda", "araç" denmez: **tarih aralığı**, **konaklama (`stay`)**, **gün slotu**, **adet**. Sektör paketi (konaklama, kiralama) yalnız veridir.
- Aynı `booking` modülü, aynı sayaç, aynı tutma. Yeni olan: gün slotlarının üretimi, aralık fiyatı, "konaklama" birimi ve aralık seçen vitrin.
- Bayrak **`catalog.booking_range`** (mağazanın, varsayılan kapalı; `catalog.booking`'i gerektirir). Kapalıyken `range` bugünkü gibi reddedilir.
- Ürün başına bir kip: bir ürün ya `departure` ya `range`'dir; sonradan değişmez (rezervasyonu olan üründe).

### 2. Ürün ayarı: `bookable.range` (yeni JSON sütunu; migration gerekir)

| Alan | Anlam | Varsayılan |
|---|---|---|
| `unit` | `night` (gecelik) ya da `day` (günlük) | `night` |
| `default_capacity` | Aynı tipten kaç adet (1 = tekil kaynak) | 1 |
| `min_units`, `max_units` | En az ve en çok gece/gün (en çok 30) | 1, 30 |
| `window_days` | Bugünden kaç gün sonrasına kadar satılır (30–540) | 365 |
| `checkin_time`, `checkout_time` | Giriş ve çıkış saati (bilgi; e-posta ve voucher) | 14:00, 11:00 |
| `max_guests` | Bir adette en çok kişi (bilgi ve doğrulama; fiyatı etkilemez) | boş |
| `security_deposit_note` | Hasar teminatı bilgi satırı (200 karakter, temiz tek satır) | boş |
| `document_number` | Ürüne özel belge numarası (60 karakter; ör. kısa süreli konut izin belgesi). Doluysa ürün sayfasında mağazanın yasal belge satırının etiketiyle gösterilir | boş |
| `checkin_weekdays`, `checkout_weekdays`, `buffer_units` | Sonraki dilim (R6) | boş, boş, 0 |

Son dakika kapanışı mevcut `cutoff_hours`, saat dilimi mevcut `timezone`, iptal kademeleri mevcut `cancellation_tiers` (giriş gününe kalan güne göre) alanlarıdır.

### 3. Gün slotları

- Gün başına bir `booking_slot` satırı. Yeni alan **`day`** (`date`, boş olabilir; kalkış slotlarında boş) ve kısmi tekil dizin `(bookable_id, day) WHERE day IS NOT NULL`. `starts_at` o günün giriş saatidir (ürünün saat diliminde); hesap `day` ile yapılır.
- **Tarih, zaman damgası değil.** Gece sayısı ve fiyat `date` aritmetiğiyle hesaplanır; yaz saati geçişinde 23 ya da 25 saatlik gün sayımı bozmaz.
- **Üretim:** ürün `range` olarak kaydedilince ve her gece çalışan `booking-range-window` işiyle, bugünden `window_days` sonrasına kadar eksik günler `default_capacity` ile açılır (`INSERT ... ON CONFLICT DO NOTHING`). Satırlar önceden var olduğundan takvim okuması ve tutma SQL'i kalkıştakiyle aynıdır.
- **Kapatma:** bir gün `status = closed` ile kapanır (bakım, sahibin kullanımı). Adet düşürme `capacity >= sold + held` kısıtına takılırsa reddedilir.
- **Hangi günler tutulur:** `night` kipinde `[giriş, çıkış)` (çıkış günü tutulmaz, aynı gün yeni giriş olur); `day` kipinde `[alış, iade]` (iki uç dahil).
- **Hazırlık günü (R6):** `buffer_units > 0` ise aralığın ardındaki günler de aynı adetle, ücretsiz tutulur. N > 1 adette bu ihtiyatlıdır (gerçekte başka bir birim boş olabilir); kesin atama tekil kaynak modelini ister (Alternatifler).

### 4. "Konaklama" birimi: `booking_stay` (yeni tablo; migration gerekir)

| Alan | Ne tutar |
|---|---|
| `booking_id`, `line_item_id` | Hangi rezervasyon ve sipariş satırı |
| `from_day`, `to_day`, `unit`, `quantity` | Aralık, sayım biçimi, kaç adet |
| `nightly` | Satış anındaki gün gün birim fiyat (kuruş dizisi; en çok 30) |

- `booking_slot_use.stay_id` (yeni, boş olabilen alan): bir konaklamanın gün satırlarını birbirine bağlar.
- **İptalin, hatırlatmanın, voucher'ın ve e-postanın birimi konaklamadır**, gün değil. İptal bir konaklamanın bütün gün satırlarını tek SQL cümlesinde kapatır ve yerleri geri verir. Hizmet günü `from_day`'dir; iptal kademesi ona kalan güne bakar.
- Kalkış kipinde `stay_id` boştur; bugünkü davranış değişmez.
- Konaklamanın kısaltılması, uzatılması, tarih değişikliği ilk sürümde yoktur (iptal ve yeniden satış; personel elle).

### 5. Sepet rotası ve tutma

- `POST /store/carts/:id/bookings` ikinci gövde biçimi (`slot_id` ile birlikte 400):

```
{ product_id, from: "2027-07-10", to: "2027-07-14", items: [ { variant_id, quantity } ], guests?: number }
```

- Tarih yalnız `YYYY-MM-DD`; saat, fiyat, gece sayısı alanı yoktur (`.strict()`).
- Sıra (sepet kilidi altında): ürün `range`, yayımlanmış ve sepetin kanalında mı → tarih kuralları (§6) → gün slotları okunur (hepsi var ve `open` mı) → **tek `holdUnits` çağrısı** bütün günleri aynı işlemde alır (biri dolmuşsa hiçbiri tutulmaz; mevcut davranış) → fiyat (§7) → satır eklenir. Telafi: tutma eski haline döner.
- Satır: varyant başına bir satır, adet = kaç adet (oda, araç), `unit_price` = konaklamanın o adet için toplamı. `metadata.qt_booking { hold_id, stay: { from, to, unit, nights }, starts_at, pax }`; kişi verisi yok.
- Aynı ürün için ikinci istek öncekinin yerine geçer (kalkıştaki kural). Bir sepette aynı üründen tek aralık; farklı ürünler ayrı konaklamalardır.
- Tutma süresi, ödeme sırasındaki uzatma, 120 dakika sınırı, IP ve sepet başına sınırlar aynen (adr/0076 §5, Ek D3).

### 6. Tarih kuralları (yalnız sunucu)

`from < to` (günlük kipte `from <= to`); `from` bugünden önce değil ve son dakika kapanışından sonra değil; `to` pencere içinde; gece/gün sayısı `min_units` ile `max_units` arasında; (R6) giriş ve çıkış günü izinli; `guests <= max_guests × adet`. Her ihlalin kendi hata anahtarı vardır (`booking.range_invalid`, `booking.range_too_short`, `booking.range_too_long`, `booking.range_closed`, `booking.range_window`, `booking.guests_invalid`).

### 7. Fiyat (yalnız sunucu)

- **Gün fiyatı** = varyantın sepet bağlamındaki fiyatı + o günün `price_adjustments[variant]` farkı; 0'ın altına inmez. Sezon ve hafta sonu fiyatı o günlerin farkıdır; ayrı bir fiyat motoru yoktur.
- **Konaklama fiyatı** = gün fiyatlarının toplamı (tam sayı kuruş; yuvarlama yok). Satırın `unit_price`'ı budur.
- Fark TRY'dir; TRY dışı sepette aralıkta sıfır olmayan fark varsa istek reddedilir (`booking.currency_unsupported`; mevcut kural).
- Fiyat listesi (müşteri grubu) taban fiyata uygulanır; kampanya satıra uygulanır (bugünkü davranış).
- **Uzun kalış indirimi (R6):** `[{ min_units, percent_bps }]`, en çok 5 basamak; konaklama toplamına uygulanır, yarım yukarı yuvarlanır (adr/0010); indirim Medusa promosyonu değil fiyatın parçasıdır ve dökümde ayrı satır olarak gösterilir.
- **Fiyat sorusu:** `POST /store/products/:id/booking/quote` `{ from, to, items }` → gün gün döküm ve toplam; sepete ve kontenjana dokunmaz.
- **Tamamlama:** konaklama yeniden fiyatlanır, bütün günlerin tutması canlı ve adedi tam mı bakılır; değilse `booking.price_changed` ya da `booking.hold_expired` (409).
- KDV ürün tipinden gelir (adr/0007). Konaklama vergisi kapsam dışıdır (Açık kalanlar).

### 8. Okuma uçları ve arama

- `GET /store/products/:id/booking/calendar?from=&months=` (`catalog.booking_range` arkasında; 60 sn önbellek): gün gün `{ day, open, left: "none" | "few" | "many", price }`. Kesin kalan sayı vitrine verilmez (kalkıştaki `FEW_LEFT` kuralı).
- **Tarih araması (adr/0077):** aralık verilmişse `range` ürün, aralığın **bütün** günleri açık ve en az bir adet boşsa uygundur; esnek ay aramasında ayın içinde `min_units` uzunluğunda boş bir dizi varsa. Kartta "gecelik 2.400 TL'den" (pencerenin en düşük gün fiyatı; ana fiyat seçeneğinden) ve birim etiketi.
- Kart bilgisi ucu (`card-facts`) `range` ürün için `{ from_price, unit }` döner; hızlı ekleme kapalıdır.

### 9. Panel

- Ürün türünde "Tarih aralığıyla satış (gecelik ya da günlük)" seçeneği (bayrak açıkken).
- **"Müsaitlik ve fiyat" kartı:** ay ızgarası; her gün hücresinde kalan/adet ve gecelik fiyat. Gün aralığı seçilir: "Kapat", "Aç", "Adedi değiştir", "Fiyatı değiştir" (fark ya da tutar); kısayol "Her cuma ve cumartesi". Toplu yazma tek istekle, en çok 366 gün.
- Rezervasyon ayarları: en az gece görünür; gerisi ikinci planda.
- **Rezervasyonlar takvimi:** konaklamalar gün şeridi olarak; günün giriş ve çıkış listesi (yazdırılabilir).
- Admin uçları: `POST /admin/products/:id/booking-days` (toplu), `GET /admin/products/:id/booking-days?from=&to=`. Yazma sahip ve yöneticinin; denetim kaydı.

### 10. Vitrin ve tema sözleşmesi

- Ürün sayfası: giriş ve çıkış seçen takvim (adr/0077 ay takviminin aralık seçen hali), adet ve kişi sayısı, gün gün fiyat dökümü ve toplam, kurallar ("en az 2 gece").
- Tema sözleşmesi (tümü isteğe bağlı): `BookingView.range?` (kurallar, birim, takvim yolu), `ProductActions.quoteBookingRange?`, `ProductActions.addBookingRange?`. Yeteneği olmayan tema çizmez; ürün "Sizi arayalım" formuna düşer. `product_main` yeniden çizilmez (adr/0066); takvimli ayrı iskelet istenirse yeni biçimdir.
- Sepet ve ödeme satırı: "10–14 Temmuz, 4 gece, 1 adet"; tutma geri sayımı aynen.
- Sipariş sayfası ve voucher: giriş ve çıkış günü ve saatleri, teminat notu.
- "Sizi arayalım" formu (A2): `details` alanına `from`, `to` (ikisi birlikte; ürünün saat diliminde bugünden pencere sonuna) eklenir; kişi verisi değildir.

### 11. İptal, bildirim, yaşam döngüsü

- İptal kademeleri, çevrim içi iptal ayarı, mağaza iptali ve iade yolu adr/0076 D7'deki gibidir; birim konaklamadır.
- Mağaza bir günü satılmışken kapatamaz; önce o konaklamayı iptal eder (panel etkilenen rezervasyonları gösterir).
- Yaşam döngüsü: ödenmiş sipariş girişe kadar "planlandı", giriş günü gelince "sürüyor", çıkış günü geçince "tamamlandı".
- Bildirimler mevcut dört iletidir (`booking.confirmed`, `reminder`, `cancelled`, `departure_cancelled`); içerik aralığa göre yazılır.
- Gelmeyen müşteri (no-show): iade yoktur; en yakın kademenin kesintisi geçerlidir (bugünkü kural).

### 12. Kapora, yerleşim, fatura, KVKK, SEO

- **Kapora (adr/0082):** konaklama tek "hizmet" sayılır; vade giriş gününe göre hesaplanır. Ek iş gerekmez.
- **Kişi sayısına göre fiyat (adr/0083):** sonraki dilimde aynı yerleşim kuralları (birim = adet, büyüklük = misafir sayısı).
- **Fatura:** satır "ürün adı, 10–14 Temmuz 2027, 4 gece" açıklamasıyla tek kalemdir. Konaklama vergisi ve teminatın belgesi: mali müşavir.
- **KVKK:** yeni kişi verisi yok (tarih ve adet). Katılımcı düzeyi ayarı aynen kullanılır. Konaklama tesisinin kimlik bildirme yükümlülüğü mağazanındır; platform bildirimi yapmaz.
- **SEO ve JSON-LD:** `range` üründe mevcut `Product` + `Offer` bloğu kalır; `Offer` fiyatı "en düşük gün fiyatı"dır ve `UnitPriceSpecification` ile birimi (gece ya da gün) yazılır. `VacationRental` üretilmez (fiyat alanı yok, yalnız Google'la çalışan siteler kullanabiliyor). Konaklamada tanım amaçlı `Accommodation` bloğu (kişi kapasitesi, olanaklar) R5'te değerlendirilir; zengin sonuç vaadi yoktur. Gecelik fiyat arama sonucuna yapılandırılmış veriyle değil görünür metinle (başlık, açıklama) taşınır. Tarih parametreli adresler (`?giris=&cikis=`) kanonik adrese işaret eder ve dizine girmez (docs/13 §7). Merchant beslemesi tarihli ürünü zaten göndermez.

## Para güvenliği ve kabul ölçütleri

| # | Risk | Kural | Kabul testi |
|---|---|---|---|
| G1 | Fiyatın ya da gece sayısının istemciden gelmesi | Gövde yalnız tarih, varyant ve adet taşır | Fiyat, gece sayısı ya da saat alanı 400 |
| G2 | Çift satış (çakışan aralıklar) | Bütün günler tek işlemde, koşullu `UPDATE` + `CHECK`; kimlik sırasıyla kilit | Son adet için kesişen iki aralık eşzamanlı istenir: yalnız biri tutar, diğeri hiçbir günü tutmaz; kilitlenme (deadlock) olmaz |
| G3 | Kısmi tutma | Ya hep ya hiç | Aralığın ortasındaki gün doluysa hiçbir günün `held` değeri değişmez |
| G4 | Süresi dolan tutmanın yer bloklaması | Okuma `expires_at > now()`; süpürme işi | Süre dolunca bütün günler aynı anda serbest kalır |
| G5 | Gün sayımı | `date` aritmetiği; `night` yarı açık, `day` kapalı aralık | Yaz saati haftasında 7 gece 7 gün fiyatlanır; çıkış günü başka girişe açıktır; günlük kipte aynı gün alış-iade 1 gündür |
| G6 | Kural atlatma | §6 sunucuda | Geçmiş tarih, ters aralık, pencere dışı, en az gecenin altı, 30 gecenin üstü 400 |
| G7 | Fiyatın sepetle ödeme arasında değişmesi | Tamamlamada yeniden hesap | Gün fiyatı panelden değişince açık sepet 409 |
| G8 | Kuruş ve para birimi | Toplam = gün fiyatlarının toplamı; indirim yarım yukarı | Dökümün toplamı satır tutarına eşit; EUR sepette farklı gün varsa ret |
| G9 | İptalde yanlış birim | İptal konaklamanın bütün günlerini tek cümlede kapatır | İptalden sonra her günün `sold` değeri tam olarak adet kadar düşer; ikinci iptal hiçbir şey değiştirmez; iade bir kez gider |
| G10 | Adet düşürme ve gün kapatma | `capacity >= sold + held`; satılmış gün kapanmaz | Satılmış günde adet 0 yapılamaz |
| G11 | Tutma kötüye kullanımı | En çok 30 gün × sepet başına adet sınırı; IP payı | Tek IP bütün yaz sezonunu tutamaz (mevcut `client_share` kuralı gün slotlarına da uygulanır) |
| G12 | Bayrak kapalı | Yeni yol kapalı | Bayrak kapalıyken `from/to` gövdesi ve `range` kaydı reddedilir; kalkış testleri değişmeden geçer |

## Dilimler

| # | Dilim | Büyüklük | Bağımlılık | Not |
|---|---|---|---|---|
| R0 | **Basit yol:** "Sizi arayalım" formunda giriş ve çıkış tarihi; panelde talebin aralığı | S | yok | Tek başına yayınlanır; `catalog.booking` yeter |
| R1 | Backend temel: bayrak, `bookable.range`, `booking_slot.day`, gün slotu üretimi ve işi, toplu gün düzenleme uçları | M | yok | Migration; yalnız backend |
| R2 | Satış: sepet rotası (`from/to`), tarih kuralları, fiyat ve fiyat sorusu, çok günlü tutma, tamamlama, `booking_stay`, iptal ve iade birimi | L | R1 | Fiyat ve ödeme yolu: güvenlik incelemesi; eşzamanlılık testleri |
| R3 | Panel: müsaitlik ve fiyat kartı, rezervasyon takviminde konaklamalar | M | R1 | |
| R4 | Vitrin ve tema sözleşmesi: aralık seçen takvim, döküm, sepet/sipariş/e-posta/voucher metinleri | L | R2 | Görünüm kilidi testi |
| R5 | Arama ve kart (adr/0077 uygunluk kuralı), JSON-LD, sektör paketi (konaklama, kiralama: yalnız veri) | M | R2, R4 | |
| R6 | İkinci plan kuralları: giriş/çıkış günleri, hazırlık günü, uzun kalış indirimi, tarihe özel en az gece | M | R2 | |
| R7 | Sonraya (ayrı kararla): çevrim içi hasar teminatı (sağlayıcı ön provizyonu ya da adr/0082 K4; A6), kişi sayısına göre fiyat (adr/0083 O1), tekil kaynak ve saatlik kip, takvim eşitleme (iCal) | | | |

R1 + R2 bitince konaklama yönetici API'siyle tanımlanıp uçtan uca satılabilir; R3–R5 deneyimi tamamlar.

**Üç ADR arasındaki sıra:** 0082 K0–K3 → 0083 → 0082 K4–K7 → 0084. Bu ADR sonuncudur: bugün müşterisi yok, en büyük iş (iki L dilim); kaporayla (vade giriş gününe göre) ve yerleşimle (kişi sayısına göre fiyat) birleşen parçaları onlardan sonra daha ucuza gelir. R0 küçüktür ve herhangi bir anda araya alınabilir.

## Kapsam dışı

- Saatlik kiralama ve belirli birimin atanması (plaka, oda numarası): A1 B.
- Başka sistemlerle takvim eşitleme (Airbnb, Booking.com, kanal yöneticisi, iCal): adr/0076'nın kapsam dışı satırı aynen.
- Konaklama vergisinin hesaplanması ve faturada gösterimi.
- Kimlik bildirme sistemlerine (KBS) bildirim.
- Konaklamanın tarihini değiştirme, uzatma, kısaltma.
- Farklı alış ve iade yeri, kilometre sınırı, sürücü yaşı gibi araç kiralamaya özgü kurallar (gerekirse ek seçenek ve katılımcı alanlarıyla).
- Çevrim içi hasar teminatı ve kart provizyonu (A6 B, C).

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Gün başına sayaç slotu (seçilen; adr/0076 §11)** | Sayaç, tutma, iptal, uzlaştırma ve takvim hazır; N adet ve N = 1 aynı yol; sezon fiyatı slot farkı | Gün satırları önceden üretilir; saatlik kullanım ve birim ataması yok; hazırlık günü N > 1'de ihtiyatlı |
| Tekil kaynak tablosu + `EXCLUDE USING GIST` (`resource_id WITH =, during WITH &&`) | Saat hassasiyeti; çakışmayı veritabanı garanti eder; birim ataması ve hazırlık payı kesin | Yeni tutma ve iptal yolu (sayaçla paralel ikinci motor); `btree_gist` eklentisi her mağaza veritabanında kurulmalı; "N adetten biri" sorusu için atama algoritması gerekir |
| Tarih aralığı = varyant ya da satır özelliği (Shopify uygulamalarının yolu) | Çekirdek sepetle uyumlu | Stok denetimi uygulamada kalır; bizim sayaç modelimiz zaten daha güçlü |
| Medusa envanteri (rezervasyonlu stok) | Çekirdek özellik | Tarih boyutu yok; adr/0076 K2 ile reddedildi |
| Aralığı tek slot olarak saklamak (`from`, `to`, kapasite hesabı sorguda) | Satır az | Müsaitlik her okumada aralık kesişimi sayar; fazla satışı kısıtla değil sorguyla önler (yarışa açık) |

## Sonuçlar

- Platform konaklama, günlük araç ve ekipman kiralamayı tur ile aynı modülde satar; adr/0076'nın "temel hazır" sözü tutulur.
- İki migration gelir (`bookable.range`, `booking_slot.day` + `booking_stay` ve `booking_slot_use.stay_id`), bir zamanlanmış iş ve tema sözleşmesine üç isteğe bağlı ek.
- Rezervasyon kodunda "birim kalkıştır" varsayımı "birim kalkış ya da konaklamadır" olur; iptal planı, hatırlatma, voucher ve e-postalar bu ayrımı okumak zorundadır.
- Gün slotları tablosu büyür (ürün başına yılda 365 satır); dizinler `(bookable_id, day)` üzerinden okunur, geçmiş günler arşiv niteliğindedir.

## Açık kalanlar

**Sahibe:**

- Bu kipi ilk kim kullanacak (konaklama mı, kiralama mı); varsayılanlar ona göre ayarlanır.
- Sektör paketi adları ve hazır görünümü (konaklama, kiralama) R5'te; sahibin örnek siteleri varsa.

**Hukukçuya:**

- Belirli tarihli konaklama ve araç kiralamada cayma hakkı istisnası (Mesafeli Sözleşmeler Yönetmeliği md. 15) ve ön bilgilendirme metni.
- Kısa süreli konut kiralamada izin belgesi ve ilanda belge numarası zorunluluğu (7464 sayılı Kanun md. 3–4; 31.12.2025 tarihli tebliğ): mağazanın kendi sitesi "ilan" sayılır mı; altyapı sağlayıcısı olarak bizim "aracı hizmet sağlayıcı" sorumluluğumuz doğar mı; belge numarası boşken konaklama ürününün yayımlanması engellenmeli mi.
- Araç kiralama yönetmeliği (RG 15.08.2026, yürürlük 01.01.2027; md. 4, 14, 16): teminatın biçimi ve tavanı; çevrim içi teminat almak istersek hangi yol uygun.
- Hasar teminatının sözleşmedeki yeri ve iade süresi (araç dışı kiralamada).

**Mali müşavire:**

- Konaklama vergisi (Gider Vergileri Kanunu md. 34; oran 31.12.2026'ya kadar %1): kim mükellef, izin belgeli konut tabi mi, faturada ayrı satır olarak nasıl gösterilir. Gerçek bir konaklama tesisi bu olmadan fatura kesemeyebilir: ilk konaklama müşterisinden önce ayrı iş olarak ele alınmalı.
- Konaklama ve kiralamada KDV oranı ve hizmetin ifa tarihi (fatura giriş gününde mi çıkışta mı).
- Hasar teminatının muhasebesi (gelir değil emanet) ve kesinti yapılınca belge.

**Sağlayıcılara (PayTR, iyzico):**

- Ön provizyon desteği, provizyonun kaç gün açık kaldığı, kısmi çekim (A6 C için).

**Teknik (kodlamadan önce):**

- Tek işlemde 30 satırlık `FOR UPDATE` ve koşullu `UPDATE`'in yük altında ölçümü (tutma süresi, kilit bekleme).
- `booking_slot` tablosunda gün slotlarıyla kalkış slotlarının aynı dizinleri paylaşmasının arama sorgularına etkisi (adr/0077 dizini `starts_at` üzerinde).
- Yapılandırılmış veri türü (yukarıda).
