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

## Entegrasyon testlerinin koşusu
- Her test dosyası Medusa'yı yeniden açar; bellek birikir. Testler tek bir jest alt sürecinde koşar ve bu süreç bir dosyadan sonra 1 GB'ı geçince yenisiyle değiştirilir (`apps/backend/jest.config.js`, `workerIdleMemoryLimit`). `--runInBand` bu sınırı yok saydığı için kullanılmaz.
- Yerelde hepsi tek komut: `pnpm --filter backend test:integration:http` (49 dosya yaklaşık 8 dakika).
- Bir test dosyası yüzlerce veritabanı bağlantısı açar (her modülün migration'ı kendi bağlantısıyla; her testten önce şablondan geri yüklenen veritabanı açık oturumları kapatır). Node `localhost`'u önce ::1 olarak dener; Postgres yalnız 127.0.0.1:55432'de dinler ve 55432 macOS'un geçici port aralığındadır: yaklaşık 16.000 bağlantıda bir soket kendine bağlanır (`[::1]:55432 -> [::1]:55432`) ve pg sonsuza dek bekler. Eskiden bu, bir modülün migration'ını 30 sn sonra düşürüp dosyanın bütün testlerini ~36 sn'de başarısız kılıyordu. `integration-tests/database.js` testlerde önce IPv4'ü dener ve yanıtsız bağlantıyı 5 sn sonra yeniden açar. Medusa'nın test koşucusu `databaseDriverOptions`'ı yerel veritabanı için `{}` yaptığından bu ayar `medusa-config.ts`'e yazılmaz.
- Her test dosyası Redis'te kendi ad alanındadır (`QT_TEST_RUN`: kilitler, sayaçlar, önbellek sürümleri). Aynı makinede iki koşu (başka bir worktree, başka bir ajan) birbirinin kilidini (ör. `catalog:successors`) beklemez.
- CI'da HTTP testleri on iki parçaya bölünür (`--shard=N/12`; ~290 dosya, dosya başına ~45 sn, parça başına ~11–20 dk) ve modül testleriyle yan yana koşar; her işin kendi Postgres'i var.
- Entegrasyon testinden çıkan her hata düz bir hataya çevrilir (`integration-tests/plain-failures.js`): axios'un döngüsel nesneleri (yanıt → istek → yanıt) jest alt sürecine ulaşınca süreç "Converting circular structure to JSON" ile ölür ve asıl hata görünmez. Testler bağlantıyı açık tutmaz (`setup.js`): istekler arasında 5 sn'den uzun iş (proof of work) yapan bir test, sunucunun kapattığı sokete yazıp ECONNRESET alıyordu.
- CI'da typecheck ve lint, `medusa build`'in ürettiği `.medusa/types`'tan sonra koşar; yerelde bu tipleri `medusa develop` üretir.

## E2E (panel)
- Yer: `apps/panel/e2e/` (Playwright 1.64, `@axe-core/playwright`). Çalıştırma: backend açıkken `pnpm --filter @qticaret/panel test:e2e`. Panelin dev sunucusu kapalıysa test onu kendisi başlatır.
- Her çalıştırma kendi geçici yöneticisini açar: Medusa CLI ile rastgele parolalı `e2e-…@example.com`. Giriş sayfasından girer; sonunda `src/scripts/remove-e2e-admin.ts` ile silinir. Kimsenin hesabı ya da tarayıcı profili kullanılmaz; oturum dosyası git dışında (`e2e/.auth`).
- Duman testleri veri değiştirmez: ana bölümler ve ayar sayfaları hatasız açılır (yakalanmamış betik hatası, 5xx yanıt ve panelin hata satırları aranır), ürün arama ve detay çalışır, içe aktarma "Kontrol et" adımı çalışır, toplu düzenleme seçim ve alan kontrolüne kadar çalışır (uygulanmaz).
- Erişilebilirlik: axe, WCAG 2.1 A/AA kurallarıyla çok kullanılan ekranlarda (ürün sihirbazı ve toplu düzenleme penceresi dahil) "ciddi" ve "kritik" bulgu bulmamalı. Kurulmamış mağazanın gördüğü öğeler (kurulum kartı) yalnızca CI'ın boş mağazasında görünür; yerelde görünmeyen bir bulgu CI'da çıkabilir.
- CI: `e2e` işi boş veritabanına migration ve demo mağazayı kurar, backend'i başlatır, testleri koşar. Başarısız çalıştırmanın raporu 7 gün saklanır.
- Yeni ekran ya da akış eklendiğinde duman listesine eklenir (docs/06 kontrol listesi).

## Görünüm kilidi (vitrin)
- `apps/storefront/src/lib/__tests__/preset-lock.spec.tsx` (çerçeve, ana sayfa, stil özetleri) ve `preset-lock-pages.spec.tsx` (ürün ve kategori sayfası), vitrin birim testlerinin parçasıdır (`pnpm verify:changed` koşar; tema ya da `sector-packs` değişince de, vitrin ikisine bağımlı). Kuralı docs/tema/bilesen-standardi.md §7.
- `packages/sector-packs/packs/*/presets/*` altındaki her hazır görünüm kendiliğinden bulunur, sabit bir mağaza fikstürüne uygulanır ve vitrinin kendi görünüm katmanından (`shopView`, `homeSections`) ve ekranlarından (`ProductScreen`, `ListingScreen`) temayla çizilir. Çerçeve (`frame.html`), ana sayfa (`home.html` ve bölüm bölüm `home-NN-<id>.html`), ürün sayfası (`product.html`: seçenekli ürün; indirimli, az kalan ve tükenmiş varyant) ve kategori sayfası (`listing.html`: süzgeçler, sıralama, sayfalama, kartlar) HTML olarak `preset-lock/<paket>-<görünüm>/` altında saklanır; fikstür `src/test/preset-lock/` (`fixture-shop.ts`, sayfalar için `fixture-pages.ts`); tema stil dosyaları sha256 özetleriyle `preset-lock/styles.lock.json`'da.
- Kırılırsa: fark bilerekse görünümlere tarayıcıda bakılır, `pnpm lock:presets` ile örnekler yeniden yazılır ve PR'da etkilenen görünümler yazılır; değilse tasarım ayar ya da yeni biçim olarak gelir.
- Örneği olmayan görünüm ya da sayfa testi kırar; mesaj dosya adını ve `pnpm lock:presets` komutunu söyler.
- Kapsamaz: backend'in bölüm şemalarının varsayılanları (fikstür, backend'in yayın yolunu testte yeniden yazar), istemcide açılan yüzeyler (sepet çekmecesi, arama paneli, hızlı bakış: Radix diyaloğu, etkileşim ve istek ister; tarayıcı denetimine kalır, adr/0067 §3), hesap, sepet, ödeme ve içerik sayfaları, ürün sayfasının `?variant=` ile seçilmiş hâli ve süzgeç uygulanmış liste, istemci tarafı davranış ve gerçek CSS çizimi (ekran görüntüsü karşılaştırması yok; stil yalnız dosya özetiyle kilitli).
- Çözülmüş stil denetimi (adr/0067 §3, adım 0b): `apps/storefront/e2e/resolved-style/`, `pnpm style:capture` ve `pnpm style:diff`. Çalışan vitrini Playwright ile 390 ve 1440 px'te açar, görünür öğelerin hesaplanmış stilini yakalar ve iki yakalamayı karşılaştırır; sınıf ya da CSS düzeni değişince değil, gerçek görünüş değişince fark verir. Sunucu ister; `pnpm verify:changed` koşmaz, temanın çizimine dokunan PR birleşmeden önce elle koşulur (docs/tema/bilesen-standardi.md §7). Karşılaştırma mantığının birim testi vitrin testleriyle koşar (`e2e/resolved-style/__tests__`).

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
- İndirimden önceki 10 günün en düşük fiyatı (2025–2026 değişiklikleri; adr/0023 Ek 2026-11-05): fiyat artışı, indirim, zamanlı fiyat geçişlerinde doğru
- İndirimli siparişte kısmi iade: kalem indirim payı düşülür, kuruş farkı oluşmaz
- İstemciden gelen indirim/ek ücret tutarı etkisiz

## Zorunlu senaryolar (SEO)
- Slug: Türkçe karakter tablosu, uzunluk kesme, benzersizlik çakışması, değişimde otomatik 301, rezerve slug'ın yeniden kullanılamaması
- Redirect motoru: zincir düzleştirme, döngü reddi, regex zaman aşımı, sorgu parametresi davranışı, 410
- `seo` payload contract: her varlık türünde zorunlu alanlar, mutlak URL, canonical host, noindex kuralları (taslak, boş kategori, filtre parametresi)
- JSON-LD: her blok JSON şemadan geçer; `StrikethroughPrice` indirim öncesi fiyat kuralıyla tutarlı; `aggregateRating` yorumsuz üründe yok
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
