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
