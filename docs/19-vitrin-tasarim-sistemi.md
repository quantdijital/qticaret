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
| Yazı tipi | Inter (`next/font`), kendi sunucumuzdan | Türkçe karakterler tam; tarayıcıdan Google'a istek gitmez (KVKK), CSP `font-src 'self'` |
| Formlar | Sunucu eylemleri (Server Actions) + yerel form öğeleri | Sayfanın betiği yüklenmeden de çalışır |
| Test | Vitest (görünüm modelleri), Playwright (e2e, ekran karşılaştırma), axe | §9 |

Sürümler exact ve ≥14 gün kuralıyla (docs/04).

## 2. Görsel dil

**Bir cümleyle (2026-11-02):** sıcak kemik rengi zemin (`#f6f4ef`), beyaz kartlar, koyu mürekkep bantlar (alt bilgi, "bize ulaşın"), başlıklarda yumuşak serif (Fraunces), metinde Inter; birincil eylem mağazanın rengi.

> Kullanıcı 2026-11-02: "tasarıma çok odaklanma, sadece işlevsel yapıların hepsini kurgulamaya devam et; basic şekilde max hız max güvenlik ve max işlevsellik; tasarımı sonradan bizzat yapacağız." Bu bölüm şimdiki taban görünümü anlatır; tasarım kullanıcıyla yeniden ele alınacak. Yeni ekranlar sade ve işlevsel yazılır.

- **Görsel önce:** ürün kartı 4:5 görsel, `rounded-2xl`, beyaz kart; görsel yoksa adın ilk harfi serifle silik.
- **Renk:** birincil eylem `--primary` (mağazanın rengi; varsayılan mürekkep). Kırmızı (`--sale`) yalnızca indirimde, yeşil (`--success`) yalnızca stok ve başarıda; koyu bantlar `--ink`.
- **Tipografi:** `h1`, `h2` Fraunces (`opsz`, `SOFT`), ürün adları ve gövde Inter; tutarlar `.tabular`.
- **Köşe:** düğmeler ve haplar `rounded-full`, kartlar `rounded-2xl/3xl`.
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
| `--radius` | Köşe ölçeği (`sm`/`md`/`lg`/`xl` ondan türer) |
| `--font-sans`, `--font-heading` | Gövde ve başlık yazı tipi |

Kontrast (WCAG AA 4.5:1) temanın `styles.css` başında hesaplı yazılır. Mağazanın kendi renkleri (D11) bu değişkenleri `:root`'ta ezer.

## 4. Çerçeve (her sayfada)

Mağaza panelden yazar: `platform-settings` `storefront` bölümü, `GET /store/storefront` (F18 D3). Yasal kimlik ve iletişim `GET /store/legal-identity`'den.

| Parça | Kaynak | Not |
| --- | --- | --- |
| Duyuru şeridi | `storefront.announcements` (≤5) | Telefonda ilk satır, geniş ekranda hepsi |
| Üst bağlantılar | `storefront.top_links` (≤8) | Geniş ekranda başlığın üstünde; telefonda menü çekmecesinde |
| Telefon | `store.contact_phone` | Üst satırda ve alt bilgide `tel:` bağlantısı |
| Logo / ad | `appearance.logo_light_url` / mağaza adı | |
| Arama | `GET /arama?q=` | Betiksiz form; sonuçlar `noindex,follow` |
| Sepet | çerez + `GET /store/carts/:id` | Sayaç; `/sepet` |
| Kategori menüsü | `storefront.menu` (≤12 öğe × 20 alt bağlantı); yazılmamışsa kategori ağacı (iki seviye) | Geniş ekranda açılır menü (Radix, içerik `forceMount` ile HTML'de), telefonda çekmece |
| Marka rengi | `storefront.primary_color` | `--primary`, `--ring`, `--announcement` ve üzerindeki yazı rengi (beyaz ya da mürekkep, kontrasta göre); yanıtın nonce'uyla tek `<style>` |
| Ana sayfa girişi | `storefront.hero` (üst yazı, başlık, metin, ≤2 düğme) | Yazılmamışsa mağaza adı ve ilk iki kategori |
| Güven şeridi | `storefront.trust_badges` (≤4, ikon listesi sabit) | Alt bilginin üstünde |
| Alt bilgi sütunları | `storefront.footer_groups` (≤4×10) | Yazılmamışsa: ilk 8 kategori + Yardım (Sepetim) |
| İletişim, sosyal | `legal-identity` (`email`, `phone`, `address`, `same_as`) | Sosyal profiller ağ adıyla |
| Küçük yazı | `legal.company_title` | "© yıl unvan" |
| WhatsApp | `storefront.whatsapp_phone` | Sağ altta düz bağlantı (`wa.me`) |

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
├── layout/                    # çerçeve: AnnouncementBar, SiteHeader, CategoryNav, MobileMenu, SearchForm, SiteFooter, WhatsAppButton
├── components/                # ProductCard, Price, Breadcrumbs, Pages, ProductGallery, PurchasePanel, QuantityField, TrustStrip, Container
└── styles.css                 # temanın token değerleri
apps/storefront/src/
├── app/                       # rotalar (sistem sayfaları sabit, gerisi [...path])
├── screens/                   # varlık türüne göre sayfa verisi
├── lib/views/                 # Store yanıtı → görünüm modeli (saf, testli)
└── lib/store-api/             # BFF istemcisi
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
8. **Biçimlendirme storefront'ta:** fiyat, indirim yüzdesi, telefon görünüm modelinde biçimlenir (`lib/views`); tema sayı biçimlendirmez.
9. **Dosya ≤ ~300 satır;** büyüyen sayfa `components/` ya da `layout/` altına bölünür.
10. **Satır içi `style` yok:** üretimdeki CSP (`style-src 'self' 'nonce-…'`) HTML'deki `style` niteliğini reddeder. Değişken genişlik gibi değerler sabit sınıf adlarıyla verilir (ör. sepet kargo çubuğu 5'lik adımlar).

## 7. Sayfa envanteri

Durum: ✅ var · 🟡 temel hâli var · ⬜ yok. Görev kodları PROGRESS "F18 görev planı".

| Sayfa | Yol | Durum | Backend | Görev |
| --- | --- | --- | --- | --- |
| Çerçeve: duyuru, başlık, menü, arama, alt bilgi (yasal bağlantılar, MERSİS/KEP/ETBİS satırı), WhatsApp | her sayfa | ✅ | `storefront`, `legal-identity`, `legal/{kind}` | D3, D10 |
| Ana sayfa | `/` | 🟡 giriş, kategori dizini, yeni ürünler, "bize ulaşın", blogdan | ana sayfa blokları (D11) yok | D11 |
| Kategori, marka, koleksiyon, landing | URL kaydına göre | ✅ filtreler (marka, öznitelik), fiyat aralığı, fiyat/yeni sıralama, sayfalama | `GET /store/listings/products` | D4 |
| Tüm ürünler | `/magaza` | ✅ filtreler, sıralama | liste ucu `type=all` | D4 |
| Ürün | `/urun/{slug}` ya da `/{slug}` | ✅ galeri, fiyat, tasarruf, seçenek, stok, sepete ekle, taksit tablosu (açılınca), kargo cümlesi, yorumlar, soru-cevap, stok bildirimi, favori, WhatsApp'tan sor, benzer ürünler | renk örnekleri yok | D5 |
| Arama | `/arama?q=` | 🟡 Medusa `q` | Meilisearch | D10 |
| Sepet | `/sepet` | ✅ adet, kaldır, kupon, indirim, ücretsiz kargo çubuğu | hediye kartı (bayrak) yok | D6 |
| Mini sepet (çekmece) | başlıkta | ✅ | | D6 |
| Sepet hatırlatma | `/sepet/geri-don?token=` | ✅ onay sayfası + Server Action, satırlar yeni sepete | `cart-reminders/redeem` | D6 |
| Ödeme | `/odeme`, `/odeme/kart`, `/odeme/sonuc`, `/odeme/durum` | ✅ adres (`tr-address`), kargo, yöntemler, sözleşmeler, yaş, pazarlama izni, iş kanıtı; havale/kapıda anında, PayTR çerçeve, iyzico yönlendirme | | D7 |
| Sipariş | `/siparis/{id}?token=` | ✅ özet, havale bilgisi, iptal, iade/değişim talebi, sözleşmeler, fatura PDF | | D7 |
| Sipariş sorgulama (misafir) | `/siparis` | ✅ | `order-lookup` | D8 |
| Giriş, kayıt, doğrulama, şifre | `/hesap/giris`, `/hesap/kayit`, `/hesap/dogrula`, `/hesap/sifre-sifirla`, `/hesap/sifre-yenile` | ✅ | Medusa auth + F15 | D8 |
| Hesabım: özet, siparişler, favoriler, adresler, bilgiler, fatura profili, izinler, KVKK talebi | `/hesap/*` | ✅ | `privacy-requests` (kanal `account`) | D8 |
| Taşınan müşteri daveti | `/hesap/kayit?davet=` | ✅ ilk girişte `migration-claim` | | D8 |
| İçerik sayfası | `/{handle}` | ✅ | `content` | D10 |
| İletişim | `/iletisim` | 🟡 içerik sayfası + WhatsApp/telefon | iletişim formu: kişisel veri saklama ve personel bildirimi kararı bekliyor | D10 |
| Müşteri yorumları | `/yorumlar` | ✅ | `GET /store/reviews` | D10 |
| Blog | `/blog`, `/blog/{handle}` | ✅ | `content?kind=post` | D10 |
| Yasal metinler | `/yasal/{tur}` | ✅ (yayımlanmışlar) | `legal/{kind}` | D10 |
| Çerez onayı | bant | ✅ | `consents/cookies` | D9 |
| 404 / 410 / hata | — | ✅ | `seo/not-found` | — |

## 8. İlk müşteri eşlemesi

Bir mağazanın kurulumu **mağaza profiliyle** yapılır (`pnpm --filter @qticaret/backend shop:profile <klasör>`): ad, ayar bölümleri, Markdown içerik sayfaları ve taşıma paketi, platformun kendi iş akışlarından geçer. İlk müşterinin profili `docs/gecis/mylarte/profil/`.

Mevcut sitenin (WooCommerce) sayfa sayfa envanteri `docs/gecis/mylarte/envanter.md`, platformla eşlemesi ve eksikler `docs/gecis/mylarte/esleme.md`, sayfa metinleri `docs/gecis/mylarte/sayfalar/`. Kural: ilk müşterinin ihtiyacı sektöre özel koda dönüşmez; içerik, ayar, özellik şablonu ya da özellik bayrağıyla karşılanır.

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
