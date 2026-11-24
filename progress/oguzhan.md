# Oğuzhan — oturum notları

> Yalnız Oğuzhan'ın oturumlarının notları; en yeni en üstte. Ortak durum `PROGRESS.md`'de.

## 2026-11-24: adr/0077 PR9, doğal dille arama arayüzü ve panel anahtarı

- **Dal:** `oguzhan/dogal-dil-arayuz`. Vitrin: `/arama?q=<≥3 sözcük>` bayrak açıkken `POST /store/search/interpret` ile süzgece çevrilir, işaretli kanonik adrese 307 (`_anlam=1`), orada "Anladığım:" çipleri (nofollow, kaldırılabilir); hata/kapalıda düz `q` araması. Kutunun altında KVKK ipucu (yalnız bayrak açıkken). Backend: `features.natural_search`, bayrak yazımı yalnız sahip. Panel: Ayarlar › Yapay zekâ anahtarı + onay penceresi (Özellikler sayfasında da). ADR'ye PR9 notu.
- **Sıradaki işler:** `security-reviewer` (public uç tüketimi, KVKK); üst bilgi canlı aramasına ipucu (takip).
## 2026-11-24: hazır görünüm boşlukları, handle ile kategori ikonu ve her üst bilgide eylem düğmesi

- **Dal:** `oguzhan/ikon-ve-ust-dugme`. `categories`/`icons`'a `category_icons_by_handle` (kimlik > handle > görsel > baş harf); `highlight_link` (katalogdaki eylem düğmesi) `standard` ve `centered` üst bilgide de; panelde "Eylem düğmesi". Kilitli görünümlerin HTML'i ve stil özeti aynı. adr/0077 dalga 7 Ek.
- **Sıradaki işler:** #312 birleşince Vadi'ye kategori ikonları (handle ile), Patika'ya üst bilgi düğmesi.
## 2026-11-24: tur görünümleri ekran denetimi düzeltmeleri (#312)

- **Dal:** `oguzhan/seyahat-paketi-v2` (`dev` birleştirildi). Kargolanmayan üründe kargo/teslimat/iade vaadi yok (`promisesFor`, ücretsiz kargo satırı da); kapakta yandaki görsel taşan kartların başladığı yerde biter, güven kutusu varken arama kutusu aynı genişlikte; arama kutusu telefonda iki sütunlu ızgara, tarih alanları 1024 px'ten en az 10rem; ikonlu kategori sırası 4 ve altı öğede ortada; görsel üstü kartta fiyat başlığın altında; yaklaşan kalkışlar telefonda sıkı satır, Rota alt yazısı veriye uygun; bant `medium` örtüde bulut yumuşadı; tarihli sonuçta "Yalnızca stokta olanlar" yok, aramada "N sonuç"; paket kategorilerinde `visible` (travel'da dört ana tür açık); Patika/Vadi e-bülten metinleri; Ayder görselinin koyu sağ kenarı kırpıldı; tur görünümlerinde `hover_image` açık (sahip 2026-11-18).
- **Açık:** kapak güven şeridinde tura uygun rozetler (rozetler mağazanın, adr/0063 §4; paket varsayılanı tasarım belgesine taslak/yayın yazımı ister); galeri oranı ayarı yok; kuruşsuz fiyat ayarı yok.

## 2026-11-24: adr/0077 PR11, `travel` paketi v2 ve "Rota", "Vadi", "Patika"

- **Dal:** `oguzhan/seyahat-paketi-v2` (#290 departures + #309 Hero full_image üstüne; taban `dev`). Paket sürüm 2: "Tur bilgileri" şablonuna seçim niteliği `gidilecek_yer` (filtrelenebilir, 9 bölge değeri; önceki sürümü almış mağazaya yalnız bu nitelik eklenir). Üç hazır görünüm (yalnız veri): Rota (tam ekran kapak + arama, popüler turlar, yaklaşan kalkışlar, koyu rakam şeridi, adımlar, yorum kaydırıcı, kolaj, koyu `brand_columns` + e-bülten, Playfair), Vadi (yanda dalgalı görsel, taşan arama ve güven kutusu, görsel üstü yazılı kart, ikonlu kategoriler, tanıtım paneli, bölünmüş bant, ikonlu rakamlar), Patika (duyuru şeridi, sola hizalı kapak + sekmeli arama, rota kartları kolajı, ikonlu "neden biz", oklu tur kartları, geniş bant, yorumlar, yazılar, iletişim sütunlu alt bilgi). Görseller Commons CC0/CC BY, atıf `preset.json` `credits`.
- **Kilit:** yeni örnekler `travel-rota`, `travel-vadi`, `travel-patika`; kilit dükkânına `/store/departures` ve `/store/listings/products` (Nereye) yanıtları (`fixture-dated.ts`), mevcut örnekler değişmedi.
- **Açık:** kategori ikonları hazır görünümden seçilemez (`category_icons` kimlikle anahtarlı); menüler ve önizleme görseli yok; Rota'da "ortadaki büyük kart" ve kart fiyat rozeti, Patika'da üst bilgide düğme, ürün rozeti yok.

## 2026-11-24: adr/0077 PR6, arama kutusunda takvim

- **Dal:** `oguzhan/takvim-arayuzu` (#288'in dalı üstüne). Vitrin ara ucu `/api/search/calendar` (parametre doğrulama, fiyat sunucuda yazılır); temada `SearchDates` + `DatePicker` (Kesin tarih aralığı en çok 62 gün, Esnek ay en çok 3, gün altında en düşük fiyat, klavye, telefonda alt sayfa). JavaScript'siz form ve sunucu HTML'i aynı; yeni CSS yok, kilit değişmedi. ADR §6 "Uygulama notu (PR6)".
- **Sıradaki işler:** #288 birleşince bu PR'ın tabanı kendiliğinden daralır; tarayıcıda elle bakış (telefon alt sayfası, fiyat sığması).

## 2026-11-24: adr/0077 PR8, Giriş bölümüne "Tam görsel" biçimi (#309)

- **Dal:** `oguzhan/kapak-tam-gorsel` (#288 `oguzhan/arama-kutusu` üstüne kurulu; taban `dev`). Hero'ya üçüncü biçim `full_image`; `standard` ve `category_list` çizimine dokunulmadı. Ayarlar (kapalı liste, ilki varsayılan): `action` (düğme / arama kutusu, #288'in tek `SearchForm`'u), `search_position` (içinde / alt kenara taşan kart), `height`, `scrim`, `align`, `image_side` (arkada / yanda), `edge` (düz / dalgalı, `hero-full.css` maskesi), `title_accent` (aynı `h1` içinde ana renkte ikinci satır), `show_trust` (ortak güven rozetleri, en çok 4, taşan beyaz kutu). İkinci düğme mevcut `links`'in ikincisi. Görsel yoksa grafit sahne (`end` de `full` gibi çizilir). Zincir: `packages/types` `section-hero-full.ts`, backend `sections/hero.ts` + `hero-full.ts`, `packages/ui` `HeroFullView`, vitrin `views/hero-full.ts`, Atölye `HeroFull.tsx` + `HeroBlock.tsx`, panel `hero-full-fields.tsx` + `hero-full-registry.ts`; adr/0077 §9 eki.
- **Kilit:** `pnpm lock:presets` bilerek; HTML aynı, yalnız `styles.lock.json`. Görsel yuvası taraması 34 → 35, gölge taramasına `sections/HeroFull.tsx`.
- **Açık:** tarayıcıda gözle bakılmadı, `style:capture` koşulmadı ("Rota" hazır görünümü, PR11 öncesi 390 ve 1440 px'te bakılacak); backend typecheck yerelde dokunulmayan `scripts/bootstrap`, `scripts/seed` dosyalarında TS7006 verdi (CI'da bakılacak); el yazısı not ve kapakta video düğmesi kapsam dışı.

## 2026-11-22: adr/0076 D7b, rezervasyon e-postaları, hatırlatma, voucher

- **Dal:** `oguzhan/rezervasyon-bildirim`. Backend: dört düzenlenebilir ileti (onay, hatırlatma, iptal, mağazanın kalkış iptali; onay ve iptaller zorunlu), rezervasyon "sayfası" okuyucusu (kalkış ürünün saat diliminde, `kalkis_yeri` niteliği, kişi sayısı, satış anındaki kademeler + paket tur tabanı; katılımcı yok). Onay `order.placed` onayından ve uzlaştırmadan, iptaller `booking.cancelled` olayından (`by: shop` → kalkış iptali şablonu); hata iptali/onayı bozmaz. Saatlik `booking-reminders` işi (`reminder_days`, varsayılan 2, 0 kapalı; `reminded_at` işareti). Voucher: rezervasyon başına 80 bit Crockford kod (düz + benzersiz indeks, karar ADR'de), `GET /store/orders/:id/voucher` (yalnız siparişin sahibi), `POST /admin/booking-vouchers/check` (her rol, hız sınırı, denetim kaydı). Migration `Migration20261123010000`. Panel: Siparişler'de "Voucher doğrula", rezervasyon ayarında "Hatırlatma (gün önce)", ileti adları. Vitrin: `/siparis/:id/voucher` temanın içerik sayfasıyla (tema değişmedi). ADR Ek "D7b".
- **Sıradaki işler:** PR'ın `security-reviewer` incelemesi (doğrulama kodu, kişi verisi) ve birleşme; PDF voucher, sipariş sayfasında voucher bağlantısı (tema sözleşmesi), SMS hatırlatma sonraya.
- **Açık (acentayla):** paket tur sigortası poliçesinin voucher'a eklenip eklenmeyeceği.

## 2026-11-22: adr/0076 D7a, planlandı aşaması, iptal kademeleri ve iade

- **Dal:** `oguzhan/rezervasyon-iptal`. Backend: "Planlandı" aşaması (tarihli sipariş hizmet gününe dek), iptal kademeleri (ürün saat diliminde takvim günü, paket turda 30 gün tabanı), kalkış başına iptal (önce iade, sonra yer; `booking_slot_use.cancelled_at` migration), kalkış iptali (arka planda tam iade, uzlaştırma işi), müşteri/personel uçları, iade/değişim talebinde tarihli satır reddi. Panel: "Planlandı" etiketi, iade ayarında paket tur anahtarı, rezervasyon ayarında kademe düzenleyici, kalkış iptalinde önizleme (rezervasyon/sipariş/yer, toplam iade), sipariş sayfasında "Rezervasyonlar" kartı (kademe ya da tamamı, önizleme → onay; sahip/yönetici). Vitrin: sipariş sayfasında "Rezervasyonlarınız", "İptal talebi" → iade tutarı → "İptali onayla" (tutar gönderilmez); tema sözleşmesinde isteğe bağlı `bookings`/`cancelBooking`. ADR Ek D7a.
- **Bilinen sınır:** kesintili iptal edilen sipariş "Planlandı/Tamamlandı" görünmeye devam eder.
- **Güvenlik incelemesi kapandı (aynı PR):** havale/kapıda ödeme/hediye kartı ile ödenmiş ya da ödenenden fazla pay elle iade (zil `booking.refund_by_hand`, müşteriye "mağazayla görüşün"), ödemesiz tarihli sipariş son kalkışla iptal, iptal edilmiş kalkışlı siparişte havale onayı/çekim reddi, kademeler onayda kopyalanır (`booking_slot_use.cancellation`, yeni migration), sepet tutmaları kalkış iptalinde silinir, toplu iptal POST yalnız sayılar; ADR Ek "D7a güvenlik incelemesinin kapanışı". CI kırığı: sipariş satırı adedi `items.detail.quantity` olmadan boş geliyordu (iade hep 0).
- **Sıradaki işler:** CI yeşil olunca birleşme; kredi payını karta geri yazma (ayrı iş); D7b e-postalar (iptal, kalkış iptali), hatırlatma, PDF voucher.

## 2026-11-22: adr/0076 D8, `travel` paketi, yasal belge satırı, tarihli ürün SEO

- **Dal:** `oguzhan/turizm-paketi`. Paket şemasına eklemeli `catalog.json` (yeni ürünün türü ve tarihli satışı, yapılandırılmış veri türü) ve `pages.json` (taslak sayfalar); backend bunları yeni `catalog` ayar bölümüne ve içerik sayfalarına yazar (defter türleri `page`, `setting`, migration). `travel` paketi: bayraklar, "Tur bilgileri" şablonu, 10 kategori, taslak iptal koşulları sayfası (hazır görünüm yok, sonraya). Ürün sihirbazı mağazanın varsayılan türüyle başlar, "Tarihli satış" anahtarı. Yasal kimlikte "Faaliyet belgesi" (ad, numara, sahip): vitrin alt bilgisi ve künye; ödeme sayfası #270 sonrası. Tarihli üründe `TouristTrip` (ya da `Event`) bloğu, kargo/iade alanı yok; beslemeler tarihli ürünü göndermez. Yapay zekâ okuyucusu değişmedi (açık nitelikler zaten gidiyor). ADR Ek "D8".
- **Sıradaki işler:** D6b (#270), D7; panelde `catalog` ayar kartı; ödeme sayfasında belge satırı; `travel` hazır görünümü.

## 2026-11-22: adr/0076 D6b, katılımcı ekranları ve KVKK başvurusu

- **Dal:** `oguzhan/rezervasyon-katilimci-ekran`. Panel: ürünün rezervasyon ayarında katılımcı düzeyi; kalkışın rezervasyon listesinde katılımcılar, "Numarayı göster" (sahip/yönetici, yeniden doğrulama, 30 sn), yazdırılabilir katılımcı listesi (dışa aktarım yok); Müşteriler > Katılımcı başvuruları (arama POST, tam ad eşleşmesi, numara özetle; JSON kopya; yeniden doğrulamalı silme). Backend: arama/silme uçları, yetenek `travelerRequests`, alıcının veri dökümüne `katılımcılar` (maskeli). Tema sözleşmesi `travelers` adımı, Atölye formu; vitrin `/odeme?adim=katilimcilar` (yalnız katılımcı isteyen kalkış varken, ödemeden önce), sunucu eylemi alanları seviyeye göre denetler. Görünüm kilidi değişmedi. ADR Ek D6b, `docs/kvkk-envanter.md`.
- **Bilinen sınır:** kayıtlı numara vitrine dönmez, form yeniden açılınca numara yeniden yazılır; backend 400'ü alan adı taşımaz (alan hataları vitrinde).
- **Sıradaki işler:** PR'ın güvenlik incelemesi (`security-reviewer`) ve bulguların kapatılması, birleşme; D7 yaşam döngüsü, iptal kademeleri, e-postalar; D8 `travel` paketi, JSON-LD.
- **Açık (hukukçu):** katılımcı saklama süresi (180 gün öneri).

## 2026-11-22: adr/0076 D5 takibi, kartlarda "…'den itibaren" ve en yakın kalkış

- **Dal:** `oguzhan/tarihli-kart-fiyat`. `GET /store/card-facts` tarihli ürüne `booking { from_price, next_departure, … }` ekler (yalnız `catalog.booking` açıkken; sayfa başına tek fiyat ve tek kalkış okuması; bebek kategorisi fiyata girmez). Tarihli üründe kart hızlı ekleme yok. Tema sözleşmesinde `ProductCardView.booking?`; Atölye kartı "1.750,50 TL'den itibaren" + "En yakın: 12 Ara" ya da "Yakında yeni tarihler". Diğer kartlar ve görünüm kilidi değişmedi. ADR Ek "D5 takip: kart fiyatı".
- **Sıradaki işler:** D6b (panel katılımcılar, vitrin `travelers` adımı; ayrı PR #270), D7, D8; hızlı bakıştan kalkış seçimi sonraya.

## 2026-11-22: adr/0076 D6, katılımcı bilgisi (backend)

- **Dal:** `oguzhan/rezervasyon-katilimci`. `booking_traveler` tablosu (migration): ad, soyad, doğum tarihi, uyruk düz; kimlik/pasaport no şifreli + özet + son 4. `GET/POST /store/carts/:id/travelers` (bayrak, satış kanalı, `booking` hız profili; kişi sayısı Σ adet × pax); ödeme başlangıcı ve tamamlama `booking.travelers_missing`; sipariş onayında rezervasyona aktarım; panel listesinde maskeli katılımcılar (denetlenen okuma), tam numara `POST /admin/booking-travelers/:id/reveal` (sahip/yönetici, yeniden doğrulama, denetim kaydı). Saklama: hizmet tarihi + 180 gün, terk edilen sepette 2 gün (`compliance-retention`); KVKK silmesi bağlandı. ADR Ek D6 (vitrin ucu sözleşmesi), `docs/kvkk-envanter.md`.
- **Güvenlik incelemesi:** kritik/yüksek yok; orta ve düşük bulgular aynı PR'da kapandı: aktarım rezervasyonun aldığıyla sınırlı (fazlası silinir, istenmeyen alan boşalır), aktarılamayan katılımcıları uzlaştırma işi yeniden bağlar (üç denemede olmazsa panel uyarısı), terk edilen sepet silmesi sepet kilidi altında, kalkış tarihi değişince silme tarihi yeniden hesaplanır, kısa numarada son 2 hane, metin içi log maskesi, sınır testi genişledi.
- **Sıradaki işler:** D6b panel (ürün ayarında katılımcı düzeyi, listede katılımcılar, "Numarayı göster") ve vitrin `travelers` adımı; veri dökümüne katılımcılar; D7, D8.
- **Açık (hukukçu):** katılımcı saklama süresi (180 gün öneri).

## 2026-11-22: adr/0076 D5, vitrinde kalkış seçimi ve geri sayım

- **Dal:** `oguzhan/rezervasyon-vitrin`. Tema sözleşmesine isteğe bağlı rezervasyon alanları (`packages/ui/src/booking-views.ts`); Atölye ürün sayfasında kalkış ve kategori adetleri ("Son N yer", "Yakında yeni tarihler"), sepette/ödemede "Yerleriniz MM:SS ayrıldı" geri sayımı; `GET /store/carts/:id/bookings`; imzalı "adres bilinmiyor" (`isStorefrontUnsigned` kaldırıldı); sepette kargo gerektiren kalem kalmayınca kargo yöntemini sunucu kaldırır (abonelik + ödeme başlangıcı). Mevcut görünümler değişmedi (görünüm kilidi yeşil).
- **Sıradaki işler:** D6 katılımcı bilgisi (şifreli, KVKK, `security-reviewer`); D7 yaşam döngüsü, iptal kademeleri, e-postalar; D8 `travel` paketi, JSON-LD. Sonra kartlarda "…'dan itibaren" ve en yakın kalkış.

## 2026-11-22: adr/0076 D4, panelde tarihler ve kontenjan

- **Dal:** `oguzhan/rezervasyon-panel`. Katalog bilgilerinde "Tarihli satış (kalkışlı)" aç/kapat (kapatırken stok takibi uyarısı ve ilerideki yer sayısı); ürün sayfasında "Tarihler ve kontenjan" kartı (kalkış ekle, yinelenen kalkış en çok 60, kapasite/fiyat farkı, kapat/aç/iptal, katılımcılar = siparişler), "Rezervasyon ayarları" ikinci planda. Yeni okuma ucu `GET /admin/booking-slots/:id/bookings` (kişi verisi yok).
- **Sıradaki işler:** D5 vitrin (kalkış seçimi, kategori adetleri, geri sayım); D6 katılımcılar paneldeki "Katılımcılar" penceresine eklenir.

## 2026-11-22: yapay zekâ işleri tamam (adr/0074 G1–G7), tarihli ürün ve rezervasyon başlıyor (adr/0076)

- **Sıradaki işler (Deniz için not: çakışma olmasın diye buraya bak):**
  1. adr/0076 D1: kargosuz vitrin ödemesi (`apps/storefront` checkout adımları, `packages/ui` `CheckoutView.steps`, Atölye ödeme sayfası, iyzico `itemType`, sipariş e-postası). Ödeme dokunur, `security-reviewer`.
  2. adr/0076 D2: yeni `booking` modülü (migration), `product_extension.booking_mode`, bayrak `catalog.booking`.
  3. Sonra D3–D8 sırayla (ADR'deki dilim tablosu). Yavaş gidilecek; Deniz dönünce hızlanır.
- **Biten (hepsi `dev`'de):** adr/0074 K1–K3 ve G1–G7: #234, #236, #237, #247, #248, #250, #251, #252, #254, #256, #257, #258, #259; ayar kaydı yarışı #249; kararsız testler #253, #255.
- **Sahip kararı (2026-11-22):** turizm acentası müşterisi için tur satışı; sektöre özel kod yok, yetenek ürün düzeyinde, `travel` sektör paketi veri olarak. Deniz telefonda onayladı.
- **Açık (kod dışı):** paket turda KDV/fatura (mali müşavir), katılımcı verisi saklama süresi ve sözleşme metinleri (hukukçu), kapora için sağlayıcı desteği.

## 2026-11-21: yazım yönergesinin bağlanması, "Dene", kabul oranı (adr/0074 K2 sonu)

- **Sıradaki işler:**
  1. K3: gelişmiş talimat (`craft` düzenleme, sürüm etiketi, varsayılana dön).
  2. Sıcaklık servis kayıtlarında hâlâ kapalı (servis sayfaları doğrulanınca açılacak).
  3. Bu PR birleşmeden önce `security-reviewer` (migration + istem değişikliği).
- **Dal:** `oguzhan/ai-yonerge-baglama`. Yönerge metin işlerinin sistem iletisine giriyor (görsel/JSON işlerine değil), `POST /admin/ai/guidance/preview`, `GET /admin/ai/acceptance`, `content_draft.accepted_index` (migration), #237 bulguları D1/D2/B1–B4 kapandı.

## 2026-11-18 – 2026-11-19: gerçek serviste yapay zekâ denemesi, panel görünümü, Tezgâh rötuşları

- **Sıradaki işler:**
  1. Yapay zekâ genişletme 2 adayları (sahiple seçilecek): ürün özellik değerlerini açıklama/fotoğraftan doldurma, etiket ve kategori önerisi, kategori/koleksiyon açıklaması, koleksiyon/marka/yazı SEO kartlarında öneriler, SSS taslağı, varyant adları, kısa açıklama.
  2. Koyu temada dolu kırmızı "Sil" düğmesinin yazısı soluk (önceden de böyle; #216 sırasında görüldü).
  3. Hata bildirimi 4 sn'de kayboluyor, docs/18 "kalıcı" diyor; sahip "şimdilik kalsın" dedi.
  4. Kredi aşaması notları sürüyor (`product_description` çıktı tavanı, `image_scene` maliyeti).
- **`dev`'e giren PR'lar:**
  - Panel: Ayarlar › Yapay zekâ sıkı tablo (#211), sonucun renginde bildirimler (#212), ürün fiyat/stok hizası (#213), Vazgeç düğmeleri `cancel` türü ve denetim testi (#216).
  - Yapay zekâ: odak anahtar kelime ve ürün adı önerisi (#217), kota tükenmesi ile yoğunluk ayrımı + görsel penceresinde "başka servisle dene" (#215), özel sahne tarifi ve mağazanın kayıtlı sahneleri (#220).
  - Tema: açılış slaytı satırı germiyor (#214), slayt denetim ayarları + yuvarlak ok düzeltmesi + dar karoda başlık ölçekleme (#219), kategoriler bölümüne "Fotoğraf panoları" biçimi ve Tezgâh ×3 geçişi (#218).
- **Gerçek servis denemesi (sahip):** MiniMax anahtarı geçerli ama bakiye 0 (402/1008); Gemini AI Studio ücretsiz anahtarıyla metin önerileri çalıştı, görsel düzenleme ücretsiz katmanda yok (429 → artık `ai.provider_quota`); Photoroom sandbox ile sahneye yerleştirme çalıştı (filigranlı).
- **Kararlar:** Vazgeç kırmızı metin/çerçeve, dolu kırmızı yalnız yıkıcı eylem; yapay zekâ araçları gelişmiş ama arayüz sade (işin yerinde tek düğme, ileri seçenek ikinci planda); sahneler sektör paketinden gelir, mağaza kendi sahnelerini kaydeder (ayar deposu `ai_scenes`, en çok 12, migration yok).
- **Sahibe not:** Tezgâh görünümleri yine değişti (Fotoğraf panoları); demo mağazada Görünümler'den Tezgâh yeniden Uygulanmalı.

## 2026-11-17 – 2026-11-18: serbest düzen alt bilgi, e-bülten biçimleri, yapay zekâ çekirdeği

- **Sıradaki işler:**
  1. Yapay zekâ Aşama 2-2 (ürün açıklamasında ✨ düğmesi; eski `/admin/content-drafts*` uçları, `content.ai_drafts` bayrağı ve `content_draft` hız profili kalkıyor) ve Aşama 3 (SEO advisor bulgusunda "Yapay zekâyla düzelt"): dallarda sürüyor.
  2. Sonra Aşama 4 (arka plan temizleme; media modülü, Deniz'in video dilimleriyle aynı modül, migration çakışmasına bakılacak), 5 (görsel alt metni). Aşama 8 (fotoğraftan video) Deniz'in video yükleme hattı bitmeden başlamaz; bizim iş yalnız "üret" adımı olur.
  3. Kredi aşamasından önce: `product_description` tek kredi ama çıktı tavanı geniş → işe özel `maxTokens` ya da çıktıya göre kredi (#181 notu).
  4. Düzen okuması bilinmeyen bölüm türünde hata veriyor (geri almada 500 riski); okumada bilinmeyen türü atlamak (#180 notu).
- **`dev`'e giren PR'lar:**
  - E-bülten kutusu: dört biçim (`split`, `image_card`, `strip`, `in_footer`) + açıklama/not/görsel alanları; Tezgâh `split` (#161, #163, #164).
  - Serbest düzen alt bilgi (adr/0070): sözleşme ve backend #166, tema çizimi #169, panel düzenleyici #172, alt bilgi grubu (zengin metin, güven rozetleri, kayan yazı) #180, Tezgâh ×3 serbest düzene geçti #184 (yeni ayarlar: bülten "Alt bilgiyle birleşik", marka bloğunda adres).
  - Yapay zekâ çekirdeği (adr/0071, docs/22): ADR #160, saf kütüphane #162, servis hesapları ve `ai.own_keys` #167, modül/akış/uçlar #170, Ayarlar › Yapay zekâ #173, ortak bileşenler #175, SEO başlık/açıklama önerisi backend #177 ve panel #182, ürün açıklaması backend #181.
  - Menü bağlantılarında vitrinde ikinci denetim + alt bilgide dış bağlantıya `rel` (#183).
- **Kararlar (sahip uzaktayken, sahibe bildirildi):** yapay zekâ tercihi kullanıcı başına + mağaza yedeği; `ai.own_keys` kredi çıkana kadar her pakette açık; günlük tavan metin 500 / görsel 100 / video 10; sahte servis yalnız development'ta. SEO kartında piksel göstergesi yok, karakter sayacı kalıyor. Ürün açıklaması işine mevcut açıklamanın 2.000 karakteri gider (SEO işleri 300).
- **Sahibe not:** Tezgâh görünümleri değişti; demo mağazada Görünümler'den Tezgâh yeniden Uygulanmalı. Yapay zekâ önerileri gerçek servisle henüz elle denenmedi (CI sahte servisle koşuyor).

## 2026-11-16 gündüz: raf biçimleri, marka logosu boyutu, panel küçük işleri

- **Sıradaki işler:**
  1. Güvenlik sertleştirmesi: marka logosu olarak depodaki herhangi bir dosya anahtarı kabul ediliyor; yalnız kütüphane kaydı olan görsel kabul edilmeli (#115 güvenlik incelemesi, Bilgi-1).
  2. "Mağazayı görüntüle": üretim derlemesinde alan adı bağlı değilken vitrin adresi yapılandırması (`VITE_STOREFRONT_ORIGIN`) gerekir, yoksa düğme çıkmaz.
  3. Panel şerit satırındaki resim ile vitrinin çizdiği resim farklı olabilir (vitrin görselsiz kategori/marka için en yeni ürünün fotoğrafını çiziyor).
  4. Panel ana sayfasında 768 px'te kurulum adımları listesi yatay taşıyor (önceden var olan kusur).
  5. "Sıralı liste" rafında 1024 px "Tek sıra" düzeninde artı düğmesi ve indirim rozeti küçük görselde sıkışık.
- **`dev`'e giren PR'lar:**
  - #104 `CLAUDE.md` CI maddesi (Actions PR'larda koşuyor).
  - #105 şerit satırında kaynağın resmi.
  - #106 "Mağazayı görüntüle" alan adı yokken de.
  - #109 ürün rafı "Sıralı liste" biçimi (`ranked`).
  - #108 ürün rafı "Sahne ve liste" biçimi (`stage_list`).
  - #115 marka logosu boyutu (brands `logo_width`/`logo_height`, migration, doldurma betiği `brand-logo-sizes:backfill`); güvenlik incelemesi yapıldı.
- **Kapanan karar:** Tezgâh'ın çip, foto zemini ve gölge basamakları: sahip kararı 2026-11-16, bugünkü kalsın.
- **Kural hatırlatması:** Yeni tasarımlar eski görünümleri ezmez, alternatif biçim olarak eklenir (sahip, 2026-11-16).

## 2026-11-15 akşam – 2026-11-16 gece: çapraz şeritler, sekmeli düzenleyici, Tezgâh bölümleri

- **`dev`'e giren PR'lar:**
  - #81 şerit notu ve üst bağlantılar.
  - #82 öne çıkan üründe çapraz şeritler.
  - #83 marka logoları.
  - #84 kategori kolajı.
  - #86 arama simgesi, kategori paneli zemini, Esc ve önizleme düzeltmeleri.
  - #87 bölüm boşlukları tek kaynaktan, Üst/Alt boşluk ayarı, ince şerit kuralı, boş sayfalama kutusu.
  - #89 şerit çekirdeği (`parts/Strips.tsx`) ve ortak `strips_*` ayarları.
  - #91 düzenleyicide İçerik/Stil/Gelişmiş sekmeleri, kapalı gruplar, bölüm içi ayar araması (docs/18 §7.1 kuralı).
  - #90 yeni bölüm "Çapraz şeritler" (`strip_gallery`, 2–8 şerit, her şeride kaynak).
  - #92 ürün rafına "Çapraz şeritler" biçimi (`strips`; `strips_count` 2–8, varsayılan 5; yükseklik varsayılanı Alçak; kart eylemleri bilerek yok; telefonda yana kaydırma).
- **Kanıt düzeni:** Her bölüm işi çalışan sistemde geçici yöneticiyle taslak önizlemesinde Chromium + WebKit, 1440/768/390 denendi (konsol, CSP, yatay taşma, bağlantılar); panelde sekme/grup yerleşimi ve canlı önizleme betikle doğrulandı. Geçici yönetici her turdan sonra silindi.
- **Dersler:**
  1. Yeni panel alanı `field-registry.ts`'te bir gruba bağlanır; grubu `panel-groups.ts` sekmeye yerleştirir. Kapalı grup yüzünden düşen testte önce grup açılır (`settings-groups.fixtures.ts` `openGroup`).
  2. Aynı http spec dosyasındaki testler veritabanını paylaşabiliyor (siparişler kalıyor); çok satan sıralamasında adetler önceki durumların üstünde seçilir.
  3. Vitrin geliştirme sunucusu dal değişimini kaçırabiliyor; değişen dosyalara dokunup geri almak ("nudge") yeniden derletiyor.
- **Yerel durum:** Taslakta Tezgâh; "Tezgâhtan seçmeler" şerit bölümü ve "Çok satanlar" rafı Çapraz şeritler biçiminde (sahip görsün diye). Yayın değişmedi.

## 2026-11-15 gündüz: görünüm izolasyonu, stil takımı, öğe düzeyinde "Düzenle"

- **Amaç:** İki geliştiricinin hazır görünümleri birbirini bozmasın (adr/0066 tema katmanları, adr/0067 stil takımı), stil takımının beş adımını koda taşımak, canlı düzenleyicide Faz 2 ve Faz 2b.
- **`dev`'e giren PR'lar:**
  - #39 başlık testi düzeltmesi, #40 düzenleyici Faz 2 (önizlemede bölüm üstünde "Düzenle"), #51 düzenleyici ağacında ipucu.
  - #41 "Aynı işi iki kez yapma" kuralı, #46 "Yayımlanmış biçim sözleşmedir" kuralı, #50 ADR-0066, #53 ADR-0067.
  - #52 ve #55 görünüm kilidi testi (çerçeve, ana sayfa, ürün, liste; `pnpm lock:presets`), #58 çözülmüş stil denetimi (`pnpm style:capture`, `pnpm style:diff`), #59 stil takımı sözleşmesi.
  - #43 bakım kapısı (bakımda yazma yolları kapalı).
  - #42 menü resimleri ayarı (`header_bar.menu_images`: all, submenus, off), #49 açılış panosu slayt gösterisi.
  - Stil takımı: #62 `chip_style`, #63 `media_ground`, #65 `menu_style`, #66 `shadow`, #64 `surface_style` kapsamı (80 kutu `gf-pane` / `gf-pane-inner`), #67 işaretlerin portallara ulaşması (`frame/root-marks.ts`, `frame/Layers.tsx` `LayerPortal`), #72 çizgili stilde sepet özeti, adet denetimi ve Tezgâh'ta çizgili stilin çekmece ve pencerelere ulaşması.
  - Düzenleyici Faz 2b: #68 öğe düzeyinde "Düzenle" (`data-qf`, yalnız geçerli düzenleyici oturumunda) ve güvenlik düzeltmeleri (basış kapısı: çerçeve odakta ve saniyede 4, geçerli oturum koşulu), #71 kalan bölümler (SSS, bant, kayan yazı, rozetler, sekmeler, sütunlu raf, fiyat bantları, katalog üst bilgisi, alt bilgi bülteni).
  - #70 yakınlaştırma kapanınca odak düğmeye döner, `CLAUDE.md`'ye stil denetimi komut satırı.
- **Kanıt düzeni:** Tema çizimine dokunan her PR'da `style:diff` dev ile dal arasında koşuldu (varsayılanlarda değer farkı yok), varsayılan dışı basamak tarayıcıda gözle bakıldı. Son `dev`'de vitrin 1482, panel 1392 test yeşil.
- **Dersler:**
  1. Kökteki `data-*` işareti Radix portallarına ulaşmaz. Katmanlar `LayerPortal` ile çizilir, çıplak `Dialog.Portal` kullanımını test yakalar.
  2. Taşıyıcı yalnız kit basamağı varsayılan dışındayken açılıyordu, bu yüzden Tezgâh'ta çizgili stil çekmecelere ulaşmıyordu (#72).
  3. Ortak geliştirme DB'sinde taslağa yazılan yeni alan, alanı tanımayan dalın önizlemesini 500'e düşürür. Deneme sonrası taslak eski hâline yazılır.
  4. Ana klasörde dal değiştirmek backend'i yeniden başlatır, sahipsiz kalan eski süreç portu tutabilir (`EADDRINUSE`). Vitrin sunucusu dal değişimini kaçırabilir.
  5. wt klasörlerinde backend typecheck 8 hata verir (`apps/backend/.medusa/types` yok). Ana klasörde 0 hata.
  6. Docker Desktop kapanırsa Redis düşer, vitrin her sayfada 500 verir.
- **Yerel durum:** Taslakta Tezgâh (yayın değişmedi, yayında Grafit). `free_shipping_threshold` geçici 1500 duruyor (geri alınacak). Bakım kapalı.
- **Doğrulanmayanlar:** Safari ve iOS (Playwright'ta WebKit kurulu değil), gerçek üretim derlemesinde CSP (kurallar geliştirme sunucusunda taklit edildi, ihlal yok), hesap ve sipariş sayfalarında çizgili stil (demo veride yok), hızlı bakış ve taksit penceresinde stil takımı (yerelde açılamadı).
- **Sıradaki işler:**
  1. Tezgâh'ın yeni basamakları seçmesi (çizgili çip, sayfa zemini, menü stili, gölge): sahibin göreceği karar, yalnız `layout.json` verisi.
  2. `deniz/katalog-ust-sade`: menü stili ve gölge adımları `dev`'de, dal bunların üstüne kurulabilir (adr/0067 §5).
  3. Faz 2b: "Tümünü gör" bağlantıları ve alt bilgi çubuğu işaretli değil. `slide-dialog.tsx` ve `use-live-preview.ts` 300 satırın üstünde.
  4. Yoğunluk basamağı (`density`) ve tema ayarlarının ayar araması (adr/0067 açık kalanlar).
  5. Üretim CSP'sinde http demo medya ve satır içi stil ihlali.
  6. Bakım modu Store API'de uygulanmıyor.

## 2026-11-15 gece: Tezgâh görünümü ve tarayıcı turları

- **Amaç:** Sahibin referans resmindeki klasik teknik katalog düzeninden, bıçak içeriğiyle ikinci hazır görünüm "Tezgâh" (`packages/sector-packs/packs/cutlery/presets/tezgah`; renk kardeşleri `tezgah-lacivert`, `tezgah-turuncu`). Kod sektörsüz. Tasarım dili `docs/tema/tezgah-tasarim-dili.md`.
- **`dev`'e giren PR'lar:**
  - #19 üst bilginin `catalog` biçimi (yardımcı şerit, arama, telefon, Kategoriler paneli, menü zemini, vurgulu bağlantı).
  - #20 ürün rafı biçimleri (grid, carousel, featured, compact, columns), kompakt kart, ortak kaydırma takımı (`scroller`).
  - #21 `categories` `linked` biçimi; alt bilgide sosyal simge, yazılı ödeme rozetleri, yukarı çık.
  - #22 Tezgâh görünümü.
  - #23 `docs/tema/bilesen-standardi.md` ve `bilesen-denetimi.md`.
  - #24 denetimin küçük işleri (içerik alanları ayar aramasında, "Diğer ayarlar", "Görsel bant").
  - #25, #27, #30, #33, #34 Tezgâh tarayıcı turlarının düzeltmeleri (yeni tema ayarları `section_spacing`, `surface_style`; "Daha fazla" menü açılırı; sepet sayacı kontrastı; büyük kart).
  - #26 ortak `device` ayarı, duyuru şeridi biçimleri (`mode` first/rotate/inline), SSS `open_first`/`single_open`, `columns_mobile`, benzer ürünlerde biçim ve kart.
  - #28 kart ayarları (etiket aç/kapatları, `sold_out_row`, `no_reviews`, `button_style`), tema ayarları ayar aramasında.
  - #29 raf `tabs` ayarı, giriş slaytı ortak kaydırma takımında, zemin adı `light` → `well`.
  - #32 çökme düzeltmesi ve `client-boundary.spec.ts` koruma testi, benzer ürünler için store alanı `*categories`.
- **Açık PR:** #31 hızlı bakış penceresi (tema ayarı `quick_view`, varsayılan kapalı; `GET /api/quick-view`). security-reviewer: kritik, yüksek, orta yok; 3 düşük bulgu kapatıldı. Birleşmeden önce: ana klasörde http `theme-settings` testi, tarayıcıda açılış kontrolü.
- **Dersler:**
  1. Sunucu bileşeni `"use client"` dosyasındaki bileşen olmayan bir fonksiyonu çağırınca sayfa 500 veriyor, vitest yakalamıyor (PR #28 ile `dev`'e girdi, #32 ile kapandı).
  2. CSS düzeltmesi gözle bakılmadan birleşince büyük kart fotoğrafı kayboldu (#33 → #34). Kural: arayüz PR'ı tarayıcıda doğrulanmadan birleşmez; SSR 200 yetmez.
  3. Yerelde backend http testleri `ADMIN_MFA=off` ister.
  4. Alt ajan komutlarında heredoc ile dosya yazmak izin sorusu çıkarıyor; betik Write ile yazılır.
- **Yerel durum:** Taslakta Tezgâh uygulu (yayın yok; yayındaki düzen değişmedi). Mağaza ayarında `free_shipping_threshold` geçici 1500 (geri alınacak). Önizleme: panel > Tema düzenleyici.
- **Bilinen açıklar:**
  - Önizlemede arama ve `/sepet` önizlemeden çıkıyor (adr/0065 Faz 1 kapsamı).
  - Yukarı çık düğmesi 1024 px ve telefonda içeriğe 12–20 px biniyor.
  - Büyük kartta yatay fotoğrafın üstünde ve altında ton bandı var.
  - `bilesen-denetimi.md`'deki (c) büyük işler; puana göre sıralama, karşılaştırma, özel rozetler.
  - adr/0064 (görünüm kitaplığı) ve adr/0065 (canlı düzenleyici) işleri başlamadı.
- **Sıradaki:** #31'i kapat; adr/0065 Faz 1 (güvenlik incelemesi şart); kalan Tezgâh kusurları; adr/0064 G1.
- **Açık sorular (sahibe):** Varsayılan renk takımı (antrasit + kırmızı / lacivert + çelik / antrasit + turuncu). Demo mağaza verisi (telefon, sosyal adres, blog yazısı, Kasap alt kategorileri kapalı).

## 2026-11-14: Atölye tamamlama, Faz 1 ve Faz 2 başlangıcı

- **Plan:** `docs/tema/atolye-tamamlama-plani.md` (Faz 0–6, sahip kararları, ek istekler E1–E8, maket seçimi). Yeni tema yazılmıyor; Atölye tamamlanıyor, sonra aynı temadan hazır görünümler çıkıyor.
- **Biten:** Faz 0 (adr/0062, adr/0063), Faz 1 (Atölye bütün tema ayarlarını uygular; `dev`'de). Faz 2 iş 2.1 (tema ayarı ve menüler düzen taslağına, önizlemeye ve yayına girer) ve 2.2 (hazır görünüm şeması, yükleyici, `grafit` görünümü): `oguzhan/hazir-gorunum-altyapisi` dalında, PR açık.
- **Kararlar:** adr/0049 Ek 2026-11-14 (bölüm biçimleri, yeni bölüm türleri, üst bilgi ve menü modeli, kategori başına düzen, bölüm başına gelişmiş CSS) ve adr/0063 Ek 2026-11-14 kabul edildi.
- **Deniz'in alanına dokunanlar (bu PR):** backend düzen belgesi ve menü akışları, denetim kaydı kaynağı, `packages/sector-packs` (`general` paket sürümü 1 → 2), üst panel sayım tipi ve sahte sağlayıcı.
- **Sıradaki:** iş 2.3 (`applyPresetWorkflow`), bölüm `variant` altyapısı (adr/0049 eki §9), ardından klasik katalog takımı.
- **Not:** `pnpm verify:changed` bu makinede paralel koşuda zaman aşımı kaynaklı sahte kırmızı veriyor; `--concurrency=1` ile yeşil. Yerelde `ADMIN_MFA=off` varsa `mfa.unit.spec.ts` düşer (turbo ortam değişkenini geçirmiyor); tek başına `ADMIN_MFA= pnpm test:unit` ile geçiyor.
