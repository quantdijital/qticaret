# ADR-0077: Tarihli ürün araması, bayrağa bağlı bölümler ve Tam görsel kapak

- **Durum:** Kabul edildi (2026-11-23)
- **Tarih:** 2026-11-23
- **İlgili:** adr/0012 (özellik bayrakları), adr/0056 (arama dizini), adr/0061 (sektör paketleri), adr/0063 (hazır görünümler), adr/0066 (tema katmanları, biçim sözleşmesi), adr/0071 (yapay zekâ çekirdeği; bu ADR §10'una tek bir istisna ekler, bkz. §7), adr/0076 (tarihli ürün ve rezervasyon), docs/13 §6–§7 (robots, facet parametreleri), docs/22 (yapay zekâ uygulama planı)
- **Dayanak:** sahip (2026-11-23): tur satan mağazada müşteri "ne / nereye / ne zaman / kaç kişi" diye arayabilmeli; tarih kesin bir aralık ya da esnek bir ay olabilmeli (Skyscanner'daki gibi). Turizme uygun bir hazır görünüm gelsin (ilham: Dribbble "Nepalora": tam ekran manzara kapak, ortada başlık ve eylem, popüler tur kartları, rakam şeridi, numaralı adımlar, yorum kaydırıcı, fotoğraf kolajı, koyu alt bilgi).

## Bağlam

adr/0076 tarihli ürünü (kontenjanlı kalkış) getirdi; vitrinde kalkış ürün sayfasında seçiliyor, ama müşteri **tarihe göre arayamıyor**. Bugünkü arama yalnız metinle (`q`) çalışır, `q` boşsa `/arama` yalnız ileti gösterir; kategori ve tarih süzgeci yoktur. Kartta "en yakın kalkış" ve "…'den başlayan" fiyat zaten var (`workflows/booking/card-facts.ts`), ama bir tarih aralığına göre değil.

İkinci ihtiyaç görünüm: turizm mağazası için tam ekran görselli kapak, arama kutulu kapak, "yaklaşan kalkışlar" gibi bölümler gerekiyor. Bu bölümlerden bazıları yalnız tarihli ürün açıkken anlamlıdır; bugün **hiçbir bölümün bir bayrağa bağlanma yolu yok**: bayrağı kapalı mağaza da "Bölüm ekle" penceresinde bunları görür.

**Basit yol ilkesi (sahip, adr/0076 Ek "basit yol ayarları"):** her ayrıntılı çözümün sade bir karşılığı olmalı. Burada: arama kutusundaki her alan (kategori, tarih, kişi) tema ayarıyla kapatılabilir; kapalı alan formda görünmez. Doğal dille arama (§7) varsayılan kapalıdır ve yalnız mağaza açarsa gelir. Bayrağı kapalı mağaza bu işin hiçbir izini görmez (ne bölüm, ne parametre, ne ayar).

### Kodda bugün olan (2026-11-23 `dev`, okundu)

- **Bölüm biçimleri** `packages/types/src/store/section-variants.ts` ve backend `apps/backend/src/lib/storefront/sections/variants.ts` (eşitlik testiyle aynı tutulur). Hero biçimleri `standard`, `category_list`.
- **Arama:** `modules/search-index` (`sql/listing.ts`; plan `scope.product_ids` taşır; sıralar `relevance`, `newest`, `price_asc`, `price_desc`), uç `api/store/listings/products` (`type=search`), `workflows/seo/listing-plan.ts`, `listing-products.ts`. Ayrılmış parametre adları `lib/seo/facets.ts`. Vitrin `/arama` `noindex,follow`.
- **Kalkış:** `booking_slot` üzerinde tek indeks `(bookable_id, starts_at)`; boş yer `modules/booking/availability.ts` `openSlotsOf` (canlı tutmaları düşer). Kart sözleşmesi `packages/ui/src/booking-views.ts` `CardBookingView { next, nextAt }`.
- **Bayraklar:** `catalog.booking` (`modules/platform-settings/features.ts`). Vitrin `GET /store/storefront` yanıtındaki `features` bugün yalnız `gift_cards`, `product_addons` taşır.
- **Sektör paketi** `packages/sector-packs/packs/travel`: bayraklar, "Tur bilgileri" şablonu, kategoriler, sayfalar var; hazır görünüm yok. Hazır görünüm uygulanırken düşen bölümler raporlanır (`presets/resolve.ts`, `dropped` nedeni `missing | limit`).
- **Yapay zekâ:** yalnız personel kullanır; serbest istem yok; müşteri verisi gitmez (adr/0071 §2, §10). docs/22 akıllı aramayı kendi ADR'sine bırakmıştı.

## Kararlar

### 1. Tek arama kutusu bileşeni

Temada tek bir `SearchForm` bileşeni, sözleşmesi `SearchFormView` (`packages/ui/src/search-form-views.ts`). Üç yerde kullanılır:

- Hero "Tam görsel" biçiminde eylem "arama" seçilince (§9),
- yeni genel `search_box` bölümü (ana sayfa ve içerik sayfaları),
- `/arama` sayfasının üstü.

Alanlar tek bir **tema ayarından** gelir: `search_form { attribute_key, show_category, show_dates, show_people }`. `attribute_key` "nereye" alanının hangi seçim niteliğinden dolacağını söyler (travel paketinde `gidilecek_yer`, §11). Tur tipi = kategori. Tek "Kişi" alanı vardır ve yer sayısı demektir (yetişkin/çocuk ayrımı ürün sayfasında kalır).

Form **JavaScript olmadan çalışan bir GET formudur**; sonuç adresi §2'deki parametrelerle kurulur. Tarih seçici (takvim) sonradan gelen bir iyileştirmedir ve yalnız açılınca yüklenir (§6).

### 2. URL parametreleri (docs/13 §7'nin devamı)

| Parametre | Biçim | Kural |
|---|---|---|
| `kategori` | `<handle>` | Alt kategoriler dahil. |
| `tarih` | `YYYY-MM-DD_YYYY-MM-DD` | Bugünden sonra; aralık en çok 62 gün. |
| `ay` | `YYYY-MM[,YYYY-MM]` | En çok 3 ay; önümüzdeki 12 ay içinde. |
| `kisi` | `1..20` | `1` yazılmaz (varsayılan). |
| `sirala` | `kalkis` | Yeni değer: en yakın kalkışa göre. |

- `tarih` ve `ay` birlikte gelirse `tarih` kalır, `ay` atılır.
- Kanonik olmayan her biçim **tek 301** ile kanonik biçime gider (docs/13 §7 kuralı).
- `tarih`, `ay`, `kisi` yalnız `catalog.booking` açıkken okunur; kapalıyken 301 ile adresten atılır.
- `/arama`, `q` yokken de geçerli bir `tarih`/`ay` ya da `kategori` varsa sonuç verir.
- Bu adlar **ayrılmış parametre** olur: filtrelenebilir niteliğin anahtarı olamaz. Mevcut mağazalarda çakışan anahtar varsa süzgeçten çıkar; uygulama PR'ı bunu denetler ve not düşer.
- robots.txt şablonu bunlar için `Disallow` satırları üretir (bkz. "Sonuçlar ve riskler", docs/13 §7).

### 3. Uygunluk kuralı

Bir ürün aramaya, şu koşulların hepsini sağlayan en az bir kalkışı varsa girer:

- kalkış `open` durumda,
- satış kapanışı geçmemiş,
- seçilen aralıkta (ya da aylarda) başlıyor,
- `kapasite − satılan − canlı tutmalar ≥ kişi`.

Ay ve gün sınırları **ürünün saat diliminde** hesaplanır.

### 4. Sonuç kartı

`CardBookingView` iki isteğe bağlı alan kazanır: `left?: number | null` (kalan yer; kart "Son N yer" yazabilir) ve `inRange?: true` (gösterilen kalkış aramadaki aralıkta). Aralık verildiğinde "en yakın kalkış" aralıktaki ilk kalkıştır ve "…'den başlayan" fiyat yalnız aralıktaki kalkışlardan, **sunucuda** hesaplanır. Bu alanları taşımayan kartın çizimi değişmez (biçim sözleşmesi).

### 5. Fiyat sıralaması ve süzgeci

Fiyata göre sıralama ve fiyat süzgeci dizindeki fiyatı kullanır. Tarihli üründe dizin fiyatı: yer tutan fiyat kategorilerinin en düşük taban fiyatı (bebek gibi yer tutmayan kategori hariç). Kart ise aralığa göre fiyat gösterir; ikisi arasındaki fark **bilinen sınırdır** ve kayda geçer (sezonluk fiyat farkı büyükse sıralama karttaki fiyatla birebir örtüşmeyebilir).

### 6. Ay takvimi

`GET /store/departures/calendar`: gün başına en düşük fiyat ve kalkış sayısı. Yalnız TL. 60 saniye önbellek, hız sınırı, `catalog.booking` bayrağı. Tek istekte bakılan ürün kümesi en çok 1000 ile sınırlıdır (`ListingPlan.idsOnly`). Vitrinde takvim "Kesin tarih / Esnek ay" sekmeli, günün altında fiyatla; kodu yalnız takvim açılınca yüklenir.

**Uygulama notu (PR4, takvim backend'i).** `GET /store/departures/calendar?month=YYYY-MM[&kategori=<handle>][&kisi=1..20]` → `{ month, currency: "try", days: [{ date, from_price, departures }] }`; kalkışı olmayan gün yazılmaz. `month` aramanın okuduğu aylardan biri olmalı (bu ay + 11, `facets-dated.ts`), değilse 400; bilinmeyen parametre 400.

- **Akış** (`workflows/booking/calendar.ts`): ayda §3'e uyan ürünler (`departureMatches`, en yakın 1000) → arama dizininde kimlikle süzülür (`ListingPlan.idsOnly`: yalnız sayım + kimlik, sayfa en çok `IDS_ONLY_LIMIT` = 1000; yayımlanmış, alışverişçinin satış kanalı, `kategori` gösterilen alt ağacıyla) → yalnız hâlâ `booking_mode = departure` olanlar → tek SQL (`modules/booking/calendar.ts`: PR2'nin `windowStatement`'ı, `GROUP BY` yerel gün + bookable, gün başına kalkış sayısı ve ayrı fiyat farkı kümeleri; bütün değerler bağlı).
- **Fiyat** kartın kuralıyla sunucuda: misafir taban fiyatı + kalkış farkı, yer tutan kategoriler (`card-facts.ts` `payingPricesAt`, `basePrices` ortak). Birim **kartın `from_price`'ı gibi lira** (1750.5), kuruş değil: vitrinin bütün fiyat alanları bu birimde.
- Gün ürünün saat diliminde (`starts_at AT TIME ZONE timezone`); ay sınırı da öyle (PR2).
- `catalog.booking` kapalı: 404 (`requireFeature`, ilk ara katman). Hız sınırı `departure_calendar`: IP başına dakikada 60. Süreç içi önbellek 60 sn; anahtar ay + kategori + kişi + satış kanalları. Yanıt `Cache-Control: no-store`.
- Kapsam dışı (PR6 isterse): `q` ve nitelik süzgeci (ör. `gidilecek_yer`) takvimde yok; takvim kategori ve kişiyle daralır.

### 7. Doğal dille arama (isteğe bağlı üçüncü kat)

"Kendi cümlenle ara": müşteri "ağustosta iki kişi Kapadokya" yazar, sunucu bunu §2'deki süzgeçlere çevirir.

- **Kiracı bayrağı `ai.storefront_search`, varsayılan kapalı.** Yalnız mağazanın **kendi anahtarıyla** çalışır (`ai.own_keys`); platform kredisi bu işte kullanılmaz.
- İş `search_intent`. Çıktı katı Zod şemasıdır ve **yalnız süzgeç** taşır (kategori, nitelik değeri, tarih/ay, kişi). Kategori ve nitelik değeri mağazanın kapalı listesinden seçilir; listede olmayan değer atılır.
- Sonuçları normal arama üretir (§2–§3); model ürün seçmez, sıralamaz.
- "Anladığım:" etiketleri sunucunun **doğrulanmış süzgecinden** kurulur; modelin yazdığı metin müşteriye gösterilmez. Etiket bağlantıları `nofollow`.
- Servis düşerse ya da çıktı geçersizse sessizce `q=<metin>` aramasına dönülür.
- **adr/0071 §10 istisnası:** bu işte servise giden metin müşterinin yazdığı vitrin metnidir. Veri olarak gider (talimat sabit, metin ayrı veri bloğunda), `redactPersonalData`'dan geçer, **saklanmaz** (`ai_usage`'a metin yazılmaz; isteyen `"vitrin"` olarak kaydedilir). Kişisel veri isteyen bir alan yoktur.
- Sınırlar: IP başına dakikada 5, günde 30; mağaza başına günde 500 (varsayılanlar; tavan ortam değişkeniyle, `.env.example`'a yazılır). Aynı metin için 24 saat önbellek. Kötüye kullanım görülürse challenge eklenebilir.
- Uç `api/store/search/interpret`; PR'ı `security-reviewer`'dan geçer.

**Uygulama notu (PR7, backend).** Uç `POST /store/search/interpret` `{ text }` (tek satıra indirilir, 1–200 karakter, denetim karakteri yok) → `{ query, understood: [{ kind, label, param, value }], dropped: [{ kind, reason }], fallback? }`. Kod: `lib/ai/search-intent/` (istem, okuma, yanıt, önbellek), `lib/ai/facts/search-lists.ts` (kapalı listeler), `workflows/ai/interpret-search.ts` ve `steps/search-intent.ts`, iş kaydı `lib/ai/registry/search-tasks.ts`.
- **Bayrak kapalı → 404** (`requireFeature`, uç yokmuş gibi); anahtar yok, `ai.own_keys` kapalı, tavan dolu, servis düştü, çıktı şemaya uymadı ya da süzgeç boş kaldı → 200 `fallback: true`, `query: "q=<metin>"` (metin site aramasının okuduğu 100 karaktere kırpılır).
- İş `search_intent` personel iş listesinde (`aiTasks()`) **yoktur**; rolü boştur, öneri ucu onu çalıştıramaz. Servis yalnız `own_key` olanlardan seçilir; tercih okunmaz (kişi yok).
- **Günlük tavan ayrı sayaçtır** (`ai_daily_usage.limit_group = storefront_search`): personelin `text` tavanını ve aylık `llm_credits_per_month`'u tüketmez, onlardan da etkilenmez. `AI_STORE_SEARCH_DAILY_LIMIT` (varsayılan 500) platformun değeridir; diğer tavanlardan farklı olarak yükseltilebilir (anahtar mağazanın), 0 kapatır. Servis işi almadıysa talep geri verilir.
- Hız sınırı iki profil: `ai_store_search` (adres başına dakikada 5), `ai_store_search_daily` (günde 30); gövde okunmadan önce. Challenge eklenmedi (kötüye kullanım görülürse `challengeOver` ile).
- Çıktı: `.strict()` şema; tanınmayan alan bütün yanıtı reddeder. Her parça ayrı okunur: kategori yalnız gösterilen kategorilerin handle'ı; nitelik yalnız herkese açık, süzülebilir, URL'de okunan (ayrılmış adla çakışmayan) seçimli niteliğin değeri; `tarih`/`ay` `facets-dated` kurallarından (aralık aya üstün gelir); `kisi` 1–20; tarihli ürün kapalıysa tarih ve kişi `not_offered`. `q` yalnız müşterinin cümlesinde (ayıklanmış hâliyle) geçen sözcükleri tutar: model sözcük ekleyemez, ayıklanan kişisel veriyi geri getiremez. `dropped` yalnız tür ve neden taşır, modelin metnini taşımaz.
- `understood` etiketleri mağazanın adlarıdır (kategori, nitelik değeri); tarih ve ay sunucuda `tr-TR` ile biçimlenir; `kisi` etiketi yalın sayıdır (vitrin çeviri anahtarıyla "N kişi" yazar).
- Önbellek süreç belleğinde, anahtar "bugün + katlanmış cümle" (göreli tarih ertesi gün başka aralıktır), 24 saat, en çok 2000 kayıt; yalnız servisin verdiği yanıt tutulur. Zaman aşımı 8 sn (müşteri bekliyor). Kullanım satırında `requested_by = "vitrin"`, kayıt alanları boş; log satırı yalnız sayı ve kod, geri dönüşte yalnız neden kodu.
- Bakımda (adr/0053) uç kapalıdır; askıdaki mağazada POST ile okuma (`read`) sayılır. Bayrağın panel anahtarı ve çevirisi PR9'da.
- **KVKK, PR9 için zorunlu (güvenlik incelemesi O-1):** `redactPersonalData` kişi adını ve posta adresini ayıklamaz. Bu yüzden PR9 (a) arama kutusunun altında "kişisel bilgi yazmayın" ipucunu, (b) bayrak açılırken panelde sahibe uyarıyı (cümle yurt dışındaki servise, mağazanın kendi sözleşmesiyle gider; aydınlatma metnine satır eklenmeli) getirir; bayrak panelden bunlar olmadan açılmaz. Aydınlatma metni şablonuna (`lib/legal/starters/privacy-notice.ts` 6. madde ve taslak notu) satır bu PR'da eklendi.
- Adresi okunamayan vitrin çağrısı (`isShopperAddressUnknown`, adr/0076 Ek D5) servise gitmez, hız sınırından önce düz aramaya döner: bütün bu müşteriler vitrinin tek adresini paylaşır. Önbellek anahtarı ayıklanmış ve katlanmış cümlenin anahtarlı özetidir (`PII_HASH_KEY`). Vitrin çağrıları kendi devre kesicisinde (`<servis>:storefront`) sayılır; personelin kesicisini açmaz.
- **Takip:** çok adresten dağıtık tüketime karşı challenge eşiği (ör. günlük tavanın yarısı dolunca `challengeOver`); kötüye kullanım ölçülünce.

### 8. Bayrağa bağlı bölümler

Yeni bir eşleme: `SECTION_REQUIRES` (`packages/types/src/store/section-requires.ts` ve backend `lib/storefront/sections/requires.ts`, eşitlik testiyle), ör. `{ departures: "catalog.booking" }`.

- Bayrak kapalıyken bölüm panelde "Bölüm ekle" penceresinde **görünmez**; vitrinde **çizilmez** (backend okumada atlar, vitrin de ikinci kez denetler).
- Kayıtlı bölüm **silinmez**; panel ağacında "kapalı" işaretiyle durur. Kayıt reddedilmez (bayrak geri açılınca her şey yerinde).
- Hazır görünüm uygulanırken bu bölümler düşürülür; `dropped` nedeni `feature_off`, uygulama penceresi bunu söyler.
- Sektör paketi okuyucusu, bayrağı açmayan bir pakette bu bölümleri kullanan hazır görünümü reddeder.
- "Bölüm ekle" penceresi gruplu olur; bayrağa bağlı bölümler yetenek adıyla bir grupta toplanır ("Tarihli ürünler").
- Görünüm kilidi fikstürü `features` alanını paketin bayrak dosyasından alır.
- `GET /store/storefront` `features` yanıtına `booking` eklenir.

### 9. Hero "Tam görsel" biçimi

Yeni biçim `full_image`; `standard` ve `category_list` **dokunulmaz** (adr/0066 biçim sözleşmesi). Ayarlar:

- `action`: `button` | `search` (varsayılan `button`; `search` §1'deki kutuyu koyar),
- `height`: `screen` | `tall`,
- `scrim`: `light` | `strong` (görsel üstü karartma),
- `align`: `center` | `start`.

Görsel yoksa koyu zemin. Başlık `h1` kalır. Kapak görseli LCP adayıdır; önden yüklenir (preload).

### 10. Yeni bölümler

- **Genel** (her mağaza): `stats` (rakam şeridi), `steps` (numaralı adımlar), `photo_collage` (fotoğraf kolajı); `reviews` iki biçim alır: `grid` (bugünkü çizim) ve yeni `carousel`.
- **Tarihli ürüne özgü:** `departures` ("Yaklaşan kalkışlar"; `catalog.booking`'e bağlı, §8). Veri `GET /store/departures`.
- **Tur programı (itinerary)** bu ADR'de yok: veri biçimi sahibin kararına bırakıldı (öneri: tarihli üründe gün başlığı + metin listesi).

**Uygulama notu (PR5a, `stats` ve `steps`).** Sözleşme `packages/types/src/store/section-stats.ts`, `section-steps.ts`; backend aynası `lib/storefront/sections/stats.ts`, `steps.ts` (eşitlik testi). Ana sayfa ve içerik sayfaları alır; ürün ve kategori sayfası almaz.

- `stats` "Rakam şeridi": başlık isteğe bağlı (yoksa liste ekran okuyucuya "Rakamlarla" adıyla); 2–6 öge `{value ≤16, label ≤48, text ≤120 isteğe bağlı}`; ayar `dividers` **on**/off ("Ayırıcı çizgileri göster", Diziliş). Çizim `dl`; değer büyük, sayaç/animasyon yok.
- `steps` "Numaralı adımlar": başlık (boşsa vitrinin "Nasıl işler?"), giriş ≤240, 3–6 adım `{title ≤60, text ≤240 isteğe bağlı}`, isteğe bağlı tek bağlantı; ayarlar `layout` **row**/column ("Yan yana / Alt alta"), `numbers` **padded**/plain ("01, 02 / 1, 2"), ikisi Diziliş'te açık. Çizim `ol`; basılı numara `aria-hidden`.
- Zemin ve hizalama bölümün kendi ayarı değil, ortak `look.ground` / `look.align` (bilesen-standardi §0.5: bir kavram bir takım); panelde Stil › Görünüm. `steps` uzun metin taşıdığı için `primary` zemin sunulmaz (adr/0062 §6), `stats` sunar.
- `SECTION_VARIANTS`'a girmediler: tek çizim var; biçimsiz kayıt varsayılan okunduğu için ikinci biçim geldiğinde liste ilk sıradaki bugünkü çizimle açılır, göç gerekmez.
- Bilerek yok: ikon/görsel (adımlar sade numara), düğme stili (tek bağlantı temanın ana düğmesi), telefon sütun ayarı (rakam telefonda ikişer, adımlar alt alta).

### 11. travel paketi sürüm 2

- Yeni seçim niteliği **"Gidilecek yer"** (`gidilecek_yer`): filtrelenebilir; üründe tek değer, süzgeçte çoklu seçim. Arama kutusunun "nereye" alanı bunu kullanır.
- Hazır görünüm **"Rota"** (`travel/presets/rota`): Hero `full_image` + arama → ürün kaydırıcısı "Popüler turlar" → `departures` → `stats` → `steps` → `reviews` carousel → `photo_collage` → e-bülten; alt bilgi `brand_columns` koyu zemin (`ground: stage`); başlık yazı tipi Playfair (mevcut `HEADING_FONTS`, yeni kod yok). Görseller Commons CC0 / CC BY.

### Ek (2026-11-23): tur kartı görünümü ("Vadi" ve "Patika" için)

İlham: Pomaii "Popular Destinations" (görsel üstü yazı, puan rozeti) ve Wanderly "Curated Just for You" (rozet, "5 gün • 4 gece", "kişi başı", ok). Biçim sözleşmesi gereği yeni biçim değil, tema düzeyindeki `product_card`'a **ayar** olarak geldi; hepsinin varsayılanı bugünkü kart, kilitli görünümlerin HTML'i değişmedi (yalnız `styles.lock.json`'da yeni `card-over.css` özeti).

- `text_position`: `below` (bugünkü) | `over` ("Yazının yeri"). Yalnız standart kartta; çerçeveli ve kompakt kart kendi çizimini korur. `over`'da ad, alt satır ve fiyat (sağda) fotoğrafın altındaki grafit geçişin üstünde, sahnenin açık mürekkebiyle; yıldız satırı yok, puan rozet olarak çizilir; tek bağlantı adın bağlantısıdır ve bütün kartı kaplar. Bilinen sınır: bu düzende dokunmatik ekranda ikinci fotoğraf kaydırması bağlantının altında kalır (dokununca ürün açılır).
- `rating_badge`: yıldızlar açıkken ortalama fotoğrafın sol üstünde "★ 4,8" rozeti olarak, yıldız satırı yerine. Kompakt kart satırını korur.
- `arrow`: standart kartta (yazı altta) fiyat satırının sonunda yuvarlak ok; `aria-hidden`, bağlantı ya da düğme değil.
- `duration_row` ve `per_person`: yalnız tarihli kartta (`booking`) çizilir; panelde yalnız `catalog.booking` açıkken görünür. Süre kart bilgisinde `booking.duration_days` olarak gelir: travel paketinin "Tur bilgileri" şablonundaki `sure` (sayı, gün) niteliğinden, herkese açık ve 1–365 tam sayıysa (`lib/booking/duration.ts` `DURATION_KEYS`, `MEETING_POINT_KEYS` deseni); yalnız bayrak açıkken okunur. Vitrin "5 gün • 4 gece" yazar; gece sayısı gün − 1 (varsayım: turun son günü dönüş), tek günlük tur "1 gün".
- **Ürün rozeti ("Çok satan", "Yeni") bu ekte yok:** ürüne bağlı bir rozet/etiket verisi bugün yok (Medusa etiketleri vitrine okunmuyor, kartta etiket alanı yok). Yeni veri icat edilmedi; karar sahibin (öneri: ürün kataloğunda tek kısa "kart rozeti" metni ya da Medusa etiketlerinden biri, kartın sol üst rozet listesine eklenir).

### Varsayılanlar

Tek "Kişi" alanı = yer sayısı; tur tipi = kategori; `search_box` ana sayfa ve içerik sayfalarına eklenebilir; takvim yalnız TL; doğal dil kapalı; arama kutusunun bütün alanları açık (mağaza tek tek kapatabilir).

## Uygulama sırası

En çok iki paralel dal; bölüm kayıtlarına dokunan iki PR aynı dalgada olmaz.

| Dalga | PR | İçerik |
|---|---|---|
| 0 | PR0 | Bu belge, docs/13 ve docs/22 notları. |
| 1 | PR1 ‖ PR2 | Bayrağa bağlı bölüm altyapısı (§8; ilk liste boş, kilit etkisi yok) ‖ arama backend'i: uygunluk, kısmi indeks migration'ı, yeni parametreler ve robots satırları, `kalkis` sıralaması, kategori alt ağacı, `q`'suz sonuç, kart bilgisinde aralık (§2–§5). |
| 2 | PR3 ‖ PR4 | Tek arama kutusu + `/arama` + `search_box` + `search_form` tema ayarı + kartta "Son N yer" ‖ ay takvimi backend'i (§6). |
| 3 | PR5a ‖ PR6 | `stats`, `steps` ‖ takvim arayüzü. |
| 4 | PR5b ‖ PR7 | `photo_collage`, `reviews` carousel ‖ doğal dil backend'i (§7; güvenlik incelemesi zorunlu). |
| 5 | PR8 ‖ PR9 | Hero `full_image` ‖ doğal dil arayüzü ve panel anahtarı. |
| 6 | PR10 → PR11 | `departures` bölümü (`SECTION_REQUIRES`'e girer) → travel paketi v2 + "Rota" (yeni kilit örneği `travel-rota`). |
| sonra | PR12 | Tur programı (sahip kararından sonra). |

Rezervasyon dosyalarına dokunan açık bir iş dalı (talep formu) varken PR2 ve PR10 onun birleşmesini bekler.

## Sonuçlar ve riskler

- **Performans.** `booking_slot(starts_at)` üzerinde kısmi indeks (`WHERE status = 'open' AND deleted_at IS NULL`) zorunludur. Canlı tutma toplamı yalnız aralıktaki kalkışlar için alınır. Sorgu planları EXPLAIN testleriyle kilitlenir. Takvimde ürün kümesi en çok 1000. Arama sayfası en çok 3 istekle kurulur, N+1 yok. Takvim kodu yalnız açılınca yüklenir. Tam ekran kapakta LCP görseli önden yüklenir.
- **SEO.** `/arama` `noindex,follow` kalır. robots.txt'e `tarih`, `ay`, `kisi` ve `sirala=kalkis` için `Disallow` satırları eklenir. "Anladığım" etiketleri ve takvim bağlantıları `nofollow`. Hero'da `h1` korunur. Yeni ayrılmış adlar, aynı anahtarlı bir niteliği süzgeçten çıkarır (uygulama PR'ında denetim notu).
- **Güvenlik ve KVKK.** Doğal dil ucu herkese açık bir LLM kapısıdır: hız sınırı, günlük tavan, önbellek, gerekirse challenge; çıktı yalnız süzgeçtir, eylem tetiklemez; metin saklanmaz ve kullanım kaydına yazılmaz. adr/0071 §10'a istisna bu ADR'nin §7'sidir; bayrak varsayılan kapalı ve yalnız mağazanın kendi anahtarıyla.
- **Biçim sözleşmesi.** Mevcut biçimler yerinde değişmez: Hero'ya yeni biçim, `reviews`'a yeni biçim (eski çizim `grid` adıyla aynen), kart alanları isteğe bağlı. Yeni Atölye CSS dosyaları `styles.lock.json`'u değiştirir; bilerek `pnpm lock:presets`, PR'a "HTML aynı, yalnız stil özeti". Paralel PR'larda kilit örnekleri çakışabilir: rebase sonrası kilit yeniden yazılır.
- **Bilinen sınır.** Fiyat sıralaması dizin fiyatıyla, kart fiyatı aralıkla (§5).
- **Bilinen sınır (takvim, §6).** Ayın en yakın 1000 ürünü, satış kanalı ve kategori süzgecinden **önce** seçilir; süzgeç sonra uygulanır. Sızıntı yoktur (başka kanalın ya da kategorinin ürünü hiç görünmez), ama ayda 1000'den çok tarihli ürünü olan mağazada takvim bazı günleri eksik gösterebilir.

## Açık

- **Kart ürün rozeti verisi** ("Çok satan", "Yeni", tur kartı eki): veri kaynağı sahibin kararı.

- **Tur programı verisi** (gün gün plan): biçim sahibin kararı; öneri tarihli üründe `itinerary` alanı (gün başlığı + metin). Karar gelene kadar bölüm yazılmaz.
