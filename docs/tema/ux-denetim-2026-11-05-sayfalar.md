# UX denetimi: sayfalar (2026-11-05)

> Sahibin isteği (2026-11-05): "web sitemizin arayüzünde mobil ve laptoplarda responsive alanlar, UX akışını bozacak veya UX açısından daha iyi, verimli olabilecek alanları incele ve önerilerini uygula." Sahip yokken karar verildi, uygulandı.
> Kapsam (bu belge): ürün sayfası, sepet çekmecesi ve `/sepet`, `/odeme`, kart ve 3-D sayfaları, teşekkür/sipariş sayfası, sipariş bulma, giriş/kayıt/şifre, hesap sayfaları, içerik sayfaları (Hakkımızda, İletişim, SSS, Kargo, Ödeme, Garanti), blog listesi ve yazı, `/yorumlar`, yasal metin, 404/410. Çerçeve (başlık, menüler, alt gezinme, WhatsApp, çerez kartı, alt bilgi), ana sayfa, liste ve arama başka bir denetimin; o tarafa düşen sorunlar § 4'te.
> Kurallar korunuyor: yalnız açık tema; Grafit (`design.md`, kilitli) içinde iyileştirme, yeniden giydirme yok; ürün sayfasının sahip kuralları (7/5, 1440'ta ~680 px kare, küçük resimler altında, sekmeler, yorumlar hemen sonra); blog yazısı tek okuma sütunu; 44 px hedefler; telefonda alanlar ≥ 16 px; uydurma içerik yok; sert engel yalnız gerçek kısıtta.

## 1. Yöntem

- Gerçek tarayıcı (puppeteer-core, yerel Chrome, `:8000`, `STOREFRONT_THEME=atolye`), görünümler: telefon 360×740, 390×844, 430×932; tablet 768×1024; dizüstü 1280×800, 1366×768, 1440×800, 1470×820 (MacBook Air), 1512×860; masaüstü 1920×1080. Telefon ve tablette dokunmatik + mobil öykünme.
- Her görünümde 26 sayfa (4 ürün: çok fotoğraflı + 6 renk, 2 fotoğraflı, iki rengi tükenmiş, en uzun adlı; sepet ve ödeme dolu sepetle; 5 hesap sayfası "Elif Yıldız" ile girişli): ilk ekran görüntüsü, 390 ve 1440'ta tam sayfa; ölçümler: yatay taşma, ana eylemin ilk ekranda olup olmadığı, sabit katmanlar ve çakışmaları, 40 px altı hedefler, 16 px altı alan yazısı, `autocomplete`'siz alanlar.
- Akışlar: misafir olarak ürün → seçenek → "Sepete ekle" → çekmece → `/odeme` (boş gönderim, adres TR seçimleriyle, kargo, ödeme) → kart (sahte PayTR çerçevesi, test kartı 4355 0843 5508 4358, 3-D) → teşekkür; aynısı havaleyle. 390, 1366 ve 1440'ta.
- Betikler ve görüntüler: `scratchpad/agent-ux-pages/` (`before/`, `after/`, `before/flow/`, `work/flow/`), betikler `scratchpad/hallmark/ux-*.mjs`.
- Not: denetim koşarken çerçeve ajanının yarım bir değişikliği (`listing/Toolbar.tsx`) 1512×860'ta 16 sayfayı 500'e düşürdü; o genişliğin "önce"si 1470 ve 1920 ile okunmalı.

## 2. Bulgular ve uygulanan düzeltmeler

| # | Yer | Görünüm | Sorun | Etki | Seçilen düzeltme |
|---|-----|---------|-------|------|------------------|
| 1 | Ürün, üst blok | 768×1024 (tablet, yan telefon) | Galeri tek sütunda ekran genişliğinde 720 px kare: ad, fiyat ve "Sepete ekle" 1.473–1.608 px'te, ilk ekranın altında | Tablette ürünü fiyatı görmeden kaydırmak; dönüşüm kaybı | 768 px'ten galeri ve satın alma sütunu yarı yarıya (`pages.css`); satın alma satırı kap sorgusuyla (sütun < 384 px ise düğme alta, telefonla aynı); görsel `sizes` 768'den. Sonra: "Sepete ekle" 671–719 (iki renkli) / 772–820 (altı renkli) |
| 2 | Ürün, satın alma sütunu | 1366×768 | İki sıra seçenekli üründe (6 renk) "Sepete ekle"nin alt kenarı 772 px: kesik | Kısa dizüstünde ana eylem ilk ekranda değil | Kısa dizüstünde (≥ 1024 px, yükseklik ≤ 832 px) sütunun aralıkları 24 → 16 px (`.gf-buy-stack`). Sonra: 692–740 |
| 3 | Ürün, seçenekler | tümü | Tükenmiş değer seçilmeden belli değil (Chuby: Kırmızı ve Mor tükendi, haplar stoktakiyle aynı); ziyaretçi seçince "Tükendi" görüyor | Boşa dokunuş, hayal kırıklığı | Öteki seçimlerle stokta varyantı olmayan değer: hapta yazı üstü çizili `text-3`, renk dairesinde soluk + çapraz çizgi, ekran okuyucuya "…, Tükendi"; seçilebilir kalır (stok bildirimi) |
| 4 | Ürün, telefonun satın alma çubuğu | < 1024 px | Çubuk adı yazıyor, hangi rengin sepete gireceğini değil | Yorumları okurken çubuktan eklenen varyant belirsiz | Seçenekli üründe adın yerine seçim ("Sap rengi: Kahverengi"), seçeneksizde ad |
| 5 | Ürün, çubuk + ekran klavyesi | dokunmatik | Yorum/soru/arama alanına yazarken sabit çubuk klavyenin üstüne binebiliyor (iOS) | Alan ve klavye örtülür | `pointer: coarse`'ta bir alana yazılırken çubuk aşağı çekilir |
| 6 | Ödeme, adım geçişi | 1366×768, 1440×800 | Adres → kargo: açılan adım 502 px'te başlıyor, "Ödemeye geç" 810–862'de (katın altında); ödeme adımı 646'da başlıyor | Geniş ekranda düğmeyi aramak için kaydırma | Açılan adım pencerenin altında bitiyorsa geniş ekranda da başa kaydırılır (telefonda hep). Sonra 1366'da: kargo adımı 144–504 |
| 7 | Ödeme, ödeme adımı | < 1024 px | Toplam yalnız en üstteki katlı çubukta; ödeme düğmesine gelince 1.000+ px yukarıda | Ödemeden önce tutarı görmek için yukarı dönmek | Yapışkan düğmenin hemen üstünde "Toplam" ve tutar (backend'in sözü) |
| 8 | Ödeme, iletişim | 1440, 1920 | E-posta ve telefon alanları 824 px genişlikte | Uzun alanlar okunaksız, adres adımı gereksiz uzun | 640 px'ten iki alan yan yana (ad-soyad gibi) |
| 9 | Ödeme / adres defteri | tümü | İl, ilçe, mahalle seçimlerinde `autocomplete` yok | Tarayıcı adres defteri ili dolduramıyor | `address-level1/2/3` (ilçeler ilden yüklenir; il dolunca zincir başlar) |
| 10 | Kart sayfası | 390 | Kilit notu `h2`'nin 28ch sınırıyla üç satıra kırılıyor | Kart formu ~40 px aşağıda | Not satırın tamamını kullanır (`max-w-none`) |
| 11 | Sepet çekmecesi | tümü | Not "Kargo ve indirim kodları ödeme adımında hesaplanır." diyor; kod alanı ödemede yok, yalnız `/sepet`'te | Çekmeceden ödemeye geçen kodunu hiç giremez | Not: "Kargo ödeme adımında hesaplanır. İndirim kodunuz varsa sepette girin." (ödemeye kod alanı § 3) |
| 12 | Teşekkür, havale | 390, 1440×800 | IBAN ilk ekranın altında (telefonda ~800 px, 1440'ta 690'dan sonra); sahnenin tek düğmesi "Alışverişe devam et"; IBAN'ı kopyalamak parmakla seçmeye kalıyor | Havale bekleyen siparişte asıl iş (ödemek) zor | Havale bekliyorsa sahnenin düğmesi "Havale bilgilerine geçin" (`#havale`), yanında "Alışverişe devam et" bağlantı; IBAN'ın yanında "Kopyala" (adı "IBAN'ı kopyala", basınca "Kopyalandı") |
| 13 | Sipariş, ürünler | 390 | Tutar sağda sütun kaplıyor: uzun ad ("El Yapımı Balta Çakı \| 21 cm N690 Böhler Çelik - Kompakt Özel Tasarım Kabza") 6 satıra kırılıyor | Okunmuyor, sayfa uzuyor | Telefonda tutar adın altında, 640 px'ten yanında |
| 14 | Hesabım | < 1024 px | Hesabın tek menüsü (Siparişlerim, Favorilerim, Adreslerim, Bilgilerim, Çıkış) ~600 px'lik son sipariş sahnesinin altında, ilk ekranın dışında | Alt gezinmeden "Hesabım"a gelen menüyü göremiyor | Telefonda menü selamın hemen altında, son sipariş ondan sonra; 1024 px'ten değişmedi |

Telefonda üründen ödenmiş siparişe (kartla): seçenek 1, "Sepete ekle" 1, çekmecede "Ödemeye geç" 1, 6 yazma + 3 seçim, "Kargo seçeneklerine geç" 1, "Ödemeye geç" 1, sözleşme kutusu 1, "Kart bilgilerine geç" 1, kart 4 alan + "Ödeme yap" 1, 3-D kodu + "Onayla" 2: **~24 dokunuş**, havaleyle 18. Kargo adımı iki firma sunulduğu için ayrı kalıyor.

## 3. Bakılan, değiştirilmeyenler (neden)

- **Telefonda ürünün ilk ekranında fiyat yok** (390×844: ad 733 px'te, fiyat ve düğme altında): sahibin kuralı ("telefonda kare tam genişlik, küçük resimler ilk ekranda"; çubuk "Sepete ekle" satırı yukarı kaydıktan sonra). Çubuğu ilk yüklemede göstermek alt gezinmeyi baştan kapatır ve seçenekli üründe ziyaretçi seçenekleri görmeden varsayılan varyantı ekleyebilir; dokunulmadı.
- **Galerinin küçük resim okları 32 px genişlikte** (yükseklik 55–153 px): `design.md`'nin "ince (2rem)" kuralı; WCAG 2.5.8'in 24 px'ini geçer, sıra parmakla da kayar.
- **"Ödeme düğmesi klavyenin üstünde"**: görünüm alanı varsayılanı (`resizes-visual`) ile sabit/yapışkan çubuklar iOS'ta da Android'de de klavyenin arkasında kalır; ödeme adımındaki tek yazma alanı doğum tarihi, adres formu klavyenin "Git" tuşuyla gönderilir (önce tarayıcı bakar, sorunlu alana odak). `interactive-widget=resizes-content` alt gezinmeyi ve bütün sabit katmanları da klavyenin üstüne taşır: çerçevenin kararı, uygulanmadı.
- **Ödeme adımında indirim kodu alanı**: sözleşmede yok (`CheckoutActions`, `CheckoutPageView` kod eylemi ve uygulanan kodları taşımıyor); eklemek sözleşme + vitrin + iki tema değişikliği (ADR konusu). Şimdilik çekmece notu doğruyu söylüyor (# 11).
- **Kayıt formunun "Hesap oluştur"u 1280–1470 genişlikte 902 px'te**: altı alan + sözleşme + kutu bir ekrandan uzun; olağan, alanlar sıkıştırılmadı.
- **Galeri kaydırma ipucu**: "1 / 11" durum hapı ve hemen altındaki küçük resimler yeterli; ayrı ipucu eklenmedi.
- **İletişim formunda konu, sipariş no, mesaj `autocomplete`'siz**: kişisel veri değil, tarayıcının dolduracağı bir şey yok.
- **Kart çerçevesinin alanları** (`inputmode`, yazı boyu): PayTR'nin sayfası, bizim değil.
- **Teslimat kuyusunda iki benzer satır** ("1.500,00 TL ve üzeri siparişlerde kargo ücretsiz." ve güvence "Ücretsiz kargo · ₺1.500 ve üzeri"): mağazanın iki ayrı verisi (kargo notu ve güvence); tema birini seçmez.

## 4. Çerçeveye düşenler (çerçeve ajanına bırakıldı)

- **WhatsApp düğmesi "Sepete ekle" satırındaki favori kalbini örtüyor**: sayfa açılır açılmaz, kaydırmadan. Önce: 1280×800'de tamamen, 1366×768 ve 1440×800'de kısmen; bu işten sonra (satır yukarı çıktı) 1366×768'de kalbin çoğu (düğme 1286–1342 × 688–744, kalp 1270–1318 × 692–740), 1280×800'de bir köşesi, 1440×800 ve 1470×820'de örtmüyor. Aşağı kayarken çekilmesi ilk ekranı çözmüyor; ürün sayfasında geniş ekranda da yer ya da köşe gerekiyor. **Çözüldü (9d34c316):** düğme yerinde kalır, ama `data-gf-clear` işaretli bölümlerin (ürünün fotoğrafları ve satın alma sütunu, sekmeler, yorumlar, benzer ürünler, alt bilgi) bir denetimi altına gelince çekilir (`frame/WhatsAppClear`, yuvarlak yüzünün içinde isabet denemesi). 11 görünüm × 5 ürünlük ölçümde ilk ekranda altında kalan denetim 24 → 0, yukarı dönüşlerde 38 → 0; 390/430 px, 1512×860 ve 1920×1080'de ilk ekranda görünür kalır.
- **Ödeme ve kart sayfalarında tam başlık**: arama kutusu ve reyon satırı telefonda 117 px, masaüstünde 133 px; ödemede dikkat dağıtıyor, kısa ekranda yer yiyor (katlanan başlık kaydırırken kısmen çözüyor; sade bir ödeme başlığı ayrıca düşünülebilir). **Çözüldü (a0602ab7):** `/odeme`, `/odeme/kart`, `/odeme/durum` sade ödeme çerçevesinde (yazı markası, kilitli "Güvenli ödeme", WhatsApp ya da telefon, "Sepete dön"; alt bilgi yalnız küçük yazı); başlık + duyuru 153 → 57 px (390), 169 → 81 px (1366); `design.md` § Satın alma sayfaları.
- **İlk ziyarette çerez kartı** telefonda alttaki 212 px'i örtüyor; ürün sayfasında satın alma çubuğu kartın altında kalıyor (z 400 > 300). Onay önce gelmeli; kabul edilebilir, not.
- Next.js'in geliştirme göstergesi ("N") sol altta: yalnız dev.

## 5. Doğrulama

- **Sonra görüntüleri:** aynı 10 görünüm × 26 sayfa (`after/`), akışlar 390 kart, 390 havale, 1366 havale (`after/flow/`, `work/flow/`). Ana eylemin alt kenarı (önce → sonra): 768×1024 ürün 1.473–1.608 → 619–820 px; 1366×768 altı renkli ürün 772 → 740; 1440×800 691, 1470×820 692 (sahibin kuralı korunuyor); telefonlar değişmedi (sahibin kuralı). Ödeme 1366×768'de kargo adımı 144–504 px'te, düğmesi katın üstünde. Bütün sayfalar 200/404, hiçbir genişlikte 16 px altı alan yok.
- **Yatay taşma:** 320, 360, 414, 600, 768, 900, 1024, 1180, 1280, 1366, 1600, 1920 px'te ürün (2), sepet, giriş, kayıt, sipariş bulma, iletişim, ödeme seçenekleri, blog yazısı, yorumlar, yasal metin, 404 ve havaleli sipariş sayfası: 0 px.
- **axe (serious/critical):** 390 ve 1440'ta ürün, ürün + açık çekmece, dolu `/sepet`, `/odeme`, altı içerik sayfası, blog, yazı, yasal metin, 404, havaleli sipariş, beş hesap sayfası (girişli): 40 denetim, 0 bulgu.
- **CLS (ürün sayfası, soğuk yükleme ve baştan sona kaydırma):** 390, 768, 1440'ta 0,0000.
- **sloplint `--render`:** ürün sayfası, `/sepet`, `/odeme` (oturumsuz: boş sepet ve sepete dönüş): bu işin dosyalarında 0 FAIL; tek FAIL çerçeve ajanının yarım `frame.css` kuralı (gate 62, WhatsApp'ın gizli hali), ona ait.
- **e2e (Playwright, `:8000`):** `checkout addons paytr-frame payment-link a11y smoke` 52/52 (ilk koşuda sunucu denetimle yüklüyken iki `paytr-frame` testi 5 sn beklemede kaldı; yüksüz ikinci koşu temiz).
- **Vitest:** vitrin 111 dosya, 690 test (ürün, sipariş, ödeme, hesap temalarına yeni beklentiler: tükenmiş değer ve çubuğun seçimi, havalede `#havale` yolu ve telefonda satır tutarı, ödemede toplam ve `address-level1`, telefonda önce menü).
- **turbo** `typecheck` + `lint` (storefront, theme-atolye): 11/11; prettier temiz.
