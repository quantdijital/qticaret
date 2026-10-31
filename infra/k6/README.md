# Yük testleri (k6, F15.3)

> Araç docs/05'te seçildi. Makineye `k6` kurulumu gerekir (`brew install k6`); depoya bağımlılık eklemez. Sonuçlar `docs/perf-raporlari/YYYY-AA-GG-<senaryo>.md` olarak kaydedilir.

## Senaryolar

| Dosya | Ne ölçer | Hedef (docs/05) |
|---|---|---|
| `browse.js` | Ürün listesi, ürün, kategoriler, yol çözümleme, robots ve site haritası | Okuma p95 < 500 ms (önbelleksiz), çözümleme p95 < 20 ms |
| (sırada) `checkout.js` | Sepet, adres, kargo, kapıda ödeme ile tamamlama | Tamamlama p95 < 800 ms, hata < %0,5 |
| (sırada) `webhooks.js` | Sahte PayTR'nin imzalı bildirimleri, dakikada 1000 | Yanıt p95 < 300 ms |

## Çalıştırma

```sh
pnpm --filter backend dev          # ya da staging
k6 run -e BASE_URL=http://localhost:9000 -e PUBLISHABLE_KEY=pk_... infra/k6/browse.js
k6 run -e VUS=3 -e HOLD=5m ...     # süre ve eşzamanlı ziyaretçi
```

## Sınırlar tek adresten gelen yükü keser

Bütün istekler tek IP'den gelir. Uygulamanın IP başına sınırları bu yüzden ölçümü bozar:

- Store API dakikada 600 istek (`store_default`). `browse.js` varsayılan olarak 3 ziyaretçiyle bunun altında kalır. Bu bir gecikme ölçümüdür, kapasite ölçümü değil.
- Ödeme: IP başına saatte 5 denemeden sonra iş kanıtı doğrulaması, 30'dan sonra engel (ADR-0044). `checkout.js` ve kapasite ölçümleri ya birden çok kaynak adresten (dağıtık k6) ya da sınırları gevşeten bir yük testi kipiyle koşar. **Karar bekliyor (PROGRESS).**
