# ADR-0017: Yönlendirme motoru (`seo-redirects`) ve güvenli desen eşleme

- **Durum:** Önerildi (F3.5; kullanıcı kararı bekliyor)
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
