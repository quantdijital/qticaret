# OWASP ZAP taraması (F15.2, docs/04)

Staging'e karşı pasif tarama (`zap-baseline.py`). Saldırı göndermez, yalnızca yanıtları inceler. Etkin tarama (`zap-full-scan.py`) yalnızca dış pentest penceresinde, ayrı bir staging kopyasında yapılır (F15.8).

## Kurallar

`rules.tsv` her kuralın sonucunu belirler. Sütunlar: kural kimliği, eylem, ad.

- **FAIL:** Platformun kendisinin karşıladığı güvenlik tabanı. Bu kurallardan biri tetiklenirse bir gerileme vardır:
  - güvenlik başlıkları: `X-Content-Type-Options`, `X-Frame-Options`, CSP, HSTS, `Permissions-Policy`;
  - `X-Powered-By` ve `Server` sürüm sızıntısı;
  - çerez bayrakları: `HttpOnly`, `Secure`, `SameSite`;
  - CORS;
  - hata ayrıntısı sızıntısı.
- **WARN:** İncelenir ama build'i kırmaz.
  - Anti-CSRF token uyarısı: Store API çerez değil bearer ya da `SameSite=Lax` oturum çerezi ve köken denetimi kullanır (docs/04 CSRF).
  - Önbellek yönergeleri.
- **IGNORE:** API için anlamsız olanlar: zaman damgası, önbelleğe alınabilir içerik, "modern web uygulaması".

Bu dosyadaki bir kural gevşetilirken nedeni bu README'ye yazılır.

## Çalıştırma (staging hazır olunca, F16)

```sh
docker run --rm -v "$PWD/infra/zap:/zap/wrk:ro" ghcr.io/zaproxy/zaproxy@sha256:<özet> \
  zap-baseline.py -t "$STAGING_URL/store/products" -c rules.tsv -I -j
```

- İmaj, depodaki bütün araçlar gibi özetle (digest) sabitlenir (`.github/workflows/security.yml` başlığı). Özet ilk kurulumda doğrulanıp yazılır.
- Hedefler:
  - Store API: yayınlanabilir anahtar `-z` ile başlık olarak verilir.
  - Yönetici paneli: giriş sayfası, kimliksiz.
  - Vitrin (F18): ana sayfa.
- CI işi `security.yml`'e haftalık (`schedule`) ve elle (`workflow_dispatch`) eklenir. `vars.STAGING_URL` yoksa atlanır. Rapor artifact olarak saklanır.

## Yerel karşılığı

ZAP'ın FAIL kurallarının kod tarafı HTTP testleriyle her değişiklikte denetlenir:

- `integration-tests/http/request-security.spec.ts`: başlıklar, CORS, CSRF, hız sınırı, gövde sınırları.
- `integration-tests/http/route-inventory.spec.ts`: her rota kimliksiz isteğe kapalı.
- `integration-tests/http/error-responses.spec.ts`: hata gövdesinde iç ayrıntı yok.
