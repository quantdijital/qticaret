# Platform eksik analizi: Shopify, ikas ve TR platformlarına karşı (2026-11-03)

> Amaç (kullanıcı, 2026-11-02): "ne Shopify kadar büyük bir sistem ne de basit işlevsiz; dengeli, optimize, profesyonel, Türkiye için". Araştırma bir alt ajanla yapıldı (kaynaklar sonda); karar ve sıra ana oturumun. Durum işaretleri: ✅ var · 🟡 kısmen · ❌ yok. Rakipte 🟡 = ücretli uygulama ya da üst paket.

## Özet yargı

Çekirdek (ödeme, kargo, e-fatura, KVKK/İYS, SEO, yorum ve soru-cevap, raporlar, roller, denetim kaydı) Shopify'ın Türkiye'de dört beş ücretli uygulamayla kapattığı alanı tek pakette kapatıyor. SEO ve yasal uyumda rakiplerin önündeyiz. Gerçek boşluklar üç kümede:

1. **Vitrini bitiren işler:** tema ayarları ve diğer sayfaların bölümleri, dönüşüm olayları, arama kalitesi, mobil alt gezinme, CWV kanıtı.
2. **TR esnafının günlük kullandığı kolaylıklar:** toplu e-posta/SMS kampanyası, panelden sipariş ve ödeme bağlantısı, sepette öneri, pop-up, hediye kartı satışı.
3. **Doğru biçimde F19'a bırakılan büyük parçalar:** pazaryeri, B2B, sadakat, çok dil ve para birimi, abonelik.

Shopify Plus ya da Ticimax'ın "400 kampanya kurgusu" türü şişkinlik hedefe aykırı; atlanır.

## 1. Özellik matrisi

S = Shopify, I = ikas, TR = Ticimax / IdeaSoft / T-Soft.

### Satış ve kampanya

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| Kupon (yüzde/tutar, kapsam, limit, tarih) | ✅ | ✅ | ✅ | ✅ | tek kullanımlık toplu kod |
| X al Y öde | ✅ | ✅ | ✅ | ✅ | |
| Sepette indirim, ücretsiz kargo eşiği | ✅ | ✅ | ✅ | ✅ | |
| Zamanlı fiyat / flash sale | ✅ | ✅ | ✅ | 🟡 | zamanlı fiyat listesi var; vitrinde kampanya sayfası ve geri sayım yok |
| Hediye kartı | ✅ | 🟡 | ✅ | 🟡 | kullanım ✅; vitrinde satış ❌ |
| Çapraz satış / upsell | 🟡 | ✅ | ✅ | 🟡 | ürün sayfasında benzer ürünler; sepette öneri yok |
| Kombin / paket ürün | 🟡 | ✅ | ✅ | ❌ | |
| Ürün ek seçenekleri (ücretli metin, seçim) | 🟡 | ❌ | ✅ | ❌ | D13; ilk müşteri istiyor |
| Panelden sipariş + ödeme bağlantısı | ✅ | ✅ | ✅ | ❌ | Instagram/WhatsApp satışı için TR'de yaygın |
| Müşteri grubuna özel fiyat | ✅ | ✅ | ✅ | ✅ | |
| Ödeme yöntemine göre indirim, parçalı ödeme | ❌ | ❌ | ✅ | ❌ | gereksiz |

### Katalog

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| Varyant, kategori ağacı, koleksiyon, marka, öznitelik şablonu | ✅ | ✅ | ✅ | ✅ | |
| Excel içe/dışa aktarma, toplu düzenleme | ✅ | ✅ | ✅ | ✅ | |
| Çoklu depo | ✅ | ✅ | ✅ | ✅ | |
| Ön sipariş, düşük stok uyarısı, stok hareketi | ✅ | ✅ | ✅ | ✅ | |
| Dijital ürün | ✅ | ✅ | ✅ | ✅ | |
| Site içi arama (yazım toleransı, öneri) | ✅ | ✅ | ✅ | ✅ | PostgreSQL tam metin (adr/0056): Türkçe kök, yazım toleransı, eş anlamlılar, "bunu mu demek istediniz", SQL'de facet |
| Tedarikçi XML | 🟡 | 🟡 | ✅ | ❌ | dropshipping segmenti; sonra |

### Ödeme

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| iyzico / PayTR | 🟡 (+komisyon) | kendi POS | ✅ | ✅ | komisyonsuz, hesap mağazanın |
| Taksit tablosu | 🟡 | ✅ | ✅ | ✅ | |
| Havale/EFT, kapıda ödeme | 🟡 | ✅ | ✅ | ✅ | |
| Doğrudan banka sanal POS | ❌ | ✅ | ✅ | ❌ | banka başına iş; sonra |
| Ters ibraz kaydı ve belge paketi | ✅ | ❌ | ❌ | ✅ | |

### Kargo ve operasyon

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| Aras, Yurtiçi doğrudan | 🟡 | ✅ | ✅ | ✅ | |
| DHL eCommerce (eski MNG), Sürat, PTT | 🟡 | ✅ | ✅ | ❌ | Sıraya alındı (2026-11-26; MNG → Sürat → PTT, ADR-0035 ek); MNG = DHL eCommerce, Sürat ve PTT kodlandı (2026-11-26, gerçek hesap bekliyor); araştırma `docs/entegrasyonlar/dhlecommerce.md` (eski adı `mng.md`), `surat.md`, `ptt.md` |
| HepsiJet ve diğerleri | 🟡 | ✅ | ✅ | ❌ | İstendikçe doğrudan eklenir (Geliver aracılığı 2026-11-26 kaldırıldı) |
| Etiket, takip, kargoya hazır listesi | ✅ | ✅ | ✅ | ✅ | |
| İade/değişim akışı | ✅ | ✅ | ✅ | ✅ | iade belgesi ve değişim faturası mali müşavirin 5.4 cevabıyla bitti (E6b, 2026-10-31) |
| Sipariş düzenleme, iç not | ✅ | ✅ | ✅ | ✅ | |
| Dolandırıcılık kontrolü | ✅ | ❌ | 🟡 | ✅ | |
| e-Fatura / e-Arşiv | 🟡 | ✅ | ✅ | 🟡 | Paraşüt; ikinci entegratör yok |
| Ön muhasebe / ERP | 🟡 | ✅ | ✅ | 🟡 | Paraşüt + dışa aktarım |

### Müşteri ve pazarlama

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| Hesap, misafir, Google/Apple giriş | ✅ | ✅ | ✅ | ✅ | |
| Yorum/puan, soru-cevap | 🟡 | ✅ | ✅ | ✅ | |
| Favori, stok bildirimi | 🟡 | ✅ | ✅ | ✅ | |
| Terk edilmiş sepet e-postası | ✅ | ✅ | ✅ | ✅ | |
| WhatsApp sepet hatırlatma | 🟡 | ✅ | ✅ | ❌ | WhatsApp Business API gerekir |
| Toplu e-posta / SMS kampanyası | ✅ | ✅ | ✅ | ❌ | yalnız işlemsel ileti ve bülten onayı var |
| Pazarlama otomasyonu akışları | ✅ | ✅ | ✅ | ❌ | şişkinlik |
| Pop-up | 🟡 | ✅ | ✅ | ❌ | |
| Segmentler | ✅ | ✅ | ✅ | ✅ | |
| Sadakat / puan | 🟡 | ❌ | ✅ | ❌ | F19 |
| Merchant, Meta katalog, Akakçe/Cimri | ✅/🟡 | ✅ | ✅ | ✅ | |
| GA4 + Meta dönüşüm | ✅ | ✅ | ✅ | 🟡 | backend hazır; vitrin olayları açık |
| SMS + İYS | 🟡 | ✅ | ✅ | ✅ | |
| Canlı destek widget'ı | 🟡 | 🟡 | 🟡 | ❌ | 3. parti betik alanı yok |
| Abonelik ürünleri | 🟡 | ❌ | ✅ | ❌ | F19 |
| B2B / toptan / teklif | ✅ | ✅ | ✅ | ❌ | F19; RFQ D14 |

### İçerik ve SEO

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| Blog, sayfalar, filtre sayfaları | ✅/❌ | ✅ | ✅ | ✅ | özgünlük kapısı |
| 301/404, sitemap, robots, canonical | 🟡 | 🟡 | ✅ | ✅ | önde |
| JSON-LD, SEO puanı ve yayın kapısı | 🟡 | ❌ | 🟡 | ✅ | farklılaştırıcı |
| Search Console / CrUX panelde | ❌ | ❌ | ❌ | ✅ | |
| Yapay zekâ içerik taslağı | ✅ | ✅ | ✅ | ✅ | |
| Çok dil / para birimi | ✅ | ✅ | ✅ | ❌ | F19 |
| KVKK, çerez, mesafeli satış, künye | 🟡 | ✅ | ✅ | ✅ | sürümlü |

### Yönetim, raporlama, entegrasyon, vitrin

| Özellik | S | I | TR | Bizde | Not |
|---|---|---|---|---|---|
| Raporlar ve dışa aktarma | ✅ | ✅ | ✅ | ✅ | |
| Roller, 2FA, denetim kaydı | ✅ | 🟡 | 🟡 | ✅ | |
| Kurulum sihirbazı | ✅ | ✅ | ✅ | 🟡 | kontrol listesi var |
| API + webhook | ✅ | ✅ | 🟡 | ✅ | |
| Pazaryeri (Trendyol, HB, N11, Amazon) | 🟡 | ✅ | ✅ | ❌ | F19 ilk madde |
| Veri taşıma | ✅ | 🟡 | 🟡 | ✅ | WooCommerce kaynağı bekliyor |
| Tema düzenleyici (bölümler) | ✅ | ✅ | ✅ | 🟡 | ana sayfa ✅; ürün ve kategori yapılıyor |
| Tema ayarları (renk, logo, yazı tipi) | ✅ | ✅ | ✅ | 🟡 | D11 |
| Birden çok tema | ✅ | ✅ | ✅ | 🟡 | sözleşme + 1 tema |
| Mobil alt gezinme | tema | ✅ | ✅ | ❌ | |
| CWV kanıtı | ✅ | ✅ | 🟡 | 🟡 | D12 |

## 2. Karar: gerekli, faydalı, gereksiz

### Gerekli (lansmandan önce)

| İş | Boyut | Dış servis | Neden | Durum |
|---|---|---|---|---|
| Tema düzenleyicide ürün ve kategori bölümleri | M | — | "tema" vaadi ana sayfayla bitmez | 2026-11-03 gecesi |
| Tema ayarları: renk, yazı tipi, köşe, kart biçimi (D11) | M | — | mağaza kendi görünümünü kursun; tasarımı kullanıcı yapacak, altyapı bizden | gece/sabah |
| Vitrin dönüşüm olayları (GA4, Meta; çerez iznine bağlı) | S | ücretsiz hesaplar | reklam veren her mağaza ilk gün ister | gece |
| Mobil alt gezinme | S | — | trafik %75+ mobil | gece |
| CWV / Lighthouse kapanışı (D12) | S–M | — | SEO vaadinin kanıtı | gece sonu |
| Arama kalitesi | M | yok (PostgreSQL `unaccent`, `pg_trgm`) | "bulamıyorum" terk sebebi | **Karar (2026-11-03, kullanıcı: "postgresql tam metin ile ilerle gerek yok diğerlerine. kaliteli sağlam ilerleyelim."):** arama ve tüm listeler PostgreSQL tam metin indeksinde (adr/0056); Meilisearch ve dış arama servisi kalıcı olarak yok. Türkçe kök + işaretsiz kelime, yazım toleransı (trigram sözlüğü), eş anlamlı grupları (panel), facet ve sayfalama SQL'de: 3000 ürün sınırı kalktı. 10.000 üründe facet'li arama medyanı 19 ms |
| Toplu e-posta/SMS kampanyası (segment → şablon → gönder, İYS süzgeci, kota) | M | Resend/Netgsm kullanım ücreti | TR esnafının haftalık rutini | gece sonu ya da sabah planı (ADR) |
| Panelden sipariş + ödeme bağlantısı | M | — | Instagram/WhatsApp satışı ana kanal | sabah planı (ADR) |
| Hediye kartı satışı ve bakiye | S–M | mali müşavir: KDV anı | altyapı hazır, yarım görünüyor | gece sonu; KDV notu açık |
| Ürün ek seçenekleri (D13) | M | — | ilk müşterinin gerçek ihtiyacı | ADR ile sabah planı (fiyat sunucuda) |
| İade faturası (E6) | S | mali müşavir | yasal zorunluluk | kod dışı cevap bekliyor |
| Demo/test kalıntılarının panelden kaldırılması | S | — | kullanıcı: "kafam karışıyor" | gece |

### Faydalı (sonraki tur)

| İş | Boyut | Neden |
|---|---|---|
| Sepette çapraz satış ve kombin/paket | S/M | sepet ortalaması |
| Pop-up (bülten, ilk alışveriş indirimi) | S | `consent_request` modeli hazır |
| 3. parti betik alanı (nonce'lu, izin listeli) | S | canlı destek/Hotjar için tek kapı |
| WhatsApp sepet hatırlatma | M | WhatsApp Business API (Meta, ücretli) |
| İkinci tema | M | ADR-0046'nın kanıtı |
| Kurulum sihirbazı (P2) | S–M | onboarding |
| Trendyol + Hepsiburada | L | ikas'ın ana argümanı; F19 ilk |
| İkinci e-fatura entegratörü | M | Paraşüt kullanmayan müşteri |
| Basit sadakat (kazan-harca) | M | tutundurma |
| RFQ / teklif iste (D14) | S–M | B2B'nin ucuz %20'si |
| WooCommerce taşıma kaynağı | M | TR'de WordPress mağaza çok; plan hazır (2026-11-02) |
| Bakım / yakında modu | S | açılış öncesi ve bakım |
| Kampanyalar sayfası, tüm kategoriler/markalar sayfaları, blog kategorileri | S–M | gezinme ve iç bağlantı; gece |

### Gereksiz ya da sonra

| İş | Neden |
|---|---|
| Doğrudan banka sanal POS'ları | banka başına iş; PayTR/iyzico aynı taksitleri verir |
| Parçalı ödeme, ödeme yöntemine göre indirim | nadir; mutabakatı zorlaştırır |
| Pazarlama otomasyonu akışları, affiliate | KOBİ kullanmıyor |
| Yüzlerce hazır kampanya kurgusu | 5 tür + birleşme kuralı yeter |
| Müşteri mobil uygulaması, POS | PWA yeter; F19 |
| Çok dil/para, abonelik, tam B2B (cari, vade) | F19 ADR'leriyle |
| Tedarikçi XML, ERP (Logo, Mikro, Nebim) | segment çıkınca adaptör |
| Ürün karşılaştırma, canlı yayın satış | kullanım düşük |

## 3. Sıra ve bağımlılıklar

1. Gece (2026-11-03): tema bölümleri (ürün, kategori), dönüşüm olayları, mobil alt gezinme, trigram arama, panel temizliği, yasal vitrin eksikleri, sayfalar ve blog kategorileri, bakım modu, hediye kartı satışı (KDV notu açık), CWV ölçümü.
2. Sabah planı (kullanıcıyla): kampanya gönderimi ADR'si, panelden sipariş ADR'si, ürün ek seçenekleri ADR'si, Meilisearch kararı, WooCommerce kaynağı, tema ayarlarının tasarım kısmı.
3. F19'a kalanlar değişmedi.

## Kaynaklar

- Shopify: [fiyat ve plan karşılaştırma](https://www.shopify.com/pricing) · [Plus özellikleri](https://help.shopify.com/en/manual/intro-to-shopify/pricing-plans/plans-features/shopify-plus-plan) · [indirim türleri](https://help.shopify.com/en/manual/discounts/discount-types)
- ikas: [özellikler](https://ikas.com/tr/ozellikler) · [fiyatlar](https://ikas.com/tr/fiyatlar) · [pazaryeri entegrasyonları](https://ikas.com/tr/pazaryeri-entegrasyonlari)
- Ticimax: [özellikler](https://www.ticimax.com/ozellikler) · IdeaSoft: [özellikler](https://www.ideasoft.com.tr/ozellikler), [paketler](https://www.ideasoft.com.tr/e-ticaret-paketleri) · T-Soft: [kampanya özellikleri](https://www.tsoft.com.tr/kampanya-ozellikleri)
- Mevzuat: [GİB e-Arşiv](https://ebelge.gib.gov.tr/earsivhakkinda.html) · [İYS](https://iys.org.tr/)
- Not: ikas ve IdeaSoft paket tabloları parça parça okunabildi; paket katmanı bazı satırlarda belirsiz. TR platformlarının API/webhook derinliği pazarlama metninden doğrulanamadı (docs/15 §11).
