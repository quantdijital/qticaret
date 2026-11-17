# ADR-0070: "Serbest düzen" alt bilgi: satır, sütun ve bloklar; alt bilgi grubu

- **Durum:** Kabul (sahip, 2026-11-17: öneri onaylandı). Ayrıntılar bu belgede; "Açık kararlar"daki üç madde önerilen varsayılanla ilerler, sahip değiştirirse ilgili PR'dan önce düzeltilir.
- **Tarih:** 2026-11-17
- **İlgili:** adr/0019 (içerik belgesi), adr/0046 (tema sözleşmesi), adr/0048 (mağaza bilgileri tek kaynak), adr/0049 (vitrin yönetimi; Ek 2026-11-14 §2, §5, §6; Ek 2026-11-15 alt bilgi ekleri; Ek 2026-11-17 `brand_columns`), adr/0063 (hazır görünümler, menü seti), adr/0064 (görünüm kitaplığı), adr/0065 (önizleme köprüsü, `fieldMark`), adr/0066 (biçim sözleşmesi), adr/0067 (stil takımı, kilit), docs/04, docs/13, docs/18 §7, `docs/tema/bilesen-standardi.md` §7

## Bağlam

**Sahibin isteği (2026-11-17):** alt bilgiyi WordPress'teki gibi kişiselleştirebilmek: birden çok satır açıp eklenecek içerikleri (sabit yazı vb.) satırlar arasında paylaştırmak; Shopify'daki gibi bloklar.

### Kodda bugün olan (2026-11-17 `dev`, okundu)

- **Alt bilgi ana bölümdür** (`footer_bar`, kimliği sabit `mainfooter`; adr/0049 Ek 2026-11-14 §5): silinmez, gizlenmez, iki biçimi var: `ledger` (varsayılan) ve `brand_columns`. Sözleşme `packages/types/src/store/section-variants.ts` (`SECTION_VARIANTS.footer_bar`) ve `section-footer.ts` (`FOOTER_BAR_SETTINGS`, `PAYMENT_BADGES`, `FOOTER_COLUMNS_*`); backend aynası `apps/backend/src/lib/storefront/sections/footer-bar.ts` ve `sections/main.ts` (`footerLedger`, `footerColumns`: her biçim ayrı `strict` dal, `z.discriminatedUnion("variant")`); eşitlik birim testle korunur.
- **Alt bilgi grubu** (`StoreLayout.footer`, `packages/types/src/store/layout.ts`): yalnız `footer_bar` ve `newsletter` (`layout-sections.ts` `footerSection`), grup sınırı `LAYOUT_LIMITS.footer = 3`, her tür bir kez (`onlyOnce`). Bülten kutusu ayrı çizilmez; `ledger` ve `brand_columns` onu kendi içinde (şeritte) çizer.
- **Menüler** `storefront-menus` modülünde kayıttır (`location: "footer"`, `rank`; en çok 10 alt bilgi menüsü, `MENU_LIMITS.footers`). Vitrin onları `GET /store/storefront-menus` ile okur; önizlemede taslağın menü seti `settings.menus` ile gelir (adr/0063 §3). Hazır görünüm uygulanınca menüler **yeniden yazılır**, kimlikleri değişir (adr/0049 §5 `usage_menu` notu aynı nedenle kimliğe bağlanmaz).
- **Zengin metin** HTML değil, içerik belgesidir (`lib/content/doc.ts` `contentDoc`, izinli düğüm listesi; HTML'i sunucu çizer `render.ts` `renderDoc`). Sınırları ürün açıklaması için geniştir (`DOC_LIMITS`: 20.000 düğüm).
- **Resim** düzen belgesinde yalnız ortam kütüphanesinin kaydıdır (`layout-fields.ts` `image`: depo adresi ya da mağaza yolu; kayıtta kütüphanede olduğu denetlenir, `workflows/storefront/layout-check.ts`, `layout-read.ts` `imageUrls`).
- **Saklama:** düzen `storefront-layout` modülünde `draft`/`published` JSON sütunlarında tek belgedir (`models`: `model.json()`); bölüm ayarları belge içindedir. **Migration gerekmez** (biçim ve alan eklemek önceki eklerde de migration'sız yapıldı).
- **Tema:** `packages/themes/atolye/src/frame/Footer.tsx` (ledger), `FooterColumns.tsx` + `FooterColumnsParts.tsx` (marka bloğu, `details` akordeonlu bağlantı sütunları, ulaşım listesi, logolar), `FooterMarks.tsx`, `FooterSocial.tsx`, `NewsletterForm.tsx`, `SmallPrint.tsx` (yasal metinler, kimlik satırları). Görünüm sözleşmesi `packages/ui/src/main-views.ts` (`FooterBarView`, `FooterColumnsView`), vitrin eşlemesi `apps/storefront/src/lib/views/footer-columns.ts`. Ödeme işaretleri `apps/storefront/public/marks` (kaynak ve kurallar `README.md`).
- **Panel:** `apps/panel/src/features/storefront/editor/forms/footer-bar-form.tsx`, `footer-columns-fields.tsx`, `footer-sketches.tsx`, `payment-badges-field.tsx`; alan kimlikleri `card-field-ids.ts`; ağaç `section-tree.tsx` (alt bilgi sabit satır), bölüm sıralama `section-row.tsx` + `section-list.tsx` (yerel HTML5 sürükle-bırak, tutamaç; aynı iş için ok düğmeleri ve menü: WCAG 2.5.7). Ayar sekmeleri ve grupları `panel-groups.ts` (`panel-groups.spec.tsx` denetler), açıklama `field-hint.tsx` → `InfoTip`.
- **Köprü** (adr/0065 Ek Faz 2b): `fieldMark(on, key)` yalnız canlı oturumda `data-qf` basar; anahtar `BRIDGE_FIELD_KEY` (`packages/types/src/editor-bridge.ts`): en çok 4 parça, parça küçük harfli sözcük ya da 1–2 haneli sayı, 80 karakter. Tekrarlanan parça çizimdeki değil **tasarımdaki yerini** taşır.
- **Kilit:** `pnpm lock:presets` hazır görünümlerin çerçeve, ana sayfa, ürün ve liste HTML'ini ve tema CSS özetini tutar (adr/0067 §3).
- **Çakışma kontrolü (2026-11-17):** `origin/deniz/nextjs-guvenlik` (4 dosya) ve `origin/deniz/video-2-donusturme` (ürün videoları, `adr/0069`) alt bilgi dosyalarına dokunmuyor. E-bülten biçimleri işi (`oguzhan/ebulten-bicimleri`) henüz commit'lenmedi; bülten bloğu o işin biçim listesine bağlanır (aşağıda §4).

### Başkaları nasıl yapıyor (bilinenle; bu ADR yazılırken web'den doğrulanmadı)

- **Shopify (Online Store 2.0, Horizon):** alt bilgi bir **bölüm grubudur** (footer group): içinde birden çok bölüm (alt bilgi, e-posta kaydı, metin…) sıralanır, her şablonda aynı görünür. Horizon'da bölümler "tema blokları"ndan kurulur; bloklar iç içe girebilir (grup bloğu içinde sütunlar), blok türleri temanın `blocks/` klasöründen gelir. Sınırlar bölüm ve blok sayısıyla konur. Güçlü yan: tutarlı blok kataloğu, ayar şeması; zayıf yan: iç içe serbestlik mağaza sahibini boğabilir.
- **WordPress:** klasik temalarda tema "Footer 1–4" gibi sabit **widget alanları** tanımlar, kullanıcı her alana widget (metin, menü, resim…) koyar; blok temalarında alt bilgi, site düzenleyicide "template part"tır ve Grup/Sütunlar/Satır bloklarıyla serbestçe kurulur. Güçlü yan: içerik paylaştırma çok kolay; zayıf yan: sütun sayısı ya tema tarafından sabittir (klasik) ya da sınırsız serbestlik erişilebilirlik ve performans denetimini kaçırır (blok tema).
- **Çıkarılan ders:** Shopify'ın bölüm grubu + blok kataloğu ve WordPress'in "alanlara içerik dağıt" kolaylığı alınır; serbestlik **sınırlı ızgaraya** (satır → hazır sütun oranı → blok) bağlanır, iç içe grup bloğu yoktur.

## Karar

### 1. Yeni biçim `free_rows` ("Serbest düzen")

`SECTION_VARIANTS.footer_bar` = `["ledger", "brand_columns", "free_rows"]`. İskelet değiştiği için yeni **biçim** (adr/0066 §2); `ledger` varsayılan kalır, `brand_columns` aynen seçilebilir, ikisinin çizimine ve çıktısına dokunulmaz. Kayıtlı hiçbir düzen ve hazır görünüm değişmez (kilit HTML'i aynı; yalnız yeni CSS dosyası tema özetine girer).

Ortak ayarlar (`footerBarFields`: `social`, `payment_badges`, yukarı çık) `free_rows`'da da aynı anlamla durur: `social` sosyal blokların çizimini, `payment_badges` ödeme bloğunun ve alt satırın logolarını belirler (tek kaynak; blok bu listeyi ikinci kez tutmaz).

### 2. Veri modeli

Sözleşme yeni dosyada: `packages/types/src/store/section-footer-rows.ts` (alt yol `@qticaret/types/section-footer-rows`); backend aynası `apps/backend/src/lib/storefront/sections/footer-rows.ts` (satır, sütun, sınırlar) ve `footer-blocks.ts` (blok dalları), eşitlik birim testiyle.

**Biçim düzeyi (`free_rows` dalı):**

| Alan | Değerler | Varsayılan |
| --- | --- | --- |
| `ground` | `well` / `page` / `stage` (`FOOTER_COLUMNS_SETTINGS.ground` ile aynı adlar) | `well` |
| `rows` | 1–6 satır | başlangıç düzeni (§2.4) |
| `bottom_badges` | alt satırda ödeme logoları | `true` |
| `badge_style` | `card` / `plain` (koyu zeminde hep kart, `brand_columns` kuralı) | `card` |

**Satır (`FooterRow`):**

| Alan | Değerler | Varsayılan |
| --- | --- | --- |
| `id` | `[a-z0-9]{6,24}`, belgede benzersiz | panel üretir |
| `layout` | `1`, `1-1`, `2-1`, `1-2`, `1-1-1`, `2-1-1`, `1-2-1`, `1-1-2`, `1-1-1-1`, `2-1-1-1` (sütun sayısı oran parçalarının sayısıdır) | `1-1-1` |
| `columns` | dizi, uzunluğu `layout`'un parça sayısına eşit; her sütun `{ blocks: FooterBlock[] }` | — |
| `ground` | `inherit` (biçimin zemini) + `SECTION_LOOK.ground` adları `page` / `well` / `stage` / `primary` | `inherit` |
| `space` | `SECTION_LOOK.space_inner` adları `none` / `small` / `medium` / `large` | `medium` |
| `align` | `start` / `center` | `start` |
| `phone_columns` | telefonda yan yana sütun: `1` / `2` | `1` |
| `divider` | satırın üstünde ince çizgi | `false` |

Sütun 768 px altında alt alta (ya da `phone_columns: 2` ise ikişer) dizilir; 768–1023 px'te en çok iki sütun yan yana, 1024 px'ten oranlar uygulanır. Oranlar CSS sınıfı/`data-layout` ile çizilir (CSP: satır içi `style` yok).

**Blok (`FooterBlock`):** ortak alanlar `id` (aynı kural), `type`, `visible` (vars. `true`), `device` (`SECTION_DEVICES`: `all` / `mobile` / `desktop`; vars. `all`). Türler ve kendi alanları:

| `type` | Panel adı | Alanlar (varsayılan) | Belgede en çok |
| --- | --- | --- | --- |
| `text` | Sabit yazı | `title` (≤60, yok), `body` içerik belgesi (aşağıda) | 8 |
| `menu` | Menü | `slot` 1–10 (alt bilgi menülerinin sırası), `title` (≤60, yok: menünün adı), `collapse_phone` (telefonda açılır kapanır, `true`) | 10 |
| `brand` | Logo ve tanıtım | `logo` (`true`; mağaza profilinin logosu, yoksa ad), `about` (≤240, yok), `social` (`false`) | 1 |
| `newsletter` | Bülten formu | `title` (≤120), `text` (≤240, yok), `variant` (bülten bölümünün biçim listesi; o liste gelene kadar yalnız varsayılan) | 1 |
| `contact` | İletişim ve çalışma saatleri | `title` (yok), `address`, `phone`, `whatsapp`, `email`, `hours` (hepsi `true`; değerler mağaza bilgilerinden, adr/0048; burada yazılmaz) | 1 |
| `social` | Sosyal medya | `title` (yok); hesaplar mağaza bilgilerinden (`same_as`), çizim ortak `social` ayarından | 2 |
| `payments` | Ödeme logoları | `title` (yok), `carriers` (kargo logoları da, `false`); liste ortak `payment_badges`, boşsa sağlayıcıların logoları | 1 |
| `image` | Resim | `image` (yalnız ortam kütüphanesi, `alt` zorunlu ≤300), `width` `small` / `medium` / `full` (`medium`), `link` (menü bağlantı şeması, yok) | 6 |
| `app_badges` | Uygulama mağazası rozetleri | `app_store`, `google_play` (https; yalnız `apps.apple.com` ve `play.google.com`; en az biri) | 1 |
| `trust` | Güvence maddeleri | `limit` 1–4 (`3`), `layout` `list` / `inline` (`list`); maddeler tasarımın ortak `settings.trust_badges` listesinden | 1 |

**Sınırlar (`FOOTER_ROWS_LIMITS`):** satır 6, satır başına sütun 4, sütun başına blok 6, belgede blok 24, yazı bloğunun içerik belgesi 200 düğüm / 1.500 karakter / derinlik 4. Toplam blok sınırı her sayfada basılan HTML'i küçük tutar (her sayfa alt bilgiyi çizer).

**Yazı bloğunun içerik belgesi:** `contentDoc` yeniden kullanılır, üstüne `footerDoc` daraltması: yalnız paragraf, satır sonu, madde/sıra listesi, kalın, eğik, bağlantı (`isSafeHref`); **başlık düğümü ve ürün/kategori kartı reddedilir** (alt bilginin başlık düzeyi blok başlığıdır). HTML'i backend `renderDoc` ile çizer, vitrin yalnız sunucunun HTML'ini basar (rich_text bölümüyle aynı yol).

**Doğrulama hataları** (backend `storefront_layout.*`; panelde `problem-text.ts` üzerinden tr + en):

| Anahtar | Ne zaman |
| --- | --- |
| `footer_rows_limit` | satır > 6 ya da < 1 |
| `footer_blocks_limit` | sütunda > 6 ya da belgede > 24 blok, ya da bir tür kendi üst sınırını aşıyor |
| `footer_columns_mismatch` | `columns` uzunluğu `layout` ile uyuşmuyor |
| `footer_block_invalid` | blok alanı şemaya uymuyor (bilinmeyen tür, aralık dışı `slot`, izinsiz adres, başlık düğümü) |
| `footer_newsletter_twice` | `newsletter` bloğu varken alt bilgi grubunda görünür `newsletter` bölümü de var (sayfada iki bülten formu) |
| `section_duplicate` (var olan) | satır ya da blok kimliği belgede tekrarlıyor |
| `image_invalid` (var olan) | resim kütüphanede değil |

Okuma bağışlayıcıdır (adr/0049 Ek 2026-11-14 §2.3): saklı belgede tanınmayan blok türü ya da sınır dışı fazlalık okumada atılır, kalan çizilir; kayıt sıkıdır.

#### 2.1 JSON örneği (düzen belgesinde)

```json
{
  "id": "mainfooter",
  "type": "footer_bar",
  "visible": true,
  "starts_at": null,
  "ends_at": null,
  "variant": "free_rows",
  "social": "icons",
  "payment_badges": ["visa", "mastercard", "troy"],
  "back_to_top": true,
  "back_to_top_side": "right",
  "back_to_top_shape": "round",
  "back_to_top_mobile": true,
  "ground": "well",
  "bottom_badges": true,
  "badge_style": "card",
  "rows": [
    {
      "id": "satirust01",
      "layout": "1-1",
      "ground": "page",
      "space": "small",
      "align": "start",
      "phone_columns": 1,
      "divider": false,
      "columns": [
        { "blocks": [{ "id": "bultenblok", "type": "newsletter", "visible": true, "device": "all", "title": "Yenilikler e-postanızda", "text": null }] },
        { "blocks": [{ "id": "iletisim01", "type": "contact", "visible": true, "device": "all", "title": null, "address": false, "phone": true, "whatsapp": true, "email": true, "hours": true }] }
      ]
    },
    {
      "id": "satirana01",
      "layout": "2-1-1-1",
      "ground": "inherit",
      "space": "medium",
      "align": "start",
      "phone_columns": 1,
      "divider": true,
      "columns": [
        { "blocks": [{ "id": "markablok1", "type": "brand", "visible": true, "device": "all", "logo": true, "about": "Kısa tanıtım.", "social": true }] },
        { "blocks": [{ "id": "menublok01", "type": "menu", "visible": true, "device": "all", "slot": 1, "title": null, "collapse_phone": true }] },
        { "blocks": [{ "id": "menublok02", "type": "menu", "visible": true, "device": "all", "slot": 2, "title": null, "collapse_phone": true }] },
        { "blocks": [
          { "id": "yaziblok01", "type": "text", "visible": true, "device": "all", "title": "Kargo", "body": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Saat 14.00'e kadar verilen siparişler aynı gün kargoda." }] }] } },
          { "id": "uygulama01", "type": "app_badges", "visible": true, "device": "all", "app_store": "https://apps.apple.com/tr/app/ornek/id000000000", "google_play": null }
        ] }
      ]
    }
  ]
}
```

#### 2.2 Store çıktısı

`GET /store/storefront-layout` `main.footer_bar` içinde `variant: "free_rows"` iken `rows` (ve biçim düzeyi alanlar) hep basılır; görünmeyen blok ve o an geçersiz kalan blok (kütüphaneden silinmiş resim, kırık bağlantı) atlanır, sütun boş kalsa da ızgaradaki yerini korur. Çözülmüş alanlar: `text.body` → `html` (sunucu HTML'i), `image` → `StoreLayoutImage` (türevleriyle), `image.link` → `StoreLayoutLink`. `menu.slot` olduğu gibi gelir: vitrin zaten okuduğu alt bilgi menülerinden (önizlemede `settings.menus`'tan) sıraya göre seçer, ek istek yok. Her bloğa `at` (belgedeki sıra numarası, satır → sütun → blok sırasıyla 0–23) eklenir: köprü anahtarı için (§6). `ledger` ve `brand_columns` çıktısı değişmez.

#### 2.3 Menü kayıtlarıyla ilişki

Menü bloğu bir alt bilgi menüsüne **sıra numarasıyla** (`slot`: Menüler ekranında alt bilgi menülerinin sırası, 1'den) bağlanır, kimlikle değil: hazır görünüm uygulanınca ve taslağın menü seti yayınlanınca menüler yeniden yazılır, kimlikler değişir, sıra kalır (adr/0049 §5 `usage_menu` gerekçesi). Bağlantıların kendisi menü kaydında kalır (tek kaynak, Menüler ekranı); blok bağlantı tutmaz. Olmayan sıraya bağlı blok vitrinde çizilmez, panelde uyarı gösterir ("Bu sırada alt bilgi menüsü yok", Menüler'e bağlantıyla). Menüler ekranında sırayı değiştiren kullanıcıya alt bilgide `free_rows` varsa not gösterilir. Tezgâh paketinin `menus.json`'ındaki alt bilgi menüleri sırayla 1, 2, 3… yuvalarına düşer. `brand_columns`'ın sabit "Yasal metinler" sütunu `free_rows`'da yasal şeride taşınır (§3).

#### 2.4 Başlangıç düzeni ve eski biçimlerden geçiş

- **Backend varsayılanı:** `free_rows` dalında `rows` yoksa (elle yazılmış ya da eksik belge) tek satır `2-1-1-1`: marka, menü 1, menü 2, iletişim. Kayıt bunu belgeye yazar.
- **Panelde biçim değiştirme (öneri, onaylandı sayılır):** "Serbest düzen" seçilince panel mevcut içeriği bloklara **dönüştürerek doldurur**, tek geri alınabilir adımda:
  - `brand_columns`'tan: `top_strip` açıksa üst satır `1-1` [bülten (alt bilgi grubundaki `newsletter` bölümünün başlığı ve metniyle; o bölüm aynı adımda gruptan kaldırılır), iletişim (telefon, WhatsApp, e-posta)]; ana satır [marka (`about`, `social: true`) + mevcut alt bilgi menüsü sayısı kadar menü bloğu, en çok 3; oran 2-1-…]; `ground`, `badge_style`, `payment_badges` aynen. 
  - `ledger`'dan: ana satır [marka, menüler, iletişim]; bülten bölümü varsa üst satırda bülten bloğu.
  - Geri dönüşte (`free_rows` → başka biçim) satırlar kaybolur; panel onay ister ("Satır düzeni kaldırılacak; sürüm geçmişinden geri alınabilir"). Dallar `strict` olduğu için belge iki biçimin alanlarını birlikte tutmaz (biçim kuralı, adr/0049 §2).
  - Dönüştürme yalnız panelde, saf işlevle (`footer-rows-seed.ts`); backend kayıtlı belgeyi asla kendiliğinden dönüştürmez.

### 3. Sabit parçalar: yasal şerit ve alt satır

`free_rows`'da satırların altında her zaman, kaldırılamayan iki parça çizilir:

1. **Yasal şerit:** yasal metin bağlantıları (`SmallPrint`'in listesi, KVKK kısa adıyla), kimlik satırları (`identityLines`: unvan, MERSİS vb.) ve ETBİS karekodu (varsa). Mevzuatın istediği bilgiler mağaza sahibinin satır düzeninden bağımsız durur.
2. **Alt satır:** © yıl + unvan, `bottom_badges` açıksa ödeme (ve kargo) logoları, Çerez tercihleri bağlantısı, yukarı çık bağlantısı (`brand_columns`'ın `BottomLine` deseni ve kırılma kuralları).

Bunlar blok değildir, ağaçta "Alt satır (sabit)" adıyla salt okunur görünür; yalnız `bottom_badges` ve `badge_style` ayarlanır.

### 4. Alt bilgi grubu (Shopify footer group karşılığı)

`StoreLayout.footer`'a bülten dışında da bölüm eklenebilir. İzinli türler: `footer_bar` (ana, sabit), `newsletter` (var olan), **`rich_text`**, **`trust_badges`**, **`marquee`**; her tür en çok bir kez (`onlyOnce` korunur), `LAYOUT_LIMITS.footer` 3 → **5**. Bu bölümlerin şeması sayfa bölümlerininkidir (ikinci kez yazılmaz; `footerSection` birliğine eklenir), çizimi de sayfadaki bileşenlerdir.

- **Yer:** grup bölümleri alt bilgi çubuğunun **üstünde**, gruptaki sıralarıyla çizilir; `footer_bar` hep en altta durur (sıralamada yeri yok, kategori ana bölümünün `placement`siz deseni). `newsletter` bölümü `ledger` ve `brand_columns`'da bugünkü gibi çubuğun içinde çizilir (çıktı değişmez); `free_rows`'da ise diğer grup bölümleri gibi çubuğun üstünde ayrı bant olarak çizilir.
- **Kayan şerit:** alt bilgideki `marquee` her sayfada görünür; adr/0049 §4.1'in sayfa başına şerit sınırına başlıktaki gibi sayılır (`tooManyMarquees` alt bilgi grubunu da okur).
- **Resimli bölümler (`banner`, `hero_slider`) şimdilik yok:** her sayfada görsel yükü ve LCP riski; ihtiyaç doğarsa ayrı ek.
- **Kilit etkisi:** hazır görünümlerin `layout.json`'ları değişmediği sürece HTML kilidi aynı kalır (grup okuma kodu yeni tür görmez). Kilit testine bir "alt bilgi grubunda metin + güvence + şerit" düzeni **test fikstürü** olarak eklenir (hazır görünüm değil), böylece grup çiziminin HTML'i de kilitlenir. Panel ağacında grup satırı "Bölüm ekle" ile bu türleri sunar (`add-section-dialog.tsx`'e grup filtresi).

### 5. Tema çizimi

- `packages/themes/atolye/src/frame/FooterRows.tsx` (iskelet: satırlar, sütun ızgarası, yasal şerit, alt satır) ve `frame/footer-blocks/*.tsx` (her blok ayrı dosya); var olan parçalar yeniden kullanılır: `BrandBlock`, `ReachList`, `MarkList`, `LinkColumns`'ın tek sütunu, `FooterSocial`, `NewsletterForm`, `legalLabel`. `FooterColumnsParts.tsx` 300 satırda olduğu için ortak parçalar ayrı dosyaya çıkarılır (yalnız taşıma, çizim aynı; kilit kanıtlar).
- **Sunucu bileşeni:** bütün bloklar sunucuda çizilir; istemci kodu yalnız bülten formunun var olan parçası. Menü akordeonu `details`/`summary` (betiksiz), 1024 px'ten her zaman açık (`brand_columns` deseni).
- **Görünüm sözleşmesi:** `packages/ui/src/main-views.ts` `FooterBarView.rows?: FooterRowView[]` ve blok görünümleri (`FooterBlockView` birliği); vitrin eşlemesi `apps/storefront/src/lib/views/footer-rows.ts` (menü yuvasını çözer, mağaza bilgilerini bloklara dağıtır, okumada bilinmeyen değeri varsayılana çevirir).
- **CSS:** `footer-rows.css`, `data-layout`, `data-ground`, `data-space`, `data-phone-columns` seçicileriyle; stil takımı belirteçleri (adr/0067). Satır zemini koyu (`stage`/`primary`) iken metin ve odak halkası zeminin ön rengini alır.

### 6. Canlı önizleme ve alan işaretleri

- Alt bilgi bölümü `sectionMark("mainfooter")` taşır (bugünkü gibi); her blok kendi kutusunda `fieldMark(editor, "blocks.<at>")`, blok alanları `blocks.<at>.<alan>` (ör. `blocks.4.title`, `blocks.7.image`); satır ayarı `rows.<n>` (n 0–5). Anahtarlar `BRIDGE_FIELD_KEY`'e sığar (3 parça), regex değişmez.
- Panelde `card-field-ids.ts` deseninde `FOOTER_ROWS_FIELD_IDS` (blok sırası → panel alan kimliği) ve `preview-fields.ts` eşlemesi: önizlemede bloğa tıklayınca ağaçta blok açılır ve alan odaklanır; panelde alan odaklanınca önizleme kutusu vurgulanır. Sürükle-bırakla blok yer değiştirince `at` yeniden hesaplanır (tasarımdaki yer).
- Anında yansıma adr/0065 §3'ün yolundan: taslak kaydı → önizleme yenilemesi; yeni bir yeniden çizim yolu yok.

### 7. Panel düzenleyici

- **Ağaç:** "Alt bilgi" grubunda `free_rows` iken ana bölüm satırı açılır: **Satır › Sütun › Blok** hiyerarşisi (`role="tree"` değil, bugünkü iç içe `ul` + başlıklı grup deseni; her düzey girintili, adı "Satır 2 · 3 sütun", "Sütun 1 · geniş", blok adı + kısa ayrıntı). Satır sonunda "Satır ekle", sütun sonunda "Blok ekle" (blok türü seçici, küçük çizimli; tür sınırı dolmuşsa seçenek kapalı ve nedeni yazılı). En altta salt okunur "Yasal şerit ve alt satır (sabit)".
- **Taşıma:** satırlar ağaçta sürüklenerek sıralanır; bloklar sütun içinde ve **sütunlar/satırlar arasında** sürüklenir (yerel HTML5 sürükle-bırak, `section-row.tsx` tutamaç ve "önüne/arkasına" deseni; boş sütun bırakma hedefi). **Klavye ve tek işaretçi alternatifi** (WCAG 2.1.1, 2.5.7): her satır ve blokta "Yukarı / Aşağı" düğmeleri ve menüde "Taşı…" → hedef satır ve sütun seçen küçük iletişim kutusu; her taşımadan sonra `aria-live="polite"` duyuru ("Sabit yazı, Satır 2 Sütun 3'e taşındı"). Durum işlemleri saf işlevlerde (`footer-rows-ops.ts`: ekle, sil, çoğalt, satır taşı, blok taşı, sütun düzeni değiştir) ve editör `dispatch`'inde tek eylem, geri al ile.
- **Sütun düzeni değişince:** sütun azalırsa fazla sütunların blokları son kalan sütuna eklenir (blok kaybolmaz); panel bunu bildirir.
- **Formlar:** satır formu (Düzen: oran seçici küçük çizimlerle; Stil: zemin, aralık, hiza, üst çizgi; Telefon: yan yana sütun) ve blok formu. Blok ayarları **İçerik / Stil / Gelişmiş** sekmelerinde (adr/0065 Ek 2026-11-16); Gelişmiş: görünürlük, cihaz. Her alan `panel-groups.ts`'te sekmesini ve grubunu bildirir; açıklama gereken alanda `InfoTip` (`field-hint.tsx`). Yazı bloğu panelin var olan içerik düzenleyicisini başlık ve kart araçları kapalı olarak kullanır. Resim yalnız `image-field.tsx` (ortam kütüphanesi). Menü bloğu yuvaları menü adlarıyla listeler.
- **Ayar araması:** satır ve blok alanları aramada bulunur (`settings-search.ts`), sonuç ağaçta ilgili düğümü açar.
- **Dosya sınırı:** `apps/panel/src/features/storefront/editor/footer-rows/` klasörü; her dosya ~300 satır altında.

### 8. Güvenlik, performans, SEO, erişilebilirlik

- **Güvenlik:** HTML girişi yok; yazı bloğu içerik belgesi (izinli düğüm listesi, `isSafeHref`), HTML'i sunucu çizer. Bağlantılar menü bağlantı şeması (`storefrontLink`: kayıt kimliği, mağaza yolu ya da https). Uygulama rozeti adresleri https ve yalnız iki mağaza alan adı. Resim yalnız kütüphane kaydı (kayıtta denetlenir). Bütün düz metinler `isCleanText`. Belge boyutu blok ve düğüm sınırlarıyla sınırlı. Yeni uç yok; kayıt yolu ve yetki aynı.
- **Performans:** her sayfada çizildiği için: 24 blok sınırı, ek ağ isteği yok (menüler, mağaza bilgileri, güvence listesi zaten okunuyor), resimler `loading="lazy"` ve sütun oranına göre `sizes`, istemci JS'i yalnız bülten formu. Kabul: Lighthouse'ta alt bilgisi `free_rows` olan ana sayfa, `brand_columns`'a göre toplam JS'te artış göstermez; HTML artışı 24 bloklu düzende ölçülüp PR'a yazılır (docs/21).
- **SEO:** alt bilgi bağlantıları normal `<a href>` (menü blokları `nav`), dahili bağlantıya `nofollow` yok; dış bağlantı `rel="noopener noreferrer"`. Başlık düzeni: sayfanın `h1`'i alt bilgide yok; blok başlıkları `h2` (alt bilgi kendi bölümüdür, `brand_columns` ile aynı), yazı bloğunda başlık düğümü yasak. JSON-LD değişmez.
- **Erişilebilirlik:** tek `<footer>` (contentinfo); her menü bloğu `<nav aria-labelledby>`; okuma sırası DOM sırasıdır (satır → sütun → blok), görsel yeniden sıralama (`order`) yok; akordeon `details`/`summary`; koyu zeminde karşıtlık ve odak halkası; resim bloğunda `alt` zorunlu (bağlantılıysa bağlantının adı). Panelde sürükle-bırakın klavye alternatifi ve canlı duyuru (§7).

## Alternatifler

| Seçenek | Neden seçilmedi |
| --- | --- |
| **`brand_columns`'a ayar eklemek** (satır sayısı, sütun içerikleri) | İskelet değişiyor; adr/0066 §2 ve biçim sözleşmesi gereği yayımlanmış biçimin çizimi yerinde değişmez. Ayar sayısı da biçimin anlamını boğar. |
| **Shopify Horizon gibi iç içe genel blok ağacı** (grup bloğu içinde grup) | En esnek ama erişilebilirlik ve performans denetimi zorlaşır, panelde ağaç derinleşir, mağaza sahibi boğulur; satır › sütun › blok bugünkü ihtiyacı karşılıyor. Gerekirse ileride `group` bloğu eklenebilir (yeni alan, eski anlam değişmez). |
| **WordPress klasik widget alanları** (sabit 4 sütun, her sütuna blok) | Satır yok, oran yok; sahibin "birden fazla satır" isteğini karşılamaz. Bizim modelimizin tek satırlı özel durumu. |
| **Satırları ayrı bölüm türü olarak alt bilgi grubuna koymak** (her satır bir bölüm) | Ana bölümün tek kimliği ve sabit yeri dağılır, yasal şerit ve alt satırın sahibi belirsizleşir, blokların satırlar arasında taşınması iki bölüm arasında taşımaya döner. Grup bölümleri (§4) bunun yerine bütün genişlikte bantlar içindir. |
| **Menü bağlantılarını bloğun içinde tutmak** | Menüler ekranıyla iki kaynak olur; hazır görünüm menü setiyle çalışan akış (adr/0063 §3) bozulur. |

## Sonuçlar

- Mağaza sahibi alt bilgiyi satır, sütun ve blokla kurabilir; mevcut iki biçim ve bütün kayıtlı görünümler aynen kalır.
- Migration yok: alanlar düzen belgesinin JSON'unda, yeni biçimin dalında.
- Sözleşme dosyası ve backend aynası birer yeni dosya; eşitlik testi gibi tek kaynak kuralları sürer.
- Panelde ilk kez iç içe (üç düzeyli) düzenlenebilir ağaç; sürükle-bırak ve klavye alternatifi ortak bir parça olarak yazılır, ileride başka bölümler (slayt, SSS) de kullanabilir.
- Menü bloğu sıraya bağlı olduğundan Menüler ekranında sıra değişimi alt bilgiyi etkiler; bu not edilir (§2.3).
- Alt bilgi grubu açıldığı için grup çizimi kilide fikstürle girer; hazır görünüm kilidi değişmez.
- Bülten bloğu, e-bülten bölümünün biçimleri dev'e girince onların listesine bağlanır; o zamana kadar varsayılan çizim.

## Açık kararlar (önerilen varsayılanla ilerler)

1. **Menü bloğunun bağı:** sıra numarası (öneri; hazır görünüm ve menü seti yayınından sağ çıkar) mı, menü adı mı? Ad değişince kopar; kimlik yayında değişir. Öneri: sıra.
2. **Tezgâh görünümleri `free_rows`'a geçsin mi?** Öneri: üç Tezgâh görünümü (PR-5) `brand_columns` içeriğinin dönüştürülmüş haliyle `free_rows`'a geçer, görünüm `version`'ı artar, kilit bilerek yeniden yazılır; Katalog ve Grafit değişmez. Görünümü önceden uygulamış mağazaların kendi düzeni değişmez.
3. **Uygulama mağazası rozetleri:** Apple ve Google'ın resmî rozetleri kendi kullanım kurallarıyla (değiştirilmeden, Türkçe sürümleri) `public/marks`'a kaynak notuyla eklenir (öneri). Lisans notu netleşmezse blok PR-2'den çıkarılıp sonraya kalır, sözleşmede tür yine durur.

## Uygulama sırası

Her PR `dev`'den kısa ömürlü `oguzhan/<konu>` dalında; sözleşme önce, sonra backend, sonra tema, sonra panel. Ödeme/auth/migration dokunmaz; PR-1 ve PR-4 kayıt doğrulamasını genişlettiği için `security-reviewer` koşulur ve bulgular PR'a yazılır.

### PR-1: sözleşme + backend doğrulama + çıktı (`oguzhan/serbest-altbilgi-sozlesme`)

- **Dosyalar:** `packages/types/src/store/section-footer-rows.ts` (+ `package.json` alt yol ihracı), `section-variants.ts` (`free_rows`), `layout.ts`/`section-main.ts` store tipleri; backend `lib/storefront/sections/footer-rows.ts`, `footer-blocks.ts`, `variants.ts`, `main.ts` (`footerFreeRows` dalı, `MAIN_BRANCHES`), `lib/content` içinde `footerDoc` daraltması, `layout-main.ts` (çıktı: `rows`, `at`, çözülmüş `html`/resim/bağlantı), `workflows/storefront/layout-check.ts` + `layout-read.ts` (blok resimleri ve bağlantıları denetime ve çözüme), panel/backend hata anahtarları (tr + en).
- **Testler:** sözleşme–ayna eşitlik birim testi; şema birim testleri (her sınır, `columns_mismatch`, başlık düğümü reddi, izinsiz alan adı, kimlik tekrarı, `newsletter_twice`, bağışlayıcı okuma); `storefront-layout-main.spec.ts` http testi `.env`'li ortamda (kayıt, çıktı, kütüphane dışı resim reddi).
- **Kabul:** `ledger`/`brand_columns` çıktısı bayt bayt aynı (var olan testler değişmeden yeşil); hazır görünümlerin doğrulama testi yeşil; migration yok.

### PR-2: tema çizimi + vitrin eşlemesi (`oguzhan/serbest-altbilgi-tema`)

- **Dosyalar:** `packages/ui/src/main-views.ts` (görünümler), `apps/storefront/src/lib/views/footer-rows.ts`, `packages/themes/atolye/src/frame/FooterRows.tsx`, `frame/footer-blocks/*`, ortak parçaların taşınması (`FooterColumnsParts.tsx` bölünür), `footer-rows.css`, `Footer.tsx` biçim seçimi; uygulama rozeti dosyaları ve `public/marks/README.md` (açık karar 3).
- **Testler:** vitrin birim testleri (`atolye-footer-rows.spec.ts`: her blok, boş sütun, bilinmeyen değer, menü yuvası yok, cihaz görünürlüğü, `fieldMark` yalnız editörde), `pnpm lock:presets` **değişmeden** yeşil (yalnız yeni CSS'in tema özeti: komutla yeniden üretilir, PR'a yazılır), `pnpm style:capture/diff` mevcut görünümlerde fark yok.
- **Kabul:** bileşen deneme sayfasında 1–4 sütun, üç zemin, 24 blok; 1440/1024/768/390, Chromium + WebKit: taşma yok, akordeon klavyeyle çalışıyor, odak sırası DOM sırası, koyu satırda karşıtlık AA; kareler PR'a.

### PR-3: panel düzenleyici (`oguzhan/serbest-altbilgi-panel`)

- **Dosyalar:** `apps/panel/src/features/storefront/editor/footer-rows/` (ağaç düğümleri, `footer-rows-ops.ts`, `footer-rows-seed.ts`, sürükle-bırak ve "Taşı…" iletişim kutusu, satır formu, blok formları, blok kataloğu), `section-tree.tsx` (alt bilgi düğümü), `footer-sketches.tsx` (biçim + oran çizimleri), `card-field-ids.ts`/`preview-fields.ts`, `panel-groups.ts`, `settings-search.ts`, çeviri dosyaları (`storefront.editor.footerRows.*`).
- **Testler:** `footer-rows-ops.spec.ts` (her işlem, sütun azalınca blok korunması, tür sınırları), `footer-rows-seed.spec.ts` (`brand_columns` ve `ledger`'dan dönüşüm), `footer-rows-tree.spec.tsx` (klavyeyle taşıma, "Taşı…", canlı duyuru, tür sınırı dolunca kapalı seçenek), `panel-groups.spec.tsx`, önizleme alan eşleme testleri.
- **Kabul:** canlı önizlemede bloğa tıklayınca ağaçta açılıyor, alan odakta; sürükle-bırak ve klavyeyle aynı sonuç; geri al tek adım; tarayıcıda (Chromium + WebKit) panelde 1440 ve 768'de kontrol.

### PR-4: alt bilgi grubu bölüm türleri (`oguzhan/altbilgi-grubu`)

- **Dosyalar:** backend `layout-sections.ts` (`footerSection` birliğine `rich_text`, `trust_badges`, `marquee`), `layout-fields.ts` (`footer: 5`), `layout.ts` (`tooManyMarquees` alt bilgiyi okur), `layout-read.ts`; tipler `StoreLayout.footer`; tema/vitrin grup bölümlerini çubuğun üstünde çizer, `free_rows`'da bülten bandı; panel ağaç ve `add-section-dialog.tsx` grup filtresi; kilit testine grup fikstürü.
- **Testler:** şema (tür tekrarı, sınır 5, şerit sınırı), vitrin grup çizimi, kilit fikstürü (yeni kilit girdisi komutla), hazır görünüm kilitleri değişmeden yeşil.
- **Kabul:** var olan düzenlerin çıktısı aynı; yeni bölümler her sayfada (ödeme sayfası hariç, çerçevenin bugünkü kuralı) çiziliyor.

### PR-5: Tezgâh'a uygulama + kilit (`oguzhan/tezgah-serbest-altbilgi`)

- **Dosyalar:** `packages/sector-packs/packs/cutlery/presets/tezgah*/layout.json` (`free_rows`, dönüştürülmüş içerik), `preset.json` `version` artışı, paket `version`; kilit dosyaları `pnpm lock:presets` ile.
- **Testler:** hazır görünüm doğrulama testi, kilit (bilerek yeniden yazıldı; etkilenen görünümler PR'da), `style:capture/diff` (yalnız alt bilgi farkı).
- **Kabul:** sahip açık karar 2'yi değiştirmediyse; üç Tezgâh görünümü 1440/768/390'da Chromium + WebKit kontrol edildi, kareler PR'a.
