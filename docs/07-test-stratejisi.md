# 07 — Test Stratejisi

## Piramit
| Seviye | Araç | Kapsam |
|---|---|---|
| Unit | Jest/Vitest | Mapper'lar, hash/imza, tutar dönüşümü, desi hesabı, kurallar |
| Modül entegrasyon | Medusa test-utils (`moduleIntegrationTestRunner`) | Özel modül servisleri + DB |
| HTTP entegrasyon | Medusa test-utils (`medusaIntegrationTestRunner`) | API route + workflow + mock sağlayıcı |
| Contract | Ortak test paketi | Her payment/fulfillment provider aynı sözleşmeyi sağlar |
| E2E (admin) | Playwright | Kritik admin akışları (smoke) |
| SEO denetimi | Yerel `/seo-*` skill'leri, Lighthouse | F18 demo mağaza; F14 geçiş öncesi/sonrası |
| Yük | k6 | F15 |

## E2E (panel)
- Yer: `apps/panel/e2e/` (Playwright 1.64, `@axe-core/playwright`). Çalıştırma: backend açıkken `pnpm --filter @qticaret/panel test:e2e`. Panelin dev sunucusu kapalıysa test onu kendisi başlatır.
- Her çalıştırma kendi geçici yöneticisini açar: Medusa CLI ile rastgele parolalı `e2e-…@example.com`. Giriş sayfasından girer; sonunda `src/scripts/remove-e2e-admin.ts` ile silinir. Kimsenin hesabı ya da tarayıcı profili kullanılmaz; oturum dosyası git dışında (`e2e/.auth`).
- Duman testleri veri değiştirmez: ana bölümler ve ayar sayfaları hatasız açılır (yakalanmamış betik hatası, 5xx yanıt ve panelin hata satırları aranır), ürün arama ve detay çalışır, içe aktarma "Kontrol et" adımı çalışır.
- Erişilebilirlik: axe, WCAG 2.1 A/AA kurallarıyla çok kullanılan ekranlarda "ciddi" ve "kritik" bulgu bulmamalı.
- CI: `e2e` işi boş veritabanına migration ve demo mağazayı kurar, backend'i başlatır, testleri koşar. Başarısız çalıştırmanın raporu 7 gün saklanır.
- Yeni ekran ya da akış eklendiğinde duman listesine eklenir (docs/06 kontrol listesi).

## Kurallar
- Dış servisler testte **asla** gerçek çağrılmaz. `packages/testing` altında mock sunucular (msw veya küçük HTTP sunucu):
  iyzico, PayTR, Geliver, e-fatura, SMS.
- Sandbox testleri ayrı etiketli (`@sandbox`) ve CI'da manuel tetiklenir; secret gerektirir.
- Her bug fix bir regresyon testiyle gelir.
- Kapsam hedefleri: ödeme/kargo/fatura modülleri ≥ %80, diğerleri ≥ %60.
- Fixture fabrikaları: `packages/testing/factories` (müşteri, sepet, sipariş, adres — gerçekçi TR verisi, sahte TCKN algoritmik geçerli).
- Test adları davranışı anlatır: `"kısmi iadede sadece seçilen kalemlerin transaction ID'si kullanılır"`.

## Zorunlu senaryolar (ödeme)
- Başarılı tek çekim / taksit
- 3DS başarısız, kullanıcı iptal, zaman aşımı
- Mükerrer callback / webhook
- İstemci tutar manipülasyonu
- Tam iade, kısmi iade, aynı gün iptal
- Sağlayıcı 5xx → retry → yedek sağlayıcı (F6)

## Zorunlu senaryolar (kargo)
- Ölçü eksik ürün, adres hatası, sağlayıcı teklif vermiyor
- Webhook + polling çakışması
- İptal edilmiş gönderiye gelen takip güncellemesi

## Zorunlu senaryolar (fatura)
- Bireysel/kurumsal ayrımı, mükellef sorgusu hatası
- Entegratör kapalı → retry → başarılı
- Mükerrer fatura engeli

## Zorunlu senaryolar (stok ve katalog)
- Son ürün için eşzamanlı checkout → yalnızca biri tamamlanır
- İptal/iade/süresi dolan havale → rezervasyon serbest kalır
- İçe aktarmada hatalı satırlar diğerlerini bozmaz; yeniden çalıştırma mükerrer üretmez
- Slug değişimi → otomatik 301

## Zorunlu senaryolar (fiyat ve promosyon)
- Kupon limiti eşzamanlı kullanımda aşılmaz; süresi geçmiş/kapsam dışı kupon reddedilir
- Son 30 gün en düşük fiyat: fiyat artışı, indirim, zamanlı fiyat geçişlerinde doğru
- İndirimli siparişte kısmi iade: kalem indirim payı düşülür, kuruş farkı oluşmaz
- İstemciden gelen indirim/ek ücret tutarı etkisiz

## Zorunlu senaryolar (SEO)
- Slug: Türkçe karakter tablosu, uzunluk kesme, benzersizlik çakışması, değişimde otomatik 301, rezerve slug'ın yeniden kullanılamaması
- Redirect motoru: zincir düzleştirme, döngü reddi, regex zaman aşımı, sorgu parametresi davranışı, 410
- `seo` payload contract: her varlık türünde zorunlu alanlar, mutlak URL, canonical host, noindex kuralları (taslak, boş kategori, filtre parametresi)
- JSON-LD: her blok JSON şemadan geçer; `StrikethroughPrice` 30 gün kuralıyla tutarlı; `aggregateRating` yorumsuz üründe yok
- Sitemap: 50.000 bölme, `lastmod` yalnızca anlamlı değişimde, taslak/noindex dışarıda; robots facet parametresini engelliyor, landing yolunu engellemiyor
- Advisor: her kural pozitif/negatif fixture; skor deterministik; p95 < 50 ms; 404 hedef önerisi doğruluğu; landing özgünlük kapısı
- İçe aktarma: SEO sütunları, satır bazlı advisor özeti

## Zorunlu senaryolar (güvenlik tabanı)
- Upload: SVG, sahte MIME, boyut/piksel aşımı reddi; EXIF temizlendi
- SSRF: iç IP, link-local, DNS rebinding, yönlendirmeyle iç IP'ye gitme reddi (webhook, geçiş görseli, feed)
- Dışa aktarma: formül başlangıçlı hücre kaçışlanmış; XML'de DTD/entity reddi; zip bomb sınırı
- Rate limit: login/kayıt/şifre sıfırlama/kupon/taksit/SMS uçlarında 429; header'lar her yanıtta; CORS allowlist dışı origin reddi
- Open redirect: ödeme dönüş URL'si allowlist dışı reddi
- Okuma denetimi: TCKN görüntüleme ve dışa aktarma audit log'da

## Zorunlu senaryolar (sipariş operasyonu)
- Değişim: fark tutarı tahsilat/iade, stok iki yönde, fatura akışı
- Sipariş düzenleme: faturalandırılmış siparişte kısıt; ödeme farkı
- Müşteri iptali: kargo öncesi/sonrası ayrımı
- Ters ibraz: belge paketi içeriği

## Zorunlu senaryolar (entegrasyon ve geçiş)
- Muhasebe adaptörü kapalı → retry → mükerrer kayıt yok
- Giden webhook: imza doğrulanabilir, 5xx → retry, iç IP hedefi reddedilir
- Geçiş: dry-run sayımları = gerçek çalıştırma sayımları; yarıda kalan geçiş tekrar çalıştırılabilir
