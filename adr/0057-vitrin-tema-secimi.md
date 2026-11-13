# ADR-0057: Vitrinin tema paketi derleme anında seçilir (`STOREFRONT_THEME`)

- **Durum:** Kabul edildi (2026-11-04, sahip: "önerine uyarım … başla, yolda revize veririm"; denetim §9 S18'deki öneri: derleme anında, instance başına)
- **Tarih:** 2026-11-04
- **İlgili:** adr/0046 §7 (tema sözleşmesi), adr/0053 §B (tema ayarları), `design.md` (Atölye teması), `docs/tema/denetim-2026-11-04.md` §2

## Bağlam

- Vitrin tek temaya bağlıydı: `src/theme.ts` `baseTheme`'i veriyor, `app/globals.css` base temanın stilini ve kaynağını içe alıyordu.
- İkinci tema (`@qticaret/theme-atolye`, Hallmark Loom) base temaya dokunmadan yanına geliyor. Model instance-per-tenant: her mağazanın kendi vitrin imajı var.
- Tema yalnız sayfalar değil: kendi stil dosyası (Tailwind girişi, token'lar), kendi yazı tipleri ve mağaza ayarlarından hangilerini aldığı da temaya göre değişir.
- Çalışma anında seçim iki temanın CSS'ini ve istemci parçalarını her sayfaya taşır (CSS ve JS bütçesi, docs/21), ya da stil dosyasını istek başına seçmeyi gerektirir. Next'in CSS içe aktarımı derleme anında sabittir.

## Karar

1. **Seçim derleme anında, ortam değişkeniyle:** `STOREFRONT_THEME` (`base` | `atolye`; boş ya da yok: `base`). Bilinmeyen ad derlemeyi (ve `next dev`'i) adlarıyla durdurur; yazım hatası başka temayla yayına çıkmaz.
2. **Tek yer:** `apps/storefront/src/themes/choice.ts` adı okur; `next.config.ts` Turbopack'in `resolveAlias`'ıyla iki adı seçilen temaya bağlar:
   - `@qticaret/storefront-theme` → `src/themes/<ad>.ts` (sayfalar, önyüklenen yazı tipi dosyaları, alınan tema ayarları);
   - `@qticaret/storefront-theme-styles` → `src/themes/<ad>.css` (Tailwind girişi: `@qticaret/ui` stilleri, temanın stili, `app/fonts.css`, `@source`'lar).
   `src/theme.ts` yalnız `@qticaret/storefront-theme`'i okur; başka hiçbir dosya tema paketi adlandırmaz. Birim testleri `vitest.config.ts`'teki takma adla base temayı çalıştırır; temaya özel testler paketi doğrudan içe alır.
3. **Tema girişi (`ThemeEntry`):** `theme` (sözleşmenin sayfaları), `fontPreloads(settings)`, `style(settings)`.
   - Base: bugünkü davranış aynen; mağazanın bütün tema ayarları uygulanır.
   - Atölye: yalnız ana renk (`--primary` ezmesi temanın `--color-signal`'ine akar) ve kart görsel oranı. **Not (2026-11-14):** bu satır adr/0062 ile değişti; Atölye `theme` bölümünün bütün alanlarını uygular, varsayılanlar Grafit görünümüdür (Ek 2026-11-14). Yazı tipi, köşe, düğme, zemin ve vurgu ayarı bu temada basılmaz (sahip kararı 2026-11-04); kendi iki yüzü (Libre Caslon Display, Hanken Grotesk 400/500) `public/fonts`'ta, `app/fonts.css`'te, `THEME_OWN_FONT_FILES`'ta.
4. **Paketler çalışma alanında yan yana:** `packages/themes/base` değişmez. Atölye henüz çizmediği sayfalarda base temanın sayfalarını kendi token'larıyla kullanır (`{ ...baseTheme, … }`); sırayla değiştirilir.
5. **Backend'in `theme` ayarı** (`theme: "base"`, `INSTALLED_THEMES`) şimdilik dokunulmadı: hangi temanın kurulu olduğu imajın kendisidir. Panel temayı göstermek isterse backend bu adı bölümün izinli listesine ekler (ayrı görev).

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Derleme anında, takma adla (seçilen)** | Sayfaya yalnız seçilen temanın CSS'i ve JS'i iner; instance-per-tenant'a uyar; tek yer | Tema değişikliği yeniden derleme ister (mağaza başına imaj zaten ayrı) |
| Çalışma anında, ayar bölümünden (`theme.theme`) | Panelden anında değişir | İki temanın CSS'i ya da istek başına stil seçimi; istemci parçaları iki kat; önizleme ve önbellek karmaşası |
| `src/theme.ts`'te iki paketi de içe alıp seçmek | Basit | İki temanın istemci parçaları derlemede; CSS yine sabit |
| Derleme öncesi dosya üreten betik | Takma ad gerekmez | Üretilmiş dosya depoda ya da gizli adım; geliştirmede unutulur |

## Sonuçlar

- `pnpm --filter @qticaret/storefront dev` base temayla açılır (değişmedi). Atölye: `STOREFRONT_THEME=atolye pnpm --filter @qticaret/storefront dev` (ya da `next build`/`next start` öncesi aynı değişken). F16 imajı bu değişkeni derleme argümanı olarak alır.
- `app/globals.css` → `src/themes/base.css` (içerik aynı, yol düzeltildi).
- Testler: `src/themes/__tests__/choice.spec.ts` (ad okuma, bilinmeyen ad), `app/__tests__/fonts.spec.ts` (temanın kendi yüzleri), Atölye'nin sözleşme çizim testleri.
- Bilinen sınır: Turbopack'e bağlı (`next dev`/`next build` Next 16'da varsayılan). `--webpack` ile derlenirse aynı iki takma ad `webpack.resolve.alias`'a da eklenmeli.

## Ek (2026-11-09): base tema silindi, Atölye tek ve varsayılan tema

Sahip (2026-11-09): "projeyi pnpm dev ile başlattığımda atölye temasından önce base diye bir tema geliyor, o taslağı silebiliriz. 1. temamız atölye olacak."

- **Seçim:** `STOREFRONT_THEMES = ["atolye"]`; `STOREFRONT_THEME` boş ya da yoksa `atolye` (`DEFAULT_STOREFRONT_THEME`). Değişken ve takma ad düzeni gelecek temalar için yerinde kalır; bilinmeyen ad (artık `base` de) derlemeyi yine adlarıyla durdurur. Düz `pnpm dev` vitrini Atölye ile açar.
- **Silinen:** `packages/themes/base` (paket, `./borrow` girişi dahil), `apps/storefront/src/themes/base.ts`, `base.css`, `base-error.ts`; vitrinin ve Atölye'nin `@qticaret/theme-base` bağımlılığı, `transpilePackages` satırı, kilit dosyasındaki girdi, `atolye.css`'teki base `@source` satırları.
- **Atölye'ye taşınanlar** (karar 4'teki "ödünç" bitti; Grafit token'larıyla, tasarımı olmayanlar base'in düzeniyle birebir): `BrandsPage` (`/markalar`), `ConfirmPage` (bağlantı onayı), `CookiePreferencesPage` (`/cerez-tercihleri`, çerez kartının `Choice`'u), `GiftCardBalancePage` (+ `gift/GiftBalanceForm`), `PaymentLinkPage` (+ `payment-link/LinkLines`); sepette `cart/AddonEditor` ve `cart/GiftRecipient` (ürün sayfasının `product/Extras` alanları; `prefix` ve `values` eklendi), siparişte `order/OrderReturns` + `order/ReturnForm` ve `order/OrderGift`. Bu sayfalar `design.md`'de henüz tarif edilmedi; sahip görüp revize verir.
- **Testler:** birim testleri `vitest.config.ts`'te Atölye girişiyle çalışır. Base temanın görünümüne özgü durumlar silindi; uygulama mantığını sınayanlar (iade/hediye kartı iadesi, cayma hakkı, ödeme bağlantısı, sepetteki hediye alıcısı, stok süzgeci, sözleşmenin isteğe bağlı alanları) Atölye'ye çevrildi. Yeni: `atolye-small-pages-theme.spec.ts`.
- **Backend:** `theme` bölümünde `INSTALLED_THEMES = ["atolye"]`, varsayılan `theme: "atolye"`. Kayıtlı `"base"` değeri okunurken ve kaydedilirken `"atolye"` olarak alınır (şema ön işlemi); veri göçü gerekmez, bölüm bir sonraki kayıtta yeni adla yazılır. Diğer ayarların varsayılanları (Fraunces/Inter, sıcak zemin vb.) değişmedi: Atölye onlardan yalnız ana rengi ve kart oranını alır (karar 3). `StoreThemeSettings.theme` ve panelin `ThemeSettings.theme` tipi `"atolye"`.
- `app/fonts.ts`'teki yüz dosyaları (Inter, Fraunces, …) ve `fontPreloads` yerinde kaldı: panelin yazı tipi seçimi ve ileride bu ayarları alan bir tema için.

## Ek (2026-11-14): karar 3'ün Atölye satırı adr/0062 ile değişti

Sahip (2026-11-14): "hepsi vitrinde çalışır. Bugünkü Grafit tasarımının kuralları panelde kayıtlı varsayılan olur."

- Karar 3'teki "Atölye yalnız ana rengi ve kart oranını alır" kuralının ve Ek 2026-11-09'daki "diğer ayarların varsayılanları değişmedi" satırının yerini **adr/0062** aldı: Atölye bütün tema ayarlarını uygular; varsayılanlar bugünkü Grafit görünümüdür (Manrope, `steel` zemin, kare kart, solda yazı markası); adr/0062'den önce saklanan satırlar okurken Grafit'e eşlenir.
- Karar 1, 2, 4, 5 ve tema girişinin biçimi (`ThemeEntry`) değişmedi.
- Geçiş: backend şeması, varsayılanlar ve eşleme yerinde (adr/0062 iş 1). `atolyeSettings` süzgeci, temanın CSS'i ayarları okuyana kadar durur ve sırayla kalkar (adr/0062 Faz 1).
