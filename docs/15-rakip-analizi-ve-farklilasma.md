# 15 — Rakip Analizi ve Farklılaşma

> Tarih: 2026-10-22. Web araştırmasına dayanır; "(doğrulanamadı)" işaretli maddeler sağlayıcı dokümanı/satış ekibiyle teyit ister.
> Rakip özellikleri hızla değişir; bu doküman altı ayda bir güncellenir. Amaç övünmek değil: nerede gerçekten farklıyız, nerede gerideyiz.

## 1. Karşılaştırma özeti
| Boyut | Shopify | ikas | Ticimax | IdeaSoft | T-Soft | **Biz (hedef)** |
|---|---|---|---|---|---|---|
| Mimari | SaaS, kapalı çekirdek | SaaS, kapalı | SaaS, .NET, kapalı | SaaS, kapalı | SaaS, kapalı | Instance-per-tenant, açık çekirdek (Medusa), headless |
| API / webhook | Zengin REST+GraphQL, webhook | GraphQL admin API, webhook (scope başına tek, 3 retry) | "Web servis", webhook doğrulanamadı | API ek paket, webhook doğrulanamadı | Web servis, detay yok | Tam Store/Admin API, imzalı webhook, OpenAPI |
| Ürün URL'si | `/products/` sabit, koleksiyon altı çoğaltma | doğrulanamadı | URL rewrite var | detay yok | detay yok | Desen seçilebilir, tek canonical, kategori içermez |
| 301 yönetimi | Yalnız kırık URL'den, regex yok, 100k limit | 301/302 var | 301 paneli + 404 yöneticisi | detay yok | detay yok | Regex/önek, zincir düzleştirme, 404 günlüğü + hedef önerisi |
| Sitemap / robots | Otomatik, düzenlenemez / robots.txt.liquid | robots düzenleme | Yönetilebilir sitemap + görsel sitemap | detay yok | detay yok | Backend üretir, görsel sitemap, robots şablonu + AI tarayıcı ön ayarı, IndexNow |
| JSON-LD | Temaya bağlı, ince (Dawn: temel Product) | doğrulanamadı | "Rich snippet ayarı" | detay yok | detay yok | Backend üretir: ProductGroup, Offer+kargo+iade, OnlineStore, Breadcrumb, QAPage |
| SEO puanı / öneri motoru | Yok (Sidekick metin üretir) | "SEO asistanı" (AI metin) | AI açıklama | "SEO analiz modülü" (detay yok) | Yok | Kural motoru + skor + tek tık düzeltme + yayın kapısı + paylaşım önizleme (doc 14) |
| Yorum / Soru-Cevap | Resmi uygulama 2024'te kaldırıldı; ücretli 3. parti | var | var | var | var | Çekirdekte, satın alan doğrulamalı, QAPage şeması |
| TR ödeme | Shopify Payments yok; 3. parti + plan bazlı ek komisyon (%2 → %0,2) | Kendi POS'u, %0 taksitsiz | var | var | var | Tenant'ın kendi iyzico/PayTR hesabı, **platform komisyonu yok** |
| E-fatura | 3. parti uygulama (kontör) | entegrasyon | var | var | var | Modül: UBL üretimi bizde, entegratör ince katman |
| Kapıda ödeme / havale | 3. parti uygulama | var | var | var | var | Çekirdek provider'lar |
| Kargo | 3. parti | var | var | var | 8+ firma | Doğrudan taşıyıcı adaptörleri (Aras, Yurtiçi; diğerleri istendikçe) |
| KVKK / mesafeli satış metinleri | 3. parti uygulama (ücretli) | var | var | var | var | `legal-consent`: sürümlü, sipariş snapshot'lı |
| Veri sahipliği | Export var; uygulama verileri uygulamada kalır | kapalı | kapalı | kapalı; sözleşme tek taraflı değişebilir | kapalı | Ayrı DB, tam dışa aktarma paketi, geçiş araçları iki yönlü |
| Fiyat modeli | $ bazlı + komisyon; Plus $2.300/ay | ₺4.660–8.299/ay, Premium 40.000+ | ~₺2.900/ay'dan, sürekli kampanya | ₺35–105k/yıl | yayınlanmıyor | Şeffaf paket, komisyonsuz, Türkçe destek |

## 2. Shopify
**Güçlü:** devasa uygulama/tema ekosistemi, Shop Pay dönüşümü (TR'de yok), küresel ölçek ve uptime, Sidekick/Magic AI, Markets, POS, geliştirici araçları.
**Zayıf (bizim için fırsat):**
- URL önekleri (`/products`, `/collections`, `/pages`, `/blogs`) kaldırılamaz; koleksiyon altı ürün URL'si 200 döner, canonical'a rağmen tema grid'leri uzun URL'ye link verir (düzeltme tema kodu ister).
- Yönlendirme yalnız "kırık" URL'den; regex/wildcard yok; sabit yollar yönlendirilemez; wildcard için uygulama şart.
- Sitemap düzenlenemez; alt kategori yapısı yok (2026-07 "collection sources" API'si hiyerarşi getirmedi); blog URL'si sabit, blog kategorisi yok.
- JSON-LD temaya bağlı ve ince; yorum uygulamaları ikinci Product bloğu ekleyip çakıştırıyor.
- Resmi Product Reviews uygulaması Mayıs 2024'te kaldırıldı; yorum = ücretli 3. parti.
- Sidekick açıklama/kategori üretir ama **yayın öncesi SEO skoru veya eksik alan uyarısı yok** (doğrulanamadı: resmi sayfada böyle bir özellik geçmiyor).
- **Türkiye:** Shopify Payments yok → 3. parti ağ geçidi zorunlu ve plan bazlı ek işlem komisyonu (Basic %2, Grow %1, Advanced %0,6, Plus %0,2) iyzico/PayTR komisyonunun üstüne biner. E-fatura, kapıda ödeme, Türk kargo, mesafeli satış onayı, KVKK metinleri hepsi ayrı ücretli uygulama; tipik TR mağazası 4–5 uygulamaya bağımlı. Türkçe destek zayıf.
- Checkout kod düzeyi özelleştirme Plus'a özel (checkout.liquid 2024–2025'te emekli); B2B çekirdeği 2026'da tüm planlara açıldı ama sınırsız katalog/kısmi ödeme Plus'ta.

## 3. ikas
**Güçlü:** modern panel, hızlı vitrin, kendi ödeme servisi (%0 taksitsiz), geniş pazaryeri listesi (19 yurt içi + 7 yurt dışı), AI ürün açıklaması/SEO asistanı, GraphQL admin API, MCP sunucusu duyurusu (2025-06).
**Zayıf / belirsiz:** kapalı platform, storefront API/headless doğrulanamadı; webhook scope başına tek ve 3 denemeden sonra durur; sitemap kontrolü ve JSON-LD derinliği doğrulanamadı; Start paketi 100 ürünle sınırlı; üst paketler ₺7–8k/ay; kendi PSP'ni kullanınca ek "+%0,60" satırı (hangi pakette, doğrulanacak).

## 4. Ticimax
**Güçlü:** yerli pazarda en zengin SEO panosu (URL rewrite, 301 paneli, 404 yöneticisi, yönetilebilir sitemap + görsel sitemap, canonical, hreflang, blog), e-ihracat odağı, AI yatırımı.
**Zayıf:** eski nesil mimari (.NET, kapalı), headless yok, web servis SOAP/REST belirsiz, webhook belirsiz; liste fiyatı sürekli kampanya ile güvenilmez; özelleştirme ajans bağımlı.

## 5. IdeaSoft
**Güçlü:** uzun geçmiş, pazaryeri entegrasyonları, uygulama pazarı.
**Zayıf:** bağımsız şikayet verisi en somut olan: kronik 500 hataları/erişim kesintileri, "paket taahhütleri" şikayetleri, sipariş durumunun kendiliğinden geri dönmesi; sözleşmede paket içeriğini tek taraflı değiştirme hakkı; API ek paket; headless yok.

## 6. T-Soft
**Güçlü:** en geniş pazaryeri ve kargo listesi, e-fatura, kurumsal müşteriler.
**Zayıf:** fiyat yayınlanmıyor, teknik doküman zayıf ("web servisler"), domain değişikliği gibi işlemlerde yüksek ek ücret anekdotları; headless iddiası doğrulanamadı.

## 7. Pazar bağlamı (TR)
- 2025 e-ticaret hacmi ~4,6 trilyon TL (+%52). Pazaryeri payları: Trendyol ~%22, Hepsiburada ~%12, N11 ~%6, Amazon ~%6 → markalı mağazalar pazaryeri dışı trafik için **SEO'ya mecbur**.
- Arama: Google ~%87, Yandex ~%11 genel payda; ama e-ticaret sitelerine gelen arama trafiğinde Google ~%99, Yandex ~%1. Yandex düşük öncelik (IndexNow ile sıfır maliyetle kapsanır).
- Tıklama maliyetleri yüksek (CPC > 0,65 USD raporları) → organik trafik KOBİ için doğrudan kâr.
- AI arama: Shopify varsayılan şeması "ince"; `llms.txt` atıf sağlamıyor; işi yapan **yapılandırılmış veri ve feed hijyeni** (doc 13 §9).
- Hiçbir rakipte doğrulanmış "yayın öncesi SEO kalite puanı + eksik alan uyarısı + tek tık düzeltme" yok → `seo-advisor` ana farklılaştırıcı.

## 8. Bizi öne çıkaracaklar (fazlarla)
1. **SEO motoru çekirdekte** (F3): tek canonical URL modeli, regex 301 + 404 günlüğü, backend JSON-LD (kargo/iade dahil), görsel sitemap, IndexNow, facet landing sayfaları, `seo-advisor` skor/öneri/yayın kapısı, paylaşım önizleme. Shopify'da 3–5 uygulama + tema kodu gerektiren şeyler.
2. **Türkiye-yerel uyum çekirdekte** (F1, F6, F8, F13): e-fatura/e-arşiv, KVKK, İYS, mesafeli satış snapshot'ı, 30 gün fiyat kuralı, il/ilçe/mahalle, taksit, kapıda ödeme, havale, TCKN maskeleme.
3. **Komisyon yok, hesap tenant'ın** (F5–F6): platform para toplamaz, ek işlem komisyonu almaz.
4. **Veri sahipliği ve çıkış özgürlüğü** (F14, F16.11): ayrı DB, tam dışa aktarma paketi, iki yönlü geçiş araçları, 301 koruması.
5. **Headless ve tema özgürlüğü** (F18): Store API tema bağımsız; SEO payload'ı her temada aynı kalite.
6. **Operasyon-öncelikli admin** (F7, F12): kargoya hazır listesi, toplu etiket, havale onayı, iade/değişim kuyruğu; Türkçe.
7. **Yorum, Soru-Cevap, favori, stok bildirimi, terk edilmiş sepet çekirdekte** (F10): ücretsiz, veriler bizde.
8. **Doğrudan taşıyıcı ve entegratör bağımsızlığı** (F7, F8): aracıdan çıkılabilir adaptör mimarisi.
9. **Güvenlik ve izolasyon** (doc 04): instance-per-tenant, SAQ-A, denetim kaydı, 2FA, break-glass.
10. **Geçiş hizmeti** (F14): Shopify/Ticimax/ikas/IdeaSoft'tan SEO kaybetmeden taşıma; rakiplerin lock-in'i bizim giriş kapımız.

## 9. Dürüst eksikler (nerede gerideyiz, strateji ne)
| Eksik | Strateji |
|---|---|
| Uygulama/tema ekosistemi yok | Çekirdekte "uygulama gerektiren" ihtiyaçları kapatmak (madde 1, 2, 7); tema sayısı F18'de az ama kaliteli |
| Pazaryeri entegrasyonları yok (ikas/T-Soft güçlü) | F19 ilk madde; Trendyol/HB/N11 öncelik |
| Marka bilinirliği, referans yok | İlk müşteri vaka çalışması; geçiş hizmeti ile giriş |
| Shop Pay benzeri cüzdan/dönüşüm aracı yok | PayTR/iyzico hosted form; taksit tablosu. Satıcı tarafı kayıtlı kart iki sağlayıcıda da kart verisini bize getirdiği için kapsam dışı (adr/0026); iyzico Checkout Form'un müşteri cüzdanı F5.11'de değerlendirilir |
| POS, mobil uygulama, sadakat yok | F19 |
| Küresel ölçek/uptime kanıtı yok | F15 yük testi, F16 izleme, SLA (doc 12) |
| AI içerik üretimi rakiplerde var | ADR-0005: kural motoru + opsiyonel LLM; farkımız üretim değil **kalite kapısı** |

## 10. Konumlandırma
"Türkiye'de satan markalı mağazalar için, SEO'su ve yasal uyumu çekirdeğinde gelen, komisyonsuz, verisi sana ait e-ticaret altyapısı."
Hedef segment: pazaryeri dışında kendi markasını büyütmek isteyen KOBİ ve orta ölçekli satıcılar; başka platformda lock-in yaşayanlar.

## 11. Açık doğrulamalar
- ikas Storefront API/headless; ikas "+%0,60" hangi pakette; Ticimax/T-Soft/IdeaSoft webhook varlığı → satış ekiplerine sorulacak.
- Shopify B2B "tüm planlara açıldı" (2026-04) resmi changelog ile teyit.
- Google ücretsiz listeleme Türkiye: Merchant Center hesabında teyit (doc 13 §10).
