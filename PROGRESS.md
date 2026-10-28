# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F8 — E-Fatura / e-Arşiv: PLANLANDI (2026-10-28 öğlen).** Plan aşağıda "F8 görev planı"; ADR-0034 önerildi (entegratör seçimi, mali müşavir doğrulaması ve PDF kütüphanesi kullanıcı kararı). Sahte entegratörle ilerlenir; sıradaki görev E1. Dal `f8-einvoice` (`f7-shipping` üzerinden).

**F7 — Kargo, sipariş operasyonu, iade ve değişim: BAŞLADI (2026-10-28 gece, otonom).** Plan aşağıda "F7 görev planı"; ADR-0031 (kargo altyapısı ve takip) kabul edildi (kullanıcı onayladı). K1–K10 bitti; sıradaki K11 (doğrudan taşıyıcı, kullanıcının kargo firması cevabına bağlı) ve K12 (kapanış incelemesi).

**F6 — Ödeme: alternatif ödemeler + yönlendirici + ters ibraz: BİTTİ (2026-10-28 gece, otonom).** Dal `f6-alternative-payments`. W1–W6; KK1–KK5 işaretli. ADR-0029 ve ADR-0030 otonom kabul edildi (gözden geçir). Kapanışta yerelde: birim 1658, HTTP 81/81 takım (440 test), modül (ters ibraz) 1, panel 220, e2e 29.

**F5 — Ödeme: PayTR + iyzico (+ ortak ödeme altyapısı): BİTTİ (V1–V11, 2026-10-27).** Ertelenenler: gerçek PayTR test penceresi ve iyzico taksitli sandbox ödemesi (sunucuya çıkışta), iyzico webhook'u (gerçek firmayla). Sıradaki faz F6.
- V1: mağaza PayTR hesabını panelden bağlıyor (kullanıcı talebi, ADR-0027 ADR-0002'nin yerini aldı); PayTR istemcisi, sahte PayTR, `packages/testing`. Commit'ler `77c88f6`, `a00fa45` ve dokümanlar.
- Kullanıcı 2026-10-27'de iki sağlayıcının altyapısının da hazırlanmasını istedi; canlıya alma sonra. docs/03 güncellendi.
- PayTR önce yazılıyor: ilk müşterinin firması PayTR'yi canlıda kullanıyor ve test modunda bağlanmayı kabul etti.
- iyzico başvurusu sürüyor; iyzico görevleri PayTR'den sonra geliyor (V8–V10). Havale, kapıda ödeme, yönlendirici ve ters ibraz F6'da kaldı.
- Plan aşağıda "F5 görev planı". ADR-0026 kabul edildi (V1 başında); ADR-0027 kabul edildi, ADR-0002'nin yerini aldı.
- Kullanıcı müşteri tarafını görmek istedi (2026-10-27): ADR-0028 kabul edildi, yalnızca geliştirmede açılan ödeme deneme sayfası V2 ile gelir. CLAUDE.md'ye istisna notu eklendi.
- **Canlıya alma yok (kullanıcı, 2026-10-27):** "müşteriyi şuan canlıya almıcaz, tüm projeyi bitirene kadar devam." Fazlar sırayla (F5 → F19) ilerler; canlıya çıkış için kısa yol (F18'i öne çekme) gündemde değil.
- **Gerçek sağlayıcı testleri ertelendi (kullanıcı, 2026-10-27):** "bildirimleri localhostta izin vermiyorlar, sonra sunucuda gerçek çalıştırır deneriz; gerçek testleri atlayabilirsin, sen altyapı entegrasyonlarını yap." V2–V10 yalnızca sahte sunucularla doğrulanır; V11'in `@sandbox` testleri ve PayTR test penceresi sunucuya çıkışa kaldı. Deneme sayfası (ADR-0028) sahte PayTR'yle çalışır.
- Ayarlar > Ödeme birden çok yönteme göre yeniden kuruldu (kullanıcı talebi, 2026-10-27): yöntem listesi + sağlayıcı başına sayfa. Ardından kullanıcı iyzico bağlantısını istedi: V8 (iyzico istemcisi + hesabın panelden bağlanması) V2'den önce yapıldı; kullanıcının sandbox hesabı panelden bağlandı ve doğrulandı.
- Dal `f5-payments`, `f4-pricing-promotions` üzerinden açıldı (2026-10-27).

**Panel P1–P4 (kendi yönetici panelimiz, adr/0022): ekranlar yazıldı, kullanıcı kontrolü bekliyor** ve **F3 — Katalog, SEO motoru ve stok: BİTTİ** (T1a–T16; kabul kriterlerinin hepsi testlerle işaretli, docs/03; son eksik iki kanıt, danışmanın p95 ölçümü ve yedi sayfa türünün SEO sözleşme testi, kapanışta eklendi). Playwright e2e altyapısı kuruldu; CI düzeltildi. **F4 — Fiyatlandırma ve promosyon: BİTTİ** (plan ve ADR-0023/0024/0025 kabul edildi; U1 `price-history`, U4 kuponlar, U7 indirim dağılımı ve iade tutarı, U2 fiyat listeleri, U3 indirim gösterimi, U5 tek kullanımlık kodlar, U6 otomatik kampanyalar ve kargo bedava eşiği, U8 hediye kartı ve mağaza kredisi bitti (KK1–KK4 işaretli); F4 kapanış incelemesi yapıldı, bulgular düzeltildi: F4 BİTTİ). Dal `f4-pricing-promotions`. Panel hattı F3 backend'iyle paralel yürür; F3'ün admin parçaları panele yazılır. Dal `f3-catalog-seo-stock`, `f2-platform-core` üzerinden açıldı. F2 bitti (S1–S13; KK'ların hepsi işaretli). Dal `f2-platform-core`, F1 merge edilmediği için `f1-tr-localization` üzerinden açıldı. F1, F2 ve F3 dalları push edildi (kullanıcı 2026-10-26: "pushları sen önerdiğinde yapabilirsin"); PR açılmadı.

## Son oturum özeti
> **Sabah için (kullanıcıya):** GitHub Actions 2026-10-27 ~23:45'ten beri işleri başlatmıyor: "recent account payments have failed or your spending limit needs to be increased" (Billing & plans). CI'ı yalnızca hesap sahibi açabilir. O zamandan sonraki commit'ler yerelde doğrulandı (birim + HTTP + e2e); faturalama düzelince son commit'te CI yeniden çalıştırılmalı.

**2026-10-28 gece–sabah (otonom; F6 kapanışı, F7 K1–K8).** Kullanıcı yatarken çalışıldı; dallar `f6-alternative-payments` (kapandı, push) ve `f7-shipping` (push).
- **Sabah cevabın gereken sorular (Açık sorular):**
  1. İlk müşterinin anlaşmalı kargo firması (F7.14, K11 buna bağlı).
  2. Toplu etiketler tek PDF olsun mu? (`pdf-lib` bağımlılığı)
  3. Geliver hesabı (gerçek deneme sunucuya çıkışta).
- **Gözden geçirmen gereken otonom kararlar:**
  - ~~ADR-0031, ADR-0032, ADR-0033~~ kullanıcı 2026-10-28 öğlen onayladı ("önerini uygula"). Kapıda ödeme ve havalede kalem düzenleme kapalı kalıyor (kullanıcı kararı).
  - Havale/EFT ile ödenmiş ve onaylanmış siparişi müşteri artık kendisi iptal edemiyor ("mağazayla iletişime geçin"): o para kartla değil elle geri gider. Personel panelden iptal ederse iade yalnızca kayda geçer; parayı müşteriye elle göndermek gerekir.
  - `kargo_cümlesi`'nin tüm ürün açıklamalarına girmesi
  - F6 kararları
- **Yapılanlar:**
  - F6 kapanış düzeltmeleri.
  - F7:
    - Geliver hesap bağlama;
    - sağlayıcı (desi, teklif, tablo fiyatı);
    - "Kargoya ver" Geliver'le (etiket özel depoda);
    - takip (bildirim + sorgu, tek kayıt);
    - toplu ve kısmi gönderim;
    - kargo seçenekleri, teslim süresi ve ücret tablosu (JSON-LD `shippingDetails`);
    - müşteri iptali;
    - iade talebi uçtan uca (onay, Geliver iade kodu, teslim, stok, para iadesi) ve panel kuyrukları;
    - değişim (K9): fark sunucuda, pahalı varyantta önce tahsilat, ucuzda teslimde iade, stok iki yönde;
    - sipariş düzenleme (K10): adet, fiyat, ürün ekleme ve teslimat adresi, paketlenmeden önce; fark önizlemesi, tahsilat ya da anında iade.
  - Bağımsız güvenlik incelemesi (K1–K4): bulgular uygulandı.
  - Bağımsız güvenlik incelemesi (K5–K8): 1 yüksek, 6 orta, 9 düşük bulgu; hepsi uygulandı ya da not edildi (F7 planında K8 satırının altında).
  - KK işaretli: KK1, KK2, KK4, KK5, KK6. KK3 iade faturası (F8) bekliyor; KK7 (doğrudan taşıyıcı) açık.
- **Not:** Geliver'i dev ortamda denerken turbo `GELIVER_BASE_URL`'i iletmediği için bir istek gerçek api.geliver.io'ya uydurma geliştirme anahtarıyla gitti ve reddedildi (zararsız); turbo.json'a `GELIVER_*` eklendi.

**2026-10-27 gece (otonom; F5 kapanışı, F6 başlangıcı).** Kullanıcı yatarken: "izin istemeden çalışmaya devam edersin, kritik bir şey olursa sabah sorarım."
- F5 kapandı (yukarıda V11; CI yeşil `fcd06e7`).
- **F6 W6 (kapanış): kod ve güvenlik incelemesi bulguları uygulandı (2026-10-28 gece).**
  - Başlatma (Y1, G-L1, G-M3, O6):
    - Barındırılan form mu kararı sağlayıcıdan veriliyor; çevrim dışı yöntem `return_urls` alırsa `payments.return_urls_unexpected` dönüyor.
    - Ücret adımı önce kanal ve `completed_at` kontrolünü yapıyor. Başlatma sonra düşerse telafisi önceki ücreti geri koyuyor. Kilit alındıktan sonra ücret satırları yeniden kontrol ediliyor.
    - Havale hesabı sağlayıcıya oturum verisiyle (`account`) geliyor; sağlayıcı başka modüle erişmiyor.
  - Ücret satırı (Y2/G-M1, G-L3):
    - `isFeeLine` yalnızca işaretli, varyantsız ve `is_custom_price` satırı ücret sayıyor; satır `is_discountable: false`.
    - `qt_` metadata'sı üç Store ucunda reddediliyor: satır ekleme, satır güncelleme, sepet oluşturma (`cart.metadata_reserved`).
    - Karar: satır kimliği oturum verisine konmadı. Gerekçe: varyantsız satırı vitrin üretemiyor, işaret de reddediliyor; kimlik eklemek yeni bir koruma getirmiyor.
  - Havale yarışları (Y3/G-M2, G-L4):
    - Süre dolumu `expireBankTransferWorkflow`'da: onay kilidi altında yeniden okuma; onaylı ya da yakalanmış ödeme atlanıyor.
    - İş imleçli sayfalıyor, zaman penceresi en uzun süre artı 7 gün.
    - Medusa'nın iptal ucu da aynı kilidi tutuyor (`holdBankTransferLock`).
    - Oturuma yalnızca `confirmed_at` yazılıyor; kimin onayladığı denetim kaydında.
  - Ters ibraz (Y4, Y5/G-L2, O9, O11):
    - Yalnızca kartla (barındırılan form) alınmış ödemeye açılıyor. Belge itiraz edilen ödemenin kaydını gösteriyor.
    - Açma ve durum değişikliği kilit altında. Kısmi tekil indeks: ödeme başına tek açık kayıt (migration `Migration20261027220843`). Durum değişikliği koşullu güncellemeyle (`chargebacks.changed`).
    - Adım adı `chargebacks-move-status`. Açılış denetim kaydında siparişin itirazlarının öncesi ve sonrası tutuluyor.
    - Uçlar tutarı lira metni olarak döndürüyor. Belge CSP'si `frame-ancestors 'none'` içeriyor.
  - Denetim ve erişim (O9, G-L5):
    - Çekirdek capture ucu (kapıda ödeme "Tahsil et") yalnızca personele açık ve denetimde.
    - Ayar denetiminde `iban` ve `account_holder` hassas sayılıyor.
  - `/store/payment/methods` (O7–O8): mantık `workflows/payments/payment-methods.ts`'te; yalnızca `cash_on_delivery.*` reddi "sunulmuyor" sayılıyor; hız sınırı `payment_methods` (60/dk/IP).
  - Kopyalar, boyut ve adlar:
    - Tek ayar okuyucu, `multiplyByRateBps`, `liraAmount`, `lib/payments/bank-transfer.ts`, `modules/chargebacks/states.ts`, `providerName`, `startedByCheckout`, `isCheckoutProvider`, tamamlama kancasında tek sorgu.
    - `chargebackEvidence` `workflows/chargebacks/evidence.ts`'e taşındı; `renderEvidence` ve `orderPaymentDetails` bölündü.
    - `paidOutsideCheckout` ve `requireCheckoutPayment` adlandırmaları.
  - Panel:
    - Ters ibraz sekmesi ve sayfa URL'de; sayfalama; tutar lira.
    - Kapıda ödeme formu `zodResolver` ile.
    - Ortak açık/kapalı anahtarı ve yüklenirken durumu (`useFeatureState`).
    - `orders.ts` 256 satıra indi (`api/payments.ts` ayrıldı).
  - Testler:
    - Birim: `cod` +1, `bank-transfer` 2, sözleşme güncellendi.
    - HTTP: kapıda ödeme +1 (işaret ve dönüş adresi reddi), havale +2 (onaylıya dokunulmaz, Medusa iptali kilitle çalışır, havaleye itiraz açılmaz), ters ibraz +1 (aynı anda iki açılıştan biri geçer).
    - F6 takımları 23/23; PayTR, iyzico, iade ve deneme sayfası takımları 57/57.
  - Ertelendi: ek ücret satırı başlığının i18n'i (F19), stok tutma suistimali (F15 sahtekârlık koruması).
- **F6 W5 (ters ibraz, ADR-0030):**
  - `chargebacks` modülü. Durumlar açık → belge gönderildi → kazanıldı/kaybedildi; kapanan yeniden açılmaz.
  - Açma kuralları: yakalanmış ödeme, ödenenden fazla değil, ödeme başına tek açık kayıt.
  - Kaybedilince `chargeback.lost` olayı (muhasebe F11).
  - Belge paketi: tek, kendi içinde tam HTML (yazdırılabilir), `GET /admin/chargebacks/:id/evidence`, hassas okuma olarak denetim kaydına giriyor.
  - Panel: Siparişler > Ters ibrazlar kuyruğu (durum sekmeleri, belge, durum değişikliği), sipariş sayfasında "Ters ibraz kaydı aç" ve açık kayıt uyarısı.
  - F6 KK5 işaretlendi.
  - Testler: modül 1, HTTP `chargebacks` 4, panel `chargeback-dialog` 1, e2e 29.
  - Karar (gözden geçir): belge paketi zip/PDF değil HTML (yeni bağımlılık yok); sözleşme onayı ve IP bugün saklanmıyor, paket bunu açıkça yazıyor (F13); kaybedilen ibraz iade defterine yazılmıyor.
- **F6 W4 (yönlendirici, sözleşme paketi):**
  - `routedCardProviders`: mağazanın seçtiği önde, ama entegrasyon sağlık kontrolünün düşük bulduğu sağlayıcı arkaya geçiyor. `GET /store/payment/methods` `card_providers_down` da veriyor. Taksit tablosu öndeki sağlıklı sağlayıcıdan.
  - Tek sağlayıcıda sağlık kontrolü çalıştırılmıyor.
  - Sözleşme paketinin çevrim dışı dalı (`offline-providers.contract`): havale ve kapıda ödeme.
  - F6 KK1–KK4 işaretlendi.
  - Testler: HTTP `card-providers` 3 (yedeğe geçiş dahil), sözleşme 23.
- **F6 W3 (kapıda ödeme):**
  - `pp_cod_cod` (yetkilendirme `authorized`: kargoya verilebilir, para gelince "Tahsil et").
  - `payments.cash_on_delivery` bayrağı. Kayıtta yoktu; eklendi, yönetim paneli ve panel metinleriyle.
  - `cash_on_delivery` ayar bölümü: ücret türü/değeri, üst tutar, kapıda tahsilat yapan kargo seçenekleri.
  - Ek ücret kalemi sunucuda hesaplanıyor ve başlatma kilidinden önce ekleniyor. Store ucundan değiştirilemiyor ve silinemiyor; tamamlamada yeniden hesaplanıyor.
  - `GET /store/payment/methods?cart_id=` sepete göre uygunluk ve ücret.
  - Panelde Ayarlar > Ödeme > Kapıda ödeme sayfası (durum, ücret, kargo seçenekleri); deneme sayfasında kapıda ödeme.
  - Testler: birim `cod` 2, HTTP `cash-on-delivery` 5; ödeme/sipariş/dashboard takımları 97/97; panel 219; e2e 28.
  - **Tam HTTP takımı yerelde 79/79 takım, 426 test (W2 sonrası), CI faturalama yüzünden çalışmadığı için.**
  - Not: ek ücret kaleminin başlığı Türkçe sabit ("Kapıda ödeme ücreti"); kiracı dili F19'da.
- **F6 W2 (havale onayı, süre, kargo kuralı):**
  - `confirmBankTransferWorkflow`: sipariş kilidi altında, oturuma onay yazılır (sağlayıcının kabul ettiği tek güncelleme), oturum yeniden yetkilendirilir, yakalanır; sipariş `captured`. İkinci onay yalnızca bildirilir, iptal edilmiş sipariş reddedilir.
  - `POST /admin/orders/:id/bank-transfer/confirm`: yalnızca personel, denetim kaydıyla.
  - `bank-transfer-expiry` işi (15 dk'da bir): süre siparişin kendi oturumundaki saatten (müşteriye söylenen); `cancelOrderWorkflow` stoku geri veriyor.
  - Kargo kuralı (`lib/payments/shippable.ts`): ödemesi beklenen ya da test modunda ödenmiş sipariş, kendi uçumuzdan da Medusa'nınkinden de kargoya verilemiyor.
  - Panel: sipariş sayfasında "havale bekleniyor, son gün …" uyarısı ve "Havale geldi" onayı; ödeme detayı ucu havale durumunu da veriyor.
  - Testler: HTTP `bank-transfer-confirm` 4; panel `bank-transfer-alert` 1; ödeme/sipariş/dashboard takımları 92/92. Bir koşuda tek takımda 3 test düştü, iki tekrarda düşmedi (geçici dalgalanma; hangi takım olduğu kayıtta yok).
- **F6 W1 (havale/EFT):**
  - `pp_bank-transfer_bank-transfer` sağlayıcısı: yetkilendirme `pending_authorization`; sipariş `awaiting` oluşuyor, stok rezerve, dashboard'da "ödenmiş" sayılmıyor (HTTP testli).
  - `bank_transfer` ayar bölümü: TR IBAN mod-97 doğrulaması; açmak için hesap gerekli.
  - Store başlatma ucu çevrim dışı yöntemlere açıldı: dönüş adresi yalnızca kartta zorunlu. Tamamlama ve tutar kuralları "kendi ucumuzdan başlatılmış oturum"a genişledi. Medusa'nın kendi iade ucu bu ödemelere de kapalı.
  - `GET /store/payment/methods` havaleyi ve IBAN'ı da veriyor.
  - Panelde Ayarlar > Ödeme > Havale/EFT sayfası (durum + hesap kartları).
  - Deneme sayfasında havale: sipariş #213 dev'de açıldı.
  - Testler: backend birim 1642, HTTP ödeme takımları 69, panel 218 birim, e2e 27.

**2026-10-27 (ödeme ekranı çok yöntemli; F5 V8: iyzico bağlantısı).** Kullanıcı üç şey istedi: ödeme ekranı birden fazla entegrasyona göre kurulsun; ilk PayTR sayfasının iç tasarımını beğenmedi; ardından "paytr bitti ise iyzico bağlantısını kurmaya başla, env ekledim anahtarları".
- **Ayarlar > Ödeme:** yöntem listesi (kartla ödeme: PayTR, iyzico; diğer: havale/EFT, kapıda ödeme "Yakında") ve sağlayıcı başına sayfa (`/settings/payments/$provider`). Sağlayıcı sayfaları kurulum sırasıyla `FormSection`'lar: hesap, bildirim adresi, test/sandbox ve canlıya geçiş; ortak parçalar `account-actions.ts` ve `account-form.tsx`'te. Commit `8edc959` (liste + PayTR sayfası).
- **iyzico V8:** `lib/payments/iyzico` (IYZWSv2 imzası, yanıt imzası ve fiyat biçimi, hata kodları, sandbox ve canlı için iki istemci ve iki devre kesici), `integration-credentials`'a `iyzico` tanımı (ayar `test_mode`, gizli `api_key` ve `secret_key`; kimlik alanı `test_mode`: sandbox'tan çıkınca iki anahtar yeniden istenir), bağlantı kontrolü (1 TL'lik taksit sorgusu), sağlık kontrolü, `packages/testing`'de bağımsız imzacı ve sahte iyzico, panelde iyzico sayfası.
- **Sandbox'ta ölçülenler (anahtarlar okunmadan, `node --env-file`):** geçerli → `success`; yanlış gizli anahtar → `1000` "Geçersiz imza"; bilinmeyen API anahtarı → `1001`; sandbox anahtarı canlı adreste → `1001`; hatalar HTTP 200; sandbox anahtarları `sandbox-` ile başlıyor; taksit yanıtında imza yok. docs/entegrasyonlar/iyzico.md'ye yazıldı.
- **Gerçek uçtan uca:** kullanıcının sandbox anahtarları panelden girildi (Playwright, yalnızca iki değişken aktarıldı, iz kaydı kapalı); iyzico doğruladı, "Bağlantıyı test et" geçti. Dev veritabanında iyzico sandbox bağlı.
- **Bulunan ve düzeltilen hata:** env şemasına `IYZICO_BASE_URL` eklenince kullanıcının `.env`'indeki aynı adlı değişken `medusa` CLI'ını (NODE_ENV tanımsız) düşürdü; e2e'nin geçici yönetici oluşturması kırıldı. Kural "yalnızca development/test" yerine "staging ve canlıda yasak" oldu (PayTR için de); ADR-0027 §8 güncellendi.
- **Testler:** backend birim 1585+, HTTP `integration-credentials*` 17, modül 31; panel 204 birim, e2e 25 (iyzico sayfası iki modda axe ve denge dahil).
- **Kullanıcıya:** `.env`'deki `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` ve `IYZICO_BASE_URL` artık kullanılmıyor (anahtarlar panelde); silinebilir. `IYZICO_BASE_URL` yerelde kalırsa iki mod da o adrese gider.
- **CI'da yakalanan yarış (F2'den kalma):** `async-job` "iki çalıştırma yarışırsa iş bir kez başlar" testi CI'da düştü; aynı iş iki kez `running` olmuştu. Sebep: Medusa'nın seçicili `update*` çağrısı önce okuyup sonra id ile yazıyor, karşılaştır-ve-yaz atomik değil. Bütün iş durumu geçişleri (başlat, ilerleme, başarı, hata, süpürücü) tek `UPDATE … WHERE` oldu (`nativeUpdate`, Medusa dokümanı Context7'den doğrulandı; varlık adı `AsyncJob`). Test 5 eşzamanlı başlatmaya çıkarıldı. Aynı sınıftan V1 açığı: `recordCheck` satırı `FOR UPDATE` ile kilitliyor, önbellek commit'ten sonra temizleniyor.
- **F5 V2 (PayTR ödeme başlatma):** `pp_paytr_paytr` sağlayıcısı (hesap paylaşılan container'dan, çağrı anında), bölgeye bağlama (bootstrap + `paytr-region-provider` migration betiği, mevcut sağlayıcılar korunur), `lib/payments/basket` ve `lib/payments/checkout` (sağlayıcıdan bağımsız alıcı/sepet şeması; iyzico da kullanacak), `POST /store/carts/:id/payment-session` (`startCartPaymentWorkflow`: sepet hazır mı, koleksiyon kur/yenile, sepet, oturum), çekirdek oturum ucu PayTR'ye kapalı. Medusa API'si araştırma ajanıyla v2.21.2 kaynağından ve Context7'den doğrulandı. Testler: sağlayıcı birim 5, HTTP 6 (ödenmeden sipariş yok, ödenince sipariş var; oturumda kişisel veri yok; migration betiği).
  - Kararlar: `authorizePayment` (durum sorgusu) V3'ten öne alındı, sepet tamamlama onunla çalışıyor; sağlayıcı bölgeye hep bağlı, hesap yoksa başlatma reddediliyor (bağlı olmayanı listeden gizlemek V7/V10'da); iade ve iptal V5'e kadar reddediliyor; deneme sayfası V3'ten sonra.
- **F5 V3 (PayTR bildirimi ve sipariş):** `webhook-events` modülü (tekil kayıt, `claim`: new/retry/busy/done, 90 gün saklama işi), `POST /hooks/paytr` (imza sabit zamanlı, "OK" yalnızca işlenince), `paytrNotificationWorkflow` (oturumu bul → kaydı al, telafide "başarısız" → `completeCartWorkflow` → işlendi). Test modunda ödenen sipariş kargoya verilemiyor (kendi akışımız + çekirdek uç). Testler: modül 4, HTTP 7 (tek sipariş, eşzamanlı teslim, sahte imza, başka mağazanın siparişi, başarısız ödeme, kayıt tutmadan "OK" yok ve sonra başarı, kargo engeli, saklama).
  - Medusa 2.21.2'de `createOrderFulfillmentWorkflow`'da `validate` kancası yok (derlemeyle görüldü; yalnızca `fulfillmentCreated`); engel bu yüzden giriş noktalarında.
  - Context7'nin aylık kotası doldu (2026-10-27); V3'te yeni Medusa API'si yok, bu oturumda doğrulanmış kalıplar kullanıldı. Kota yenilenene kadar araştırma GitHub v2.21.2 kaynağından.
- **Güvenlik incelemesi (V2+V3, bağımsız ajan) ve düzeltmeler:**
  - Kritik (F2'den kalma, bu dalın çekirdek uç kapatması açık bırakıyordu): bölgede duran `pp_system_default` ile vitrinden ödemesiz, panelde "ödendi" görünen sipariş açılabiliyordu. Çekirdek oturum ucu vitrine tamamen kapandı; Store'dan sepet tamamlama tutarı varsa yalnızca barındırılan form oturumuyla (HTTP testleri). Sistem sağlayıcısı bölgede kalıyor (seed ve iç akışlar); vitrin için F6'da havale/kapıda ödeme kendi yolunu açar.
  - Yüksek: ödeme başlarken sepet değişirse oturum eski tutarda kalabiliyordu. Başlatma sepet kilidi altında; tamamlamada sepet toplamı = koleksiyon = canlı oturumlar = formun `amount` kaydı (kanca + birim + HTTP testi).
  - Orta: silinmiş oturumun ödemesi artık "sahipsiz" (kayıt + hata logu, "OK" yok; iade V4); kayıt adımının hatası siparişi geri almıyor.
  - Düşük: yeniden deneme koşullu güncellemeyle; dönüş adresinde kullanıcı bilgisi/ters bölü yok, normalize adres, ≤400; `checkout` profiline sepet başına adresten bağımsız sınır ve tamamlama ucuna uygulama; bağımsız `/admin/fulfillments` ucu da test ödemesini reddediyor (gövdedeki `order_id`, şekli doğrulanmadı); kilit atlanırsa hata.
  - Kanca kuralı testleri (kargo, tek kupon) artık sepeti Store ucundan değil tamamlama iş akışından tamamlıyor (`helpers/checkout.ts`).
  - Not: Query iç içe `raw_` değerlerini yalnızca düz alan da istenince dolduruyor; ikisi birlikte isteniyor.
- **F5 V4 (sahipsiz ödeme ve uzlaştırma):** `payment-recovery` modülü (sağlayıcı + referans tekil; bekliyor/iade edildi/başarısız, deneme sayısı, iade referansı), bildirim akışında PayTR'ye yeniden sorma + sahipsiz ödemenin kaydı ve uyarısı, `payment-recovery` iade işi (5 dk; önce durum sorgusu, aynı referansla iki iade yok, test modu koruması, 10 denemede elle iade uyarısı, denetim kaydı), `paytr-reconcile` uzlaştırma işi (10 dk). Testler: modül 2, HTTP 4 (değişen oturum, tamamlanamayan sepet, kaybolan iade cevabı, gelmeyen bildirim).
  - Karar: sahipsiz ödemeye "OK" deniyor (V3'te 409'du), çünkü PayTR "OK" almamış ödemeyi iade etmiyor (`007`); iade iş kuyruğundan.
  - Karar: sepet tamamlanamazsa yalnızca kalıcı sebepler (sepetin kendi kuralları, stok) iade sebebi; kilit ve ağ gibi geçiciler yeniden denenir (geçerli bir ödemeyi yanlışlıkla iade etmemek için).
  - Panel: zil uyarıları sunucunun metniyle görünüyor; ayrıntılı ekran V7'de.
- **F5 V5 (iade ve iptal):** PayTR sağlayıcısında iade (önce sorgu, referans başına bir kez, test modu koruması, ret sebepleri Türkçe), `cancelPayment` boş; `order-refunds` defter modülü; `lib/orders/refund-plan` (adet ve ödenen tutar sınırı, serbest tutar kalanı düşürür); `refundOrderWorkflow` (sipariş kilidi, istek referansı ödeme verisine → PayTR'ye aynı referans); `POST /admin/orders/:id/refunds` + `/preview`; para özetine kalem bazlı iade; denetim kaynağı; çekirdek iptal önünde önce iade, çekirdek ödeme iadesi PayTR'ye kapalı; panelde "Para iadesi" penceresi. Medusa 2.21.2'nin iade/iptal akışı ajanla GitHub kaynağından doğrulandı. Testler: sağlayıcı 9, planlayıcı 4, HTTP 6, panel 3.
  - Bulgu (Medusa 2.21.2): `cancelOrderWorkflow` yakalanmış ödemeyi `refundPaymentsWorkflow` ile iade ediyor ve hatayı yutuyor; sipariş iptal, para iade edilmemiş kalabiliyordu. Önce bizim iade, başarısızsa iptal yok.
  - Bulgu: Medusa her iade denemesine yeni anahtar veriyor; referansı biz sabitledik (`pending_refund`, Medusa'nın güncelleme tipinde `data` yok, tip dönüşümüyle yazılıyor; HTTP testi PayTR'ye bizim referansın gittiğini doğruluyor).
  - Karar: `cancelPayment` iade yapmaz (sepet tamamlanamadığında Medusa zaten iade ediyor; çift iade olurdu). Kurtarma işi, PayTR'de tamamen iade edilmiş ödemeyi "iade edildi" sayar.
  - Açık: Medusa'nın `refundPaymentWorkflow`'unda ikinci kısmi iadede sipariş işlemlerinin (order transaction) önceki iadeleri yeniden yazabileceği şüphesi (ajan kaynakta gördü, test edilmedi); para özeti ödeme modülünden okunduğu için etkilenmiyor. F7'de sipariş özeti kullanılırken test edilecek.
- **F5 V6 (taksit):** `payments` ayar bölümü (taksit açık/kapalı, en çok taksit), sağlayıcı PayTR'ye `no_installment`/`max_installment` geçiyor; `GET /store/payment/installments` (varyant+bölge ya da sepet, tutar sunucuda, kanal kontrolü, `installment` hız profili); PayTR oranları süreç başına günde bir (bellek, tek uçuş, hata olursa dünkü); panelde Ayarlar > Ödeme > Taksit kartı. Testler: birim 3 + sağlayıcı 1, HTTP 4, panel 2.
  - Karar: oran önbelleği Redis yerine süreç belleğinde (plan Redis diyordu); amaç karşılanıyor, sade.
  - Karar: taksit ayarı tüm kart sağlayıcıları için tek (iyzico V10'da aynısını okuyacak).
- **F5 V7 (panel ve deneme sayfası):** sipariş detayında PayTR kaydı (`e7dcd12`), dashboard'da sahipsiz ödeme görevi (`c663efb`), kurulum listesinde "Kartla ödeme alın" adımı (PayTR ya da iyzico bağlıysa tamam; hesap değişince liste yenilenir), Ayarlar > Entegrasyonlar sayfası (F2.6 sağlık ucu: Redis, PayTR, iyzico; durum, sebep, gecikme, son kontrol, sağlayıcıya bağlantı) (`c9d3a78`).
  - **Ödeme deneme sayfası (ADR-0028):** `GET /dev/checkout` (yalnızca `NODE_ENV=development`, başka yerde 404) ürün → sepet → adres → kargo → taksit → "Öde" → sahte PayTR formu → dönüşte siparişi bekler, panel bağlantısı verir. Sahte PayTR'nin tıklanabilir formu: onayla (taksitli, vade farkıyla), kart reddedildi, bildirim kayboldu. `pnpm dev:paytr` sahte PayTR'yi `127.0.0.1:9102`'de açar. Elle (Playwright) uçtan uca denendi: sipariş #209 ve #210 açıldı, reddedilen kartla aynı sepet yeniden ödendi, kaybolan bildirim uzlaştırmayı bekliyor.
  - Karar: geliştirmede dönüş adresi `ADMIN_CORS` kökenlerine de izinli (sayfa backend kökeninde); staging/canlıda kural aynı.
  - Karar: sahte PayTR'nin geliştirme hesabı sabit ve okunur (`packages/testing/src/dev/paytr.ts`); panelde bir kez girilir. Sahte sır kuralına (docs/04) uyar: gizli bilgi tarayıcısı gerçek sanmaz.
  - Karar: sayfa dosyaları `src/lib/dev-checkout`'ta (Medusa `src/api` altındaki her `.js`'i yüklüyor).
  - **Kullanıcıya:** `.env`'e `PAYTR_BASE_URL=http://127.0.0.1:9102` satırı eklenmeli (env.example'da var); dev veritabanında PayTR artık sahte geliştirme hesabıyla bağlı.
  - Testler: backend birim 1617, HTTP `paytr*`/`order-refunds`/`integration-credentials*` 50 + `paytr-payment-form` 3 + `dev-checkout` 1; panel birim 213.
- **F5 V9 (iyzico ödeme akışı):** `pp_iyzico_iyzico` sağlayıcısı (CF initialize, retrieve; imzalar doğrulanıyor), bölgelere ekleyen migration betiği (ortak `addRegionPaymentProvider`), `POST /hooks/iyzico/callback` (`iyzicoCallbackWorkflow`: token sabit zamanlı, sonuç iyzico'dan, tutar/para birimi/sepet eşlemesi, `fraudStatus`, sepet tamamlama, sahipsiz ödeme kaydı, dönüş adresine 303), `iyzico-reconcile` işi, sahte iyzico'ya CF uçları ve tıklanabilir sayfa, deneme sayfasında iyzico.
  - Sandbox'ta ölçülenler docs/entegrasyonlar/iyzico.md'de: `11111111111` kabul, "10.50" kabul, `5122`/`5124`, `localhost` callback kabul. **Gerçek sandbox ödemesi** deneme sayfasından yapıldı (test kartı): retrieve imzası gerçek yanıtla doğrulandı, sipariş #212 açıldı.
  - Karar: `BACKEND_URL` env'i eklendi (iyzico'nun dönüş adresi için); staging/canlıda zorunlu ve https, yerelde `http://localhost:9000`.
  - Karar: callback için `webhook-events` kaydı yok (iyzico callback'i yeniden göndermez; adımlar tekrar güvenli). Sahipsiz ödeme referansı `<oturum>:<token>` (V10'da iade için iyzico'ya yeniden sorulabilsin).
  - Karar: `fraudStatus` 0 → sipariş açılmaz, alıcı başarı adresine `payment_status=review` ile döner, uzlaştırma işi onayı görünce açar; -1 → hata adresi (iyzico kendisi iade eder).
  - Karar: sahipsiz ödeme kaydı ve tamamlama adımı sağlayıcıdan bağımsız hale getirildi (`recordPaymentOrphanStep`, PayTR akışı da kullanıyor).
  - **Güvenlik incelemesi (bağımsız ajan) ve düzeltmeler:**
    - Yüksek: iadeye yazılan ödeme, sepet sonradan tamamlanabilir olunca (stok, kural) callback'in tekrarı ya da işle siparişe dönüşebiliyordu (iade + mal). Artık iyzico'nun `paymentId`'siyle kayıtlı ödeme bir daha tamamlanmıyor (HTTP testli).
    - Orta: silinmiş oturumun (yeniden başlatılan ödeme, incelemedeki ödeme) ödenmiş formu hiç uzlaştırılmıyordu → verilen formlar `payment-forms` modülüne yazılıyor, iş oradan soruyor (HTTP testli).
    - Orta: iş 100 oturumu süzmeden alıyordu → açık formlar sayfa sayfa.
    - Orta: bekleyen iyzico sahipsizleri kurtarma işinin 50'lik partisini doldurup PayTR iadelerini durdurabilirdi → iş yalnızca iadesi yazılmış sağlayıcıları seçiyor.
    - Orta: callback, imzasız istekle iyzico'ya imzalı çağrı yaptırabiliyordu (dakikada 600) → callback adresi mağazanın gizli anahtarıyla imzalı, kendi sınırı var (`payment_return`).
    - Düşük: kart bilgisi (son 4 hane, aile) Medusa'nın oturum verisine, oradan Store yanıtına gidiyordu → saklanmıyor.
    - Not (V10): iyzico sahipsiz iadesi siparişi olan sepette reddedilmeli.
  - Testler: birim (istek kurucusu, tutar, imza sahteciliği, 5062), modül `payment-forms` 2, HTTP `iyzico-checkout` 8 (form, ödeme + ikinci dönüş, ret, inceleme → onay, yabancı token/imzasız adres, değiştirilmiş oturum → iade kaydı, dönmeyen alıcının eski formu, kayıtlı sahipsizin kalıcılığı).
- **F5 V10 (iyzico iade, iptal, taksit, panel):** kalem işlemine bölünen iade (önce ürünler; her parça gönderilmeden deftere `sending`, kayıp yanıtta tekrar gönderilmez), aynı gün reddinde tam tutar iptali, sahipsiz iyzico ödemesinin iadesi (önce iptal, sonra kalem kalem; kısmi başarıda mağazaya bırakılır), öncelikli kart sağlayıcısı ayarı + `GET /store/payment/methods`, iyzico taksit tablosu (BIN'siz, 10 dk önbellek), panelde iyzico ödeme bilgisi ve sahtekârlık uyarısı.
  - Sandbox'ta ölçülenler: aynı gün iade çalıştı, iade imzası doğrulandı, `5093`, ödeme detayı iadeleri göstermiyor. Not: deneme siparişi #212'nin sandbox ödemesinden 1 TL iade edildi (dev defterinde yok).
  - Karar: iyzico'ya her iade parçası `order_refund.provider_parts`'a yazılarak gönderiliyor (sağlayıcı defteri paylaşılan container'dan okuyor/yazıyor; adr/0027'deki hesap okuma deseninin genişlemesi). Medusa'nın kendi iyzico iadesi reddediliyor; iyzico iadesinin tek yolu sipariş iademiz ve kurtarma işi.
  - Karar: öncelikli sağlayıcı yalnızca sıra ve taksit kaynağını belirler; bağlı her kart sağlayıcısıyla ödeme başlatılabilir (zorlama yok).
  - Testler: HTTP `iyzico-refunds` 6, `card-providers` 2; panel `preferred-provider` 2.
- **F5 V11 (kapanış):** sağlayıcıdan bağımsız sözleşme paketi (`payment-providers.contract.unit`, iki sağlayıcı × 6 senaryo), ana sayfa özetinin siparişli testi (F2'den), ADR-0026 uygulama notu, F5 KK'ları test kanıtlarıyla işaretlendi (iyzico taksitli sandbox ödemesi açık).
  - **Kapsam (ödeme kodu: `lib/payments`, `modules/payment-*`, `workflows/payments`; birim + ödeme HTTP testleri, v8):** satır %93,4, fonksiyon %95, dal %78,2 (ilk ölçüm; ardından iyzico kurtarma yolları test edildi). KK "≥ %80" satır kapsamıyla karşılandı.
  - **Güvenlik incelemesi (iyzico iadesi, bağımsız ajan): 2 Yüksek, 3 Orta, 3 Düşük, hepsi düzeltildi ve testli (`iyzico-refund-safety` 6):**
    - Yüksek: başarısız/yanıtsız iadenin parçası yeni referanslı iadede görülmüyordu → paylaştırma ödemenin bütün parçalarından; `sending` parça varken ödemede iade yok; parça göndermiş iade `pending`/`refund_incomplete` kalır.
    - Yüksek: iyzico iadeyi yaptıktan sonraki hatalar (imza, şema) "red" sayılıp parça siliniyordu → yalnızca açık red ya da hiç gitmeyen istek siler; yanıt istekle de karşılaştırılıyor.
    - Orta: iadeye yazılmış ödemeyle sepet tamamlanabiliyordu → sağlayıcı yetkilendirmesi reddediyor.
    - Orta: boş/tutmayan ödeme detayında kurtarma işi "iade edildi" diyordu → `detail_mismatch`.
    - Orta: iade telafisi ödeme verisini eski kopyayla eziyordu → yalnızca `pending_refund` siliniyor.
    - Düşük: iade kilidi 600 sn; kurtarma işi kayıt başına kilitli; iade yanıtı istekle karşılaştırılıyor.
    - Bilgi: oturum verisinde iyzico ödeme kimliği, kalem işlem kimlikleri ve fraud durumu var (kart bilgisi yok); kabul edildi.
  - **Kod incelemesi:** sağlayıcının defter/kurtarma erişimi ADR-0027 ekiyle belgelendi (backend CLAUDE.md'ye işlendi); para birimi iadede ödemeden; callback hatasında alıcı vitrine `payment_status=pending` ile; uzlaştırma işi hesap yoksa çıkıyor; ayar okuyucusu, oturum kimliği deseni, fiyat şeması, `pendingReferenceOf`, tamamlama adımı, sahte iyzico yardımcıları ortak; PayTR ödeme detayı ve kurtarması ayrı dosyalarda; iyzico kararı saf fonksiyon (`iyzicoVerdict`).
  - **Açık iş:** sonucu bilinmeyen iyzico iade parçasını çözme aracı (panelde "yapıldı/yapılmadı"; şimdilik platform ekibi elle). Panelde `refund_incomplete` durumunun ayrı gösterimi.
- **V8'den V9/V10'a kayanlar:** CF initialize/retrieve, detail, refund, cancel istemci çağrıları ve sahte sunucu uçları kullanıldıkları görevle gelir (kullanılmayan kod yazılmadı). Webhook V3 imzası V9'da `/hooks/iyzico/webhook` ile.

### Önceki oturum
**2026-10-27 (F5 V1: ortak altyapı, PayTR istemcisi, mağaza hesabı panelden).** Kullanıcı başlarken iki şey söyledi: PayTR'de ana kaynak dev.paytr.com; mağaza bilgileri panelden girilebilsin, müşteri odaklı çalışalım.
- **ADR-0027 (kabul, ADR-0002'nin yerini aldı):** mağazanın sağlayıcı hesapları panelden girilir.
  - `integration-credentials` modülü: ayarlar açık, gizli alanlar tek AES-256-GCM blokta (sağlayıcıya bağlı AAD), anahtar `CREDENTIALS_ENCRYPTION_KEY` (canlıda zorunlu, PII anahtarlarından ayrı). Anahtar değişirse kayıt "yeniden girilmeli".
  - Gizli alanlar yalnızca yazılır: yanıt, log, denetim kaydı ve workflow verisinde değer ya da parçası yok (testli); denetimde yalnızca sürüm numarası.
  - Kayıttan önce PayTR'ye sorulur: uydurma `merchant_oid` ile durum sorgusu, `004` = bilgiler doğru, `001` mağaza no, `003` parola/gizli anahtar hatalı (alan bazında hata). PayTR'ye ulaşılamazsa "doğrulanmadı" olarak kaydedilir. Yalnız test modu değişirse sorulmaz. Mağaza no değişince iki gizli alan yeniden istenir.
  - Uçlar: `GET/POST/DELETE /admin/integrations/credentials[/:provider][/check]`, personele açık, `provider_check` hız profili, denetim kaydı. Sağlık kontrolü kayıtlı hesapla PayTR'yi soruyor.
  - Sağlayıcı (V2) hesabı `@medusajs/framework`'ün paylaşılan `container`'ından okuyacak (Context7'de görüldü; V2'de testle doğrulanır).
- **PayTR (dev.paytr.com'dan yeniden okundu):** `lib/payments/paytr`: dört imza (bilinen-cevap vektörleri, Python ve openssl ile ayrıca hesaplandı), üç tutar biçimi, API başına `err_no` tabloları (durum 001–004, iade 000–011 ve 006), Zod yanıtları, token/durum/iade/taksit oranları. İade kendiliğinden tekrar gönderilmez (`outcome_unknown`), durum sorgusu tekrarlanır. `debug_on` yalnızca test modunda. `lib/clients` form gövdesi. Hesap bilgilerinin PayTR panelindeki yeri, bildirim adresi ayarı ve canlıya geçiş docs'ta.
- **`packages/testing`:** sahte PayTR (imzaları kendi kodumuzdan bağımsız doğrular, anahtar/salt gövdede gelirse reddeder, senaryo kuyruğu: gecikme, bağlantı kopması, 5xx), bildirim imzalayıcı, TR fixture'ları (geçerli TCKN/VKN, tohumlu), her çalıştırmada üretilen test sırları (gitleaks sabit sahte anahtarları da yakaladı; repo kuralına uyuldu).
- **Panel, Ayarlar > Ödeme:** PayTR kartı (mağaza no, parola, gizli anahtar, test modu; kaydet ve doğrula, bağlantıyı test et, kaldır) ve "PayTR panelinde yapılacaklar" (bilgilerin yeri, kopyalanabilir bildirim adresi, https değilse uyarı, canlıya geçiş). Tarayıcıda sahte PayTR'ye karşı uçtan uca denendi; bulunan hata düzeltildi: kayıttan sonra yazılan gizli değer alanda kalıyordu (kart artık kayıtlı hesap değişince baştan kuruluyor). Kartlar alt alta: yan yana düzende her durumda boşluk kalıyordu.
- **Testler:** backend 1564 birim; HTTP 65 dosya / 354 test (yeni dosya 12 test: loglarda ve bildirimlerde sır yok, korunan hesap, reddedilen hesap, uyarılar); modül 18 dosya / 166 test; panel 190 birim (kart bileşen testi dahil); e2e smoke, iki modlu axe ve denge testleri yeni sayfayı kapsıyor.
  - Bir kez görülen düşüş: tam HTTP koşusunda `audit-log.spec` dokuz testi zaman aşımıyla düştü (1205 sn; Jest önceki koşuda düşeni başa almıştı). Tek başına, ikili ve ikinci tam koşuda geçti; tekrar etmedi. CI'da yeniden görülürse incelenecek.
- **Dev ortamı:** `scripts/init-dev-env.sh` yerel `.env` ve `.env.test`'e `CREDENTIALS_ENCRYPTION_KEY` ekledi (değer okunmadı). Dev DB'ye `integration_credential` tablosu migrate edildi.

**2026-10-27 (F5 planlaması, `/faz-baslat F5`).** Kod yazılmadı. Dal `f5-payments` (`f4-pricing-promotions` üzerinden) yalnızca plan dokümanlarıyla açıldı.
- **Kapsam ve sıra (kullanıcı):** F5 artık PayTR + iyzico.
  - PayTR önce yazılıyor: ilk müşterinin firması onu canlıda kullanıyor ve test modunda bağlanmayı kabul etti.
  - iyzico başvurusu sürüyor; altyapısı da F5'te hazırlanıyor (F5.11), canlıya alınması sonra.
  - Havale, kapıda ödeme, yönlendirici ve ters ibraz F6'da kaldı.
  - docs/03, 01, 11, 12 ve 15 buna göre güncellendi.
- **Doğrulama (üç araştırma ajanı):**
  - Medusa 2.21.2'nin ödeme akışı GitHub v2.21.2 etiketinden incelendi; `node_modules` okuması izin kuralıyla kapalı. Planı etkileyen bulgular:
    - istemcinin gönderdiği oturum verisi sağlayıcıya ulaşıyor ve Store yanıtında görünüyor;
    - Medusa tutarı sepet toplamıyla karşılaştırmıyor;
    - hazır webhook ucu imzayı doğrulamadan 200 dönüyor;
    - telafi zincirinde çift geri ödeme riski var.
  - PayTR (dev.paytr.com) ve iyzico (docs.iyzico.com) güncel API'leri doğrulandı. Doğrulanan bilgiler `docs/entegrasyonlar/paytr.md` ve `iyzico.md`'ye yazıldı; eski dokümandaki yanlışlar düzeltildi.
- **Kararlar:**
  - ADR-0026 önerildi: ödeme oturumunu ve bildirim ucunu biz yazıyoruz, onay sağlayıcıdan yeniden sorgulanarak veriliyor, sahipsiz ödeme otomatik iade ediliyor, iade tutarı kalemlerden hesaplanıyor, test modunda iade koruması var.
  - ADR-0002 kabul edildi.
  - Kayıtlı kart kapsam dışı.
  - iyzico SDK'sı kullanılmayacak.
- **Plan:** V1–V11 aşağıda, "F5 görev planı".
  - PayTR'nin bildirim adresi hesap başına tek. Firmanın canlı hesabıyla gerçek test bu yüzden V11'de kısa bir test penceresinde yapılacak (Açık sorular).
- **iyzico sandbox:** Kullanıcı hesap açtı, anahtarları `.env`'e yazdı. `.env` okunmadan tek bir salt okunur taksit sorgusuyla denendi: `success`, 6 satır. IYZWSv2 imzası doğru çalışıyor.

**2026-10-26/27 (U8, panel dengesi, F4 kapanışı; kullanıcı yatarken "sabaha kadar çalış, izin isteme").** F4 BİTTİ; dal `f4-pricing-promotions`, son commit `87636da`, CI yeşil.
- **U8 hediye kartı ve mağaza kredisi** (`@medusajs/loyalty-plugin` 2.21.2, `promotions.gift_cards` bayrağı): panelde Kampanyalar > Hediye kartları, müşteri sayfasında mağaza kredisi, sipariş ödemesinde kredi satırı. Bağımsız kod ve güvenlik incelemesinin bulguları düzeltildi: kendi kod üreticimiz (80 bit), kod denemesi sınırı (HEAD dahil), alışverişçiye kartın yalnızca kendi alanları, kredi yalnızca sepetin sahibine, misafire hesap yok, `claim` kapalı, denetim kaydı ve loglarda kod maskesi.
- **Panel dengesi (kullanıcı kuralı):** `PageGrid`/`PageColumn` ile yan yana kartlar eşit, satırdaki kontroller tek boy; `e2e/layout.e2e.ts` her sayfayı ölçüyor; docs/18 §2 "Denge". Raporlar dört sekme (Özet, Ürünler, Kategoriler, Gün gün), Görünüm ayarları kartlara bölündü.
- **F4 kapanış incelemesi (kod + güvenlik) ve düzeltmeler:** 30 gün kuralında yükselen indirimli fiyat (yasal risk), ödeme anında tek kod ve güncel kargo fiyatı denetimi, `price-display` yalnızca yayındaki ürünler, kod biçimi/sayısı/uzunluğu, fiyat listesi sınırlarının dakikalık kaydı, kod partisi ve kampanya kaydı telafili workflow'larda, parti durdurma, denetim kaydında bütün kurallar (madde 169, ADR notları).
- **Test altyapısı:** test çalıştırmalarının Redis anahtarları dev'den ayrı (dev girişini kilitliyordu); erişilebilirlik testi her ekranı açık ve koyu modda denetliyor; geçici e2e admin şifresi `-` ile başlayınca kırılmıyor.
- **Sayılar:** backend 1484 birim, 64 dosyada 342 HTTP testi; panel 176+ birim, 22 e2e (denge ve iki modlu axe dahil).

**2026-10-25/26 gece (kullanıcı yatarken, "panel işlerini tamamla" talimatıyla).** Panelin ekranları yazıldı; her biri gerçek veriyle tarayıcıda denendi (CDP ekran görüntüsü, test kayıtları sonra silindi). Commit'ler `e11a201`…`6d63df7`, push yok.
- **Backend (yeni okuma uçları, testli):**
  - `GET /admin/order-board`: siparişler aşamaya göre (ödeme bekliyor / hazırlanacak / kargoda / teslim / iptal), sekme sayıları, Medusa `q` araması, 20'lik sayfa. Aşama ödeme ve gönderi kayıtlarından hesaplandığı için en yeni 5000 sipariş bellekte sıralanır, `limited` bayrağı. Kişisel veri: okuma kaydı (SENSITIVE_READS).
  - `GET /admin/stock-board`: satılabilir stok (raf − ayrılan, tüm depolar) ile tümü / azalan (≤5, tükenenler dahil) / tükenen; en boş önce; en yeni 2000 kalem.
  - `GET /admin/reports/sales`: dashboard özeti, tüm satılan ürünler (100'e kadar) ve 20 kategoriyle; `buildOverview` limit alıyor.
  - Birim: `lib/dashboard/{board,stock}`; HTTP: order-board, stock-board, dashboard (rapor).
- **Panel ekranları:**
  - Ürünler: liste; 5 adımlı sihirbaz (temel, görsel, fiyat/stok + seçenek/varyant, paket ölçüsü + desi, kontrol listesiyle yayın); kart kart kaydeden detay (genel, görsel, varyant fiyat/stok, düzen, ölçü, katalog, özellikler), yayınla/kaldır, sil.
  - Siparişler: aşama sekmeleri; detay (ilerleme çizgisi, kalemler + tutarlar, müşteri, adres, ödeme), kargoya ver (fulfillment + shipment), teslim edildi, tahsil et, iptal.
  - Müşteriler (üye/misafir, detayda son siparişler ve maskeli fatura bilgisi), Kategoriler (ağaç + düzenleyici, sıra), Stok (satır içi raf adedi, toplu kaydet), Kampanyalar (yüzde/tutar/ücretsiz kargo, kod/otomatik, sınır, tarihler kendi kampanyasında), Raporlar (KPI, ürün performansı, gün gün, CSV), SEO özeti (arama önizlemesi, katalog sağlığı).
  - Ayarlar: Mağaza (ad, iletişim, saat dilimi, birimler; ürün formları birimi izler), SEO, Ürün özellikleri (şablon düzenleyici, adr/0013), Özellikler (bayraklar), İşler (indir), Denetim kaydı (personel adıyla, CSV dışa aktarma işi).
  - Desenler: DataTable, FilterTabs, SearchInput, Pagination, Wizard, CardForm, LeaveGuard, ConfirmDialog; komut menüsünde sık işler; telefonda listeler sütun katlıyor.
  - Panel oturumunda hata `code`'u SDK'dan gelmediği için "değerler silinecek" ve "şablon değişimi" onayları hata beklenmeden önceden soruluyor.
- **Bağımsız incelemeler (kod + güvenlik ajanları) ve düzeltmeler:**
  - Kargoya verme artık tek backend workflow'u (`POST /admin/orders/:id/ship`). Medusa'nın fulfillment ve shipment workflow'ları adım olarak, sipariş başına kilitle çalışıyor; kalemleri sunucu seçiyor. Paketlenip gönderilmemiş bir koli önce teslim ediliyor.
  - Sipariş aşaması tek kaynakta, kalem adetlerinden hesaplanıyor (`lib/dashboard/lifecycle`). Gönderilecek kalemi kalan sipariş "hazırlanacak"ta kalıyor; kısmi iadeli sipariş ödenmiş sayılıyor.
  - Panel aşamayı ve yapılabilecek işlemleri `/admin/order-board/:id`'den alıyor. Müşteri sayfasındaki siparişler de aynı panodan geliyor.
  - Liste telefonları kaldırıldı (docs/04). Panel CSV'si sunucunun kaçış kuralıyla aynı.
  - Paylaşılan kampanyanın tarihleri kilitli. Promosyon ve kampanya değişiklikleri önce/sonra özetiyle denetim kaydında.
  - Pano ve rapor okumalarında eşzamanlı istekler tek hesaplamayı paylaşıyor (`createSingleFlight`).
  - Sihirbaz seçenek hatası, 3 ondalıklı ölçü, eski stok değerinin geri yazılması, depo yokken stok, kaydedilmemiş stok taslakları düzeltildi.
  - i18n dışı metinler taşındı; görünüm önizlemesindeki sektöre özel örnek kaldırıldı. `middlewares.ts` 300 satırın altına indi.
- **F3 T1b (F3.2) bitti:** dijital ve hizmet ürünleri, `catalog.non_physical` bayrağıyla.
  - Tür değişince kargo profili ve envanter kalemlerinin `requires_shipping` değeri geri alınabilir adımlarla ayarlanıyor. Yeni varyant ve yeniden bağlanan profil hook'larla düzeltiliyor.
  - Checkout'ta kargo gerekmeyen sepet kargo yöntemiyle tamamlanamıyor; ülkesiz sepet KDV'siz kalmasın diye reddediliyor.
  - Panelde sihirbazda tür seçimi var (kargo adımı atlanıyor); ürün sayfasında tür değiştirilebiliyor.
  - HTTP: tam takım 26 dosya / 172 test geçti.
- **F3 T2 (F3.4a) bitti:** `seo-meta` modülü (adr/0015). Ürün, kategori ve koleksiyona link'li.
  - `GET/PUT /admin/seo/:entity_type/:entity_id`; `upsertSeoMetaWorkflow` kilitli çalışıyor, her adım geri alınabilir.
  - Alanlar temiz metin ve tavan uzunlukla doğrulanıyor. Canonical yalnızca site içi yol olabiliyor; OG görseli mağazanın kendi dosyası olmalı.
  - Aynı türde aynı başlık ya da açıklama uyarı olarak dönüyor, kayıt reddedilmiyor (normalize hash, indeksli).
  - Denetim kaydında alan bazında önce/sonra var. Store API'de `seo_meta` alanları istenemiyor (`rejectStoreSeoFields`).
  - Panelde ürün ve kategori sayfasında "Arama motoru görünümü" kartı: sunucuyla aynı şablon kuralıyla Google önizlemesi, sayaçlar, odak kelime, robots, gelişmiş canonical, tekrar uyarısı.
  - OG görseli seçimi T6'daki görsel hattıyla gelecek.
- **F3 T3 (F3.5) bitti:** yönlendirme motoru (adr/0017, uygulama notu eklendi). Commit'ler `0720c43`, `2de61a5`, `87cedcb`, `6f586a4`, `8e5c9c9`.
  - `seo-redirects` modülü. Tam, önek ve desen kuralları; desen dili güvenli (`:ad` bir bölüm, sondaki `*` kalanı), regex yok. Yanıtlar 301/302/307/410; sorgu dizesi korunur, atılır ya da yalnız listelenenler kalır.
  - `GET /store/seo/resolve` şu sırayla bakar: yayındaki kaydın kendi yolu (hiçbir kural canlı sayfayı gizleyemez) → kurallar → `url-registry`'deki eski yollar. Zincirin sonu tek atlamada dönüyor; 60 sn paylaşılan önbellek.
  - Eski yolların davranışı:
    - Adı değişen ürünün eski yolu bugünkü yoluna gider.
    - Satıştan kalkan ya da silinen ürün yayındaki halefine gider.
    - Halefi olmayan silinmiş kayıt 410, taslak 404 verir.
  - Kaydetme anında:
    - Zincirler düz saklanıyor (A→B, B→C ⇒ A→C).
    - Döngü, 410'a giden hedef ve canlı sayfanın yolunu alan tam kural reddediliyor.
    - Kural yazımları tek kilit altında.
    - Hedef yalnızca site içi yol; backend yolları ne kaynak ne sonuç olabiliyor.
  - CSV içe/dışa aktarma: dosya tümüyle uygulanır ya da hiç uygulanmaz. Kuru çalıştırma hiçbir şey yazmıyor; hatalar satır numarasıyla dönüyor.
  - Eski adresler listesi ve kişiye özel "serbest bırak" eylemi. T1a'dan devreden işi kapatıyor: silinen ürünün adı yeniden kullanılabiliyor.
  - 404 günlüğü:
    - Storefront bildiriyor (dakikada 30 istek sınırı). Yalnızca gerçekten çözülemeyen yollar sayılıyor; referer'dan yalnızca host tutuluyor; kişisel veri içeren yollar hiç tutulmuyor.
    - Benzer slug'a göre hedef önerisi var.
    - Sayaçlar bellekte toplanıp 30 sn'de bir tek SQL ifadesiyle yazılıyor. Günlük iş 90 günden eskiyi siliyor, en çok 10.000 kayıt tutuyor.
  - Denetim kaydı: kural değişiklikleri ve serbest bırakmalar önce/sonra ile.
  - Panel: SEO > Yönlendirmeler ekranı.
    - Sekmeler: kurallar (ekle/düzenle/sil, eşleşme filtresi), eski adresler, 404 günlüğü (önerilen sayfaya tek tıkla 301).
    - Dosyadan içe aktarma (önce kontrol), dışa aktarma, adres testi.
    - SEO özetinde sayılı kart. Telefonda da denendi.
  - Bağımsız güvenlik incelemesi: açık yönlendirme, header enjeksiyonu ve SQL enjeksiyonu yok. Bulunan bir orta ve dört düşük bulgu düzeltildi:
    - Bozuk Unicode ile 404 toplu yazımını düşürme.
    - `Vary: Origin`'in ezilmesi. Aynı hata `tr-address` önbelleğinde de vardı.
    - Kuru çalıştırmanın kural yazması.
    - Sayaç tamponunun sınırsız büyümesi.
    - Backend yoluna yönlendirme.
  - Testler: birim (yol, desen, kaynak/hedef, konum, CSV, sayaç, dosya içi döngü); HTTP 12 test (iki yeni dosya).
  - Dev DB'de örnek veri var (4 kural, 4 404 kaydı); panelden silinebilir.
- **F3 T4 (F3.4b) bitti:** Commit'ler `de2b799`, `0a46f01`, `d400f47`, `c30756c`.
  - Store resolve yanıtında yayındaki sayfanın `seo` nesnesi var (adr/0015, docs/13 §1). `lib/seo/resolve` saf.
    - Başlık ve açıklama: sayfanın kendi alanı ya da şablon.
    - Canonical host'ta mutlak URL; host yoksa `null`.
    - Ayrıca robots, OG, Twitter ve birincil (yoksa en derin) kategoriden breadcrumb.
  - Şablon değerleri:
    - kategori;
    - kısa metin (alt başlık, yoksa açıklama kelime sınırında kesilir);
    - TRY fiyatlarından fiyat cümlesi ("899,00 TL'den başlayan fiyatlarla.");
    - SEO'da öne çıkan ilk özellik.
    - Marka T5'te, kargo cümlesi F7'de, JSON-LD T9'da, hreflang F19'da gelecek.
  - Yanıtlar süreç içinde önbellekte. Sayfa, SEO alanı, kural, yol ya da ayar değişince ve katalog olaylarında tüm süreçlerde siliniyor (sürümlü işaret); en geç 30 sn.
    - Önbellekten dönen yönlendirme de isabet sayıyor.
    - Değişiklik sırasında hesaplanan yanıt yeni önbelleğe girmiyor.
  - URL biçimi değişimi:
    - Önce `GET /admin/seo/url-style` kontrolü: taşınacak sayfa sayısı ve çakışmalar (aynı yol, mağazanın kendi sayfası, başka kaydın yolu).
    - Sonra `seo.url_style` işi yolları 100'lük partilerle taşıyor ve biçimi en sonda kaydediyor. Eski yollar 301 veriyor. Yarıda kalan iş yeniden çalıştırılınca kaldığı yerden devam ediyor.
    - Ayarlar ucu biçimi doğrudan değiştirmeyi reddediyor.
    - Panelde SEO ayarlarında kontrol, onay ve ilerleme akışı var.
  - Panel SEO önizlemesi sunucunun metin kurallarını kullanıyor (port + test).
- **F3 T5 (F3.11) bitti:** marka modülü. Commit'ler `eff702d` ve panel.
  - Marka: ad (büyük-küçük harf fark etmeden tekil), Türkçe harfleri katlanmış slug, açıklama, mağazanın kendi yüklediği logo, yayında anahtarı.
  - Ürün ↔ marka link'i; marka SEO alanları kategori gibi link'li.
  - Marka sayfa yolu `url-registry`'de (`/marka/{slug}` ya da düz):
    - adres değişince eski yol 301 verir;
    - gizli marka 404, silinen marka 410 verir;
    - URL biçimi taşıma işi markaları da kapsıyor.
  - Uçlar:
    - Yönetici: `/admin/brands` CRUD (ürün sayısıyla) ve `POST /admin/products/:id/brand`; denetim kayıtlı.
    - Store: `/store/brands`, `/store/brands/:id`, `/store/brands/:id/products` (yayındaki ürün id'leri) ve ürünlerde `fields=+brand.name`.
  - SEO: marka sayfası payload'u marka şablonundan; ürün başlığı `{marka}`'yı dolduruyor.
  - Panel:
    - Katalog > Markalar: liste, yeni marka diyaloğu, detay (genel, logo, arama görünümü, silme).
    - Ürün sayfasında aranabilir marka seçici (yeni `SearchPicker` deseni).
  - **Güvenlik düzeltmesi (T2'den):** bir işin sonuç dosyası (ör. denetim kaydı dışa aktarımı) artık paylaşım görseli ya da logo olarak verilemiyor.
    - Açık şuydu: API anahtarı dosya id'sini OG görseline yazıp URL'yi Store resolve yanıtından okuyabiliyordu. Bu, sonuç ucundaki kişi kontrolünü atlatıyordu.
    - Ortak kontrol: `workflows/files/public-upload.ts`.
  - Dev DB: "Örnek Seramik Atölyesi" markası oluşturuldu ve Seramik Kupa'ya atandı (deneme verisi).
- **F3 T9 (F3.12) bitti:** yapılandırılmış veri. Commit'ler `4a03882`, `f668f88`.
  - `lib/seo/jsonld` saf; bloklar sayfanın ve feed'in kullandığı kaynaklardan.
  - Ürün:
    - Tek varyant `Product` + `Offer`; çok varyant `ProductGroup` + varyant başına `Product`. Her teklifin URL'si `?variant=` ile varyantı seçili açar.
    - Alanlar: SKU, yalnızca geçerli GTIN, MPN, TRY fiyat (sayısal metin), stoktan `availability`, ürün durumu, marka, görseller.
    - `variesBy` özellik şablonunun Google özelliklerinden.
  - Kategori, marka, koleksiyon: `CollectionPage` + ilk 24 yayındaki ürünün `ItemList`'i.
  - Ayrıca `BreadcrumbList`; ana sayfa için `GET /store/seo/site` (`OnlineStore` + `WebSite`).
  - Sözleşme testleri: bloklar Google'ın zorunlu alanlarını taşıyan zod şemalarıyla doğrulanıyor.
- **F3 T10a bitti:** site haritası ve robots.txt. Commit `9dac9d8` ve panel.
  - `seo.sitemap` işi yayındaki, indekslenebilir sayfaları bugünkü yollarıyla topluyor: ürün (görselleriyle), kategori, marka, koleksiyon.
    - Taslak, noindex ve canonical'ı başka yeri gösteren sayfalar dışarıda.
    - Tür başına dosya; 50.000 URL ya da 45 MB'ta bölünüyor; dizin dosyası var; dosyalar tek seferde değişiyor.
  - Değişiklikler işaret bırakıyor. Beş dakikalık zamanlayıcı, değişiklikler iki dakika durulunca ve günde bir yenilemeyi kuyruğa alıyor.
  - Store uçları:
    - `GET /store/seo/sitemaps/:name` (yalnızca site haritası adları).
    - `GET /store/seo/robots`: şablon + site haritası adresi + AI ön ayarı (eğitim tarayıcıları tek grupta engelleniyor; arama tarayıcıları serbest).
    - `/store/seo/site` storefront kenarına canonical host'u (301 için) ve indeksleme durumunu söylüyor.
  - `SEO_INDEXING` (staging'de varsayılan kapalı): robots her şeyi engelliyor, her sayfa `noindex,nofollow`.
  - Panel: SEO özetinde site haritası kartı (sayfa sayısı, dosyalar, bekleyen değişiklik, şimdi yenile).
- **F3 T10b bitti:** IndexNow. Commit `b12cf27`.
  - `seo.indexnow` bayrağının arkasında, varsayılan kapalı.
  - On dakikada bir, son bildirimden bu yana değişen yayındaki sayfaları ve bırakılan yolları api.indexnow.org'a bildiriyor; çağrı başına 10.000 URL.
  - Anahtar ilk kullanımda üretiliyor; storefront `/store/seo/site`'tan alıp `/{key}.txt`'de sunar.
  - Host yoksa ya da indeksleme kapalıysa hiçbir şey gitmiyor. Başarısız çağrı bir sonrakinde aynı değişikliklerle tekrarlanıyor.
- **F3 T11 (F3.13) bitti:** SEO danışmanı. Commit'ler `2a55c50`, `729ac87`, `812d045`, `4cf7f32`.
  - `lib/seo/advisor` saf ve deterministik. Bugünkü veriyle cevaplanabilen kurallar:
    - Ortak: başlık/açıklama uzunluğu (piksel tahminiyle), tekrar, bağırma, marka, slug, odak kelime.
    - Ürün: metin uzunluğu, zorunlu özellikler, H1, http, görsel sayısı, fiyat, GTIN/MPN, marka, kategori/birincil kategori, ölçü.
    - Kategori/marka/koleksiyon: metin, boş sayfa, derinlik, logo.
  - Puan: bulgu, önemine göre kategorisinin ağırlığından pay alır; kritik bulgu kategoriyi sıfırlar. Sayfa türüne uyan ağırlıklar üzerinden 0–100. Notlar 90/70/50.
  - `seo-advisor` modülü değerlendirmeleri tutuyor. Değerlendirme şu durumlarda yenileniyor: kayıt olaylarında (ürün, varyant, SEO alanı, marka), sayfa açılınca, gece 04:15'te.
  - Tek tık düzeltmeler sunucuda, aynı workflow'larla: şablon başlık/açıklamaya dön, en derin kategoriyi birincil yap.
  - Panel:
    - Ürün, kategori ve marka sayfasında danışman kartı (puan halkası, not, "neden önemli/nasıl düzeltilir", düzelt ya da alana git).
    - Ürün listesinde SEO sütunu.
    - SEO özetinde mağaza puanı, not dağılımı, kritik sayısı, en düşük 10 ürün.
  - `seo.publish_gate` bayrağı (varsayılan kapalı): taslaktan yayına geçişte kritik bulgu ya da 50 altı puan reddediliyor.
- **F3 T12 (F3.14) bitti:** mağaza geneli SEO denetimi.
  - `seo.audit` işi (tekil, rapor 30 gün): gece değerlendirmelerinin ardından kendiliğinden, panelden de istenince çalışıyor. Her kontrolden sonra ilerleme bildiriyor.
  - Kurallar (docs/14 §3.9): S-HOST-01, S-ROBOTS-01, S-SITEMAP-01, S-404-01, S-DUP-01, S-ORPHAN-01, S-REDIR-01. Kurallar `lib/seo/audit` içinde saf; robots.txt RFC 9309'a göre okunuyor (`lib/seo/robots-match`).
  - Bulgular iş özetinde (her birinin ilk 10 kaydı), tamamı `;` ayraçlı, formül kaçışlı CSV raporda.
  - Değerlendirmeler artık gösterilen başlık/açıklamanın hash'ini ve sayfanın yayında + indekslenebilir olduğunu (`is_listed`) tutuyor. Şablondan gelen tekrarlar da yakalanıyor.
  - Panel, SEO sayfasındaki "Mağaza denetimi" kartı:
    - Şimdi denetle, raporu indir.
    - Bulgular önem sırasıyla, açılınca "neden önemli" ve kayıtlar.
    - 404 için önerilen sayfaya tek tık 301; diğer kayıtlarda sayfaya, kurala ya da ayarlara git.
  - Yan iyileştirmeler:
    - Kart başlığı dar ekranda eylemi alt satıra alıyor (tüm `SectionCard`'lar).
    - İş indirme düğmesi ortak bileşen oldu.
  - Hata düzeltmesi: yeni sayfa aynı anda iki kez değerlendirilince (kayıt aboneliği + sayfanın açılması) ikinci kayıt 400 dönüyordu. Artık güncellemeye düşüyor; birim testli.
  - Bağımsız kod incelemesinin bulguları düzeltildi.
- **F3 T7 (F3.7) bitti:** stok ve depolar.
  - Kilit modülü bağlandı (adr/0020): `REDIS_URL` varsa `locking-redis`, anahtarlar `qt:lock:<tenant>:` altında; yoksa Medusa'nın bellek içi sağlayıcısı. Dev ve testler Redis kilidiyle çalışıyor.
  - KK testli: aynı son ürüne eşzamanlı iki checkout'tan biri sipariş oluyor, diğeri stok hatası alıyor; rezervasyon rafı aşmıyor.
  - İptal rezervasyonu geri veriyor; gönderim raftan düşüyor; teslim alınan iade rafa dönüyor (HTTP testli, admin iade akışıyla).
  - Bootstrap her mağazaya varsayılan depo kuruyor ("Ana Depo"), varsayılan satış kanalına bağlıyor; seed demo adresini ekliyor.
  - Panel, Ayarlar > Depolar:
    - Depo ekle/düzenle (il/ilçe seçimli Türkçe adres formu, mahalle, posta kodu-il uyumu, telefon kontrolü), varsayılan yap, sil.
    - Stok sayfası varsayılan depo yoksa uyarıyor.
  - Kendi uçlarımız `/admin/warehouses` (oluştur + kanala bağla, güncelle + adres ekle, varsayılan yap); her biri tek workflow.
  - Depo silme koruması: varsayılan depo, stok/rezervasyon/gelecek stok olan depo ve iade beklenen depo silinmiyor (409).
  - Depo adresleri F1.4 Türkçe adres kontrolünden geçiyor (hem bizim uçlar hem Medusa'nınkiler). Adres reddi artık i18n anahtarıyla dönüyor; tüm sorun kodlarının Türkçe/İngilizce cümlesi var.
  - Depo ve varsayılan depo değişiklikleri denetim kaydında (önce/sonra; telefon yalnızca "değişti").
  - Bağımsız kod incelemesinin bulguları düzeltildi.
- **F3 T6 (F3.3) bitti:** görsel hattı (adr/0016, uygulama notu eklendi). `sharp` 0.35.5 eklendi.
  - **KK, EXIF temizleme:** `/admin/uploads`'tan geçen her görsel saklanmadan önce işleniyor: EXIF yönüne göre döndürülüyor, metadata (EXIF/GPS/XMP/IPTC) atılıyor, en fazla 2560 px. Çözülemeyen görsel reddediliyor. HTTP testli.
  - **`media` modülü:** görsel kaydı (alt metin, türevler), ürüne link. Panel yüklemeden sonra görseli kaydediyor. URL ile eklenmiş görsele de alt metin için kayıt açılıyor.
  - **Türevler:** ürün kaydından sonra ürün başına kilitli workflow üretiyor:
    - 400/800/1600 WebP + AVIF ve 1200×630 OG; şeffaf görsel beyaz zeminde.
    - Ad ürün slug'ından: `{slug}-{sıra}-…`. Slug ya da sıra değişince yeniden üretiliyor.
    - Gece süpürmesi kaçanları üretiyor; hiçbir ürüne girmemiş, bir günlük yüklemeleri siliyor.
  - **Store API:** `fields=+media_assets.url,+media_assets.alt,+media_assets.derivatives`. Toplu ya da iç içe yollar reddediliyor.
  - **SEO:** Paylaşım görseli ana görselin OG kırpması ve alt metni. Danışmanda P-IMG-02 (alt metin), mağaza denetiminde S-IMG-01.
  - **Panel:**
    - Ürün sayfasında alt metinler (alandan çıkınca kaydedilir) ve sürüm durumu; sunucu işlerken sayfa kısa süre kendini yeniliyor.
    - Varyant görselleri kartı.
  - **Düzeltme:** S3'te logo, paylaşım ve ürün görseli adresleri Medusa'nın süreli imzalı bağlantısı yerine kalıcı public adres oluyor.
  - Bağımsız kod incelemesinin bulguları düzeltildi.
- **F3 T8 (F3.8) bitti:** stok kuralları (adr/0020, uygulama notu eklendi).
  - **`stock-ledger` modülü:** stok hareket defteri, yalnızca ekleniyor.
    - Her satırda raf ve ayrılan adet için önce/sonra, neden (elle, sipariş, iptal, iade, eşitleme…) ve sipariş referansı var.
    - Satırları Medusa'nın seviye ve rezervasyon olaylarına abone olan workflow yazıyor. Seviye okunup defterin son satırıyla farkı yazılıyor, seviye başına kilit altında; tekrar gelen olay hiçbir şey yazmıyor.
    - Rezervasyon olayları sipariş taşımıyor; sipariş, rezervasyonun sipariş satırından bulunuyor.
  - **Eşitleme:**
    - Gece işi (03:15) olayların kaçırdığı farkları yazıyor.
    - `db:migrate` bir kez açılış bakiyelerini yazıyor (`src/migration-scripts`). Böylece mevcut mağazada ilk değişiklik "+3" değil "97 → 3" olarak görünüyor.
  - **KK, düşük stok uyarısı:**
    - Mağaza eşiği Ayarlar > Depolar'da (varsayılan 5); kaleme kendi eşiği verilebiliyor.
    - Satılabilir stok (tüm depolar, ayrılan düşülmüş) eşiğin üstünden eşiğe ya da altına inince bir `feed` bildirimi yazılıyor. Eşiğin üstüne çıkınca yeniden kuruluyor.
    - Eşzamanlı iki siparişte tek bildirim (testli).
  - **Ön sipariş:** `stock.preorder` bayrağı; ürün sayfasında varyant başına "Stoksuz satış".
    - Bayrak kapalıyken Medusa'nın altı ürün/varyant yolunda yeni stoksuz satış reddediliyor.
    - Stoksuz satan varyantın stok seviyesi yoksa kayıt sırasında varsayılan depoda boş seviye açılıyor; checkout "bulunamadı" demiyor. Stoksuz sipariş testli.
  - **Panel:**
    - Üst çubukta bildirim zili.
    - Stok sayfasında satır başına "stok geçmişi" paneli: hareketler, nedenler, sipariş bağlantısı, kalemin kendi eşiği.
    - Ayarlar > Depolar'da düşük stok eşiği kartı.
    - Sihirbazdaki "stok bitince de sat" anahtarı bayrağa bağlandı.
  - **Yan düzeltmeler:**
    - Ürün sayfasında marka seçicinin temizle düğmesi kartın dışına taşıyordu.
    - Varyant kartı satır bileşeni ve saf yardımcılar olarak bölündü (birim testli).
  - Bağımsız kod incelemesinin bulguları düzeltildi.
- **F3 T13 (F3.16a) bitti:** içerik sayfaları ve blog (adr/0019, uygulama notu eklendi). Tiptap 3.31.4 eklendi (3.32.0, 14 gün kuralını sağlamadığı için alınmadı).
  - **`content` modülü:** sayfa (`/{slug}`) ve blog yazısı (`/blog/{slug}`) tek kayıtta, `kind` ile.
    - Gövde ProseMirror belge JSON'u olarak saklanıyor, HTML olarak değil. Zod izin listesi: h2–h4, kalın, italik, bağlantı, liste, alıntı, tablo, görsel, ürün ve kategori kartı.
    - Belge önce boyut ve derinlik sınırından, sonra şemadan geçiyor. Her düğüm tek kez denetleniyor (iç içe listeler üstel süre almıyor; testli).
    - HTML'i kendi oluşturucumuz üretiyor: izin listesi dışında etiket yok, her metin ve adres kaçışlı.
    - Görseller yalnızca medya kütüphanesine yüklenmiş dosyalar. Kartlar yalnızca id taşıyor; Store API'de canlı ürünün ya da kategorinin güncel adı ve yoluyla çiziliyor.
  - **Yol ve SEO:**
    - Yol url-registry'de. Yayında olmuş girişin eski yolu 301 veriyor, silinince 410; hiç yayına çıkmamışsa yol boşalıyor.
    - Resolve `seo` payload'ı: sayfa `WebPage`, yazı `BlogPosting` (yazar, tarihler, yayıncı), blog yazısında "Blog" breadcrumb'ı.
    - Başlık şablonları `{başlık} | {mağaza}` (Ayarlar > SEO). Sitemap'te `pages`/`posts` dosyaları (`lastmod` metnin değiştiği tarih). IndexNow ve yönlendirme önerileri içeriği tanıyor.
    - SEO danışmanında içerik kuralları (docs/14 §3.8): A-LEN, A-STRUCT, A-ANSWER, A-INLINK, A-BYLINE, A-COVER, A-STALE.
  - **Uçlar:** `/admin/content` (liste, oluştur, güncelle, sil; denetim kaydında önce/sonra) ve `/store/content` (yayındaki liste; tek giriş HTML, başlık listesi, okuma süresi).
  - **Panel:** İçerik menüsü (Sayfalar / Blog yazıları).
    - Giriş sayfasında genel bilgiler, editör, kapak, arama görünümü ve danışman.
    - Editör sunucunun izin listesine göre daraltıldı. Görseller yükleniyor ve alt metin soruluyor; ürün ya da kategori kartı aranarak ekleniyor; yapıştırılan görsel ve izinsiz bağlantı atılıyor.
  - **İncelemeler:** bağımsız kod ve güvenlik incelemelerinin bulguları düzeltildi. Güvenlik incelemesi XSS bulmadı; iki DoS bulgusu (üstel doğrulama, karesel regex) düzeltildi ve süre testleriyle kilitlendi.
- **F3 T14a (F3.16b) bitti:** facet landing sayfaları (docs/13 §7 ve docs/14 §3.7 uygulama notları).
  - **Kayıt:** `landing_page` (`content` modülünde). Bir kategori ve tek facet: marka ya da filtrelenebilir seçim özelliğinin bir değeri. Başlık, adres, durum, belge gövdesi (ADR-0019 denetimi), özgünlük.
    - Kategori ve facet sonradan değişmiyor. Kategori + facet ve kategori + adres benzersiz.
    - Varsayılan adres değerin slug'ı. Slug çıkmayan değerde (`42`) değerin adı, o da olmazsa başlık.
  - **Adres:** kategorinin yolu + adres (`/kategori/ev-ve-yasam/seramik`).
    - Kategori adı ya da yeri değişince landing'ler de taşınıyor; eski yol 301.
    - Kategori gizlenince sayfa 404, silinince 410.
  - **Özgünlük kapısı (KK: < %30):**
    - Metnin parmak izi kayıtta tutuluyor: 5 kelimelik dizilerin MinHash imzası (128 tohum). Karşılaştırma imzayla ve sabit sürede; tam metin karşılaştırılmıyor.
    - Facet ve kategori adları ölçümden önce yer tutucuya çevriliyor; yalnızca adı değiştirilmiş şablon aynı metin sayılıyor.
    - Metnin sahibi onu ilk yayına alan sayfa: bir sayfa, metni kendisinden önce yayına girmiş canlı sayfalarla ölçülüyor. Sonradan kopyalayan taslak orijinali düşürmüyor.
    - Yayına alırken ya da canlı metin değişirken %30'un altı reddediliyor (`content.landing_not_original`). Danışmanda %40'ın altı kritik.
    - Gece işi hepsini aynı kuralla yeniden ölçüyor; `updated_at` değişmiyor.
  - **Ürünler:** kategoride ve görünen alt kategorilerinde, facet'e sahip, yayındaki ürünler; en yeni önce.
    - Facet sorgusu tek seçimli (`value_text`) ve çok seçimli (`value_options`) değerleri indeksli SQL'le okuyor.
    - Büyük facet'te kimlikler 5000'lik parçalarla sorgulanıyor.
  - **SEO:**
    - Resolve `seo` payload'ı: CollectionPage + ItemList; breadcrumb kategori zinciri ve sayfa.
    - Başlık şablonu `{başlık} | {mağaza}`; `{kategori}` da kullanılabiliyor.
    - Sitemap'te `landings` dosyası. Sitemap, IndexNow ve 404 önerileri yalnızca kategorisi görünen sayfaları alıyor (`workflows/seo/live-records`).
    - IndexNow artık kaydı değişmeden yolu değişen sayfaları da duyuruyor: kategori taşınınca alt kategoriler ve landing'ler.
  - **Danışman:** L-UNIQ-01, L-TEXT-01, L-PRODUCTS-01, L-BATCH-01, L-REVIEW-01; `RULES_VERSION` 4.
  - **Uçlar:**
    - `/admin/landings`: liste, oluştur, güncelle, sil, `facets` kataloğu. Denetim kaydında oluşturma dahil önce/sonra.
    - `/store/landings/:id`: HTML, facet, ürün sayısı. `/store/landings/:id/products`: Store ürün API'si için kimlikler.
  - **Panel:** İçerik > Filtre sayfaları sekmesi; yeni sayfa diyaloğu (kategori + facet).
    - Sayfa ekranında genel bilgiler, editör, arama görünümü, danışman ve "Sayfanın durumu" kartı (özgünlük çubuğu, ürün sayısı, "İnsan inceledi").
    - Kategori ya da facet silinmişse uyarı var.
  - **İnceleme:** bağımsız kod incelemesinin 4 yüksek ve 9 orta bulgusu ile düşük bulguların çoğu düzeltildi.
    - Yüksekler: gizli kategorinin landing'i sitemap'e giriyordu. `paslanmaz_celik` gibi değerler geçersiz adres üretiyordu. Kopya taslak orijinali düşürüyordu. Kategori hook'u yarıda kalınca yolları geri almıyordu.
    - Ortalar ve düşükler aşağıdaki kararlarda.
  - **Testler:** birim (özgünlük, ad yer tutucusu, sıra kuralı, alt ağaç, kurallar) ve HTTP 10 test (`landings`, `landings-standing`).
- **F3 T14b (F3.17) bitti:** liste sayfalarının filtre parametreleri (docs/13 §3 ve §7 uygulama notu).
  - **Parametreler:** `marka` (handle), filtrelenebilir seçim özelliklerinin anahtarları, `fiyat` (`100-500`), `sirala`, `sayfa`. Bir anahtarın değerleri virgülle (`renk=kirmizi,mavi`).
  - **Kanonik biçim:** sabit sıra, sıralı değerler. Başka sıra ya da biçim tek 301 ile düzeltiliyor. `utm_source` gibi diğer parametreler korunuyor ve yönlendirme yaptırmıyor.
  - **Landing'e yönlendirme:** kategoride tek facet'in yayında landing'i varsa 301 ile oraya gidiliyor. Bu, sırası yanlış sorguda ve sorguyla biten yönlendirme kuralında da tek atlamada oluyor.
  - **404:** ürünü olmayan kombinasyon, son sayfadan sonrası ve tuzak sorgular (6'dan fazla anahtar, toplam 12'den fazla değer, 10.000'den büyük sayfa).
  - **İndeks:** filtreli, fiyatlı ya da sıralı liste `noindex,follow`, canonical temiz sayfa. Numaralı sayfa kendi canonical'ında; başlıkta ve JSON-LD'de "Sayfa N".
  - **Resolve yanıtında `listing` alanı** var (filtreler, fiyat, sıralama, sayfa, `page_size` 24); storefront ürünleri buna göre isteyecek.
  - **Önbellek:** veritabanı işi (anahtarlar, landing, ürün sayısı) kanonik liste sorgusuna göre resolve önbelleğinde tutuluyor; rastgele izleme parametresi işi tekrarlatmıyor. Filtre başına tek indeksli SQL, anahtarlar sırayla, boş kesişimde duruyor.
  - **robots.txt:** şablondaki `{facet_disallow}` satırı her filtre, `fiyat` ve `sirala` için iki `Disallow` satırına açılıyor; `sayfa` ve landing yolları açık (KK testli).
    - Eski varsayılanı kayıtlı mağazalarda `db:migrate` bir kez yeni varsayılana geçiriyor (denetim kaydında `system`).
    - Mağaza denetimi (S-ROBOTS-01) açık kalan filtre adresini Googlebot/Bingbot'un kendi grubu dahil buluyor.
  - **Ayrılmış adlar:** `marka`, `fiyat`, `sirala`, `sayfa`, `variant`, `q`, `utm_*`, `gclid` vb. filtrelenebilir seçim özelliğinin anahtarı olamıyor (`product_attributes.key_reserved`).
  - **Storefront'un kendi sayfaları:** `/store/seo/site` robots değerlerini veriyor: arama `noindex,follow`, sepet/ödeme/hesap `noindex,nofollow`.
  - **İnceleme:** bağımsız kod incelemesinin bulguları düzeltildi. En önemlisi, rastgele parametreli sorguların önbelleği atlayıp istek başına onlarca sorgu çalıştırabilmesiydi.
  - **Testler:** birim (sorgu okuma, kanonik biçim, robots satırları, sayfa SEO'su, denetim, ayar doğrulama, migration betiği) ve HTTP 12 test (`seo-facets`, `seo-facets-listings`).
- **F3 T15 (F3.9) bitti:** Excel (xlsx) ve CSV ile ürün içe/dışa aktarma (adr/0018 uygulama notu). `yazl` 3.3.1 eklendi.
  - **Tablo katmanı (`lib/sheets`):**
    - Kendi xlsx okuyucumuz: güvenli zip ve XML, ayrıştırmadan önce satır, hücre ve metin sayımıyla bellek koruması.
    - `yazl` ile akan xlsx yazıcı: kalın ve dondurulmuş başlık, ikinci sayfada açıklamalar.
    - Windows-1254 CSV okunuyor.
    - Formül kaçışı: xlsx'te hücre başında, CSV'de tam kural; okuyucu biçime göre geri alıyor.
  - **Ürün tablosu (`lib/catalog-sheet`):** Türkçe sütunlar (birimler başlıkta), `Özellik: anahtar` sütunları, Türkçe sayı biçimi.
    - Aynı `Tanıtıcı`'lı satırlar bir ürünün varyantları.
    - Satır satır sorun listesi; sorunlu satırı olan ürün bütünüyle atlanıyor.
  - **İçe aktarma:** `POST /admin/catalog/imports?mode=check|apply`, gövde dosyanın kendisi (10 MB).
    - Dosya özel saklanıyor; kuyruğa alma reddedilirse geri alma adımı dosyayı siliyor. İş, dosyayı her sonuçta siliyor; yarıda kalanları gece temizliği topluyor.
    - "Kontrol et" hiçbir şey yazmıyor: eklenecek, güncellenecek ve değişmeyen ürün sayıları, sorunlar ve yeni ürünlerin SEO ön değerlendirmesi.
    - "Uygula" her ürünü tek bir birleşik workflow'la yazıyor (ürün, varyant, fiyat, marka, birincil kategori, SEO, özellik, stok); bir adım düşerse ürünün önceki adımları geri alınıyor (testli).
    - Var olan ürünlerde yalnızca değişen alanlar yazılıyor; dışa aktarılan dosya olduğu gibi geri yüklenince hiçbir şey değişmiyor (testli).
    - Rapor xlsx: satır, tanıtıcı, sonuç, sütun, açıklama, SEO puanı ve önerileri.
    - Denetim kaydında başlangıç ve bitiş (`catalog.import_started` / `_finished`): kim, dosyanın özeti, yazılan ürünler.
  - **Dışa aktarma:** `catalog.export` işi (xlsx ya da `;`+BOM CSV, ondalık virgülle), içe aktarmayla aynı sütunlar. Şablon: `GET /admin/catalog/import-template`.
  - **Panel:** Ürünler sayfasında "Dışa aktar" (Excel/CSV, hazır olunca indir) ve "İçe aktar" diyaloğu: şablon, dosya, kontrol özeti, SEO ön değerlendirmesi, rapor, uygula.
  - **Güvenlik:**
    - `catalog.import` iç iş tipi; genel `POST /admin/async-jobs` kuyruğa alamıyor.
    - Yüklenen dosya `/admin/uploads/:id`'den verilmiyor. CSRF istisnası yalnızca bu yolda ve xlsx/CSV gövde türlerinde.
    - Medusa'nın kendi ürün içe aktarma uçları ve workflow çalıştırma uçları kapatıldı (404).
  - **KK:**
    - 1000 satırlık Excel worker'da tamamlanıyor ve hatalı satırlar raporda (HTTP testi, yaklaşık 42 sn).
    - Dışa aktarılan Excel'de formülle başlayan hücre kaçışlı (HTTP testi).
  - **İnceleme:** bağımsız kod incelemesinin bulguları düzeltildi.
    - Temel TRY fiyatı ayrımı: fiyat listesi, kural ve kademe fiyatları korunuyor.
    - Çok satırlı açıklama kabul ediliyor.
    - Değişmeyen alanlar yazılmıyor.
    - XML boyut sınırı, ayrıştırmadan önce sayım.
    - Dışa aktarma hatasının zip akışına iletilmesi.
    - Geri alınabilir yükleme, denetim kaydı, aynı varyanta iki satırın sorun sayılması, Medusa'nın içe aktarmasının kapatılması.
    - "Listeler 15 kayıtla sınırlı" bulgusu dev'de ölçülerek yanlış çıktı.
  - **Testler:** birim (tablo okuma/yazma, tablo modeli, planlayıcı, CSRF, ayar doğrulama) ve HTTP 6 test (`catalog-sheets`, `catalog-sheets-roundtrip`).
- **Playwright e2e altyapısı kuruldu** (kullanıcı 2026-10-26 onayladı; docs/07 "E2E (panel)"). `@playwright/test` 1.64.0, `@axe-core/playwright` 4.13.0, panelde `@types/node` 24.19.2. 1.64.1 henüz 14 günlük değildi.
  - `apps/panel/e2e/`: her çalıştırma Medusa CLI ile rastgele parolalı geçici bir yönetici açıyor, giriş sayfasından giriyor, sonunda backend betiğiyle (`remove-e2e-admin.ts`) siliyor. Medusa kullanıcının kendini silmesine izin vermiyor; betik yalnızca e2e adreslerini siliyor.
  - Duman testleri (veri yazmaz): ana bölümler ve ayar sayfaları, ürün arama ve detay, içe aktarma kontrolü. Erişilebilirlik: dört ekranda axe (WCAG 2.1 A/AA), ciddi ve kritik bulgu yok.
  - axe'ın bulduğu iki sorun düzeltildi: süs grafiklerinde gizli alanda klavye durağı, sipariş durumu çubuğunda rolsüz `aria-label`. Kenar çubuğu artık adlandırılmış bir `<nav>` alanı ("Ana menü").
  - CI'da yeni `e2e` işi: Postgres ve Redis, migration ve demo mağaza, backend, Chromium. Başarısız çalıştırmanın raporu 7 gün saklanıyor (`actions/upload-artifact` v7.0.2, SHA'yla sabit).
  - Komut: `pnpm --filter @qticaret/panel test:e2e`. Yerelde 10 test yaklaşık 36 saniyede geçiyor.
- **CI düzeltildi (GitHub'da F2'den beri kırmızıydı):**
  - Typecheck, Medusa'nın `medusa build` ile ürettiği `.medusa/types` oluşmadan koşuyordu (turbo görevleri yan yana); `query.graph` sonuçları tipsiz kalıp 19 "implicit any" hatası veriyordu. CI artık önce build'i koşuyor.
  - Build de aslında kırıktı: Medusa Admin uzantılarından dördü `lib/seo` barrel'ını içe aktarıyordu, o da `node:crypto`'yu tarayıcı paketine taşıyordu. Dosyaların kendisi içe aktarılıyor; lint kuralı tekrarını önlüyor.
  - Entegrasyon testleri tek süreçte belleği dolduruyordu (`--runInBand`). Artık tek jest alt süreci, 1 GB'ı geçince dosya arasında yenileniyor; yerelde 49 dosya tek komutta yaklaşık 8 dakika. CI'da HTTP üç parça + modüller dört paralel işte (tek işte 25 dakikayı aşıyordu).
  - CI'ın boş mağazasında ilk e2e koşusu iki sorun buldu: kurulum kartının adsız ilerleme çubuğu ve yalnızca tik içeren adım düğmeleri (axe), arama kutusunun 300 ms bekleyen aramasının ürüne tıklamadan sonra sayfayı listeye geri götürmesi. İkisi de düzeltildi; arama kutusundan çıkınca arama hemen yapılıyor.
  - `sitemap_state` "duplicate key" satırları Postgres'in kendi logu; `markDirty` bu yarışı zaten yakalıyor, hata değil.
- **F3 T16 (F3.10) bitti: toplu düzenleme.**
  - **İş:** `catalog.bulk_edit`, genel `POST /admin/async-jobs` ile; girdi en çok 1000 ürün kimliği ve tek bir değişiklik. Her ürün önce mevcut durumundan planlanıyor (saf fonksiyonlar, birim testli), sonra panelin kendi kaydının kullandığı workflow'la tek tek yazılıyor; bir ürünün reddi yalnızca o ürünü etkiliyor.
  - **Değişiklikler:** fiyat (yeni fiyat, yüzde ya da tutar artır/azalt; temel TRY fiyatı, diğer para birimleri ve fiyat listeleri korunuyor), stok (varsayılan depoda ayarla/ekle/çıkar; defterde `bulk_edit`, iş ve kişi), yayın durumu (SEO yayın kapısı ve ölçü kuralı ürün route'undaki gibi), kategori (ekle/çıkar/birincil yap), SEO şablonu (ürünün kendi başlık/açıklaması şablona bırakılıyor), eksik alt metinleri doldurma (ürün adı + tek varyanta ait görselde varyant değerleri).
  - **Kayıt:** denetim kaydında başlangıç (değişiklik, ürün sayısı), her yazılan ürün için ayrı kayıt (kaynak `product`, her alanın önce/sonra değeri; fiyat route'larıyla aynı biçim) ve bitiş (sayılar, değişen ürünlerin hepsi); rapor xlsx, ürün başına satır ve neden.
  - **Bağımsız inceleme (kod + güvenlik) ve düzeltmeler:** ürünler baştan değil 20'şerlik parçalarla yazılmadan hemen önce okunuyor; stok ekle/çıkar Medusa'nın kalem kilidiyle fark olarak yazılıyor; içe aktarma ve toplu düzenleme aynı anda çalışamıyor (iş grubu `catalog.write`); fiyat kuruş ve baz puanla (201 TL +%0,5 = 202,01); kategori adımı düşerse kategoriler geri geliyor (testli); birincil kategori çıkarılınca en derin kalan kategori birincil oluyor; kit varyantları atlanıyor; stok yazıldıktan sonra defter ya da uyarı adımı düşerse stok geri alınmıyor; uzun adda alt metin numarası korunuyor.
  - **Panel:** ürün listesinde satır seçimi (sayfalar ve aramalar arasında kalıyor), seçim çubuğu (seçili sayı, eşleşenlerin hepsini seç, seçimi kaldır, "Toplu düzenle" menüsü), değişiklik penceresi (Türkçe sayı biçimi, sunucunun sınırlarıyla alan hatası, fiyatta örnek), ardından ilerleme, sonuç ve rapor. Pencere iş sürerken kapatılabiliyor; iş Ayarlar › İşler'de.
  - **İçe aktarmadaki iki açık kapandı:** içe aktarma taslağı yayına alırken SEO yayın kapısını atlıyordu ve stok hareketlerini defterde `manual` yazıyordu. Kapı kararı `publishGate()` olarak paylaşıldı; stok `writeStockLevelsWorkflow` ile `import` nedeniyle yazılıyor (ADR-0020 uygulama notu).
  - **Ek düzeltmeler:** panelin diyalog ve yan panel kapat düğmeleri ekran okuyucuya İngilizce "Close" diyordu; `Checkbox` kısmi seçimde tik gösteriyordu (artık çizgi); `Progress` değeri ekran okuyucuya iletmiyordu.
  - **Testler:** birim (planlayıcılar, girdi şeması, alt metin önerisi; panelde form ve sayı okuma), HTTP 6 test (`catalog-bulk-edit`: fiyat + fiyat listesi + rapor + denetim, stok defteri, yayın kapısı ve ölçü kuralı, kategori, SEO şablonu ve alt metin, geçersiz girdi), içe aktarma testine defter nedeni; e2e 13 test (toplu düzenleme seçimi ve pencere erişilebilirliği dahil).
- **F4 planlandı (2026-10-26):** Medusa 2.21.2 kaynak kodundan doğrulanan bulgularla 8 görev; ADR-0023 (fiyat geçmişi, 30 gün kuralı), ADR-0024 (kupon/kampanya kuralları), ADR-0025 (hediye kartı için resmi eklenti). Kullanıcı önerilen seçeneklerle kabul etti.
- **F4 U1 (F4.2) bitti: fiyat geçmişi.**
  - `price-history` modülü (append-only): varyant ve para birimi başına, müşteri grubu olmayan alışverişçinin ödediği fiyat (`calculated`) ve yanındaki liste fiyatı (`original`), fiyatı veren liste, neden, zaman. Satır yalnızca değişince yazılıyor.
  - Yakalama: fiyat, fiyat listesi ve liste kuralı olaylarına subscriber; saat başı kontrol (başlangıç/bitiş tarihi gelen liste olay üretmiyor); `db:migrate`'te açılış kaydı (yerelde 20 varyant).
  - 30 gün hesabı `lib/pricing` (`discountView`): indirimin başladığı andan önceki 30 günde geçerli en düşük fiyat; kademeli derinleşen indirim tek indirim (hukukçuya sorulacak, docs/12). Store API'de gösterim U3'te.
  - Testler: modül (3), birim (6), HTTP 2 (olaylar çalışıyor, indirimli liste, müşteri grubu fiyatı dışarıda, olaysız başlayan liste saatlik kontrolde, tekrar kontrol boş).
- **F4 U4 (F4.4 + F4.6) bitti: kuponlar.**
  - Kodlar büyük harf ve Türkçe harfsiz saklanıyor; müşteri nasıl yazarsa yazsın bulunuyor (`İndirim` = `INDIRIM`). Mevcut kodlar `db:migrate`'te bir kez çevriliyor (yerelde değişen olmadı).
  - Sepette tek kod (ayar `promotions.combine_codes`, varsayılan kapalı); otomatik kampanyalar kodla birlikte. Kod denemesi IP başına 10 dk'da 30, sepet başına 10.
  - Panel kampanya formuna "Kapsam ve koşullar" eklendi: tüm sepet ya da seçili kategoriler / koleksiyonlar / ürünler, en az sepet tutarı (KDV dahil), müşteri başına kullanım. Var olan kampanyada da değişiyor (Medusa'nın kural batch uçları ve kampanya bütçesi); önizleme koşulları yazıyor.
  - Testler: HTTP 5 (kod biçimi, tek kod ve birleştirme ayarı, deneme sınırı, `item_total` en az sepet kuralının çalıştığı, KK: limiti 1 olan koda yarışan üç ödemeden biri tamamlanıyor), panel birim (kural eşlemeleri, form), tarayıcıda oluştur/düzenle/sil denendi.
- **Gözden geçir (kullanıcı yokken önerilen seçenekle verilen kararlar):**
  - (2026-10-27 gece, F6) ADR-0029: havale `pending_authorization` (sipariş "ödeme bekleniyor"), kapıda ödeme `authorized`; kapıda ödeme ek ücreti sepette ayrı, korunan kalem; havale açıklaması sipariş numarası; kargo yalnızca parası alınmış ya da kapıda ödemeli siparişe.
  1. Bayrak adı `catalog.non_physical`, mağaza tarafından açılır, varsayılan kapalı. Etiketleri Medusa Admin'de ve panelde var.
  2. Kargo gerekmeyen kalemler sipariş ödenince "teslim edildi" sayılıyor. Dijital teslimat (indirme bağlantısı, kod gönderimi) F9 bildirimleriyle gelecek.
  3. Her checkout'ta teslimat ülkesi zorunlu. Medusa tek ülkeli bölgede ülkeyi kendisi dolduruyor, kural çok ülkeli bölgeler için koruma.
  4. Promosyon kodu 6 karakterden kısaysa uyarı veriliyor, kod yine kaydediliyor. Kupon deneme sınırı F4'te.
  5. Paylaşılan Medusa kampanyalarının tarihleri panelde salt okunur.
  6. SEO alanlarını API anahtarlı entegrasyonlar da yazabiliyor (`requireUserActor` yok); içe aktarma (T15) bunu kullanacak. Robots seçenekleri üç değerli (index/follow, noindex/follow, noindex/nofollow); boş değer sayfa durumuna göre davranış demek.
  7. **Kayıtların eski yolları kural olarak yazılmıyor** (ADR-0017'den sapma, adr'de uygulama notu var). Eski yollar `url-registry`'de rezerve kalıyor ve çözümleme onları sahibinin bugünkü yoluna gönderiyor.
     - Gerekçe: kural tablosuyla registry arasında senkron sorunu olmuyor; ürün eski adına dönünce döngü oluşmuyor; desen değişimi (T4) tek toplu işlem kalıyor.
     - Karşılığı: bu yolların isabet sayacı yok. Panelde ayrı bir "Eski adresler" sekmesi var.
  8. Kural kaynağında sorgu dizesi kabul edilmiyor (`/urun.php?id=12`); F14 geçişi bunları eşleme raporuna düşürür. Hedef yalnızca site içi göreli yol olabiliyor; canonical host doğrulanana kadar mutlak URL yok.
  9. Kurallar ve CSV içe aktarma API anahtarıyla da yazılabiliyor (F14 geçiş aracı için). Eski yolu serbest bırakmak yalnızca kişiye açık, çünkü geri alınamıyor.
  10. Yönlendirme yanıtı: tüm atlamalar 301 ise 301, değilse ilk geçici kod. Önbellek 60 sn, `stale-while-revalidate` 300 sn.
  11. 404 günlüğü 90 gün ve 10.000 kayıtla sınırlı. Kişisel veri içeren yol (e-posta, telefon, token) hiç kaydedilmiyor.
  12. Canonical host boşken `seo.canonical` `null` dönüyor; storefront kendi host'unu kullanır (adr/0015'teki kullanıcı kararıyla uyumlu).
  13. Fiyat cümlesi, fiyat listesi dışındaki TRY fiyatlarından geliyor. İndirim ve üstü çizili fiyat F4.3'te; kargo cümlesi F7'de.
  14. Medusa'da mağaza olayı yok: mağaza adı değişikliği başlıklara en geç 30 sn'de yansıyor.
  15. Ürün ve kategori adresleri yalnızca kontrol + iş akışıyla taşınıyor. Taslak ürünün eski adresi rezerve edilmiyor (yayında olmamış URL).
  16. Marka adı mağazada tekil (büyük-küçük harf fark etmez). Ad değişince slug kendiliğinden değişmiyor; adres ancak elle değiştirilirse taşınıyor.
  17. Gizli markanın ürünlerinde marka adı görünmeye devam ediyor; yalnızca marka sayfası ve mağaza listesi kapanıyor.
  18. Markanın ürün listesi Store'da id olarak dönüyor; fiyat ve satış kanalı için storefront `/store/products?id[]=` çağırıyor. Satış kanalı filtresi o çağrıda.
  19. Markaları API anahtarlı entegrasyonlar da yazabiliyor (içe aktarma, F3.9).
  20. JSON-LD yalnızca canonical host girilince üretiliyor (mutlak URL ister); host yokken `jsonLd: []`.
  21. `productGroupID` ürünün handle'ı; Medusa'da ürün seviyesinde SKU yok.
  22. Seçenekler özellik şablonunda Google özelliğine (renk, beden…) eşlenmemişse `ProductGroup` `variesBy`'sız çıkıyor. Danışman (T11) bunu uyaracak.
  23. Listeleme `ItemList`'i yayındaki ilk 24 ürün, yeniden eskiye. Storefront'un varsayılan sıralaması buna uymalı (F18).
  24. Stok takibi kapalı varyant "stokta"; stoksuz ama ön sipariş/backorder açık varyant `BackOrder`. Ön sipariş bayrağı T8'de.
  25. Kargo detayı ve iade politikası (F7, F13), üstü çizili fiyat (F4.3) ve `Article` (T13) ilgili fazlarında JSON-LD'ye eklenecek.
  26. Site haritası dosyaları S3 yerine veritabanında tutuluyor. Medusa'nın S3 sağlayıcısı her dosyaya rastgele ad veriyor; sabit adlı birkaç dosya için tablo daha basit. docs/13 §6'dan sapma; ileride aynı uçların arkasında S3'e taşınabilir.
  27. Site haritası gzip'siz XML; sıkıştırmayı HTTP katmanı (F16/F18) yapar. Sınır 50 MB yerine 45 MB (pay).
  28. "Yapay zekâ aramalarında görün" ön ayarı robots'a satır eklemiyor (arama tarayıcıları `*` grubunu izler).
     - "Model eğitimini engelle" şunları engelliyor: GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Bytespider, Meta-ExternalAgent.
  29. Staging'de indeksleme kapalı; başka bir ortam `SEO_INDEXING=off` ile kapatılabilir.
  30. IndexNow dışarıya çağrı yaptığı için bayrakla açılıyor (varsayılan kapalı).
     - İlk çalıştırma son bir günü bildiriyor, uzun bir kesinti en fazla bir haftayı.
     - Google katılmıyor; onun için site haritası + Search Console (F10.11).
  31. **İmzalı önizleme bağlantıları F18'e kaydırıldı.** Taslak sayfayı göstermek, storefront'un taslak ürün verisini alabilmesini gerektiriyor; bu da önizleme akışıyla birlikte tasarlanmalı.
  32. Canonical host 301'ini storefront kenarı yapıyor: `/store/seo/site`'taki host'tan farklı bir host'a gelen istek 301 alır (F18).
  33. Danışman puan formülü: önem payları kritik 1, yüksek 0,5, orta 0,25, düşük 0,1, bilgi 0 (kategori ağırlığının payı, kategori başına en fazla 1).
     - Ürün altı kategoriyle, kategori/koleksiyon başlık + içerik + teknik ile, marka bunlara görsel (logo) eklenerek değerlendiriliyor.
  34. Şimdilik olmayan kurallar:
     - Görsel alt metni, boyut, dosya adı (T6).
     - Benzer içerik shingle'ı (şablondan gelen başlık tekrarı T12'de geldi).
     - JSON-LD doğrulaması, puan/yorum (F10), kargo/iade politikası (F13), ilgili ürün bağlantıları.
     - ~~Tekrar kontrolü yalnızca sayfaların kendi metnini karşılaştırıyor~~: T12'den beri gösterilen metin (kendi ya da şablon) ve yalnızca yayındaki, indekslenebilir sayfalar karşılaştırılıyor.
  35. Yayın kapısı yalnızca taslaktan yayına geçişi kontrol ediyor. Yayında ürün düzenlenebiliyor.
     - Doğrudan yayında oluşturulan ürün (sihirbaz) kapıdan geçmiyor; sihirbazın kendi hazırlık kontrolü var.
     - Eşik 50, artı kritik bulgu yok.
  36. Değerlendirme kaydı engellemiyor: abonelik kayıt yanıtlandıktan sonra çalışıyor, hata loglanıyor, gece işi açığı kapatıyor.
  37. **S-404-01 haftalık sayaç tutmuyor.** 404 günlüğü toplam isabet sayıyor. Kural: toplamda ≥ 10 istek ve son 7 günde de istenmiş; panel metni bunu söylüyor. docs/14'teki "son 7 günde ≥ 10" ancak haftalık sayaçla birebir olur; gerekirse günlüğe pencere sayacı eklenir.
  38. Tekrar sayımı (S-DUP-01, P-TITLE-02, P-META-02) yalnızca yayındaki ve indekslenebilir sayfaları sayıyor:
     - Dışarıda kalanlar: taslak ürün, pasif ya da dahili kategori, pasif marka, noindex ya da başka canonical gösteren sayfa.
     - Gerekçe: taslakta tutulan kopya, yayındaki asıl ürünün puanını düşürmemeli.
  39. S-HOST-01 ortamı biliyor:
     - Staging kapalı olmalı; açıksa kritik bulgu var. Staging'de ana alan adı aranmıyor.
     - Platform alt alan adının 301'i kenar işi (F18); denetimde yok.
  40. S-ROBOTS-01 şu sayfaları deniyor: ana sayfa ve her türden bir örnek sayfa (mağazanın adres biçimiyle).
     - Önce `*` için bakıyor; Googlebot ya da Bingbot'un kendi grubu varsa onlar için de.
     - İndekslemesi kapalı ortamda robots kontrolü atlanıyor (bulgu S-HOST-01'de).
  41. S-REDIR-01: her tam eşleşen kuralın kaynağı ve hedefi ziyaretçi gibi çözümleniyor.
     - En çok kullanılan 2000 kural deneniyor.
     - Kural başına tek kayıt, en acil sebep: canlı sayfanın altında kalmış, hedefi yok ya da kaldırılmış, hedefi yine yönleniyor (ziyaretçi tek adımda gidiyor ama hedef eskimiş), 12 aydır kullanılmamış.
     - Ek olarak 10 ve daha çok eski yolu olan kayıtlar listeleniyor; silinmiş kayıtlar dahil değil. T1a'daki "kayıt başına rezerve yol üst sınırı" açığına şimdilik bu liste cevap veriyor; sınır konmadı.
  42. S-SITEMAP-01 adresi olmayan canlı sayfaları da sayıyor (`no_path`). Bunlar ne site haritasına ne mağazaya çıkabiliyor.
  43. Şimdilik olmayan mağaza kuralları:
     - S-IMG-01 (alt metin): T6'da, görsellerde alt metin alanı gelince.
     - S-POLICY-01 (F13), S-GSC-01 ve S-CWV-01 (F10.11), S-SOCIAL-01, S-SEARCH-01.
     - Puan dağılımı denetim raporunda tekrarlanmıyor; danışman özet kartında.
  44. 404 için "301 oluştur" doğrudan kural yazıyor. 404 kaydı silinmiyor; çözümleme artık yönlendirme döndüğü için sonraki denetimde düşüyor.
  45. **Kilit F3'te bağlandı** (adr/0020 önerisi): Redis varsa her ortamda Redis kilidi, testler dahil. Event bus, workflow engine ve cache Redis modülleri F16'da kalıyor.
  46. Bootstrap'ın depo adımı: mağazanın varsayılanı yoksa en eski depo varsayılan oluyor, hiç depo yoksa adressiz "Ana Depo" açılıyor. Adresi mağaza panelden giriyor.
  47. **Depo işlemleri panelde kendi uçlarımızdan:**
     - Gerekçe: Medusa 2.21.2'nin `updateStockLocationsWorkflow`'u adresi olmayan depoya adres ekleyemiyor; adres satırını oluşturup bağlamıyor, yanıt 200. Kendi adımımız adresi modüle bütün halinde vererek bağlıyor.
     - Medusa'nın kendi uçları açık kalıyor; Medusa Admin'den adressiz depoya adres eklemek hâlâ sessizce başarısız (çekirdek hatası).
     - Yeni depo oluşturulduğu anda mağaza kanalına bağlanıyor; varsayılan yapılan depo da bağlanıyor (checkout yalnızca kanala bağlı depodan ayırıyor).
  48. Depo silme kontrolü silmeden önce yapılıyor; arada gelen stok girişi tek açık nokta. İzin verilen silmede sıfır miktarlı seviyeler kalıyor (stok toplamını etkilemiyor).
  49. Adres reddi mesajı: tek sorun varsa o sorunun anahtarı (`tr_address.district_not_in_province`), birden çoksa `tr_address.invalid`; `issues` listesi aynı. Storefront (F18) da bu anahtarları kullanacak.
  50. Depo telefonu iş hattı sayılıyor: depo listesi kişisel veri okuması değil. Denetim kaydında yine yalnızca "değişti" yazılıyor.
  51. Paneldeki adres formu Türkçe: yurt dışı adresli bir depoda yalnızca ad değiştirilebiliyor. Mahalle serbest metin; sunucu, referans verisi olan ilçelerde doğruluyor.
  52. T8'e kalanlar: stok hareket defteri ve olay doğrulaması (rezervasyon değişimi `inventory-level.updated` yayıyor mu), düşük stok eşiği/uyarısı, ön sipariş, uzlaştırma işi.
  53. **Görsel temizliği yüklemede, eşzamanlı** (ADR-0016'dan sapma; ADR'de uygulama notu var). Metadata'lı kopya hiç tutulmuyor ve sihirbaz görseli hemen kullanabiliyor. Bedeli yükleme isteğinde görsel başına birkaç yüz ms; vitrin yolu etkilenmiyor.
  54. Türevler ayrı bir iş tipi değil, ürün kaydı aboneliği. Her ürün kaydı bir iş kaydı açsaydı Ayarlar > İşler listesi dolardı. Hata kaydı yanıtlamayı etkilemiyor, gece süpürmesi tamamlıyor.
  55. Bir kez ürüne girmiş görselin dosyaları, ürün onu bıraksa da tutuluyor (siparişler ve e-postalar gösterebilir). Yalnızca hiç ürüne girmemiş, bir günlük yüklemeler siliniyor. Slug ya da sıra değişince eski türevler siliniyor.
  56. Alt metin ve türevler `ProductImage.metadata`'da değil kendi tablomuzda (adr/0015 gerekçesi). Alt metin değişikliği denetim kaydında; görsel kaydetme işlemi değil.
  57. Alt metin yayın için zorunlu değil. Danışman (P-IMG-02, orta) ve mağaza denetimi (S-IMG-01) uyarıyor. Kurallar sürümü 2 oldu; gece değerlendirmesi tüm sayfaları yeniden puanlıyor.
  58. Varyant görselleri Medusa'nın anlamıyla: hiçbir varyanta bağlanmamış görsel tüm varyantlarda görünür.
  59. Kalite değerleri sabit: master JPEG 86, WebP 80, AVIF 50, OG JPEG 85. Ayar bölümü ihtiyaç doğunca eklenecek.
     - Hattan önceki görseller için taşıma işi yazılmadı (canlı mağaza yok); F14 geçiş aracı yapacak.
  60. S3'te daha önce kaydedilmiş logo ya da paylaşım görseli adresleri süreli imzalı bağlantı olarak kalmış olabilir; kayıt yeniden kaydedilince düzelir. Canlı veri yok.
  61. Tek yüklemede en fazla 20 görsel sırayla işleniyor (AVIF hızlı ayarda). Vekil zaman aşımı F16'da ayarlanacak.
  62. **Defter satırları geri alınmıyor:** workflow'da compensation yok, çünkü satır olmuş bir değişikliği kaydediyor.
     - Satır sırası saatle değil `seq` (autoincrement) sütunuyla; süreçlerin saatleri farklı olabilir.
     - Çekirdek yollarda `actor_id` boş. Kimin değiştirdiği denetim kaydında (Medusa'nın stok uçları kayıtlı).
  63. Medusa 2.21.2'de modül servisine doğrudan yapılan çağrı olay yaymıyor; bu değişiklikleri gece eşitlemesi yakalıyor.
     - Eşitleme silinmiş seviyeleri de dolaşıyor.
     - Süreçler arası tek çalışma kilidi var; ikinci süreç bir saniye bekleyip vazgeçiyor.
     - Açılış ve gece satırlarının nedeni "Eşitleme".
  64. **Düşük stok "kurma" mantığıyla:**
     - Eşiğin üstünde görülen kalem kuruluyor; eşiğe inince bir bildirim gidiyor ve kurulum düşüyor.
     - Az stokla açılan kalem, bir kez eşiğin üstüne çıkana kadar uyarmıyor. Böylece kurulumda toplu bildirim yağmıyor.
     - Kalem başına kilit var. Bildirimin `idempotency_key`'i kurulma zamanı; yarıda kalan deneme tekrar bildirim yazmıyor.
     - Kalemin kendi eşiği değişince kalem hemen kontrol ediliyor. Mağaza eşiği değişince kontrol bir sonraki harekette.
  65. Bildirim `title`/`description` metni sunucudaki katalogdan geliyor (`lib/notifications/messages`, F19'a kadar TR); bunu Medusa Admin gösteriyor. Panel zili metni `data` alanından kendi dilinde kuruyor.
  66. **Zil:**
     - Okunmamış sayısı bu tarayıcıda zilin en son açıldığı ana göre (localStorage); sunucuda "okundu" bilgisi yok.
     - Liste son 20 bildirim, dakikada bir yenileniyor.
     - Rozet liste kapanınca sıfırlanıyor.
  67. **Ön sipariş bayrağı `stock.preorder`:** mağaza açıyor, varsayılan kapalı.
     - Kapalıyken yeni stoksuz satış reddediliyor; var olmayan bir varyant kimliği de "yeni" sayılıyor. Zaten açık olan varyant öyle kalabiliyor (T1b emsali).
     - CSV içe aktarma F3.9'a kadar korumanın dışında. Medusa'nın workflow çalıştırma ucu için aşağıdaki açık soruya bakın.
  68. **Stoksuz satan varyantın boş seviyesi ürün/varyant hook'larında, istek içinde açılıyor;** abonelik değil, çünkü panelin aynı anda yazdığı seviyeyle çakışırdı.
     - Bayrak kapalıyken de açılıyor, ki eskiden açık kalmış varyantlar satılabilsin.
     - Sihirbaz ve ürün sayfası var olan seviyeyi güncelliyor. Ürün sayfası önce stoğu, sonra varyantı yazıyor.
  69. "Azalan" sekmesi ve pano görevi artık eşik sayısını göstermiyor (kalemlerin eşikleri farklı olabilir).
  70. Ürün sayfasında "Stoksuz satış" sütunu bayrak açıkken ya da açık bir varyant varken görünüyor. Bayrak kapalıyken yalnızca kapatılabiliyor.
  71. Varyantın stok takibi ve stoksuz satış ayarı, fiyatlarla birlikte denetim kaydının önce/sonra özetinde.
  72. **İçerik sayfası ve blog yazısı tek kayıt** (`content_entry`, `kind`). SEO ve url-registry tarafında `page` ve `post`; seo-meta zaten bu türleri tanıyordu.
  73. Ürünün zengin açıklaması (ADR-0019'daki "ürün açıklaması content'e bağlanır") bu göreve alınmadı; Medusa'nın düz metin alanı sürüyor. İçe aktarma (T15) ya da sonrası için.
  74. **Danışman kural adları docs/14'ten farklı:** META-01, LINK-01, IMG-01 başka kuralların adı ve panel kuralı adından tanıyor. A-META-01 → A-BYLINE-01, A-LINK-01 → A-INLINK-01, A-IMG-01 → A-COVER-01. docs/14 güncellendi.
  75. Az kelimeli metinde yapı ve iç bağlantı kuralları susuyor (önce uzunluk). Yazar ve giriş bloğu yalnızca blog yazısında isteniyor.
  76. Kartların hedefi kayıtta yalnızca gönderilen gövde için denetleniyor. Sonradan silinen ürün sayfayı kilitlemiyor; kartı sayfada görünmüyor.
  77. `revised_at` yalnızca başlık ya da gövde gerçekten değişince güncelleniyor (iki taraf aynı şemadan geçirilip karşılaştırılıyor); aynı gövdeyi yeniden göndermek tarih değiştirmiyor.
  78. Gövdenin özeti (300 karakter) ve kelime sayısı kayıtta yazılıyor. Herkese açık liste ve resolve belgeyi okumuyor.
  79. İçerik kayıtlarında gövde sınırı 1 MB (Express'in 100 kB varsayılanı uzun yazıya yetmiyordu). Belgenin kendi sınırı 200.000 karakter, 12 düğüm derinliği, 20.000 düğüm.
  80. İçerik görselleri ürün görselleri gibi WebP/AVIF türevi almıyor; storefront ana dosyayı gösteriyor.
  81. İçerik uçları entegrasyon anahtarlarına açık (silme dahil), marka ile aynı. Roller F12'de.
  82. **Landing sayfaları `content` modülünde ayrı model** (`landing_page`). `content_entry`'ye yeni bir `kind` eklenmedi, çünkü alanları farklı (kategori, facet, parmak izi).
  83. **Özgünlük MinHash ile ölçülüyor:** 5 kelimelik diziler, FNV-1a + murmur3 karışımı, 128 tohum. Payda sayfanın kendi dizileri, yani "bu metnin ne kadarı başka sayfada".
     - Gerekçe: sonuç her seferinde aynı, maliyet sabit, tam metinler karşılaştırılmıyor.
     - İmza boyutu değişirse eski imzalar karşılaştırılamaz; kodda uyarı var.
  84. **Metnin sahibi ilk yayına alan sayfa** (`text_live_at`).
     - Taslaklar başkası için referans değil. Yayından kalkan sayfa kimseye karşı sayılmıyor.
     - Canlı sayfanın metni değişince sırası "şimdi"ye geliyor.
     - Kapı yalnızca yayına alırken ve canlı metin değişirken çalışıyor; başlık değişikliğini engellemiyor.
  85. Facet etiketi ve kategori adı ölçümden önce yer tutucuya çevriliyor. Yalnızca kelime başında eşleşiyor (Türkçe ekler kalıyor); 3 harften kısa adlar çevrilmiyor.
  86. Panelde "Yayına al" düğmesi düşük özgünlükte kilitlenmiyor, uyarı veriyor. Sayfadaki değer son kayıttan; sunucu yeniden ölçüyor.
  87. **Landing yolu kategorinin yolunun altında,** kategorinin URL stilini izliyor.
     - URL stili değişim planı landing çakışmalarını önceden göstermiyor. Taşımada yeni yolu alınmış landing eski yolunda kalıyor ve loglanıyor.
     - Landing'lerin yeniden yol alması kayıtlarla aynı kilit altında.
  88. **Kategori silinince landing kaydı silinmiyor,** metin kaybolmasın diye.
     - Yolu bırakılıyor (410). Panelde uyarı çıkıyor; sayfa kaydedilemiyor (kategorinin yolu yok) ama silinebiliyor.
  89. Facet (marka ya da seçenek) sonradan silinirse sayfa kaydedilebiliyor; ürün sayısı 0'a iniyor, L-PRODUCTS-01 ve panel uyarısı haber veriyor. Yeni sayfa yalnızca panelin sunduğu facet'lerle açılıyor; pasif marka bunlara dahil değil.
  90. Ürün listesi kategorinin görünen alt kategorilerini kapsıyor: aktif, iç olmayan, aradaki zincir de görünür. Yol taşıma tüm alt ağaca uygulanıyor.
  91. Marka facet'inin anahtarı `marka` veride saklanıyor (F3.17'nin parametre adı). Bu ad değişirse veri taşıması gerekir.
  92. **L-CONT-01 → L-TEXT-01**, çünkü CONT-01 metni ürün açıklaması için yazılmış. L-EMPTY-01 → L-PRODUCTS-01. docs/14 güncellendi.
  93. **Bulgu:** tek seçimli özellik değeri `value_text`'te, çok seçimli değer `value_options`'ta saklanıyor. Facet sorgusu ikisini de okuyor.
  94. **Bulgu:** link tanımı import eden dosya, yüklendiği her yerde `defineLink` çalıştırıyor ve birim testlerini düşürüyor. Landing ve listeleme kodu link'leri öbür taraftan okuyor (`brand.products`, `attribute_value.product`).
  95. İçerik workflow'larının adım kimlikleri workflow kimlikleriyle aynıydı (`content-save-entry` vb.). Adımlar `content-write-*` / `content-remove-*` oldu.
  96. **Parametre adları Türkçe:** `marka`, `fiyat`, `sirala`, `sayfa` (docs/13 §7). §3'teki `?page=2` örneği `?sayfa=2` oldu.
     - Sıralama seçenekleri: `onerilen` (varsayılan, yazılmaz), `yeni`, `fiyat-artan`, `fiyat-azalan`. Storefront (F18) bunları kullanacak.
  97. Bir anahtarın değerleri tek parametrede virgülle. Tekrarlanan anahtar birleştirilip 301 veriyor.
  98. Fiyat, "ürünü olmayan kombinasyon" sayımına girmiyor: fiyat bölge ve para birimine bağlı. Fiyatlı sayfa hep `noindex`. Fiyatla boş kalan sayfada 404'ü storefront veriyor (F18).
  99. Sayfa boyutu 24 (`LISTING_PAGE_SIZE`; JSON-LD listesiyle aynı sayı ama ayrı sabit) ve resolve yanıtında `page_size` olarak dönüyor. Storefront başka sayı kullanmamalı.
  100. Tek facet → landing yönlendirmesi yalnızca kategoride (landing'ler kategoriye bağlı). Marka sayfasındaki `?malzeme=` filtresinin landing'i yok.
  101. **robots.txt satırları** parametre başına iki tane (`/*?{ad}=` ve `/*&{ad}=`). `/*?*{ad}=` biçimi, sonu aynı olan başka bir parametreyi de yakalardı.
     - Mağazanın kendi yazdığı şablona dokunulmuyor; denetim uyarıyor.
  102. Yönlendirme kuralı kaydı ve yönlendirme denetimi, hedefin filtre sorgusunun 404 ya da 301 olacağını önceden görmüyor. Resolve bunu çalışma anında tek atlamaya katlıyor.
  103. Numaralı sayfanın JSON-LD'sinde `CollectionPage` kendi adresi ve "Sayfa N" adıyla; ilk sayfanın ürün listesi (`ItemList`) çıkarılıyor. Sayfanın elle verilmiş canonical'ı varsa ona sayfa eklenmiyor.
  104. **İçe aktarma iki adımlı ve iki ayrı iş:** "kontrol" ve "uygula". Uygulamada dosya yeniden gönderiliyor; işler birbirinin dosyasına başvurmuyor. Her iş kendi dosyasını siliyor.
  105. **Yükleme multipart değil, dosyanın kendisi:** yeni bağımlılık (multer) yok, tür baytlardan anlaşılıyor. CSRF istisnası yalnızca `/admin/catalog/imports` ve xlsx/CSV/octet-stream türlerinde; bu türler CORS-basit değil.
  106. **Satır = varyant**, aynı `Tanıtıcı` bir ürün. Boş hücre alanı değiştirmiyor (alan temizlemek için panel). Sorunlu satırı olan ürün bütünüyle atlanıyor.
  107. Var olan üründe yeni seçenek değeri (ör. yeni beden) eklenmiyor; satır sorun olarak raporlanıyor ve değer panelden ekleniyor. Medusa 2.21'in seçenek modeli (paylaşılan seçenekler) nedeniyle muhafazakâr seçim.
  108. **Fiyat sütunu varyantın temel TRY fiyatı:** fiyat listesiz, kuralsız, kademesiz. Diğer fiyatlar kuralları ve kimlikleriyle korunuyor; fiyat listesi fiyatlarına dokunulmuyor.
  109. **Birincil kategori** yalnızca yeni üründe ya da satır kategorileri değiştirdiğinde ilk yazılan kategori oluyor. Kategorisi değişmeyen ürünün birincil kategorisine (ya da eksikliğine) dokunulmuyor.
  110. Barkod sütunu varyantın EAN'ı; UPC ve `barcode` alanları tabloda yok.
  111. Sayı biçimi: virgül varsa Türkçe (`1.250,50`), yoksa nokta ondalık (`1.250` = 1,25). Fiyat en çok 2, ölçü 3 ondalık; özellik sayıları negatif olabilir.
  112. Tablo başlıkları, rapor ve açıklama sayfası sunucuda Türkçe (dosya biçimi, bildirim metinleri gibi); başka diller F19.
  113. **Medusa'nın ürün içe aktarma uçları** (`/admin/products/import(s)` ve onay uçları) ile **workflow çalıştırma uçları** (`/admin/workflows-executions/:id/run` ve adım cevapları) kapatıldı (404). Açık sorudaki öneri uygulandı: iç iş tiplerinin ve tüm route kontrollerinin atlanmasını engelliyor.
  114. Denetim kaydı: uygulama başlarken ve biterken `system` kaydı (kim, dosyanın sha256'sı, sayılar, en çok 500 tanıtıcı). Alan bazında önce/sonra yok (64 kB sınırı).
  115. SEO ön değerlendirmesi yalnızca yeni ürünler için. Görseller tabloda yok (panelden); olmayan görsel danışman bulgusu olarak görünüyor.
  116. Tek seferde en çok 5000 satır, 10 MB. Bir içe aktarma çalışırken ikincisi kuyruğa alınamıyor (singleton).
  117. **Toplu düzenleme genel iş kuyruğundan** (`catalog.bulk_edit`, iç tip değil): girdi yalnızca kimlikler ve değişiklik, dosya yok; şeması iş tipinde. Tek seferde en çok 1000 ürün, aynı anda tek toplu düzenleme.
  118. **Seçim panelde kimlik listesi.** "Eşleşenlerin hepsini seç" listenin arama ve görünümüyle en çok 1000 kimliği okuyor; daha fazlasında aramayı daraltmayı söylüyor. Sunucuda filtreyle seçim yok. Seçim sayfalar ve aramalar arasında kalıyor; iş başlatılınca bırakılıyor.
  119. **Fiyat:** yalnızca temel TRY fiyatı (içe aktarmayla aynı tanım). Yüzde ve tutar kuruşa yuvarlanıyor (yarım yukarı); yüzde −99 ile +1000 arası. Bir varyantın yeni fiyatı sıfır ya da altına düşerse ürün bütünüyle atlanıyor. TRY fiyatı olmayan varyant yalnızca "Yeni fiyat" ile fiyat alıyor.
  120. **Stok:** yalnızca varsayılan depo. "Ayarla" miktarı yazıyor; "ekle/çıkar" seviyeyi Medusa'nın kalem kilidi altında fark olarak değiştiriyor (arada satılan stok geri gelmiyor). Sıfırın altına inecek ürün bütünüyle atlanıyor. Seviyesi olmayan varyanta seviye açılıyor (0'a ayarlamak hariç). Birden çok envanter kalemli ya da kalemden birden fazla adet düşen varyantlar (kitler) atlanıyor; içe aktarma da aynı.
  121. **Yayın:** SEO yayın kapısının tuttuğu ürün "Atlandı", ölçü kuralının reddettiği "Hata" olarak raporlanıyor. Kapı, ürünü değişiklikten önceki haliyle değerlendiriyor (route'taki gibi).
  122. **Kategori:** çıkarılan kategori birincil ise kalanların en derini (eşitlikte en küçük kimlik) birincil oluyor; kalan yoksa boşalıyor. Aynı seçim kuralı SEO payload'ında ve danışmanın tek tık düzeltmesinde de (`lib/catalog` `deepestCategory`). "Birincil yap" ürün kategoride değilse önce ekliyor. Medusa'nın `batchLinkProductsToCategoryWorkflow`'u kullanılmadı: ürün hook'larımızı atlıyor ve ürün zaten kategorideyse geri alması kategoriyi siliyor.
  123. **SEO şablonu:** ürünün kendi başlık ve/veya açıklaması siliniyor (danışmanın tek tık düzeltmesinin toplu hali). Odak kelime kapsamda değil.
  124. **Alt metin:** yalnızca boş olanlar dolduruluyor; üzerine yazma seçeneği yok. Aynı metni alacak görseller ", görsel N" ile ayrılıyor (sunucu metni, F19'a kadar TR). Medya kaydı olmayan görsel atlanıyor, raporda yazılıyor.
  125. **Geri alma yok:** toplu değişikliğin "geri al" düğmesi yok. Her ürünün denetim kaydında alan alan önce/sonra değerleri var; geri almak gerekirse oradan okunur.
  126. İş listesinde (`GET /admin/async-jobs`) `*_ids` girdileri sayı olarak gösteriliyor (`product_count`); kimlik listesi API'den dönmüyor.
  127. **İçe aktarma ve toplu düzenleme aynı anda çalışmıyor:** iş tiplerine grup eklendi (`catalog.write`); gruptaki tipler kuyruğa alınırken birlikte kilitleniyor ve birbirini bekletiyor (409).
  128. **Yayın kapısı yalnızca var olan taslağı yayına alırken:** ürün route'unda olduğu gibi. Yeni ürünü doğrudan yayında açmak (panelden, Admin API'den ya da tablodan) kapıya takılmıyor; kayıtlı bir ürün olmadan değerlendirme yapılamıyor. Kapıyı oluşturmaya da uygulamak ayrı bir karar (taslak oluştur → değerlendir → yayınla).
  129. **Yetki:** toplu düzenleme her yöneticiye açık (bugün rol ayrımı yok). F12 rol matrisine "toplu fiyat/stok değişikliği" ayrı izin olarak eklenmeli.
  130. **Kampanya kapsamı panelde dört seçenek:** tüm sepet, kategoriler, koleksiyonlar, ürünler. Medusa'nın diğer hedefleri (ürün türü, etiket) ve kuralları (müşteri grubu, bölge) panelde gösterilmiyor; başka yerde eklenmişse kapsam değiştirilmedikçe korunuyor, kapsam değişince yerine seçilen yazılıyor.
  131. **Kalem hedefli indirim sepete yayılıyor** (`allocation: across`): tutar indiriminde tutar eşleşen kalemlerin toplamından düşüyor, kalem başına değil.
  132. **En az sepet tutarı** `item_total` kuralı: KDV dahil, indirimler düşüldükten sonraki kalem toplamı (kargo hariç). Ücretsiz kargo kampanyasında da kullanılabiliyor.
  133. **Müşteri başına kullanım** kampanyanın bütçesi (`use_by_attribute`, `customer_id`). Medusa misafir alışverişte de e-postaya bağlı müşteri kaydı açtığı için misafiri de sayıyor; farklı e-postayla yeniden kullanım engellenemiyor (kimlik doğrulama F10). Başka promosyonlarla paylaşılan ya da başka türde bütçesi olan kampanyada alan kilitli.
  134. **İndirim payı siparişin verildiği hâliyle (U7, ADR-0010):** satır payları tam adet üzerinden hesaplanıyor, iade edilen adetler payları değiştirmiyor. Sipariş sayfası satırları ve toplamları verildiği hâliyle gösteriyor; iadeler ödeme kartında (iade edilen, iade edilebilir). İade almış siparişin ayrıntılı görünümü F7'de.
  135. **Birim iadesi kümülatif** (n birimin ödediği − n − 1 birimin ödediği); satır başına iade defteri tutulmuyor. Koşul: iade, teslim alınmadan önce, teslim alan akışın içinde hesaplanmalı (F7). Aynı satır iki kez verilirse adetleri birleştiriliyor. `returnRefundOf` tavan uygulamıyor, yanında `refundable` döndürüyor; iade daha fazlasını isterse ne yapılacağı F7'nin kararı.
  136. **Kargo bedeli iade tutarına girmiyor**; kargonun iadesi mağaza politikası, F7'de.
  137. **Sipariş sayfasının toplamları düzeltildi:** "Ara toplam" KDV hariç kalem ve kargo toplamını gösteriyordu, satırlar toplamı tutmuyordu (540 + 90 ≠ 648). Artık KDV dahil kalemler + kargo − indirim = toplam; KDV satırı bilgi için.
  138. **Medusa ödemeyi kuruş altı haneyle tutabiliyor.** İndirimi yuvarlamıyor; sistem sağlayıcısı 157,891 tahsil ediyor.
     - Kuruş gerçeği, toplamın yarım yukarı yuvarlanmış hali. Payların ve `refundable`'ın Medusa'nın kesin tutarını en çok yarım kuruş aşabilmesi bu yüzden.
     - Medusa iadeyi para biriminin hassasiyeti kadar toleransla (TRY'de 0,01) kabul ediyor. Testli: yarım kuruşla biten sipariş kargosuyla birlikte tamamen iade edildi.
     - F5 iyzico sepeti aynı payları (`lineShares`) kullanmalı ki tahsil edilen tutar ve satırlar kuruşla eşleşsin.
  139. **Tutarlar Medusa'nın sakladığı hâliyle okunuyor:** `raw_*` alanları ve hesaplanan toplamlarda `.raw` (20 hane). Medusa'nın iç değerinde bölme artığı var (90,045 içeride 90,04499…988); bununla yarım kuruş ters yöne yuvarlanıyordu. Entegrasyon testi yakaladı.
  140. **İade, değişim ve talep kargoları satır paylarına girmiyor:** müşterinin ödediği değil, mağazanın sonraki gideri. Medusa bunları siparişin `shipping_methods`'unda ve kargo toplamında sayıyor. Query bu kargoların `detail`'ini döndürmediği için iade, değişim ve taleplerin kendi kargo kimliklerinden ayıklanıyor.
  141. **Fiyat listeleri Kampanyalar altında** (`/promotions/price-lists`); iki ekran arasında sekme bağlantısı var, kenar çubuğuna yeni öğe eklenmedi. Türler panelde "İndirim" (`sale`, üstü çizili gösterilir) ve "Özel fiyat" (`override`, bayi/toptan).
  142. **Yüzde indirim sunucuda hesaplanıyor** (`POST /admin/price-lists/:id/discount`).
     - Hesap: çeşidin kendi fiyatı × (1 − oran), kuruşa yarım yukarı. Para birimi mağazanın varsayılanı.
     - Listede fiyatı olan çeşit güncelleniyor. Kendi fiyatı olmayan çeşit atlanıyor ve sayısı söyleniyor.
     - Sınırlar: en çok 500 ürün, %0,01–%99.
     - Tek tek fiyat girişi Medusa'nın toplu fiyat ucundan gidiyor (yöneticinin yazdığı tutar).
  143. **Çakışma bir uyarı, engel değil:** aynı çeşitleri fiyatlayan, yayında ve tarihleri kesişen başka listeler adıyla gösteriliyor. Taslak ve tarihi kesişmeyen listeler sayılmıyor.
  144. **Kayıtlı listede durum yalnızca başlıktaki "Durdur / Yayına al" düğmesiyle değişiyor**; form durumu göndermiyor. Yeni listede "Kaydedince yayına al" anahtarı var. "Tüm müşteriler" kural nesnesini boşaltıyor; Medusa'nın grup kuralını kaldırdığı testli.
  145. **Devreden doğrulandı: panelin varyant fiyat kaydı liste fiyatlarını koruyor** (testli). Admin API'nin `variants.prices` alanı yalnızca taban fiyatı döndürüyor. Medusa'nın fiyat seti güncellemesi de yalnızca listesiz fiyatlara dokunuyor.
  146. **Ürün-fiyat satırları e2e'de değil, bileşen testinde sınanıyor.** E2E geliştirme veritabanına yazar, fiyat geçmişi de ekleme-yalnız bir defter; bu yüzden e2e'de liste fiyatı yazılmıyor. Satır kartı Testing Library ile panelin ilk bileşen testi oldu; kurulum dosyasına ortak temizlik eklendi.
  147. **Fiyat gösterimi ayrı Store ucunda:** `GET /store/price-display?variant_id=…&currency_code=try`. Medusa'nın ürün yanıtı değiştirilmedi (Altın kural 2). Storefront ürün ve liste sayfasında bu ucu çağırır; JSON-LD aynı okumadan kurulur (ADR-0023 uygulama notu).
  148. **İndirim yalnızca gösterilebilecekse gösteriliyor:** üstü çizili fiyat, indirimden önceki fiyat güncel fiyattan yüksekse veriliyor. Önce artırılıp 30 gün içinde eski fiyatına "indirilen" ürün indirim olarak gösterilmiyor. Panel bunu ürün sayfasında nedeniyle söylüyor.
  149. **JSON-LD teklif fiyatı artık satıştaki fiyat:** önceden indirim sırasında da taban fiyat yazılıyordu. Google işaretlemedeki fiyatın sayfadakiyle aynı olmasını istiyor. Satıştaki fiyatı olmayan çeşidin teklifi çıkmıyor.
  150. **Panelde fiyat geçmişi ürün sayfasında** (varyantlar kartının altında):
     - Son 90 gün basamaklı çizgi olarak gösteriliyor: satış fiyatı marka renginde, indirimsiz fiyat gri. Lejant, tooltip ve ekran okuyucu tablosu var.
     - 90 günde fiyat değişmediyse grafik yerine tek cümle çıkıyor.
     - Grafik bileşeni `components/charts/step-chart.tsx`, yeniden kullanılabilir.
     - Palet doğrulayıcıyla sınandı: vurgu rengi iki temada da geçiyor. Gri, rehberin vurgu deseninin bağlam grisi; 3:1 kontrast uyarısı lejant ve tabloyla karşılanıyor.
  151. **Tek kullanımlık kodlar şablonun kopyaları:** her kod kendi promosyonu (`limit: 1`), her parti kendi kampanyası. Şablonun tarihleri parti oluşturulurken kopyalanıyor; şablonun sonradan değişen tarihi ya da indirimi var olan partilere geçmiyor (parti bir kez basılmış kuponlar gibi).
  152. **Kampanya listesi parti kopyalarını göstermiyor;** şablonun kodunun altında "N kod partisi" yazıyor. Kopyalar yine Medusa Admin'in listesinde görünüyor (bizim değiştirmediğimiz ekran).
  153. **Kod partisi CSV'si `kod;kullanıldı` sütunlu**, Excel için UTF-8 BOM'lu. İşin kendi CSV'si yalnızca kodları taşıyor.
  154. **Kargo bedava eşiği ve "bir sepette birden çok kod" ayarı Kampanyalar sayfasında**, listenin altında "Kampanya ayarları" kartında. Eşik KDV dahil, indirim sonrası ürün toplamı; yalnızca sabit fiyatlı kargo seçeneklerine uygulanıyor.
  155. **"X al Y öde" kampanya formunda dördüncü tür.** Ürün, kategori ya da koleksiyon seçmek zorunlu. Teklif sepet büyüdükçe tekrarlanıyor (her X üründe X − Y bedava) ve en ucuz ürünler bedava oluyor. "Yalnızca bir kez" seçeneği yok; gerekirse sonra eklenir.
  156. **Hediye kartları Kampanyalar altında bir sekme** (`/promotions/gift-cards`); sekme ve ekran yalnızca "Hediye kartı" özelliği açıkken görünüyor. Kart tutar, isteğe bağlı son gün (o günün sonu, Türkiye saati) ve mağazanın notuyla açılıyor; kod oluşturulunca kopyalanmak üzere gösteriliyor. Kart düzenleme ve iptal şimdilik Medusa Admin'de.
  157. **Hediye kartı kodu bizim üreticimizden** (`GIFT-` + 16 rastgele karakter). Eklentinin üreticisi 16 karakterin yalnızca 10'unu rastgele çekiyor (ADR-0025 notu). Mağazanın yazdığı kelime yalnızca önek olur (`YILBASI-XXXX-…`); tamamen mağazanın seçtiği kod yok, çünkü tahmin edilen kod kartı harcatır (güvenlik incelemesi).
  158. **Mağaza kredisi müşteri sayfasında, yalnızca üye müşteride** (bayrak açıkken): bakiye ve "Kredi ekle" (tutar + not). Hesap ilk eklemede açılıyor; misafire hesap açılmıyor (oturum açamaz, e-postasını bilen başkası harcayabilirdi). Kredi düşme (borç) panelde yok.
  159. **Kart kodu denemesi promosyon kodlarıyla aynı bütçeden sayılıyor** (`coupon`: IP başına 10 dakikada 30, sepet başına 10); sepete ekleme ve çıkarma, kodla sorgu (HEAD dahil) sayılıyor.
  160. **Alışverişçi kartın notunu, referansını ve sahibini görmüyor:** Store yanıtlarında kart yalnızca kod, tutar, durum, bitiş ve bakiyeyle var; başka alan isteyen `fields` 400 alıyor.
  161. **Kartla ve krediyle ödenen tutar sipariş sayfasının ödeme kartında ayrı satır** ("Kredi ve hediye kartıyla ödenen"). İadede bu payın krediye dönmesi F7'de; o zamana kadar elle "Kredi ekle".
  162. **Test çalıştırmaları Redis anahtarlarında dev'den ayrı** (`…/test` eki). Önce entegrasyon testleri dev sunucusunun giriş sınırını dolduruyordu (Medusa'nın test çalıştırıcısı DATABASE_URL'i değiştirmiyor); panel 15 dakika giriş yapamıyordu.
  163. **Sepette mağaza kredisini yalnızca sepetin kendi müşterisi kullanabiliyor;** eklenti kimin oturum açtığına bakmıyordu (güvenlik incelemesi). Hesabı koduyla sahiplenme (`claim`) F18'e kadar kapalı.
  164. **Tamamı hediye kartıyla ödenen sipariş "Kredi ile ödendi"** ve doğrudan "gönderilecek" aşamasında. Ödeme kartındaki satırın adı "Kredi ve hediye kartıyla ödenen" (Medusa'nın bütün kredi satırlarını sayıyor).
  165. **Panelde denge kuralı (kullanıcı, 2026-10-26: "bu tarz ui kötü görüntüleri istemiyorum … tekrarlama").** docs/18 §2 "Denge":
     - Yan yana kartlar `PageGrid` + `PageColumn` ile; aynı satırdaki kartlar eşit, sütunlar aynı çizgide biter (kısa sütunun son kartı uzar). Yapışkan özet sütunu (kampanya ve fiyat listesi formu) muaf.
     - Bir satırdaki kontroller tek boy: sayfa başlığında 36 px (dönem seçici artık "Ürün ekle" ile eşit), alanın yanındaki temizle düğmesi ve ağaçtaki açma oku satır boyunda, üst çubuktaki menü düğmesi aramayla eşit.
     - `e2e/layout.e2e.ts` her sayfayı (detaylar dahil) 1440 px'te ölçer; bilerek bozulunca 6 sayfada kırıldığı görüldü.
  166. **Raporlar dört sekme:** Özet (göstergeler, grafik, sipariş durumları, ilk 5 ürün ve kategori), Ürünler (100 ürüne kadar; arama, satış/adet sıralaması, ortalama fiyat, pay, CSV), Kategoriler (pay ve tutar, CSV), Gün gün (grafik ve tam tablo). Dönem adreste, sekmeler arasında korunuyor; her sekmenin üstünde dört gösterge.
  167. **Görünüm ayarları yeniden düzenlendi:** "Renkler" (marka rengi, hazır renkler, mod) ve "Düzen" (menü, köşeler, yoğunluk; eşit boy segment kontroller) yan yana, altında panelin minyatürü (menü zemini dahil). Kaydet/Geri al sayfa başlığında.
  168. **Detay sayfalarında uzayan kartın içi:** sipariş toplamları kartın dibinde (fatura gibi); siparişi olmayan müşterinin boş durumu kartın ortasında. SEO danışmanındaki ürün listesi iki sütun (puan özetiyle aynı boyda).
  169. **F4 kapanış incelemesi (kod + güvenlik, 2026-10-27 gecesi) ve düzeltmeler.** Ayrıntı ADR-0023/0024/0010 notlarında:
     - 30 gün kuralı: yükselen indirimli fiyat yeni indirim sayılıyor, önceki fiyatı 30 günün en düşüğü (yasal risk, testli).
     - Ödeme anında yeniden denetim: tek kod kuralı ve kargo fiyatının sepete göre güncel olması (kupon eşiğin altına indirince 0 TL kargo kalıyordu; artık `cart.shipping_changed`).
     - `/store/price-display` yalnızca yayındaki ve satış kanalındaki ürünler.
     - Kodlar: sunucuda biçim denetimi, istek başına en çok 5 kod, tek kullanımlık kod 12 karakter, sepet başına deneme IP'den bağımsız da sayılıyor.
     - Fiyat listesi başlangıç/bitişi dakikalık işle sınır anında kaydediliyor.
     - Kod partisi tek telafili workflow; bütçe kopyalanıyor; panelden durdurulabiliyor.
     - Kampanya kaydı tek istek, tek workflow (`POST /admin/promotions/:id/offer`): yarım kaydedilmiş kampanya kalmıyor.
     - Denetim kaydı kampanyanın bütün kurallarını içeriyor; kod dökümü hassas okuma.
     - Doğrulanıp değişmeyenler: Store alanları kampanya içine ulaşamıyor; misafir kişi başı sınırı çalışıyor; çifte harcama yok.
- **Bilinen sınırlar (devreden):**
  - JSON-LD'yi storefront basarken `<`, `>` ve `&` kaçışlanmalı (`</script>` içeren başlık ya da metin). Kural docs/13'te var; F18 kabulüne sözleşme testi olarak eklenecek.
  - Editöre yüklenip bir günden uzun süre kaydedilmeyen görseli gece süpürmesi siler; kayıt `content.image_unknown` verir.
  - Blog breadcrumb adı "Blog" sabit; F19'da mağaza diline göre.
  - Defter satırları için saklama süresi ve arşiv F13'te. Mağaza eşiği değişince kalemler toplu olarak yeniden kontrol edilmiyor (bir sonraki harekette).
  - Sipariş ve stok panosu bellek içi sıralıyor (5000/2000 kayıt). Büyük mağazada kayıtlı aşama sütunu ya da Index modülü gerekir.
  - Kargo etiketi ve takip F7'de. Kampanyada minimum sepet ve kategori kuralları F4'te.
  - Panelde bazı bileşen fonksiyonları 50 satırı aşıyor (sihirbaz sayfası, kategori düzenleyici, şablon paneli, yeni landing diyaloğu); docs/10'a göre bölünmeli.
  - Landing ürün sayısı her okumada hesaplanıyor; liste ekranında gösterilmiyor. Büyük mağazada önbellek ya da Index modülü gerekir.
  - Facet kataloğu en çok 500 aktif marka listeliyor; daha büyük mağazada aramalı seçici gerekir.
  - İçe aktarma: iş iptal ucu (S13'ten devreden) hâlâ yok. Gerçek Excel, LibreOffice ve Google Sheets dosyalarıyla örnek testleri eklenmedi (fixture'lar openpyxl ile üretildi: Excel uyumlu, paylaşılan metinli sürümü de var).
  - Fiyat listesi satırları (`GET /admin/price-lists/:id/lines`) sayfalanmadan okunuyor; binlerce çeşitli listede sayfalama gerekir.
  - Müşteri grubu yönetimi panelde yok (Medusa Admin'de); fiyat listesi formu var olan grupları seçiyor.
  - Fiyat listesi ekranı en çok 200 liste ve 200 müşteri grubu okuyor; daha fazlası için sayfalama ve aramalı seçici gerekir.
  - Çakışma uyarısı para birimine ve müşteri grubuna bakmıyor; farklı gruplara fiyat veren listeleri de çakışma sayabiliyor (yanlış uyarı verebilir, çakışmayı kaçırmaz).
  - Fiyat listesi denetim kaydında liste fiyatının anahtarı `price:<id>`; hangi çeşide ait olduğu yazmıyor.
  - Kod partileri silinemiyor ve kopyaları toplu durdurulamıyor; şablon durdurulsa da kopyalar yayında kalıyor (her biri ayrı promosyon). Gerekirse parti kampanyasının bitiş tarihiyle kapatılır; panelde parti durdurma F12'de düşünülmeli.
  - Fiyat listesi bileşenlerinden birkaçı (`DiscountDialog`, `AudienceCard`, `PriceLinesCard`) 50 satırı aşıyor; diğer panel bileşenleriyle birlikte bölünmeli.
  - Liste sorgusunun ürün sayısı büyük facet'lerde ürün kimliklerini bellekte kesiştiriyor (önbellekli). Büyük katalogda SQL'de `EXISTS` ile sayım ya da Index modülü düşünülmeli.
  - HTTP takımında `request-security` rate-limit testi T13'te bir kez dalgalandı; nedeni bulunamadı, tekrarlarda geçti.
  - Hediye kartı ve mağaza kredisi (Medusa credit line'ları) sipariş parasında toplam olarak var (`credit`), satır paylarına dağıtılmıyor. İadede kredi payının krediye dönmesi F7 iade akışıyla (ADR-0025 notu).
  - Hediye kartı listesi en yeni 200 kartı okuyor (sayfalama ve kodla arama yok). Kart düzenleme/iptal ve krediden düşme panelde yok (Medusa Admin'de).
  - Kodla kart sorgusu (`GET /store/gift-cards/:code`) kodu büyük harfe çevirmiyor (yol parametresi); storefront kodu büyük harfle göndermeli (F18).
  - Kod eklenince Medusa kargoyu yeniden fiyatlamıyor; ödeme `cart.shipping_changed` ile duruyor. Storefront (F18) kod ekleyip çıkarınca kargoyu yeniden seçtirmeli.
  - Ücretsiz kargo fiyatı yalnızca kuralsız (para birimi) fiyatı olan sabit seçeneklere yazılıyor; yalnızca bölgeye göre fiyatlanan seçenek almıyor. Eşik her para biriminde aynı sayı (platform TRY).
  - Promosyon panosu en yeni 200 kampanyayı gösteriyor (`limited` notuyla); parti kampanyalarını dışlayan `$nin` listesi parti sayısıyla büyüyor.
  - Fiyat listesi bir dakikadan kısa sürerse (iki iş çalışması arasında başlayıp biterse) geçmişe girmeyebilir.
  - Kod partisi sürecin ortasında çökerse yarım parti kalabilir (workflow motoru bellek içi); bir süpürücü F16'da düşünülmeli.
  - Hediye kartı hesaplarının sahiplenme kodları (`SC-…`) eklentinin zayıf üreticisinden (~50 bit); `claim` açılırsa (F18) kendi kodumuzla değiştirilmeli.
  - `lib/money` iki haneli kuruş varsayıyor; ondalıksız para birimleri (JPY gibi) için genelleştirme gerekir (platform TRY).
  - Medusa'nın Query'si sipariş ayarlamalarını bütün sürümlerden döndürüyor; ayarlama okuyan yeni kod güncel sürüme göre süzmeli (`workflows/orders/order-money.ts` `currentAdjustments`).

**2026-10-24 gece oturumu (S3, S5; S8 başladı).** Kullanıcı döndü; dört karar verdi: bağımlılıklar onaylandı (ioredis 5.11.1, fast-xml-parser 5.11.2, yauzl 3.4.0, kendi görsel başlık okuyucumuz), ADR-0011..0014 kabul edildi, otonom devam, eski "Gözden geçir" maddeleri olduğu gibi kabul. Commit `54abc2a`.

2026-10-25 (karar, adr/0022): Kullanıcı Medusa Admin'i yetersiz buldu ("tek renk, dashboard yok, düz kartlar, adım adım olmalı") ve kendi panelimizi yazmaya karar verdi.
- Panel `apps/panel`: React 19 + Vite, Tailwind v4 + shadcn/ui, TanStack Router/Query/Table, RHF + Zod, Recharts, i18next. Backend'le aynı origin (proxy), oturum çerezi.
- Tema mağaza sahibi tarafından yönetilir: marka rengi, logo, köşe, yoğunluk, mod; motor OKLCH ölçeği türetir, AA kontrastı garanti eder (docs/18 §5).
- Kurallar: "AI slop" kara listesi (docs/18 §3), token dışı değer yok, klasör yapısı docs/18 §6.
- Medusa Admin saklanır, mağaza sahibine gösterilmez; yeni ekran oraya yazılmaz; P6'da kapatılır.
- docs/06 baştan yazıldı; docs/18 yeni; docs/02, docs/03 (P hattı), CLAUDE.md güncellendi.

2026-10-25 (admin kullanılabilirliği, dilim 1 ve 2): Kullanıcı "panel çok zor, dashboard bile yok" dedi. docs/17 ve ADR-0021 (kabul).
- **Dilim 1 (ayrı ajan, worktree):** Başlangıç sayfası (`/app/home`).
  - Mağaza kurulum kontrol listesi: 6 adım, ilerleme çubuğu, "Sıradaki adım".
  - Hızlı işlemler ve ürün sayıları.
  - Kullanılabilirlik denetimi ve doğrulanmış Medusa sınırları (açılış sayfası sabit; menü sırası ve gizleme yalnızca düzen tercihiyle).
- **Dilim 2 (kullanıcı kararları 1–5):**
  - `tenant:bootstrap` mağaza adını ister (`store-name="..."`) ve admin menü varsayılanını yazar: Başlangıç en üstte, geliştirici ayarları gizli, bizim ayar sayfalarımız "Genel"de. Mevcut bir varsayılana dokunmaz.
  - Çekirdek Türkçe terimler sözlüğe göre ezildi (119 metin): Gönderi, Stok, stoktan ayır, mağazadan teslim, URL adresi. Yükseltme kontrolü `scripts/check-core-overrides.mjs`.
  - Dashboard'a hata mesajı Türkçe cümle olarak dönüyor, anahtar `code`'da. API istemcileri ve testler anahtarı almaya devam ediyor. Metinlerin tek kaynağı `src/lib/errors/messages`; eksik 29 anahtar eklendi.
  - `GET /admin/home/summary`: kargoya hazırlanmayı bekleyen, bugünkü sipariş ve satış. Kişisel veri yok. Başlangıç'ta "Bugün" bölümü.
- **Ara düzeltmeler (kullanıcının bulduğu hatalar):**
  - Ayar menü etiketleri ham anahtardı (`translationNs` eksikti).
  - SEO sayfası açılışta çöküyordu.
  - Ürün oluşturma ekranı `limit=9999` istiyordu; admin sınırı 1000'den 9999'a çıkarıldı (dashboard en az on ekranda 9999 kullanıyor).

2026-10-25 (F3 T1a): F3.1 katalog uzantısı. Plan `/Users/deniz/.claude/plans/f3-t1-catalog-extension.md`.
- **Modül `catalog-extension`:** Ürün ve varyanta link'li ek alanlar: durum (yeni/yenilenmiş/ikinci el/kusurlu), tür (fiziksel; dijital/hizmet davranışı T1b), birincil kategori, halef ürün, varyant MPN'i.
  - GTIN, Medusa'nın varyant `ean`/`upc`/`barcode` alanlarından okunur; `lib/catalog/gtin` kontrol basamağına bakar. Geçersiz kod reddedilmez.
- **Admin:** `GET/POST /admin/products/:id/catalog` ve ürün sayfasında "Katalog bilgileri" kutusu.
  - Birincil kategori yalnızca ürünün kendi kategorilerinden seçilir.
  - Halef: kendisi olamaz, var olmalı, döngü kurmamalı (ortak kilit).
  - Form yalnızca değişen alanları gönderir. Denetim kaydında ham alanlar önce/sonra olarak görünür.
- **Handle:** Ürün/kategori/koleksiyon oluştururken handle başlıktan Türkçe-ASCII slug olarak üretilir; verilen handle slug değilse 400.
  - Middleware `methods` belirtilmeden, core doğrulamasından önce çalışır. Hook'lar ikinci kez kontrol eder (içe aktarma middleware'den geçmez).
- **URL sahipliği:** Hook'lar her kayıttan sonra yolu `url-registry`'de tek transaction'da claim eder.
  - Ürün `/urun/{h}`, kategori `/kategori/{atalar}/{h}`, koleksiyon `/koleksiyon/{h}`; düz stil seçiliyse kökte.
  - Yolunu zaten tutan kayıt (iki stilden birinde) yeniden claim edilmez; stil değişimi ilgisiz düzenlemeleri kilitlemez (toplu taşıma T4).
  - Kategori yeniden adlandırılınca ya da taşınınca alt ağacın yolları da güncellenir; eski handle'lı bir alt kategori atlanıp loglanır.
  - Yayındaki ürünün eski yolu 301 için rezerve kalır. Taslağın eski yolu ve silinen taslağın yolları serbest kalır.
  - Sistem kök yolları (`/arama`, `/sepet`, `/urun`, `/admin`...) alınamaz.
- **Yayın kuralı:** Yayındaki fiziksel ürünün her varyantının ağırlığı ve üç ölçüsü (varyantın ya da ürünün) dolu olmalı. Ürün, varyant, toplu ve dashboard varyant batch yollarında geçerli; ihlalde işlem geri alınır.
- **Diğer:**
  - `routePath`'teki `/\/+$/` karesel çalışıyordu (16 KB'lık yolda istek başına ~90 ms); döngüyle değiştirildi, testli.
  - `src/scripts/claim-catalog-paths.ts`: eski kayıtların yollarını claim eder, ölçüsü eksik yayındaki ürünleri raporlar. Veritabanı başına bir kez çalıştırılır (deploy adımı).
  - Seed: demo ürünlere ölçü eklendi; tekrar çalışınca mevcut demo ürünlerin eksik ölçülerini doldurur.
  - docs/02, docs/10 (hook ve middleware kuralları), docs/13 (kategori yolu, facet notu).
- **İncelemeler:** Güvenlik incelemesinde kritik ya da yüksek bulgu yok. Orta ve düşük bulguların ve kod incelemesi bulgularının çoğu düzeltildi; kalanlar aşağıda "F3 T1a'dan devreden".
- **Testler:** birim + 6 yeni HTTP spec dosyası (29 katalog testi) + `url-registry` modül testleri.

2026-10-25 (F3 planlaması, kullanıcı dışarıdayken; `/faz-baslat`). Uygulama kodu yazılmadı.
- **Medusa 2.21.2 doğrulaması** (Context7 + v2.21.2 kaynağı, medusa-researcher ajanı): katalog alanları ve genişletme yolu, görseller, rezervasyon ve kilit, içe/dışa aktarma, olaylar, Store `seo` payload seçenekleri, admin bildirimleri. Bulgular ADR'lerin "Bağlam" bölümlerinde.
- **Kritik bulgu:** Locking modülü tanımlı değil; Medusa bellek içi sağlayıcıyla çalışıyor ve çok süreçte stok kilidi süreçler arası geçerli değil. Bu biliniyordu (F16'ya bırakılmıştı). F3'ün eşzamanlı checkout KK'sı buna bağlı olduğu için ADR-0020 öne çekmeyi öneriyor. Sağlayıcı `@medusajs/medusa` ile geliyor; yeni bağımlılık yok.
- **Önerilen ADR'ler, hepsi "Önerildi":**
  - 0015: SEO alanları ve Store `seo` payload
  - 0016: görsel işleme
  - 0017: yönlendirme motoru
  - 0018: xlsx
  - 0019: zengin metin
  - 0020: stok defteri, düşük stok, ön sipariş, kilit
- **F3 görev planı** aşağıda (T1–T16).

2026-10-25 (F2 sonrası, kullanıcı dışarıdayken): devreden işlerden onay gerektirmeyenler.
- Kilit alınamayan kayıt (aynı ürüne iki eşzamanlı kayıt, aynı iş tipine iki istek) artık 500 değil 503 + `Retry-After: 2` alıyor; tek satırlık bilgi logu yazılıyor, yığın izi ve kilit anahtarı yok. HTTP testli.
- `/admin/*` `limit` üst sınırı 1000 (sonradan 9999'a çıkarıldı: ürün oluşturma ve fiyat ekranları 9999 istiyor).
- CI kalite işine Redis servisi eklendi (dev ile aynı sabit imaj); Lua sayaç testleri CI'da da çalışacak. Turbo `TEST_*` değişkenlerini geçiriyor.

2026-10-25 (F2 S13): F2.8. `async-job` modülü, iş tipleri, "İşler" sayfası (adr/0014). Plan `/Users/deniz/.claude/plans/f2-s13-async-jobs.md`.
- **Akış:** `POST /admin/async-jobs` → enqueue workflow'u (tip/girdi/bayrak, tip başına kilit, tekillik) → `async-job.queued` → subscriber → run workflow'u. Run workflow'unda iş başlar, sonuç akış hâlinde private dosyaya yazılır ve iş biter.
- **İlk tip:** denetim kaydı CSV (`;` + BOM, formül kaçışı). İndirme 5 dk imzalı bağlantı; okuma kaydı filtrelerle yazılıyor.
- **Zamanlanmış işler:** süpürücü (5 dk: `interrupted`/`not_started`) ve saklama (günlük: sonuç 7 gün, kayıt 90 gün).
- **Dosya deposu:**
  - Env'de `S3_*` ya hepsi ya hiçbiri; staging/production'da zorunlu ve https.
  - Testte file-local, dev'de file-s3. SeaweedFS ile imzalı bağlantı doğrulandı.
  - Dev bucket'ı anonim okunabilir; F16 şartı olarak adr/0014 ekinde.
- **İnceleme:** Güvenlik incelemesi yapıldı.
  - Yüksek 1: API dosya anahtarını veriyordu; Medusa'nın `/admin/uploads/:id` ucuyla kayıtsız indirme mümkündü. Anahtar gizlendi, uç kapatıldı.
  - Yüksek 2: `presigned-urls` S5 kontrollerini atlıyordu; F3.9'a kadar kapatıldı.
  - 3 orta bulgu düzeltildi: bellekte dışa aktarma, takılı `queued`, `NODE_ENV` tanımsızken yerel disk (uyarı). Düşüklerin çoğu düzeltildi (atomik geçişler, subscriber, saklama döngüsü, https).
- F2 bu görevle bitti.

2026-10-25 (F2 S12): F2.4b. Admin: ürün özellikleri widget'ı ve Ayarlar > Ürün özellikleri. Plan `/Users/deniz/.claude/plans/f2-s12-attribute-admin.md`.
- **Widget (`product.details.after`):** Şablon seçimi ve tipine göre alanlar (metin, sayı+birim, evet/hayır, tek ve çoklu seçim). Varyant özellikleri bilgi satırı olarak görünür. Değeri olan üründe şablon değişimi onay ister.
- **Şablon sayfası:**
  - Liste; oluştur/düzenle çekmecesi.
  - Tanım düzenleyici: seçenekler, bayraklar, kapsam, variesBy. Seçenek değeri etiketten üretilir.
  - Silinen özelliğin değerleri varsa onay istenip yeniden gönderilir. Kullanılan şablon silinemez.
  - "Değerler herkese görünür" uyarısı var.
- **Doğrulama:** Admin tip denetimi, lint, `medusa build` temiz. Playwright duman testi S10'daki devreden işe bağlı; kullanıcı gözle kontrol eder.

2026-10-25 (F2 S11): F2.4a. `product-attributes` backend (adr/0013). Plan `/Users/deniz/.claude/plans/f2-s11-product-attributes.md`.
- **Modül:** şablon, tanım ve değer (tipli kolonlar, facet indeksleri, GIN). Link'ler: ürün ↔ şablon (tek) ve ürün ↔ değerler (`deleteCascade`; ürün silinince değerler gidiyor, testli).
- **Workflow'lar:**
  - Şablon oluştur/güncelle/sil compensation'lı ve şablon kilitli.
  - Ürün değerleri ürün + şablon kilidiyle; plan → yaz → link adımları; yetim değerler temizleniyor.
  - Değer şeması tanımlardan üretiliyor.
- **API:** `/admin/attribute-templates` CRUD, `GET/POST /admin/products/:id/attributes`; Store'da değerler ve seçenek etiketleri.
- **`lib/errors`:** `ConflictError` (409, i18n anahtarı korunur). Medusa'nın CONFLICT yanıtı mesajı genel bir cümleyle değiştiriyordu.
- **İnceleme:** Güvenlik incelemesi yapıldı, yüksek bulgu yok. 5 orta bulgunun 4'ü düzeltildi:
  - Store `*`/ilişki geçişi guard'ı.
  - `constructor` anahtarı prototipten okunuyordu.
  - Şablon güncellemesi tüm değerleri belleğe yüklüyordu.
  - Seçenek etiketleri vitrine kapalıydı.
  - Görünürlük bayrağı ertelendi, admin'de uyarı var. Düşüklerin çoğu düzeltildi; kalanlar adr/0013 ekinde.
- **KK:** "Attribute şablonu tanımlayıp ürüne değer atanabiliyor, Store API'de görünüyor" karşılandı.

2026-10-25 (F2 S10): F2.3b. Admin: Ayarlar > Özellikler ve Ayarlar > SEO.
- **Bağımlılıklar** (kullanıcı onayı, exact, ≥14 gün): `@medusajs/js-sdk` 2.21.2, `react-hook-form` 7.89.0, `@hookform/resolvers` 5.9.1.
- **Özellikler:** Bayrak listesi; tenant bayrağı anahtarla açılıp kapanır. Platform bayrağı "Platform tarafından yönetilir" rozetiyle salt okunur. Kayıt defteri boşken yönlendirici boş durum gösterilir.
- **SEO:**
  - Alan adı ve URL stili.
  - Başlık/açıklama şablonları: kullanılabilir etiketler, örnek değerlerle önizleme ve "Google sonucuna sığar" rozeti (`lib/seo` tarayıcıda çalışıyor).
  - robots.txt ve yapay zekâ tarayıcı ön ayarı.
  - İstemci tarafı Zod doğrulaması sunucuyla aynı token kuralını uygular.
- **Genel:** Yükleniyor, boş ve hata durumları her ekranda var. Tüm metinler i18n anahtarı (tr/en). Sunucu hata anahtarı (`seo.template_invalid`) Türkçe metne çevrilir.
- **Doğrulama:** Admin tip denetimi, lint ve `medusa build` (frontend) temiz. Dev logunda dashboard POST'ları CSRF'ten geçiyor.
  - **Playwright duman testi yapılmadı:** MCP tarayıcısı kullanıcının profilini kullanıyor ve repoda `@playwright/test` yok. Sayfalar kullanıcının gözle kontrolüne bırakıldı.
  - Rota etiketi (`defineRouteConfig.label`) i18n anahtarı olarak verildi. Dashboard'un çevirip çevirmediği bu kontrolde görülecek; çevirmiyorsa sabit metne dönülür.
- **Bulunan sorun (S8 düzeltmesi):** Dashboard'un bildirim rozeti dakikada bir `fields=created_at` ile okuma yapıyor ve her biri denetim kaydı yazıyordu. Kişisel veri içermeyen alanlarla sınırlı okumalar artık kaydedilmiyor (`18a6390`).

2026-10-25 (F2 S9): F2.3a. `platform-settings` modülü, özellik bayrakları (adr/0012). Plan `/Users/deniz/.claude/plans/f2-s9-platform-settings.md`.
- **Bölümler:**
  - `store`: iletişim e-postası ve TR telefonu (E.164), saat dilimi, birimler.
  - `seo`: canonical host, URL stili (prefixed/flat), başlık ve açıklama şablonları (`lib/seo` token kontrolü), robots.txt (direktif allowlist'i), AI tarayıcı ön ayarı.
  - Şemalar strict; patch kısmi gelir, mevcut değerin üzerine bir seviye derin birleştirilir. Okumada bilinmeyen alan düşürülür, geçmeyen alan tek başına varsayılana döner.
- **Bayraklar:**
  - Kayıt defteri kodda. İş bayrağı yok; test bayrakları yalnızca `NODE_ENV=test`'te var.
  - Platform bayrağı admin'den değişmez (403) ve tenant override'ını okumaz.
  - `requireFeature` kapalıyken Express'in bilinmeyen route sayfasını bayt bayt üretir (testle karşılaştırılıyor). `assertFeatureEnabledStep` workflow'u ilk adımda durdurur.
- **Cache:** Süreç içi değer + Redis'te her yazımda yeni rastgele işaret. Kontrol en çok saniyede bir; 30 sn üst yaş; eşzamanlı yükleme tek uçuş; invalidate öncesi başlayan yükleme atılır; başarısız işaret yazımı yeniden denenir. Redis istemcisi tembel açılır. Ortak parçalar `lib/redis` ve `lib/cache`'e taşındı; rate limit de kullanıyor.
- **API:**
  - `GET/POST /admin/platform-settings/:section`, `GET /admin/features`, `POST /admin/features/:key`; workflow ve compensation'lı.
  - Mutasyonlar yalnızca admin kullanıcıları içindir (API key 403, F12'ye kadar).
  - Denetim kaydı alan bazında önce/sonra yazar; iletişim alanları maskeli.
- **İnceleme:** Güvenlik incelemesi yapıldı, yüksek bulgu yok. 3 orta bulgu düzeltildi: cache'in sınırsız eskimesi, yeniden yükleme fırtınası, platform bayrağında override'ın okunması. Düşüklerin çoğu da düzeltildi (`%73tore` doğrulama atlatması, gate hata yolu, 404 sayfa farkları, kontrol karakterleri).
- **KK:** "Feature flag kapalıyken ilgili endpoint/akış devreye girmiyor (testli)" karşılandı.

2026-10-25 (F2 S8): F2.5. `audit-log` modülü, mutasyon ve hassas okuma kaydı (adr/0011).
- **Modül:** `audit_entry`, yalnızca ekleme. Güncelleme/silme metotları parametresiz override ile kapalı; çağrı derlenmez, tiple aşılırsa hata fırlatır. Satır boyutu sınırlı (metin 256, UA 512, `changes` 16 KB üstü alan adlarına iner).
- **Mutasyon:** `/admin/*` POST/PUT/PATCH/DELETE yanıt bittikten sonra yazılır. Kayıt defteri (varyant fiyatı, ürün üzerinden fiyat, varyant batch, price list fiyat batch) önce/sonra fiyatlarını `variants.prices` ile okur. Diğer route'larda yalnızca alan adları yazılır.
- **Okuma:** Müşteri detayı/adresleri/fatura profili, sipariş detayı ve `GET /admin/audit-log` yanıttan önce kaydedilir; yazılamazsa 503.
- **İnceleme:** Güvenlik incelemesi yapıldı; 2 yüksek, 5 orta bulgu düzeltildi (ayrı commit; ayrıntı adr/0011 eki). Yüksekler: bağlantıyı koparan istemcinin mutasyonu kaydedilmiyordu (yazım `res.end`'e bağlandı); liste ve alt route'lardan kişisel veri ve `fields=*billing_profile` ile şifreli vergi kimliği kayıtsız çekilebiliyordu. Açık kalanlar adr/0011 ekinde.
- **Bulunan hata:** `routePath` küçük harfe çevirdiği için ID'ler (`prod_01JABC`) bozuluyordu. Birim testi yakaladı; denetim katmanı `routePathKeepingCase` kullanıyor.
- **KK:** "Ürün fiyatı değişikliği audit log'da görünüyor; müşteri TCKN görüntüleme okuma kaydı düşüyor" karşılandı (HTTP testi: fiyat 1000 → 1250 önce/sonra; fatura profili görüntüleme `sensitive_read`; secret API key actor'ı `api-key`).

2026-10-24 (gece, F2 S5): F2.9b. Upload validator, CSV kaçışlama, güvenli XML, zip sınırları.
- **Upload:** Tür baytlardan okunuyor (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X, AVIF ispe); başlık baytlarının ve boyut alanlarının tutarlı olması şart. Kabul edilen dosya `<slug>.<gerçek uzantı>` adıyla ve gerçek MIME ile saklanıyor; istek başına en fazla 20 dosya; multer'ın latin1 okuduğu UTF-8 dosya adı onarılıyor.
- **CSV / XML / zip:** Türkçe Excel `;` ile böldüğü için hücre içi formül başlangıçları da kaçışlanıyor. XML'de derinlik sınırı 64 ve değerler metin; `__proto__`/`constructor` etiketleri reddediliyor. Zip'te aynı ad (büyük/küçük harf, Unicode biçimi dahil) ve kontrol karakteri reddediliyor.
- **İnceleme:** Güvenlik incelemesi yapıldı. Yüksek bulgu: PNG başlıklı ama `.html` adlı dosya `/static`'ten HTML olarak servis edilirdi (stored XSS; dev sunucuda `/static`'in bizim header'larımızı almadığı doğrulandı). Bu, 1 orta ve 11 düşük bulgu düzeltildi.
- **KK:** "SVG ve sahte MIME yükleme reddediliyor" karşılandı (S4 kısmıyla birlikte satır kapandı).

2026-10-24 (gece, F2 S3): F2.10b. Rate limit, güvenlik header'ları, CSRF, istek sınırları.
- **Rate limit:** Redis'te atomik sabit pencere (EVALSHA); Redis düşerse 30 sn bellek store'u. Kimlik `PII_HASH_KEY` HMAC'i, IPv6 /64 kovası, anahtarlar DB sunucusu + adıyla ad alanında.
- **Yol eşleme:** Kurallar Express'in rotaladığı yola göre seçiliyor (`routePath`). İnceleme `/auth/customer/emailpass/` ile login limitinin, `/ADMIN/...` ile admin CSRF'nin atlandığını buldu; ikisi de testle kapatıldı.
- **CSRF:** `Origin: null` reddediliyor; alan dışı cookie'li mutasyon üç CORS listesinden birini istiyor. Upload boyut kapısı içerik türüne bağlı.
- **İnceleme:** Güvenlik incelemesi yapıldı; 2 yüksek, 4 orta ve 7 düşük bulgu düzeltildi ya da docs/04'e (güven modeli, F16/F18 notları) yazıldı.
- **KK:** "Login ucunda limit aşımı 429; header'lar tüm yanıtlarda" karşılandı. Medusa'nın önce yazdığı yanıtlar F16'da proxy'de.

**2026-10-24 akşamı otonom oturum (S2, S4, S7, S6).** Kullanıcı dışarıdayken açık yetkiyle yürütüldü: plan onayı beklenmedi, belirsizlikte muhafazakâr seçenek uygulanıp aşağıdaki "Gözden geçir" maddesine yazıldı. Planlar `/Users/deniz/.claude/plans/` altında (`f2-s4-safe-fetch.md`, `f2-s6-http-client-health.md`; S2 ve S7 bu dosyanın görev ayrıntılarında). Her görev bağımsız kod ve/veya güvenlik incelemesinden geçti; bulgular düzeltildi. Son durum: 647 birim, 74 HTTP, 47 modül testi; lint ve typecheck temiz. Push yapılmadı.

2026-10-24 (akşam, F2 S6): F2.1 + F2.6. Sağlayıcı HTTP istemcisi ve `/admin/integrations/health`. Plan `/Users/deniz/.claude/plans/f2-s6-http-client-health.md`.
- **`lib/clients`:**
  - Timeout; yeni bağımlılık yok.
  - Yeniden deneme: idempotent isteklerde tam jitter'lı geri çekilme.
  - POST yalnızca gönderilmediği kesinse tekrarlanır (bağlantı reddi, DNS, TLS).
  - Sonucu belirsiz hata (gönderildikten sonra timeout, 500/502/504) `outcome_unknown` döner ve denenmez; ödemede çift tahsilat olmaz.
  - `Retry-After` jitter'la uygulanır; `ProviderError.retryAfterMs` üzerinden taşınır ve bizim yanıtımızda 300 sn ile sınırlanır.
  - Devre kesici izin nesneleriyle çalışır; sağlayıcıya ulaşmayan deneme yarı açık durumu kilitlemez.
  - Path segmentleri tek tek kodlanır, nokta segmenti ve sorgu reddedilir. Header değerleri alıntılanmadan doğrulanır.
  - Log satırı sabit alanlıdır; `hidePaths` ve `logPath` desteklenir. Yanıt boyutu 5 MB ile sınırlı.
- **Health:** Kontroller paralel çalışır, her biri 5 sn ile sınırlı; sonuç 30 sn cache'lenir ve yalnızca durum ile neden kodu döner. İlk kontrol RESP üzerinden Redis (AUTH, PING; kütüphanesiz).
- **İnceleme:** Güvenlik incelemesi yapıldı. Yüksek bulgu, belirsiz sonuçların `retryable: true` işaretlenmesiydi (çift tahsilat riski). Bu ve 5 orta, 9 düşük bulgu düzeltildi.
- **KK:** "HTTP istemci logunda Authorization/API key görünmüyor" karşılandı. Test redaksiyonsuz bir casus logger'la yalnızca izinli alanların yazıldığını doğruluyor. Commit: `7a57ed3`.

2026-10-24 (akşam, F2 S7): F2.11. `lib/seo` ve `url-registry` modülü.
- **`toSlug`:**
  - Türkçe transliterasyon. NFKD ile ligatür ve üst simge ayrıştırılır.
  - 80 karakter, kelime sınırında kesim.
  - Harf kalmazsa `""` döner: sayısal slug olmaz.
- **Şablon motoru:**
  - Türkçe tokenlar; varlık türü başına token kataloğu (`SEO_TEMPLATE_TOKENS`).
  - Bilinmeyen token kaydederken reddedilir.
  - Boş token ayırıcısıyla birlikte düşer; güçlü ayırıcı kalır. Noktalama artıkları doğrusal sürede temizlenir.
- **Piksel genişliği:** Helvetica AFM metrikleri (Arial ve Liberation Sans aynı ölçüde), macOS Arial.ttf ile çapraz kontrol edildi. docs/14 karakter hedefleri de eklendi.
- **`url-registry`:**
  - `(locale, path)` unique.
  - `claimPath` path'i kaydın aktif path'i yapar ve eski aktif path'i rezerve eder. `unclaimPath` workflow compensation içindir. Ayrıca `releasePath`, `releasePathsOf` ve `freePath`.
- **Doğrulanan (Medusa 2.21.2):**
  - Servis içindeki `create` INSERT'i transaction commit edilirken flush ediliyor. Metot içindeki try/catch yarışı yakalamıyordu; 10 eşzamanlı claim testi bunu gösterdi.
  - Düzeltme: transaction iç metotta kapanıyor, hata dış metotta `seo.path_taken`'a çevriliyor. Medusa'nın duplicate metni `lib/errors` `uniqueViolationKeys`'te tek yerde okunuyor.
- **İnceleme:** Kod incelemesi yapıldı; 2 yüksek, 4 orta ve 12 düşük bulgu düzeltildi.
- **KK:** "Slug üretici transliterasyon tablosunu geçiyor; aynı path ikinci varlığa verilemiyor" karşılandı. Commit: `c3d1c80`.

2026-10-24 (akşam, F2 S4): F2.9a. `safe-fetch` (SSRF) ve timing-safe karşılaştırma. Aynı otonom oturum; plan `/Users/deniz/.claude/plans/f2-s4-safe-fetch.md`.
- **`lib/security/safe-fetch`:**
  - Yalnızca http/https; URL'de kimlik bilgisi yok; port allowlist 80/443.
  - Adres DNS'ten sonra kontrol edilir. IPv4'te IANA özel aralıkları; IPv6'da yalnızca `2000::/3` ve onun içindeki özel aralıklar hariç. Tek bir yasaklı DNS yanıtı isteği reddettirir.
  - Bağlantı `lookup` ile doğrulanan IP'ye sabitlenir (rebinding).
  - DNS c-ares ile yapılır ve iptal edilebilir; getaddrinfo libuv thread havuzunu bloke ederdi.
  - Yönlendirme modları `same-origin` (varsayılan), `follow` ve `error`. https→http inişi ve başka origin'e giden 307/308 gövdesi reddedilir.
  - Hatalar yalnızca bir neden kodu taşır, URL taşımaz.
- **`safeEqual`:** SHA-256 özetlerini sabit zamanda karşılaştırır; boş beklenen değer eşleşmez.
- **Doğrulanan (Node 24):**
  - `http.request` özel `lookup`'ı `all: true` ile çağırıyor.
  - WHATWG URL sayısal host biçimlerini normalize ediyor.
  - `net.BlockList` IPv4'ü IPv4-mapped biçimde karşılaştırıyor; `::ffff:0:0/96` ana listeye konursa her IPv4 adresi reddediliyor. Adres tablosu testi bunu yakaladı, kural ayrı listeye alındı.
- **İnceleme:** Güvenlik incelemesi yapıldı; kritik ya da yüksek bulgu yok. Düzeltilenler:
  - başka origin'e secret header taşınması
  - DNS'in thread havuzunu tüketmesi
  - eksik IPv6 aralıkları
  - NaN limitlerin sınırı kaldırması
  - `invalid_url` hatasının `cause`'unda URL'nin kalması
  - public API'de güvenliği kapatan test kancası
  - HEAD/204/304 yanıtları
- **Testler:** 118 birim testi, yerel HTTP ve TLS sunucularıyla; HTTPS'te SNI ve sabitleme testi `openssl` gerektiriyor, CI imajında var. Commit: `4e504f7`.
- **KK:** "safe-fetch iç IP'ye ve DNS rebinding'e giden isteği reddediyor" kısmı karşılandı; aynı satırdaki SVG ve MIME kısmı S5'te.

2026-10-24 (akşam, F2 S2): F2.10a. Pino logger, redaksiyon, istek ID'si, hata yanıtı sanitizasyonu. Kullanıcı dışarıdayken, açık yetkiyle plan onayı beklemeden yürütüldü (kapsam S2 → S4 → S7 → S6; belirsizlikte muhafazakâr seçenek + not).
- **`lib/logging`:**
  - Tek logger: pino 10.4.0, stdout'a JSON. `request_id` AsyncLocalStorage'dan geliyor.
  - `MedusaPinoLogger`, `defineConfig({ logger })` ile bağlandı; çekirdek, modüller ve script'ler aynı logger'ı kullanıyor (kök container testi var).
  - Redaksiyon serileştirmeden önce uygulanıyor, satır her zaman geçerli JSON:
    - anahtar kuralları her derinlikte, `cause` dahil
    - metin desenleri her string değerde ve mesajda
    - SQL öneki düz nesne hatalarda ve stack'te de siliniyor
  - Desenler doğrusal; 8 KB üstü metin kesiliyor. Ölçüm: eski regex 64 KB'ta 2,3 sn sürüyordu.
- **`api/http`:**
  - İstek ID'si doğrulanıyor, `X-Request-Id` yazılıyor.
  - `platformErrorHandler` bağlandı:
    - 5xx genel gövde
    - DB 4xx mesajları `/admin` dışında i18n anahtarı
    - body-parser hataları sabit gövde; gövde loga girmiyor
    - handler'ın kendi hatası genel 500 döner
  - `rejectRequest`: tr-address ve sensitive-fields doğrulamaları da `request_id` döndürüyor.
- **Doğrulanan (2.21.2):**
  - Logger modül container'larına paylaşılan container'dan geçiyor.
  - Medusa'nın ilk middleware'i `x-request-id`'yi doğrulamadan kopyalıyor.
  - `authenticate` 401'i doğrudan yazıyor; bu yanıt bizim middleware'imizden ve handler'dan geçmiyor.
  - Dev dışında morgan erişim logu logger'ı atlıyor.
  - `dbErrorMapper` export edilmiyor; gerçek metinleri entegrasyon testi modül servisi üzerinden üretiyor.
  - Store'da e-posta çakışmasını çekirdek önceden yakalıyor ("already has an account").
  - Mevcut log kanıtı testleri pino'nun fd yazıcısıyla boşa geçerdi. Logger hedefi `process.stdout`; `captureOutput` yoklama satırı görmezse hata veriyor.
- **İnceleme:** Kod ve güvenlik incelemeleri yapıldı.
  - Düzeltilen bulgular:
    - karesel regex'ler (ReDoS)
    - satır seviyesindeki maskelemenin JSON'u bozması ve kaçış dizisinden sonra değer kaçırması
    - SQL temizliğinin düz nesne hatalarda ve mesajda atlanması
    - body-parser hatasının ham gövdesi
    - anahtar listesindeki boşluklar (`address_1`, `gsmNumber`, `hashKey`, isimler)
    - Express'in ham stack basan fallback'i
    - `$&` replacement
    - ZodError dalının geniş olması
  - "Body-parser hatası 500'e düşer" iddiası kaynakla çelişiyordu; 400 döndüğü entegrasyon testiyle doğrulandı.
- **Testler:** 373 birim (+187), 72 HTTP (+10), 24 modül. Lint ve typecheck temiz. Commit'ler: `9e235db`, `a9354e5`, `1fb52dc`, `fa7c1e1`, `48d5180`.

2026-10-24 (gece): F2 planlandı (`/faz-baslat F2`).
- Medusa 2.21.2 API'leri üç araştırma ajanıyla doğrulandı (Context7 + v2.21.2 kaynağı): HTTP katmanı, modül/link/admin, asenkron iş/dosya/para. Planı değiştiren bulgular:
  - **HTTP katmanı:** Yerleşik rate limit, güvenlik header'ı ve `limit` üst sınırı yok. Varsayılan error handler unique/FK ihlalinde kolon ve değeri yanıta yazıyor. `/admin/uploads` multer'ı sınırsız ve bellek içi çalışıyor. `x-request-id` doğrulanmadan kabul ediliyor.
  - **Logger:** `defineConfig({ logger })` ile değiştirilebiliyor; arayüz yalnızca string mesaj alıyor.
  - **Event'ler:** Actor bilgisi taşımıyor. Fiyat değişimi için güvenilir workflow event'i yok, bu yüzden denetim kaydı HTTP sınırında tutulacak.
  - **Store API:** Bağlı veri `allowFields` middleware'iyle açılıyor (2.21.0+).
  - **Handle:** `toHandle` Türkçe karakterleri ASCII'ye çevirmiyor (`şef-bıçağı`).
  - **Background step:** Gövdesi `run()`'ı çağıran süreçte (server) koşuyor. In-memory engine restart'ta zamanlayıcıları kaybediyor. `file-local` imzasız ve herkese açık.
- ADR taslakları yazıldı (hepsi "Önerildi"): 0010 para/yuvarlama, 0011 denetim kaydı, 0012 ayarlar/bayraklar, 0013 ürün özellikleri, 0014 asenkron işler. ADR-0004'e CSRF için doğrulanan gerçekler eklendi.
- docs/12'ye iki kalem eklendi: denetim kaydı saklama süresi ve kuruş yuvarlama kuralı. docs/03'te F2.11 `url-registry` modül olarak netleştirildi.

Önceki oturumlar:
- **F2 S1 (2026-10-24 gece):** `lib/errors` + `lib/money` (F2.2 + F2.7), ADR-0010 kabul. 186 birim test. Commit'ler `c665bcb`, `4faf669`, `449ead7`.
- **F1 S1–S8 (2026-10-24 gece):** tenant bootstrap, demo seed, `tr-address`, admin i18n, `billing-profile`, auth cookie/session. ADR 0004, 0007, 0008, 0009 kabul edildi. Testler: 108 birim, 24 modül, 62 HTTP.
- **Daha önce:** F1 planlaması ve F0.2–F0.8 (2026-10-24), F0.1 monorepo (2026-10-24 sabahı), SEO ve güvenlik dokümanları (2026-10-22).

## Sıradaki görev
**Claude'un sıradaki işi:** F8 E1 (`einvoice` modülü), plan aşağıda "F8 görev planı". F7'de K11 kullanıcının kargo firması cevabını, KK3 F8'i bekliyor. Plan aşağıda "F7 görev planı". Dal `f7-shipping` (`f6-alternative-payments` üzerinden). Kullanıcı 2026-10-27 gece: "izin istemeden çalışmaya devam edersin, kritik bir şey olursa sabah sorarım."

### F8 görev planı (2026-10-28; Medusa olay adları v2.21.2 kaynağından, GİB listesi ve UBL-TR sürümü web kaynaklarından doğrulandı; Context7 kotası dolu)
Karar: ADR-0034 (önerildi). Ayrıntı `docs/entegrasyonlar/e-fatura.md`.

Doğrulananlar:
- Medusa olayları: `order.placed`, `shipment.created`, `order.canceled`, `order-edit.confirmed`, `order.exchange_created`; kendi olayımız `return.refunded`. Modül, link, iş akışı, olay aboneliği, zamanlanmış iş ve özel dosya deposu projede zaten kullanılıyor; yeni Medusa API'si yok.
- GİB kayıtlı kullanıcı listesi herkese açık toplu indirilemiyor: e-Fatura Portalı'nda girişle (XML/CSV) ya da entegratörden. Herkese açık olan güvenlik kodlu tek VKN sorgusu. Mükellef tablosu bu yüzden entegratörün toplu listesinden beslenir (ADR-0034 §3).
- UBL-TR 1.2.1 güncel; kod listeleri 14 Eylül 2026'da güncellendi. XSD ve şematron GİB e-Belge portalındaki paketten.

| # | F8 | Görev | Bağımlılık | KK |
|---|---|---|---|---|
| E1 | F8.1 | `einvoice` modülü: fatura kaydı (tür, belge tipi, durum, UUID, numara, deneme, son hata, iade bağları; tekillik), mükellef tablosu, numara sırası (mağaza + yıl, kilitli); `einvoice` ayar bölümü (tetikleme anı, seri, açık/kapalı); migration ve modül testleri | — | KK3 (tekillik) |
| E2 | F8.2 | UBL-TR yazıcısı (bağımlılıksız, kaçışlı): satış ve iade faturası, KDV dökümü, indirim kalemde, kargo satırı, e-Arşiv internet satışı bilgileri, iade için `BillingReference`. GİB paketinin XSD'si depoya (sürümüyle); `xmllint` ile şema testi (yoksa atlanır, CI'da zorunlu). Birim testleri fixture'larla | E1 | KK4 (XSD kısmı) |
| E3 | F8.3, F8.7 | Belge tipi: fatura profilindeki VKN + yerel mükellef tablosu; `InvoiceAdapter` arayüzü; sahte entegratör (`packages/testing`, `pnpm dev:einvoice`); `integration-credentials`'a `einvoice` hesabı ve sağlık kontrolü; mükellef listesi işi (günlük, bozuk dosya, liste yokken yedek sorgu) | E1 | KK5 |
| E4 | F8.4 | `invoice-create-for-order` iş akışı: tip, tekillik, numara, UBL, iletim, kayıt; hata siparişi bozmaz (`failed` + artan aralıklı yeniden deneme işi, N denemede panel uyarısı); sonucu bilinmeyen iletim önce durum sorgusu; tetikleme (`shipment.created` varsayılan, `order.placed` seçenek; havale ve kapıda ödeme beklenir) | E2, E3 | KK1 (sahte), KK2, KK3 |
| E5 | F8.5 | İade ve iptal: `return.refunded` ve iade defteri iade faturası (asıl faturaya bağ), değişimde iade + yeni satış faturası, faturalı siparişin iptali (iptal/iade, adaptör), faturalı sipariş düzenlenemez (ADR-0033 §8) | E4 | F7 KK3 |
| E6 | F8.8 | Fatura görüntüsü: UBL'den HTML (mağaza logosu ve unvanı), özel depo, kısa ömürlü bağlantı; PDF kütüphanesi onaylanırsa PDF | E4 | — |
| E7 | F8.6 | Panel: sipariş sayfasında fatura kartı (durum, görüntü/PDF, yeniden dene), Siparişler > Faturalar (başarısızlar önce), Ayarlar > E-Fatura (hesap, seri, tetikleme, test modu) | E4–E6 | — |
| E8 | — | İlk gerçek entegratör adaptörü (kullanıcının seçimiyle) ve sunucuda GİB test ortamı / şematron doğrulaması | E3, kullanıcı | KK1, KK4 |
| E9 | — | Kapanış: güvenlik ve kod incelemesi, KK işaretleri | E1–E8 | — |

### F7 görev planı (2026-10-28; Geliver uçları resmi JS SDK kaynağından, Medusa fulfillment sağlayıcı arayüzü docs.medusajs.com'dan doğrulandı; Context7 kotası dolu)
Karar: ADR-0031 (kargo altyapısı, takip, etiketler; kabul edildi, kullanıcı onayladı). Geliver ayrıntıları `docs/entegrasyonlar/geliver.md`.

Doğrulananlar:
- Geliver: `https://api.geliver.io/api/v1`, `Authorization: Bearer`; zarf `{ result, data, message, code }`.
  - Uçlar: `POST /shipments` (`test: true` test gönderisi), `GET/DELETE /shipments/:id`, `POST /transactions { offerID }` (etiketi satın alır), `POST /shipments/:id { isReturn }` (iade), `GET /priceList?paramType=parcel&…`, `POST /addresses` (gönderici).
  - Teklifler zaman uyumsuz dolar (`offers.percentageCompleted`); takip numarası sonra dolabilir.
  - Test gönderisinde her `GET` durumu bir adım ilerletir. Kapıda ödeme `productPaymentOnDelivery` + `order.totalAmount`.
  - Bildirim `TRACK_UPDATED`, imza yok (ADR-0031: ipucu + yeniden okuma).
- Medusa: `AbstractFulfillmentProviderService` (`getFulfillmentOptions`, `validateFulfillmentData`, `validateOption`, `canCalculate`, `calculatePrice` → `{ calculated_amount, is_calculated_price_tax_inclusive }`, `createFulfillment` → `{ data, labels }`, `cancelFulfillment`, `createReturnFulfillment`). Kimlik `fp_<identifier>_<id>`; fulfillment modülünün `providers` dizisine eklenir.

| # | F7 | Görev | Bağımlılık | KK |
|---|---|---|---|---|
| K1 ✅ | F7.1 (temel) | **Bitti (2026-10-28 gece).** Geliver istemcisi (`lib/shipping/geliver`: Bearer, zarf, `result: false` reddi, 401/403 anahtar reddi, Zod yanıtları; okumalar tekrar denenir, sonucu bilinmeyen oluşturma denenmez), `integration-credentials`'a `geliver` (gizli `api_token`, `test_mode`; mod değişimi anahtar istemez), bağlantı ve sağlık kontrolü (`kind: shipping`), sahte Geliver (`packages/testing`, `pnpm dev:geliver`, `/api/v1` altında, adresler), `GELIVER_BASE_URL` (canlıda reddedilir; turbo geçiriyor), panelde Ayarlar > Kargo ve Kargo > Geliver (hesap çerçevesi `ns` ile ödeme dışına açıldı). Karar: gönderici adresi saklanmaz; depo başına Geliver'de bulunur, yoksa oluşturulur (K3). Testler: birim 6, HTTP 4 (+ sağlayıcı listesi testleri), panel 3, e2e listesine iki sayfa | — | — |
| K2 ✅ | F7.1–F7.2 | **Bitti (2026-10-28 gece).** `fulfillment-geliver` (`geliver_geliver`; medusa-config'te fulfillment modülü manuel + Geliver): seçenekler (`geliver-cheapest`, `geliver-fastest`, seçenek verisinde `service_code`), `validateFulfillmentData` seçimi depolanan seçenekten alır, `calculatePrice` fiyat listesinden (10 dk önbellek, `lib/shipping/geliver/quotes.ts`), desi `lib/shipping/parcel.ts` (mağaza birimleri g/kg, cm/mm; satırlar tek kolide, hacim küp olarak). Ölçüsü eksik ürün `shipping.dimensions_missing` (KK2 testli). Doğrulandı: Medusa fiyat bağlamındaki ve siparişteki kalemlere varyantın ağırlık ve ölçülerini veriyor. Geliver varsayılan depoya bootstrap ve göç betiğiyle bağlanıyor | K1 | KK2 |
| K3 ✅ | F7.3–F7.4 | **Bitti (2026-10-28 gece).** "Kargoya ver" Geliver'le: gönderici adresi depo başına Geliver'de bulunur/oluşturulur (telafisi siler), gönderi + teklif bekleme + seçilen teklifin kabulü (etiket), etiket PDF'i SSRF korumalı indirilip özel depoya yazılır (telafisi siler), Geliver'in etiket adresi atılır. Kapıda ödemede `productPaymentOnDelivery` + tutar. İşaret (`qt_ship`, `additional_data`) olmadan Medusa'nın kendi ucundan gönderi açılmaz. Etiket alınamazsa gönderi geri çekilir. "Kargoda" kaydı taşıyıcı teslim alınca (K4); sipariş durumu `pickup` listesi veriyor. Panelde etiket indirme (personel, hassas okuma, 5 dk bağlantı). İade gönderisi K8'de | K2 | KK7 (etiket yetkisiz açılmıyor) |
| K4 ✅ | F7.5–F7.6 | **Bitti (2026-10-28 gece).** `shipment-tracking` modülü (`tracked_shipment` fulfillment başına tek, `shipment_event` durum başına tek; iç durumlar ve yalnızca ileri geçiş `states.ts`), `refreshShipmentWorkflow` (gönderi kilidi altında Geliver API'sinden okur; taşıyıcı alınca Medusa gönderisi takip numarasıyla, teslimde Medusa teslimi; `shipment.status_changed` olayı), `POST /hooks/geliver` (sır taşımaz: Medusa'nın istek günlüğü yolu yazıyor; gövde yalnızca hangi gönderinin okunacağını söyler, gönderi başına dakikada en çok bir okuma, webhook hız sınırı), sorgu işi (30 dk, 25 dk'dan eski açık gönderiler, 50'şer). Panelde Geliver sayfasında bildirim adresi, sipariş sayfasında takip numarası. Geliver durum eşlemesi gönderi durumundan (takip kodları belgelenmemiş, gerçek hesapla doğrulanacak). Testler: HTTP 3 (KK1 test gönderisi teslime kadar, KK4 bildirim + sorgu aynı anda tek kayıt), modül 1, birim 3 | K3 | KK1, KK4 |
| K5 ✅ | F7.7, F7.10 | **Bitti (2026-10-28 gece).** Sipariş listesinde "Kargo" sütunu (son taşıyıcı kolisinin durumu, takip no üzerine gelince), "Hazırlanacak" sekmesinde seçim ve toplu "Kargoya ver" (`POST /admin/order-board/ship`, en çok 20 sipariş, her sipariş kendi iş akışında; sonuç penceresinde sipariş başına etiket ya da sebep cümlesi; `bulk_ship` hız profili), kısmi gönderim ("Kargoya ver" penceresinde kalem başına adet; sunucu kalanla doğrular, paketlenmiş koli bütün gider). Karar: toplu etiketler tek PDF'te birleştirilmedi (yeni bağımlılık gerekir, "Açık sorular"da). Testler: HTTP 2, panel 4 | K3, K4 | — |
| K6 ✅ | F7.8 | **Bitti (2026-10-28 gece).** `shipping` ayar bölümü (kargoya verme ve taşıma günleri, desi ücret tablosu + son bandın üstü desi başına), Geliver'e "ücret tablosu" seçeneği (`geliver-table`: fiyat tablodan, gönderi en uygun teklifle), kargo seçenekleri yönetimi (`/admin/shipping-setup/options`: kendi gönderimim / Geliver / mağazadan teslim; sabit, Geliver teklifi ya da tablo; varsayılan depoda bölge yoksa kurulur; teslim alma ayrı "pickup" setinde), ürün JSON-LD'sinde `shippingDetails` (tablo varyantı fiyatlıyorsa: ücret, TR, kargoya verme ve taşıma günleri; tahmin yazılmaz), SEO `kargo_cümlesi` ("1–2 iş gününde kargoda."; varsayılan ürün açıklaması şablonunda olduğu için tüm ürünlerin açıklamasına girer). Panelde Ayarlar > Kargo: seçenekler kartı (ekle/düzenle/kaldır), teslim süresi ve ücret tablosu kartları. Karar: mağazadan teslim ayrı bayrak değil, bir kargo seçeneği türü (seçenek varsa sunulur). Koli birleştirme: satırlar tek kolide (hacim toplamı); taşıyıcı sınırını aşan sipariş K5'in kısmi gönderimiyle bölünür. Testler: HTTP 4, birim 6, panel 3 | K2 | — |
| K7 ✅ | F7.13 | **Bitti (2026-10-28 gece).** `POST /store/orders/:id/cancel` (oturum açmış müşteri, kendi siparişi; `order_cancel` hız profili): havale onayı ve süre dolumuyla aynı sipariş kilidi altında, paketlenmiş ya da kargoya verilmiş sipariş `orders.cancel_after_packing` (iade talebine yönlendirir), alınmış para kendi iade akışımızla geri verilir (tekrarında bir kez), sonra Medusa'nın iptali stoku ve bekleyen ödemeyi bırakır; başkasının siparişi 404. Karar: misafir siparişinin iptali oturum gerektirdiği için F9/F10'daki sipariş bağlantısıyla gelir. Testler: HTTP 3 (KK6) | — | KK6 |
| K8 ✅ | F7.9 | **Bitti (2026-10-28 sabaha karşı).** ADR-0032 (otonom kabul). `return-requests` modülü (sipariş başına tek açık talep, kısmi tekil indeks). Store: `POST/GET /store/orders/:id/returns` (oturum açmış müşteri, kendi siparişi; gönderilen kalemler, son teslimden 14 gün, önceki talepler düşülerek). Panel ucu: kuyruk, onay (Medusa'nın aşamalı iadesi, parselin çıktığı depoda; Geliver'le gittiyse iade gönderisi ve etiketi, kodu müşteriye), ret (müşterinin okuduğu not), teslim alma (Medusa teslim alma, stok geri girer) ve ardından para iadesi (kendi iade akışımız, kalem bazında, mağaza kaynaklı nedenlerde kargo dahil, `return<talep>` referansıyla bir kez; `return.refunded` olayı), başarısız iadede "tekrar dene", iade etiketi (personel, hassas okuma). Panelde Siparişler > İade talepleri (durum sekmeleri, işlemler, teslim alma penceresi). Testler: HTTP 2 (uçtan uca: talep → onay + Geliver kodu → teslim + stok → 180 TL iade; ret notu, fazla adet, kargoya verilmemiş), modül 1, birim 3, panel 1 | K3, K4 | KK3 (para iadesi + stok testli; iade faturası F8'de `return.refunded`'a bağlanır) |
| — | inceleme | **K5–K8 güvenlik incelemesi (2026-10-28 sabah, bağımsız ajan) ve düzeltmeler:**<br>• **Y1** müşteri iptali "Kargoya ver"le yarışabiliyordu (para geri, koli yolda): iptal (müşteri ve personel) artık hem kargo hem havale kilidini alıyor (`cancelLockKeys`); iptal iadesi yapılmış sipariş kargoya verilemiyor (`orders.ship_canceled_refund`).<br>• **O1** onay ve teslim alma durumu kilitten önce okuyordu: talep kilit altında yeniden okunuyor, durum yazımı beklenen durumdan; para iadesi de kilit altında, `return.refunded` bir kez.<br>• **O2** kargo ücreti iadesini müşterinin seçtiği neden belirliyordu: artık personelin teslim almadaki seçimi (`refund_shipping`, varsayılan hayır; panel mağaza kaynaklı nedende işaretli önerir).<br>• **O3** hasarlı ürün: sağlam ve hasarlı adet ayrı; hasarlı Medusa'nın `dismiss` yoluyla stoğa girmeden iade ediliyor (`damaged_items`, migration).<br>• **O4** Medusa'nın kendi iade/değişim/claim rotaları: `/store/returns` 404, admin değişiklikleri `returns.use_return_requests`.<br>• **O5** onaylanmış havalede müşteri iptali reddediliyor (`orders.cancel_contact_shop`).<br>• **O6** JSON-LD kargo ücreti yalnızca mağazada açık bir tablo seçeneği varken.<br>• **D1–D9:** olay bir kez; iade gönderisi kalemlerin çıktığı koliye; iade edilebilir adette Medusa'nın iade sayıları; teslim işaretlenmeyen koli 30 günde teslim sayılır; hata metinlerinde anahtar kontrolü; iade talepleri listesi denetimli okuma; bekleyen siparişi olan kargo seçeneği silinemiyor (`shipping.option_in_use`); iade talebine ayrı hız profili ve boş gövdeli uçlara Zod; testler (başkasının siparişi, eşzamanlı onay, Geliver reddinde Medusa iadesinin geri alınması).<br>• **Sunucuda denenecek:** Geliver `isReturn` kapıda ödemeli gönderinin tahsilatını iade gönderisine taşıyor mu (taşırsa kurye mağazadan tahsil eder); iade gönderisi açılırken sonucu belirsiz kalan çağrının etiketi. Testler: HTTP +6, birim +5, panel +1 | K5–K8 | — |
| K9 ✅ | F7.11 | **Bitti (2026-10-28 sabah).** Değişim (ADR-0032 §6): müşteri talebinde `kind: "exchange"` ve satır başına aynı ürünün başka varyantı (stokta, satışta); fark sunucuda (bugünkü fiyat eksi alış birim fiyatı) hesaplanıp saklanıyor, onayda yeniden hesaplanıyor (değiştiyse yeni değerle ret). Onay: Medusa değişimi (iade kalemleri, yeni kalemler Medusa fiyatıyla, 0 TL giden kargo ile stok ayrılır, onay), Medusa toplamlarıyla karşılaştırma, müşteri borçluysa personelin "farkı aldım" onayıyla tahsilat ödendi işareti, Geliver iade gönderisi ve etiketi. Teslim almada eski kalem stoğa döner, mağaza borçluysa fark iade edilir; yeni kalem iade gelmeden kargoya verilemez. Medusa'nın kendi değişim rotaları kapalı. Panelde kuyrukta "Değişim" rozeti, fark sütunu, onay penceresi (varyantlar, fark, tahsilat onayı). Testler: HTTP 4 (`exchanges`), birim 2, panel 2 | K8 | KK5 |
| K10 ✅ | F7.12 | **Bitti (2026-10-28 sabah).** ADR-0033 (otonom kabul). Paketlenmemiş siparişte: miktar (0 çıkarır), birim fiyat düzeltme, yeni varyant (Medusa fiyatıyla). Önizleme (`POST /admin/orders/:id/edit/preview`) Medusa düzenlemesini açar, farkı okur, vazgeçer. Düzenleme (`…/edit`) personelin gördüğü farkla çalışır (değiştiyse ret), müşteri borçluysa "farkı aldım" onayıyla Medusa tahsilatı ödendi işaretlenir, mağaza borçluysa fark hemen kendi iade akışımızla geri verilir; iptal kilitleri altında. Adres: Medusa'nın ucu personele, paketlenmeden önce ve Türkiye adres doğrulamasıyla. Medusa'nın `/admin/order-edits` uçları kapalı. Yalnızca kartla ödenip alınmış sipariş (kapıda ödeme ve havalede `orders.edit_payment_unsupported`). Düzeltilen fiyat Medusa'da sürüm kaydında: sipariş para hesabı `items.detail.unit_price`'ı da okuyor (bulunan hata). Panelde "Siparişi düzenle" penceresi (adet, fiyat, ürün ekleme, fark, tahsilat onayı) ve teslimat adresi düzenleme. Testler: HTTP 3 (`order-edit`), panel 2 | — | — |
| — | inceleme | **K9–K10 güvenlik incelemesi (2026-10-28 sabah, bağımsız ajan): 2 yüksek, 4 orta, 5 düşük; hepsi uygulandı ve testli.**<br>• **Y1** düzenleme önceki bir iadeyi ikinci kez ödeyebiliyordu: Medusa borç yokken yapılan iadeyi alacak satırıyla dengeliyor, aynı kalemi çıkaran düzenleme onu tekrar iade ederdi. Düzenleme dışı iadesi ya da açık bakiyesi olan sipariş artık düzenlenmiyor (`orders.edit_balance_open`); ödendi işaretlenen tahsilatın tutarı farka eşit olmalı (düzenleme ve değişim).<br>• **Y2** eksik teslim alınan değişim bütün yeni ürünleri gönderiyordu: değişim ancak istenen her birim gelince teslim alınıyor (`returns.exchange_incomplete`).<br>• **O1** düzenleme ve değişim farkının iadesi kalemlere dağıtılıyor, sonraki kalem iadesini eksiltiyordu: yeni `balance` iade modu hiçbir kaleme yazmıyor.<br>• **O2** indirimli satırda farklı fiyatlı değişim liste fiyatından hesaplanıyordu: indirimli satır yalnızca aynı fiyata değişiyor.<br>• **O3** onaylanmış değişimin farkı yeniden yazılabiliyordu: yeniden fiyatlama kilit altında ve yalnızca bekleyen talepte.<br>• **O4** iade penceresinden parası verilmiş birim değişimle bedavaya gidebiliyordu: bu birimler iade edilebilir adetten düşülüyor.<br>• **D1** tahsil edilen fark ayrı ödeme olduğu için iptal tek ödemeden iade edemiyordu: personel iptali her ödemeyi ayrı iade ediyor, müşteri iptali reddediyor. **D2** adres değişikliği iptal kilitleri altında. **D3** düzenlemeye tekrar anahtarı (Medusa düzenlemede `metadata` saklamadığı için personel notunda). **D4** tarih sıralaması zamanla. **D5** ters ibraz belgesi düzenlenmiş kalemi okuyor; düzeltilen fiyatın para hesabına yansıması testli.<br>Testler: HTTP `order-edit` 4, birim +4, panel güncellendi | K9, K10 | — |
| K11 | F7.14 | Doğrudan taşıyıcı adaptörü: ilk müşterinin anlaşmalı firması (**kullanıcıya soruldu**), ortak sözleşme paketi | K2–K4 | KK7 |
| K12 ⏳ | — | Kapanış: güvenlik ve kod incelemesi, KK işaretleri. **2026-10-28 öğlen:** K1–K10 için üç bağımsız güvenlik incelemesi yapıldı ve bulgular uygulandı. Yerelde tam doğrulama: HTTP 90 takım ve 478 test, birim 1696, panel 238, e2e 33 (sipariş düzenleme penceresinin erişilebilirlik kontrolü eklendi; ürün arama düğmesine etiket verildi). KK1, KK2, KK4, KK5 ve KK6 işaretli. KK3 iade faturası için F8'i, KK7 doğrudan taşıyıcı (K11) için kullanıcının kargo firması cevabını bekliyor; F7 bu ikisiyle kapanır | K1–K11 | — |

**F7 ara güvenlik incelemesi (K1–K4, 2026-10-28 gece, bağımsız ajan): yüksek yok; bulgular uygulandı.**
- M1: Medusa'nın fulfillment uçları (`/admin/orders/:id/fulfillments`, `/admin/fulfillments`) `qt_` ile başlayan `additional_data`'yı reddediyor (`shipping.additional_data_reserved`); sahte `qt_ship` testi.
- M2: kapıda ödemesi bekleyen sipariş taşıyıcıyla tek koli gider: kısmi ya da ikinci koli `shipping.cod_single_parcel` (kurye tutarın tamamını her kolide istemesin); test.
- M3: iptal edilen fulfillment'ın kolisi takipte `canceled` kapanır; başarısız sorgu kontrol zamanını yazar (yarım saat sonra yeniden); hiç sorgulanmamışlar önce; testler.
- L1: bildirimin dakikalık sınırı kilit altında okunup yazılıyor (Medusa'nın seçicili güncellemesi okuyup yazıyor, atomik değil); aynı anda üç bildirim tek okuma (test).
- L2: gönderici adımının telafisi yalnızca adres kimliğini taşır, hesabı yeniden okur.
- L3: etiket alınamazsa ya da sonraki adım düşerse Geliver'in etiket adresi fulfillment verisinden silinir (`forgetLabelSourceStep`).
- L4: "Kargoya ver" kilidi 180 sn; teklif beklemesi saatle sınırlı.
- L5: etiket dosya adı rastgele. L6: geri çekme hatası Geliver gönderi kimliği ve sipariş numarasıyla günlükte.
- L7: dağıtılmış ortamda test kolileri bildirimle değil yalnızca sorgu işiyle ilerler.
- Kabul edilen: I1 (Store'da fulfillment `data`'sı müşterinin kendi siparişinin Geliver kimliklerini taşır; etiket adresi saklanınca silinir), I2 (etiket yalnızca aynı köken yönlendirmesiyle iner; Geliver başka alana yönlendiriyorsa gerçek hesapta alan adıyla açılacak), I3 (bildirim cevabı işi bitirince; sınırlar yeterli).

### F6 görev planı (2026-10-27; Medusa 2.21.2 kaynağından doğrulandı, Context7 kotası dolu)
Doğrulananlar (medusa-researcher, GitHub v2.21.2):
- `pending_authorization` havale gibi yöntemler için: sipariş `awaiting` oluşur, `Payment` yok; `processPaymentWorkflow` sipariş varken oturumu yeniden yetkilendirir.
- `authorized` yakalanmamış `Payment` oluşturur (`capturePaymentWorkflow` sağlayıcının `capturePayment`'ini çağırır).
- `cancelOrderWorkflow` gönderisi olmayan siparişi kullanıcısız iptal eder ve rezervasyonları bırakır.
- `createOrderFulfillmentWorkflow` ödeme durumuna bakmaz.
- `addToCartWorkflow` varyantsız, `is_custom_price` kalem ekler; Store ucu bu kalemi değiştirebilir ve silebilir (ara katman gerekir).
- `GET /store/payment-providers` bölge bağından listeler; asıl zorlama bölge bağı.

| # | F6 | Görev | Bağımlılık | KK |
|---|---|---|---|---|
| W1 ✅ | F6.5 | **Bitti (2026-10-27 gece).** Havale/EFT sağlayıcısı (`pp_bank-transfer_bank-transfer`, `pending_authorization`), `bank_transfer` ayar bölümü (IBAN mod-97), Store başlatma ucunun çevrim dışı sağlayıcılara açılması, sepet tamamlama kuralının genişlemesi, `GET /store/payment/methods`'ta havale ve IBAN, panel Ayarlar > Ödeme > Havale/EFT sayfası, deneme sayfasında havale | ADR-0029 | — |
| W2 ✅ | F6.5 | **Bitti (2026-10-27 gece).** Havale onayı (panel sipariş sayfası "Havale geldi" → `processPaymentWorkflow`), süresi dolan havale siparişinin iptali ve stok iadesi (iş), kargo kuralı (yalnızca `captured` ya da kapıda ödeme `authorized`), dashboard ve sipariş listesinde "havale bekliyor" | W1 | Havale KK'sı |
| W3 ✅ | F6.6 | **Bitti (2026-10-28 gece).** Kapıda ödeme sağlayıcısı (`pp_cod_cod`, `authorized`), bayrak + şartlar (üst tutar, izinli kargo seçenekleri), ek ücret kalemi (sunucuda, korunan), tamamlamada ek ücret doğrulaması, panelde "tahsil edildi" (capture) ve mutabakat alanları, panel ayar sayfası | ADR-0029 | Kapıda ödeme KK'sı |
| W4 ✅ | F6.2–F6.4 | **Bitti (2026-10-28 gece).** Yönlendirici: birincil/yedek kart sağlayıcısı, sağlık durumu kötüyse yedek önde (`/store/payment/methods`), yedekle tamamlanan checkout testi; sözleşme paketinin çevrim dışı dalı (havale, kapıda ödeme) | W1, W3 | KK1, KK2 |
| W5 ✅ | F6.7 | **Bitti (2026-10-28 gece).** Ters ibraz: `chargebacks` modülü (sipariş, sağlayıcı, tutar, sebep, son tarih, durum açık/belge sunuldu/kazanıldı/kaybedildi), panelden elle kayıt, belge paketi (async iş, indirilebilir: sipariş özeti, ödeme kaydı, IP/zaman, sözleşme onayı ve kargo kanıtı oldukça), panel kuyruğu; kaybedilen ibrazda muhasebe kaydı F11'de | — | KK5 |
| W6 ✅ | — | **Bitti (2026-10-28 gece).** Kapanış: bağımsız kod ve güvenlik incelemesi, bulguların hepsi uygulandı (yukarıda "F6 W6"), tam yerel koşu | W1–W5 | — |

### F5 görev planı (2026-10-27; Medusa 2.21.2 kaynağı, dev.paytr.com ve docs.iyzico.com'dan doğrulandı)
Kararlar: ADR-0026 (barındırılan ödeme formu akışı; V1 başında kabul edildi), ADR-0027 (mağazanın sağlayıcı hesapları panelden, şifreli; kabul edildi, ADR-0002'nin yerini aldı). PayTR ayrıntıları `docs/entegrasyonlar/paytr.md`, iyzico ayrıntıları `docs/entegrasyonlar/iyzico.md`.

| # | F5 | Görev | Bağımlılık | KK |
|---|---|---|---|---|
| V1 ✅ | F5.1 + F5.2 | **Bitti (2026-10-27; env yerine panel, ADR-0027: `integration-credentials`, Ayarlar > Ödeme).** Ortak altyapı ve PayTR istemcisi: `packages/testing` workspace paketi (sahte PayTR sunucusu: token, durum sorgusu, iade, taksit oranları; bildirimi imzalayıp gönderen yardımcı; TR fixture fabrikaları, algoritmik geçerli sahte TCKN), `lib/clients` form-encoded gövde, `client.ts` (dört imza dokümandaki örneklerle test vektörlü; tutar biçimleri tek modülde: kuruş, `"11.97"`, `"10,8"`; Zod yanıtları; `err_no` → hata anahtarı), env şeması + `env.example` + açılış kontrolü (canlıda base URL yalnızca paytr.com), health kontrolü, redaksiyon (`hash`, `utoken`, `ctoken`) | — | — |
| V2 ✅ | F5.3 | **Bitti (2026-10-27; sahte PayTR'yle, gerçek test sunucuda).** Provider ve ödeme başlatma (+ ADR-0028; deneme sayfası V3'ten sonraya, bildirim ucuna ihtiyacı var ödeme deneme sayfası: `/dev/checkout`, yalnızca geliştirmede; sahte PayTR'ye tıklanabilir ödeme sayfası): `payment-paytr` (`pp_paytr_paytr`), medusa-config, bölgeye bağlama (bootstrap + mevcut bölgeler için migration-script; bağlama kümenin tamamını değiştirir, `pp_system_default` korunur). `lib/payments/basket` (saf, iyzico da kullanır): F4.7 paylarından kuruş satırları, kargo ayrı satır, 0 TL satırlar birleştirilir, kredi satırları dağıtılır, toplam = oturum tutarı. `POST /store/carts/:id/payment-session`: sepet hazır mı, alıcı, `req.ip`, dönüş adresi allowlist'i (`STORE_CORS`), `checkout` hız profili. Çekirdek `payment-sessions` ucu PayTR'ye 400. `initiatePayment`: `merchant_oid` türetme, oturumda yalnızca token/oid/beklenen tutar/para birimi/son geçerlilik. `deletePayment` hiç fırlatmaz. Store yanıtında `payment_sessions.data` ve `context` sızıntı testi | V1 | KK5 |
| V3 ✅ | F5.4 + F5.5 | **Bitti (2026-10-27; sahte PayTR'yle). Çift geri ödeme testi V5'e (iade orada).** Bildirim ve sipariş (ADR-0027: test modunda ödenen sipariş kalıcı işaret taşır, kargoya verilmesi engellenir): `webhook-events` modülü (sağlayıcı + olay anahtarı tekil, durum, deneme sayısı, kişisel verisiz özet, eski kayıt temizliği). `POST /hooks/paytr`: form gövde, `webhook` hız profili, imza sabit zamanlı, düz metin "OK"; işleme başarısızsa "OK" yok; bizim oturumumuza ait olmayan `merchant_oid`'e "OK" yok (paylaşılan canlı hesapta firmanın bildirimi PayTR'de bekler). `authorizePayment` = durum sorgusu (tutar, para birimi, test modu oturumla karşılaştırılır; `captured`). Sepet tamamlama sepet kilidiyle (Medusa `processPaymentWorkflow` mı kendi workflow'umuz mu, testle seçilir). Başarısız/zaman aşımı bildirimi sepeti bozmaz, sepet yeniden ödenebilir. `capturePayment`/`getPaymentStatus`/`retrievePayment`. Telafi zincirinde çift geri ödeme testi | V2 | KK2, KK3 |
| V4 ✅ | F5.6 | **Bitti (2026-10-27; sahte PayTR'yle).** Sahipsiz ödeme ve uzlaştırma: siparişe dönüşemeyen ödeme (silinmiş oturum, başka oturumla tamamlanmış sepet, tükenen stok, tutar farkı) otomatik iade + denetim kaydı + panel uyarısı; bildirimi gelmeyen açık oturumlar için zamanlanmış durum sorgusu işi (`outcome_unknown` kuralı) | V3 | KK6 |
| V5 ✅ | F5.7 | **Bitti (2026-10-27; sahte PayTR'yle).** İade ve iptal: `refundPayment` (`reference_no` = iade kimliği, belirsiz sonuçta `returns[]` eşlemesi, `000/007/008/009/010/011` anahtarları, `payment.data`'da iade kaydı, `idempotency_key`), `cancelPayment` = tam iade (iptal API'si yok). Test modunda yalnızca durum sorgusunda `test_mode=1` olan işlem iade edilebilir (canlı anahtarla firmanın gerçek ödemesi iade edilemez; testli). Satır bazlı iade defteri (F4.7'den devreden iki madde: serbest iade satırın kalanını düşürür; tutar iadenin kendi kalemlerinden, kilitli workflow'da). `POST /admin/orders/:id/refunds` (kalemler, denetim kaydı). Sipariş iptalinde tam iade testi. Panelde kalem seçerek para iadesi | V3 | KK4 |
| V6 ✅ | F5.8 | **Bitti (2026-10-27; sahte PayTR'yle; oran API erişimi gerçek hesapla doğrulanmadı).** Taksit: `GET /store/payment/installments` (varyant ya da sepet; tutar sunucuda), oranlar günde bir çekilip saklanır (Redis), `installment` hız profili; mağaza ayarı (`payments` bölümü: taksit açık/kapalı, en çok taksit → token isteği). Koşul: yalnızca iFrame kullanan hesabın oran API'sine erişimi test hesabıyla doğrulanır; yoksa PayTR'nin taksit tablosu kodu F18'e not edilir | V2 | — |
| V7 ✅ | F5.9 | **Bitti (2026-10-27; deneme sayfası ADR-0028 dahil).** Panel: sipariş detayında PayTR işlem kartı (işlem no, taksit, kart markası, son 4 hane, test modu rozeti ve test siparişinde kargo engeli, iade geçmişi), Ayarlar > Ödeme (durum, test modu, kopyalanabilir bildirim adresi, taksit ayarları), Entegrasyonlar sağlık kartı, kurulum sihirbazının ödeme adımı, dashboard'da hatalı/sahipsiz ödeme sayısı (docs/06); e2e duman + iki modlu axe + denge testi | V3, V5, V6 | — |
| V8 ✅ | F5.11 | **Bitti (2026-10-27; kullanıcının sandbox hesabı panelden bağlandı). CF/detail/refund/cancel çağrıları ve sahte uçları V9/V10'a, kullanıldıkları yere kaydı.** iyzico istemcisi ve sahte sunucusu: IYZWSv2 imzası (dokümandaki örnek değer ve SDK'nın `utils.js`'i test vektörü), yanıt imzası doğrulaması (sondaki sıfırları atan fiyat biçimi), hata modeli (`errorCode` → anahtar, "Retry" sütunu), hesap bilgileri panelden (ADR-0027: `integration-credentials`'a `iyzico` tanımı, sandbox/canlı seçimi, kayıttan önce doğrulama; yerel `.env`'deki sandbox anahtarları panele taşınır), health kontrolü, sahte iyzico sunucusu (CF initialize/retrieve, detail, refund, cancel, installment, webhook imzalayıcı) | V1 | — |
| V9 ✅ | F5.11 | **Bitti (2026-10-27; sahte iyzico + gerçek sandbox ödemesi; webhook kullanıcı kararıyla ertelendi).** iyzico ödeme akışı: `payment-iyzico` (`pp_iyzico_iyzico`), aynı Store ucu ve sepet kurucusu (kargo ayrı kalem, 0 TL birleştirme), alıcı (`identityNumber`: TCKN gönderilmez, iyzico'nun kabul ettiği yer tutucu; sandbox'ta doğrulanır), `POST /hooks/iyzico/callback` (form gövde, sonuç sorgusu + yanıt imzası, tutar eşlemesi, cart complete, allowlist'li dönüş yönlendirmesi), webhook (V3 imzası, `webhook-events`), `fraudStatus` 0 → bekleyen ödeme + sorgu işi, -1 → iade edilmiş sayılır; sahipsiz ödeme ve uzlaştırma V4 kalıbıyla | V3, V4, V8 | iyzico KK'sı (sandbox) |
| V10 ✅ | F5.11 | **Bitti (2026-10-27; sahte iyzico + sandbox'ta ölçülen iade).** iyzico iade, iptal, taksit ve panel: kalem bazlı iade v1 (itemTransactions ödeme verisinde, tutarın satır kalanlarına dağıtımı, 10245/10223), aynı gün iptal (yalnızca tam tutar; sonrası iade), taksit ucunun iyzico kaynağı (BIN'siz), panel işlem kartında iyzico alanları (paymentId, taksit, kart ailesi, son 4 hane, fraud durumu), Ayarlar > Ödeme'de sağlayıcı seçimi | V5, V6, V7, V9 | iyzico KK'sı (kısmi iade) |
| V11 ✅ | F5.10 | **Bitti (2026-10-27; `@sandbox` testleri sunucuya ertelendi).** Kapanış: sağlayıcıdan bağımsız sözleşme test paketi (başlatma, bildirim, yetkilendirme, iade, iptal, silme; iki sağlayıcı da geçer; F6.4 genişletir), `@sandbox` etiketli gerçek testler (iyzico sandbox; PayTR test penceresi), dashboard özetinin siparişli senaryo testi (F2'den devreden), ödeme modüllerinde kapsam ≥ %80, güvenlik ve kod incelemesi, ADR-0026 uygulama notu | V1–V10, test hesapları | KK1, KK7 |

Sıra: V1 → V2 → V3 → (V4, V5, V6) → V7 → V8 → V9 → V10 → V11. V8 V1'den sonra her an başlayabilir; iyzico sandbox hesabı erken açılırsa V8–V9 öne alınıp ortak altyapı iki sağlayıcıyla erken sınanır.

Medusa 2.21.2 bulguları (planı etkileyenler; kaynak GitHub v2.21.2 etiketi, çünkü `node_modules` okuması izin kuralıyla kapalı):
- **Sağlayıcının görebildikleri:** Sağlayıcı izole. Eline `amount`, `currency_code`, `data` ve `context` gelir; `context` giriş yapmış müşteriyi ve `idempotency_key`'i taşır, sepeti taşımaz.
- **Oturum verisi:**
  - Çekirdek oturum ucu istemciden serbest `data` alır. Sağlayıcı üzerine yazmadıkça bu veri oturumda kalır ve Store yanıtında görünür.
  - Uçta sahiplik kontrolü yok, workflow'da kilit ve hook yok.
  - `context` (müşteri e-postası, telefonu, adresleri) oturumda kalıcı tutuluyor; Store yanıtına çıkıp çıkmadığı doğrulanamadı (V2 testi).
- **Tutar kontrolü yok:** Medusa ödenen tutarı sepet toplamıyla hiçbir yerde karşılaştırmıyor.
- **Sepet değişince:** Sepet toplamı değişince oturumlar silinir, `updatePayment` çağrılmaz. `deletePayment` fırlatırsa sepet güncellemesi başarısız olur.
- **Sipariş ve yetkilendirme sırası:**
  - Sipariş yetkilendirmeden önce oluşur, yetkilendirme başarısızsa geri alınır.
  - Sağlayıcı `captured` dönerse tahsilat kaydı kendiliğinden açılır.
- **Mükerrer tamamlama:** Tamamlama sepet kimliğiyle kilitlenir (30 sn) ve `order_cart` kaydıyla korunur; ikinci çalıştırma aynı siparişi döner. Kilidi 30 sn bekleyen çalıştırma ise hata alır.
- **Hazır webhook ucu (`/hooks/payment/:provider`):** imza doğrulamadan 200 döner, işi 5 sn gecikmeli olayla en çok 3 denemede yapar, idempotency yok. Zaten tahsil edilmiş ödeme için `captured` eylemi sipariş işlemini çiftleyebilir (çıkarım).
- **İade:** Sağlayıcıya yalnızca `{ amount, data, context: { idempotency_key: refund.id } }` gider. Sağlayıcının her çıktısı `payment.data`'nın tamamının yerine geçer.
- **İptal:** Sipariş iptali tahsil edilmiş ödemede iade yoluna gider. Yetkilendirme telafisi ise tahsilata bakmadan `cancelPayment` çağırır; ardından iade adımı da çalışabilir (çift geri ödeme riski, çıkarım).
- **Bölgeye sağlayıcı bağlama:** sağlayıcı kümesinin tamamının yerine geçer; eksik ya da kapalı sağlayıcıda hata verir. Bootstrap mevcut bölgeye dokunmuyor.
- **Bildirim gövdesi:** Medusa gövdeyi varsayılan olarak `json`, `text` ve `urlencoded` biçimlerinde okur; PayTR'nin form gövdesi ek ayar gerektirmez. `/store` altı publishable key istediği için bildirim ucu `/hooks` altında.
- **Tahsil edilecek tutar:** `cart.total`, kredi satırları düşülmüş tutardır ve ödeme koleksiyonunun tutarına eşittir.

PayTR bulguları (planı etkileyenler):
- **Onay ve bildirim:**
  - Siparişi yalnızca bildirim onaylar.
  - Bildirim adresi hesap başına tek, panelden ayarlanır.
  - İmza yalnızca `merchant_oid`, `status` ve `total_amount`'u kapsar.
  - Mükerrer bildirim gelir; "OK" alınana kadar tekrarlanır.
- **Test modu:** ayrı test ortamı yok, test modu canlı anahtarlarla çalışır.
- **`merchant_oid`:** yalnızca harf ve rakam.
- **İade:** iptal API'si yok, iade tutar bazlı. İdempotency belgelenmemiş; `reference_no` durum sorgusunda döner.
- **Kayıtlı kart:** yalnızca Direkt API'de var; kapsam dışı.
- **Ters ibraz:** bildirimi yok (F6.7 elle kayıt).

1. **Kullanıcı:**
   - **F4 kararları:** ADR-0023/0024/0025 kabul edildi (2026-10-26). Dışarıda bekleyen: 30 gün kuralının hukukçu teyidi, hediye kartı vergisinin mali müşavir teyidi (docs/12).
   - **Push ve PR kararı:** Kullanıcı 2026-10-26'da push'u Claude'un önerisine bıraktı; F1, F2 ve F3 dalları push edildi. PR açılması ve birleştirme sırası (F1 → F2 → F3) kullanıcının kararı.
   - **Admin'de gözle kontrol:** Ayarlar > Özellikler, SEO, Ürün özellikleri, İşler; ürün sayfasındaki özellik kutusu.
     - Kullanıcı 2026-10-25'te iki hata buldu, ikisi düzeltildi.
     - Menü etiketleri ham anahtar görünüyordu: `translationNs` eksikti. Test artık bunu yakalıyor.
     - SEO sayfası açılışta çöküyordu: form, değerler gelmeden çiziliyordu.
     - Kalan kontrol: sayfa başlığı ve breadcrumb'da ham anahtar kalıyor mu?
   - **Canlı turlar:** `docs/16-proje-haritasi.md` sırasıyla (bölüm 9).
2. **Panel P1 (adr/0022):** tasarım sistemi ve token'lar, tema motoru (+ kontrast birim testleri), kabuk, giriş, dashboard, Ayarlar > Görünüm, backend `appearance` ayar bölümü, Playwright duman testi. Yeni bağımlılıklar docs/18 §1 (hepsi ≥14 gün; `pnpm add` onayı).
3. **F3 kararları: verildi (2026-10-25).**
   - ADR-0015..0020 kabul edildi.
   - Yeni bağımlılıklar onaylandı: `sharp` (T6), `yazl` (T15), Tiptap (T13). Her biri kendi oturumunda, exact sürüm ve ≥14 gün kuralıyla eklenir.
   - Redis kilit sağlayıcısı F3 T7'de bağlanır.
   - Canonical host boşken: resolve `canonical_host` ister, SEO ayarlarında uyarı gösterilir. Platform alt alan adı F16/F17'de gelir.
   - Görev sırası tablodaki gibi.
   - Playwright e2e altyapısı: kullanıcı 2026-10-26'da onayladı ve kuruldu (yukarıda).
   - Dev'deki `playwright-admin@example.com` kalıyor (kullanıcı kararı).
4. **Yerel dev DB:** F2'nin tüm migration'ları uygulandı. Dev dosyaları artık SeaweedFS'e yazılıyor.

### F4 görev planı (2026-10-26, Medusa 2.21.2 kaynak kodundan doğrulandı)
Kararlar: ADR-0023 (fiyat geçmişi, 30 gün kuralı), ADR-0024 (kupon ve kampanya kuralları), ADR-0025 (hediye kartı: resmi `@medusajs/loyalty-plugin`). Kullanıcı 2026-10-26'da önerilen seçeneklerle kabul etti ("önerinle devam et, sormana gerek yok").

| # | F4 | Görev | Bağımlılık | KK |
|---|---|---|---|---|
| U1 ✅ | F4.2 | `price-history` modülü (append-only): satıştaki fiyatın (calculated/original, herkese açık bağlam) varyant ve para birimi başına geçmişi. Yakalama: `pricing.price.*` ve `pricing.price_list.*` subscriber'ı (olayların çalıştığı testle kanıtlanır), saatlik zamanlama işi (liste başlangıç/bitişi olaysız), açılış bakiyesi migration script'i. `lib/pricing` 30 gün hesabı (saf, fixture'lı) | — | KK2 (yarısı) |
| U2 ✅ | F4.1 | Fiyat listeleri: panel ekranları (indirimli/geçersiz kılan liste, tarih aralığı, müşteri grubu, ürün fiyatları), denetim kaydı kapsamı, panel `nextPrices`'ın liste fiyatlarını korumasının doğrulanması (devreden iş) | — | — |
| U3 ✅ | F4.3 | İndirim gösterimi: Store API `price_display` (güncel, liste fiyatı, indirimden önceki fiyat, kural sürümü), JSON-LD `StrikethroughPrice` aynı kaynaktan, panelde ürün fiyat geçmişi ve indirim uyarısı | U1, U2 | KK2 |
| U4 ✅ | F4.4 + F4.6 | Kuponlar: kod normalleştirme (büyük harf, ASCII) + mevcut kodlar için migration, sepette tek kod kuralı (ayarla açılır), `coupon` hız profilinin üç Store ucuna bağlanması, kapsam (ürün/kategori/koleksiyon), minimum sepet (`item_total gte`, testle doğrulanır), kişi başı limit (`use_by_attribute`). Eşzamanlı limit KK testi | — | KK1 |
| U5 ✅ | F4.6 | Tek kullanımlık kodlar: `promotion.codes` işi (şablondan N promosyon, `limit: 1`, okunur kodlar, CSV sonuç, en çok 10.000), panelde üret ve indir | U4 | — |
| U6 ✅ | F4.5 | Otomatik kampanyalar: X al Y öde (`buyget`), sepette indirim (sipariş hedefli, minimumlu), kargo bedava eşiği (mağaza ayarı → düz fiyatlı kargo seçeneklerine `item_total gte` kurallı 0 TL fiyat) | U4 | KK3 |
| U7 ✅ | F4.7 | İndirim dağılımı ve iade tutarı: kalem başına indirim payı (Medusa ayarlamalarından, `lib/money`), ardışık kısmi iadelerde satırın kalanını tavan alan dağıtım (ADR-0010 "Sonuçlar"), `refundableAmount` (F6/F7/F8 kullanır) | — | KK4 |
| U8 ✅ | F4.8 | Hediye kartı ve mağaza kredisi: eklenti kurulumu (exact 2.21.2), `promotions.gift_cards` bayrağı, panelden kart oluşturma ve bakiye, checkout'ta kullanım, iadede mağaza kredisi. Satış ve e-posta F9'da | ADR-0025 | — |

Sıra: U1 → U3; U2 → U3; U4 → U5, U6; U7 ve U8 bağımsız. Önerilen başlangıç: U1, U4, U7 (KK taşıyanlar), sonra U2–U3, U5–U6, U8.

Medusa 2.21.2 bulguları (planı etkileyenler):
- Fiyat olayları yalnızca `{ id }` taşıyor; fiyat listesi workflow olayları 2.22.1'de geliyor; liste başlangıç/bitişi olay üretmiyor.
- `sale` listesinde `calculated` düşük olan, `original` varsayılan fiyat; birden çok `override` çakışırsa ilk eşleşen kazanıyor (çakışan liste uyarısı panelde).
- Kupon limiti: `registerUsage` transaction içinde promosyon ve bütçe satırlarını `FOR UPDATE` ile kilitliyor; aşımda `NOT_ALLOWED`. Kodlar harfe duyarlı; birleştirme alanı yok; toplu kod API'si yok.
- Kargo bedava eşiği: düz fiyatlı seçenekte `item_total gte` kurallı fiyat (KDV dahil, indirim sonrası).
- İade: Medusa birim başına `refundable_total` hesaplıyor; para iadesi `refundPaymentWorkflow` ile, tutarı çağıran veriyor.

### F3 görev planı (oturum büyüklüğünde; kullanıcı 2026-10-25 onayladı)
| # | Görev | Kapsam | Bağımlılık | ADR |
|---|---|---|---|---|
| T1a ✅ | F3.1 | Katalog uzantısı: MPN, durum, birincil kategori, halef ürün (link'li modül + widget). Fiziksel üründe ölçü/ağırlık kuralı. Türkçe handle, hook'larda yol sahipliği, sistem yolları rezervi | — | 0013 deseni |
| T1b ✅ | F3.2 | Fiziksel olmayan ürün (`kind`: dijital/hizmet; bayrak): kargo profili bağı kalkar, envanter kalemi "kargo gerekir" kapanır, yeni varyantlarda da. Ölçü kuralından muaf. Kargosuz checkout testi | T1a | — |
| T2 ✅ | F3.4a | `seo-meta` modülü ve link'ler, `PUT /admin/seo/:type/:id`, ürün/kategori widget'ı, denetim kaydı | — | 0015 |
| T3 ✅ | F3.5 | `seo-redirects`: kurallar, güvenli desen, zincir/döngü, slug ve halef değişiminde otomatik 301, `GET /store/seo/resolve`, 404 günlüğü + hedef önerisi, CSV içe/dışa. KK: 301 zinciri | T1 | 0017 |
| T4 ✅ | F3.4b | `lib/seo/resolve`, resolve yanıtında `seo` payload, versioned cache, URL deseni değişiminde toplu 301 (iş) | T2, T3 | 0015 |
| T5 ✅ | F3.11 | `brands` modülü, ürün ↔ marka, admin sayfası, Store marka ucu, SEO link'i | T2 | — |
| T6 ✅ | F3.3 | Görsel hattı: `image.process` işi, türevler, OG kırpma, alt metin, varyant görselleri. KK: EXIF temizleme | `sharp` onayı | 0016 |
| T7 ✅ | F3.7 | Stok: depo/seviye kurulumu, Redis kilit sağlayıcısı, iptal/iade geri dönüş testleri. KK: eşzamanlı checkout | — | 0020 |
| T8 ✅ | F3.8 | `stock-ledger`, düşük stok eşiği + `feed` uyarısı, ön sipariş bayrağı, uzlaştırma işi. KK: düşük stok uyarısı | T7 | 0020 |
| T9 ✅ | F3.12 | `lib/seo/jsonld`: ProductGroup/Product/Offer, BreadcrumbList, CollectionPage/ItemList, OnlineStore, Article; şema testleri. KK: payload + JSON-LD sözleşme testi | T1, T4 | — |
| T10 ✅ | F3.6 + F3.15 | Sitemap işi (debounce + günlük, 50.000'de bölme, görsel sitemap, S3), robots.txt üretimi ve AI ön ayarları, canonical host 301, staging `noindex`, imzalı önizleme, IndexNow. KK: sitemap/robots | T4, T5 | — |
| T11 ✅ | F3.13 | `seo-advisor`: kural motoru, skor, bulgular, tek tık düzeltme, widget + SERP önizleme, liste sütunu, yayın kapısı. KK: deterministik, p95 < 50 ms | T2, T9 | — |
| T12 ✅ | F3.14 | Mağaza geneli SEO denetim işi, 404 isabet listesi + "301 oluştur", mükerrer/öksüz/zincir listeleri. KK: 404 önerisi | T3, T11 | — |
| T13 ✅ | F3.16a | `content` modülü: sayfa ve blog, zengin metin (belge JSON + sunucu oluşturucu, Tiptap), kısa kodlar, Store API | T2, Tiptap onayı | 0019 |
| T14a ✅ | F3.16b | Facet landing sayfaları, özgünlük kapısı. KK: özgünlük < %30 | T10, T13 | — |
| T14b ✅ | F3.17 | Facet parametre kuralları (canonical, 301, noindex), robots engelleri. KK: robots facet parametrelerini engelliyor, landing yolunu engellemiyor | T14a | — |
| T15 ✅ | F3.9 | xlsx okuyucu + `yazl` yazıcı, TR şablonu, `catalog.import`/`catalog.export` işleri, kontrollü yükleme yolu, satır hata raporu, advisor ön özeti. KK: 1000 satır, formül kaçışı | T1, T2, T5, T8, `yazl` onayı | 0018 |
| T16 ✅ | F3.10 | Toplu düzenleme: fiyat, stok, yayın durumu, kategori, SEO şablonu, alt metin | T8, T15 | — |

Paralel zincirler:
- T1 → T3 → T4 → T9 → T11 → T12
- T2 → T4; T2 → T5; T2 → T13 → T14
- T7 → T8 → T15 → T16
- T6 bağımsız (`sharp` onayından sonra).
- T10, T4 ve T5'ten sonra gelir; sayfa ve landing bölümleri T13 ve T14'te eklenir.

Devreden işlerin F3 görevlerine dağılımı:
- **T1:** `claimPath`/`unclaimPath` ve slug `""` durumu (S7), Türkçe handle (F2 planlaması), düz desen sistem yolları (S7). `additional_data`: admin ürün formu göndermiyor (2.21.2 doğrulandı), alanlar widget + kendi route'umuzla yazılır.
- **T5 ve T14:** özellik görünürlüğü (`is_public`) ve Store yanıt filtresi (S11).
- **T7:** Redis kilit sağlayıcısı (F1, F2'den F16'ya bırakılmıştı; ADR-0020 öneriyor).
- **T15:** `presigned-urls` yerine kontrollü yükleme yolu, iş iptal ucu (S13).

F2 görev planı (S1–S13, hepsi ✅) ve görev ayrıntıları git geçmişinde: `git show 118e835:PROGRESS.md`.

## Açık sorular / bloklayıcılar
- [ ] **Soru (F7.14): ilk müşterinin anlaşmalı kargo firması hangisi?** Yurtiçi, Aras, MNG, PTT ya da Sürat'ten biri. Doğrudan taşıyıcı adaptörü (K11) bu cevaba bağlı; K1–K10 beklemeden ilerler. Firmanın API erişimi (müşteri numarası, test ortamı) de gerekecek (docs/12).
- [ ] **Soru (F8): e-fatura entegratörü hangisi?** İlk gerçek adaptör (E8) ve test hesabı buna bağlı; E1–E7 sahte entegratörle ilerler. Entegratörün toplu kayıtlı kullanıcı listesi vermesi gerekir (GİB listesi herkese açık indirilemiyor, ADR-0034 §3).
- [ ] **Soru (F8): mali müşavir doğrulaması.** TCKN'siz bireysel alıcıda varsayılan değer, indirim ve kargonun faturada gösterimi, hediye kartı/mağaza kredisinin KDV'si, faturalı siparişin iptalinde iptal mi iade faturası mı (docs/12). Varsayılanlar ADR-0034'te; doğrulanınca kesinleşir.
- [ ] **Soru (F8 + F7.7): PDF kütüphanesi (`pdf-lib`, MIT, bağımlılıksız) eklensin mi?** Fatura PDF'i ve toplu kargo etiketlerinin tek dosyada birleştirilmesi bununla çözülür. Onay gelene kadar fatura görüntüsü HTML.
- [ ] **Soru (F7.7): toplu etiketler tek PDF olsun mu?** Şimdi toplu "Kargoya ver" sonrası her siparişin etiketi ayrı indiriliyor. Tek dosyada birleştirmek için PDF kütüphanesi gerekir (öneri: `pdf-lib`, MIT, bağımlılıksız). Onaylarsan eklenir; Geliver'in toplu etiket ucu varsa (gerçek hesapla bakılacak) ona gerek kalmaz.
- [ ] **Geliver hesabı (F7; kullanıcı).** K1–K10 sahte Geliver'le yazılır (ödemelerdeki gibi). Gerçek hesapla deneme sunucuya çıkışta. Doğrulanacaklar: takip durum kodları (SDK listelemiyor), bildirim imzası (SDK'da uygulanmamış), kapıda ödeme tahsilatının raporlandığı alan, kapıda ödemeli gönderinin iadesinde (`isReturn`) tahsilatın iade gönderisine taşınıp taşınmadığı.
- [ ] **Gözden geçir: F6 kararları (2026-10-27/28 gece; kalıcı "önerileni uygula" talimatıyla):**
  - ADR-0029 (çevrim dışı ödemeler) ve ADR-0030 (ters ibraz kaydı, HTML belge paketi) otonom kabul edildi.
  - Kapıda ödeme ek ücret satırının başlığı Türkçe sabit ("Kapıda ödeme ücreti"); kiracı dili F19'da.
  - Ücret satırının kimliği oturum verisine konmadı: varyantsız + sunucu fiyatlı satır kuralı ve `qt_` metadata reddi aynı korumayı veriyor.
  - Havale süresi dolumu son 21 günün siparişlerine bakıyor (en uzun süre 14 gün + 7 gün iş kesintisi payı).
  - Ters ibraz yalnızca kartla alınmış ödemeye açılıyor; havale ve kapıda ödemenin itirazı bankayla değil mağazayla.
- [x] **Gözden geçir: ADR-0032 iade talebi (2026-10-28 sabaha karşı, otonom; kullanıcı 2026-10-28 öğlen onayladı):** kendi talep kaydımız + Medusa'nın aşamalı iadesi; süre son teslimden 14 gün (cayma süresi; mağaza ayarı ve istisnalar F13'te); mağaza kaynaklı nedenlerde (hasarlı, yanlış ürün, tarif edildiği gibi değil) kargo ücreti de iade ediliyor, diğerlerinde edilmiyor; iade kargo ücretini kimin ödediği F13'te ayar olacak.
- [ ] **Gözden geçir: F7 K6 SEO etkisi (2026-10-28 gece):** varsayılan ürün açıklaması şablonu `{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}` olduğu için `kargo_cümlesi` artık doldurulunca (Ayarlar > Kargo > Teslim süresi; varsayılan "1–2 iş gününde kargoda.") tüm ürünlerin meta açıklamasına bu cümle girer. İstemezsen şablondan çıkarılabilir (Ayarlar > SEO).
- [x] **Gözden geçir: F7 planlama kararları (2026-10-28 gece; kullanıcı 2026-10-28 öğlen onayladı):** ADR-0031 (Geliver sağlayıcısı, bildirim ipucu + API'den yeniden okuma, etiket özel depoda ve yalnızca personel ucundan, iç durum tablosu, Geliver SDK'sı yerine kendi istemcimiz).
- [ ] **F5 PayTR gerçek testi (V11; kullanıcı + firma).** Firmanın hesabı canlıda kullanılıyor; firma test modunda bağlanmayı kabul etti (kullanıcı 2026-10-27).
  - Bildirim adresi hesap başına tek olduğu için test, kısa bir pencerede yapılır:
    1. Firma, satışın düşük olduğu bir saatte PayTR panelinden bildirim adresini bizim tünel adresimize çevirir.
    2. Test yapılır.
    3. Firma adresi geri alır ve panelden "Duran Bildirimleri Yeniden Başlat"ı çalıştırır.
  - Pencere sırasında firmanın gerçek siparişlerine ait bildirimlere "OK" dönmüyoruz (ADR-0026); bu bildirimler PayTR'de bekliyor. Geri alındıktan sonra bekleyen bildirimlerin yeni adrese gidip gitmediği pencerede kontrol edilir.
  - Pencere gerektirmeyen yol: PayTR'den ayrı bir test mağazası istemek. Firma sorabilirse bu daha temiz.
  - Firmanın bilgileri yalnızca test penceresinde, kullanıcının yerel panelinden (Ayarlar > Ödeme) girilir; yerel veritabanında şifreli durur (ADR-0027). CI'a ve başka bir ortama girmez; test bitince "Bağlantıyı kaldır" ile silinir.
  - Bu anahtar firmanın gerçek ödemelerini iade edebilir. Kod, test modunda gerçek işlemi iade etmeyi reddediyor (V5).
  - V1–V10 bu hesap olmadan yapılır.
- [x] **iyzico sandbox hesabı:** Kullanıcı 2026-10-27'de açtı.
  - `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` ve `IYZICO_BASE_URL` `apps/backend/.env`'de; değerler okunmadı. V8'de (2026-10-27) anahtarlar panelden girildi ve doğrulandı; `.env`'deki satırlar artık kullanılmıyor, kullanıcı silebilir.
  - Aynı gün tek bir salt okunur çağrıyla denendi: BIN'siz taksit sorgusu `success` döndü, 6 satır. IYZWSv2 imzası dokümandaki formülle çalışıyor (`randomKey + path + JSON gövde`).
  - iyzico akışı V9'dan itibaren gerçek sandbox'a karşı denenir.
  - **Ertelendi (kullanıcı, 2026-10-27):** iyzico işyeri bildirimleri (webhook) ve V3 imzasının e-postayla açtırılması, gerçek firmayla yapılacak. V9 bildirimsiz ilerler: sonuç callback + CF retrieve ile alınır, kaçan callback'ler V4 kalıbındaki zamanlanmış sorguyla yakalanır. E-posta taslağı hazır (sohbette; adres, iki soru: yeniden deneme aralığı, fraud bildiriminin imzası, `identityNumber` yer tutucusu). Canlı başvuru (kullanıcı 2026-10-27'de başlattı) F5 kodunu bloklamıyor.
- [ ] **Gözden geçir: F5 V1'de verilen kararlar (2026-10-27; kullanıcının "panelden girilsin" talebi ve kalıcı "önerileni uygula" talimatıyla):**
  - **ADR-0027:** hesaplar `integration-credentials` modülünde; ayrı şifreleme anahtarı (`CREDENTIALS_ENCRYPTION_KEY`, PII'den ayrı, canlıda zorunlu, yerelde yoksa panel "kaydedilemiyor" der); gizli alanlar yalnızca yazılır, ekranda maske bile tutulmaz (yalnızca "kayıtlı"); denetimde sürüm numarası.
  - **Kayıttan önce doğrulama:** PayTR'ye ulaşılamazsa kayıt "doğrulanmadı" olarak yapılır (müşteri işini bitirebilsin); bilgiler reddedilirse kayıt yapılmaz.
  - **Yeni bağlantı test modunda başlar** (gerçek kart çekilmez); canlıya geçiş mağaza sahibinin kararı.
  - **Kalıcı silme:** "Bağlantıyı kaldır" kaydı soft-delete değil, tamamen siler (şifreli blok kalmasın).
  - **Uçlar personele açık**; rol kısıtı (yalnızca mağaza sahibi) ve gizli alan değişikliğine ikinci doğrulama F12.6'da.
  - **İstemci:** iade kendiliğinden yeniden gönderilmez; durum sorgusu ve taksit oranları tekrarlanır. Token reddinin metninden yalnızca alan adı tutulur.
  - **`packages/testing` CommonJS** (backend Jest'i ve tsconfig'i CJS); test sırları her çalıştırmada üretilir.
  - **Panel:** kartlar alt alta (yan yana düzende hata/uyarı kutularıyla yükseklik değişip boşluk kalıyordu); bildirim adresi panelin kendi adresinden (adr/0022 §4, aynı origin).
  - **Ayarlar > Ödeme, çok yöntemli (2026-10-27, kullanıcı: "birden fazla entegrasyon olacağı için ux/ui buna yönelik kurulmalı"; ilk PayTR tasarımını beğenmedi):**
    - Liste sayfası iki grup: "Kartla ödeme" (PayTR, iyzico) ve "Diğer ödeme yöntemleri" (havale/EFT, kapıda ödeme). Satırda ad, bir cümle açıklama, durum ve test modu rozeti, "Bağla"/"Yönet".
    - Henüz yapılmamış yöntemler "Yakında" rozetiyle listede, bağlantısız (mağaza ne geleceğini görsün). Kayıt defteri `features/settings/payment-methods.ts`; `upcoming: false` olan her yöntemin sayfası tipçe zorunlu.
    - Sağlayıcı sayfası `/settings/payments/$provider`; bilinmeyen ya da hazırlanmakta olan yöntem listeye döner. Durum rozetleri sayfa başlığında.
    - PayTR sayfası kurulum sırasıyla üç `FormSection` (docs/18 §7): mağaza bilgileri, bildirim adresi (kopyala), test modu ve canlıya geçiş. PayTR panelinde nereye tıklanacağı ilgili alanın yanında; ayrı "yapılacaklar" kartı kalktı. Düğmeler en altta.
    - Her sağlayıcının test/sandbox anahtarı `settings.test_mode` adını taşır (liste rozeti tek kuralla okur).
    - İki kart sağlayıcısı birden bağlıyken ödemede hangisinin kullanılacağı V10'da "Kartla ödeme" kartında seçilir.
    - Zil bildirimi sağlayıcının kendi sayfasına gider.
  - **İnceleme sonrası (güvenlik + kod):** gönderilen gizli alan kayıtlıyla karşılaştırılmıyor (eşitlik sızıntısı kapandı); ayarlar şifreli bloğun AAD'sinde (DB'den test modu çevrilemez); çalışan hesabın yerine PayTR'ye ulaşılamadığında doğrulanmamış bilgi yazılmıyor; "test et" koşullu yazıyor, reddedilen hesap `rejected`; her değişiklik yöneticilere bildirimle; sağlık ucu API anahtarına kapalı; kontrol 8 sn'de kesiliyor.
- [ ] **Gözden geçir: F5 V8 ve ödeme ekranı kararları (2026-10-27; kalıcı "önerileni uygula" talimatıyla):**
  - iyzico'da `test_mode` kimlik alanı: sandbox ↔ canlı geçişinde iki anahtar yeniden istenir ve yeni adreste doğrulanır.
  - Panel, sandbox kapalıyken `sandbox-` ile başlayan API anahtarını kaydetmeden önce reddeder (iyzico'nun anahtar biçimi sandbox'ta gözlendi, dokümanda yazmıyor).
  - iyzico bağlantı kontrolü 1 TL'lik BIN'siz taksit sorgusu (salt okunur); `1001` → API anahtarı, `1000` → gizli anahtar.
  - iyzico'nun bildirim adresi `/hooks/iyzico/webhook` olarak panelde gösteriliyor; uç V9'da yazılacak (PayTR'nin `/hooks/paytr`'si de V3'te).
  - Sahte sağlayıcı adresi (`PAYTR_BASE_URL`, `IYZICO_BASE_URL`) artık yalnızca staging ve canlıda reddediliyor; NODE_ENV tanımsız yerel CLI'da kabul (önce yalnızca development/test'ti).
  - Ortak bildirim metni "mağaza numarası değişti" → "başka bir hesap bağlandı" (iyzico'da sandbox → canlı da hesap değişimi).
- [ ] **Canlıya çıkış engeli (ADR-0027):** ödeme hesabı uçları her personele açık; rol kısıtı (yalnızca mağaza sahibi) ve gizli alan/test modu değişikliğinde ikinci doğrulama F12.6'da. O zamana kadar personeli olan mağaza ödemeyle canlıya alınmaz (F16 kontrol listesine).
- [ ] **Gözden geçir: F5 planlamasında verilen kararlar (2026-10-27; kalıcı "önerileni uygula" talimatıyla):** ADR-0002 maddesi ADR-0027 ile değişti (kullanıcı talebi); diğerleri inceleme bekliyor.
  - ~~**ADR-0002 kabul edildi:** sağlayıcı anahtarları env'de.~~ Yerini ADR-0027 aldı.
  - **ADR-0026 kabul edildi** (V1 başında):
    - Ödeme oturumunu kendi Store ucumuz açar; çekirdek oturum ucu barındırılan form sağlayıcılarına kapalı.
    - Medusa'nın `/hooks/payment/:provider` ucu yerine kendi bildirim ucumuz kullanılır; "OK" yalnızca sipariş açıldıktan sonra döner.
    - Siparişe dönüşemeyen ödeme otomatik iade edilir.
    - İade tutarını bizim workflow'umuz kalemlerden hesaplar.
  - **Kayıtlı kart (eski F5.11) kapsam dışı:** iki sağlayıcıda da satıcı tarafı kart saklama, kart verisini bizim tarafımıza getiriyor (SAQ-A dışı). docs/15 düzeltildi.
  - **iyzico'da `identityNumber`:** TCKN gönderilmez (veri en aza indirme); iyzico SSS'sinin izin verdiği yer tutucu gönderilir, sandbox'ta doğrulanır (V9).
  - **Test modunda iade koruması:** yalnızca test işlemleri iade edilebilir (V5).
  - **iyzico'da resmi SDK (`iyzipay`) kullanılmaz:** zaman aşımı, yeniden deneme ve yanıt imzası doğrulaması yok; eski bir HTTP kütüphanesi üzerinden yaklaşık 20 bağımlılık getiriyor. Kendi istemcimiz yazılır.
  - **Dokümanlar:** iyzico ve PayTR dokümanlarındaki doğrulanmamış ya da yanlış maddeler düzeltildi:
    - "merchant_oid = session id";
    - "tutarlar kuruş";
    - iyzico'da "gün sonu öncesi iptal" ve "2 ondalık string";
    - "taksit için BIN gerekir".
- [ ] **Kullanıcı kontrolü (panel):** Raporlar'ın dört sekmesi, Görünüm ayarlarının yeni düzeni, Kampanyalar > Hediye kartları (bayrak Ayarlar > Özellikler'den açılır), kod partisi "Durdur", müşteri sayfasında mağaza kredisi.
- [ ] **PR ve birleştirme:** F1 → F2 → F3 → F4 dalları push edildi; PR açılması ve birleştirme sırası kullanıcının kararı.
- [x] **F3 kararları:** Kullanıcı 2026-10-25'te önerilerin hepsini onayladı (ayrıntı "Sıradaki görev" madde 2).
- [x] **Gözden geçir: otonom oturumda S4, S7 ve S6 için verilen muhafazakâr kararlar:** Kullanıcı 2026-10-24 akşamı olduğu gibi kabul etti.
  - **S4:**
    - `safeFetch` varsayılan yönlendirme modu `same-origin`. Başka origin'e gitmek için `follow` açıkça istenmeli; webhook'larda `error`.
    - DNS c-ares ile yapılıyor; /etc/hosts okunmuyor.
  - **S7 piksel tablosu ve SERP sınırları:**
    - Tablo, Liberation Sans dosyası yerine Helvetica AFM değerlerinden kuruldu: Liberation yerelde yoktu, ağdan font indirilmedi. Değerler aynı.
    - SERP sınırları (başlık 600 px / 20 px, açıklama 920 px / 14 px) tahmindir; yalnızca uyarı üretmeli.
  - **S7 slug ve `url-registry`:**
    - `toSlug` sayısal sonuçta `""` dönüyor; F3.1 başka bir kaynak metin seçmeli.
    - Registry yalnızca iki harfli locale kabul ediyor (F19'a kadar). Path'in her segmenti geçerli slug olmalı.
    - `seo.path_taken` 400 dönüyor; 409 da düşünülebilir.
  - **S7, düz URL deseni:** Düz desen (`/{slug}`) için sistem yolları (`/arama`, `/sepet`, `/blog`) henüz rezerve değil; F3'te ele alınmalı.
  - **S6 istemci kapsamı:**
    - PUT ve DELETE varsayılan olarak yeniden deneniyor (REST semantiğine güven).
    - İstemci yalnızca JSON konuşuyor. PayTR form-encoded, e-fatura entegratörleri SOAP/XML olabilir; ilgili fazda genişletilir.
  - **S6 health:**
    - Kontroller provider'ın kendi `healthCheck()`'i yerine ayrı bir kayıt defterinde tutuluyor (modül izolasyonu; docs/03 F2.6 metninden sapma).
    - Redis kontrolü elle yazılmış bir RESP istemcisiyle yapılıyor; ioredis gelince değiştirilebilir.
  - **S6, HTTPS testi:** `openssl` gerektiriyor; CI imajında var.
  - **S7 migration:** `url-registry` migration'ı `db:generate` ile üretildi. `/yeni-modul` komutu "üretmeden önce sor" diyor; kullanıcının "izin isteme" talimatıyla soruldu sayıldı. DB'ye dokunan `db:migrate` çalıştırılmadı.
  - **Yeni i18n anahtarları:** `seo.template_invalid`, `seo.path_taken`, `seo.path_not_owned`, `seo.path_invalid`, `seo.locale_invalid`, `seo.entity_type_invalid`, `seo.entity_id_invalid`.
- [x] **Gözden geçir: F2 S2 muhafazakâr kararları:** Kullanıcı 2026-10-24 akşamı olduğu gibi kabul etti.
  - Loglarda ad, soyad, unvan ve posta kodu anahtarları da maskeleniyor; docs/04 yalnızca TCKN, telefon ve adresi sayıyor.
  - `body` anahtarı tamamen redakte ediliyor. Sağlayıcı yanıt gövdeleri loga girmiyor; S6 istemcisi hata ayıklama için `providerCode` gibi alanları ayrıca yazmalı.
  - Kodun fırlattığı ham ZodError 400 ve genel `errors.invalid_data` dönüyor. Medusa'nın davranışı issue metinlerini göndermekti.
  - Yeni i18n anahtarları: `errors.duplicate`, `errors.invalid_reference`, `errors.request_too_large`, `errors.invalid_request`. F18'de kataloğa girecek.
- [x] **Medusa'nın workflow çalıştırma ucu:** T15'te önerilen seçenek uygulandı, uçlar kapatıldı (karar 113). Medusa Admin'in bu uca ihtiyacı varsa kullanıcı söyler.
  - `POST /admin/workflows-executions/:workflow_id/run` admin kullanıcısına herhangi bir workflow'u doğrudan çalıştırtıyor.
  - Bu yol, route katmanındaki kontrollerin hepsini atlıyor: Türkçe adres, handle, yayın kapısı, ön sipariş koruması.
  - Öneri: panel bu ucu kullanmıyor; `requireFeature` deseniyle 404 dönecek şekilde kapatılsın. Medusa Admin'in bu ucu kullanıp kullanmadığı o geçişte doğrulanır.
- [ ] **Renovate GitHub App kurulumu (kullanıcı):** github.com/apps/renovate → `denizcanmaya/eticaret-platform`. Kurulunca onboarding PR'ı kontrol edilecek.
- [ ] **Takip edilen açıklar** (adr/0001 "Bilinen açıklar"):
  - zod → 4.6.6: 2026-10-25'ten itibaren uygun; doğrudan bağımlılık + admin-sdk override.
  - body-parser → 1.20.9 ve multer → 2.5.0: 2026-11-05'ten itibaren uygun.
  - @graphql-tools/utils 10.x: kabul edilmiş risk (yalnızca build sırasında).
- [ ] Medusa 2.22.x yükseltmesi: en erken 2026-11-06 (2.22.1 için 14 gün); ayrı PR.
- [ ] **F2 kararları** (ilgili oturumda onaylanacak; ADR-0010 S1'de kabul edildi):
  - ADR-0011 (S8): denetim kaydı HTTP sınırında; okuma kaydı yazılamazsa istek reddedilir (fail closed).
  - ADR-0012 (S9): bayraklar kodda tanımlı, DB'de yalnızca farklar; kapalı bayrakta 404.
  - ADR-0013 (S11): tipli EAV satırları ve ürün ↔ şablon/değer link'leri.
  - ADR-0014 (S13): iş kaydı modülü, event → subscriber → workflow; file-s3 F3.3'ten öne çekilir.
- [ ] **F2 yeni bağımlılıkları** (her biri kendi oturumunda `pnpm add` onayıyla; exact sürüm, ≥14 gün):
  - `pino` (S2) ✅ 10.4.0
  - `ioredis` (S3; framework'ün opsiyonel peer aralığı ^5.4.1)
  - `fast-xml-parser` ve `yauzl` (S5)
  - Görsel boyutu için kendi başlık okuyucumuz ya da `image-size` (S5'te karar)
  - S4, S6 ve S7 yeni bağımlılık getirmez.
- [ ] **Admin kullanılabilirliğinden devreden işler (docs/17):**
  - **F12.6:** Geliştirici ayarları yalnızca menüden gizli; adresle açılıyor. Gerçek kısıtlama rol modeliyle (Medusa RBAC, `MEDUSA_FF_RBAC`). `is_default` düzeni de her admin değiştirebiliyor.
  - **Dil:** İngilizce kullanan admin, dashboard'dan gelen hata cümlesini Türkçe görür; kullanıcı dili F19.
  - **Başlangıç:** Düşük stok kartı F3 T8'de. Kart bölgesi (`LayoutComposer`) F12.1'de. Yardım şeritleri ve KDV ipucu P2.
  - **Özet ucu testi:** Yalnızca siparişsiz durum HTTP testli; siparişli senaryo, sepet tamamlama yardımcısı gelince (F5) eklenir. Hesap kuralları birim testli.
  - **Dev DB:** Bootstrap yeniden çalıştırılırsa menü varsayılanı yazılır; mağaza adı `store-name="..."` ile verilmeli.
  - **F16 proxy:** `/admin` ve `/auth` hata gövdesi `Authorization`, çerez ve `Origin`'e göre değişiyor (dashboard cümlesi). Bu yanıtlar önbelleğe alınmamalı (`Cache-Control: no-store` ya da `Vary`).
- [ ] **F3 T1a'dan devreden işler:**
  - ✅ **T1b:** `setProductCatalogWorkflow` yazımlardan sonra yayın kuralını çalıştırıyor (yayındaki ürün fiziksele dönerken ölçü yoksa red, hepsi geri alınır; HTTP testli). Denetim anlık görüntüsünde `kind` var.
  - ✅ **T3:** Eski yollar çözümlemede sahibinin bugünkü yoluna gidiyor (kategori alt ağacı dahil). Kişiye özel ve denetim kayıtlı "serbest bırak" eylemi var.
    - Açık kalan: kayıt başına rezerve yol üst sınırı. Şimdilik yok; ✅ T12 denetimi 10 ve üstü eski yolu olan kayıtları listeliyor.
- [ ] **F3 T3'ten devreden işler:**
  - **F18 storefront:**
    - Resolve ve 404 bildirimi sunucudan çağrılırsa IP sınırları mağaza geneline iner; imzalı istemci IP'si ADR'siyle çözülmeli.
    - Resolve satış kanalına bakmıyor: başka kanaldaki yayındaki ürün de `entity` döner.
    - Büyük harf ve sondaki `/` gibi normalizasyon 301'leri edge'de yapılır; resolve normalize edilmiş yolu `path` alanında döndürüyor.
  - **F14 geçiş:** Sorgu dizeli eski adresler (`?id=`) ve regex kuralları desen diline çevrilir; çevrilemeyenler rapora düşer.
  - ✅ **T12:** 12 ay isabet almayan kurallar için "temizle" önerisi; 404 isabet listesi (önerili, tek tık 301).
  - **F18 (T10'dan):**
    - İmzalı önizleme bağlantıları (taslak sayfa, `noindex`).
    - Kenarda: canonical host 301'i; `indexing: false` iken `X-Robots-Tag: noindex`; `/robots.txt`, `/sitemap*.xml` ve `/{indexnow_key}.txt` vekilliği.
  - ✅ **T4:** URL stili değişiminde tüm yolları taşıyan iş; önce çakışma raporu, çakışma varsa iş başlamıyor.
  - **F3.17:** Facet landing ad alanı alt kategori yollarıyla aynı biçimde (docs/13 notu).
  - ~~Admin hata metinleri~~: çözüldü (adr/0021, dashboard'a Türkçe cümle).
  - **İçe aktarma (T15'e kadar):** Medusa'nın CSV'sinde handle'ı olmayan Türkçe başlıklı satır tüm chunk'ı `catalog.handle_invalid` ile reddettiriyor; hangi satır olduğu söylenmiyor.
  - **Yayın kuralı yarışı:** Aynı anda yayınlama ve varyant ölçüsünü silme ölçüsüz bir yayın bırakabilir; F7 kargo hesabı savunmacı kontrol yapar.
  - **Deploy adımı:** `claim-catalog-paths` her veritabanında bir kez çalıştırılır (F16 runbook).
- [ ] **Gözden geçir: F3 T1a muhafazakâr kararları:**
  - Ağırlık ve ölçü mağaza ayarındaki birimlerde (varsayılan g ve cm); seed ve testler bu birimlerle yazıldı. F7.2 dönüştürür.
  - Geçersiz GTIN kaydı reddedilmiyor (iç barkod olabilir); yapılandırılmış veriye ve feed'e girmiyor, danışman uyarır.
  - MPN varyant başına; durum ürün başına, varsayılan "yeni".
  - Taslak ürünün yeniden adlandırmada bıraktığı yol ve silinen taslağın yolları serbest bırakılıyor (URL hiç herkese açık olmadı); yayındaki ürününkiler rezerve kalıyor.
  - Silinen ürünün yolu yayındaysa rezerve kalıyor; aynı adla yeni ürün açılamıyor (T3'te serbest bırakma eylemi).
  - Kategori hook'u, alt ağaçta handle'ı F3.1 öncesinden kalma (geçersiz) bir kategoriyi atlayıp logluyor; doğrudan düzenlenen kategoride ise kaydı reddediyor.
- [ ] **F2 S4/S6/S7'den devreden işler:**
  - **F3.1:** Ürün, kategori ve koleksiyon workflow'ları `claimPath` çağırmalı ve compensation'da `unclaimPath` kullanmalı. Silmede `releasePathsOf`, redirect kalkınca `freePath`. Slug `""` gelirse başka bir kaynak metin seçilmeli.
  - **Ödeme fazları (F5, F6):** `outcome_unknown` gelirse yeniden denemeden önce sağlayıcıda durum sorgusu (conversationId) zorunlu.
  - **F11.7 tenant webhook'ları:** `safeTransport` + `hidePaths` + `redirect: "error"`.
  - **F16:** NAT64 kendi önekiyle kullanılıyorsa önek `address-policy`'ye eklenmeli. Egress proxy gelirse `safe-fetch`'in adres sabitlemesi yeniden düşünülmeli (proxy kendi DNS'ini yapar).
- [ ] **F2 S2'den devreden işler:**
  - **Erişim logu (F16, OAuth fazı):** Dev dışında Medusa'nın morgan logu logger'ı atlayıp stdout'a JSON yazıyor. Satırda tam URL (sorgu dizesi dahil), `client_ip`, user agent ve referrer var. Riskli içerik: admin aramalarındaki `?q=` (telefon, e-posta) ve ileride OAuth `code`/`state`. Reverse proxy log politikasıyla ya da Medusa'nın logunu kapatıp kendi erişim logumuzla çözülecek.
  - **Bizim katmanımızdan önce biten yanıtlar:** `authenticate`'in 401'i ve CORS reddi `X-Request-Id` taşımıyor; morgan satırında ham `x-request-id` kalıyor (JSON escape'li). Body parser ve auth aşamasında yazılan loglarda request context yok.
  - **İstek ID'sine güven (F16):** İnternetten gelen geçerli biçimli ID'ler kabul ediliyor, bu da korelasyonun taklit edilebilmesi demek. Edge proxy geldiğinde yalnızca proxy'den gelen ID'ye güvenilmeli.
  - **NODE_ENV (F16):** Express, tanımsız NODE_ENV'i development sayıyor; bizim handler'ımız dışına düşen hatalarda stack HTML'de görünebilir. Üretim imajında NODE_ENV zorunlu olmalı (F1'den devreden maddeyle birlikte).
  - **test-utils logları:** DB kurulumu Medusa'nın varsayılan winston reporter'ıyla yazıyor; yalnızca testte.
- [ ] **F2 planlamasında çıkan, sonraki fazlara devreden işler:**
  - **Redis modülleri (F16):** Prod için Redis event bus, workflow engine, locking ve caching modülleri gerekli. Bunlar olmadan server/worker ayrımı, restart sonrası iş devamı ve tek instance'ta zamanlanmış iş garantisi yok (ADR-0014). ADR-0020 locking'i F3 T7'ye çekmeyi öneriyor.
  - **trust proxy (F16):** Medusa `trust proxy = 1` ayarlıyor. Rate limit IP'si doğru olsun diye prod'da tam bir reverse proxy katmanı olmalı.
  - **Handle (F3.1):** Ürün, kategori ve koleksiyon handle'ları `lib/seo` slug üreticisinden verilir; Medusa'nın `toHandle`'ı Türkçe karakterleri ASCII'ye çevirmiyor.
  - **İçe aktarma (F3.9):** Medusa'nın ürün içe aktarması dosyayı presigned URL ile doğrudan depoya yükleyebiliyor. Bu yol `/admin/uploads` doğrulamasından geçmez; F3.9'da ele alınacak.
  - **Kısmi iade dağıtımı (F4.7 ✅, F6):** F4.7'de çözüldü. Birim iadesi kümülatif (`unitsRefund`), serbest tutar için `allocateCappedKurus`/`spreadRefund` var; kanıt `integration-tests/http/order-money.spec.ts`. F5/F6'ya devredenler:
    - Satır başına serbest iade defteri tutulmalı. İyi niyet iadesi gibi tutarlar bir satıra yazıldıktan sonra o satırın birim iadesi, satırın kalanıyla sınırlanmalı.
    - İade tutarı, iadeyi teslim alan iş akışının içinde, o iadenin kendi kalemlerinden hesaplanmalı. Böylece iki yönetici aynı anda hesaplayamaz.
    - iyzico 0 TL'lik sepet kalemini kabul etmiyor. Tam indirimli ya da "X al Y öde"deki bedava satırın `net`'i 0 olabilir; sepet kurulurken bu satırlar ayrılmalı.
  - **S3/S5'ten devreden (F16, F18, S13):**
    - F16 proxy: `/static`, `/app`, 401 ve preflight yanıtlarına güvenlik header'ları; `/static` için `sandbox` CSP; tek hop XFF şartı ya da `TRUSTED_PROXY_HOPS`.
    - F18: Medusa store preflight'ında publishable key istiyor (izinli origin de 400 alıyor). Tarayıcıdan doğrudan store çağrısı için çözülmeli. Sunucudan login proxy'leyen storefront için imzalı istemci-IP ADR'si.
    - S13: `presigned-urls` yolu için uzantı/MIME allowlist'i ve worker'da doğrulama; CSV dışa aktarımın ayırıcısı ve BOM'u.
    - Hesap kilidi ve IP'den bağımsız kimlik sınırı (docs/04 "artan gecikme + kilit").
    - ~~Admin, çekirdek dashboard'un çevirmediği anahtarları ham gösteriyor~~: çözüldü (adr/0021).
  - **S13'ten devreden:**
    - F16: private bucket/politika ve kanarya testi, `NODE_ENV=production`, Redis event bus + workflow engine + locking (worker ayrımı, restart sonrası devam).
    - file-s3 `cache_control` varsayılanının private sonuçlara etkisi.
    - Yetim dosyalar için bucket lifecycle kuralı.
    - İptal ucu (F3.9).
    - İsteğe bağlı `TEST_S3_*` testi (private nesnenin imzasız 403'ü).
  - **S11'den devreden:**
    - Özellik görünürlüğü (`is_public`) ve Store yanıt filtresi.
    - (ürün, tanım) için DB tekillik indeksi.
    - `additional_data` ile ürün formundan kayıt (F3.9).
    - Şablon güncellemesinde soft-delete edilen değerlerin link satırları kalıyor (zararsız; temizlik işi F13).
  - **S10'dan devreden:** Playwright e2e altyapısı 2026-10-26'da kuruldu (docs/07 "E2E (panel)"); yeni ekranlar duman listesine eklenir.
  - **S9'dan devreden:**
    - `canonical_host` alan adı sahiplik doğrulaması (F16/F18).
    - JSON-LD ve meta çıktısında kaçışlama (docs/13, F18).
    - İyimser kilit (eşzamanlı iki admin kaydı; F12.4).
    - Store bölümü için admin sayfası (S10 kapsamı features + SEO).
    - Medusa modül kapanış kancası belgelenmediği için Redis istemcisi tembel açılıyor ama kapatılmıyor; bayrak okuyan bir `medusa exec` script'inin çıkışı izlenmeli.
  - **Storefront hata anahtarları (F18):** `errors.*`, `billing_profile.*`, `tr_address.*` gibi i18n anahtarları henüz bir çeviri kataloğunda değil. Storefront'la birlikte `packages/types`'a taşınır.
- [ ] **F1'den devreden işler:**
  - Kargo KDV oranı için `shipping_option` vergi kuralı, mali müşavir onayından sonra (docs/12).
  - Soft-delete edilmiş fatura profillerini kalıcı silme / KVKK imha işi (F13).
  - Locking modülünün Redis sağlayıcısına geçmesi ve üretim imajında `NODE_ENV=production` (F16).
  - Telefon E.164 normalizasyonu yalnızca Store API yolunda yapılıyor; workflow ile yazılan sepet adresi ham telefonu saklar (doğrulama iki yolda da var).
  - `tr-address` ve fatura profili Store API sözleşme tipleri `packages/types`'a (F18).
  - Tam vergi kimliğini gösterme: yetki (F12) ve okuma audit log'u (F2.5).
- [ ] Çok dilli içerik: Medusa Translation modülü feature flag arkasında, şimdilik kapalı. Ana içerik Türkçe; çok dil F19.
- [x] Medusa'da CSRF koruması yok → F2 S3'te Origin kontrolü + JSON gövde şartı (ADR-0004 F2.10 eki).
- [ ] Trivy imaj taraması: üretim Dockerfile'ı ile birlikte F16'da.
- [ ] GitHub Actions dakikaları: private repo, ücretsiz kota 2000 dk/ay; ilk ayda izlenecek.
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)

## Faz durumu
| Faz | Durum |
|---|---|
| F0 Repo & araçlar | ✅ |
| F1 Medusa çekirdek + TR lokalizasyon | ✅ |
| F2 Platform çekirdek modülleri | ✅ |
| Panel P1–P6 (adr/0022) | ⏳ P1–P4 ekranları yazıldı (kullanıcı kontrolü bekliyor) |
| F3 Katalog, SEO motoru ve stok | ✅ (KK'lar işaretli; PR ve birleştirme kullanıcının kararı) |
| F4 Fiyatlandırma ve promosyon | ✅ (U1–U8; KK1–KK4; kapanış incelemesi 2026-10-27) |
| F5 Ödeme: PayTR + iyzico (+ ortak ödeme altyapısı) | ✅ (V1–V11; gerçek sağlayıcı testleri sunucuya çıkışta) |
| F6 Ödeme: havale/EFT + kapıda ödeme + yönlendirici + ters ibraz | ✅ (W1–W6; KK1–KK5; 2026-10-28) |
| F7 Kargo, sipariş operasyonu, iade ve değişim | ⏳ K1–K10 bitti (2026-10-28); K11 kullanıcı cevabı bekliyor, K12 kapanış |
| F8 E-fatura | ⬜ |
| F9 Bildirimler (e-posta/SMS) | ⬜ |
| F10 Müşteri hesabı, etkileşim, pazarlama ve SEO ölçümü | ⬜ |
| F11 Raporlama, muhasebe ve dış API | ⬜ |
| F12 Admin genişletmeleri (ekranlar panel hattı P5'te) | ⬜ |
| F13 Uyum & yasal özellikler | ⬜ |
| F14 Veri taşıma ve geçiş araçları | ⬜ |
| F15 Sertleştirme (güvenlik/dolandırıcılık/yük) | ⬜ |
| F16 Dağıtım & tenant işletimi | ⬜ |
| F17 Control plane | ⬜ |
| F18 Storefront & temalar (sonraki aşama) | ⬜ |
| F19 Genişleme: pazaryeri, B2B, yurt dışı, ajan ticareti (sonraki aşama) | ⬜ |

Durum: ⬜ başlamadı · ⏳ devam · ✅ bitti · ⛔ bloklu
