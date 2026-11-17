# ADR-0064: Görünüm kitaplığı: kayıtlı tasarımlar ve galeri

- **Durum:** Öneri (sahip kararları 2026-11-15'te alındı, aşağıda; Deniz'in onayı bekleniyor)
- **Tarih:** 2026-11-15
- **İlgili:** adr/0063 (hazır görünümler; §8 karar 8 bu ADR ile değişir, iş 2.6 bu ADR'ye taşınır), adr/0049 (düzen belgesi, taslak, yayın, son 20 sürüm, imzalı önizleme, düzen kilidi, §5 yetki; Ek 2026-11-14 §7 ve §9), adr/0062 (tema ayarları), adr/0057 (tema derleme anında seçilir; değişmez), adr/0016 (medya), adr/0011 (denetim kaydı), adr/0040 (roller), `docs/kvkk-envanter.md`
- **Dayanak:** sahibin isteği ve kararları (2026-11-15, aşağıda), araştırma (§"Başkaları nasıl yapıyor", 2026-11-15'te okunan resmî sayfalar)

## Bağlam

- **Sahibin isteği (kendi sözleri):** "bu temayı seçince layout gelecek gözüktüğü gibi. kullanıcı üstünde değişiklik yapabilecek. sonra isterse kendi değişiklik yaptığı halini kaydedebilecek ayrı bir tema gibi? daha sonra başka temaya geçer ve buna geri dönerse eski yaptıkları kaybolmayacak. eğer temanın kendisine dönerse varsayılan ayarlara geri dönecek." ve "shopifyda nasılsa öyle yap".
- **Sahibin kararları (2026-11-15):** (1) kayıtlı tasarımın içeriği Shopify'daki gibi; (2) başka görünüme geçerken önce "şimdiki tasarımı kaydetmek ister misin?" sorulur, ayrıca tek bir otomatik yedek ("Son tasarımım (otomatik)") her geçişte üzerine yazılır ve kotaya sayılmaz; (3) mağaza başına en çok 10 kayıtlı tasarım; (4) panelde ayrı "Görünümler" sayfası (üstte "Kayıtlı tasarımlarım", altta "Hazır görünümler"; kartlarda Önizle / Uygula) ve tema düzenleyicide "Farklı kaydet".
- **Bugün olan (kodda doğrulandı):**
  - **Tek tasarım vardır:** `storefront_layout` satırı (`modules/storefront-layout/models/storefront-layout.ts`): `draft`, `published`, `revision`. Belge `layoutDocument` (`lib/storefront/layout.ts`): `header`, `home`, `footer`, `product`, `category` bölümleri + `settings` (`trust_badges`, `color_swatches`, `low_stock`, `theme`, `menus`, `preset`; `lib/storefront/layout-settings.ts`).
  - **Sürüm geçmişi:** `storefront_layout_revision` yalnız yayınları tutar, son 20'yi (`KEPT_REVISIONS`, `modules/storefront-layout/service.ts`); adsızdır; geri yükleme taslağa yazar (`draftSource`, `api/admin/storefront-layout/revisions/[revision]/restore/route.ts`). Liste ucu belgeyi taşımaz, yalnız özet okur (`revisionSummaries`, ham SQL).
  - **Hazır görünüm uygulaması** taslağı değiştirir (`applyPresetWorkflow`, `workflows/storefront/preset-apply.ts`): rozetler, renk örnekleri, "Az kaldı" taslaktan korunur; görünümün boş bıraktığı üst ya da alt bilgi grubunda mağazanın bölümleri kalır (`withShopFrame`, `lib/storefront/presets/document.ts`). Uygulamadan önce taslağın hiçbir kopyası alınmaz.
  - **Menüler mağaza düzeyindedir:** canlı kaynak `storefront-menus` modülü; menü bir konuma bağlıdır (`main`, `top` tek; `footer` sütunları; `modules/storefront-menus/models/storefront-menu.ts` benzersiz dizini). Belgede yalnız yayında yerine geçecek bekleyen takım durur (`settings.menus`, `lib/storefront/layout-menus.ts`); yayın onu canlı kopyadan siler (`publishStep`, `workflows/storefront/layout.ts`: `menus: null`).
  - **Önizleme** yalnız taslağı gösterir: `layoutPreview = previewSigner("layout-preview:v1", "sfl_…")` (`lib/content/preview-token.ts`), satır kimliği + `updated_at` imzası (`api/store/storefront-layout/preview/[token]/route.ts`). Vitrin `sfl_` biçimini üç yerde arar: `apps/storefront/src/proxy.ts:41`, `app/onizleme/[token]/page.tsx:32`, `lib/views/layout.ts:24`.
  - **Medya kullanımı** (`workflows/media/usage.ts` `documents()`) düzenin taslağını ve yayınını tarar, sürümleri taramaz: kullanımdaki görsel silinemez (409 `media.in_use`), sürümdeki silinebilir.
  - **Silinmiş kayıt:** `checkLayout` (`workflows/storefront/layout-check.ts`) ilk bulunamayan kayıtta `storefront_layout.target_unknown` atar, hangi bölüm olduğunu söylemez; eski bir sürümü geri yüklemek bu yüzden bütünüyle reddedilebilir. Silinmiş görsel `mediaOf` ile `content.image_unknown` verir (`workflows/content/rules.ts`).
  - **Panel:** galeri yok (adr/0063 iş 2.6 yapılmadı); vitrin ekranları `/storefront/editor`, `/storefront/menus`, `/storefront/preferences`; sürümler çekmecesi `features/storefront/editor/revisions-sheet.tsx`.
- **Olmayan:** adlandırılmış kopya, uygulamadan önce otomatik yedek, kaydedilmiş bir tasarımın taslağa dokunmadan önizlenmesi.
- **adr/0063 karar 8 neden değişiyor.** "Sürüm geçmişi aynı işi görür" varsayımı sahibin senaryosunu karşılamıyor: (1) sürümler yalnız yayınlananı tutar, yayınlanmamış çalışma bir görünüm uygulanınca kaybolur; (2) 21. yayında en eskisi silinir; (3) adsızdır, "kış tasarımım" diye bulunmaz. adr/0063'ün reddettiği "yeni `storefront-presets` modülü" gerekçesi (görünümleri her mağaza veritabanına çoğaltmak ve güncellemek) bu öneriye uymaz: hazır görünümler pakette kalır, veritabanına yalnız mağazanın **kendi** kopyaları girer; çoğaltılacak ya da güncellenecek ortak veri yoktur.

## Başkaları nasıl yapıyor

| Konu | Shopify | WordPress blok temaları | Diğerleri |
| --- | --- | --- | --- |
| Kitaplık | Bir tema yayında ("Live"), diğerleri "Draft themes"; yayın değişince eski tema taslaklara geçer, "None of your theme changes are lost" ([yayınlama](https://help.shopify.com/en/manual/online-store/themes/managing-themes/publishing-themes), [ekleme](https://help.shopify.com/en/manual/online-store/themes/adding-themes)) | Özelleştirmeler temaya bağlı veritabanı kayıtlarında (`wp_template` sorgusu `get_stylesheet()` terimiyle, genel stiller tema başına bir yazı: [şablonlar](https://developer.wordpress.org/reference/functions/get_block_templates/), [genel stiller](https://developer.wordpress.org/reference/classes/wp_theme_json_resolver/get_user_data_from_wp_global_styles/)); geri dönünce gelir: **koddan çıkarım, kullanıcı belgesi yok** | ikas: Temalarım'da Ekle, Önizle, Özelleştir, **Kopyala** ("aynı ayarlarla"), Adını düzenle, Yayınla, Kaldır (yalnız yayında olmayan) ([ikas.dev](https://ikas.dev/docs/dashboard/storefront/my-themes)). Ticimax: **doğrulanamadı** |
| Sınır | Basic/Grow/Advanced 20, Plus 100 ([ekleme](https://help.shopify.com/en/manual/online-store/themes/adding-themes), [Plus](https://help.shopify.com/en/manual/intro-to-shopify/pricing-plans/plans-features/shopify-plus-plan)); kopyalama sayfası ve REST belgesi hâlâ düz "20" diyor | — | BigCommerce: kopyalar dahil 20 özel tema ([Stencil](https://support.bigcommerce.com/articles/en_US/Public/Stencil-Themes)); ikas: sınır yazmıyor |
| Kopyala | "Copy of …" adıyla; özelleştirmeden önce yedek kopya **önerilir** ([kopyalama](https://help.shopify.com/en/manual/online-store/themes/managing-themes/duplicating-themes)); kopyalanan dosyaların tam listesi **doğrulanamadı** | Dışa aktarma özelleştirilmiş şablon ve stillerle zip verir ([site editörü](https://wordpress.org/documentation/article/site-editor/)) | BigCommerce "Make a copy" yedek ya da özelleştirme için; kopya özgün temanın güncellemelerini almaz |
| Temanın içi | JSON şablonlar (bölümler ve ayarları), bölüm grupları (`sections/header-group.json`), `config/settings_data.json` ([JSON şablon](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates), [bölüm grupları](https://shopify.dev/docs/storefronts/themes/architecture/section-groups), [settings_data](https://shopify.dev/docs/storefronts/themes/architecture/config/settings-data-json)) | Şablon özelleştirmeleri ve genel stiller | Wix: geri yükleme CMS koleksiyonlarına dokunmaz ([Site History](https://support.wix.com/en/article/viewing-and-managing-your-site-history)) |
| Temanın dışı | Ürün, koleksiyon, **menü**, sayfa, blog, görseller (Content > Files) ([indirme](https://help.shopify.com/en/manual/online-store/themes/managing-themes/downloading-themes)); menüler Content > Menus'te, tema yalnız nerede gösterileceğini seçer ([menüler](https://help.shopify.com/en/manual/online-store/menus-and-links)); `link_list` ayarı mağazanın menülerinden seçer, menü silinmişse `blank` döner ([input settings](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings)) | İçerik (yazılar, menüler) temadan bağımsız | — |
| Önizleme | Yayınlamadan paylaşılır; ziyaretçi önizlemesi 2 gün, giriş isteyen 30 gün ([ekleme](https://help.shopify.com/en/manual/online-store/themes/adding-themes)) | — | ikas: Önizle |
| Silme, ad | Silme "kalıcı"; önce indirmek önerilir ([kaldırma](https://help.shopify.com/en/manual/online-store/themes/managing-themes/removing-themes)); yeniden adlandırma sayfası **doğrulanamadı** | Şablon başına "Reset … clear all customizations" ([şablon editörü](https://wordpress.org/documentation/article/template-editor/)) | Wix: sürümler adlandırılır, yıldızlanır |
| Güncelleme | "Updated copy of …" ayrı taslak; ayarlar, bölüm ve blok ayarları taşınır, çakışan kod düzenlemesi taşınmaz; otomatik yedek yok ([güncelleme](https://help.shopify.com/en/manual/online-store/themes/managing-themes/updating-themes)) | Seçilen stil varyasyonu veritabanına yazılır, dosyadaki sonraki değişiklik gelmez ([stil varyasyonları](https://developer.wordpress.org/themes/global-settings-and-styles/style-variations/)) | — |
| Preset / stil | `settings_data.json`: `current` + en çok 5 `presets`; preset seçmek yalnız görünüm ayarlarını `current`'a kopyalar | Stil varyasyonları `/styles`; "Reset to defaults"; ek CSS tema değişince silinir ([stiller](https://wordpress.org/documentation/article/styles-overview/)) | BigCommerce: tema başına en çok 4 varyasyon, düzenleme yalnız seçilene ([customizability](https://docs.bigcommerce.com/docs/storefront/stencil/themes/foundations/customizability)); "Restore original theme styles" bileşenleri silmez ([Page Builder](https://support.bigcommerce.com/articles/Public/Page-Builder)) |
| Geçmiş | Düzenleyicide geri al yalnız kaydedilmemiş değişikliğe; sürüm geçmişi yok ([düzenleyici](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/using-the-theme-editor)); kod düzenleyicide dosya başına "Timeline" ([kod](https://help.shopify.com/en/manual/online-store/extend/theme-code)); erken erişimdeki Canvas'ta bütün tema sürüm geçmişi | Stil revizyonları; şablon revizyonları **doğrulanamadı** | Wix: her kayıt ve yayın tarihli, e-postalı; geri yükleme sonrakileri siler |
| Boyut | `settings_data.json` 1,5 MB, şablon başına 25 bölüm, bölümde 50 blok ([limits](https://shopify.dev/docs/storefronts/themes/architecture/limits)) | — | — |

**Dersler.** (1) Her platformda içerik (ürün, sayfa, menü, görsel) mağaza düzeyindedir; tema yalnız başvurur, başvurduğu silinmişse boş gösterir. (2) Yedek her yerde elle alınan kopyadır; otomatik yedek kimsede yok (Shopify yalnız güncellemede ayrı kopya açar). (3) Sınır 20 civarı (Plus 100); preset/varyasyon 4–5. (4) Tasarıma dönmek kaybetmeden olur (Shopify kitaplık, WordPress tema başına kayıt). (5) Kopya, özgün temanın güncellemesini almaz.

**Aynen aldıklarımız:** menüler, kayıtlar ve görseller tasarımın dışında; tasarım düzen + bölüm ayarları + tema ayarlarının tamamı; yayınlamadan önizleme bağlantısı; ad verme, yeniden adlandırma, silme; kopya kaynak hazır görünümün sonraki sürümünü almaz ("yeni sürüm var" yalnız bilgi). **Bilerek ayrıldıklarımız:** (a) her kayıtlı tasarım ayrı düzenlenebilen bir "tema" değil, bir **anlık görüntüdür**; düzenleme hep tek taslakta olur (tek önizleme, tek kilit, tek "Yayınla"; seçenek (c)); (b) **otomatik yedek** sahibin kararı (Shopify'da yok); (c) sınır 10 (sahip); (d) başvurusu silinmiş bölüm sessizce boş çizilmez, uygulamadan önce adıyla söylenir (adr/0063 §4 kuralı).

## Karar

### 1. Kavramlar

| Kavram | Nerede | Değişir mi | Sayı |
| --- | --- | --- | --- |
| **Hazır görünüm** (Grafit, koyu-sert, …) | Sektör paketi (adr/0063 §2) | Hayır; yeni sürüm deploy ile gelir | Paket kadar |
| **Kayıtlı tasarım** | Mağazanın veritabanı, `storefront_design` (`kind: saved`) | Ad değişir; içerik yalnız "üzerine kaydet" ile | En çok 10 |
| **Otomatik yedek** ("Son tasarımım (otomatik)") | Aynı tablo, `kind: auto` | Her geçişte üzerine yazılır | 1, kotaya sayılmaz |
| Taslak / yayın / sürümler | `storefront_layout` (değişmez) | Bugünkü gibi | Sürüm 20 |

Sahibin senaryosu: "temayı seçince layout gelir" = hazır görünümü uygula; "değiştirip kendi halini kaydet" = **Farklı kaydet**; "başka temaya geçip geri dönünce kaybolmaz" = kayıtlı tasarımı uygula (ve otomatik yedek); "temanın kendisine dönünce varsayılanlar" = hazır görünümü yeniden uygula (adr/0063 §4: aynı görünüm aynı taslağı üretir).

### 2. Kayıtlı tasarımın içeriği

**İçinde (Shopify'daki JSON şablonlar + bölüm grupları + `settings_data.json` karşılığı):** düzen belgesinin tamamı: beş grup (bölümler, sırası, ayarları, biçimleri, takvimleri), `settings.theme` (renk, yazı, köşe, kart, üst bilgi, düğme) ve `settings.preset` (tasarım hangi hazır görünümden türedi; yalnız etiket).

**Dışında (mağaza düzeyi):**
- **Menüler.** Hüküm: kayıtta `settings.menus` her zaman `null` yazılır; tasarım uygulanınca mağazanın canlı menüleri değişmez. Tasarım menüye **konumla** bağlıdır (üst bilgi `main` ve `top`, alt bilgi `footer` sütunları); bu, Shopify'da üst bilgi bölümünün `link_list` ayarıyla menü seçmesinin bizdeki karşılığıdır (bugün konum başına tek menü olduğu için seçim konumdur). Gerekçe: Shopify'da menüler Content > Menus'te ve temadan bağımsızdır; mağaza menüsünü tek yerde düzenler; kayıtlı tasarım eski bir menü takımını geri getirmez (sürüm geri yüklemedeki "menüleri alma" sorusu burada hiç çıkmaz). Kaydetme anında taslakta bekleyen bir takım varsa (hazır görünüm uygulanmış, yayınlanmamış) kayda girmez ve panel bunu pencerede söyler.
- **Kayıtlar ve görseller:** ürün, kategori, koleksiyon, marka, sayfa ve medya tasarıma kimlik ya da adresle başvurur, kopyalanmaz (§5).
- **Mağazanın verisi sayılan üç ayar:** rozetler, renk örnekleri, "Az kaldı" eşiği kayıtta durur ama uygulamada taslaktakiler korunur (hazır görünümle aynı kural, adr/0063 §4; renk sözlüğü ve eşik ürünlerin verisidir).
- Mağaza bilgileri (belirteçler `{…}` yayında çözülür), bakım modu, SEO alanları, kategori başına düzen ataması (adr/0049 Ek §7, kategori kaydında; henüz kodda yok).
- **Özel CSS** (adr/0049 Ek §9, henüz kodda yok) geldiğinde bölümle birlikte kayda girer; uygulama düzen kaydının kuralından geçtiği için CSS'i değiştiren tasarımı yalnız `owner` uygular (`storefront_layout.css_forbidden`).

### 3. Veri modeli

`storefront-layout` modülüne yeni model `storefront_design` (ayrı modül değil: aynı belge, aynı şema, aynı okuma eşlemesi, aynı kilit; iki modülün aynı belgeyi tanıması gereksiz bağ olurdu):

| Alan | Tür | Not |
| --- | --- | --- |
| `id` | `sfd_…` | Önizleme jetonunun kimlik biçimi (§4) |
| `kind` | enum `saved` \| `auto` | |
| `name` | metin, 1–60, kırpılmış, kontrol karakteri yok | `auto`'da `null`; panel çevirir |
| `name_key` | metin | `name`'in `tr` küçük harfli biçimi; `kind = saved` ve `deleted_at IS NULL` iken benzersiz |
| `document` | json | Düzen belgesi, `settings.menus = null` |
| `summary` | json | Kayıtta hesaplanır: ana renk, vurgu rengi, başlık ve gövde yazı tipi, grup başına bölüm sayısı ve türleri, `preset`; liste ve küçük resim bunu okur |
| `created_by`, `updated_by` | metin, boş olabilir | Personel kimliği (`published_by` gibi) |
| `applied_at` | tarih, boş olabilir | Son uygulanma |

- Dizinler: `name_key` (yukarıdaki koşulla benzersiz); `kind` (`kind = 'auto' AND deleted_at IS NULL` iken benzersiz: tek otomatik yedek).
- **Sınır:** `DESIGN_LIMIT = 10` (`kind = saved`), düzen kilidi altında sayılır; 11. kayıt `storefront_design.limit_reached`. Benzersiz dizin son savunmadır (`storefront_design.name_taken`).
- **Şema sürümü yok; okuma eşlemesi var.** Kayıt, sürümlerle aynı yoldan okunur: `readStoredLayout` (`storedDocument`: ayarlar parça parça `storedSettings`, bölüm biçimi `storedSection`, tema `storedTheme` + `withCardDefaults`). Böylece eski kayıt yeni şemayla göç gerekmeden açılır. Bugünkü şemadan geçmeyen kayıt silinmez: liste `readable: false` işaretler, kart "Bu tasarım artık açılamıyor" der, Önizle ve Uygula kapalı, Sil açık.
- **Medya:** `usage.ts` `documents()` `storefront_design.document`'ı da tarar; kayıtlı tasarımın (otomatik yedek dahil) görseli kütüphaneden silinmek istenince 409 `media.in_use` ve kullanım yeri "Kayıtlı tasarım: <ad>" olur (yeni `MediaUseKind` `storefront_design`). Sürümler bugünkü gibi taranmaz (ayrı iş, §Sonuçlar).

### 4. Akışlar

İş mantığı `workflows/storefront/designs.ts` ve adımlarında; uçlar ince. Belge **hiçbir uçta istemciden alınmaz**: sunucu taslağı kendisi okur.

| Uç | Gövde | Ne yapar |
| --- | --- | --- |
| `GET /admin/storefront-designs` | — | Kayıtlı tasarımlar + otomatik yedek: `id`, `kind`, `name`, `summary`, `created_*`, `updated_*`, `applied_at`, `readable`; **belge yok** (`revisionSummaries` deseni) |
| `POST /admin/storefront-designs` | `{ name, from?: "draft" \| "published" }` | **Farklı kaydet**: taslağı (ya da yayındakini) okur, `menus`'ü boşaltır, sınırı ve adı denetler, yazar |
| `POST /admin/storefront-designs/:id` | `{ name?, replace?: true }` | Yeniden adlandır; `replace` ile **üzerine kaydet** (taslak kaydın yerine; panel onay ister) |
| `DELETE /admin/storefront-designs/:id` | — | Yumuşak silme (otomatik yedek de silinebilir) |
| `POST /admin/storefront-designs/:id/preview` | — | İmzalı önizleme bağlantısı (aşağıda) |
| `POST /admin/storefront-designs/:id/apply` | `{ save_current_as?: string }` | `applyDesignWorkflow` |

**`applyDesignWorkflow`** (düzen kilidini akış alır, hazır görünüm akışındaki gibi; alt workflow içindeki kilit atlandığı için):
1. Kilit `LAYOUT_LOCK`; taslağı oku.
2. `save_current_as` varsa taslağı yeni kayıtlı tasarım olarak yaz (sınır ve ad denetimi; telafisi: kaydı siler).
3. **Otomatik yedek:** taslağı `kind: auto` satırına yaz (yoksa oluştur). Telafisi: önceki yedeği geri yazar.
4. Tasarımı `readStoredLayout` ile oku; rozet, renk, "Az kaldı" taslaktan; `menus = null`.
5. **Budama** (§5): bulunamayan kayıt ve görsel başvuruları çıkarılır; `skipped` ve `dropped` döner.
6. `saveDraftSteps` (`checkLayout`, `checkThemeStep`, yazma, görsellerin "bağlı" işareti). Geçmezse hiçbir şey yazılmaz.
7. `applied_at`; kilit bırakılır. **Yayın yok**: sahip önizler, "Yayınla" bugünkü `publishLayoutWorkflow`'dur.

- **Hazır görünüm uygulaması da önce otomatik yedek alır:** 3. adım `applyPresetWorkflow`'a da eklenir (düzen kilidinin içinde, taslak yazılmadan önce); `save_current_as` aynı biçimde onun ucuna da gelir. Böylece "geçiş" ister hazır ister kayıtlı tasarıma olsun aynı davranır.
- **Otomatik yedeği uygulamak** taslakla yedeği **takas eder** (3. adım önce şimdiki taslağı yedeğe yazar): bir kez daha uygulamak geri getirir. Panel kartta "Geri dönmek için yeniden uygulayabilirsin" der.
- **Geçişte soru** (sahip kararı 2): Uygula'ya basınca pencere: "Şimdiki tasarımı kaydetmek ister misin?" + ad alanı; düğmeler "Kaydet ve uygula", "Kaydetmeden uygula", "Vazgeç"; altında "Kaydetmesen de şimdiki tasarımın 'Son tasarımım (otomatik)' olarak saklanır." Kota doluysa ad alanının yerine "bir tasarımın üzerine kaydet" seçimi gelir. Taslak yayındakinden farklıysa (bugünkü "değişiklik var" karşılaştırması) pencerede "yayınlanmamış değişiklikler" de yazar.
- **Önizleme (taslağa dokunmadan):** `designPreview = previewSigner("design-preview:v1", "sfd_[0-9A-Za-z]{1,40}")`; imza tasarımın kimliğine ve `updated_at`'ine bağlı (üzerine kaydedince eski bağlantı kapanır). `GET /store/storefront-layout/preview/:token` önekine bakar: `sfl_` taslağı, `sfd_` tasarımı okur; tasarım taslaktaki rozet/renk/eşikle ve budanmış olarak gösterilir, menüler canlı menülerdir. Yanıt başlıkları bugünkü gibi (`private, no-store`, `Referrer-Policy: no-referrer`, `noindex`). Vitrinde yalnız üç düzenli ifade `sf[ld]_` olur.
- **Hazır görünüm önizlemesi** bugün paketin `preview.webp`'sidir (adr/0063 §7); canlı önizlemesi açık karar K6.

### 5. Uygulama anındaki denetimler: sessiz bozulma yok

- **Kayıtlar.** Tasarımdaki her kimlik `existingRecords` (`workflows/storefront/menu-links.ts`) ile tek seferde aranır; kural adr/0063 §4'ün aynısıdır: seçim listesinde (kategori karoları, markalar, elle ürün rafı) bulunamayan öğe çıkar; liste boşalırsa ya da bölümün tek kaydı yoksa (öne çıkan ürün, kategori/koleksiyon rafı) bölüm taslağa girmez; kaydı olmayan düğme bağlantısı kaldırılır. Yerine başka kayıt konmaz, kaynak sessizce "en yeniler"e çevrilmez. Budama `lib/storefront/designs/prune.ts`'de saf işlev olarak yazılır (`recordsOf` / `linksOf` ile aynı yürüyüş; birim testiyle).
- **Görseller.** Kayıtlı tasarımın görseli silinemediği için (§3) bu yalnız kütüphane dışından kaybolmuş dosyada olur: alan boş olabiliyorsa boşaltılır, değilse bölüm düşer.
- **Zengin metin:** kartı bulunamayan ya da bugün tanınmayan belirteç taşıyan bölüm düşer (`assertCards`, `unknownDocTokens` reddetmesin diye).
- **Gösterim:** önizleme yanıtı ve uygulama sonucu `skipped: [{ where, ref }]` ve `dropped` verir; panel önizlemenin yanında ve uygulamadan sonra "2 bölüm eklenmedi: 'Yaz indirimi' koleksiyonu silinmiş" der. Budamadan sonra `checkLayout` bütün belgeyi yine denetler; geçmezse uygulama `storefront_design.unreadable` ile durur, taslak ve yedek eski hâlindedir.

### 6. Eşzamanlılık, yetki, denetim, sınırlar

- **Kilit:** her tasarım yazması (kaydet, üzerine kaydet, uygula) `LAYOUT_LOCK` altında taslağı okur; sınır ve ad kilitte sayılır. Yeniden adlandırma ve silme yalnız tasarım satırına yazar, yine aynı kilitle (sayım tutarlı kalsın). Yayın bugünkü gibi düzen + menü kilidini alır; uygulama ile yayın sırayla işler.
- **Yetki:** yazma ve uygulama `owner` ve `admin` (düzen yazma kuralı, adr/0049 §5). `lib/staff/permissions.ts`'de `admin` her yazmaya izinli; uçlar `OPERATIONS_WRITES` ve `READONLY_WRITES`'a eklenmez, `operations` ve `readonly` reddedilir; liste ucu düzen okuması gibi herkese açık. Rol tablosunun "her yazma ucu için karar" birim testine yeni uçlar eklenir.
- **Denetim kaydı:** `api/http/audit/resources/storefront-layout.ts`'e dört kaynak (`POST /admin/storefront-designs`, `POST …/:id`, `DELETE …/:id`, `POST …/:id/apply`); `resourceType: "storefront_design"`, kimlik tasarımın `id`'si; uygulamanın özeti bugünkü `draftSnapshot` (taslağın teması) + tasarımın adı ve atlanan sayısı.
- **Sınırlar:** ad 1–60 karakter; 10 + 1 kayıt; belge boyu istemciden gelmediği için ayrıca sınır yok (şema sınırları `LAYOUT_LIMITS`, `SETTINGS_LIMITS` belgeyi zaten sınırlar). Hız sınırı mevcut tabandan (`api/http/rate-limit`, `perIdentityAnyIp`, `PRESET_APPLY` deseni): `storefront_design_write` saatte 60, `storefront_design_apply` saatte 20; ikisinde de `requireUserActor`. Taslağı önce otomatik kaydeden "Vazgeç" (`discard`) ve sürüm geri yükleme (`restore`) da `requireUserActor` + `storefront_draft_replace` (kişi başı saatte 60).

### 7. KVKK, performans, SEO

- **KVKK:** belge kişisel veri taşımaz (bölüm ayarları, mağaza metinleri, bağlantılar, görsel adresleri; mağazanın elle yazdığı metin mağaza içeriğidir). `created_by` / `updated_by` personel kimliğidir; aynı tür alan `storefront_layout.published_by` ve `storefront_layout_revision.published_by` envanterde bugün yok (`docs/kvkk-envanter.md`'de "storefront" ve "published_by" geçmiyor). Envantere üçünü kapsayan tek satır eklenir: personel kimliği, amaç "kim kaydetti / yayınladı", saklama kayıt süresince, personel silinince kimlik kalır (denetim kaydıyla aynı gerekçe) — sahip ve Deniz onayıyla.
- **Performans:** liste ucu `document` seçmez (en çok 11 satır, `summary` küçük); uygulama bir taslak okuması, bir toplu kayıt araması, `checkLayout` ve iki yazmadır. Medya kullanım sorgusu 11 satırlık bir tabloya ek `position(... in document::text)` taraması ekler.
- **SEO:** kaydetme, önizleme ve uygulama vitrine dokunmaz (yalnız taslak); yayın bugünkü yoldur (`LAYOUT_PUBLISHED` olayı, `refreshStorefrontStep` ile vitrin yenileme). Düzen adres taşımadığı için slug ve 301 etkisi yok; önizleme `noindex`. SEO advisor etkisi yok.

### 8. Panel

- **"Görünümler" sayfası** `/storefront/looks` (Vitrin menüsünde, Tema düzenleyicinin yanında). Bu sayfa adr/0063 iş 2.6'nın galerisini kapsar; 0063 §7'deki "tema düzenleyicide Görünümler" yerine ayrı sayfa olur (sahip kararı 4), düzenleyicinin üst çubuğunda sayfaya bağlantı kalır.
  - **Üstte "Kayıtlı tasarımlarım (3/10)":** otomatik yedek kartı ilk sırada, "Otomatik · sayıya girmez" rozetiyle. Kart: küçük resim (K1), ad, "Kaydedildi 14 Kas 15:20 · Deniz", türediği hazır görünüm ("Grafit'ten"), durum etiketi (K3); eylemler **Önizle**, **Uygula**, menüde "Adını değiştir", "Şimdiki tasarımı bunun üzerine kaydet", "Sil".
  - **Altta "Hazır görünümler":** adr/0063 §7 kartı (küçük resim, ad, açıklama, ton, "yeni sürüm var"; boş katalogda "demo içerikle" kutusu); **Önizle** (K6), **Uygula**.
  - **Boş durum:** "Henüz kayıtlı tasarımın yok. Tema düzenleyicide 'Farklı kaydet' ile şimdiki tasarımını saklayabilirsin."
  - Uygulamadan sonra düzenleyici canlı önizlemeyle açılır; atlananlar uyarısı ve "Yayınla" oradadır.
- **Tema düzenleyici:** üst çubukta "Yayınla"nın yanında **"Farklı kaydet"** (ad penceresi; kota doluysa "üzerine kaydet" listesi). Önce bekleyen kendiliğinden kayıt biter (`save-status`).
- **i18n:** `storefront.looks.*` anahtarları `tr.json` ve `en.json`'da kendi bölümünde; hata kodları (`storefront_design.limit_reached`, `name_taken`, `unreadable`) backend `lib/errors/messages`'da.
- **Dil:** gündelik etiket ("Farklı kaydet", "Son tasarımım (otomatik)"); teknik terim yalnız küçük açıklamada.

### 9. Üst panel

Etki yok. Kurulum sihirbazı yalnız hazır görünüm seçer (adr/0063 §7). Kayıtlı tasarımı başka mağazaya taşımak bir üst panel ya da dosya işi olurdu (K4).

## Değerlendirilen seçenekler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **(a) Adlandırılmış anlık görüntüler + otomatik yedek; düzenleme tek taslakta (seçilen)** | Sahibin senaryosunu karşılar; taslak, önizleme, yayın, kilit, sürüm değişmez; bir tablo, bir modül; menü ve kayıtlar Shopify'daki gibi dışarıda | Kayıtlı tasarım yerinde düzenlenmez (uygula → düzenle → üzerine kaydet); Shopify kullanıcısına bir adım fazla |
| (b) Yalnız sürüm geçmişini genişletmek (ad verme, sabitleme, yayınlanmamış taslağın da sürümü) | Yeni tablo yok | Sürüm kavramı "yayın" anlamını kaybeder; 20 sınırı ve silme kuralı karışır; geçişte otomatik yedek yine ayrı iş; "hazır görünüm / kendi tasarımım" ayrımı galeride görünmez |
| (c) Shopify gibi her tasarım tam ayrı "tema" (kendi taslağı, yayını, sürümleri) | Shopify'ın birebir modeli; yayında olmayanı düzenleyebilme | `storefront_layout` tek satır varsayımı her yerde (önizleme, `layoutRow`, yayın, medya kullanımı, denetim); N taslak × N önizleme × sürümler; menü takımı ve kilit kuralları çoğalır; kapsam L+ ve getirisi sahibin istediğinin ötesinde |
| (d) Dışa/içe aktarma dosyası (JSON indir, yükle) | Mağazalar arası taşıma; yedek dışarıda | Kimlikler başka mağazada anlamsız (adr/0063 tutamaç çözümü gerekir); dosyadan gelen belge güvenilmez girdi (boyut, şema, görsel adresleri); sahibin istediği "panelde dön" deneyimi değil. Sonraya (K4) |

## Sonuçlar

- **Olumlu:** sahip tasarımlarını kaybetmeden görünümler arasında gezer; her geçişte bir yedek kendiliğinden alınır; kayıtlı tasarım taslağa dokunmadan önizlenir; silinmiş başvurular uygulamadan önce adıyla söylenir.
- **Olumsuz:** kayıtlı tasarım bir anlık görüntüdür, yayındaki dışında düzenlenen ikinci bir tasarım yoktur; hazır görünümün yeni sürümü kayıtlı kopyaya gelmez (Shopify ve BigCommerce'teki gibi).
- **Riskler:** (1) kayıtlı tasarımlar görselleri kullanımda tuttuğu için kütüphane temizliği zorlaşır; kullanım yeri adıyla gösterilir. (2) Şema daralırsa eski kayıt okunmayabilir; okuma eşlemesi bunu sürümlerle aynı ölçüde karşılar, karşılamazsa kart "açılamıyor" der, veri silinmez. (3) Otomatik yedek takası iki kez basılırsa karışabilir; panel kartta son uygulanma zamanını gösterir.
- **Değişen sözleşmeler:** adr/0063 §8 karar 8 kalkar; adr/0063 §7 galerinin yeri ayrı sayfa olur; `applyPresetWorkflow`'a otomatik yedek adımı; store önizleme ucu `sfd_` jetonu tanır; `MediaUseKind`'e `storefront_design`; `@qticaret/types`'a tasarım özeti tipi.
- **Ayrı küçük iş önerisi (bu ADR'ın kapsamı dışında):** aynı budama sürüm geri yüklemeye uygulanabilir (bugün silinmiş tek kayıtta bütün geri yükleme reddediliyor) ve medya kullanımına sürümler eklenebilir.
- **Migration:** `storefront-layout` modülünde tek, yalnız ekleme yapan migration (`storefront_design` tablosu ve iki dizin). Mevcut satırlara dokunmaz, göç betiği yok.
- **Geri alma:** panel sayfası ve uçlar kaldırılır, migration'ın `down`'u tabloyu düşürür; taslak, yayın ve sürümler etkilenmez. `applyPresetWorkflow`'daki yedek adımı bağımsız çıkarılabilir.
- **Güvenlik:** belge istemciden alınmaz; ad mağaza metni kuralıyla doğrulanır; önizleme jetonu ayrı bağlamda imzalanır, `updated_at`'e bağlıdır; uçlar rol, hız sınırı ve denetim kaydı altında. `security-reviewer` incelemesi (önizleme jetonu ve yetki).

## Sahip kararları (2026-11-15)

Aşağıdaki "açık kararlar" bölümündeki şıklar şöyle kapandı; gövdede bunlarla çelişen bir cümle varsa bu bölüm geçerlidir.

| # | Karar | Seçilen | Kim |
| --- | --- | --- | --- |
| K1 | Kartın küçük resmi | (a) panel çizer: renk şeridi, yazı tipi örneği, bölüm şeması | sahip |
| K2 | Silme | **(a) onay sorulur, kalıcı silinir** (Shopify'daki gibi; önerilen (b) "Geri al" bildirimi seçilmedi) | sahip |
| K3 | "Yayında / Taslakta" etiketi | (b) belgeye `settings.design`; üzerinde değişiklik yapıldıysa "değiştirildi" notu | sahip |
| K7 | Geçişteki "kaydetmek ister misin?" sorusu | (b) "Bir daha sorma" kutusu; Görünümler sayfasındaki anahtarla yeniden açılır; otomatik yedek her durumda alınır | sahip |
| K4 | Başka mağazaya aktarma | (a) şimdi değil | Oğuzhan (önerilen şık) |
| K5 | Otomatik yedek kapatılabilsin mi | (a) her zaman açık | Oğuzhan (önerilen şık) |
| K6 | Hazır görünümün "Önizle"si | (a) şimdilik büyük görsel | Oğuzhan (önerilen şık) |
| K8 | 10 sınırının yeri | (a) kod sabiti | Oğuzhan (önerilen şık) |

Daha önce verilenler: içerik Shopify'daki gibi (düzenler ve tema ayarları; menü taşımaz), geçişte sor + tek otomatik yedek, sınır 10, ayrı "Görünümler" sayfası + düzenleyicide "Farklı kaydet".

## Sahibin onayına bırakılan açık kararlar

- **K1. Kartın küçük resmi nasıl üretilir?**
  - (a) **Önerilen:** panel `summary`'den çizer: renk şeridi, yazı tipi örneği ("Aa"), bölüm sırasının küçük şeması. Görsel üretimi yok, anında, her mağazada çalışır.
  - (b) Sunucuda ekran görüntüsü (başsız tarayıcı önizleme bağlantısını çeker). Gerçek görünüm; ama F16 imajına Chromium, kuyruk ve depolama gerekir.
  - (c) Türediği hazır görünümün `preview.webp`'si + (a)'nın renk şeridi. Ucuz; ama değiştirilmiş tasarımı yanlış gösterebilir.
  - (d) Yalnız ad ve tarih.
- **K2. Silinen kayıtlı tasarım geri alınabilir mi?**
  - (a) Onay penceresi, geri alma yok (Shopify'daki gibi kalıcı).
  - (b) **Önerilen:** onaysız sil + 10 saniyelik "Geri al" bildirimi (yumuşak silme zaten var).
  - (c) Çöp kutusu: 30 gün saklanır, kotaya sayılmaz, sonra kalıcı silinir.
- **K3. Yayındaki / taslaktaki tasarım hangi kayıttan geldi etiketi?**
  - (a) Yok.
  - (b) **Önerilen:** belgeye `settings.design: { id } | null` (uygulamada yazılır; yayın ve sürümle gider); kart "Yayında", "Taslakta" ya da "Taslakta, değiştirildi" der. Şemaya bir alan ekler.
  - (c) Yalnız `applied_at`'ten "son uygulanan" etiketi (şema değişmez; yayında mı bilinmez).
- **K4. Kayıtlı tasarımı başka mağazaya aktarma.**
  - (a) **Önerilen:** şimdi değil.
  - (b) Sonra dosyayla dışa/içe aktarma (kimlikler tutamaca çevrilir, adr/0063 çözücüsü).
  - (c) Sonra üst panelden mağazalar arası kopya (control plane işi, adr/0061'e ek).
- **K5. Otomatik yedek kapatılabilsin mi?**
  - (a) **Önerilen:** her zaman açık (değeri yüksek, maliyeti tek satır; ayar kalabalığı yapmaz).
  - (b) Ayar olarak sun: Görünümler sayfasında "Geçişte otomatik yedek al" anahtarı, varsayılan açık.
- **K6. Hazır görünümün "Önizle"si.**
  - (a) **Önerilen (şimdi):** büyük görsel ve açıklama (paketin `preview.webp`'si); canlı önizleme taslakta, uygulamadan sonra.
  - (b) Sonra canlı önizleme: görünüm çözülür, görseller kütüphaneye yüklenmeden paketten sunulur (ayrı güvenlik incelemesi ister).
- **K7. Geçişteki "kaydetmek ister misin?" sorusu.**
  - (a) Her geçişte sor.
  - (b) **Önerilen (ayar olarak sun):** pencerede "Bir daha sorma" kutusu; Görünümler sayfasında "Geçişte sor" anahtarıyla geri açılır. Otomatik yedek her durumda alınır.
- **K8. Sınır 10'un yeri.**
  - (a) **Önerilen:** kod sabiti (sahip kararı 3).
  - (b) Üst panelden mağaza başına değiştirilebilir (plan ayrımı için; control plane işi).

## Uygulama sırası

| # | İş | Boyut | Bağımlılık | Kim bakar | Testler |
| --- | --- | --- | --- | --- | --- |
| G1 | `storefront_design` modeli, migration, servis özet sorgusu, okuma eşlemesi, `summary` hesabı, `usage.ts` (`storefront_design`) | M | — | Deniz (migration, medya) | modül (benzersiz dizinler, yumuşak silme), birim (`summary`, okunamayan kayıt) |
| G2 | Kaydet, yeniden adlandır, üzerine kaydet, sil akışları; otomatik yedek adımı; `applyPresetWorkflow`'a yedek ve `save_current_as`; uçlar, rol kararı, hız sınırı, denetim kaynakları | M | G1 | Deniz | HTTP (sınır 10 + yedek kotada değil, ad çakışması `tr` küçük harfle, `menus` boşaltılır, `operations` reddi, denetim kaydı, eşzamanlı iki kayıtta 11. reddedilir) |
| G3 | `applyDesignWorkflow` + budama (`lib/storefront/designs/prune.ts`), telafiler | M | G2; PR #13 birleşmiş olmalı (`layout-check.ts`) | Deniz | birim (budama kuralları, tek kayıtlı bölüm düşer, liste boşalır), HTTP (silinmiş ürün/kategori/görsel ile uygula, `skipped`; yedek takası; yarıda kalan uygulamada taslak ve yedek eski hâli; rozetler korunur) |
| G4 | Önizleme jetonu `design-preview:v1`, store önizleme ucunun önek ayrımı, vitrinde üç düzenli ifade | S | G3 | Deniz (backend), Oğuzhan (vitrin) | HTTP (jeton, üzerine kayıttan sonra eski jeton 404, budanmış belge), vitrin birim (`sfd_` biçimi) |
| G5 | Panel "Görünümler" sayfası: kayıtlı tasarımlar + hazır görünümler (adr/0063 iş 2.6 burada), kartlar, geçiş penceresi, önizleme, boş durumlar, i18n | L | G2–G4 (hazır görünüm kısmı G2'den sonra başlayabilir) | Oğuzhan (açan birleştirir) | panel (kart, pencere: kaydet ve uygula / kaydetmeden / kota dolu, okunamayan kart, atlananlar uyarısı), e2e (kaydet → başka görünüm → geri dön → yayınla) |
| G6 | Düzenleyicide "Farklı kaydet" ve kota penceresi | S | G2 | Oğuzhan | panel |
| G7 | Belgeler: `docs/06-admin-ux.md` (Görünümler sayfası), `docs/kvkk-envanter.md` satırı, adr/0063'e "karar 8 ve iş 2.6 adr/0064'e taşındı" notu | S | G5 | ikisi | — |

Toplam: üç M, bir L, üç S. adr/0063 iş 2.6 (M) G5'in içinde kalır; ayrıca yapılmaz. Ödeme, auth ve migration kuralı gereği G1–G3 PR'ına Deniz bakar. **Çakışma notu:** Deniz'in açık PR'ı #13 (`deniz/katalog-anasayfa`) `workflows/storefront/layout-check.ts`'e (+23), `lib/storefront/layout-sections.ts`'e, `packages/types/src/store/layout.ts`'e, panel çeviri dosyalarına ve `cutlery` paketine üçüncü hazır görünüm (`katalog`) ekliyor. Bu ADR'ın işleri `layout-check.ts`'teki yürüyüşü kullanır (G3) ve çeviri dosyalarına kendi bölümünü ekler; G3 PR #13 birleştikten sonra başlar. Belge şemasına alan eklenmesi yalnız K3 (b) seçilirse olur.

## Ek 2026-11-17: Görünüm galerisi, otomatik kayıtlar ve uygulamadaki sapmalar

Sahibin 2026-11-17 isteği (Görünümler sayfası, kayıtlı görünümlerin listesi, hazır görünüm galerisi) ve o geceki varsayılan kararlar (sahip uyurken, "bu gece kodla" sözüyle) bu ADR'ın gövdesini aşağıdaki maddelerle değiştirir; çelişen gövde cümlesinde bu ek geçerlidir. Durum "Öneri" kalır.

1. **Otomatik kayıt tek yedek değil, son 5 kayıtlık döner liste.** Adlı kayıt sınırına (10) sayılmaz; altıncısı yazılınca en eski otomatik kayıt kalıcı silinir (en eski `created_at`, eşitlikte `id`); adlı kayıt asla kendiliğinden silinmez. Ad panelde kurulur: "{kaynak}, {tarih saat}, düzenlenmiş" (kaynak: hazır görünümün adı, kayıtlı görünümün adı ya da "Kendi tasarımınız"; `summary.source_name`'e kayıt anında yazılır). Gereksiz kayıt yazılmaz: düzen satırı yoksa; taslak, uygulandığı hazır görünümden hiç değişmemişse (`settings.design.id = null` ve özet eşit); aynı özetli silinmemiş bir kayıt zaten varsa; **"Vazgeç"te taslak yayındakiyle aynıysa** (yayın zaten sürüm geçmişinde; bu son kural uygulamada eklendi, 5'lik listenin gereksiz kayıtla dönmesini önler).
2. **`settings.design: { id: "sfd_…" | null, digest: hex64 } | null`** (K3 (b)'nin genişletilmesi). Hazır görünüm uygulaması `id: null`, kayıtlı görünüm uygulaması kaydın kimliğini yazar; yayınla canlı kopyaya geçer; vitrine gitmez. Özet (`lib/storefront/designs/digest.ts`), belgenin düzenleyicinin açtığı hâlinin (eksik ortak ayarlar eski alanlardan doldurulmuş) anahtarları sıralı JSON'unun sha256'sıdır; `design`, `preset`, `menus` ile mağazanın kendi verisi (`trust_badges`, `color_swatches`, `low_stock`) karşılaştırmaya girmez. "Düzenlenmiş", işaretteki özetle bugünkü özet farklıysa doğrudur; işaret yoksa yanlıştır.
3. **Otomatik kaydı adlandırmak onu adlı kayda çevirir** (`kind: saved`; 10'luk sınıra girer, dolu ise `limit_reached`).
4. **Taslağı bütünüyle değiştiren her işlem önce taslağı kaydeder:** hazır görünüm uygulama, kayıtlı görünüm uygulama, yayın geçmişinden geri yükleme ve düzenleyicideki "Vazgeç". Tek adım (`autoSaveDraftStep`), düzen kilidi altında; uygulama atarsa kayıt telafiyle geri alınır, kayıt atarsa uygulama olmaz. Hazır ve kayıtlı görünüm uygulamasında `save_as` verilirse otomatik kayıt yerine o adla adlı kayıt yazılır.
5. **Kayıtlı görünümün "Önizle"si = taslağa alma.** İmzalı `sfd_` önizleme jetonu (G4) ertelendi: vitrine dokunur ve ayrı güvenlik incelemesi ister. Akış: otomatik kayıt, taslağa alma, düzenleyicinin canlı önizlemesi.
6. **Budama (G3'teki `prune.ts`) ertelendi.** Silinmiş bir kayda başvuran kayıtlı görünüm bütünüyle reddedilir (`storefront_layout.target_unknown`); taslak ve kayıtlar eski hâlinde kalır (telafi). Yanıtta `skipped` / `dropped` bugün hep boştur; budama gelince dolar.
7. **Hazır görünüm çeşitleri:** manifestte isteğe bağlı `family` (aile kodu, `PRESET_CODE`) ve `swatch` (en çok 40 karakter renk adı). Tezgâh'ın üç `preset.json`'u `family: "tezgah"` ve renk adlarını taşır; görünüşü değiştirmediği için görünüm sürümü artmadı. Galeride bir aile tek kart ve renk seçimidir.
8. **Yayın geçmişi:** düzenleyicideki çekmecenin adı "Yayın geçmişi" olur ve her satırda "Kayıtlı görünümlere ekle" bulunur (`POST /admin/storefront-designs { name, revision }`). Son 20 yayın kuralı değişmez.
9. **Galeri adresi `/storefront/looks`, i18n adı `storefront.gallery.*`:** mevcut `storefront.editor.tree.looks` ("Stok ve renk örnekleri") ve `shared/looks-panel` ile karışmasın.
10. **KVKK:** §7'deki tek envanter satırı (`created_by`, `published_by`) değişmeden geçerli; belge PR'ında (galerinin belge işi) eklenir.

**Küçük resimler.** Hazır görünümlerin `preview.webp` dosyaları bu aşamada üretilmez ve depoya girmez (demo fotoğraflarının lisansı sahip onayını bekliyor); galeri panelin `summary`'den çizdiği şemayla çalışır. Sunum ucu hazırdır: `GET /admin/storefront-presets/:pack/:code/preview` yalnız galerinin listelediği görünümler (`general` ve bu mağazaya uygulanmış paketler) için, yükleyicinin bulduğu klasör ve sabit dosya adıyla, en çok 256 KB, `image/webp` + `nosniff` + `default-src 'none'` + `private, max-age=300` ile sunar; istemciden yol parçası alınmaz.

*Güncelleme (aynı gün, sahip onayıyla):* küçük resimler üretildi ve depoya girdi: beş hazır görünümün `preview.webp`'si (800×500), `NODE_ENV=development pnpm preset:previews -- --yes` ile (`apps/storefront/e2e/preset-preview/`). Betik geliştiricinin taslağını önce kayıtlı görünüm olarak saklar, sonunda birebir geri koyar ve karşılaştırır. Görünen fotoğrafların kaynağı ve atfı docs/12 "Görsel kaynakları ve atıf"tadır. Görünüş değişmediği için görünüm sürümleri artmadı.

**Uygulamada plandan sapmalar.**

- Migration `Migration20261116220159` (UTC zaman damgası); kısmi benzersiz dizin `name_key WHERE kind = 'saved' AND deleted_at IS NULL`; `down()` yalnız tabloyu düşürür.
- Kaydedilen belge düzenleyicinin açtığı hâliyle (eksik ortak ayarlar doldurulmuş), `menus: null` ve `design: null` ile saklanır; bugünkü şemanın okuyamadığı bir taslak ham saklanır (kayıp olmaz), uygulanınca `storefront_design.unreadable` verir.
- Hata türleri: `name_taken` ve `limit_reached` 409; `too_large`, `unreadable` ve `name_invalid` 400; `unknown` 404.
- Hazır görünüm kartındaki `in_draft` / `live`, o tarafa sonradan bir kayıtlı görünüm uygulanmışsa boş (null) döner.
- Silme kalıcıdır (K2 (a)); telafide satır aynı kimlikle geri yazılır.

**Uygulama sırası güncellemesi.** G1 ve G2 ile G3'ün budama dışı kısmı tek PR'da yapıldı (backend). G3 budaması ve G4 ayrı iş olarak kalır. G5 ve G6 panel PR'ıdır; G7 belgeleri ayrı PR'dadır.
