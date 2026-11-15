# Oğuzhan — oturum notları

> Yalnız Oğuzhan'ın oturumlarının notları; en yeni en üstte. Ortak durum `PROGRESS.md`'de.

## 2026-11-15 gündüz: görünüm izolasyonu, stil takımı, öğe düzeyinde "Düzenle"

- **Amaç:** İki geliştiricinin hazır görünümleri birbirini bozmasın (adr/0066 tema katmanları, adr/0067 stil takımı), stil takımının beş adımını koda taşımak, canlı düzenleyicide Faz 2 ve Faz 2b.
- **`dev`'e giren PR'lar:**
  - #39 başlık testi düzeltmesi, #40 düzenleyici Faz 2 (önizlemede bölüm üstünde "Düzenle"), #51 düzenleyici ağacında ipucu.
  - #41 "Aynı işi iki kez yapma" kuralı, #46 "Yayımlanmış biçim sözleşmedir" kuralı, #50 ADR-0066, #53 ADR-0067.
  - #52 ve #55 görünüm kilidi testi (çerçeve, ana sayfa, ürün, liste; `pnpm lock:presets`), #58 çözülmüş stil denetimi (`pnpm style:capture`, `pnpm style:diff`), #59 stil takımı sözleşmesi.
  - #43 bakım kapısı (bakımda yazma yolları kapalı).
  - #42 menü resimleri ayarı (`header_bar.menu_images`: all, submenus, off), #49 açılış panosu slayt gösterisi.
  - Stil takımı: #62 `chip_style`, #63 `media_ground`, #65 `menu_style`, #66 `shadow`, #64 `surface_style` kapsamı (80 kutu `gf-pane` / `gf-pane-inner`), #67 işaretlerin portallara ulaşması (`frame/root-marks.ts`, `frame/Layers.tsx` `LayerPortal`), #72 çizgili stilde sepet özeti, adet denetimi ve Tezgâh'ta çizgili stilin çekmece ve pencerelere ulaşması.
  - Düzenleyici Faz 2b: #68 öğe düzeyinde "Düzenle" (`data-qf`, yalnız geçerli düzenleyici oturumunda) ve güvenlik düzeltmeleri (basış kapısı: çerçeve odakta ve saniyede 4, geçerli oturum koşulu), #71 kalan bölümler (SSS, bant, kayan yazı, rozetler, sekmeler, sütunlu raf, fiyat bantları, katalog üst bilgisi, alt bilgi bülteni).
  - #70 yakınlaştırma kapanınca odak düğmeye döner, `CLAUDE.md`'ye stil denetimi komut satırı.
- **Kanıt düzeni:** Tema çizimine dokunan her PR'da `style:diff` dev ile dal arasında koşuldu (varsayılanlarda değer farkı yok), varsayılan dışı basamak tarayıcıda gözle bakıldı. Son `dev`'de vitrin 1482, panel 1392 test yeşil.
- **Dersler:**
  1. Kökteki `data-*` işareti Radix portallarına ulaşmaz. Katmanlar `LayerPortal` ile çizilir, çıplak `Dialog.Portal` kullanımını test yakalar.
  2. Taşıyıcı yalnız kit basamağı varsayılan dışındayken açılıyordu, bu yüzden Tezgâh'ta çizgili stil çekmecelere ulaşmıyordu (#72).
  3. Ortak geliştirme DB'sinde taslağa yazılan yeni alan, alanı tanımayan dalın önizlemesini 500'e düşürür. Deneme sonrası taslak eski hâline yazılır.
  4. Ana klasörde dal değiştirmek backend'i yeniden başlatır, sahipsiz kalan eski süreç portu tutabilir (`EADDRINUSE`). Vitrin sunucusu dal değişimini kaçırabilir.
  5. wt klasörlerinde backend typecheck 8 hata verir (`apps/backend/.medusa/types` yok). Ana klasörde 0 hata.
  6. Docker Desktop kapanırsa Redis düşer, vitrin her sayfada 500 verir.
- **Yerel durum:** Taslakta Tezgâh (yayın değişmedi, yayında Grafit). `free_shipping_threshold` geçici 1500 duruyor (geri alınacak). Bakım kapalı.
- **Doğrulanmayanlar:** Safari ve iOS (Playwright'ta WebKit kurulu değil), gerçek üretim derlemesinde CSP (kurallar geliştirme sunucusunda taklit edildi, ihlal yok), hesap ve sipariş sayfalarında çizgili stil (demo veride yok), hızlı bakış ve taksit penceresinde stil takımı (yerelde açılamadı).
- **Sıradaki işler:**
  1. Tezgâh'ın yeni basamakları seçmesi (çizgili çip, sayfa zemini, menü stili, gölge): sahibin göreceği karar, yalnız `layout.json` verisi.
  2. `deniz/katalog-ust-sade`: menü stili ve gölge adımları `dev`'de, dal bunların üstüne kurulabilir (adr/0067 §5).
  3. Faz 2b: "Tümünü gör" bağlantıları ve alt bilgi çubuğu işaretli değil. `slide-dialog.tsx` ve `use-live-preview.ts` 300 satırın üstünde.
  4. Yoğunluk basamağı (`density`) ve tema ayarlarının ayar araması (adr/0067 açık kalanlar).
  5. Üretim CSP'sinde http demo medya ve satır içi stil ihlali.
  6. Bakım modu Store API'de uygulanmıyor.

## 2026-11-15 gece: Tezgâh görünümü ve tarayıcı turları

- **Amaç:** Sahibin referans resmindeki klasik teknik katalog düzeninden, bıçak içeriğiyle ikinci hazır görünüm "Tezgâh" (`packages/sector-packs/packs/cutlery/presets/tezgah`; renk kardeşleri `tezgah-lacivert`, `tezgah-turuncu`). Kod sektörsüz. Tasarım dili `docs/tema/tezgah-tasarim-dili.md`.
- **`dev`'e giren PR'lar:**
  - #19 üst bilginin `catalog` biçimi (yardımcı şerit, arama, telefon, Kategoriler paneli, menü zemini, vurgulu bağlantı).
  - #20 ürün rafı biçimleri (grid, carousel, featured, compact, columns), kompakt kart, ortak kaydırma takımı (`scroller`).
  - #21 `categories` `linked` biçimi; alt bilgide sosyal simge, yazılı ödeme rozetleri, yukarı çık.
  - #22 Tezgâh görünümü.
  - #23 `docs/tema/bilesen-standardi.md` ve `bilesen-denetimi.md`.
  - #24 denetimin küçük işleri (içerik alanları ayar aramasında, "Diğer ayarlar", "Görsel bant").
  - #25, #27, #30, #33, #34 Tezgâh tarayıcı turlarının düzeltmeleri (yeni tema ayarları `section_spacing`, `surface_style`; "Daha fazla" menü açılırı; sepet sayacı kontrastı; büyük kart).
  - #26 ortak `device` ayarı, duyuru şeridi biçimleri (`mode` first/rotate/inline), SSS `open_first`/`single_open`, `columns_mobile`, benzer ürünlerde biçim ve kart.
  - #28 kart ayarları (etiket aç/kapatları, `sold_out_row`, `no_reviews`, `button_style`), tema ayarları ayar aramasında.
  - #29 raf `tabs` ayarı, giriş slaytı ortak kaydırma takımında, zemin adı `light` → `well`.
  - #32 çökme düzeltmesi ve `client-boundary.spec.ts` koruma testi, benzer ürünler için store alanı `*categories`.
- **Açık PR:** #31 hızlı bakış penceresi (tema ayarı `quick_view`, varsayılan kapalı; `GET /api/quick-view`). security-reviewer: kritik, yüksek, orta yok; 3 düşük bulgu kapatıldı. Birleşmeden önce: ana klasörde http `theme-settings` testi, tarayıcıda açılış kontrolü.
- **Dersler:**
  1. Sunucu bileşeni `"use client"` dosyasındaki bileşen olmayan bir fonksiyonu çağırınca sayfa 500 veriyor, vitest yakalamıyor (PR #28 ile `dev`'e girdi, #32 ile kapandı).
  2. CSS düzeltmesi gözle bakılmadan birleşince büyük kart fotoğrafı kayboldu (#33 → #34). Kural: arayüz PR'ı tarayıcıda doğrulanmadan birleşmez; SSR 200 yetmez.
  3. Yerelde backend http testleri `ADMIN_MFA=off` ister.
  4. Alt ajan komutlarında heredoc ile dosya yazmak izin sorusu çıkarıyor; betik Write ile yazılır.
- **Yerel durum:** Taslakta Tezgâh uygulu (yayın yok; yayındaki düzen değişmedi). Mağaza ayarında `free_shipping_threshold` geçici 1500 (geri alınacak). Önizleme: panel > Tema düzenleyici.
- **Bilinen açıklar:**
  - Önizlemede arama ve `/sepet` önizlemeden çıkıyor (adr/0065 Faz 1 kapsamı).
  - Yukarı çık düğmesi 1024 px ve telefonda içeriğe 12–20 px biniyor.
  - Büyük kartta yatay fotoğrafın üstünde ve altında ton bandı var.
  - `bilesen-denetimi.md`'deki (c) büyük işler; puana göre sıralama, karşılaştırma, özel rozetler.
  - adr/0064 (görünüm kitaplığı) ve adr/0065 (canlı düzenleyici) işleri başlamadı.
- **Sıradaki:** #31'i kapat; adr/0065 Faz 1 (güvenlik incelemesi şart); kalan Tezgâh kusurları; adr/0064 G1.
- **Açık sorular (sahibe):** Varsayılan renk takımı (antrasit + kırmızı / lacivert + çelik / antrasit + turuncu). Demo mağaza verisi (telefon, sosyal adres, blog yazısı, Kasap alt kategorileri kapalı).

## 2026-11-14: Atölye tamamlama, Faz 1 ve Faz 2 başlangıcı

- **Plan:** `docs/tema/atolye-tamamlama-plani.md` (Faz 0–6, sahip kararları, ek istekler E1–E8, maket seçimi). Yeni tema yazılmıyor; Atölye tamamlanıyor, sonra aynı temadan hazır görünümler çıkıyor.
- **Biten:** Faz 0 (adr/0062, adr/0063), Faz 1 (Atölye bütün tema ayarlarını uygular; `dev`'de). Faz 2 iş 2.1 (tema ayarı ve menüler düzen taslağına, önizlemeye ve yayına girer) ve 2.2 (hazır görünüm şeması, yükleyici, `grafit` görünümü): `oguzhan/hazir-gorunum-altyapisi` dalında, PR açık.
- **Kararlar:** adr/0049 Ek 2026-11-14 (bölüm biçimleri, yeni bölüm türleri, üst bilgi ve menü modeli, kategori başına düzen, bölüm başına gelişmiş CSS) ve adr/0063 Ek 2026-11-14 kabul edildi.
- **Deniz'in alanına dokunanlar (bu PR):** backend düzen belgesi ve menü akışları, denetim kaydı kaynağı, `packages/sector-packs` (`general` paket sürümü 1 → 2), üst panel sayım tipi ve sahte sağlayıcı.
- **Sıradaki:** iş 2.3 (`applyPresetWorkflow`), bölüm `variant` altyapısı (adr/0049 eki §9), ardından klasik katalog takımı.
- **Not:** `pnpm verify:changed` bu makinede paralel koşuda zaman aşımı kaynaklı sahte kırmızı veriyor; `--concurrency=1` ile yeşil. Yerelde `ADMIN_MFA=off` varsa `mfa.unit.spec.ts` düşer (turbo ortam değişkenini geçirmiyor); tek başına `ADMIN_MFA= pnpm test:unit` ile geçiyor.
