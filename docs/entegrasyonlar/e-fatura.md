# E-Fatura / E-Arşiv

> Karar: ADR-0034 (2026-10-30'da yeniden yazıldı). Mali müşavire giden sorular: `docs/mali-musavir-sorulari.md`.

## Tasarım
- **Faturanın içeriğini biz hesaplarız, kesimi mağazanın programı yapar.**
  - Bizim işimiz: satırlar, KDV, indirim, kargo ve kapıda ödeme bedeli, alıcı, internet satışı ve gönderim bilgileri (`lib/invoicing`).
  - Programın işi: UBL-TR, GİB'e iletim, mükellef kontrolü ve PDF.
- **Sağlayıcılar** (mağaza ayarı, Ayarlar > E-Fatura):
  - `parasut`: faturayı sistem Paraşüt'te keser.
  - `external`: mağazanın kendi programı keser ve sonucu geri yazar, ya da personel elle işler (ör. Luca).
  - `none`: kapalı.
  - `fake`: yalnızca testte (2026-11-02'den beri geliştirmede de kapalı: mağaza sahibi yerel panelde sahte program görmesin; kayıtlı eski değer "program yok" sayılır).
- Kendi UBL'imiz ve doğrudan entegratör sonraki aşamadır; aynı arayüze yeni sağlayıcı olarak eklenir.

```ts
interface InvoiceProvider {
  start(draft: InvoiceDraft): Promise<InvoiceStarted>          // müşteri, satış faturası, posta kutusu, e-belge; iş kaydı döner
  check(ref: InvoiceRef): Promise<InvoiceProgress>             // pending | issued (numara, ETTN, iptal sınırı) | failed (kod)
  pdf(ref: InvoiceRef): Promise<Buffer | null>                 // null: henüz hazır değil
  cancel(ref: InvoiceRef): Promise<void>
  healthCheck(): Promise<"ok" | "down">
}
```

## Model
`invoice`:
- sipariş, tür (`sale | return`) ve kaynak (satışta sipariş; iadede iade talebi ya da iade defteri kaydı);
- sağlayıcı ve belge tipi (`e_invoice | e_archive`);
- durum: `pending | issuing | issued | failed | cancelled`;
- programdaki fatura, e-belge ve iş kimlikleri;
- numara, ETTN, kesim zamanı, iptal sınırı;
- deneme sayısı, sonraki deneme, son hata kodu;
- PDF dosyası (özel depo) ve toplamlar.

Tekillik: (sipariş, tür, kaynak). Kayıtta kişisel veri yok.

## Akış
1. **Tetikleme** (mağaza ayarı): sipariş onayı ya da kargoya verme. Varsayılan kargoya verme; havalede ödeme onayı beklenir.
2. **`invoice-issue`:** taslak, tekillik, `start`, kayıt. Girdi yalnızca kimliklerdir.
3. **`invoice-check` işi (dakikada bir):**
   - bekleyen işleri sorar;
   - 15 dakikayı geçen iş için faturanın etkin e-belgesine bakar;
   - kesilen faturanın PDF'ini özel depoya indirir ve müşteriye bildirir.
4. **Hata:**
   - `failed` olur ve artan aralıkla yeniden denenir; N denemede panel uyarısı çıkar.
   - Sonucu bilinmeyen başlatma ikinci kez gönderilmez.
   - Resmîleşmemiş satış faturası kalıcı hatada silinir. Resmîleşmiş belge kendiliğinden iptal edilmez (ADR-0034 §7).
5. **Geri yazma (`external`):**
   - `GET /admin/invoices?status=pending` (kapsam `invoices:read`);
   - `POST /admin/invoices/:id/issued` ve `POST /admin/invoices/:id/pdf` (kapsam `invoices:write`);
   - `invoice.requested` web kancası;
   - panelde "Faturayı elle işle".

## Paraşüt (API v4, `https://apidocs.parasut.com/swagger.json`)
- **Kimlik:**
  - OAuth2 `https://api.parasut.com/oauth/token`.
  - Platform istemcisi `PARASUT_CLIENT_ID` / `PARASUT_CLIENT_SECRET` (destek@parasut.com'dan istenir).
  - Mağaza firma numarasını girer ve yetki kodu akışıyla bağlanır; o açılmazsa ayrı bir API kullanıcısıyla parola akışı.
  - Erişim jetonu 2 saattir. Yenileme jetonu her kullanımda değişir.
- **Adres:** `https://api.parasut.com/v4/{company_id}/...`, JSON:API.
- **Sınır:** 10 saniyede 10 istek (mağaza başına, Redis). Sayfa en çok 25.
- **Sıra:**
  1. `contacts` (`filter[tax_number]`, `filter[email]`);
  2. `sales_invoices`: `item_type: invoice`, `currency: TRL`, satırlar `relationships.details.data[]`, `order_no` ile `order_date` birlikte;
  3. `GET /e_invoice_inboxes?filter[vkn]=`: posta kutusu varsa `POST /e_invoices` (`scenario`, `to`, ilişki `invoice`), yoksa `POST /e_archives` (`internet_sale`, `shipment`, ilişki `sales_invoice`);
  4. `GET /trackable_jobs/{id}` (`pending | running | done | error`; hatalar metin dizisi; 15 dakika);
  5. `GET /sales_invoices/{id}?include=active_e_document`;
  6. `GET /e_archives/{id}/pdf` ya da `/e_invoices/{id}/pdf`: önce 204, sonra 1 saatlik adres.
- **İptal:** `DELETE /sales_invoices/{id}/cancel`. e-Arşiv için `cancellable_until` (Paraşüt'ün verdiği değer; mali müşavir: alıcıya iletimden itibaren 8 gün). Süre geçince sistem iptal etmez, personel muhasebe kaydını uygun belgeyle düzeltir.
- **Ödeme tipleri** (`internet_sale.payment_type`): kart `KREDIKARTI/BANKAKARTI`, havale `EFT/HAVALE`, kapıda ödeme `KAPIDAODEME`.
- **Doğrulanamayanlar:** deneme ortamı, 429, web kancası, ürünsüz satır, iade faturasının asıl faturaya bağı. Gerçek hesapla ilk denemede doğrulanır.

## Kurallar
- Tutarlar sunucuda, kalem paylarından hesaplanır. Paraşüt toplamıyla kuruş farkı kayda geçer.
- Kurumsal alıcıda VKN ve vergi dairesi zorunlu. Bireyselde TCKN yoksa `11111111111` (mali müşavir doğrulayacak).
- VKN ve TCKN yalnızca gönderim anında açılır. Günlüklere alıcı verisi ve jeton yazılmaz.

## Testler
- **Taslak (birim):** KDV dökümü, kalemde indirim, kargo ve kapıda ödeme satırları, yuvarlama, kişi ve şirket alıcısı.
- **Paraşüt istemcisi:** jeton yenileme ve dönen yenileme jetonu, 429 ve 5xx bekleme, redaksiyon.
- **Sahte Paraşüt'le HTTP:**
  - e-Arşiv ve e-Fatura;
  - mükerrer fatura yok;
  - program kapalıyken sipariş etkilenmiyor ve fatura yeniden deneniyor;
  - iş hatası;
  - PDF'in geç hazırlanması;
  - iptal sınırı.
- **Geri yazma:** yetki ve kapsam, aynı numara, farklı numara, PDF türü ve boyutu.

## Env
`PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`; testte ve geliştirmede `PARASUT_BASE_URL` (sahte sunucu; canlıda reddedilir).
