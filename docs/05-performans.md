# 05 — Performans

## Hedefler
| Metrik | Hedef |
|---|---|
| Store API okuma (ürün listesi/detay) p95 | < 200 ms (cache'li), < 500 ms (cache'siz) |
| Checkout tamamlama p95 (sağlayıcı süresi hariç) | < 800 ms |
| Admin liste sayfaları p95 | < 1 sn |
| Webhook yanıtı | < 300 ms (işi kuyruğa bırak, hemen 200 dön) |
| Worker kuyruk gecikmesi | < 5 sn |

## İlkeler
1. **Ölç, sonra optimize et.** OpenTelemetry trace + yavaş sorgu logu olmadan optimizasyon yapılmaz.
2. **Server ve worker ayrı.** Prod'da `workerMode: "server"` ve `"worker"` ayrı süreçler; ağır işler (fatura, etiket, e-posta, indeksleme) worker'da.
3. **Dış çağrılar request yolunda minimum.** Kargo teklifi ve taksit tablosu cache'lenir (Redis, kısa TTL).
4. **Webhook'lar asenkron.** İmza doğrula → event/kuyruk → 200. İş worker'da.
5. **N+1 yok.** `query.graph` ile ihtiyaç duyulan alanlar tek seferde; `fields` parametresi dar tutulur.
6. **İndeksler.** Özel modüllerde sorgulanan her alan (order_id, tracking_number, provider_ref, status) indeksli.
7. **Sayfalama zorunlu.** Admin ve Store listelerinde limit/offset veya cursor.
8. **Görseller.** Obje depolama + CDN; yüklemede boyut sınırı; varyant üretimi (storefront aşamasında genişletilir).
9. **Redis modülleri.** Event bus, workflow engine, cache, locking için Redis modülleri (prod).
10. **Bağlantı havuzu.** Postgres pool boyutu süreç sayısına göre ayarlı; tenant başına üst sınır.

## Yük testi (F10)
- Araç: k6. Senaryolar: ürün gezinme, sepete ekleme, checkout (mock sağlayıcı), webhook patlaması (1000 istek/dk).
- Sonuçlar `docs/perf-raporlari/` altına tarihli kaydedilir.

## Yapma
- Request içinde senkron PDF üretme, e-posta gönderme, fatura kesme.
- Tüm ürün listesini cache'e tek anahtar olarak yazma (invalidation kâbusu); sayfa/filtre bazlı anahtar.
- Erken mikroservis ayrıştırması.
