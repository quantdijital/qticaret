# Uygulama planı: BasitKargo ve BirFatura

> **2026-11-16:** BasitKargo için sahibin "gerek yok" notu var (teyit bekliyor); bu belgenin BasitKargo dilimleri askıda. BirFatura A yolu sahibin onayını bekliyor.

> Durum: **öneri, kod yok** (2026-11-16). Sahibin isteği: "kargo entegrasyonunda https://basitkargo.com/api entegrasyonu, fatura tarafında https://birfatura.com/ entegrasyonlarını da yapmalıyız." Ayrıntılar: `docs/entegrasyonlar/basitkargo.md`, `docs/entegrasyonlar/birfatura.md`.

## Yol haritasındaki yeri

- **F7 ve F8 bitti** (PROGRESS.md): F7 Geliver + Aras + Yurtiçi (F7.14 dahil, KK hepsi işaretli); F8 Paraşüt + dış program/elle işleme (iade belgesi E6 ve değişim belgeleri dahil kapandı; yalnızca KK4 "kendi UBL'imiz" sonraki aşama). Eski "F8 askıda" notu (F11 kapanışı, 2026-10-29) artık geçerli değil: F8 2026-10-30'da Paraşüt yoluyla kapandı.
- Bu iki iş yeni faz değil, **F7.14 ve F8.2'nin ek sağlayıcıları**. Mevcut soyutlamalara oturur: taşıyıcı kaydı (ADR-0035 §2) ve fatura sağlayıcısı ayarı (ADR-0034 §1: "doğrudan entegratör … aynı arayüze yeni bir sağlayıcı olarak eklenir").
- Faz sırası (2026-11-10): F18 kapat (e2e) → F17 (bitti) → F16 en son. Bu işler F16'dan önce, F18 e2e ile sırası sahibe sorulur (aşağıda). Her ikisinin de gerçek hesapla denemesi sunucuya çıkışta (F16) yapılır; Paraşüt ve Aras'ta da öyle.

## Mevcut sağlayıcıların ölçüsü (2026-11-16, `dev` @ 194ba38e)

| Sağlayıcı | Çekirdek (`lib/…`) | Birim test | Medusa sağlayıcısı | Sahte sunucu | HTTP testi | Dokunduğu dosya |
|---|---|---|---|---|---|---|
| Geliver (REST aracı) | `lib/shipping/geliver` 11 dosya, 852 satır | 242 | `modules/fulfillment-geliver` 5 dosya, 292 | `packages/testing/src/geliver` 6 dosya, 903 | `geliver-shipping`, `geliver-tracking` | — |
| Aras (SOAP) | `lib/shipping/aras` 5 dosya, 442 | 304 | 2 dosya, 158 | 2 dosya, 382 | `aras-shipping` | — |
| Yurtiçi (SOAP + kendi etiketimiz) | `lib/shipping/yurtici` 7 dosya, 850 | 531 | 2 dosya, 213 | 3 dosya, 530 (+ `dev/yurtici.ts` 47) | `yurtici-shipping` 359 | **81 dosya** "yurtici" geçiyor (panel ayar sayfası 148 + 64, sağlık 26, hata metinleri, ortam, kargo seçeneği doğrulayıcısı, durum okuyucu, vitrin taşıyıcı sayfaları…) |
| Paraşüt (REST, OAuth) | `lib/invoicing/parasut` 8 dosya, 917 | 454 | — (`InvoiceProvider`) | `packages/testing/src/parasut` 8 dosya, 1355 | `einvoice-*` (10 dosya) | 65 dosya |

Ortak altyapı hazır ve yeniden yazılmaz: `lib/shipping` (koli, desi, tablo fiyatı, alıcı doldurma, etiket sayfası, rezervasyon) 3086 satır; `lib/clients` (zaman aşımı, yeniden deneme, redaksiyon) 1348; `lib/invoicing` (taslak, bekletme kuralı, değişim, iade) 2048; `modules/einvoice` 1162; `workflows/einvoice` 1901 (geri yazma `write-back.ts` 229); `integration-credentials` 1495; ortak sözleşme testi `carrier-contract.spec.ts` 324.

**Sonuç:** Yeni bir REST kargo sağlayıcısı Geliver'in boyutundadır: ~1.000 satır çekirdek + ~300 satır sağlayıcı + ~800 satır sahte + ~700 satır test + ~300 satır panel + ~30 küçük dokunuş (kayıtlar, metinler, ortam). BirFatura çekme yolu daha küçüktür, çünkü kuyruk, taslak ve geri yazma hazır: ~600 satır uç + eşleme, ~500 satır sahte istemci, ~600 satır test, panel ~200.

## Dilimler

Her dilim `dev`'den açılan kendi dalında, kendi PR'ıyla, bağımsız teslim edilir. "Güvenlik incelemesi" = CLAUDE.md PR kuralı (`security-reviewer`, bulgular PR'a).

### BasitKargo

| Dilim | İçerik | Kabul ölçütü | Test | Güvenlik incelemesi |
|---|---|---|---|---|
| **K1. İstemci, hesap, sahte** | `lib/shipping/basitkargo` (istemci: Bearer, `Idempotency-Key`, `429`/`Retry-After`, redaksiyon; eşleme; durum), `integration-credentials` `basitkargo` (jeton, adres, marka, varsayılan taşıyıcı), sağlık kontrolü (`GET /firm/status`), `BASITKARGO_BASE_URL` (canlıda red), `packages/testing/src/basitkargo` + `pnpm dev:basitkargo` | Panelde jeton girilince doğrulanıyor, yanlış jeton alan bazında reddediliyor; sağlık sayfasında görünüyor | Birim (istemci, eşleme, durum), HTTP (`integration-credentials` BasitKargo) | Evet (kimlik bilgisi) |
| **K2. Sağlayıcı ve kargoya verme** | `modules/fulfillment-basitkargo` (`basitkargo_basitkargo`; teklif/tablo/sabit seçenekleri, `calculatePrice`, iki adımlı `createFulfillment`, `cancelFulfillment`), taşıyıcı kaydı (`carriers.ts`, `carrier-status.ts` okuyucu, `carrierNameOf`), kargo seçeneği doğrulayıcısı, panel taşıyıcı sayfası | Sepette teklif fiyatı; kargoya ver → barkod; etiket alınamazsa barkod iptal + taslak silme; sonucu bilinmeyen barkodda tek barkod; iptal ücret iadesi; ortak sözleşme paketi 4 sağlayıcıda geçiyor | HTTP `basitkargo-shipping`, `carrier-contract` | Evet (kargo, para) |
| **K3. Etiket** | SVG → PDF (önce BasitKargo'dan PDF/ZPL sorulur; yoksa yeni bağımlılık, sahip onayıyla), SVG temizleme (dış kaynak yok), toplu yazdırmada birleşme | Etiket seçilen ölçüde PDF; toplu yazdırmada diğer taşıyıcılarla tek dosya; dış kaynaklı SVG reddediliyor | Birim (çeviri, temizleme), HTTP (etiket ucu yetkisiz 401) | Evet (dosya işleme, SSRF) |
| **K4. Takip ve web kancası** | `POST /hooks/basitkargo` (ipucu modeli, `webhook` hız profili), sorgu işi okuyucusu, panelde BasitKargo'ya yazılacak adres | Bildirim gönderiyi yeniden okutuyor, takip edilmeyen/bitmiş/yakın zamanda okunmuş gönderide işlem yok; bildirim + sorgu aynı anda tek olay | HTTP (`geliver-tracking` kalıbı) | Evet (web kancası) |
| **K5. İade kodu** | İade onayında taşıyıcının iade kodu (`GET /v2/order/return/barcode/{barcode}`); `approve-return.ts` ve `handover.ts`'teki "yalnız Geliver" sabitinin taşıyıcı kaydına taşınması | BasitKargo'yla giden siparişin iadesi onaylanınca kod müşteriye gidiyor; teslim alma takipten görülüyor; Geliver davranışı değişmiyor | HTTP `return-requests` genişler | Evet (iade, para) |
| **K6. Kapıda ödeme mutabakatı** (isteğe bağlı) | `codInfo.collectionStatus`/`releaseDate` panelde gönderi ayrıntısında; tahsil edilmeyen için uyarı | Durum ve tarih görünüyor | Birim + panel | Hayır (salt okuma) |

### BirFatura

| Dilim | İçerik | Kabul ölçütü | Test | Güvenlik incelemesi |
|---|---|---|---|---|
| **F0. Sorular ve test hesabı** | `birfatura.md` "Açık sorular" BirFatura'ya; test hesabı; cevaplar belgeye. ADR yazılır (aşağıda) | Çekme zamanlaması, yol önekli adres, tekrar faturalama, ETTN/belge tipi cevaplı | — | — |
| **F1. Çekme uçları** | `INVOICING_PROVIDERS`'a `birfatura`; token üretme/yenileme (sahip + yeniden doğrulama, bir kez gösterim); `/hooks/birfatura/api/{orderStatus,paymentMethods,orders,orderCargoUpdate,invoiceLinkUpdate}`; taslak → `Orders[]` eşlemesi; geri yazmanın boş belge tipini kabul etmesi; PDF indirme (izinli alan adı); `einvoice_pull` hız profili; denetim kaydı | Bekleyen satış faturası BirFatura'nın şemasıyla birebir dönüyor; `invoiceLinkUpdate` kaydı kesildi yapıyor, PDF depoda, müşteriye e-posta; yanlış token 401; sağlayıcı kapalıyken 404; iade belgesi hiç dönmüyor | Birim (eşleme, token, tarih), HTTP `einvoice-birfatura`, belge örnekleriyle sözleşme testi | **Evet, zorunlu** (dışarıya kişisel veri veren gelen uç, kimlik doğrulama) |
| **F2. Panel** (sahte BirFatura sahibin kararıyla düştü, 2026-11-18: deneme test hesabıyla, tünelden) | Ayarlar > E-Fatura'da BirFatura seçimi, site adresi ve bağlantı şifresi, son çekme bilgisi; sipariş fatura kartında BirFatura faturası ve iptal işareti | Test hesabıyla sipariş → BirFatura çekiyor → fatura kartında numara ve PDF; hiçbir yerde "sahte/test" yazısı yok | Panel birim testi; test hesabıyla elle deneme | Hayır (F1 inceledi) |
| **F3. İtme sağlayıcısı** (koşullu) | Yalnızca BirFatura e-Arşiv internet satışı bilgilerini modelde taşıdığını ve kendi e-Arşiv'imizin `IPTAL`'ini doğrularsa: `lib/invoicing/birfatura` `InvoiceProvider` (ETTN önce, `GetUserPK`, `SendBasicInvoiceFromModel`, durum sorgusu, PDF, iptal), anahtarlar `integration-credentials`'ta, sahte OutEBelgeV2 | Paraşüt'ün F8 KK'larının aynısı (e-Arşiv ve e-Fatura, mükerrer yok, kapalıyken bekleme ve yeniden deneme, iptal sınırı) | Paraşüt testlerinin karşılığı | Evet (fatura, kimlik bilgisi) |

## Sıra önerisi

1. **F0 (BirFatura soruları) hemen**, kod beklemeden: cevap süresi bizim elimizde değil; F1'in iki tasarım noktası (yol önekli adres, tekrar faturalama) cevaba bağlı.
2. **BasitKargo K1 → K2 → K4 → K3 → K5.** BasitKargo önce, çünkü belgesi tam ve herkese açık, mevcut soyutlamaya hiçbir karar beklemeden oturur, ilk gerçek denemesi (taslak + sil) ücretsiz. K3 (etiket) BasitKargo'nun PDF/ZPL cevabını bekleyebilir; o zamana kadar K2 SVG'yi saklar, panel tek tek indirir (toplu birleştirme K3'te).
3. **BirFatura F1 → F2**, F0 cevapları gelince (en geç BasitKargo K2 bitince).
4. **K5, K6, F3** ihtiyaç ve cevaplara göre.

## ADR

- **ADR gerekir: BirFatura entegrasyon yönü (çekme mi itme mi) ve dışarıya kişisel veri veren gelen sipariş ucunun güvenlik modeli** (sunucunun ürettiği token, saklama biçimi, hız sınırı, denetim kaydı, adres/yönlendirme). ADR-0034'ün sağlayıcı listesini ve §9 geri yazma şemasını (boş belge tipi) değiştirir. Numara `adr/README.md`'de ayrılır, `dev`'e push edilir (CLAUDE.md ADR kuralı).
- **BasitKargo için yeni ADR gerekmez**: ADR-0031 ve ADR-0035'in taşıyıcı kaydına bir sağlayıcı daha; ADR-0035'e ek yeter. Etiket için yeni bağımlılık seçilirse kararı o ekte yazılır (ADR-0035'teki `pdf-lib` onayı gibi).

## Sahibin sağlaması gerekenler

- **BasitKargo:** mağaza adına hesap (ücretsiz), gönderici adresi, API jetonu (panelimizden girilir), web kancası adresinin BasitKargo paneline yazılması, ilk gerçek deneme için az bir bakiye. Desteğe soruların gönderilmesi (`basitkargo.md` "Açık sorular"; e-posta taslağını hazırlarız).
- **BirFatura:** `entegrasyon@birfatura.com`'dan test hesabı; soruların gönderilmesi (`birfatura.md`); canlıda mağazanın BirFatura'da e-Fatura/e-Arşiv hesabı, web satışı serisi, kontör.
- **Kararlar:** (1) BirFatura'da A (çekme) ile başlamak; (2) BasitKargo etiketi için gerekirse yeni bağımlılık; (3) bu işlerin F18 e2e kapanışına göre sırası.
- Hiçbir anahtar, jeton ya da şifre belgeye, koda, loga ya da sohbete yazılmaz; yalnızca panelden girilir.

## Kaba süre

| İş | Süre (iş günü) |
|---|---|
| BasitKargo K1 | 1,5–2 |
| BasitKargo K2 | 2–3 |
| BasitKargo K3 | 1–1,5 (bağımlılık kararıyla) |
| BasitKargo K4 | 1 |
| BasitKargo K5 | 1,5–2 |
| BasitKargo K6 | 0,5 |
| **BasitKargo toplam** | **~7–10** (K1–K4 ile kullanılabilir hâl ~5,5–7,5) |
| BirFatura F0 + ADR | 0,5 (+ BirFatura'nın cevap süresi) |
| BirFatura F1 | 2,5–3,5 |
| BirFatura F2 | 1,5–2 |
| BirFatura F3 (koşullu) | 4–6 |
| **BirFatura toplam** | **~4,5–6** (F3'süz) |

Süreler güvenlik incelemesi ve düzeltmelerini içerir; gerçek hesapla deneme (F16) dahil değildir. Tek seferde tek ajan kuralıyla sıralı çalışılır.
