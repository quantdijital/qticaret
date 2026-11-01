# mylarte.com → Quant Ticaret eşlemesi

> Kaynak: `envanter.md` (2026-11-01, sayfa sayfa inceleme). Bu belge her sayfayı ve özelliği platformdaki karşılığına bağlar; eksikleri platform özelliği olarak adlandırır.
> Kural (CLAUDE.md): ilk müşterinin ihtiyacı sektöre özel koda dönüşmez. Bıçağa özgü olan her şey içerik, ayar, öznitelik şablonu ya da özellik bayrağıdır.
> Durum: ✅ hazır · 🟡 temel hâli var · ⬜ yok (görev kodu PROGRESS "F18 görev planı" ya da önerilen yeni iş).

## 1. Sayfalar

| # | mylarte | Bizde | Durum | Eksik / not |
|---|---|---|---|---|
| 1 | Ana sayfa `/` | `/` | 🟡 | Başlık, kategoriler, yeni ürünler var. Hero görselleri, kategori karoları (görselli), ürün rafları (kategori/koleksiyon), yorum vitrini, kampanya bandı için **ana sayfa blokları** (D11) |
| 2 | Üst / alt kategori | kategori listesi | 🟡 | Sayfalama, "en yeni" var. **Filtre paneli** (çelik, ürün türü, fiyat) D4. Kategori SEO metni var (kategori açıklaması). **Kategoriye bağlı SSS** yok: landing/içerik ile ya da kategori açıklamasında |
| 3 | Mağaza `/magaza/` | landing "Tüm ürünler" | ⬜ | Landing sayfası olarak (D4) |
| 4 | Marka `/marka/{slug}/` | marka listesi | ✅ | URL birebir (`prefixed` stil) |
| 5 | Ürün (basit, varyasyonlu, stokta yok) | ürün sayfası | 🟡 | Galeri, seçenek, stok, 30 gün kuralı, sepete ekle, öznitelik tablosu var. Eksikler §2 |
| 6 | Canlı arama (açılır sonuç) | — | ⬜ | Meilisearch ile D10; şimdilik `/arama` sonuç sayfası |
| 7 | Arama sonuçları | `/arama?q=` | 🟡 | Medusa anahtar kelime araması; filtre D4/D10 |
| 8 | Mini sepet | — | ⬜ | Sepete ekleyince açılan çekmece (D6) |
| 9 | Sepet | `/sepet` | ✅ | Ücretsiz kargo çubuğu var. Kupon D6. Kargo ücreti hesaplayıcı yok (ödemede gösterilir) |
| 10 | Ödeme | `/odeme` | ⬜ | D7. Backend hazır: TR adres, kargo, PayTR/iyzico, havale, kapıda, sözleşme onayları, yaş beyanı, fatura profili (bireysel/kurumsal) |
| 11 | Sipariş alındı | `/siparis/{id}` | ⬜ | D7 |
| 12 | Hesabım, giriş, kayıt, şifre sıfırlama | `/hesap/*`, `/giris`, `/kayit` | ⬜ | D8. Google ile giriş backend'de var |
| 13 | Blog dizini, yazı | `/blog`, `/blog/{handle}` | 🟡 | Yazı sayfası var, liste D10. **URL farkı** §3 |
| 14 | Blog kategorisi `/category/{slug}/` | — | ⬜ | İçerik modülünde yazı kategorisi yok (öneri: etiket/kategori alanı) |
| 15 | İletişim | içerik sayfası | 🟡 | Metin `sayfalar/iletisim.md`. **İletişim formu** ucu yok (öneri: genel form ucu + bildirim). Harita gömmesi CSP `frame-src` ister |
| 16 | Hakkımızda, SSS | içerik sayfası | ✅ | Metinler `sayfalar/`. SSS için `FAQPage` şeması D10 |
| 17 | Müşteri yorumları `/yorumlar/` | — | ⬜ | Mağaza geneli onaylı yorum listesi ucu yok (backend'de ürün başına var). Google İşletme yorumları dış servis: sonraki aşama |
| 18 | Toptan teklif `/toptan/` | — | ⬜ | **Teklif isteme** (fiyatsız RFQ: ürün seç + adet + firma + onaylar) platform özelliği olarak önerilir |
| 19 | Toptan hukuk metinleri (4) | içerik sayfası (noindex) | 🟡 | Metinler `sayfalar/toptan-*.md`; "taslak" notu canlıda, düzeltilmeli |
| 20 | İade, satış sözleşmesi, KVKK, çerez politikası | yasal metinler (`legal` modülü) | ⬜ | Metinler `sayfalar/`. Yasal modülde sürümlü yayın + vitrin yolu D10 (sözleşmeler ödemede sürümüyle onaylanır) |
| 21 | 404 | 404 | ✅ | |

## 2. Özellikler

| Özellik | mylarte | Bizde | Durum | Öneri |
|---|---|---|---|---|
| Duyuru çubuğu | 3 madde, mobilde kayan | `storefront.announcements` | ✅ | Mobilde kaymaz, ilk satır (WCAG 2.2.2) |
| Üst bağlantılar | Hakkımızda, Yorumlar, Toptan, Blog, İletişim | `storefront.top_links` | ✅ | Panelden girilir |
| Kategori menüsü | 7 açılır + "Tüm Ürünler" | kategori ağacı | ✅ | "Tüm Ürünler" üst bağlantı ya da landing |
| Mobil alt gezinme | Ana Sayfa / Kategoriler / Ara / Sepet / Hesabım | — | ⬜ | Temaya küçük ek (D11) |
| Footer | güven şeridi, 3 sütun, iletişim, sosyal, ödeme logoları, ETBİS | `storefront.*`, `legal-identity` | 🟡 | Ödeme logoları ve ETBİS satırı eklenecek |
| WhatsApp | ürün sayfasında hazır mesajlı düğme | yüzen düğme (`storefront.whatsapp_phone`) | 🟡 | Ürün sayfasına "WhatsApp'tan sor" (ürün adı ve adresiyle) D5 |
| **Ürün ek seçenekleri** | yazı işleme +35 TL/adet (≤10 adet, ≤50 karakter, yalnız harf/rakam, iade dışı); kılıf +250/+300 TL | — | ⬜ | **Yeni platform özelliği:** ürüne bağlı ücretli ek seçenekler (metin, seçim), fiyat sunucuda hesaplanır, satır kalemine işlenir, "iade dışı" bayrağı iade kuralına bağlanır. ADR gerekir |
| Renk örnekleri (swatch) | Sap Rengi, Renk | seçenek hapları | 🟡 | Seçenek değerine renk kodu (öznitelik/seçenek meta verisi) D5 |
| "₺X tasarruf" | ürün sayfasında | indirim yüzdesi rozeti | 🟡 | Tutar da gösterilebilir (D5, küçük) |
| Taksit | yalnız ödemede "6 taksit" | `/store/payment/installments` | ⬜ | Ürün sayfasında taksit tablosu (D5) |
| Havale %2 indirim | ödemede | havale yöntemi (F6) | — | D7'de doğrulanacak |
| Stok bildirimi | "Gelince Haber Ver" | `back-in-stock` | ⬜ | D5 |
| Ürün yorumları | puan dağılımı, fotoğraflı, doğrulanmış alıcı, moderasyon | `product-reviews` | ⬜ | Liste ve yazma D5; fotoğraflı yorum backend'de doğrulanacak |
| Benzer ürünler | var | — | ⬜ | D5 |
| Ürün özellikleri | açıklamada serbest metin tablo | öznitelik tablosu | ✅ | Taşımada çelik, boy, sap, kilit… **öznitelik şablonuna** dönüştürülmeli (filtre ve şema için) |
| Ücretsiz kargo çubuğu | sepet ve ödeme | sepet | ✅ | Eşik `promotions.free_shipping_threshold` |
| Çerez bandı | CookieYes, tercih penceresi İngilizce | `consents/cookies` | ⬜ | D9, Türkçe |
| Analitik | GA4 (consent mode), Meta Pixel | `conversions` (F10.9) | ⬜ | D9 |
| Bot koruması | Cloudflare Turnstile | iş kanıtı + hız sınırı | ✅ | Turnstile gerekmez |
| Yaş uyarısı | yok | yaş beyanı (`carts/:id/age-declaration`) | — | Kategori bazında özellik bayrağıyla açılabilir; hukuki karar kullanıcının |

## 3. Adresler (SEO geçişi, F14.7)

| Tür | mylarte | Bizde | Karar |
|---|---|---|---|
| Ürün | `/urun/{slug}/` | `/urun/{slug}` (`prefixed`) | Aynı; sondaki `/` tek 301 ile düşer |
| Üst kategori | `/{ust}/` | `flat` stilde `/{ust}` | Aynı (flat stil seçilirse) |
| Alt kategori | `/{ust}/{alt}/` | flat: `/{alt}`; prefixed: `/kategori/{ust}/{alt}` | **Açık karar:** ya 40 alt kategori için 301, ya backend'e kök seviyede hiyerarşik yeni bir stil (`/{ust}/{alt}`); ikincisi adresleri birebir korur |
| Marka | `/marka/{slug}/` | `/marka/{slug}` | Aynı |
| Sayfa | `/{slug}/` | `/{handle}` | Aynı |
| Blog yazısı | `/{slug}/` (kökte) | `/blog/{handle}` | **Açık karar:** 54 yazı için 301 ya da yazıya kök seviye stil |
| Blog dizini | `/blog/`, `/blog/page/N/` | `/blog`, `?sayfa=N` | Sayfalama adresleri 301 |
| Sayfalama | `…/page/N/` | `?sayfa=N` | Desen yönlendirmesi ya da kök sayfaya 301 |
| Filtre | `?filter_celik=…` | D4'ün filtre adresleri | Hepsi noindex; 301 gerekmez |
| Sepet, ödeme, hesap | `/sepet/`, `/odeme/`, `/hesabim/` | `/sepet`, `/odeme`, `/hesap` | `/hesabim` → `/hesap` 301 |

Ürün adresleri listesi: `urun-urlleri.txt` (197). Geçiş protokolü: `docs/runbooks/gecis.md`.

## 4. Veri taşıma

Ürünleri elle girmek yerine öneri: F14'e **WooCommerce kaynağı** (salt okunur REST anahtarı): 197 ürün (28 varyasyonlu, ~900 görsel), 48 kategori, 13 marka, 54 yazı, 28 yorum, müşteriler; eski adreslerden 301'ler otomatik üretilir. Kullanıcının kararı.

## 5. Yeni sitede düzeltilecek tutarsızlıklar (envanter §6)

- Yapılandırılmış verideki adres (Zeytinköy…) ile sitedeki adres (Bağbaşı, Yunus Emre Cd. No:16/A) farklı: tek kaynak `legal.address`.
- Çalışma saatleri iletişimde 08:00–19:00, toptanda 08:00–17:00.
- "16:00'ya" / "16:00'a" yazımı; "işçilik garantisi" / "2 yıl garanti" ifadeleri.
- SSS'deki "koşulsuz iade" iade politikasındaki kısıtlarla çelişiyor (kişiselleştirilmiş ürün iade dışı).
- Ödeme logosunun alt metni "iyzico", ödeme PayTR.
- KVKK metni olmayan bir "Üyelik Sözleşmesi"ne atıf yapıyor; toptan hukuk metinleri canlıda "taslak" notlu.
- Çerez tercih penceresi İngilizce.
