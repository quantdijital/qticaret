# E-Fatura / E-Arşiv

## Tasarım (bağımlılığı en aza indiren)
- `einvoice` özel modül: veri modeli + iş mantığı + **UBL-TR üretimi** (`ubl/`) + **mükellef listesi** (`taxpayers/`) + **PDF üretimi**. Bunlar bizde kalır.
- `InvoiceAdapter` arayüzü entegratöre yalnızca **imza ve GİB'e iletim** bırakır; her entegratör bir adaptör (adapters/), seçim env ile.
  Entegratör değişimi = yeni adaptör (hedef: bir günlük iş); fatura mantığı, XML ve PDF değişmez.
- Mükellef sorgusu: GİB'in yayımladığı e-fatura kayıtlı kullanıcı listesi periyodik job ile indirilip yerel tabloda tutulur; entegratör sorgusu yalnızca yedek.
- Doğrudan GİB entegrasyonu (tenant başına mali mühür + izin) kapsam dışı; entegratör kaçınılmaz, ama en ince katmanda.
```ts
interface InvoiceAdapter {
  isEInvoiceTaxpayer(vkn: string): Promise<boolean>   // yedek mükellef sorgusu (birincil: yerel GİB listesi)
  sendInvoice(ubl: Buffer, meta: InvoiceMeta): Promise<InvoiceResult> // UBL-TR bizden gelir; adaptör imzalar/iletir
  cancelInvoice(ref: string): Promise<void>
  getPdf(ref: string): Promise<Buffer>
  getStatus(ref: string): Promise<InvoiceStatus>
}
```

## Model
`invoice`: id, order_id (link), type (e_archive|e_invoice), status (pending|issued|failed|cancelled),
external_uuid, number, pdf_url, attempt_count, last_error, issued_at.
Unique: (order_id, type, kind=sale|return).

## Workflow
`invoice-create-for-order`: siparişi oku → tip belirle (yerel mükellef listesi) → idempotency kontrolü → UBL-TR üret (şema doğrulama) → adaptör ile ilet → kaydet → PDF üret (worker) → private S3 (presigned erişim) → bildirim.
Başarısızlıkta: status=failed, retry job (artan aralık), N denemeden sonra admin uyarısı (dead-letter).

## Kurallar
- Tetikleme anı tenant ayarı (sipariş onayı / kargoya verilince).
- Kurumsal alıcıda VKN + vergi dairesi zorunlu; bireyselde TCKN (yoksa mevzuattaki varsayılan değer — muhasebeciyle doğrula).
- Fatura iptali/iade faturası süreçleri mevzuata göre; adaptör bunu soyutlar.

## Testler
- UBL-TR çıktısı XSD + entegratör test aracı + GİB test ortamı doğrulamasından geçer; KDV dökümü, indirim/kargo satırları, iade faturası fixture'ları.
- Mükellef listesi job'u: güncelleme, bozuk dosya, liste yokken yedek sorguya düşme.
- PDF: tenant şablonu, Türkçe karakter, yetkisiz URL ile erişim reddi.

## Env
`EINVOICE_PROVIDER`, `EINVOICE_API_KEY`, `EINVOICE_BASE_URL`, `EINVOICE_SENDER_VKN`
