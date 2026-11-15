# ADR listesi ve numara ayırma

Yeni ADR açmadan önce numarasını burada **ayır**: `dev`'i çek, tablonun sonuna bir satır ekle (`Ayrıldı`, adın, tarih), yalnız bu satırla commit et ve hemen `dev`'e push et (CLAUDE.md "Ortak çalışma"). Push çakışırsa `dev`'i yeniden çek: numara alınmışsa sıradakini al. ADR dosyası kendi dalında yazılır; birleşince satırdaki "Ayrıldı" başlıkla değişir. Vazgeçilen numara "Kullanılmadı" olarak kalır, yeniden verilmez.

Şablon: [0000-sablon.md](0000-sablon.md).

| No | ADR | Ayıran |
|---|---|---|
| 0001 | [Tenant modeli ve Medusa sürümü](0001-tenant-modeli-ve-medusa-surumu.md) | — |
| 0002 | [Sağlayıcı kimlik bilgilerinin yönetimi](0002-saglayici-kimlik-bilgileri.md) | — |
| 0003 | [Hosting, bölge ve veri yerleşimi](0003-hosting-ve-veri-yerlesimi.md) | — |
| 0004 | [Store API kimlik doğrulama modeli](0004-store-api-kimlik-dogrulama-modeli.md) | — |
| 0005 | [İçerik ve SEO önerileri — kural motoru önce, LLM opsiyonel](0005-icerik-onerileri-kural-motoru-ve-llm.md) | — |
| 0006 | [Yerel S3 emülatörü (SeaweedFS) ve geliştirme imajlarının sabitlenmesi](0006-yerel-s3-emulatoru.md) | — |
| 0007 | [KDV modeli (ürün tipi = KDV grubu)](0007-kdv-modeli.md) | — |
| 0008 | [Türkiye adres referans verisi (il/ilçe/mahalle) kaynağı ve modeli](0008-tr-adres-veri-kaynagi.md) | — |
| 0009 | [Müşteri vergi kimliği (TCKN / VKN) saklama ve gösterimi](0009-musteri-vergi-kimligi.md) | — |
| 0010 | [Para tutarı temsili, yuvarlama ve oransal dağıtım (`lib/money`)](0010-para-tutari-ve-yuvarlama.md) | — |
| 0011 | [Denetim kaydı (audit log) modeli](0011-denetim-kaydi.md) | — |
| 0012 | [Platform ayarları ve özellik bayrakları (`platform-settings`)](0012-platform-ayarlari-ve-ozellik-bayraklari.md) | — |
| 0013 | [Ürün özellik şablonları (`product-attributes`) veri modeli](0013-urun-ozellik-sablonlari.md) | — |
| 0014 | [Asenkron iş altyapısı (iş kaydı, ilerleme, sonuç dosyası)](0014-asenkron-is-altyapisi.md) | — |
| 0015 | [SEO alanlarının saklanması ve Store API `seo` payload'u](0015-seo-alanlari-ve-store-seo-payload.md) | — |
| 0016 | [Görsel işleme hattı (EXIF temizleme, yeniden kodlama, türevler)](0016-gorsel-isleme-hatti.md) | — |
| 0017 | [Yönlendirme motoru (`seo-redirects`) ve güvenli desen eşleme](0017-yonlendirme-motoru.md) | — |
| 0018 | [Tablo dosyaları (xlsx) içe ve dışa aktarma](0018-tablo-dosyalari.md) | — |
| 0019 | [Zengin metin içeriği (içerik sayfaları, blog, açıklamalar)](0019-zengin-metin-icerigi.md) | — |
| 0020 | [Stok hareket defteri, düşük stok uyarısı, ön sipariş ve kilit sağlayıcısı](0020-stok-hareketleri-ve-dusuk-stok.md) | — |
| 0021 | [Yönetici paneli varsayılan düzeni, çekirdek Türkçe metinler ve hata mesajları](0021-yonetici-paneli-varsayilan-duzen-ve-cekirdek-metinler.md) | — |
| 0022 | [Yönetici paneli kendi uygulamamızdır (Medusa Admin yerine)](0022-yonetici-paneli-kendi-uygulamamiz.md) | — |
| 0023 | [Fiyat geçmişi ve indirimli fiyat gösterimi (son 30 gün kuralı)](0023-fiyat-gecmisi-ve-30-gun-kurali.md) | — |
| 0024 | [Kupon ve kampanya kuralları](0024-kupon-ve-kampanya-kurallari.md) | — |
| 0025 | [Hediye kartı ve mağaza kredisi](0025-hediye-karti-ve-magaza-kredisi.md) | — |
| 0026 | [Barındırılan ödeme formlarında ödeme akışı](0026-barindirilan-odeme-formu-akisi.md) | — |
| 0027 | [Sağlayıcı hesap bilgileri panelden girilir, veritabanında şifreli durur](0027-saglayici-bilgileri-panelden.md) | — |
| 0028 | [Geliştirme ortamında ödeme deneme sayfası](0028-gelistirme-odeme-deneme-sayfasi.md) | — |
| 0029 | [Çevrim dışı ödemeler: havale/EFT ve kapıda ödeme](0029-cevrim-disi-odemeler.md) | — |
| 0030 | [Ters ibraz kaydı ve belge paketi](0030-ters-ibraz-kaydi-ve-belge-paketi.md) | — |
| 0031 | [Kargo altyapısı, gönderi takibi ve etiketler](0031-kargo-altyapisi-ve-takip.md) | — |
| 0032 | [İade talebi (RMA) akışı](0032-iade-talebi-akisi.md) | — |
| 0033 | [Sipariş düzenleme](0033-siparis-duzenleme.md) | — |
| 0034 | [E-Fatura / e-Arşiv altyapısı](0034-e-fatura-altyapisi.md) | — |
| 0035 | [Doğrudan taşıyıcılar: Aras ve Yurtiçi](0035-dogrudan-tasiyicilar-aras-yurtici.md) | — |
| 0036 | [Bildirim altyapısı: e-posta, SMS ve ileti izni](0036-bildirim-altyapisi.md) | — |
| 0037 | [Müşteri hesabı, misafir sipariş erişimi ve etkileşim modülleri](0037-musteri-hesabi-ve-etkilesim.md) | — |
| 0038 | [Pazarlama ve ölçüm: terk edilmiş sepet, İYS, ürün feed'leri, dönüşüm olayları, Search Console](0038-pazarlama-ve-olcum.md) | — |
| 0039 | [Raporlama, muhasebe aktarımı, dış API ve giden webhook'lar](0039-raporlama-muhasebe-ve-dis-api.md) | — |
| 0040 | [Personel rolleri, yönetici 2FA ve yeniden doğrulama](0040-personel-rolleri-ve-yonetici-2fa.md) | — |
| 0041 | [Yasal metinler, onay kayıtları, kısıtlı ürünler ve KVKK talepleri](0041-yasal-metinler-onay-ve-kvkk.md) | — |
| 0042 | [Veri taşıma ve geçiş](0042-veri-tasima-ve-gecis.md) | — |
| 0043 | [Şifre politikası ve sızmış şifre denetimi](0043-sifre-politikasi.md) | — |
| 0044 | [Dolandırıcılık koruması (fraud-guard)](0044-fraud-guard.md) | — |
| 0045 | [Gözlemlenebilirlik: OpenTelemetry izleri, GlitchTip ve yavaş sorgu logu](0045-gozlemlenebilirlik.md) | — |
| 0046 | [Vitrin mimarisi ve tema sözleşmesi](0046-vitrin-mimarisi-ve-tema-sozlesmesi.md) | — |
| 0047 | [Vitrin iletişim formu](0047-iletisim-formu.md) | — |
| 0048 | [Mağaza bilgileri tek kaynaktan](0048-magaza-bilgileri-tek-kaynak.md) | — |
| 0049 | [Vitrin yönetimi: tema düzenleyici ve menüler](0049-vitrin-yonetimi.md) | — |
| 0050 | [Panelden toplu e-posta ve SMS gönderimi](0050-toplu-kampanya-gonderimi.md) | — |
| 0051 | [Panelden sipariş ve ödeme bağlantısı](0051-panelden-siparis-ve-odeme-baglantisi.md) | — |
| 0052 | [Ürün ek seçenekleri (D13)](0052-urun-ek-secenekleri.md) | — |
| 0053 | [Bakım modu ve tema ayarları](0053-bakim-modu-ve-tema-ayarlari.md) | — |
| 0054 | [Ölçüler isteğe bağlı, kargo varsayılan paketle](0054-olculer-istege-bagli-varsayilan-paket.md) | — |
| 0055 | [Ürün açıklaması içerik belgesi olarak](0055-urun-aciklamasi-icerik-belgesi.md) | — |
| 0056 | [Site araması ve listeler PostgreSQL tam metin ile](0056-arama-postgresql-tam-metin.md) | — |
| 0057 | [Vitrinin tema paketi derleme anında seçilir (`STOREFRONT_THEME`)](0057-vitrin-tema-secimi.md) | — |
| 0058 | [Google yorumları: Business Profile API](0058-google-yorumlari-business-profile-api.md) | — |
| 0059 | [Eski platformun kendi adresleri (WordPress)](0059-eski-platform-adresleri.md) | — |
| 0060 | [Blog yazarları](0060-blog-yazarlari.md) | — |
| 0061 | [Üst panel (control plane): teknoloji, veri modeli, güvenlik sınırı ve secret şifreleme](0061-ust-panel-control-plane.md) | — |
| 0062 | [Atölye bütün tema ayarlarını uygular; Grafit kayıtlı varsayılandır](0062-atolye-tema-ayarlarinin-tamami.md) | — |
| 0063 | [Hazır görünümler (preset)](0063-hazir-gorunumler.md) | — |
| 0064 | [Görünüm kitaplığı: kayıtlı tasarımlar ve galeri](0064-gorunum-kitapligi.md) | — |
| 0065 | [Canlı tema düzenleyici: önizleme köprüsü ve anında yansıma](0065-canli-tema-duzenleyici.md) | — |
| 0066 | [Tema katmanları ve görünüm izolasyonu](0066-tema-katmanlari-ve-gorunum-izolasyonu.md) | — |
