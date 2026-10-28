# ADR-0034: E-Fatura / e-Arşiv altyapısı

- **Durum:** Önerildi (2026-10-28, F8 planlaması). Aşağıdaki "Kullanıcı kararı" maddeleri cevaplanınca kabul edilir; diğer maddeler önerilen seçenekle uygulanır.
- **Tarih:** 2026-10-28
- **İlgili:** F8.1–F8.8; ADR-0010 (kalem bazlı para), ADR-0027 (sağlayıcı hesapları panelden), ADR-0032 (iade ve değişim), ADR-0033 (sipariş düzenleme); docs/entegrasyonlar/e-fatura.md; docs/12 (mali müşavir maddeleri)

## Bağlam

F8 her satış için e-Fatura (alıcı e-fatura mükellefiyse) ya da e-Arşiv faturası, her iade için de iade faturası istiyor. Fatura mantığı, UBL-TR üretimi, mükellef bilgisi ve PDF bizde kalacak; entegratör yalnızca imza ve GİB'e iletim yapacak (docs/entegrasyonlar/e-fatura.md).

Planlamada doğrulananlar:
- **GİB kayıtlı kullanıcı listesi herkese açık toplu indirilemiyor.** Liste e-Fatura Portalı'nda giriş yapan kullanıcıya "Araçlar > Sisteme Kayıtlılar" altında XML/CSV olarak veriliyor. Entegratörler listeyi GİB'in merkezinden alıyor. Herkese açık olan yalnızca güvenlik kodlu tek VKN sorgusu. Yol haritasındaki "GİB listesini periyodik indir" maddesi bu yüzden doğrudan uygulanamaz.
- **UBL-TR 1.2.1 güncel paket.** Kod listeleri 14 Eylül 2026'da güncellendi. Şema (XSD) ve iş kuralları (şematron) GİB e-Belge portalındaki paketten alınır.
- **Medusa olayları (v2.21.2 kaynağı):** `order.placed`, `shipment.created`, `order.canceled`, `order-edit.confirmed`, `order.exchange_created`; kendi olayımız `return.refunded` (ADR-0032).

## Karar

1. **`einvoice` modülü.**
   - `invoice` kaydı: sipariş, tür (`sale`, `return`), belge tipi (`e_invoice`, `e_archive`), durum (`pending`, `issued`, `failed`, `cancelled`), UUID, numara, deneme sayısı, son hata kodu, kesim zamanı, iadede asıl faturaya ve iade talebine bağ.
   - Tekillik: (sipariş, tür, kaynak) üzerinde. Kaynak satışta sipariş, iadede iade talebi ya da iade defteri kaydı. Aynı sipariş için ikinci satış faturası oluşamaz (KK3).
   - UBL XML'i ve PDF özel depoda; kayıtta yalnızca dosya anahtarları. Kişisel veri kayıtta yok, belgede var.
2. **UBL-TR üretimi bizde, bağımlılıksız:**
   - kendi kaçışlı XML yazıcımız;
   - tutarlar F4.7 kalem paylarından (indirim kaleme dağıtılmış, kargo ayrı satır, KDV oranına göre döküm);
   - e-Arşiv'de internet satışı bilgileri (web adresi, ödeme şekli, taşıyıcı, gönderim tarihi);
   - iade faturasında asıl faturaya `BillingReference`.
   - Şema doğrulaması testte GİB paketinin XSD'siyle yapılır (sistemdeki `xmllint`; yoksa test atlanır, CI'da zorunlu). Şematron ve GİB test aracı sunucuda, gerçek entegratörle.
3. **Belge tipi:**
   - Alıcının fatura profilinde (F1.5) VKN varsa ve alıcı e-fatura mükellefiyse e-Fatura, değilse e-Arşiv.
   - Mükellef bilgisi yerel tabloda tutulur. Kaynağı entegratörün toplu kullanıcı listesidir (`downloadTaxpayers`, günlük iş); tek VKN sorgusu (`isEInvoiceTaxpayer`) yalnızca yedektir.
   - Entegratör kapalıyken yerel tablo karar verir (KK5). Liste hiç yoksa tip "beklemede" kalır, iş yeniden dener.
4. **Entegratör adaptörü (`InvoiceAdapter`):**
   - `sendInvoice`, `cancelInvoice`, `getStatus`, `downloadTaxpayers`, `isEInvoiceTaxpayer`; isteğe bağlı `getPdf`.
   - Hesap bilgileri panelden (`integration-credentials`, ADR-0027).
   - İlk geliştirme sahte entegratörle yapılır (`packages/testing`, ödeme ve kargodaki gibi). Gerçek adaptör, kullanıcının seçtiği entegratörle eklenir.
5. **Akış (`invoice-create-for-order` iş akışı):**
   - sırayla: oku, tip belirle, tekillik kontrolü, numara ver, UBL üret ve doğrula, ilet, kaydet, PDF üret;
   - entegratör hatası siparişi bozmaz: fatura `failed` olur ve artan aralıkla yeniden denenir;
   - N denemeden sonra panelde uyarı ("ölü mektup", KK2);
   - `outcome_unknown` olan iletim ikinci kez gönderilmez; önce durum sorulur (F5 V10 kuralı).
6. **Tetikleme:** Mağaza ayarı: sipariş onayında (`order.placed`; havale onayı ve kapıda ödeme tahsilatı beklenir) ya da kargoya verilince (`shipment.created`). Varsayılan "kargoya verilince", çünkü düzenleme ve iptal o ana kadar faturayı etkilemez.
7. **İade, iptal ve değişiklik:**
   - Para iadesi (`return.refunded` ve iade defteri) iade faturası keser.
   - Kesilmiş faturası olan siparişin iptali GİB kurallarına göre iptal ya da iade faturasıdır; adaptör soyutlar, mali müşavirle doğrulanır.
   - Faturası kesilmiş sipariş düzenlenemez (ADR-0033 §8).
   - Değişimde iade faturası ve yeni satış faturası kesilir (F7.11, KK3).
8. **Numara:** Fatura numarası bizde verilir: 3 harfli seri, yıl ve 9 haneli sıra (GİB biçimi). Sıra mağaza ve yıl başına tutulur ve kilit altında artar; boşluk bırakmaz, iptal edilen numara tekrar kullanılmaz.
9. **PDF:**
   - UBL'den kendi şablonumuzla (mağaza logosu ve unvanı) üretilir, özel depoda saklanır, kısa ömürlü bağlantıyla verilir.
   - PDF üretimi için bir kütüphane gerekir (öneri: `pdf-lib`, MIT, bağımlılıksız). O gelene kadar fatura görüntüsü HTML olarak üretilir; ters ibraz belge paketindeki gibi yeni bağımlılık yoktur.
   - Entegratörün PDF'i isteğe bağlı yedektir.
10. **Panel:**
    - sipariş sayfasında fatura kartı (durum, PDF, "yeniden dene");
    - Siparişler > Faturalar (başarısızlar önce);
    - Ayarlar > E-Fatura (entegratör hesabı, seri, tetikleme anı, test modu).

## Kullanıcı kararı gereken maddeler

- **Entegratör seçimi ve test hesabı** (docs/12). İlk gerçek adaptör buna bağlı; seçilene kadar sahte entegratörle ilerlenir.
- **Mali müşavir doğrulaması** (docs/12):
  - TCKN'siz bireysel alıcıda varsayılan değer;
  - indirim ve kargonun faturada gösterimi;
  - hediye kartı ve mağaza kredisinin KDV'si;
  - iptal mi iade faturası mı.
- **PDF kütüphanesi onayı** (`pdf-lib`). Onaylanırsa toplu kargo etiketlerini tek PDF'te birleştirme işi de aynı bağımlılıkla çözülür (F7 açık sorusu).

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **UBL ve mantık bizde, entegratör ince adaptör (seçilen)** | Entegratör değişimi bir adaptör işi; fatura tutarları ödeme ve iade defteriyle aynı kaynaktan | UBL-TR ve şema güncellemeleri bizim sorumluluğumuz |
| Entegratörün kendi fatura nesnesi (JSON) | Hızlı başlangıç | Entegratöre bağımlılık; tutar mantığı iki yerde |
| Mükellef bilgisini her faturada entegratöre sormak | Basit | Entegratör kapalıyken fatura kesilemez (KK5'e aykırı) |

## Sonuçlar

- F7 KK3 (iade faturası) bu fazda kapanır.
- F11 (muhasebe) fatura kayıtlarını kaynak alır.
- UBL-TR paket güncellemeleri (kod listeleri) izlenir; şema dosyaları sürümüyle depoda tutulur.
