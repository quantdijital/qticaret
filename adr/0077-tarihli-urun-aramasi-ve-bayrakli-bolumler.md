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

**Uygulama notu (PR3, 2026-11-23):**

- **Form alan adları.** JavaScript'siz GET formu `tarih=A_B` yazamadığı için iki gün alanı `tarih_baslangic` ve `tarih_bitis` adıyla gider; vitrin bu "form adresini" tek bir geçici yönlendirmeyle (307) temiz adrese çevirir: iki gün tek `tarih` olur, boş alanlar ve `kisi=1` atılır. Backend'in başka biçimde okuduğu sorgu (`canonical_query`) ise §2'deki gibi tek 301 ile kanonik adrese gider. Takvim (PR6) bu alan adlarını değiştirmez; JavaScript açıkken de aynı adları doldurur.
- **Tema ayarı.** `search_form`'a beşinci alan olarak `category_style` (`select` açılır liste, varsayılan; `tabs` sekmeler) eklendi; panelde "Tema › Arama kutusu" grubu. Tarih ve kişi anahtarları yalnız `catalog.booking` açıkken görünür; kategori görünüşü yalnız kategori alanı açıkken. "Nereye" listesi filtrelenebilir, herkese açık, seçimli nitelikleri gösterir; ayrılmış adlar (§2) backend şemasında reddedilir, panelde listelenmez.
- **"Grafit'e dön" arama kutusu alanlarını korur.** Bu düğme görünüşü sıfırlar; arama kutusunun alanları görünüş değil, mağazanın sorduğu sorulardır (işlev). Bu yüzden sıfırlama `search_form`'a dokunmaz ve "zaten Grafit mi" denetimi onu karşılaştırmaz.
- **`left` yalnız az yer kalınca gönderilir.** §4'teki `left?: number | null` yerine sözleşmede `left?: number` var: vitrin alanı yalnız kalan yer 1–5 iken (`FEW_LEFT`) doldurur, aksi hâlde hiç yazmaz. "Bilinmiyor" ile "çok yer var" ayrımını temaya taşımaya gerek yok; tema yalnız "Son N yer" yazıp yazmayacağını bilir, `null` dalı olmadığından her tema aynı eşiği kullanır.
- **"Nereye" değerleri** `/magaza` listesinin süzgeç (facet) değerlerinden gelir; yalnız satılan ürünlerde geçen değerler listelenir.
- **Nitelikle sözcüksüz arama (görev dışı eklendi).** `/store/listings/products` artık `q` yokken yalnız bir nitelik süzgeciyle de cevap verir; "Nereye" seçilip başka hiçbir şey yazılmayan form boş sayfa yerine sonuç gösterir. §2'deki "`q` yokken de sonuç" kuralının nitelik süzgecine genişletilmesidir.
- **Sıralama.** Tarihli aramada "En yakın tarih" (`sirala=kalkis`) seçeneği sunulur.
- **Kilit etkisi yok.** Atölye'de form ve bölüm yalnız var olan Tailwind sınıflarıyla çizildi; yeni CSS yok, kilitli görünümlerin HTML'i ve stil özeti (`styles.lock.json`) aynı kaldı.

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

**Ek (2026-11-24): tarihli fiyat sırası.** Bilinen sınır kapandı. Sorguda `tarih` ya da `ay` varken fiyat sıralaması, fiyat süzgeci ve süzgecin fiyat aralığı, eşleşen ürünlerin (en çok 1000) aralıktaki kalkışlarının yer tutan kişi başı en düşük fiyatını kullanır; değer kartın "…'den başlayan" fiyatıyla aynı hesaptır (`bookingCardFacts`, tek fiyat mantığı; bölgenin para birimi, bugün TL). Ürün kümesinin tamamı için tek ürün, tek bölge, tek fiyat ve tek kalkış okuması yapılır (N+1 yok, `workflows/seo/listing-dated-prices.ts`); sonuç aynı arama için 30 saniye bu süreçte tutulur. Ürün başına fiyat dizin sorgusuna bağlı bir `jsonb` değer olarak girer (`ListingPlan.price.by_product`); kapsam zaten bu ürünlerle sınırlıdır, yeni indeks gerekmez. Aralıkta fiyatı olmayan ürün sıralamada sona düşer, fiyat süzgecinde görünmez. Tarih yokken dizindeki taban fiyat kullanılır; sorgu metni ve bağlı değerler öncekiyle birebir aynıdır. Güvenlik: tarihli yolda `region_id` mağazanın bölgelerinden (60 sn önbellekli liste) çözülür; bilinmeyen bölge `listing.region_unknown`, bölgenin para biriminden farklı `currency_code` `listing.currency_mismatch` ile 400 döner (kart bölgenin para birimiyle fiyatlar). Önbellek anahtarı yalnız sunucunun doğruladığı değerlerden kurulur; aynı anahtara eşzamanlı istekler tek hesabı paylaşır. Hesaba girilen ürün sayısı en çok 1000'dir. `tarih`/`ay` içeren liste isteği `listing` sınırına ek olarak kendi `dated_listing` sınırına (IP başına dakikada 60) tabidir.

### 6. Ay takvimi

`GET /store/departures/calendar`: gün başına en düşük fiyat ve kalkış sayısı. Yalnız TL. 60 saniye önbellek, hız sınırı, `catalog.booking` bayrağı. Tek istekte bakılan ürün kümesi en çok 1000 ile sınırlıdır (`ListingPlan.idsOnly`). Vitrinde takvim "Kesin tarih / Esnek ay" sekmeli, günün altında fiyatla; kodu yalnız takvim açılınca yüklenir.

**Uygulama notu (PR4, takvim backend'i).** `GET /store/departures/calendar?month=YYYY-MM[&kategori=<handle>][&kisi=1..20]` → `{ month, currency: "try", days: [{ date, from_price, departures }] }`; kalkışı olmayan gün yazılmaz. `month` aramanın okuduğu aylardan biri olmalı (bu ay + 11, `facets-dated.ts`), değilse 400; bilinmeyen parametre 400.

- **Akış** (`workflows/booking/calendar.ts`): ayda §3'e uyan ürünler (`departureMatches`, en yakın 1000) → arama dizininde kimlikle süzülür (`ListingPlan.idsOnly`: yalnız sayım + kimlik, sayfa en çok `IDS_ONLY_LIMIT` = 1000; yayımlanmış, alışverişçinin satış kanalı, `kategori` gösterilen alt ağacıyla) → yalnız hâlâ `booking_mode = departure` olanlar → tek SQL (`modules/booking/calendar.ts`: PR2'nin `windowStatement`'ı, `GROUP BY` yerel gün + bookable, gün başına kalkış sayısı ve ayrı fiyat farkı kümeleri; bütün değerler bağlı).
- **Fiyat** kartın kuralıyla sunucuda: misafir taban fiyatı + kalkış farkı, yer tutan kategoriler (`card-facts.ts` `payingPricesAt`, `basePrices` ortak). Birim **kartın `from_price`'ı gibi lira** (1750.5), kuruş değil: vitrinin bütün fiyat alanları bu birimde.
- Gün ürünün saat diliminde (`starts_at AT TIME ZONE timezone`); ay sınırı da öyle (PR2).
- `catalog.booking` kapalı: 404 (`requireFeature`, ilk ara katman). Hız sınırı `departure_calendar`: IP başına dakikada 60. Süreç içi önbellek 60 sn; anahtar ay + kategori + kişi + satış kanalları. Yanıt `Cache-Control: no-store`.
- Kapsam dışı (PR6 isterse): `q` ve nitelik süzgeci (ör. `gidilecek_yer`) takvimde yok; takvim kategori ve kişiyle daralır.

**Uygulama notu (PR6, takvim arayüzü).**

- **Ara uç.** `GET /api/search/calendar?month=&kategori=&kisi=` (vitrin): parametreler backend'e gitmeden doğrulanır (ay aramanın okuduğu 12 aydan biri, kategori handle, kişi 1–20; bilinmeyen ya da yinelenen parametre 400). Fiyat yalnız gösterilir; vitrin sunucuda yazar (`12.400,00 TL`, telefonda `₺12,4 B`, 768 px'ten `₺12.400`). Bayrak kapalı (backend 404): boş gün listesi; 429 aynen, diğer hata 502. `Cache-Control: private, max-age=60`.
- **Tema.** `SearchFormDatesView.calendar` isteğe bağlı alan (sözleşme geriye uyumlu; yoksa yalnız düz alanlar). Sunucudan giden HTML ve JavaScript'siz form değişmedi: takvim sayfa tarayıcıda çalışınca devreye girer (`useSyncExternalStore`); gün alanları salt okunur olur, ay alanı seçilen ayları (en çok 3) aynı adla gizli alana yazan bir düğmeye döner. Pencere Radix Dialog (`LayerPortal`): telefonda alttan sayfa, 768 px'ten ortada; ızgara WAI-ARIA tarih seçici deseni (oklar, Page Up/Down, Esc; odak açan alana döner). Kalkışı olmayan gün soluk ama seçilebilir; bugünden önceki ve başlangıçtan 62 günden uzak gün basılamaz.
- **"Yalnız açılınca yüklenir".** Dinamik `import()` kullanılmadı; takvim kodu küçük tutuldu (tarih kütüphanesi yok, paket eklenmedi), ay verisi yalnız pencere açılınca ve gösterilen ay için istenir, sayfa ömrünce saklanır.
- **Kilit etkisi yok.** Yeni CSS dosyası yok (yalnız Tailwind sınıfları); kilitli görünümlerin HTML'i ve `styles.lock.json` aynı.

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

**Ek (2026-11-24, PR8; "Vadi" ve "Patika" kapakları için):** aynı biçime, hepsi kapalı liste ve varsayılanı yukarıdaki kapak olan ayarlar eklendi (`packages/types/src/store/section-hero-full.ts`, backend aynası `lib/storefront/sections/hero-full.ts`):

- `search_position`: `inside` | `overlap` (arama kutusu kapağın içinde ya da alt kenarına taşan kart); yalnız `action: search` iken okunur.
- `image_side`: `full` | `end`. `end`: yazı sayfa zemininde ve kendi mürekkebiyle, görsel 1024 px'ten itibaren yanda ekran kenarına kadar (telefonda yazının üstünde); karartma bu yerleşimde çizilmez. Görsel yokken `end`, `full` gibi çizilir (grafit sahne, yazı üstünde; boş görsel kutusu yok).
- `edge`: `straight` | `wave` (görselin kenarı dalgalı; tema stil dosyasında maske, `hero-full.css`).
- `title_accent`: başlığın isteğe bağlı ikinci satırı, ana renkte; aynı `h1` içinde bir satırdır.
- `show_trust`: tasarımın ortak güven rozetleri (en çok 4) kapağın alt kenarına taşan beyaz kutuda; varsayılan kapalı. Rozetler bölümün değil tasarımın verisidir (`settings.trust_badges`).
- İkinci düğme yeni alan değildir: her kapakta zaten duran `links` (en çok 2) dizisinin ikincisi sessiz düğme olarak çizilir. Arama seçiliyken düğmeler çizilmez (kayıtta durur).
- Görsel yokken ürün fotoğrafına düşülmez (standart kapaktan farklı): tam ekran zemin için ürün fotoğrafı uygun değildir; grafit sahne çizilir.
- Arama kutusu ve güven kutusu sahnenin (`gf-stage`) dışında çizilir; beyaz zeminlerinde sayfanın kendi mürekkebini korurlar.

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

**Uygulama notu (Ek, ikonlu bölümler; Vadi/Patika dalga 7a).** Yayımlanmış çizimler değişmedi; üç ekleme, hepsi varsayılanı bugünkü:

- **İkon kümesi** `SECTION_ICONS` (`packages/types/src/store/section-icons.ts`; backend aynası `sections/icons.ts`, eşitlik testi): ilk sekizi güven rozetlerinin `TrustIcon`'ı aynı sırayla, ardından 20 genel resim (pusula, konum, uçak, dağ, palmiye, yaprak, güneş, tarihi yapı, ev, kalp, insanlar, yıldız, parıltı, fotoğraf makinesi, takvim, etiket, paket, destek, yemek, mücevher). Yeni kütüphane yok: tema ve panel zaten kullandıkları çizgi ikon takımından çizer. Güven rozeti ayarının sekizli listesi değişmedi. Listeden ikon çıkarılmaz; okuyucu bilmediğini "ikonsuz" okur.
- **`trust_badges` yeni biçim `card` "Yüzen kart"**: rozetler tek beyaz kutuda (alan rengi + temanın yüzen gölgesi; gölge kapalıysa ince çizgi), ikon ana renkte, 1024 px'ten yan yana ve aralarında kenara değmeyen kısa dikey çizgi, telefonda ikişer. Ayar `lift` **off**/on "Üstteki bölüme taşsın" (Diziliş): açıkken bölüm üst boşluğunu bırakır, kutu `--promise-lift` (2rem, 1024 px'ten 3rem) kadar negatif kenar boşluğuyla önceki bölümün alt kenarına biner, `--z-raised` ile üstte çizilir; sayfanın ilk bölümüyse taşmaz. Kategori sayfasında ve alt bilgi grubunda da seçilebilir.
- **`categories` yeni biçim `icons` "İkonlu sıra"**: her kategori yuvarlak bir dairede ikon, altında adı (gösterilirse ürün sayısı). İkon bölüm verisinde seçilir (`category_icons`: kategori kimliği → ikon; kategori modeline alan eklenmedi); ikon yoksa kategorinin kendi görseli (ürün fotoğrafı değil) foto zemininde (`bg-media`), o da yoksa adın Türkçe büyük baş harfi. Ayarlar (Diziliş): `disc` **tint**/well/line "Daire zemini" (ana rengin açık tonu / açık gri / çizgi), `phone` **scroll**/wrap "Telefonda" (yana kaydır / alt satıra geç; oksuz doğal kaydırma, §4.4 Ek). Kategori listeden çıkınca ikonu da düşer (panel); backend adı geçmeyen kategorinin ikonunu yazdırmaz.
- **`stats` ögelerine isteğe bağlı ikon**: öge `icon` (yalnız seçilince yazılır), bölüm ayarı `icons` **off**/on "İkon göster" (Diziliş, ayırıcıların yanında). Açıkken her rakamın ikon seçimi İçerik'te görünür; ikon değerin üstünde, yalnız göz için (`aria-hidden` `dd`).
- Görünüm kilidi: HTML ve stil özeti aynı (yeni CSS dosyası yok, yalnız yeni biçimlerde Tailwind sınıfları).
- Bilerek yok: ikon rengi ayarı (ikon ana renkte; koyu sahnede sahnenin tonu), kategori başına özel görsel yükleme (kategorinin kendi görseli kullanılır), ikonlu sırada sütun sayısı (1024 px'ten sıra eşit aralıkla yayılır).
- **Ek (hazır görünümler için iki alan, 2026-11-24).** (1) `icons` biçimine isteğe bağlı `category_icons_by_handle` (kategori handle'ı → ikon; anahtar slug deseni, en çok 80 karakter, en çok `LAYOUT_LIMITS.items`; değer `SECTION_ICONS`): hazır görünüm mağazanın kimliklerini bilemez. Sıra: kimlikle eşleşme > handle ile eşleşme > kategorinin görseli > baş harf. Yazılmadıkça kayıtta ve mağaza API'sinde yok (eski kayıt birebir aynı); kimlik süzgecinden geçmez (ad verilmeyen sırada en üst kategoriler gösterildiği için). Panel kimlikle yazmaya devam eder, bu alanı olduğu gibi korur; biçim değişince alan düşer. (2) Üst bilginin eylem düğmesi tüm biçimlerde: katalog üst bilgisinin `highlight_link`'i (aynı ad, aynı anlam) artık `standard` ve `centered`'da da; yazılmadıkça kayıtta yok, mağaza API'si yalnız yazılınca `header_bar.highlight_link` basar (katalog kendi `catalog.highlight_link`'inde, değişmedi). Atölye: 1024 px'ten araçların (hesap, favori, sepet) hemen sağında küçük düğme (`gf-btn gf-btn--small`), telefonda satırda yok, menü çekmecesinin başında (katalogdaki gibi). Panel: bu biçimlerde "Menü" grubunda "Eylem düğmesi"; biçim değişiminde yazılmış düğme taşınır. Görünüm kilidi: HTML ve stil özeti aynı.

**Uygulama notu (PR5b, `photo_collage` ve `reviews` carousel).** Sözleşme `packages/types/src/store/section-collage.ts` ve `SECTION_VARIANTS.reviews`; backend aynası `lib/storefront/sections/photo-collage.ts`, `reviews.ts` (eşitlik testleri). Kolaj ana sayfa ve içerik sayfalarına girer; ürün ve kategori sayfası almaz.

- `photo_collage` "Fotoğraf kolajı": başlık isteğe bağlı (yoksa liste ekran okuyucuya "Fotoğraflar" adıyla), giriş ≤240, 3–7 fotoğraf `{image (medya kütüphanesi), alt ≤300 zorunlu, caption ≤60 isteğe bağlı, link isteğe bağlı}`; ayarlar `layout` **asymmetric**/even ("Asimetrik / Eşit ızgara") ve `phone` **scroll**/stack ("Yana kaydır / Alt alta"), ikisi Diziliş'te açık. Atölye'de 1024 px'ten dört sütun, ilk fotoğraf 2×2 ve kalanlar her adette satırı dolduracak biçimde; yazı fotoğrafın üstünde kâğıt zeminli küçük etiket, perde yok. İlk bölümse ilk fotoğraf öncelikli, gerisi `lazy`.
- `reviews` biçimleri `grid` (bugünkü çizim, varsayılan) ve `carousel`. Biçimsiz kayıt `grid` okunur; `grid`'in yayın çıktısı değişmedi (`variant`/`scroller` yalnız `carousel`'de basılır), kilitli görünümler aynı. `carousel` ortak kaydırma takımını (`scroller`) alır: Kaydırma'da görünen kart ve oklar, kalanı Diğer ayarlar'da. Her yorum bir kart (müşteri fotoğrafı varsa üstte, puan, alıntı, ad, ürün); kartlar fotoğrafı taşıdığı için müşteri fotoğrafları şeridi bu biçimde ayrıca çizilmez, özet (ortalama ve dağılım) da yok.
- Zemin ve hizalama ortak `look`; köşe ve aralık stil takımından (bilesen-standardi §0.5). Bilerek yok: kolaja odak noktası ve telefon görseli (fotoğraflar `object-cover`, kırpma oranı düzenden gelir), kendiliğinden dönen kolaj.

**Uygulama notu (PR10, `departures`).** İlk bayrağa bağlı bölüm: `SECTION_REQUIRES = { departures: "catalog.booking" }` üç kopyada (`@qticaret/types`, backend `sections/requires.ts`, `sector-packs`; eşitlik testleri). Sözleşme `packages/types/src/store/section-departures.ts`, backend aynası `lib/storefront/sections/departures.ts`. Ana sayfa ve içerik sayfaları alır.

- Alanlar: başlık (boşsa vitrinin "Yaklaşan kalkışlar"), giriş ≤240, kaynak `all` / `category` (`category_id`) / `collection` (`collection_id`), adet 3–12 (varsayılan 6); ayar `layout` **list**/cards ("Liste / Kartlar", Diziliş). Kategori ve koleksiyon tasarımın tuttuğu kayıt sayılır; canlı değilse bölüm düşer.
- Uç `GET /store/departures?limit=3..12[&category_id=|kategori=|collection_id=]` (en çok bir kaynak; bilinmeyen parametre 400) → `{ currency: "try", departures: [{ product { id, handle, title, thumbnail }, slot_id, starts_at, timezone, left, from_price }] }`. Akış `workflows/booking/upcoming.ts`: bugünden bir yıl ileriye §3'e uyan kalkışlar (açık, satış kapanışı geçmemiş, en az bir yer; `departureMatches`, en yakın 1000 ürün) → arama dizininde kanal, yayın ve kaynakla süzülür → ilk kalkışına göre en yakın 12 ürün → ürün okumasında yayın ve satış kanalı yeniden denetlenir (dizin gecikmesine ikinci güvence) → `windowSlots` ile ürün başına en çok 2 kalkış → tarih sırasıyla ilk 12 satır, istenen `limit` kadarı döner. `left` yalnız ≤5 ise (kart kuralı), değilse null. Fiyat kartın kuralıyla sunucuda (`payingPricesAt`, misafir fiyatı + kalkış farkı, yer tutan kategoriler), lira.
- `catalog.booking` kapalı: 404 (`requireFeature`). Hız profili `upcoming_departures` (adres başına dakikada 60). Süreç içi önbellek 30 sn; yanıt anahtarı kategori alt ağacı / koleksiyon + satış kanalları (adet anahtarda değil: yanıt hep 12 ile hazırlanıp kesilir); `departureMatches` sonucu kaynaktan ve kanaldan bağımsız tek önbellekte (30 sn), kategori ağacı 60 sn. Gösterilmeyen kategori ya da olmayan koleksiyon yanıt önbelleğine girmeden boş döner; kategori kimliği önbellekteki ağaçta aranır, uydurma kimlik tablo okutmaz. Yanıt `Cache-Control: no-store`.
- Vitrin satırları canlı okur (`storeGet`, alışverişçinin adresiyle), ürün sayfası yolu olmayan satırı atar; tarih ürünün saat diliminde. Atölye `sections/Departures.tsx`: liste (tarih kutusu, ad, "Son N yer", "…'den başlayan", "İncele") ya da kartlar (fotoğraf `bg-media` kuyusunda). Kilitli görünümlerin hiçbiri bölümü kullanmaz: HTML ve stil özeti değişmedi.
- Bilinen sınır: en yakın 1000 eşleşme (`departureMatches`) satış kanalı ve kaynak (kategori/koleksiyon) süzgecinden **önce** seçilir. Sızıntı yoktur, ama bir yıl içinde 1000'den çok tarihli ürünü olan mağazada dar bir kaynağın kalkışları bu 1000'in dışında kalırsa bölüm eksik ya da boş görünebilir (takvimdeki sınırın aynısı).
- Bilinen sınır: küçük resim sürümsüz (`thumbnail` adresi olduğu gibi); kartlar düzeninde ağır olabilir, gerekirse ürün görsel sürümleri eklenir.

**Uygulama notu (dalga 8, "Vadi": `posts` ve `banner` biçimleri).** İki bölüm ilk kez biçim listesi aldı; listenin ilki bugünkü çizim ve varsayılan (`posts`: `grid` "Kutucuklar", `banner`: `standard` "Görsel üstü yazı"), biçimsiz kayıt onu okur, mağaza API'si onu biçimden önceki gibi basar; kilitli görünümlerin HTML'i değişmedi (yalnız `styles.lock.json`'da `look.css`, `styles.css` ve yeni `split.css` özetleri).

- `posts` `intro_panel` "Tanıtım paneli": yuvarlak köşeli tek panel; solda üst satır (`eyebrow` ≤40), başlık, giriş (`intro` ≤200) ve düğme (`link`; yoksa vitrinin "Tüm yazılar"ı), sağda sayının ilk 2–3 yazısı kart olarak (kapak, başlık, okuma süresi · tarih); telefonda alt alta. Sözleşme `section-posts.ts`, backend `sections/posts.ts`.
- `banner` `split` "Bölünmüş bant": ilk slaytın görseli solda, sağda panelde üst satır (`eyebrow` ≤40), slaytın başlığı, metni ve düğmeleri (bandın düğme stiliyle); `edge` **straight**/curved ("Geçiş: Düz / Yuvarlak", Diziliş'te yüksekliğin yanında; yuvarlak, görselin iç kenarını `clip-path` ile yumuşak bir yayla panele bağlar, telefonda görselin altında). Slaytlar, genişlik ve yükseklik ortaktır, geçişte korunur; yazının yeri ve perde bu biçimde anlamsız olduğundan panelde gizlenir. Diğer slaytlar saklanır, çizilmez.
- Zemin yine bölümün `look.ground`'u (bir kavram bir takım), ama bu iki biçimde bölüm kutusunu değil kendi panelini boyar (`panel-ground.ts`; `look.css` zemin kuralları `.gf-ground` kutusunu da alır). Ayarlanmamışsa tanıtım paneli "Hafif ton" (`well`), bölünmüş bant "Koyu" (`stage`).

### 11. travel paketi sürüm 2

- Yeni seçim niteliği **"Gidilecek yer"** (`gidilecek_yer`): filtrelenebilir; üründe tek değer, süzgeçte çoklu seçim. Arama kutusunun "nereye" alanı bunu kullanır.
- Hazır görünüm **"Rota"** (`travel/presets/rota`): Hero `full_image` + arama → ürün kaydırıcısı "Popüler turlar" → `departures` → `stats` → `steps` → `reviews` carousel → `photo_collage` → e-bülten; alt bilgi `brand_columns` koyu zemin (`ground: stage`); başlık yazı tipi Playfair (mevcut `HEADING_FONTS`, yeni kod yok). Görseller Commons CC0 / CC BY.

**Uygulama notu (PR11).** Paket sürüm 2; `gidilecek_yer` "Tur bilgileri" şablonunda (seçim, filtrelenebilir, 9 bölge; sıra 5, önceki niteliklerin sırası değişmedi; v1'i almış mağazaya yalnız bu nitelik eklenir). Üç hazır görünüm, hepsi yalnız veri ve hepsi `search_form.attribute_key: gidilecek_yer`: **Rota** (yukarıdaki gibi), **Vadi** (yanda dalgalı görsel, taşan arama ve güven kutusu, `text_position: over` kartlar, `categories` `icons`, `posts` `intro_panel`, `banner` `split` ana renk panelde, ikonlu `stats`, e-bülten marka sütununda), **Patika** (duyuru şeridi, sola hizalı kapak, sekmeli arama, `photo_collage` `even` rota kartları, ikonlu `stats` "neden biz", oklu kartlar, tam genişlik bant, yorum kaydırıcı, yazılar, iletişim sütunlu `free_rows`). Kilit örnekleri `travel-rota`, `travel-vadi`, `travel-patika`; kilit dükkânı `/store/departures` ve `/store/listings/products`'a yanıt verir (`fixture-dated.ts`), mevcut örnekler değişmedi.

- Patika'da güven rozetleri kapakta (`show_trust`); ayrı `trust_badges` bölümü aynı rozetleri ikinci kez çizeceği için "neden biz" ikonlu rakam şeridiyle kuruldu.
- Ayarla kurulamayanlar: kategori ikonu hazır görünümden seçilemez (`category_icons` kayıt kimliğiyle anahtarlı; Vadi'de liste boş, mağazanın üst kategorileri ve yedek görünüş), "ortadaki büyük kart" ve kartta fiyat rozeti (Rota), üst bilgide eylem düğmesi ve ürün rozeti (Patika), menüler (görünümler menülere dokunmaz) ve galeri önizleme görseli.

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
- **Bilinen sınır (kapandı, 2026-11-24).** Tarihli aramada fiyat sıralaması dizin fiyatıyla, kart fiyatı aralıkla idi; artık ikisi de aralık fiyatı (§5 Ek), aynı kural (`bookingCardFacts`). Tarih yokken dizin fiyatı. İkisi de ana fiyat kategorisinden (yetişkin) alınır, daha ucuz çocuk fiyatından değil (adr/0076 Ek 2026-11-24).
- **Bilinen sınır (takvim, §6).** Ayın en yakın 1000 ürünü, satış kanalı ve kategori süzgecinden **önce** seçilir; süzgeç sonra uygulanır. Sızıntı yoktur (başka kanalın ya da kategorinin ürünü hiç görünmez), ama ayda 1000'den çok tarihli ürünü olan mağazada takvim bazı günleri eksik gösterebilir.

## Açık

- **Kart ürün rozeti verisi** ("Çok satan", "Yeni", tur kartı eki): veri kaynağı sahibin kararı.

- **Tur programı verisi** (gün gün plan): biçim sahibin kararı; öneri tarihli üründe `itinerary` alanı (gün başlığı + metin). Karar gelene kadar bölüm yazılmaz.
