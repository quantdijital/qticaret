# ADR-0078: Program: tarihli üründe gün gün akış

- **Durum:** Kabul edildi (2026-11-24)
- **Tarih:** 2026-11-24
- **İlgili:** adr/0012 (özellik bayrakları), adr/0019 (içerik belgesi ve sunucuda HTML), adr/0055 (kısa açıklama, dar içerik belgesi), adr/0066 (biçim sözleşmesi), adr/0071 (yapay zekâ çekirdeği), adr/0076 (tarihli ürün ve rezervasyon), adr/0077 §8 (bayrağa bağlı bölümler), docs/13 §5 (JSON-LD), docs/14 (advisor kural seti)
- **Dayanak:** sahip (2026-11-24): tur satan mağaza ürün sayfasında "1. Gün: …, 2. Gün: …" akışını gösterebilmeli; aynı şey kurs (ders ders), atölye ve etkinlik (oturum oturum) için de işe yaramalı. Büyükler (Rezdy, Bókun, FareHarbor, GetYourGuide) bunu ürün içinde sıralı "itinerary" olarak tutar.

## Bağlam

adr/0076 tarihli ürünü (kontenjanlı kalkış) getirdi; ürün sayfası kalkışları, kalan yeri ve kişi fiyatlarını gösteriyor. Ama ürünün **ne içerdiği, adım adım**, yalnız açıklamanın serbest metninde yazılabiliyor: başlık düzeni mağazadan mağazaya değişiyor, tema onu zaman çizelgesi ya da açılır satırlar olarak çizemiyor, arama motoruna yapılandırılmış veri olarak verilemiyor.

### Kodda bugün olan (2026-11-24 `dev`, okundu)

- `booking` modülünde ürün başına `bookable` satırı (kesim saati, saat dilimi, `pax_by_variant` JSON'u). Ürün ayarları `POST /admin/products/:id/bookable` ile, ürün kilidi altında yazılır.
- İçerik belgesi (`lib/content`: `contentDoc`, `renderDoc`) ve alt bilgide dar belge sınırı (`fitsFooter`).
- Ortam kütüphanesi görselleri adresiyle (url + alt) saklanır; kategori, koleksiyon ve bölüm görselleri bu desende, kayıtta kütüphane denetimi ve SVG reddi (`refuseSvgImages`) ile.
- Bayrağa bağlı bölüm eşlemesi `SECTION_REQUIRES` (adr/0077 §8) hazır, ama henüz hiçbir bölüm kullanmıyor.

## Karar

### 1. Sektörden bağımsız "Program"

Özelliğin adı **Program**dır; "tur programı" ya da "itinerary" değil. Bir program sıralı **adım**lardan oluşur; adımlara ne denileceğini ürün seçer (`unit`: `day` → "1. Gün", `step` → "1. Adım"). Adımın kendi etiketi varsa ("Varış günü", "Modül A") o yazılır. Kodda turizm adı geçmez; tur günü, kurs dersi, etkinlik oturumu aynı şekli kullanır. Yalnız tarihli ürüne (`booking_mode = departure`) yazılır; özellik `catalog.booking` bayrağına bağlıdır.

### 2. Saklama: `bookable.program` JSON sütunu

Program `bookable` satırında boş olabilir bir `jsonb` sütunudur (`model.json().nullable()`; migration `Migration20261124090000`). Ayrı tablo değil, çünkü:

- Program her zaman **bütün** okunur ve **bütün** yazılır (panel kartı tek kayıtla kaydeder, vitrin tek seferde çizer); adım bazında sorgu, süzgeç ya da ilişki yok.
- Sınır küçük (en çok 30 adım); satır büyümez.
- Aynı satırdaki `pax_by_variant` ile aynı Medusa deseni; ürünün ayarlarıyla aynı kilit ve aynı yaşam döngüsü (ürün silinince gider).

Serbest JSON da değildir: şekli sunucu her kayıtta Zod ile denetler (§3), okurken de aynı şemayla okur; okunamayan eski ya da elle bozulmuş bir değer "program yok" sayılır, sayfa kırılmaz. Adımsız kayıt sütunu `null` yapar.

### 3. Adım şeması

`{ unit: "day" | "step", steps: Step[] }`, en çok 30 adım. Her adım:

| Alan | Kural |
|---|---|
| `label` | isteğe bağlı, ≤ 40 karakter; boş → `null` (birimle numaralanır) |
| `title` | zorunlu, 1–120 karakter |
| `body` | isteğe bağlı dar içerik belgesi: paragraf, satır sonu, madde ve sıralı liste; kalın, italik, güvenli bağlantı. ≤ 2.000 karakter, ≤ 400 düğüm, derinlik ≤ 4. Başlık, görsel, tablo yok. Metinsiz belge `null` |
| `image` | isteğe bağlı `{ url, alt }` (§4) |
| `tags` | kapalı liste: `breakfast`, `lunch`, `dinner`, `accommodation`, `transport`, `free_time`; listedeki sırayla, her biri bir kez |

Metinlerde denetim karakteri reddedilir. Dar belge sınırı genel `fitsNarrowDoc` olarak `lib/content`'e çıkarıldı (alt bilginin `fitsFooter`'ı aynı davranışla onu kullanır). Sınırlar `@qticaret/types` `PROGRAM_LIMITS/TAGS/UNITS` olarak vitrinle ve panelle paylaşılır; bir birim testi backend kopyasıyla eşitliği tutar.

### 4. Görsel: kütüphane adresi + alt metin

Adımın görseli **ortam kütüphanesindeki adresiyle** (url + alt) saklanır, kimliğiyle değil. Gerekçe: kategori, koleksiyon ve tema bölümü görselleri bugün böyle saklanıyor; vitrin ve panel aynı `MediaField` ve aynı görsel okuyucusunu kullanır, yeni bir yol açılmaz. Güvenlik kimlikle aynı düzeyde tutulur: kayıtta iş akışı (`checkProgramImages`) her adresin kütüphanede **yüklenmiş** (`file_id` dolu), `image/*` türünde bir kayıt olduğunu denetler, değilse `booking.program_image_unknown`; SVG hem adından hem kütüphane türünden reddedilir (`refuseSvgImages`). İstek şeması yalnız adresin biçimine bakar (http(s) depolama adresi ya da mağaza yolu). Vitrin okurken boyutları ve türevleri kütüphaneden alır; sonradan kütüphaneden silinmiş görsel çizilmez (kırık görsel yok). Adımın kendi alt metni kütüphanenin alt metninden önce gelir; ikisi de yoksa adım başlığı.

### 5. Uçlar ve yetki

- `GET /admin/products/:id/program`: `{ booking_mode, program }`; program yoksa `{ unit: "day", steps: [] }`.
- `POST /admin/products/:id/program`: bütün program; adımsız gövde programı siler. `requireFeature(catalog.booking)`, Zod `Program` şeması, gövde sınırı 512 KB. Tarihli olmayan ürün `400 booking.product_not_dated`. Yetki: ürün ayarlarıyla aynı; **operations rolüne kapalı** (permissions testinde). Plan koruması `/admin/products*` altında zaten kapsar.
- İş akışı `setProgramWorkflow`: ürün kilidi → `ensureBookableStep` (ayar satırı yoksa varsayılanla açılır) → `setProgramStep` (telafisi: önceki programı geri yazar) → `CATALOG_PRODUCT_SAVED` olayı (advisor ve arama dizini yeniden okur).
- Denetim kaydı: kaynak `bookable_program`; birim, adım sayısı ve bir özet (digest) yazılır, **metin loga girmez**.
- `GET /store/products/:id/program`: `requireFeature`; yayımlanmamış ya da bu vitrinin satış kanalında olmayan ürün `404`; tarihli değil ya da adımsız ürün `{ program: null }`. Gövde sunucuda `renderDoc` ile kaçışlı HTML'e çevrilir (adr/0019). `Cache-Control: public, max-age=60`. Bakım koruması okuma olduğu için ek gerektirmez.

### 6. Vitrin: `program` bölümü, iki biçim

Ürün sayfası grubunda yeni bölüm türü `program` (`SECTION_REQUIRES`: `program → catalog.booking`; types, backend ve sektör paketi kopyalarında, adr/0077 §8'in ilk kullanıcısı). Kayıtta yalnız `{ id, type, title, variant }` tutulur; adımlar üründen gelir, vitrin `lib/views/program.ts` ile çeker. Biçimler (`SECTION_VARIANTS.program`):

- `timeline` (varsayılan): adımlar dikey bir çizgi boyunca, her adım açık; nokta, etiket, başlık, gövde, etiket çipleri (ikonlu), sağda 4:3 görsel.
- `accordion`: her adım açılır bir satır; başlık bir `button` (`aria-expanded`, `aria-controls`), ilki açık; kapalı adımın metni HTML'de `hidden` olarak durur (betiksiz okunur, arama motoru görür).

Bilinmeyen biçim `timeline` okunur. Bölüm başlığı boşsa "Program". Panel tema düzenleyicisinde bölümün formu yalnız başlık ve "adımlar ürün sayfasından girilir" notudur.

**Basit alternatif:** program girmeyen mağaza hiçbir şey görmez: adımsız ürünün sayfasında bölüm **çizilmez** (boş durum yok); bayrak kapalıysa bölüm "Bölüm ekle"de bile çıkmaz. Program yerine açıklamada serbest metin yazmak her zaman mümkün kalır.

### 7. Panel: ürün sayfasında "Program" kartı

Kalkışlar kartının altında, yalnız bayrak açık ve ürün tarihliyken. RHF + Zod + `useFieldArray`: adım ekle, sil, sürükle-bırak ve yukarı/aşağı düğmeleriyle sırala; etiket, başlık, kısa zengin metin (`RichEditor`, kısa ve çıplak), kütüphaneden görsel, etiket düğmeleri (`aria-pressed`); birim seçimi (Gün / Adım); boş durum metni; Kaydet ve kırmızı Vazgeç (kaydedilmiş hale döner).

### 8. SEO: `TouristTrip.itinerary`

Mağazanın tarihli ürün şema türü `TouristTrip` ise, `TouristTrip` bloğuna `itinerary` eklenir: `ItemList` (`numberOfItems`), her adım bir `ListItem` (`position`, `name` = başlık, `description` = gövdenin düz metni, en çok 300 karakter; metinsiz adımda yok). Program yoksa ya da boşsa `itinerary` yazılmaz. `Event` türünde itinerary yoktur (schema.org'da karşılığı yok). Görseller ve etiketler yapılandırılmış veriye girmez.

### 9. Advisor: `P-CONT-10`

Tarihli ürün programsızsa **bilgi** düzeyinde öneri: "Program ekleyin"; puanı düşürmez (tek günlük etkinliğin programa ihtiyacı olmayabilir). Düzeltme `edit_program`, panelde "Alana git" Program kartına (`product-program`) iner. Tarihli olmayan üründe kural hiç sayılmaz. `RULES_VERSION` 6 → 7; docs/14'e satır eklendi.

## Alternatifler

- **Ayrı `program_step` tablosu.** Reddedildi: adım bazında sorgu ya da ilişki yok; her okuma ve yazma bütün program üzerinde; sıra alanı, toplu yeniden sıralama ve çok satırlı telafi gereksiz karmaşa getirir.
- **Ürün `metadata`'sında serbest JSON.** Reddedildi: Medusa `metadata` şemasız ve her yerden yazılabilir; sunucu denetimi, telafi, denetim kaydı ve tür paylaşımı kurulamaz.
- **Yalnız açıklamada başlıklarla yazmak (ayrı alan yok).** Reddedildi: tema adımı tanıyamaz (zaman çizelgesi, açılır satır), yapılandırılmış veri üretilemez, mağazalar arası düzen tutarsız. Basit yol olarak açık kalır.
- **Görseli kütüphane kimliğiyle saklamak.** Bu iş için ertelendi: kodun geri kalanı adresle saklıyor; kimliğe geçiş ortak bir kararla, bütün görsel alanları için birlikte yapılmalı. Denetim (§4) kimlikle aynı güvenceyi verir.
- **Serbest etiket.** Reddedildi: çeviri ve ikon eşlemesi olmaz; kapalı liste genişletilebilir.

## Sonuçlar

- Tarihli ürün, sayfasında adım adım akışı iki biçimde çizebilir; tur, kurs, atölye ve etkinlik aynı alanı kullanır.
- Bir sütun ve bir migration (`Migration20261124090000`), iki admin ucu, bir mağaza ucu, bir bölüm türü, bir advisor kuralı gelir. Medusa çekirdeği ve mevcut görünümler değişmez: hazır görünümlerde `program` bölümü yok, görünüm kilidi aynı kalır.
- Admin ve mağaza uçları yeni veri taşır; güvenlik incelemesi (security-reviewer) birleşmeden önce gerekir.
- `SECTION_REQUIRES` artık boş değil; panel "Bölüm ekle" grubu ve vitrin ikinci denetimi ilk kez gerçek bir bölümle çalışır.

## Uygulama

- Backend: `lib/booking/program.ts` (şema, okuma, itinerary), `workflows/booking/{program,program-view}.ts`, `api/admin/products/[id]/program`, `api/store/products/[id]/program`, `lib/storefront/sections/program.ts`, `lib/seo/jsonld-dated.ts`, `workflows/seo/dated-facts.ts`, `lib/seo/advisor/rules-product.ts`.
- Paylaşılan: `packages/types/src/store/section-program.ts`, `packages/ui/src/program-views.ts`.
- Tema: `packages/themes/atolye/src/sections/{Program,ProgramAccordion,ProgramParts}.tsx`.
- Panel: `features/products/program/*`, `features/products/api/program.ts`, tema düzenleyicisinde `forms/program-form.tsx` ve bölüm kayıtları.
- Testler: backend birim (`program`, `program-view`, `jsonld-dated`, advisor `engine`, `section-requires`, `permissions`), entegrasyon `integration-tests/http/booking-program.spec.ts`; panel `program-card`, `program-values`; vitrin `atolye-program`, `views/program`, `atolye-media-ground`, görünüm kilidi.

## Takipler

- Turizm görünümlerine (#312) `program` bölümü eklenmesi (ürün sayfası düzeni; görünüm kilidi bilerek yeniden yazılır).
- Yapay zekâ işi "açıklamadan program taslağı": ürün açıklamasından adımları önerir, kişi onaylayıp kaydeder (adr/0071 işi; sade arayüz: kartta tek düğme).
- Voucher ve rezervasyon onay e-postasında programın özeti.
- Panelde adım görselinde ayrı alt metin alanı (bugün kütüphanenin alt metni alınır, adımda ayrıca düzenlenemez).
- Etiket listesinin genişletilmesi (ör. rehber, giriş ücreti) gerçek mağaza ihtiyacıyla.

## Açık sorular

- Program adımlarının dil çevirisi: çok dilli vitrin (docs/13 §11) geldiğinde adım metinleri ürün çevirisiyle mi taşınır?
- Kalkışa göre değişen program (aynı turun yaz ve kış akışı): bugün ürün başına tek program; ihtiyaç gerçek mağazada çıkarsa kalkış düzeyinde geçersiz kılma ayrı ADR.
