# ADR-0013: Ürün özellik şablonları (`product-attributes`) veri modeli

- **Durum:** Kabul edildi (2026-10-24, kullanıcı onayı; uygulama F2 S8–S13)
- **Tarih:** 2026-10-24

## Bağlam
Sektörel ürün bilgisi (ör. malzeme, ölçü, beden) koda değil, tenant'ın tanımladığı **şablonlara** dayanır (docs/01).
F2.4 şunları ister:
- **Alan tanımları:** tip, birim, zorunluluk, filtrelenebilirlik, "SEO'da öne çıkar" ve `variesBy` eşlemesi
- **Bağlantı:** ürün ↔ değer link'i
- **Arayüz:** ürün detayında admin widget'ı, Store API'de ürünle birlikte dönen değerler

Sonraki kullanıcılar:
- F3.4 başlık şablonundaki `{öne_çıkan_attribute}` token'ı
- F3.12 JSON-LD `variesBy` (yalnızca color, size, suggestedAge, suggestedGender, material, pattern)
- F3.17/F18 facet filtreleri
- F3.9 içe aktarma

adr/0007 gereği ürün tipi KDV grubuna ayrılmıştır; sınıflandırma için kullanılamaz.

Medusa 2.21.2'de doğrulananlar (F2 planlaması):
- **Link:** `defineLink(Product.linkable.product, { linkable, isList: true, deleteCascade: true })`. Link tablosuna ek kolon eklenebilir.
- **Store API:** `allowed` listesi zorunlu. Bağlı veri `allowFields(...)` middleware'iyle açılır; her iç yol ayrı yazılır. Middleware `methods` olmadan tanımlanmalıdır.
- **Admin API:** `/admin/products` için `allowed` kısıtı yok.
- **Ürün route'ları:** Core route'lar `additional_data` taşır (`additionalDataValidator` + `productsCreated` / `productsUpdated` hook'ları). Ancak admin'in ürün formu bu alanı göndermez.

## Karar
- **Modül:** `product-attributes`.
  - **`attribute_template`:** `name`, `handle` (unique), `description`.
  - **`attribute_definition`:** Şablona `belongsTo` ile bağlıdır. Alanlar:
    - `key` (şablon içinde unique), `label`
    - `type`: `text` | `number` | `boolean` | `select` | `multi_select`
    - `unit`, `options` (jsonb `{ value, label }[]`), `rank`
    - `is_required`, `is_filterable`, `is_seo_highlight`
    - `scope`: `product` | `variant`
    - `varies_by`: Google'ın altı değerinden biri veya boş
  - **`attribute_value`:** Tanıma `belongsTo` ile bağlıdır. Değer tipli kolonlarda tutulur: `value_text`, `value_number` (numeric), `value_boolean`, `value_options` (jsonb).
- **Link'ler:**
  - ürün ↔ şablon: tek şablon, `isList: false`
  - ürün ↔ değer: `isList: true`, `deleteCascade: true`
  - (ürün, tanım) tekilliği, ürün başına kilitli upsert workflow'uyla sağlanır.
- **Varyant düzeyi özellikler:** Değerleri Medusa'nın ürün seçeneklerinde (product option) kalır. `scope: variant` tanımı hangi seçeneğe karşılık geldiğini (`option_title`) ve `varies_by` değerini taşır. Bu tabloda varyant değeri tutulmaz.
- **Doğrulama:** Değer seti, şablon tanımlarından üretilen bir Zod şemasıyla workflow içinde doğrulanır. Kontroller: zorunluluk, tip, `select` için seçenek listesi.
  - Değeri olan bir tanımın tipi değiştirilemez.
  - Tanım silinirse değerleri onayla birlikte soft-delete edilir.
- **API:**
  - Şablon CRUD: `/admin/attribute-templates`
  - Ürün değerleri: `GET/POST /admin/products/:id/attributes`
  - **Store:** `/store/products` ve `/store/products/:id` için `allowFields` ile `attribute_values` ve tanım alanları (`label`, `unit`, `key`, `is_seo_highlight`) açılır.
  - `additional_data` hook'u F3.9 içe aktarmada eklenir.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **Tipli EAV satırları + link** | Facet sorguları indekslenebilir (tanım + değer); tip güvenli; Medusa link deseni | Ürün başına çok satır; tekillik workflow'da |
| Ürün başına tek jsonb belge | Okuma basit | Sayısal aralık filtresi için anahtar başına ifade indeksi gerekir; şema kayması |
| Ürün `metadata`'sı | Kod yok | Tip, doğrulama, filtre ve denetim yok |
| Ürün tipi veya etiketleri | Core alan | Ürün tipi KDV'ye ayrılmış (adr/0007); etiketler tipsiz |

## Sonuçlar
- Şablon yönetim ekranının ilk sürümü F2'de gelir. F12.4 bunu ayar ekranları arasında düzenler.
- Facet sorguları (F3.17) için gereken indeksler: `(definition_id, value_number)`, `(definition_id, value_text)` ve `value_options` üzerinde GIN. Bunlar S11 migration'ında oluşturulur.
- Store API sözleşmesi F18 öncesi `packages/types`'a taşınır.

## Ek: F2 S11 uygulaması ve güvenlik incelemesi (2026-10-25)
- **Değer kolonları:**
  - Tek seçim ve metin `value_text`'te (btree facet).
  - Çoklu seçim `value_options`'ta (GIN; migration'a elle eklendi).
  - Sayı `value_number`'da (numeric), evet/hayır `value_boolean`'da.
- **Store:**
  - `allowFields` yaprak alanları açar; seçenekler dahil, çünkü vitrin seçimin etiketini gösterir.
  - Kendi guard'ımız `fields` içinde özelliklere değen her parçanın izinli bir yaprak olmasını ister. `*attribute_values`, `attribute_values.*` ve `.definition.template` gibi geçişler 400 alır.
- **Görünürlük (ek, 2026-10-31):** tanımda `is_public` (varsayılan açık). Kapalı tanımın değerleri vitrin API'sinin ürün yanıtlarından sunucuda çıkarılır (`api/http/attribute-visibility.ts`; okuma başarısız olursa bütün değerler çıkar). Kapalı tanım filtre, SEO öne çıkan ya da varyant seçeneği olamaz (`product_attributes.private_shown`); içerik taslakları ve başlık sözcüğü onu görmez. Panel, şablon ekranında "Vitrinde göster" anahtarıyla seçtirir. Personel ve dışa aktarma bütün değerleri görür.
- **Kilitler:** Değeri olan tanımda tip, kapsam, anahtar ve birim değişimi ile kullanılan seçeneğin kaldırılması 409 alır.
- **Onaylar:** Değeri olan üründe şablon değişimi `confirm_template_change` ister.
- **Eşzamanlılık:**
  - Şablon değişiklikleri şablon başına kilit alır; ürün kaydı ürün ve hedef şablon kilidini alır.
  - (ürün, tanım) tekilliği için link tablosunda DB indeksi ertelendi (F16'da Redis locking ile birlikte değerlendirilir).
- **Sınırlar:**
  - Anahtar `Object.prototype` adlarını alamaz.
  - Seçenek değeri slug biçimindedir; metinler kontrol karakteri içeremez.
  - Değer metni 500 karakterdir (btree satır sınırının altında).


## Ek (2026-11-04): özellik tablosunun bölümleri (otonom, gözden geçir)

İkinci vitrin teması (denetim 2026-11-04 §7, `design.md` "Teknik özellikler tablosu") ürün sayfasında gruplu bir teknik özellik tablosu istiyor: "Bıçak", "Sap" gibi bölümler, her birinin altında kendi satırları.

- **Veri:** `attribute_template.groups` (jsonb, boş olabilir) `{ key, name, rank }[]`; `attribute_definition.group` (metin, boş olabilir) şablonun bir bölümünün `key`'i. Migration `Migration20261104210344` (iki kolon; veri taşıma yok).
- **Kurallar:** en çok 30 bölüm; anahtar `^[a-z0-9][a-z0-9_-]{0,39}$`, şablonda bir kez (`product_attributes.groups_duplicate`); ad 1–100 karakter, kontrol karakteri yok; `rank` 0–10000. Tanımın bölümü şablonda olmalı (`product_attributes.group_unknown`). İkisi de isteğe bağlıdır: bölümsüz şablon önceki gibi kaydedilir.
- **API:** `POST /admin/attribute-templates` ve `/:id` `groups`'u (tam liste) tanımların yanında alır. Tanım `group`'u göndermezse kendi bölümü kalır (eski istemci bölümleri silmez). `groups` tanımlar olmadan gönderilip bir bölüm kaldırılırsa o bölümün tanımları bölümsüz kalır. Geri alma şablonun bölümlerini ve tanımların bölümünü eski hâline getirir.
- **Store API:** `fields`'ta iki yeni yaprak açıldı: `attribute_values.definition.group` ve `attribute_values.definition.template.groups` (yalnız bölüm listesi; şablonun başka alanı ve öteki ürünlere giden yollar `restrictStoreAttributeFields` ile hâlâ 400). `attribute_values.definition.template` ilişkisi Medusa'nın izin listesine yalnızca bu yaprak çözülsün diye eklendi.
- **Vitrin:** `ProductPageView.specGroups?: SpecGroupView[]` (`{ title: string | null, rows: SpecView[] }`), bölümlerin sırasıyla; bölümü olmayanlar sonda başlıksız grupta; bölümsüz şablonda tek başlıksız grup (düz tablo). `specs` düz liste olarak kalır.
- **Panel:** şablon düzenleyicide bölüm ekleme, yeniden adlandırma, sıralama, silme ve her alana bölüm seçimi.
- **Etkilenmeyen:** katalog tablosu (içe/dışa aktarma), facet'ler, başlık sözcüğü, JSON-LD.
- **Testler:** `modules/product-attributes/__tests__/groups.unit.spec.ts`, `integration-tests/http/attribute-groups.spec.ts`, vitrin `lib/views/__tests__/spec-groups.spec.ts`.


## Ek (2026-11-05): açıklamadaki özellikler (otonom, gözden geçir)

**Bağlam.** WordPress'ten gelen ürünlerin teknik bilgileri öznitelik değeri değil, açıklamanın içinde tablo ya da liste olarak duruyor. Vitrinin özellik tablosu ve bölümleri, öne çıkan ürün yakın planı, filtreler ve JSON-LD `additionalProperty` boş kalıyor. Kural değişmedi: sektör bilgisi şablondaki veridir, kod değildir. Okuyucu sektörden bağımsızdır; başlık eş anlamlıları ve örnekler yalnızca veride (`lib/catalog/facts/vocabulary.ts`) ve testlerdedir.

**Okuma (`lib/catalog/facts`, saf).** Ürünün açıklama belgesi (`product_extension.description_doc`, adr/0055) okunur. Belge yoksa `description` HTML ise HTML olarak (belgenin dönüştürücüsü ve tanım listeleri), değilse düz metin olarak okunur. Her satır `{ label, value, source_path }` döner; varsa `context` (satırın bölümü) ve `unit` (etiketteki birim) de gelir.
- **Tablolar:** iki sütunlu tablonun satırları her yerde okunur.
  - İlk satır yalnızca sütun adlarıysa ("Özellik | Değer"; `TABLE_HEADER_WORDS`) ya da hepsi başlık hücresiyse atlanır.
  - Tek hücreli satır altındaki satırların bölümüdür.
  - Bir başlık satırı ve tek değer satırı olan tablo da okunur (etiketler üstte, değerler altta).
  - Çok sütunlu, çok satırlı tablo (beden tablosu) okunmaz.
- **Tanım listesi** (yalnız HTML'de): `dt` etiket, `dd` değer.
- **"Etiket: değer" satırları:** paragraf satırları, liste maddeleri ve `**Etiket** değer` biçimi. Yalnızca bir özellik başlığının (`SPEC_HEADINGS`) altında okunur.
  - Başlık gerçek başlık (h2–h4) ya da tek başına kalın bir satır olabilir. Büyük/küçük harf, Türkçe harf ve sondaki iki nokta fark etmez.
  - Bölüm, aynı ya da üst düzey bir sonraki başlıkta biter. Kalın satırla açılan bölüm düz bir cümlede de biter.
  - Bölümün içinde "Etiket – değer" (tireyle) de okunur. İç başlık ve iç listenin üst maddesi altındaki satırların bölümüdür.
- **Başlıksız:** bölüm dışında yalnızca bütün maddeleri özellik olan bir liste ya da art arda en az iki özellik satırı okunur. Tek satır okunmaz.
- **Okunmayanlar:** "Not:", "Uyarı:" gibi açıklama etiketleri (`REMARK_LABELS`), cümle gibi biten ya da 80 karakteri geçen etiketler.
- Aynı etiket, değer ve bölüm bir kez sayılır; ürün başına en çok 200 satır.

**Eşleme (`match.ts`).**
- Etiket, ürünün şablonundaki ürün kapsamlı alana bakılarak eşlenir. Etiket alanın adı, anahtarı (`kasa_rengi` → "kasa rengi") ya da **başka adlarından** biriyse eşleşir. Karşılaştırmada Türkçe harfler, büyük/küçük harf, aksan ve noktalama yok sayılır (`labelKey`, slug kuralı).
  - **Başka adlar:** yeni sütun `attribute_definition.aliases` (jsonb, `string[]`, en çok 20, `Migration20261105120000`). Panelde şablon düzenleyicide "Başka adları" alanından girilir.
- İki alanın adı aynıysa satırın bölümü, alanın bölümünün (grup) adıyla karşılaştırılır. Yine de tek alan kalmazsa satır **birden çok alana uyuyor** sayılır.
- Varyant özelliği eşlenmez; onun değerleri ürün seçenekleridir.
- Değer alanın türüne göre okunur (`parse.ts`):
  - **Sayı:** birimiyle okunur ve alanın birimine çevrilir: 22 cm → 220 mm, 1,2 kg → 1200 g. Birimsiz sayı etiketteki birimi ("Boy (cm)"), o da yoksa alanın birimini alır. Türkçe ondalık okunur; noktadan sonra üç hane binlik ayracıdır.
    - Çevrilebilen boyutlar: uzunluk, ağırlık, hacim, süre (`UNIT_DIMENSIONS`). Bunların dışındaki birim (sertlik, yüzde) alanınkiyle aynı yazılmalıdır.
    - İki sayılı aralık ("58–60") okunmaz. Birden çok sayıdan alanın birimine çevrilen ilki alınır ("220 mm (8,7 inç)").
  - **Seçim:** değer alanın seçeneklerinden birinin adı ya da değeri olmalıdır. Çoklu seçim virgül, "/" ya da "ve" ile ayrılır. **Seçenek açılmaz.**
  - **Evet/hayır:** evet, var, mevcut / hayır, yok.
  - **Metin:** en çok 500 karakter.
- Aynı alana iki satır farklı değer veriyorsa hiçbiri yazılmaz (çelişki).
- Sonuçlar:
  - `ready`: alan boş, yazılır.
  - `same`: aynı değer var.
  - `filled`: üründe başka değer var; yalnızca "üzerine yaz" işaretliyse yazılır.
  - `unparsed`: okunamadı, nedeniyle.
  - `conflict`: çelişki.
  - `ambiguous`: birden çok alana uyuyor.
  - `unmatched`: alanı yok.
- **Önerilen alanlar (`suggest.ts`):** alanı olmayan etiketler ürünler arasında birleştirilir ve yeni alan olarak önerilir.
  - Türü değerlerden okunur: hepsi sayı (bir boyutta) ise sayı ve en sık birim; hepsi evet/hayır ise evet/hayır; birden çok üründe tekrar eden en çok 30 değer varsa tek seçim (seçenekleri değerlerden); yoksa metin.
  - Anahtarı şablonda boştur. Şablonun bölümleri varsa bölümü satırın bölüm adından, yoksa aynı tablodaki eşleşen alanların bölümünden gelir.

**Panelde "Açıklamadaki özellikleri aktar" (sahip ve yönetici, `catalog` yetkisi).**
- Ürünler listesinde toplu işlem menüsünde, ürün sayfasında Özellikler kartının başlığında yer alır.
- `POST /admin/description-facts/preview` (`product_ids` 1–1000, isteğe bağlı `template_id`) hiçbir şey yazmaz. Ürün ürün satırları, her satırın alanını, okunan değeri ya da neden kaldığını, şablon başına önerilen alanları ve sayıları döner.
- Şablonu olmayan ürünler için özelliklerinin en çok eşleştiği şablon önerilir. Pencerede değiştirilebilir ya da "Şablon verme" seçilir; o zaman bu ürünler atlanır.
- Uygulama `catalog.description_facts` işidir (`catalog.write` grubunda; içe aktarma ve toplu düzenlemeyle yan yana koşmaz):
  1. İşaretlenen yeni alanlar (bölümüyle, listenin sonuna) ve başka adlar şablonun kendi güncelleme iş akışıyla yazılır; kuralları ve geri alması onundur. Kuralın reddettiği ya da zaten bir alanın karşıladığı etiket atlanır ve sayılır.
  2. Her ürün yeniden okunur ve eşlenir. Değerler `upsertProductAttributesWorkflow` ile yazılır (doğrulama, kilit, geri alma, arama olayı). Yazılamayan ürün yalnız kendini etkiler.
- Denetim kaydında: iş başlarken ve biterken, şablona eklenenler, her ürünün önceki ve sonraki değerleri. Rapor ürün başına bir satırdır (yazılan, yazılmayan ve nedeni).

**İçe aktarma (WordPress, Shopify).**
- Belge veren kaynaklarda (`description_doc`) ürünün açıklama belgesi aynı okuyucudan geçer.
- İçe aktarmanın ürüne verdiği şablonun boş alanları, yalnızca **kesin eşleşmelerle** kendiliğinden doldurulur: tek alana uyan, türüne göre okunan, başka satırla ya da kaynağın kendi özelliğiyle çelişmeyen satırlar. Hücreleri katalog içe aktarmasının `Özellik: <anahtar>` sütunlarıdır; denetim ve yazım onundur.
  - Açıklamanın doldurduğu zorunlu alan şablonu "tamam" sayar.
  - Şablon yine yalnızca kaynağın yapılandırılmış özelliklerinden seçilir. Açıklamadan şablon seçilmez; şablonsuz ürünün satırları panele kalır.
  - Önceki çalıştırmanın taşıdığı ürüne dokunulmaz. "Yalnız açıklamaları yenile" değer yazmaz.
- Rapor ve iş özeti (`counts.attribute.facts`, `facts_left`) şunları sayar:
  - Özet sayfasında "Açıklamalardan özellik alanlarına yazılan değerler" ve "Açıklamalarda panelde karar bekleyen satırlar".
  - Notlar sayfasında kalan her etiket ürün sayısıyla (`migration.description_facts_left`, en çok 100).
  - Panelin taşıma sonucunda bir satır.

**Hiçbir zaman kendiliğinden yapılmayanlar.**
- Açıklamadan hiçbir şey silinmez ya da değiştirilmez.
- Alan, seçenek ya da başka ad yalnızca panelde işaretlenince açılır.
- Üründe dolu bir değer yalnızca "üzerine yaz" ile değişir.
- Birden çok alana uyan, çelişen ya da okunamayan satır yazılmaz; listelenir ve atlanır, işi durdurmaz.
- Şablon değiştirilmez. Şablonsuz ürüne şablon yalnızca pencerede seçilince verilir.

**Testler:**
- `lib/catalog/facts/__tests__/extract.unit.spec.ts`, `match.unit.spec.ts`
- `workflows/migration/__tests__/description-facts.unit.spec.ts`
- `integration-tests/http/product-description-facts.spec.ts`
- Panel: `features/attributes/facts/choices.spec.ts`, `facts-dialog.spec.tsx`

**Açık:**
- Okunamayan seçim değeri için "seçenek olarak ekle" yok; seçenek şablon düzenleyicide eklenir.
- Önerilen sayı alanı filtre olarak işaretlenmez; şablonda açılır.
