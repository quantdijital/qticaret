# Yük testleri (k6, F15.3)

> Araç docs/05'te seçildi. Makineye `k6` kurulumu gerekir (`brew install k6`); depoya bağımlılık eklemez. Sonuçlar `docs/perf-raporlari/YYYY-AA-GG-<senaryo>.md` olarak kaydedilir.

## Senaryolar

| Dosya | Ne ölçer | Hedef (docs/05) |
|---|---|---|
| `browse.js` | Ürün listesi, ürün, kategoriler, yol çözümleme, robots ve site haritası | Okuma p95 < 500 ms (önbelleksiz), çözümleme p95 < 20 ms |
| `browse.js` + `SCENARIO=spike` | Kampanya anı: 10 sn'de saniyede 5'ten `PEAK` (100) ziyarete | Aynı |
| `checkout.js` | Sepet, adres, kargo, sözleşme ve yaş adımı, kapıda ödeme ya da havaleyle sipariş | Tamamlama p95 < 800 ms, hata < %0,5 |
| `webhooks.js` | Dakikada 1000 PayTR bildirimi (`PER_MINUTE`) | Yanıt p95 < 300 ms, 5xx yok |

Son ölçüm: `docs/perf-raporlari/2026-10-31-yerel.md`.

## Çalıştırma

Backend yük testi kipinde açılır. `LOAD_TEST=on` IP başına sınırları 1000 kat büyütür; kimlik başına sınırlar değişmez. Kip yalnızca açıkça `development`, `test` ya da `staging` olan ortamda çalışır; canlıda sunucu açılmayı reddeder.

```sh
NODE_ENV=development LOAD_TEST=on EMAIL_DOMAIN_CHECK=off pnpm dev
k6 run -e PUBLISHABLE_KEY=pk_... infra/k6/browse.js
k6 run -e PUBLISHABLE_KEY=pk_... -e SCENARIO=spike -e PEAK=50 -e HOLD=30s infra/k6/browse.js
k6 run -e PUBLISHABLE_KEY=pk_... -e PROVIDER=pp_bank-transfer_bank-transfer infra/k6/checkout.js
k6 run infra/k6/webhooks.js
```

- `BASE_URL` varsayılanı `http://localhost:9000`. `VUS` ve `HOLD` ile ziyaretçi sayısı ve süre ayarlanır.
- **`checkout.js` gerçek sipariş açar ve stok düşer.** Yalnızca test mağazasında koşulur. `MIN_STOCK` (50) altındaki varyantları seçmez. `PROVIDER` varsayılanı kapıda ödeme; mağazada kapalıysa havale verilir.
- **E-posta:** misafir adresinin alan adı MX kaydıyla denetlenir. Yerelde `EMAIL_DOMAIN_CHECK=off` ve `example.com` kullanılır (posta hiçbir yere gitmez). Staging'de `EMAIL_DOMAIN` olarak postası bizde toplanan bir alan adı verilir.
- **`webhooks.js`:** anahtarsız koşarsa bildirimler reddedilir (400) ve reddetme yolu ölçülür. `PAYTR_MERCHANT_KEY` ve `PAYTR_MERCHANT_SALT` ortamdan verilirse imzalı bildirimler, mağazaya ait olmayan sipariş numaralarıyla gider (404). Anahtarlar dosyaya yazılmaz.
- Değişkenler turbo üzerinden geçer (`turbo.json` `globalPassThroughEnv`).
