# Çoklu dil (Türkçe/İngilizce) ve para birimi (USD/EUR) planı

> Durum: **taslak plan, tartışılacak** (Deniz + Oğuzhan). Kod yok. Yol haritasında F19 "Yurt dışı satış" (docs/03-yol-haritasi.md). Başlamadan önce tek ADR yazılır ve §5'teki kararlar verilir.
> Hazırlanma: 2026-11-27, kod tabanı taramasına dayanır (dosya yolları o günkü `dev`).

## 1. Kısa özet

- **Panel:** İngilizce çeviri tam (`apps/panel/src/locales/en.json` ve `tr.json` 11.252 anahtar, eksik yok). Eksik olan dil seçimi; dil `src/lib/i18n.ts` içinde `lng: "tr"` ile sabit.
- **Vitrin:** tema metinleri zaten `t()` ile geliyor (`packages/ui/src/theme.ts` `Translate`); yalnız `apps/storefront/src/lib/i18n/tr.json` var (~1.370 anahtar). Sistem sayfa adresleri (`/sepet`, `/odeme`, `/hesap`…) Türkçe ve temada sabit.
- **Mağaza içeriği** (ürün, kategori, koleksiyon, sayfa/blog, tema bölüm metinleri, menüler, nitelikler, SEO alanları): tek dilde saklanıyor. **İşin en büyük parçası.**
- **Para birimi:** her yer TL varsayıyor (~40 backend dosyasında `"try"`, vitrinde tek TL bölgesi `liraRegion`, `formatLira`). PayTR USD/EUR'yu eşleyebiliyor; e-fatura taslağı TL dışını reddediyor (`einvoice.currency_unsupported`).
- **E-posta, SMS, yasal metinler, PDF:** yalnız Türkçe. Backend hata mesajları Türkçe + İngilizce hazır.

### Başlıkların yanındaki küçük İngilizce yazılar
Panel haritası (Oğuzhan, 2026-11-24, ADR-0079): her ekranın `{tr, en}` arama kelimeleri ve yardım metni (`packages/types/src/panel-map/*`). Komut menüsü araması içindir, paneli çevirmez; panel İngilizceye geçince kendiliğinden kullanılır. Ayrıca yapılacak bir şey yok.

## 2. Bugünkü durum (ayrıntı)

| Alan | Durum | Ana dosyalar |
|---|---|---|
| Panel metinleri | tr/en tam; dil seçimi yok | `apps/panel/src/lib/i18n.ts` |
| Panel biçimleri | 31 yerde `tr-TR` sabit sayı/tarih; ~100 yerde TL varsayımı | `packages/admin-ui/src/lib/format.ts`, `features/products/detail/variant-fields.tsx` |
| Vitrin metinleri | yalnız `tr.json`, tek sabit tablo | `apps/storefront/src/lib/i18n/index.ts` |
| Vitrin adresleri | Türkçe sistem sayfaları, temada 37 sabit bağlantı | `apps/storefront/src/app/*`, `packages/themes/atolye` |
| Vitrin para | `formatLira`, tek TL bölgesi, ülke `tr` sabit | `packages/ui/src/money.ts`, `lib/store-api/requests.ts`, `lib/checkout/address-form.ts` |
| Desteklenen dil/para | `SUPPORTED_LOCALES = ["tr"]`, `SUPPORTED_CURRENCIES = ["try"]` | `packages/types/src/locale.ts` |
| İçerik çevirisi | tek dil; `seo_meta`'da dil sütunu yok | `modules/seo-meta`, `modules/content`, `modules/storefront-layout`, `modules/storefront-menus` |
| Adres kaydı | **dile hazır** (girişte dil, dil başına benzersiz yol) | `modules/url-registry/models/url-entry.ts` |
| SEO | `hreflang` alanı var, boş | `lib/seo/resolve.ts`, docs/13 |
| Hata mesajları | tr + en hazır | `apps/backend/src/lib/errors/messages/{tr,en}.ts` |
| E-posta/SMS | yalnız tr (25 şablon + düzenlenebilir metinler) | `lib/messaging/texts.ts`, `lib/messaging/templates/` |
| Yasal metinler | Türk hukukuna göre Türkçe başlangıç metinleri | `lib/legal/starters/` |
| Ödeme | PayTR USD/EUR/GBP eşlemesi var; ödeme sayfası dili `tr` sabit | `lib/payments/paytr/fields.ts`, `client.ts` |
| Fatura | TL dışı reddedilir, kur kaynağı yok | `lib/invoicing/draft.ts` |
| Besleme/JSON-LD | TRY sabit | `lib/google/merchant.ts`, `workflows/marketing/feed-catalog.ts`, `lib/seo/jsonld-product.ts` |
| Kargo | yalnız Türkiye (adres veritabanı, yerli firmalar) | — |

Açık nokta: Medusa 2.22.6'da yerleşik bir çeviri modülü olup olmadığı doğrulanmadı (Context7 ve `node_modules` ile ADR'den önce bakılacak). Varsa C aşamasında kendi modülümüz yerine o kullanılabilir.

## 3. Aşamalar

### A — Panel İngilizce (küçük, 2–3 PR)
- Kullanıcı menüsünde dil seçimi; personel başına saklanır, tarayıcıda önbellek.
- Sabit `lng` kalkar; `<html lang>` dile göre.
- Ortak `formatNumber / formatDate / formatMoney(tutar, para, dil)`; 31 sabit biçim bunlara taşınır.
- Panel dili backend'e gider, hata mesajları İngilizce döner.
- tr/en anahtar eşitliği testi; İngilizce duman testi.

### B — Vitrin ekranları İngilizce, `/en` adresleri (orta, 4–6 PR)
- `SUPPORTED_LOCALES = ["tr","en"]`; Türkçe öneksiz, İngilizce `/en/...`; dil, vitrinin istek işleyicisinde (`apps/storefront/src/proxy.ts`) belirlenir.
- Sistem sayfalarının İngilizce adları (`/en/cart`, `/en/checkout`…) `packages/ui`'da tek yol haritasından; temadaki 37 sabit bağlantı buna geçer. **Tema tarafı Oğuzhan'ın alanı.**
- `en.json`; `t` istek başına; `formatLira` dile duyarlı; `<html lang>`.
- url-registry'de İngilizce adresler; `hreflang` + `x-default`, dil başına canonical, sitemap'te alternatifler, `og:locale`.
- Mağaza ayarı: "İngilizce vitrin açık/kapalı".
- **İçerik bu aşamada Türkçe kalır → `/en` C bitene kadar `noindex`** (yarı çevrili site çift içerik sayılır).

### C — Mağaza içeriğinin çevirisi (büyük, 6–10 PR)
- Önce karar: Medusa'nın çeviri modülü (varsa) mı, kendi `content-translations` modülümüz mü (varlık, id, dil, alan).
- Kapsam: ürün adı/alt başlık/açıklama/seçenek değerleri; kategori, koleksiyon, marka, nitelik ad ve değerleri; sayfa/blog; tema bölüm metinleri; menüler; açılır pencereler; SEO alanları (`seo_meta`'ya dil sütunu).
- Store API çeviriyi döner, eksik alanda Türkçeye düşer.
- Panel: düzenleme ekranlarında "Türkçe | English" sekmesi, "eksik çeviriler" listesi, mevcut yapay zekâ ve kredi sistemiyle **"Yapay zekâyla çevir"**. Tema editöründe dil başına metin alanları.
- Dil/ülke başına beslemeler (Merchant Center), İngilizce slug'lar.

### D1 — Döviz yalnız gösterim (orta)
- Günlük TCMB kur işi, para birimi seçici; fiyatlar "≈ $X" gösterilir, sepet ve ödeme TL kalır. Fatura değişmez. En düşük risk.

### D2 — Gerçek USD/EUR fiyat ve ödeme (büyük)
- Bölgeler (ör. `eu` EUR, `intl` USD); mağazanın desteklediği para birimlerine eklenir.
- Fiyatlar elle ya da kur + marj + "güzel" yuvarlama (49,90) ile; her para biriminin KDV dahil/hariç ayarı.
- `liraRegion` kilidi kalkar; bölge ülke/çerezden; sepette para değişimi.
- ~40 `"try"` yeri: kargo ücreti ve ücretsiz kargo eşiği, hediye kartı, kampanyalar, ödeme bağlantıları, raporlar, muhasebe, beslemeler; fiyat geçmişi ve JSON-LD para başına.
- PayTR: hesabın döviz onayı, taksit kapalı, `lang: "en"`.
- Fatura: `draft.ts` engeli kalkar; döviz faturası (para + TCMB kuru) BirFatura üzerinden (API desteği doğrulanmalı); ihracatta KDV istisnası (ETGB / mikro ihracat) → **mali müşavir** (`docs/mali-musavir-sorulari.md`'ye eklenecek).
- Yurt dışı kargo (yabancı adres, uluslararası firma, gümrük) ayrı bir projedir.

### E — E-posta, SMS, yasal metinler, belgeler (orta, 3–4 PR)
- İngilizce mesaj tabloları ve şablonlar; sipariş hangi dilde verildiyse mesajlar o dilde (`order.metadata.locale`).
- Düzenlenebilir metinler dil başına.
- İngilizce yasal başlangıç metinleri (**hukuk kontrolü gerekir**), İngilizce sipariş PDF'leri.
- Kargo etiketleri ve e-faturalar Türkçe kalır (resmî belge).

## 4. Önerilen sıra

1. **A** (1–2 hafta, risksiz, hemen faydalı).
2. **Tek ADR** (F19 dil + para) ve §5 kararları; Medusa çeviri modülü kontrolü.
3. **B** (`/en` noindex).
4. **C** (yapay zekâ çevirisiyle).
5. **D1**.
6. **E**.
7. **D2** yalnız §5'te 1 ve 3 "evet" ise.

## 5. Verilecek kararlar

1. **Ödeme:** yabancı müşteri USD/EUR mı öder (D2), yoksa dövizle görüp TL mi öder (D1)?
2. **Döviz fiyatı:** elle mi girilir, kurdan otomatik mi (hangi kur, günün hangi saati, marj, yuvarlama)?
3. **Yurt dışı kargo** kapsamda mı? Değilse İngilizce/döviz Türkiye'deki yabancı müşteriye hizmet eder.
4. **Yasal İngilizce:** hangi metinler hukukça onaylı İngilizce ister; bağlayıcı olan Türkçe mi kalır?
5. **Çeviri:** mağaza elle mi, yapay zekâ taslağı + mağaza onayı mı, ücretli yapay zekâ kredisi mi? İngilizce bir plan/paket özelliği mi?
6. **İngilizce adresler:** `/en/...` altında İngilizce slug (SEO için daha iyi) mı, Türkçe slug mı?
7. **İş bölümü:** B'nin tema/vitrin kısmı (yol haritası, 37 bağlantı, dil başına metin alanları) Oğuzhan'da mı?

## 6. Riskler

- **SEO:** yarı çevrili `/en` çift içerik → C bitene kadar noindex; Türkçe adresler değişmez.
- **Bölge değişimi** sepette fiyatı ve kampanyayı değiştirir; hediye kartı ve mağaza kredisi TL'dir.
- **Fatura/vergi:** döviz e-Arşiv, fatura günü kuru, KDV istisnası yanlış yapılırsa hukuki risk.
- **PayTR:** döviz onayı ve ödemenin hangi parayla hesaba geçtiği bizim elimizde değil.
- **Kalıcı maliyet:** her yeni ekran metni iki dilde yazılır; anahtar eşitliği testi bunu zorunlu kılar.
