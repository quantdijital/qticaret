# ADR-0063: Hazır görünümler (preset)

- **Durum:** Kabul edildi (2026-11-14, sahip)
- **Tarih:** 2026-11-14
- **İlgili:** adr/0062 (Atölye bütün tema ayarlarını uygular; önkoşul), adr/0049 (tema düzenleyici, menüler; Ek 2026-11-02 ve Ek 2026-11-06 `settings`), adr/0053 §B.7 (tema ayarında taslak yok; değişir), adr/0057 (tema derleme anında seçilir; değişmez), adr/0061 Ek C12 (sektör paketleri, defter, kurulum adımı), adr/0016 (medya), adr/0011 (denetim kaydı), adr/0040 (roller), `docs/tema/atolye-tamamlama-plani.md` (Faz 2 ve Faz 6; sahip kararları 2, 6, 7), `docs/tema/atolye-eksik-denetimi-2026-11-14.md` §3

## Bağlam

- Sahip (2026-11-14): yeni tema yazılmaz; Atölye tamamlanır, sonra aynı temadan sektöre uygun hazır görünümler çıkarılır. İlk sektör outdoor ve bıçak, iki hava: koyu-sert ve açık-temiz. Grafit ilk hazır görünümdür.
- Kodda preset kavramı yok; parçaları var:
  - **Düzen belgesi** (`apps/backend/src/lib/storefront/layout.ts`): `header`, `home`, `footer`, `product`, `category`, `settings`; taslak, yayın, son 20 sürüm; `saveLayoutDraftWorkflow`, `publishLayoutWorkflow`, `draftSource` (`workflows/storefront/layout.ts`); imzalı önizleme (`layoutPreview`, taslağın `updated_at`'ine bağlı).
  - **Sektör paketi** (`packages/sector-packs`, adr/0061 C12): yalnız veri; `PACK_FILES` beş dosya adı tanır, başkasını reddeder; `applySectorPack` her öğeyi bir kez sunar ve `sector_pack_item` defterine yazar.
  - **Mağaza profili** (`apps/backend/src/scripts/shop-profile/profile.ts`): ayar bölümleri, sayfalar, `href` ile menüler; `linkFromHref` (`workflows/storefront/menu-hrefs.ts`) adresi kayıt bağlantısına çevirir. Düzen yazmaz, panelden çalışmaz.
  - **Demo işareti:** `DEMO_METADATA = { demo: true }` (`scripts/seed/data.ts`) ve `scripts/demo-removal/`.
- Engeller (kodda doğrulandı):
  1. **Taşınamaz başvurular.** Bölümler kayıtlara kimlikle bağlı (`category_ids`, `product_id`, `collection_id`, `brand_ids`), görseller mağazanın medya kütüphanesinden olmalı; `checkLayout` (`workflows/storefront/layout-check.ts`) olmayan kaydı `storefront_layout.target_unknown` ile reddeder.
  2. **Tema ayarı ve menü önizlenemiyor.** İkisi de kayıtla yayında (`theme` ayar bölümü, adr/0053 §B.7; `saveStorefrontMenuWorkflow`). Önizleme yalnız düzen taslağını gösterir.
  3. **Bölümlerde biçim alanı yok.** Hiçbir bölüm türü `variant` taşımıyor (`layout-sections.ts`); iki görünüm aynı bölümü farklı çizdiremez.
- Kısıtlar: tema kodu sektöre özel olamaz; panelden HTML, CSS, JavaScript girmez (adr/0049 §2); model instance-per-tenant.

## Karar

### 1. Görünüm nedir

Hazır görünüm, bir sektör paketinin içinde duran, şemayla doğrulanan **veri demetidir**: tema ayarları + sayfa düzenleri (ana sayfa, ürün, kategori, üst ve alt bilgi) + menüler + isteğe bağlı demo içerik ve görseller. HTML, CSS, betik ve sektöre özel kod taşımaz; yalnız temanın zaten çizdiği bölüm türlerini, biçimlerini ve adr/0062'nin ayar listelerini kullanır. Tema seçimi derleme anında kalır (adr/0057): görünüm hangi tema için yazıldığını söyler (`theme: "atolye"`), kurulu olmayan temanın görünümü listelenmez.

### 2. Dosyalar ve şema

`packages/sector-packs/packs/<paket>/presets/<kod>/`:

| Dosya | İçerik | Kim doğrular |
| --- | --- | --- |
| `preset.json` | `format: "quant-storefront-preset"`, `code` (klasör adı), `version` (tam sayı), `theme`, Türkçe `name` ve `description`, `tone` (`light` \| `dark`, yalnız galeri etiketi) | paket (çerçeve) |
| `theme.json` | `theme` bölümünün alanları | backend `themeSection.full` (karşıtlık dahil) |
| `layout.json` | düzen belgesi; kimlik yerine başvuru (aşağıda) | çözümden sonra backend `layoutDocument` + `checkLayout` |
| `menus.json` | mağaza profilindeki `menus` biçimi (`title`, `location`, `label` + `href`) | backend menü şeması |
| `demo.json` (isteğe bağlı) | demo ürünler, koleksiyonlar, markalar, sayfalar; kategoriye tutamaçla bağlı | backend'in kendi oluşturma şemaları |
| `images/*` | `.webp`, `.jpg`, `.png`; adet ve boy sınırlı | yükleme hattı (medya) |
| `preview.webp` | galeri kartının küçük resmi | paket |

- **Başvurular.** `layout.json` düzen belgesinin kendisidir; yalnız kimlik, görsel ve bağlantı yerinde üç işaretli nesne durur: `{ "$handle": "category:cakilar" }` (tür: `category`, `product`, `collection`, `brand`, `page`), `{ "$image": "images/hero.webp", "alt": "…" }`, `{ "$href": "/cakilar", "label": "…" }`. Tek bir gezici bunları çözer, sonuç bugünkü `layoutDocument` ile doğrulanır. Bölüm şemaları ikinci kez yazılmaz; yeni bölüm türü görünümlerde kendiliğinden kullanılabilir. Bölüm kimlikleri dosyada sabittir (yeniden uygulama aynı belgeyi üretir).
- **İş bölümü C12'deki gibi:** paket çerçeveyi (manifest, izinli dosya adları, tutamaç ve dosya yolu biçimi, klasör dışına çıkamayan yollar) denetler; içeriği backend kendi şemalarıyla, uygulamadan önce bütün olarak denetler. Reddedilen görünüm hiçbir şey yazmaz. Birim testi depodaki her görünümü `production` ve `test` kayıt defterleriyle doğrular.
- **Yükleyici:** `PACK_FILES` yanına `presets/` klasörü tanınır; içindeki izinli adlar dışındaki her dosya yine reddedilir. `SectorPackSummary.counts`'a `presets` eklenir.
- **Sürüm:** görünümün kendi `version`'ı; görünüm eklenince ya da değişince paketin `version`'ı da artar. Uygulanan görünüm düzen belgesine yazılır: `settings.preset: { pack, code, version } | null`; taslakla, yayınla ve sürüm geçmişiyle birlikte gider, panel "yeni sürüm var" diyebilir.

### 3. Önizleme: tema ayarı ve menüler düzen belgesine girer

İki yol karşılaştırıldı:

| | (i) Düzen belgesinin `settings`'inde taşımak | (ii) Önizleme jetonuna geçici geçersiz kılma |
| --- | --- | --- |
| Saklama | Var olan `draft` / `published` / sürüm | Yeni saklama gerekir: jeton bugün hiçbir şey saklamaz (satır kimliği + `updated_at` imzası), menüler jetona sığmaz |
| Okuma | Var olan yol: önizleme yanıtı zaten `settings` verir, vitrin `currentLayout()` / `currentShared()` ile okur | `/store/storefront` ve `/store/storefront-menus` uçlarına da jetonlu sürüm; vitrin üç isteğe başlık taşır |
| Yayın | Tek "Yayınla", tek kilit, tek sürüm | Üç ayrı yazma (düzen, ayar bölümü, menüler); yarıda kalırsa karışık görünüm |
| Geri alma | Sürümü taslağa geri almak görünümün tamamını getirir | Tema ayarı ve menü için geri alma yok |
| Emsal | adr/0049 Ek 2026-11-06: rozetler, renk örnekleri, "Az kaldı" aynı yolla taşındı (`withLegacy`) | yok |
| Bedel | adr/0053 §B.7 değişir: tema ayarı "Yayınla" ile yayına girer | Küçük görünür, ama yayın ve geri alma çözülmeden kalır |

**Seçilen: (i).**

- **Tema ayarı:** `settings.theme` (`themeSection`'ın şeması; `null` = henüz buraya yazılmadı). Okuma emsaldeki gibi: `null` ise `theme` ayar bölümü okunur (`withLegacy`), göç yok. `GET /store/storefront`'un `theme`'i yayındaki belgeden gelir; önizleme taslağınkini verir; vitrinde `currentTheme()` belgeyi okur. Düzenleyicinin "Tema ayarları" satırı taslağın parçası olur (kendiliğinden kayıt, geri al, canlı önizleme). Karşıtlık denetimi belge şemasında çalışır. `storedSettings` bugün parçalardan biri geçmezse hepsini boş sayıyor; parça parça okuyacak biçimde düzeltilir.
- **Menüler:** canlı kaynak `storefront-menus` modülü ve Menüler ekranı olarak kalır (kayıt hemen yayında, adr/0049 §3). Belgeye `settings.menus` eklenir: `null` = "menülere dokunma"; doluysa **yayında yerine geçecek menü takımı**. Önizleme dolu takımı aynı çözümleyiciyle (`resolveLinks`) gösterir. `publishLayoutWorkflow`'a bir adım eklenir: takım doluysa menü kilidi altında modüldeki menüleri değiştirir (telafisi: eski menülerin anlık görüntüsünü geri yazar; `menus.ts`'teki `snapshotOf` / `putBack` deseni), vitrine `menus` yenileme sinyali gönderir ve taslaktaki takımı `null`'a çeker. Böylece sonraki bir düzen yayını Menüler ekranında yapılmış değişikliği ezmez. Sürüm kaydı takımı taşır: eski sürümü geri almak o günün menülerini de taslağa getirir; panel bunu söyler ve "menüleri alma" seçeneği sunar.

### 4. Uygulama: `applyPresetWorkflow`

Girdi: `{ pack, code, demo: boolean, actor }`. Çıktı: `{ preset, version, skipped: [{ where, ref }], demo: { added, kept } }`.

1. **Doğrula:** görünüm okunur, tema ve menü şemaları, dosya adları denetlenir.
2. **Demo içerik** (istenmişse, §5).
3. **Görseller:** her `$image` dosyası yükleme hattından (tür ve boy denetimi, temizleme, türevler) medya kütüphanesine alınır. Defter anahtarı `preset_image:<kod>/<dosya>`; kayıtlı ve hâlâ duran görsel yeniden yüklenmez. Telafi: bu çalıştırmada yüklenenler silinir.
4. **Çözüm:** `$handle` kayıt kimliğine, `$href` `linkFromHref` ile bağlantıya çevrilir.
5. **Taslağa yaz:** belge `saveLayoutDraftWorkflow` ile yazılır (denetim, kilit, görsellerin "bağlı" işareti onun işi). Yayın yok.
6. **Kayıt:** denetim kaydı (`storefront_layout`, eylem `preset_applied`, paket, kod, sürüm, atlananların sayısı).

- **Çözülemeyen tutamaç uygulamayı durdurmaz, bölümü düşürür.** Seçim listesinde (kategori karoları, elle ürün rafı, markalar) bulunamayan öğe çıkarılır; liste boşalırsa ya da bölümün tek kaydı yoksa (öne çıkan ürün, kategori ya da koleksiyon rafı) bölüm taslağa girmez. Yerine başka kayıt konmaz, kaynak sessizce "en yeniler"e çevrilmez. Mağaza yoluna giden ama kaydı bulunmayan menü ve düğme bağlantısı çıkarılır. Hepsi `skipped`'te döner; panel "3 bölüm eklenmedi: şu kategoriler yok" der. Paketin gizli oluşturduğu kategoriler (`is_active: false`) çözülür; bölüm, kategori açılınca görünür (`liveRecords` bugün böyle süzüyor).
- **Var olan taslak.** Uygulama taslağın bölümlerini, `settings.theme`'ini ve `settings.menus`'ünü değiştirir; yayındaki görünüme dokunmaz. Yayınlanmamış değişiklik varsa panel önce sorar. Rozetler, renk örnekleri ve "Az kaldı" eşiği mağazanın verisidir, korunur. "Vazgeç" var olan `discard` ucudur.
- **İdempotentlik.** Aynı görünümü yeniden uygulamak aynı taslağı üretir: bölüm kimlikleri sabit, görseller ve demo kayıtları defterden bulunur. Defter kuralı ikiye ayrılır: **kayıt üreten öğeler** (görsel, demo içerik) C12'deki gibi bir kez sunulur; **taslağa yazma** deftere bağlı değildir, her uygulamada yeniden yazılır (sahibin istediği davranış bu). `PACK_ITEM_KINDS`'e `preset_image` ve `demo_record` eklenir (enum; migration ister).
- İş mantığı workflow'dadır; betik ve API ince kalır. Alt workflow'ların adım olarak çağrılması ve kilitlerin iç içe alınmaması Medusa belgelerinden doğrulanarak kurulur (Context7; bu ADR bir Medusa API'si varsaymıyor).

### 5. Demo içerik

- `demo.json`'daki her kayıt panelin kullandığı workflow'larla oluşturulur ve `DEMO_METADATA` ile işaretlenir; ek olarak `demo_preset: "<paket>/<kod>"`. Kaldırma var olan demo kaldırma düzenidir (`scripts/demo-removal/`); görünümün yüklediği demo görselleri ve sayfaları kapsayacak biçimde genişletilir ve panelden çağrılabilir olur.
- **Yalnız kataloğu boş mağazada sunulur** (yayında ürün yok). Demo ürünler yayınlanmış kayıtlardır, taslak düzen gibi gizlenemez; canlı mağazada ziyaretçiye görünürlerdi. Kataloğu olan mağazada görünüm mağazanın kendi kayıtlarına tutamaçla bağlanır, bulunamayan atlanır.
- Demo, görünümün kullandığı paket kategorilerine görsel atar ve onları açar (sahip kararı 5).
- Sahip kararı 7: riskli ürünler (kılıç vb.) hazır içerikte yer alır; 6136 notu doğrulanmamış olarak kayıtta durur. Ürün düzeyinde yasal not yeteneği ayrı iştir (Faz 3).
- Bugünkü elle demo katalog yüklemesi (`apps/backend/src/scripts/load-demo-catalog.ts`, bu ADR yazılırken başka bir işte ekleniyor; içeriği okunmadı) ilk görünümün `demo.json`'una taşınır.

### 6. Bölüm biçimleri

- Görünümlerin düzen olarak ayrışabilmesi için bölüm türlerine `variant` alanı eklenir: `z.enum([...]).default(<bugünkü çizim>)`. Varsayılan bugünkü çizim olduğundan saklanan belgeler değişmeden okunur (`placement` ve `columns` alanlarındaki desen). Biçim adları sektörden bağımsızdır; görünüm modeli alanı taşır, tema çizer, tanımadığı biçimde varsayılanı çizer.
- İlk tur: `hero`, `products`, `categories`, her birinde 2–3 biçim. Adlar ve çizimler Faz 6'da sahiple belirlenir ve `design.md`'ye yazılır; bu ADR alanın yerini ve kuralını sabitler, listeyi değil.
- Düzenleyicide biçim, bölüm formunda küçük resimli seçimdir; adr/0049'a ek olarak yazılır.

### 7. Panel, üst panel, yetki

- **Uçlar:** `GET /admin/storefront-presets` (bu mağazaya uygulanmış paketlerin ve `general`'ın görünümleri; `sector_pack_application`'dan) ve `POST /admin/storefront-presets/:pack/:code/apply` (`{ demo }`, katı şema). Küçük resim panel üzerinden sunulur.
- **Galeri** tema düzenleyicide "Görünümler": kart (küçük resim, ad, açıklama, ton, sürüm, "şu an bu"), "Taslağa uygula" (taslak uyarısı; boş katalogda "demo içerikle" kutusu) → düzenleyici canlı önizlemeyle açılır → sahip düzenler → "Yayınla". Uygulamadan önce görülen şey küçük resimdir; gerçek önizleme taslağın kendisidir. Ayrı bir önizleme düzeneği kurulmaz.
- **Yetki:** uygulama `owner` ve `admin` (düzen yazma kuralı, adr/0049 §5); yayın bugünkü gibi. Her yazma denetim kaydında.
- **Üst panel:** kurulum sihirbazında sektör paketinden sonra "Görünüm" adımı (seçilen paketin ve `general`'ın görünümleri; varsayılan Grafit). `tenant.preset` kaydı; `sector_pack` adımından sonra `preset` adımı kapalı listeye eklenen `tenant:apply-preset pack= preset= demo=` betiğini çalıştırır (`QT_TENANT_RESULT` satırı, katı sözleşme). **Yalnız kurulumda ve yayında düzen yokken** betik taslağı yayınlar (yeni mağaza seçilen görünümle açılır); başka her durumda taslakta bırakır.

### 8. İlk görünümler

- **`grafit`** (`general` paketi): bugünkü görünüm. `theme.json` adr/0062'nin varsayılanları, `layout.json` `defaultLayout`'un karşılığı, menü ve demo yok. Uygulamak mağazayı "fabrika görünümü"ne taslakta döndürür.
- **`cutlery` paketi, iki görünüm** (Faz 6; içerik sahiple): koyu-sert ve açık-temiz. Fark tema ayarlarından (renk, yazı tipi, köşe, düğme, kart oranı), bölüm sırası ve biçimlerinden, menüden ve görsellerden gelir; kod farkı yoktur.

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Sektör paketinde veri demeti; taslağa uygulanır (seçilen)** | Yeni modül yok; depoda gözden geçirilir, sürümlenir, testle doğrulanır; var olan taslak, önizleme, yayın ve geri alma kullanılır | Mağaza kendi görünümünü kaydedemez; yeni görünüm yeni sürüm (deploy) ister |
| Yeni `storefront-presets` modülü (görünüm veritabanında; mağaza kendi görünümünü kaydeder) | Çalışma anında eklenir; "görünümümü kaydet" | Instance-per-tenant'ta her veritabanına ayrı ayrı çoğaltma ve güncelleme; görseller ve tutamaç çözümü yine gerekir; kapsam büyür, ihtiyaç yok |
| İkinci tema paketi (`packages/themes/<ad>`) | Sınırsız görsel özgürlük | Sahip reddetti (2026-11-14); her sayfa ikinci kez çizilir ve bakılır; tema değişimi derleme ister (adr/0057) |
| Mağaza profilini genişletmek (profil düzen de yazsın) | Yükleyici hazır | Profil mağazaya özel geçiş klasörüdür; panelden çalışmaz, galeri ve sürüm kavramı yok |
| Görünümü doğrudan yayınlamak | Tek tık | Canlı mağazada geri dönüşü zor; sahip görmeden değişir |
| Önizleme: jetona geçici geçersiz kılma (§3 ii) | Belge şeması değişmez | Yeni saklama, üç uçta jeton, bölünmüş yayın, geri alma yok |
| Görünümde serbest CSS / özel bölüm HTML'i | Görünümler çok ayrışır | adr/0049 §2 ve adr/0053'e aykırı; enjeksiyon; karşıtlık denetlenemez |

## Sonuçlar

- **Değişen sözleşmeler:** adr/0053 §B.7 (tema ayarı artık taslak → yayın); adr/0049 §3 (menüler Menüler ekranında yine hemen yayında; ek olarak düzen yayını bekleyen takımı uygular); düzen belgesine `settings.theme`, `settings.menus`, `settings.preset` ve bölümlere `variant`; `@qticaret/types` `StoreLayoutSettings`; `PACK_ITEM_KINDS`; üst panelde `tenant.preset` ve `preset` adımı (adr/0061'e ek).
- **Yeni:** `packages/sector-packs/src` görünüm şeması ve yükleyicisi, `packs/general/presets/grafit/`; backend `lib/storefront/presets/` (gezici, çözüm), `workflows/storefront/preset-apply.ts`, `api/admin/storefront-presets`, `scripts/apply-preset.ts`; panelde galeri.
- **F16:** imaj `packs/**/presets/**`'i (görseller dahil) taşımalı; imaj boyu görsellerle büyür, sınır şemada.
- **Bilinen sınırlar:** (1) Kartların "Az kaldı" eşiği gibi herkese açık uçtan gelen veriler önizlemede yayındakini gösterir (bugünkü sınır). (2) Uygulama mağazanın elle düzenlediği taslağı siler; panel sorar, yayındaki ve sürümler durur. (3) Görünümün yeni sürümü kendiliğinden uygulanmaz; sahip yeniden uygular ve düzenlemelerini kaybeder. (4) Demo içerik yalnız boş katalogda. (5) Sürümü geri almak menüleri de geri getirebilir; panel söyler.
- **Güvenlik:** görünüm dosyaları depodan gelir, yine de mağazanın şemalarından ve yükleme hattından geçer (güvenilen girdi sayılmaz); dosya yolları klasörün dışına çıkamaz; uç hız sınırı ve denetim kaydı altında; `security-reviewer` incelemesi (yetki ve dosya okuma).
- **Varsayımlar (doğrulanmadı):** yükleme hattının adımlarının (`workflows/media/steps/save-media.ts`, `register-media.ts`) yerel dosyadan çağrılabildiği (`importMediaWorkflow` yalnız genel adresten çeker, paket dosyası için uygun değil); demo kaldırmanın sayfa ve medya kapsamı; üst panel kurulumunda bugün demo ya da profil çalışmadığı (denetimin bulgusu).

## Sahip kararları (2026-11-14)

Sahip iki ADR'ı birlikte onayladı ("önerilerle ilerle"). Taslaktaki açık sorular aşağıdaki kararlara dönüştü.

1. **Tema ayarı "Yayınla" ile yayına girer** (sahip, açık yanıt): düzenleyicide her şey taslak → önizleme → yayın olur; görünüm bütün olarak yayınlanır ve geri alınır. adr/0053 §B.7 bununla değişir.
2. **Görünüm yayınlanınca mağazanın menüleri onun menüleriyle değişir,** yalnız görünüm menü taşıyorsa ve galeri bunu uygulamadan önce söyleyerek. Menüler ekranı bugünkü gibi hemen yayında kalır.
3. **Demo içerik yalnız kataloğu boş mağazada sunulur.**
4. **Kurulumda seçilen görünüm kendiliğinden yayınlanır,** yalnız yeni mağazada; sonradan her uygulama taslakta kalır.
5. **Demo içerik paket kategorilerini açar ve onlara demo görsel atar.** Demo kaldırılınca görseli demo olan ve gerçek ürünü bulunmayan kategori yeniden gizlenir, silinmez.
6. **"Koyu-sert" görünümde sayfa zemini açık kalır** (sahip, açık yanıt): koyu hava koyu bölümlerle (grafit sahneler, bölüm biçimleri), renk ve fotoğraf diliyle verilir. Bütünüyle koyu sayfa zemini bu ADR'ın kapsamı dışındadır; istenirse ayrı ADR ister (bütün karşıtlık tablosu yeniden kurulur, tema bugün `color-scheme: only light`).
7. **Görünüm görsellerinin kaynağı ve lisansı:** depoya yalnız sahibin sağladığı ya da lisansı kayıtlı görseller girer; kaynak `preset.json`'a `credits` olarak yazılır, docs/12'ye madde eklenir.
8. **Mağazanın kendi görünümünü kaydetmesi ("görünümümü sakla") şimdi yapılmaz;** sürüm geçmişi aynı işi son 20 yayın için görür.

## Uygulama sırası (Faz 2)

| # | İş | Boyut | Not |
| --- | --- | --- | --- |
| 2.1 | `settings.theme` ve `settings.menus`: şema, okuma (`withLegacy`), önizleme yanıtı, yayın adımı ve telafisi, vitrin okuması, düzenleyicide "Tema ayarları"nın taslağa geçmesi | M-L | Önkoşul: adr/0062 işi 1 |
| 2.2 | Görünüm şeması ve yükleyici (`packages/sector-packs`), `grafit` görünümü, paket testleri | S | 2.1 ile paralel |
| 2.3 | `applyPresetWorkflow`: gezici, tutamaç ve adres çözümü, görsellerin medyaya alınması, taslağa yazma, defter türleri (migration), uç ve betik | M | 2.1 ve 2.2'den sonra |
| 2.4 | Demo içerik: `demo.json`, işaretleme, kaldırmanın genişlemesi; bugünkü elle yüklemenin taşınması | M | 2.3'ten sonra |
| 2.5 | Bölüm biçimleri: `variant` alanı (backend, tipler, görünüm modeli), `hero` / `products` / `categories` çizimleri, düzenleyici formu | M-L | 2.1 ile paralel; çizimler sahip onayıyla |
| 2.6 | Panelde görünüm galerisi: seç, uygula, önizle, atlananlar özeti | M | 2.3'ten sonra |
| 2.7 | Üst panel: sihirbaz adımı, `tenant.preset`, `preset` kurulum adımı | S | 2.3'ten sonra |

Her iş kendi testleriyle gelir: HTTP (uygulama iki kez aynı taslak; çözülemeyen tutamaç; canlı mağazada demo reddi; yayında menülerin değişmesi ve telafisi; önizlemede taslak tema ve menü), birim (gezici, şema reddi, her görünümün doğrulanması), panel ve e2e (galeriden yayına).

## Ek 2026-11-14 (Kabul edildi, 2026-11-14): ilk görünümler ve iş 2.5

- **Durum:** Kabul edildi (2026-11-14), adr/0049 Ek 2026-11-14 ile birlikte. Dayanak: `docs/tema/atolye-tamamlama-plani.md` "Maket seçimi"; adr/0049 Ek 2026-11-14 (bölüm biçimleri, yeni bölüm türleri, gelişmiş CSS).
- **§8 "İlk görünümler" güncellenir.** Sahip maket galerisinden iki düzen takımı seçti; ikisi de ayrı hazır görünüm olur:

  | Kod | Paket | Takım | Maketler |
  | --- | --- | --- | --- |
  | `grafit` | `general` | Bugünkü görünüm | Değişmez |
  | `koyu-sert` | `cutlery` | Kombinasyon | DY3, N12, M7 (telefonda MT1), H11, KK2, SR1 (kart UK2), FS1, OU2, GS1, GB2, RH3, YR1, MR2, BL2, AB3 |
  | `acik-temiz` | `cutlery` | Klasik katalog | KY3, N14, H17, GB4, UR5 (kart UK5), KY1, KB2, KK4, MR1, YR1, AB1 |

  - **Hava ile takımın ilişkisi.** Sahip kararı 6 iki hava istemişti (koyu-sert, açık-temiz); maket seçimi iki düzen takımı verdi. Seçenekler: (a) her takım bir havayla eşleşir, iki görünüm; (b) takım ve hava ayrı eksen, 2 × 2 = dört görünüm; (c) takım görünümdür, hava galeride ayrı bir tema ayarı düğmesidir. **Karar: (a)** (öneriyle, sahip yetkisiyle; sahip teknik ve küçük kararlarda "önerilerle ilerle" dedi, 2026-11-14). Kombinasyon takımı koyu-sert olur (OU2'yi maket notu "koyu-sert görünümün imza bölümü" diye anlatıyor; AB3 koyu alt bilgi; sahne zeminli bölümler), klasik katalog açık-temiz. Eşleme: kombinasyon = `koyu-sert`, klasik katalog = `acik-temiz`; (b) içerik ve bakım yükünü ikiye katladığı için seçilmedi.
  - Koyu-sert görünümde sayfa zemini yine açıktır (sahip kararı 6); koyu hava sahne zeminli bölümlerle (adr/0049 Ek 2026-11-14 §6 `look.ground: stage`), koyu alt bilgiyle, renk ve fotoğraf diliyle verilir.
  - **Kategori ve ürün sayfası:** dört kategori düzeni (KT1–KT4) biçim olarak taşınır (adr/0049 Ek §7 `category_main`). Kategori düzeni artık kategori başına seçilir (adr/0049 Ek §10 karar 11, sahip), bu yüzden görünüm iki şey yazar: **görünümün varsayılan kategori düzeni** (`layout.json`'da `category_main.variant`) ve **demo kategorilerde örnek atamalar** (tutamaçla, kategori kayıtlarına; `category_layout`, adr/0049 Ek §7). Atamalar düzen belgesi dışında bir yazmadır, görünüm uygulamasının compensation'lı ayrı adımıdır ve taslakla önizlenmez. Başlangıç değerleri: koyu-sert'te varsayılan KT1 (`showcase`), demo üst kategorilerde KT3 (`hub`); açık-temiz'de varsayılan KT3, demo yaprak kategorilerde KT2 (`technical`). KT2 Faz 4'ün karşılaştırması gelene kadar `standard` liste çizilir. Ürün sayfası ikisinde de UP3 (`product_main` `gallery_wall`).
  - Sepet, ödeme ve onay maketleri (SC1, SP1, OD1, SO1) görünümlerin parçası değildir; adr/0049 Ek §10 karar 10 (ayrı ADR).
  - Görünümler gelişmiş CSS taşımaz (§1 aynen).
- **İş 2.5'in kapsamı adr/0049 Ek 2026-11-14'e taşındı.** §6'nın kuralı (alan `variant`, varsayılan bugünkü çizim, tanımayan tema varsayılanı çizer, adlar sektörden bağımsız) aynen geçerlidir; "ilk tur `hero`, `products`, `categories`" sınırı kalkar, biçim listesi ve şema kararı o ektedir. "Uygulama sırası" tablosundaki 2.5 satırı "adr/0049 Ek 2026-11-14 V1–V3" diye okunur; iki görünüm (Faz 6) o ekin A–F işlerinde kullandıkları biçimler ve F1 (kategori başına düzen seçimi) bitince yazılır.
