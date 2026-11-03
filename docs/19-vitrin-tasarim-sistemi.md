# 19 — Vitrin Tasarım Sistemi

> Vitrinin (`apps/storefront`, adr/0046) bileşenleri, token'ları, çerçevesi ve sayfa envanteri.
> Amaç: sektörden bağımsız, profesyonel ve sade bir mağaza; hızlı, erişilebilir, arama motoru ve yapay zekâ ajanları için okunur.
> Bu belge inceleme ölçütüdür: yeni her vitrin ekranı §6 kurallarından ve §9 kontrol listesinden geçer.

---

## 1. Yığın

| Katman | Seçim | Neden |
| --- | --- | --- |
| Uygulama | Next.js 16 App Router, React 19, TypeScript strict | Sunucuda üretilen sayfa; SEO verisi ilk HTML'de (adr/0046) |
| Stil | Tailwind v4 (CSS-first) | Token'lar CSS değişkeni; tema değerleri değiştirir |
| Bileşen | shadcn/ui (new-york, Radix), `@qticaret/ui/components/*` | Panelle aynı sürümler; kod bizde; her tema paylaşır |
| İkon | lucide-react | Tek set; marka ikonları yok (sosyal bağlantılar yazıyla) |
| Yazı tipi | Varsayılan Fraunces + Inter; mağaza seçebilir: Playfair Display, DM Serif Display, Manrope, Source Sans 3, Nunito (kendi sunucumuzdan `public/fonts`, `app/fonts.css`; yüz başına `latin` + Türkçe harfler dosyası; yalnız mağazanın seçtiği iki yüz önyüklenir, docs/21) | Türkçe karakterler tam (Ğ ğ İ ı Ş ş ₺); tarayıcıdan Google'a istek gitmez (KVKK), CSP `font-src 'self'` |
| Formlar | Sunucu eylemleri (Server Actions) + yerel form öğeleri | Sayfanın betiği yüklenmeden de çalışır |
| Test | Vitest (görünüm modelleri), Playwright (e2e, ekran karşılaştırma), axe | §9 |

Sürümler exact ve ≥14 gün kuralıyla (docs/04).

## 2. Görsel dil

**Bir cümleyle (2026-11-02):** sıcak kemik rengi zemin (`#f6f4ef`), beyaz kartlar, koyu mürekkep bantlar (alt bilgi, "bize ulaşın"), başlıklarda yumuşak serif (Fraunces), metinde Inter; birincil eylem mağazanın rengi.

> Kullanıcı 2026-11-02: "tasarıma çok odaklanma, sadece işlevsel yapıların hepsini kurgulamaya devam et; basic şekilde max hız max güvenlik ve max işlevsellik; tasarımı sonradan bizzat yapacağız." Bu bölüm şimdiki taban görünümü anlatır; tasarım kullanıcıyla yeniden ele alınacak. Yeni ekranlar sade ve işlevsel yazılır.

- **Görsel önce:** ürün kartı 4:5 görsel, `rounded-2xl`, beyaz kart; görsel yoksa adın ilk harfi serifle silik.
- **Renk:** birincil eylem `--primary` (mağazanın rengi; varsayılan mürekkep). Kırmızı (`--sale`) yalnızca indirimde, yeşil (`--success`) yalnızca stok ve başarıda; koyu bantlar `--ink`.
- **Tipografi:** `h1`, `h2` Fraunces (`opsz`, `SOFT`), ürün adları ve gövde Inter; tutarlar `.tabular`.
- **Köşe:** düğmeler, haplar ve form alanları `rounded-button` (varsayılan tam yuvarlak; mağaza `rounded` ya da `square` seçebilir), kartlar `rounded-2xl/3xl` (mağazanın köşe ölçeğiyle); rozet, sayaç ve simge daireleri `rounded-full` kalır.
- **Hareket:** yalnızca hover ve açılır katmanlarda; `prefers-reduced-motion` saygı görür. Kendiliğinden kayan içerik yok (WCAG 2.2.2).
- **Odak:** klavye kullanıcısı her zaman nerede olduğunu görür (`:focus-visible`). Panelin "odak çerçevesi yok" kuralı vitrine uygulanmaz.

## 3. Token'lar

Adlar shadcn/ui'ninkidir; bağlantı `packages/ui/src/styles.css`'te, değerler temanın `styles.css`'inde (`:root`).

| Token | Kullanım |
| --- | --- |
| `--background`, `--foreground` | Sayfa zemini ve metin |
| `--card`, `--popover` | Kart ve açılır katman |
| `--primary`, `--primary-foreground` | Birincil düğme, sepet sayacı |
| `--secondary`, `--muted`, `--accent` (+ `-foreground`) | Nötr yüzeyler, ikincil metin, hover |
| `--border`, `--input`, `--ring` | Çizgi, form kenarı, odak |
| `--destructive` | Hata uyarısı |
| `--sale`, `--sale-foreground` | İndirimli fiyat, indirim rozeti |
| `--success` | Stokta, sepete eklendi |
| `--announcement`, `--announcement-foreground` | Duyuru şeridi |
| `--highlight`, `--highlight-foreground` | Rozet ve vurgu (sepet sayacı, giriş noktası); mağazanın `accent`'i, yoksa `--primary` |
| `--radius` | Köşe ölçeği (`sm`/`md`/`lg`/`xl` ondan türer) |
| `--radius-scale` | Bütün köşe ölçeğinin çarpanı: `soft` 1, `sharp` 0,2, `round` 1,5 |
| `--button-radius` | Düğme ve düğme gibi bağlantıların köşesi (`rounded-button`): `pill` tam, `rounded` 0,75rem, `square` 0 |
| `--card-ratio` | Ürün kartı görselinin oranı (`aspect-card`): 4 / 5, 1 / 1, 3 / 4 |
| `--font-sans`, `--font-heading` | Gövde ve başlık yazı tipi |

Kontrast (WCAG AA 4.5:1) temanın `styles.css` başında hesaplı yazılır. Mağazanın tema ayarları (adr/0053 §B) bu değişkenleri `:root`'ta ezer: `lib/views/theme.ts` ayarı denetler (bilinmeyen değer varsayılana düşer, renk yalnız `#rrggbb`) ve yalnız varsayılandan farklı olanları yanıtın nonce'lu tek `<style>`'ına yazar; varsayılanlarda hiçbir şey basılmaz, görünüm bugünküdür. Zemin `warm` `#f6f4ef`, `neutral` `#f5f5f5`, `cool` `#f3f5f8` (backend `THEME_BACKGROUNDS` ile aynı; karşıtlık denetimi bunları okur); `neutral` ve `cool` kendi nötr yüzeylerini, çizgilerini ve ikincil metin rengini de getirir (ikincil metin zeminde ≥ 6,4:1).

## 4. Çerçeve (her sayfada)

Mağaza panelden yazar: `platform-settings` `storefront` bölümü, `GET /store/storefront` (F18 D3). Yasal kimlik ve iletişim `GET /store/legal-identity`'den.

| Parça | Kaynak | Not |
| --- | --- | --- |
| Duyuru şeridi | `storefront.announcements` (≤5) | Telefonda ilk satır, geniş ekranda hepsi |
| Üst bağlantılar | Vitrin > Menüler, `top` menüsü (adr/0049) | Geniş ekranda başlığın üstünde; telefonda menü çekmecesinde |
| Telefon | `store.contact_phone` | Üst satırda ve alt bilgide `tel:` bağlantısı |
| Logo / ad | `appearance.logo_light_url` / mağaza adı | |
| Arama | `GET /arama?q=` | Betiksiz form; sonuçlar `noindex,follow` |
| Sepet | çerez + `GET /store/carts/:id` | Sayaç; `/sepet` |
| Kategori menüsü | Vitrin > Menüler, `main` menüsü (≤30 bağlantı × 20 alt bağlantı; bağlantılar kayda bağlı, adı ve adresi kayıttan, yayında olmayan gizli; adr/0049); menü yoksa kategori ağacı (iki seviye) | Geniş ekranda açılır menü (Radix, içerik `forceMount` ile HTML'de), telefonda çekmece |
| Tema ayarları | `GET /store/storefront` `theme` (adr/0053 §B; yoksa `storefront.primary_color`) | Ana renk `--primary`, `--ring`, `--announcement` ve üzerindeki yazı rengi (beyaz ya da mürekkep, kontrasta göre); `accent` `--highlight`; zemin, yazı tipleri (`<html>`'de seçilen iki yüzün sınıfı), köşe, düğme ve kart oranı §3'teki değişkenlerle; yanıtın nonce'uyla tek `<style>`. Biçimi değiştirenler `ShopView.theme`'de: üst bilgi `centered` (logo ortada) ya da `left` (logo başta, arama ortada, kategoriler soldan), `sticky`; kartta marka (`show_brand: false` ise vitrin kartın görünüm modeline markayı koymaz) ve yıldız (`show_rating`; kartın görünüm modelinde `rating` varsa; liste satırları puan taşımadığı için bugün boş) |
| Ana sayfa girişi | `storefront.hero` (üst yazı, başlık, metin, ≤2 düğme) | Yazılmamışsa mağaza adı ve ilk iki kategori |
| Güven şeridi | `storefront.trust_badges` (≤4, ikon listesi sabit) | Alt bilginin üstünde |
| Alt bilgi sütunları | Vitrin > Menüler, `footer` menüleri (sırasıyla; adr/0049) | Yazılmamışsa: ilk 8 kategori + Yardım (Sepetim) |
| İletişim, sosyal | `legal-identity` (`email`, `phone`, `address`, `same_as`) | Sosyal profiller ağ adıyla |
| Küçük yazı | `legal.company_title` | "© yıl unvan" |
| WhatsApp | `storefront.whatsapp_phone` | Sağ altta düz bağlantı (`wa.me`); telefonda alt gezinmenin üstünde |
| Mobil alt gezinme | `ShopView.bottomNav` (proxy'nin `x-qt-url`'inden) | 1024 px altında sabit alt çubuk: Ana sayfa, Kategoriler (menü çekmecesini açar; betiksiz `/kategoriler`), Ara (`/arama`), Sepet (sayaçlı; ad "Sepet, N ürün"), Hesabım. Bulunulan öğe `aria-current="page"` ve üst çizgiyle. Yüksekliği sayfanın sonunda ilk HTML'den ayrılır (kayma yok, alt bilgi altında kalmaz), telefonun alt güvenli alanı kadar boşluk. `/odeme*`, `/onizleme/*` ve `/bakim/*`'da yok |

Bağlantılar yalnızca mağaza yolu (`/…`) ya da `https://` adres olabilir; `javascript:`, `//host`, kimlik bilgili adres reddedilir (backend şeması ve testi).

## 5. Klasörler

```
packages/ui/
├── components.json            # shadcn (new-york, rsc)
├── src/components/*.tsx       # shadcn üretimi, bizim sahipliğimizde
├── src/lib/utils.ts           # cn()
├── src/styles.css             # token → Tailwind bağlantısı, temel katman
├── src/theme.ts, views.ts     # tema sözleşmesi ve görünüm modelleri
packages/themes/base/src/
├── Layout.tsx, *Page.tsx      # sözleşmenin sayfaları
├── layout/                    # çerçeve: AnnouncementBar, SiteHeader, CategoryNav, MobileMenu, SearchForm, SiteFooter, WhatsAppButton, BottomNav
├── components/                # ProductCard, Price, Breadcrumbs, Pages, ProductGallery, PurchasePanel, OptionPicker, QuantityField, AddonFields, LineAddons, TrustStrip, Container
└── styles.css                 # temanın token değerleri
apps/storefront/src/
├── app/                       # rotalar (sistem sayfaları sabit, gerisi [...path])
├── screens/                   # varlık türüne göre sayfa verisi
├── lib/views/                 # Store yanıtı → görünüm modeli (saf, testli); theme.ts tema ayarı → CSS
├── lib/maintenance/           # bakım: açık yollar, Retry-After, jeton biçimi, 503 sayfası, proxy kapısı
├── lib/analytics/             # dönüşüm olayları: izin kapısı, olay yükleri, GA4/Meta yükleyicisi, track()
├── lib/refresh/               # backend'in imzalı "yenile" sinyali: denetimler, kapsam → önbellek
└── lib/store-api/             # BFF istemcisi (paylaşılan önbellekler `registry.ts`'te, süreç geneli)
```

shadcn bileşeni eklemek: `cd packages/ui && pnpm exec shadcn add <ad>`. CLI'nin eklediği `cn` paketi ve `from "cn"` içe aktarması geri alınır (`@qticaret/ui/lib/utils`). Ekran okuyucu metinleri (Close, Previous…) prop olur; İngilizce varsayılan bırakılmaz.

## 6. Bileşen kuralları

1. **Tema yalnızca sunar** (adr/0046 §7): veri çekmez, SEO yazmaz, durum kodu belirlemez; görünüm modeli ve `t` ile çağrılır.
2. **Metin anahtarla:** her görünen ve ekran okuyucuya söylenen söz `tr.json`'dan. İstemci bileşenine `t` geçmez; çevrilmiş metin prop olarak gider.
3. **Sunucu önce:** bileşen varsayılan olarak sunucu bileşenidir. `"use client"` yalnızca durum ya da tarayıcı API'si gerektiğinde (menü, çekmece, seçenek seçimi, adet).
4. **Betiksiz çalışır:** sepete ekle, sepet adedi, kaldır, arama, sıralama ve sayfalama düz form ya da bağlantıdır. Sepet satırında eksi/artı formun kendi gönderme düğmeleridir.
5. **İçerik gizlenmez:** açıklama, özellikler, alt kategori bağlantıları ilk HTML'dedir. Radix `Tabs`/`Accordion` kapalı içeriği DOM'dan çıkarır; SEO metni için kullanılmaz (ya `forceMount` ya `<details>`). Menüde alt kategoriler `forceMount` ile HTML'de.
6. **Gerçek öğeler:** bağlantı `<a href>`, eylem `<button>`, seçenek `<input type="radio">` (ajan dostu HTML, docs/13).
7. **Görsel:** `ResponsiveImage` (`<picture>`, AVIF/WebP). Yalnızca LCP görseli `priority`; ızgarada ilk satır.
8. **Biçimlendirme storefront'ta:** fiyat, indirim yüzdesi, telefon görünüm modelinde biçimlenir (`lib/views`); tema sayı biçimlendirmez. Tek istisna ürün sayfasının ek seçenek canlı toplamı (adr/0052): tarayıcıda hesaplanır, sözleşmenin `formatLira`'sıyla yazılır, yalnız gösterimdir.
9. **Dosya ≤ ~300 satır;** büyüyen sayfa `components/` ya da `layout/` altına bölünür.
10. **Satır içi `style` yok:** üretimdeki CSP (`style-src 'self' 'nonce-…'`) HTML'deki `style` niteliğini reddeder. Değişken genişlik gibi değerler sabit sınıf adlarıyla verilir (ör. sepet kargo çubuğu 5'lik adımlar).

### 6.9 Kaydırılabilir kutular (2026-11-03)

İçinde odaklanılabilir öğe olmayan ama kaydırılabilen her kutu (ürün görsel şeridi, bağlantısız afiş satırı, sözleşme metni kutusu) tek bir sekme durağı olur: `tabIndex={0}` + `role="region"` (ya da etiketli `section`) + `aria-label`; odak halkası yalnız klavye modunda, ekran kenarına dayanan şeritte içeri çizilir. İçinde zaten bağlantı/düğme olan şerit ikinci durak almaz (axe `scrollable-region-focusable`).

## 7. Sayfa envanteri

Durum: ✅ var · 🟡 temel hâli var · ⬜ yok. Görev kodları PROGRESS "F18 görev planı".

| Sayfa | Yol | Durum | Backend | Görev |
| --- | --- | --- | --- | --- |
| Çerçeve: duyuru, başlık, menü, arama, alt bilgi (yasal bağlantılar, MERSİS/KEP/ETBİS satırı, e-bülten kutusu), WhatsApp | her sayfa | ✅ | `storefront`, `storefront-menus`, `legal-identity`, `legal/{kind}`, `newsletter` (çift onay) | D3, D10 |
| Ana sayfa | `/` | 🟡 giriş, kategori dizini, yeni ürünler, "bize ulaşın", blogdan | ana sayfa blokları (D11) yok | D11 |
| Kategori, marka, koleksiyon, landing | URL kaydına göre | ✅ filtreler (marka, öznitelik), fiyat aralığı, fiyat/yeni sıralama, sayfalama | `GET /store/listings/products` | D4 |
| Tüm ürünler | `/magaza` | ✅ filtreler, sıralama | liste ucu `type=all` | D4 |
| Kampanyalı ürünler | `/kampanyalar` | ✅ liste ekranı (filtre, sıralama, sayfalama), kartlarda üstü çizili fiyat ve indirim rozeti; başlık ve robots resolve'dan (indirimde ürün yokken `noindex,follow`, "Şu an indirimde ürün yok") | resolve `entity_type: "sale"`, liste ucu `type=sale&id=sale` (adr/0019 Ek 2026-11-03) | docs/20 |
| Tüm kategoriler | `/kategoriler` | ✅ ağaç: üst kategoriler kart, altları iç içe bağlantı (4 seviyeye kadar); indekslenir, BreadcrumbList; ürün sayısı yok (kategori başına ayrı çağrı gerekir) | `product-categories`, `seo/paths` | docs/20 |
| Tüm markalar | `/markalar` | ✅ ilk harfe göre gruplar (Türkçe alfabe; harfle başlamayanlar sonda "Diğer"), harf atlama bağlantıları, logo varsa; indekslenir, BreadcrumbList | `brands` (100'erli, en çok 1000), `seo/paths` | docs/20 |
| Ürün | `/urun/{slug}` ya da `/{slug}` | ✅ galeri, fiyat, tasarruf, seçenek (renk sözlüğündeki değerler renkli daire), stok, sepete ekle, taksit tablosu (açılınca), kargo cümlesi, yorumlar, soru-cevap, stok bildirimi, favori, WhatsApp'tan sor, benzer ürünler; hediye kartında (bayrak açık ve `product_extension.is_gift_card`) tutar = seçenek, sepet formunda alıcı alanları (e-posta zorunlu; ad, mesaj ≤300, gönderen adı), "Sepete ekle" satırı ekler sonra alıcıyı yazar; alıcı reddedilirse satır geri alınır, `gift_card.*` hataları sözle; ek seçenekler (adr/0052; ürünün ekleri varken, bayrak kapalıyken uç 404 = ek yok): "Sepete ekle"nin üstünde yazı alanı (ad, açıklama, en çok uzunluk ve karakter kuralı sözle, "+35,00 TL") ya da radyo seçim ("İstemiyorum" seçilmemiş hâl; seçenek başına fiyat), zorunlular işaretli, cayma dışı ekte uyarı; açıklama: ürünün içerik belgesi varsa (adr/0055) backend'in izin listeli HTML'i, içerik sayfasıyla aynı okuma sütununda (`RichText`; başlık, liste, alıntı, tablo, bağlantı), yoksa `description`'ın düz paragrafları (uç hata verirse de); JSON-LD açıklaması backend'in düz metninden; "Fiyat + ekler" canlı toplamı yalnız gösterim (`VariantView.kurus` + seçimler × adet; temanın biçimlediği tek tutar, sözleşmenin `formatLira`'sıyla); seçimlerin adet sınırı adet alanını kısar. Ekleme tek Server Action'da iki çağrı: kendine ait satır (çekirdek uç, `metadata.addon_line` işaretiyle; eksiz satırla birleşmez), sonra `…/addons { selections }`; ret satırı geri alır, `addons.*` sözle. Fiyat hiç gönderilmez | `storefront.color_swatches`, `carts/{id}/line-items/{line}/gift`, `products/{id}/addons`, `products/{id}/description`, `carts/{id}/line-items/{line}/addons` | D5, docs/20, adr/0055 |
| Arama | `/arama?q=` | ✅ liste ekranı: yazım toleranslı arama, filtreler, sıralama (varsayılan "En alakalı"), sayfalama; "Bunu mu demek istediniz" bağlantıları, ilgili kategori ve marka (`marka=` süzgeci) çipleri; okunamayan sorgu (400) boş sayfa + ipucu; `noindex,follow`; terim ilk ve daraltılmamış sayfada backend'de sayılır | liste ucu `type=search&q=` (adr/0046 Ek 2026-11-03); Meilisearch sonra | D10 |
| Sepet | `/sepet` | ✅ adet, kaldır, kupon, indirim, ücretsiz kargo çubuğu, hediye kartı (bayrak açıkken); hediye satırının altında alıcı ve `<details>` içinde düz form (alıcısız satırda açık); hediye satırı varken kart kodu alanı gizli (uygulanmış kod varsa yalnız kaldırmak için görünür, yanında "kartla kart alınmaz" uyarısı); ekli satırın altında seçimler ("Ürün üzerine yazı: Ahmet (+35,00 TL)", `metadata.qt_addons`'tan; mini sepette de), cayma dışıysa "Kişiye özel ürün: cayma hakkı yok", ekin adet sınırı (artı düğmesi durur, `addons.max_quantity` sözle); ürünün ekleri varken `<details>` içinde düz form "Düzenle" (eksiz satırda "Seçenek ekle"; zorunlu seçim eksikse kendiliğinden açık) ve "Seçenekleri kaldır" (boş seçim; zorunlu ek varken yok) | `carts/{id}/gift-cards`, `carts/{id}/gift-lines`, `products/{id}/addons`, `carts/{id}/line-items/{line}/addons` | D6, docs/20 |
| Mini sepet (çekmece) | başlıkta | ✅ | | D6 |
| Sepet hatırlatma | `/sepet/geri-don?token=` | ✅ onay sayfası + Server Action, satırlar yeni sepete | `cart-reminders/redeem` | D6 |
| Ödeme | `/odeme`, `/odeme/kart`, `/odeme/sonuc`, `/odeme/durum` | ✅ adres (`tr-address`), kargo, yöntemler, sözleşmeler, yaş, pazarlama izni, iş kanıtı, fatura notu; havale/kapıda anında, PayTR çerçeve, iyzico yönlendirme, tamamı hediye kartıyla (`credit`; sepette hediye satırı varken sunulmaz); alıcısız hediye satırında ve ödeme başlatma reddinde `gift_card.*` sözle; özette ek seçimleri; ödeme başlatma ya da tamamlama 409 `cart.prices_changed` verirse sayfa aynı yanıtta yeni toplamlarla çizilir, "Fiyatlar güncellendi…" yazar, ödeme kendiliğinden yeniden denenmez; `addons.unavailable`/`addons.required`/`addons.max_quantity`/`catalog.addons_disabled` sözle ve "Sepete dön" bağlantısıyla | | D7 |
| Sipariş | `/siparis/{id}?token=` | ✅ özet, havale bilgisi, kargo ve takip, iptal, iade/değişim talebi, sözleşmeler, fatura PDF; hediye satırında "Hediye kartı: •••• 1234 → alıcı" (`items.metadata.qt_gift_cards`, `qt_gift`) ve "alıcıya e-postayla gönderildi" (kart yoksa "ödeme alınınca gönderilecek"); ekli satırda satılan seçimler (satırın kendi kopyası) ve cayma dışıysa notu; iade formunda böyle satırın altında "Bu satır için cayma hakkı yok; yalnızca ayıplı/yanlış ürün iadesi", adet seçilince nedenler hasarlı/yanlış/açıklamadaki gibi değil'e iner ve değişim kapanır (betiksiz: backend `returns.withdrawal_excluded` sözle); iade satırları `orders/:id/returnable` ucundan (kalan adet, pencere, dışlama nedeni; uç yanıt vermezse form yok); hediye siparişinde iptal kartlar kullanılmamışsa (kartlar iptal edilir, tutar iade edilir), kullanıldıysa `orders.gift_card_used`; iade formu kargolanmamış, yalnız hediye kartından oluşan siparişte de görünür: hediye satırları kendi formunda (kartlar gittikten sonra, yalnız cayma/para iadesi), fiziksel satırlar yine kargo bekler (adr/0025, 2026-11-03); satırın iade edilebilir adedi ve cayma dışı sebebi gönderimden önce `GET /store/orders/{id}/returnable`'dan okunabilir | `orders/{id}/shipments`, `orders/{id}/returnable` | D7 |
| Sipariş sorgulama (misafir) | `/siparis` | ✅ | `order-lookup` | D8 |
| Giriş, kayıt, doğrulama, şifre | `/hesap/giris`, `/hesap/kayit`, `/hesap/dogrula`, `/hesap/sifre-sifirla`, `/hesap/sifre-yenile` | ✅ | Medusa auth + F15 | D8 |
| Hesabım: özet, siparişler, favoriler, adresler (ekleme dahil), bilgiler, şifre, fatura profili, izinler, KVKK talebi | `/hesap/*` | ✅ | `privacy-requests` (kanal `account`) | D8 |
| Taşınan müşteri daveti | `/hesap/kayit?davet=` | ✅ ilk girişte `migration-claim` | | D8 |
| İçerik sayfası | `/{handle}` | ✅ | `content` | D10 |
| İletişim | `/iletisim` (Ayarlar > Vitrin'de seçilen sayfa) | ✅ içerik + iletişim formu (konular arasında misafirin "KVKK başvurusu") | `contact-messages` (ADR-0047) | D10 |
| Taslak önizleme | `/onizleme/{token}` | ✅ 24 saatlik imzalı bağlantı, `noindex` | `content/preview/{token}` | D10 |
| Bakım sayfası | her yol (açık kalanlar hariç) | ✅ proxy'de, tema olmadan sade sayfa: mağaza adı, başlık, metin (belirteçler dolu), Türkçe beklenen açılış; `503`, `Retry-After` (beklenen zamana kalan saniye, 300–86400; yoksa ya da geçmişse 3600), `Cache-Control: no-store`, CSP; `noindex` yok. Açık kalanlar: `/onizleme/*`, `/odeme/sonuc*`, `/odeme/durum*`, `/bakim/gir`, `/robots.txt`, `/sitemap*`, IndexNow anahtar dosyası, `/_next/*`, simge dosyaları, mağazanın `allow_paths`'i (tam ya da `/x/*`; küçük harf, sondaki `/` yok). Server Action ve rota işleyicileri de 503. Bakım açılıp kapanınca en geç 60 sn'de yansır | `seo/site` `maintenance` (adr/0053) | docs/20 |
| Bakım atlama bağlantısı | `/bakim/gir?t=` | ✅ rota işleyicisi: jeton biçimi (`mnb_…`) → `maintenance/bypass/:token`; `204` → httpOnly `__Host-qt_bypass` (yerelde `qt_bypass`), SameSite=Lax, 7 gün, 303 `/`; `404` ya da bozuk → bakım sayfası "Bağlantı geçersiz" (503, `noindex`); mağaza açıkken 303 `/` (çerezsiz); `Referrer-Policy: no-referrer`. Proxy çerezi jeton başına dakikada en çok bir kez doğrular; `404` gelince çerezi siler. Atlamayla görülen sayfalar `X-Robots-Tag: noindex`, `Cache-Control: private, no-store` | `maintenance/bypass/:token` | docs/20 |
| Müşteri yorumları | `/yorumlar` | ✅ | `GET /store/reviews` | D10 |
| Blog | `/blog`, `/blog/{handle}` | ✅ kategori çubuğu (Tüm yazılar + canlı yazısı olan kategoriler), kartta kategori; yazıda kategori ve etiket bağlantıları | `content?kind=post`, `content/terms` | D10 |
| Blog arşivleri | `/blog/kategori/{handle}`, `/blog/etiket/{handle}` | ✅ terimin canlı yazıları, `?sayfa=` (sonraki sayfanın kendi canonical'ı ve başlığı), ilk sayfada terimin açıklaması; robots ve JSON-LD resolve'dan; bilinmeyen handle 404 | resolve `post_category` / `post_tag`, `content?kind=post&category=` / `&tag=` (adr/0019 Ek 2026-11-03) | docs/20 |
| Yasal metinler | `/yasal/{tur}` | ✅ (yayımlanmışlar) | `legal/{kind}` | D10 |
| Çerez onayı | bant; alt bilgideki "Çerez tercihleri" bağlantısı bandı geçerli seçimle yeniden açar | ✅ | `consents/cookies` | D9 |
| Çerez tercihleri (betiksiz) | `/cerez-tercihleri` | ✅ bandın formu, kaydedince "kaydedildi", `noindex,follow` | `consents/cookies` | D9 |
| İleti bağlantıları: kampanya çıkışı, izin onayı, stok bildirimi onayı | `/abonelik/cik?t=`, `/abonelik/onay?t=`, `/stok-bildirimi/onay?t=` | ✅ önce sorar, Server Action, sonuç `?sonuc=`; bozuk bağlantı 200 + `noindex,nofollow`, `no-referrer` | `consents/unsubscribe`, `consents/confirm`, `stock-alerts/confirm` (adr/0038 Ek) | D9 |
| Hediye kartı bakiyesi | `/hediye-karti/bakiye` | ✅ kod alanı (`method="post"`, kod gövdede, adreste değil) → Server Action; 428'de iş kanıtı tarayıcıda (`useChallengeForm`); "Kalan bakiye: …" ya da "bulunamadı"; `noindex,nofollow`; bayrak kapalıyken 404. `hediye-karti` vitrinin sistem köküdür (backend de ayırmalı) | `gift-cards/balance` | docs/20 |
| Ödeme bağlantısı (panelden hazırlanan sipariş) | `/ode/<token>` | ✅ selamlama + `PL-<no>`, satırlar, toplamlar, indirim, kargo, son ödeme; "Ödemeye geç" düz form → Server Action (`cart` ucu, sepet çerezi, `/odeme`'ye yönlendirme; yanıt `?durum=`); `prices_changed`/stok bitti düğmesiz; her kullanılamaz durum tek metinle 200 + `noindex,nofollow`, `no-referrer`; kilitli sepet (`metadata.qt_payment_link`: +/−/sil/kupon yok, "sepeti boşalt" var), ödemede kapıda ödeme yok; GA4'e `/ode`, Meta pikseli yok. `ode` sistem köküdür | `payment-links/:token`, `payment-links/:token/cart` (adr/0051) | docs/20 |
| Dönüşüm olayları (GA4, Meta Pixel) | her sayfa | ✅ çerez onayına bağlı: `analytics` → GA4, `marketing` → Meta; yanıt yokken ya da eski politikadaysa hiçbir şey yüklenmez; yeni yanıt çerçeve yeniden çizilince geçerli (yüklenir ya da durur, çerezleri silinir). Betikler yanıtın nonce'uyla, yalnız mağaza kimliği bağladıysa; CSP host'ları da yalnız o zaman. Consent Mode v2 varsayılanı `denied`. Olaylar: `page_view` (rota başına), `view_item`, `view_item_list`, `search` (ilk, daraltılmamış sayfa), `add_to_cart`, `begin_checkout` (sepet başına bir kez), `add_payment_info`, `purchase` (`?yeni=1`, sipariş başına sekmede bir kez; `transaction_id`/`eventID` = sipariş kimliği, backend'in sunucu olayıyla aynı), `sign_up`. Adresteki anahtarlar (`token`, `t`, `code`, `davet`, `/onizleme/*`) GA4'e gitmez; Meta pikseli böyle adreste hiç olay göndermez (satın alma sunucudan gider) | `seo/site` `tracking` (backend ekleyecek), `carts/{id}/tracking` | D9, docs/20 |
| Yenile sinyali (backend → vitrin) | `POST /api/yenile` | ✅ rota işleyicisi: adres başına dakikada 30, sır yoksa 404, gövde ≤1 KB, zaman ±60 sn ve `at` aynı, nonce biçimi ve 2 dk tekrar yok, 1–6 bilinen kapsam, HMAC-SHA256 sabit sürede; tutarsa kapsamın önbellekleri boşalır, 204; değilse gövdesiz 401; hep `no-store`; başka yöntem 405. Proxy bu yola dokunmaz | adr/0048 Ek 2026-11-03 | adr/0049 |
| 404 / 410 / hata | — | ✅ | `seo/not-found` | — |

## 8. İlk müşteri eşlemesi

Bir mağazanın kurulumu **mağaza profiliyle** yapılır (`pnpm --filter @qticaret/backend shop:profile <klasör>`): ad, ayar bölümleri, Markdown içerik sayfaları ve taşıma paketi, platformun kendi iş akışlarından geçer. İlk müşterinin profili `docs/gecis/mylarte/profil/`.

Mevcut sitenin (WooCommerce) sayfa sayfa envanteri `docs/gecis/mylarte/envanter.md`, platformla eşlemesi ve eksikler `docs/gecis/mylarte/esleme.md`, sayfa metinleri `docs/gecis/mylarte/sayfalar/`. Yasal metinler içerik sayfası değildir: Ayarlar > Yasal'da firma bilgilerinden üretilir, `/yasal/...` adreslerinde yayınlanır (eski sitenin metinleri yalnız başvuru: `docs/gecis/mylarte/eski-yasal-metinler/`). Kural: ilk müşterinin ihtiyacı sektöre özel koda dönüşmez; içerik, ayar, özellik şablonu ya da özellik bayrağıyla karşılanır.

## 9. Kontrol listesi (her vitrin ekranı)

- [ ] 390 px ve 1280 px'te taşma yok; dokunma hedefi ≥ 40 px
- [ ] Başlık hiyerarşisi: tek `h1`, sıralı `h2`
- [ ] Betik kapalıyken ana eylem çalışıyor
- [ ] Görünen her söz `tr.json`'da; ekran okuyucu adları Türkçe
- [ ] Klavyeyle tüm eylemler; odak görünür
- [ ] axe: kritik ihlal yok; kontrast AA
- [ ] LCP görseli `priority`, diğerleri tembel; CLS yok (görsel kutusu sabit oranlı)
- [ ] SEO verisi ilk HTML'de; gizli kalan içerik yok
- [ ] Konsolda CSP ihlali yok
