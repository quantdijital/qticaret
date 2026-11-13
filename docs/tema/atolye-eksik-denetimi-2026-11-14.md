# Atölye eksik denetimi (2026-11-14)

> Keşif ajanlarının bulguları; plan bu dosyaya dayanır. [D] kodda doğrulandı, [Ç] çıkarım.

## 1. Tema ayarları (ajan 1, bitti)

Şema: `apps/backend/src/modules/platform-settings/sections/theme.ts:41-118`. Kararı veren kod: `apps/storefront/src/themes/atolye.ts:13-19` (accent null, background "warm", typography/radius/buttons varsayılana sabit; `fontPreloads` hep Manrope).

| Ayar | Bugün | Neden / nerede |
|---|---|---|
| colors.primary | uygulanıyor | `--primary` → `--color-signal` (tokens.css:59); duyuru şeridi yine grafit (`frame/Announcement.tsx:31`) |
| colors.accent | atılıyor | Atölye `--highlight`'ı hiçbir bileşende okumuyor |
| colors.background | "warm"a sabit | bileşenler `--background` değil `paper/paper-2/paper-3` kullanıyor (48/138/44 kullanım) |
| typography | atılıyor | vitrin `--font-heading/--font-sans` basıyor, Atölye `--font-display/--font-body` okuyor (tokens.css:79-80) |
| radius, buttons | atılıyor | sabit px token (tokens.css:82-85); `.gf-btn` doğrudan `--radius-pill` (ui.css:33) |
| product_card.ratio | HATALI | 1:1 ve 3:4 çalışıyor; **4:5 seçilince hiçbir şey basılmıyor** (`theme.ts:96`), Atölye'nin `--card-ratio: 1/1`'i kalıyor (styles.css:80) → kare |
| show_brand | uygulanıyor | `lib/views/product.ts:38`, `parts/ProductCard.tsx:112` |
| show_rating | ölü ayar | `ProductCardView.rating` var ama hiçbir üretici doldurmuyor; `StoreCardFacts` puan taşımıyor (`types/store/catalog.ts:133-137`) |
| header.layout | yok sayılıyor | wordmark hep solda (`frame/Header.tsx:95`); varsayılan "centered" ama fiilen "left" |
| header.sticky | uygulanıyor | `Header.tsx:76`; kapalıyken `top-40` yapışkan sütunlar boşluk bırakır [Ç] |

Diğer: köşe sınıfları tsx'te `rounded-tile` 90, `rounded-media` 80, `rounded-pill` 75, `rounded-inner` 43; pill düğme ile çip aynı token'ı paylaşıyor. 7 seçilebilir yazı tipinin dosyası var (`public/fonts`, `app/fonts.ts:10-21`); dm-serif tek ağırlık (400), Atölye başlığı 800 + `font-synthesis: none` → ince çıkar [Ç]; playfair ve dm-serif'te ₺ yok. Caslon/Hanken ve `THEME_OWN_FONT_FILES` kalıntı. Önyükleme bütçesi ≤125 KB (design.md); Fraunces+Inter ≈ 124 KB.

Panel: "Tema ayarları" tüm alanları gösteriyor, yok sayılanlar için uyarı yok; ipuçları ve `ThemeSample` (`theme-fields.tsx:196-244`) Atölye'nin uygulamadığını gösteriyor. Kaydedilmemiş ayar önizlenemiyor; ayar kayıtla hemen yayına giriyor (adr/0053 §B.7).

Değişecek testler: `themes/__tests__/choice.spec.ts:52-81`, `app/__tests__/fonts.spec.ts`, `lib/views/__tests__/theme.spec.ts:49-99`, `lib/__tests__/atolye-frame-theme.spec.ts:184-191`, `test/theme-render.ts:71`, panel `theme-panel.spec.tsx`, `theme-settings.spec.ts`; metin: adr/0057:23, docs/19:212.

İş sırası önerisi: (1) ADR eki S, (2) kart oranı düzeltmesi S, (3) yazı tipleri M, (4) köşeler M, (5) düğmeler M, (6) zemin M-L (kontrast yeniden ölçüm), (7) vurgu S-M, (8) ortalanmış header L, (9) show_rating backend+vitrin M-L, (10) panel ipuçları/örnek M, kaydedilmemiş önizleme L, (11) testler ve CSS ölçümü S.

Risk: Grafit kimliği (tek grotesk, pill) serif ve keskin köşeyle bozulabilir; sahip kararı.

## 2. Özellik boşlukları (ajan 2)

Bitti. A = vitrinde çalışıyor, B = backend hazır tema göstermiyor, C = backend işi gerek, D = hiç yok. İhtiyaç listesi: `ikinci-tema-ihtiyac-taslagi.md`.

**A (zaten çalışıyor) [D]:** tip + marka menüsü, landing (filtre sayfası) bağlantıları; fiyat/marka/stok ve seçme türü özellik filtreleri; galeri + zoom; gruplu teknik tablo (`product/Specs.tsx`), özet 4 özellik + tam tablo; soru-cevap; yorumlar (mağaza yanıtı, fotoğraf); kişiselleştirme ek seçenekleri (metin, karakter sınırı, ek ücret; `lib/catalog/addons/schema.ts:72-114`, `product/Extras.tsx`); hediye paketi (choice ek seçeneği); mobil yapışkan sepet çubuğu (`product/BuyBar.tsx`); taksit tablosu; stok alarmı; WhatsApp; garanti/kargo/iade; güven bandı; hero, karolar, raflar, bülten, rehber yazıları, müşteri fotoğrafları (reviews içinde); ETBİS; mobil alt gezinme; arama önerileri.

**B:** "kutuda ne var" ayrı blok (S); kişiselleştirmede süre notu (help metniyle olur); marka sayfasında logo/açıklama (doğrulanmadı, S).

**C (backend + tema):**
| İş | Boyut | ADR |
|---|---|---|
| Kart puanı card-facts ile (`api/store/card-facts/route.ts`) | S | hayır |
| Sıralama: çok satan, puana göre (bugün yalnız yeni, fiyat artan/azalan; `listing-plan.ts:85-89`) | S | hayır |
| Menü ögesine vurgu/rozet | S | 0049 eki |
| Karoların landing/koleksiyona bağlanması; hizmet şeridine bağlantı (`TrustBadgeView` bağlantı taşımıyor) | S | 0049 eki |
| Ürün yasal/güvenlik notu (`restriction` yalnız SEO'da; `compliance.age_verification` bayrağı var, vitrinde not yok) | S | belki 0041 eki |
| Evet/hayır filtresi | S | hayır |
| Kartta anahtar özellikler, varyant sayısı, tedarik süresi, rozet (`ProductCardView` `product-views.ts:19-33`) | M | evet |
| Sayı aralığı filtresi (bugün yalnız select/multi_select; `workflows/seo/listing-products.ts:57`; cutlery'de namlu_boyu, agirlik sayı) | M | 0056 eki |
| Ürüne özel SSS, bakım sekmesi, artı/eksi, "kimler için" (`Details.tsx:80-91` iki sekme) | M | 0055 eki |
| Kategori sayfasında ürün rafı bölümü | S | 0049 eki |

**D (hiç yok):** karşılaştırma butonu + sayfası (M, ADR); fiyat alarmı (M, ADR); havale indirimi (M, ADR; adr/0029 ve 0024 ile çakışıyor); video galeri (M, ADR, adr/0016); set/bundle, sepet üstü eklenti ürünleri, birlikte al (L, ADR); distribütör rozeti (S); seçim testi, set kurucu (sonra).

**Yarım görünenler:** TODO/"yakında" yok. Marka, landing, arama, kampanyalar aynı `ListingPage`; marka/landing için özgü başlık yok. `ProductCardView.rating` ölü alan.

## 3. Düzenleyici, hazır görünüm, sektör paketi (ajan 3, bitti)

Preset kavramı yok; parçaların çoğu hazır.

- **Layout modeli [D]:** `storefront_layout` (draft, published, revision; son 20 sürüm). Şema `apps/backend/src/lib/storefront/layout.ts:35-69`; gruplar header (yalnız announcement_bar), home, footer (newsletter), product, category, settings. Bölüm türleri `layout-sections.ts:197-240`: ana sayfa 15 (hero, hero_slider, banner, categories, products, featured_product, brands, posts, reviews, google_rating, rich_text, trust_badges, newsletter, help, faq), ürün 7, kategori 6. Hiçbir bölüm türünde varyant/stil alanı yok. Varsayılan `layout-default.ts:22-66`.
- **Workflow'lar:** `saveLayoutDraftWorkflow`, `publishLayoutWorkflow`, `draftSource`; admin `/admin/storefront-layout` (+publish, discard, preview, revisions/:n/restore); store `/store/storefront-layout` ve imzalı `/preview/:token`.
- **Taşınabilirlik engeli:** bölümler kayıtlara kimlikle bağlı (`category_ids`, `product_id`, `collection_id`), görseller mağazanın medya kütüphanesinden olmalı; `checkLayout` denetliyor (`workflows/storefront/layout-check.ts:78-101`).
- **Tema ayarları ve menüler taslağa girmiyor:** ikisi de kayıtla hemen yayında (`platform-settings` `theme`; `saveStorefrontMenuWorkflow`). Önizleme yalnız layout taslağını gösterir.
- **Sektör paketi [D]:** format manifest/attributes/categories/flags/seo, başka dosya reddedilir (`packages/sector-packs/src/schema.ts:74-80`). `applySectorPack` (`apps/backend/src/lib/sector-packs/apply.ts:33-57`) idempotent, yalnız ekler, geri alınamaz. cutlery: 16 kategori (vitrinde gizli), 2 bayrak, 1 SEO şablonu. Control plane kurulumda `sector_pack` adımı var (adr/0061 Ek C12); kurulumda seed:demo ya da shop:profile çalışmıyor.
- **En yakın mevcut yapı: mağaza profili** `quant-shop-profile` (`apps/backend/src/scripts/shop-profile/profile.ts:29-90`): ayar bölümleri (theme dahil), sayfalar, href ile menüler; tekrar çalıştırmak güvenli; layout yazmıyor. `linkFromHref` (`menu-hrefs.ts:44-67`) adresi kayıt bağlantısına çevirir.
- **Demo seed:** sektörsüz, görselsiz, layout ve menü yazmıyor.
- **Tema seçimi:** derleme anı `STOREFRONT_THEME`; panel ve control plane tema seçimi göstermiyor.

**Preset seçenekleri [Ç]:**
- **A (önerilen):** preset = paket içinde şemalı JSON demeti (theme, layout, menus, demo) + görseller; `applyPresetWorkflow` tutamaçları kimliğe çevirir, görselleri medyaya alır, mevcut workflow'larla layout'u taslağa yazar. Yeni kod: şema+yükleyici S, workflow M, demo ürünleri M, panel galerisi M, kurulum adımı S. Önizleme için tema ayarı ve menünün de taslağa girmesi gerek: (i) layout `settings`'e theme/menus taşımak M-L ya da (ii) önizleme token'ına geçici geçersiz kılma M.
- **B:** yeni `storefront-presets` modülü (DB'de preset, mağazanın kendi görünümünü kaydetmesi); kapsam daha büyük, instance-per-tenant'ta çoğaltma sorunu.
- Her ikisi ADR ister (A: adr/0049 ve 0061'e ek).
