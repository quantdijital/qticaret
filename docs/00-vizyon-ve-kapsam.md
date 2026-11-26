# 00 — Vizyon ve Kapsam

## Ürün
Türkiye pazarına odaklı, sektörden bağımsız, çok müşterili e-ticaret altyapısı.
Müşterilerimiz (tenant'lar) kendi mağazalarını bu altyapı üzerinde işletir.

## İlkeler
- **Sektörden bağımsız çekirdek.** İlk müşteri bıçak sektörü; ama "bıçak" kelimesi kodda geçmez.
  Sektörel ihtiyaç = feature flag + ürün attribute şablonu + opsiyonel modül.
- **Türkiye-yerel varsayılanlar.** TRY, KDV, il/ilçe/mahalle, taksit, 3DS, e-arşiv, KVKK, İYS, mesafeli satış.
- **Tenant kendi hesaplarının sahibi.** Ödeme, kargo, e-fatura hesapları ve API anahtarları tenant'a aittir.
  Platform asla tenant adına para toplamaz (lisanssız ödeme hizmeti riski).
- **Değiştirilebilir sağlayıcılar.** Her dış servis bir provider arayüzünün arkasında; yedek sağlayıcı her zaman mümkün.
- **Veri sahipliği.** Transaction ID, takip no, fatura UUID gibi tüm referanslar bizim DB'mizde saklanır.
- **SEO çekirdektir.** Tenant hiçbir şey bilmeden doğru URL, meta, yapılandırılmış veri ve sitemap alır; bilen tenant her şeyi yönetebilir;
  kaydettiği anda skor ve öneri görür (`docs/13`, `docs/14`).
- **Güvenlik önce kurulur.** Taban F0–F2'de; F15 doğrulama fazıdır (`docs/04`).
- **En az dış bağımlılık.** Kaçınılmaz dış servisler (kart ödeme, e-fatura iletimi, SMS, kargo taşıma) en ince katmanda; geri kalanı bizde veya self-host (`docs/15` §8).

## Bu aşamanın kapsamı (Backend + Admin) — F0–F17
Hedef: eksiksiz bir e-ticaret altyapısı. Dahil:
- **Ticaret:** Medusa çekirdek, TR lokalizasyon, katalog + markalar + **SEO motoru** (URL/301/sitemap/JSON-LD/advisor/içerik sayfaları), stok/depo/rezervasyon,
  toplu içe/dışa aktarma, fiyat listeleri, fiyat geçmişi (indirimden önceki 10 günün en düşüğü), kupon/kampanya, hediye kartı
- **Ödeme:** iyzico, PayTR, havale/EFT, kapıda ödeme, ödeme yönlendirici
- **Operasyon:** kargo (doğrudan taşıyıcı: Aras, Yurtiçi; diğerleri istendikçe), sipariş düzenleme, iade (RMA) ve değişim, ters ibraz, e-fatura/e-arşiv (UBL bizde), e-posta/SMS bildirimleri
- **Büyüme:** müşteri hesabı, sosyal giriş, favoriler, stok bildirimi, yorumlar, Soru-Cevap, terk edilmiş sepet,
  ürün feed'leri (Merchant API), sunucu taraflı dönüşüm olayları, Search Console/CrUX ölçümü, LLM içerik taslakları (opsiyonel),
  raporlar, muhasebe aktarımı, tenant dış API'si ve webhook'ları
- **Platform:** admin genişletmeleri, yasal uyum, veri taşıma araçları, güvenlik/dolandırıcılık önleme,
  dağıtım ve tenant işletimi, control plane (abonelik, paketler, onboarding)

Hariç (sonraki aşama): storefront ve çoklu tema (F18); pazaryeri, B2B, yurt dışı satış, sadakat, çok kanallı satış, ajan ticareti (F19).
Rakipler ve konumlandırma: `docs/15-rakip-analizi-ve-farklilasma.md`.
Ancak backend kararları **çoklu temayı** destekleyecek şekilde alınır (Store API temiz, tema bağımsız; bkz. F18).

Kod dışı gereksinimler (hukuk, mali, sağlayıcı anlaşmaları): `docs/12-kod-disi-gereksinimler.md`.

## Başarı ölçütleri (bu aşama sonu)
- Admin'den ürün girip, Store API üzerinden (Postman/HTTP test) sipariş oluşturup iyzico sandbox ile ödeme alınabiliyor.
- Sipariş → taşıyıcı (Aras/Yurtiçi) test gönderisi → takip güncellemesi → müşteri bildirimi → e-arşiv test faturası uçtan uca çalışıyor.
- Başka platformdan gelen örnek mağaza verisi (ürün, müşteri, URL'ler) kayıpsız taşınabiliyor.
- Kupon + kampanyalı, kısmi iadeli bir sipariş; ödeme, fatura, stok ve raporda tutarlı görünüyor.
- Yeni tenant bir komutla (script) ayağa kaldırılabiliyor; F17 sonunda self-servis kayıtla açılabiliyor.
- Ödeme/kargo/fatura modüllerinde entegrasyon test kapsamı ≥ %80.
- Demo mağaza (F18 ilk tema) `/seo-audit` ve Lighthouse SEO denetiminden kritik bulgusuz geçiyor; her ürün sayfası geçerli `ProductGroup/Offer` JSON-LD basıyor.
- Hiçbir SEO bilgisi olmayan kullanıcı, yalnızca ürün adı + görsel + fiyat girerek advisor önerileriyle 70+ skorlu ürün sayfası çıkarabiliyor.
