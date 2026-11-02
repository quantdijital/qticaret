# ADR-0048: Mağaza bilgileri tek kaynaktan

- **Durum:** Kabul (2026-11-02). Kullanıcı planı onayladı: "önerilerini beğendim uygulamaya başla".
- **Tarih:** 2026-11-02
- **İlgili:** adr/0041 (yasal metinler ve belirteçleri), adr/0046 (vitrin), adr/0047 (iletişim formu), adr/0012 (ayar bölümleri)

## Bağlam

Kullanıcı: "yasal metinler kısmını zaten firma bilgilerinden otomatik üretilecek şekilde ayarladık … ekstra neden içerik kısmında sayfa oluşturuluyor … bunun gibi seo içeriklerinin hepsini, iletişim bilgilerini vs oluşturduğumuz yapılardan çekelim."

2026-11-02 taraması:

1. **Yasal metin kopyaları:** mylarte profil betiği (`shop:profile`) eski sitenin 12 sayfasını adresleri değişmesin diye içerik sayfası yapmıştı. 8'i yasal metindi (satış sözleşmesi, KVKK, çerez, iade ve 4 toptan metni). Asıl yasal metinler yasal modülde firma bilgilerinden üretilip `/yasal/...`'da yayınlanıyor. Alt bilgide de kopya bağlantılar vardı.
2. **Elle yazılmış iletişim bilgisi:**
   - İletişim sayfası metninde adres, telefon, e-posta ve çalışma saatleri yazılıydı.
   - Duyuruda ve güven rozetinde ücretsiz kargo eşiği ("1500 TL") elle yazılıydı.
   - Aynı numara iki yerde girilmişti: Mağaza'da telefon, Vitrin'de WhatsApp.
   - Çalışma saatleri ve harita konumu hiçbir yapıda yoktu.
3. **Doğru olanlar:** alt bilgi, yasal metinlerin belirteçleri, yapısal veri ve e-postalar zaten ayarlardan okuyordu.

## Karar

1. **Yasal metinler yalnızca yasal modülden.**
   - İçerik sayfası olarak açılmaz.
   - Profil biçimine `retired_pages` eklendi: profilin artık istemediği sayfalar yüklemede (varsa) silinir; yolları 410 döner.
   - Eski sitenin adresleri geçiş günü `/yasal/...`'a 301 alır (`docs/gecis/mylarte/esleme.md` §3).
   - Eski site metinleri yalnız başvuru içindir: `docs/gecis/mylarte/eski-yasal-metinler/`.
   - Panelin İçerik ekranı yasal metinler için Ayarlar > Yasal'a yönlendirir; başlığı yasal metne benzeyen yeni sayfada uyarı gösterir (engellemez).
   - Toptan hukuk metinlerinin yasal modülde türü yok; toptan satış özelliği (D14) kararını bekler.
2. **Mağaza bilgileri `store` ve `legal` bölümlerinde.**
   - `store`'a eklenenler:
     - `whatsapp_phone`: `storefront` bölümünden taşındı; `store-whatsapp-phone` göç betiği değeri bir kez kopyalar.
     - `opening_hours`: ISO gün (1 Pazartesi) ve `HH:MM` aralıkları; günde birden çok aralık olabilir, çakışmaz; aralığı olmayan gün kapalıdır.
     - `map_url`: https.
   - Adres ve yasal kimlik `legal` bölümünde kalır.
   - `legalIdentity()` hepsini birleştiren tek okuma noktasıdır.
3. **Okuyanlar.**
   - `/store/legal-identity` artık `whatsapp`, `opening_hours` ve `map_url` da döner.
   - Vitrin bunlarla şu yerleri doldurur:
     - alt bilgi (saatler dahil);
     - ürün sayfasındaki ve ana sayfadaki WhatsApp düğmeleri;
     - iletişim sayfası (`contact_form_path`'teki sayfa): metnin altındaki "İletişim bilgileri" bloğu (telefon, e-posta, adres + harita bağlantısı, saatler, WhatsApp) ve iletişim formu. Sayfanın metni bu bilgileri tekrar etmez.
   - Ana sayfa yapısal verisinde `OnlineStore.contactPoint` (müşteri hizmetleri telefonu, e-postası, `hoursAvailable`).
   - Harita sayfaya gömülmez, bağlantı olarak açılır: CSP `frame-src` değişmez.
4. **Bilgi değişkenleri.** Panelde yazılan metin, mağaza bilgisini adıyla anar ve vitrin o anki değeri basar.
   - **Biçim ve adlar:** yasal metinlerin `{belirteç}` biçimi ve adlarıyla aynı (`{mağaza_adı}`, `{telefon}`, `{e_posta}`, `{adres}`, `{whatsapp}`). Yeni olan `{ücretsiz_kargo_eşiği}`; değeri `₺1.500` gibi basılır.
   - **Nerede:** duyurular, güven rozetleri, ana sayfa girişi; içerik sayfası, blog yazısı ve filtre sayfası metinleri.
   - **Kayıtta:** tanınmayan `{ad}` reddedilir (`platform_settings.token_unknown`, `content.token_unknown`). Yalnız `{harf_rakam}` biçimi sayılır, başka süslü parantez serbesttir.
   - **Gösterimde:** backend doldurur; değeri girilmemiş bilgi boş kalır:
     - `/store/storefront`;
     - içerik ve filtre sayfası HTML'i, başlıkları ve özeti;
     - SEO açıklaması.
   - **Panel:** `GET /admin/shop-tokens` (değişkenler ve şu anki değerleri) "Bilgi ekle" menüsüne ve "Vitrinde: …" önizlemesine kaynaklık eder.
5. **Denetim.** SEO danışmanına `A-DETAIL-01` kuralı eklendi (docs/14 §3.8). İçerik metninde mağazanın telefonu, WhatsApp'ı ya da e-postası elle yazılmışsa değişken önerilir.
6. **Panel: Ayarlar > Mağaza, "Mağaza profili".** Sekmeleri:
   - Genel: ad, logolar, saat dilimi ve birimler;
   - İletişim: e-posta, telefon, WhatsApp, adres, harita, çalışma saatleri;
   - Yasal kimlik;
   - Sosyal hesaplar.

   Vitrin ekranındaki WhatsApp kartı ve Görünüm ekranındaki logo kartı buraya taşındı. Alt alta uzayan kart yığını yerine sekmeler var (kullanıcı: "böyle aşağı doğru dolan bir yapı kurulmaz").

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **`store`/`legal` + değişkenler (seçilen)** | Tek kaynak; yasal metinlerle aynı belirteç dili; geçmiş metinler kendiliğinden güncel | Gösterimde doldurma maliyeti (ayarlar bellekte) |
| İletişim sayfasını sistem sayfası yapmak | Metin hiç yok | Mağaza kendi tanıtım metnini yazamaz; SEO metni yok |
| İçerik belgesine yeni "bilgi" düğümü | Düzenleyicide çip | Belge şeması, işleyici ve göç değişir; düz metin alanlarında (duyuru) yine düz biçim gerekir |
| Değişken yok, yalnız uyarı | Az kod | Her değişiklikte metinler elle düzeltilir |

## Sonuçlar

- **Backend:**
  - `lib/shop/hours.ts`, `lib/shop/tokens.ts`, `lib/shop/written-details.ts`, `lib/security/https-url.ts`;
  - `workflows/shop/info-values.ts`;
  - `migration-scripts/store-whatsapp-phone.ts`;
  - `api/admin/shop-tokens`;
  - HTTP testleri: `storefront-frame`, `legal-identity`, `content-saves` ve `shop-tokens`.
- **Vitrin ve tema:**
  - `ContactView.hours` ve `mapHref`;
  - `ContentPageView.contact`, temada `ContactDetails`;
  - `lib/views/hours.ts`.
- **mylarte profili:**
  - WhatsApp, saatler ve harita `store` bölümünde;
  - duyuru ve rozet `{ücretsiz_kargo_eşiği}` kullanıyor;
  - iletişim ve toptan metinlerinde elle yazılı bilgi yok (toptanın 08:00–17:00 saatleri mağaza saatlerinden farklı, kullanıcı kararı: esleme §5).
