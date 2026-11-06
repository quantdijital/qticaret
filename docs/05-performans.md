# 05 — Performans

## Hedefler
| Metrik | Hedef |
|---|---|
| Store API okuma (ürün listesi/detay) p95 | < 200 ms (cache'li), < 500 ms (cache'siz) |
| Checkout tamamlama p95 (sağlayıcı süresi hariç) | < 800 ms |
| Admin liste sayfaları p95 | < 1 sn |
| Webhook yanıtı | < 300 ms (işi kuyruğa bırak, hemen 200 dön) |
| Worker kuyruk gecikmesi | < 5 sn |
| SEO advisor tekil değerlendirme (kaydetme anında) | < 50 ms p95 |
| Sitemap tam üretimi (10.000 ürün) | < 2 dk (worker) |
| `GET /store/seo/resolve` (cache'li) | < 20 ms |
| Site araması / liste, facet'li (10.000 ürün, `GET /store/listings/products`) | < 150 ms medyan (ölçülen 17–34 ms, adr/0056) |

## İlkeler
1. **Ölç, sonra optimize et.** OpenTelemetry trace + yavaş sorgu logu olmadan optimizasyon yapılmaz.
2. **Server ve worker ayrı.** Prod'da `workerMode: "server"` ve `"worker"` ayrı süreçler; ağır işler (fatura, etiket, e-posta, indeksleme, sitemap, SEO denetimi, görsel türevleri) worker'da.
3. **Dış çağrılar request yolunda minimum.** Kargo teklifi ve taksit tablosu cache'lenir (Redis, kısa TTL).
4. **Webhook'lar asenkron.** İmza doğrula → event/kuyruk → 200. İş worker'da.
5. **N+1 yok.** `query.graph` ile ihtiyaç duyulan alanlar tek seferde; `fields` parametresi dar tutulur.
6. **İndeksler.** Özel modüllerde sorgulanan her alan (order_id, tracking_number, provider_ref, status) indeksli.
7. **Sayfalama zorunlu.** Admin ve Store listelerinde limit/offset veya cursor.
8. **Görseller.** Obje depolama + CDN; yüklemede boyut sınırı; varyant üretimi: ürün görselleri ürünün adıyla (adr/0016), kütüphanenin diğer her görseli (kapak, yazar fotoğrafı, metin içi görsel) yüklemeden sonra worker'da kendi adıyla; eskiler `media:derivatives apply` ile (docs/21 2026-11-06).
9. **Redis modülleri.** Event bus, workflow engine, cache, locking için Redis modülleri (prod).
10. **Bağlantı havuzu.** Postgres pool boyutu süreç sayısına göre ayarlı; tenant başına üst sınır.

## Arama ve listeler (adr/0056)
- Arama, filtre, facet sayımı ve sayfalama tek SQL ifadesinde (`search_document`, GIN). Listeler bellekte toplanmaz; ürün sayısı sınırı yok.
- `document` sütunu `STORAGE MAIN`: satır içinde kalır, her sıralama okumasında TOAST parçası getirilmez.
- Birim skoru `ts_rank` ile (PostgreSQL 16'da `ts_rank_cd` on kat yavaş ölçüldü). Her birim ürün başına bir kez hesaplanır (`LATERAL ... OFFSET 0`).
- Yazım hatası komşuları kelime başına ayrı alt sorguyla aranır: değer planlamada bilinir, trigram indeksi kullanılır.
- İndeks yazımı katalog yazımının yolunda değil: olay → `search_pending` → işçi süreçte 200'lük partiler.
- Ölçüm testi: `integration-tests/http/search-performance.spec.ts` (10.000 sentetik ürün, bütçe 150 ms).

## Yük testi (F15)
- Araç: k6. Senaryolar: ürün gezinme, sepete ekleme, checkout (mock sağlayıcı), webhook patlaması (1000 istek/dk).
- Sonuçlar `docs/perf-raporlari/` altına tarihli kaydedilir.

## Yapma
- Request içinde senkron PDF üretme, e-posta gönderme, fatura kesme.
- Tüm ürün listesini cache'e tek anahtar olarak yazma (invalidation kâbusu); sayfa/filtre bazlı anahtar.
- Erken mikroservis ayrıştırması.
