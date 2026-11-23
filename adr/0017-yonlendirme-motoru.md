# ADR-0017: Yönlendirme motoru (`seo-redirects`) ve güvenli desen eşleme

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama F3.5)
- **Tarih:** 2026-10-25

## Bağlam

docs/13 §4 şunları ister:

- Kural tipleri: tam eşleşme, önek ve **regex** (güvenli motor, zaman aşımı, backtracking koruması); 301/302/307/410.
- Zincir düzleştirme ve döngü tespiti.
- Otomatik 301: slug, kategori, desen ve halef değişiminde.
- `GET /store/seo/resolve` (storefront her 404 öncesi sorar, cache'li).
- 404 günlüğü.

Bugünkü durum:

- `url-registry` (F2 S7) her yolun sahibini ve eski yolların rezervini tutuyor; otomatik 301'in kaynağı bu.
- Node'un `RegExp`'inde zaman aşımı yok. Kullanıcının yazdığı bir regex, çözümleme ucunu kilitleyebilir (ReDoS); bu uç herkese açık.

## Karar (öneri)

- **Modül `seo-redirects`:**
  - Alanlar: `source` (normalize yol), `match` (`exact` | `prefix` | `pattern`), `target`, `status` (301/302/307/410), `query` (`keep` | `drop` | `keep_list`), `origin` (`auto` | `manual` | `import`), `hit_count`, `last_hit_at`.
  - Tekillik: `(source, match)`.
- **Desen dili regex değil, güvenli alt küme:**
  - Segment joker (`/eski-kategori/*`) ve adlandırılmış yer tutucu (`/urun/:slug` → `/p/:slug`).
  - Bu desenler doğrusal zamanlı eşleyiciye derlenir; kullanıcıdan ham regex alınmaz.
  - Gerçek regex ihtiyacı kanıtlanırsa ileride `re2` (doğrusal zamanlı, yerel ikili) değerlendirilir.
- **Çözümleme sırası:** tam eşleşme (indeks) → önek (en uzun) → desen (sıralı, sayısı sınırlı) → `url-registry` (canlı varlık) → yoksa `not_found`.
  - Sonuç süreç içi önbellekte tutulur, F2 S9'daki versioned cache deseniyle.
  - Kural yazımı önbellek işaretini değiştirir.
- **Kaydetme anında:**
  - Zincir düzleştirme: A→B varken B→C eklenirse A→C olur.
  - Döngü reddi.
  - Hedef kendi kaynağına dönüyorsa ret.
  - Yalnızca site içi göreli hedef ya da tenant'ın canonical host'u; açık yönlendirme yok.
- **404 günlüğü:**
  - `POST /store/seo/not-found` (rate limitli, PII'siz: yol + referer host).
  - Günlük birleştirme işi; öneri kaynakları: url-registry eski yolları, benzer slug.
- **Denetim:** Kural mutasyonları denetim kaydının önce/sonra defterine girer (adr/0011).

## Alternatifler

| Seçenek                          | Artı                                                                                  | Eksi                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Güvenli desen alt kümesi**     | ReDoS imkânsız; yeni bağımlılık yok; geçiş araçlarının (F14) çoğu ihtiyacını karşılar | Karmaşık regex kuralı ifade edilemez                                   |
| `re2` ile tam regex              | Esnek, doğrusal zamanlı                                                               | Yerel ikili; geri referans ve lookaround desteklenmez (beklenti farkı) |
| `RegExp` + `safe-regex2` sezgisi | Kolay                                                                                 | Sezgi her kötü deseni yakalamaz; herkese açık uçta risk                |

## Sonuçlar

- F14 geçiş araçları (Shopify, Ticimax) regex kurallarını desen diline çevirir; çevrilemeyenler rapora düşer.
- Storefront (F18) çözümleme yanıtını CDN'de kısa süre önbelleğe alır.

## Uygulama notu (F3.5, 2026-10-26)

Uygulamada kararın iki noktası değişti. Kullanıcı yokken önerilen seçenekle verildiler; PROGRESS "Gözden geçir" listesinde.

- **Kayıtların eski yolları kural olarak yazılmıyor.** Slug değişimi, kategori taşıma, URL deseni değişimi, silme ve halef için `seo_redirect` satırı (`origin: auto`) üretilmiyor. Eski yol `url-registry`'de rezerve kalıyor ve çözümleme onu sahibinin bugünkü yoluna gönderiyor:
  - kayıt yayında → bugünkü yolu (301);
  - yayında değil ya da silinmiş, halefi var → yayındaki ilk halefin yolu (301);
  - silinmiş, halefi yok → `gone` (410);
  - taslak, halefi yok → `not_found`.
  - Gerekçe: kural tablosuyla registry arasında senkron sorunu olmuyor. Ürün eski adına dönünce zincir ya da döngü oluşmuyor. Desen değişimi (F3 T4) tek bir toplu `claimPaths` olarak kalıyor. Eski yol her zaman tek atlamada bugünkü sayfaya gidiyor.
  - Bunun karşılığında panelde "Eski adresler" listesi ve "serbest bırak" eylemi var (denetim kayıtlı). Serbest bırakılan yol 404 olur ve başka kayıt alabilir.
  - Bu yolların isabet sayacı yok; kural sayaçları var.
  - `origin` alanı: `manual` | `import`.
- **Çözümleme sırası:** önce yayındaki bir kaydın kendi yolu (canlı sayfa her zaman kazanır, hiçbir kural onu gizleyemez), sonra tam eşleşme → en uzun önek → desen (daha çok sabit bölümü olan önce) → registry'deki eski yol → `not_found`.
  - Zincirin sonu tek yanıtta döner. Tüm atlamalar 301 ise sonuç 301 olur, değilse ilk geçici kod (302/307) kullanılır. Zincirin sonu 410 ise `gone` döner.
  - Çözümleme sırasında döngüye rastlanırsa yanıt `not_found` olur ve loglanır.
- **Kaydetme anında:**
  - Tam eşleşme kuralı yayındaki bir sayfanın yolunu kaynak alamaz.
  - Hedef bir tam eşleşme kuralının kaynağıysa kural düz saklanır (A→B, B→C varken A→C).
  - Bu kuralın kaynağına giden tam hedefli kurallar yeni hedefe çevrilir. Geçici bir atlama kalıcıya dönüştürülmez.
  - Hedef izlenir: kurala geri dönen bir zincir (döngü) ya da 410 ile biten bir hedef reddedilir.
  - Kural yazımları tek bir kilit altında; aynı anda iki kayıt birlikte döngü kuramaz.
- **Sayaçlar:** isabet ve 404 sayıları süreç içinde toplanıp tek SQL ifadesiyle yazılıyor (30 sn ya da 5000 anahtar). Yaklaşık değerler; sürecin kapanırken bellekte tuttuğu kaybolur.
  - 404 günlüğü yalnızca gerçekten çözülemeyen yolları sayar. Referer'dan yalnızca host saklanır.
  - Günlük iş 90 günden eski kayıtları siler ve en çok istenen 10.000 kaydı tutar.
- **Kaynakta sorgu dizesi kabul edilmiyor** (`/urun.php?id=12`). F14 geçiş aracı bu tür adresleri eşleme raporuna düşürür.
- **Hedef yalnızca site içi göreli yol** (sorgu dizesi olabilir). Canonical host doğrulaması gelene kadar mutlak URL kabul edilmiyor (docs/13 §3).

## Ek (2026-11-23): öneksiz ağaç kategori adresleri (`nested`)

**Bağlam.** Adres biçimi (docs/13 §2.2, F3 T4) ürün, kategori ve marka için ayrı ayrı `prefixed` ya da `flat` seçiliyordu. Kategoride `flat` öneki atarken üst kategorileri de atıyordu (`/kategori/hediyelik-esyalar/caki-kutusu` → `/caki-kutusu`). Kategori tabanı kaldırılmış WooCommerce siteleri (sahibin eski sitesi: `/el-yapimi-caki/damascus-cakilar/`) ağacı öneksiz sunuyor; bu mağazalar bizde aynı adresi tutamıyor, her alt kategori 301 alıyordu. Sahip onayı (2026-11-23): yeni seçenek olarak eklensin, mevcut biçimler değişmesin.

**Karar.**

- Kategori adres biçimine üçüncü değer: `url_style.category: "prefixed" | "nested" | "flat"`. `nested` = `/{ata-slug'ları}/{slug}`. Ürün ve marka `prefixed | flat` olarak kalır. Ayar zaten varlık başına olduğu için üçüncü bir genel `UrlStyle` yerine yalnız kategorinin değer kümesi genişledi; ürün ve markada "ağaç" anlamsız olurdu. Varsayılan `prefixed`; kayıtlı ayarlar aynen geçerli.
- **Çakışma kuralı.** Yol tekilliği yine `url-registry`'de, `(locale, path)`:
  - Kök kategori `nested` ve `flat` biçimlerinde aynı yolu alır (`/hediyelik-esyalar`). Kökteki ürün, sayfa, marka ya da landing ile çakışırsa kayıt `seo.path_taken` ile reddedilir. Biçim değişimi planı bunu `taken` ya da `shared` olarak listeler ve iş başlamaz.
  - Derinde: alt kategori yolu (`/a/b`) aynı kategorinin landing yoluyla (`/a/{facet-slug}`) aynı biçimde. Önekli biçimdeki gibi ilk kaydeden alır, ikincisi reddedilir.
  - Ayrılmış kök segmentler (`sepet`, `yasal`, `blog`, `urun`, `sitemap*` …): kök kategori zaten `seo.path_reserved` alıyordu. `nested`'de bunun altındaki hiçbir yol da alınamaz (`startsInReservedRoot`), çünkü vitrinin kendi rotaları (`/yasal/[slug]`, `/siparis/[id]`) orada yanıt verir. Plan bu kayıtları `reserved_root` olarak listeler. Kaydetmede kategori `seo.path_reserved` ile reddedilir; aynı kaydetmede değişen bir alt kategori atlanır ve loglanır (eski davranış).
  - Numara eklenmez. Kategori handle'ı sahibin yazdığı slug'dır ve çakışma nedeniyle reddedilir (ürün kopyasındaki `-2` yalnız yeni handle üretiminde var).
- **Geçiş ve 301.** Biçim değişimi mevcut `seo.url_style` işiyle yapılır: plan → her kaydın yeni yolu partilerle `claimPaths` (eski yol `reserved`) → landing'ler kategorinin yeni yolunu izler (`claimLandingsBelow`) → biçim en sonda kaydedilir. Eski yollar registry'de rezerve kalır, çözümleme onları tek atlamada güncel yola 301'ler (uygulama notu). `flat` ↔ `nested` geçişinde kök kategoriler taşınmaz (aynı yol), yalnız alt kategoriler taşınır. Kaydetme anındaki kanca bir kaydın "kabul edilen" yollarına üç biçimi de sayar; biçim değişimi tek iş olarak kalır, ilgisiz düzenlemeleri bloklamaz.
- **Ad değişimi ve taşıma.** `nested` ağacı taşıdığı için önekli biçimdeki gibi alt ağacın tamamı (ve altındaki landing'ler) aynı işlemde yeni yolunu alır, eskiler 301'ler.
- **Site haritası, breadcrumb, JSON-LD, canonical** yolu registry'den okur. Ayrı iş gerekmez. SEO denetimi (robots) örnek sayfalara bir alt kategori ekledi. Advisor `C-DEPTH-01` ağaç derinliğine bakar, URL'ye değil; değişmedi.
- **Taşıma (F14).** WordPress kaynağı kategori tabanını zaten algılıyor (`detectBase`, `/` = tabansız). Adres envanteri özeti (`GET /admin/migrations/urls/summary`) artık `category_style` döner: eski kategori adreslerinden kaçını her biçimin aynen koruduğu ve şimdikinden daha çoğunu koruyan biçim (`suggested`). Panelin "Eski adresler" kartı bunu bilgi notu olarak gösterir ve Adres biçimi ayarına bağlantı verir. Ayar sessizce değiştirilmez; seçim sahibindir. Shopify'da kategori ağacı adresi yok (`/collections/x`), öneri çıkmaz.

**Alternatifler.**

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kategori ayarına üçüncü değer (seçilen)** | Mevcut ayar modeli ve taşıma işi aynen kullanılır; ürün ve markada anlamsız seçenek yok | Kategori tipi ürün ve markanınkinden ayrılır |
| Üçüncü genel `UrlStyle` | Tek tip | Ürün ve markada `nested` = `flat`; panelde ve doğrulamada boş seçenek |
| Ayrı `category_paths` alanı | Ad açık | Aynı bilgi iki alanda (`url_style.category` + yeni alan), eski kayıtlarla göç gerekir |
| Eski adreslere 301 (biçim eklemeden) | Kod yok | Kategori adresleri değişir; sıralama aktarımı 301'e kalır, sahip istemedi |

**Güvenlik incelemesinden sonra eklenenler (aynı gün).**

- **Kayıt düzeyinde ret.** `url-registry` `assertClaimable` artık ayrılmış bir kökün altındaki her yolu reddeder (`/sepet/x`, `/yasal/x`, `/hediye-karti/x`: `seo.path_reserved`). İstisna, kayıtların yaşadığı önekler: `urun`, `kategori`, `marka`, `koleksiyon`, `blog` (`RECORD_PREFIXES`). Kategori düzeyindeki kontrol daha açık hata verdiği için kalır. Taşımanın eski adres rezervi (`urls-apply`) bu yoldan geçmez; eski sitenin kendi yolları rezerve edilebilmeye devam eder.
- **Vitrin rotaları sözleşmesi.** Bir birim testi vitrinin `app/` kök klasörlerini (sayfa ya da rota içerenleri; `[...]`, `_x`, `%5Fx` hariç) ve `SYSTEM_ROOTS` / `STOREFRONT_INDEXES` listelerini okur. Her biri backend'in `RESERVED_ROOT_SEGMENTS` kümesinde olmalı. Vitrine yeni kök rota eklenip backend'de ayrılmazsa test düşer.
- **Varsayılan robots.txt.** `Disallow: /hesap` gibi çıplak önekler `/hesap-makineleri` kategorisini de kapatıyordu. Varsayılan artık her sistem sayfasını tam olarak, altıyla ve sorgusuyla kapatır (`/hesap$`, `/hesap/`, `/hesap?`). Mağazanın kendi yazdığı şablon değişmez. Eski varsayılanı kaydetmiş mağazayı `seo-robots-exact-system-pages` göç betiği yeni varsayılana çevirir ve denetim kaydına sistemin işi olarak yazar. S-ROBOTS-01 denetimi örnek sayfalara mağazanın gerçek kök kategorilerini (en çok 50) de katar.

**Sonuçlar.** Kategori tabanı kaldırılmış WooCommerce mağazası `nested` seçerek kategori adreslerini birebir korur. Kökte ürün ve kategori aynı ad alanını paylaşır; çakışma kayıt anında ve biçim değişimi planında görünür.
