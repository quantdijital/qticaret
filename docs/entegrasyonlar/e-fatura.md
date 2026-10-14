# E-Fatura / E-Arşiv

## Tasarım
- `einvoice` özel modül: veri modeli + iş mantığı.
- `InvoiceAdapter` arayüzü; her entegratör bir adaptör (adapters/). Entegratör seçimi env ile.
```ts
interface InvoiceAdapter {
  isEInvoiceTaxpayer(vkn: string): Promise<boolean>   // mükellef sorgusu
  createInvoice(input: InvoiceInput): Promise<InvoiceResult> // UBL-TR üretimi adaptörde ya da entegratörde
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
`invoice-create-for-order`: siparişi oku → tip belirle → idempotency kontrolü → adaptör → kaydet → PDF'i S3'e → bildirim.
Başarısızlıkta: status=failed, retry job (artan aralık), N denemeden sonra admin uyarısı (dead-letter).

## Kurallar
- Tetikleme anı tenant ayarı (sipariş onayı / kargoya verilince).
- Kurumsal alıcıda VKN + vergi dairesi zorunlu; bireyselde TCKN (yoksa mevzuattaki varsayılan değer — muhasebeciyle doğrula).
- Fatura iptali/iade faturası süreçleri mevzuata göre; adaptör bunu soyutlar.

## Env
`EINVOICE_PROVIDER`, `EINVOICE_API_KEY`, `EINVOICE_BASE_URL`, `EINVOICE_SENDER_VKN`
