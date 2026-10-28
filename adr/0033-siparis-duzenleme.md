# ADR-0033: Sipariş düzenleme

- **Durum:** Kabul edildi (2026-10-28 sabah, otonom çalışma; kullanıcı 2026-10-28 öğlen onayladı; kapıda ödeme ve havalede kalem düzenlemenin kapalı kalması kullanıcı kararı).
- **Tarih:** 2026-10-28
- **İlgili:** F7.12; ADR-0010 (kalem bazlı para), ADR-0029 (çevrim dışı ödemeler), ADR-0032 (iade ve değişim), F8 (fatura)

## Bağlam

F7.12 personelin siparişi düzeltebilmesini istiyor: adres değişikliği, kalem ekleme/çıkarma, miktar ve fiyat düzeltme, ödeme farkının akışı, faturalı siparişte kısıt ve denetim kaydı.

Medusa v2.21.2'nin sipariş düzenleme modeli (Kaynak: core-flows):
- Düzenleme bir sipariş değişikliğidir. `beginOrderEditOrderWorkflow` başlatır, `orderEditAddNewItemWorkflow` kalem ekler (Medusa'nın fiyatıyla), `orderEditUpdateItemQuantityWorkflow` miktarı ve isteğe bağlı birim fiyatı değiştirir (miktar 0 kalemi çıkarır), `confirmOrderEditRequestWorkflow` onaylar, `cancelBeginOrderEditWorkflow` vazgeçer.
- Onayda stok rezervasyonları yeniden yapılır ve müşteri borçluysa bir ödeme tahsilatı (`not_paid`) açılır. Medusa para iadesi yapmaz.
- Henüz onaylanmamış değişikliğin özeti (`previewOrderChange`) farkı gösterir.
- Adres `updateOrderWorkflow` ile değişir; Medusa'nın `POST /admin/orders/:id` ucu bunu yapar.

Kısıtlar:
- Kapıda ödemede kuryenin tahsil edeceği tutar ödeme kaydından okunur (ADR-0029, `planCarrierStep`). Medusa yetkilendirilmiş ödemenin tutarını değiştirmez; düzenleme bu tutarı güncellemezdi.
- Havalesi beklenen siparişte beklenen tutar havale onayıyla karşılaştırılır.
- Paketlenen koli için taşıyıcı etiketi eski adres ve içerikle alınmıştır.

## Karar

1. **Ne zaman:** Yalnızca hiçbir kolisi paketlenmemiş, iptal ya da tamamlanmamış sipariş düzenlenir (`orders.edit_after_packing`). İptal iadesi yapılmış sipariş düzenlenmez.
   - Düzenleme dışında para iadesi yapılmış ya da açık bakiyesi olan sipariş düzenlenmez (`orders.edit_balance_open`). Medusa borç yokken yapılan iadeyi bir alacak satırıyla dengeler; aynı kalemi düzenlemeyle çıkarmak o parayı ikinci kez geri verirdi (güvenlik incelemesi 2026-10-28).
2. **Adres:** Medusa'nın kendi ucu (`POST /admin/orders/:id`) kullanılır; üstüne:
   - personel kimliği zorunlu (`requireUserActor`);
   - iptal kilitleri altında, "Kargoya ver" ile yarışmaz;
   - teslimat adresi paketlenmiş siparişte değişmez (etiket eski adresle alındı). Fatura adresi fatura kesilene kadar değişebilir (F8 kısıtı ekler);
   - Türkiye adresi il/ilçe/mahalle referansıyla doğrulanır (F1.4).
3. **Kalemler (`POST /admin/orders/:id/edit`, önizleme `…/edit/preview`):**
   - miktar değişikliği, çıkarma (miktar 0), yeni varyant ekleme (Medusa'nın fiyatıyla), birim fiyat düzeltmesi (personel, lira, ≥ 0; denetim kaydına girer).
   - Önizleme değişikliği Medusa'da açar, farkı özetten okur ve vazgeçer; hiçbir şey kalmaz.
   - Uygulama, personelin önizlemede gördüğü farkla çalışır (`expected_difference`). Tutar bu değerden alınmaz, yalnızca karşılaştırılır; fark değiştiyse `orders.edit_difference_changed`.
   - Panel her düzenleme penceresi için bir anahtar gönderir (`reference`). Aynı anahtarla gelen ikinci istek düzenlemeyi tekrar yapmaz; anahtar Medusa sipariş değişikliğinin personel notunda tutulur, çünkü Medusa düzenlemede `metadata` saklamıyor.
   - Kargo ücreti değişmez.
4. **Para:**
   - Müşteri borçluysa onay, personel "farkı müşteriden aldım" demeden yapılmaz (`orders.edit_difference_due`). Onayda Medusa'nın açtığı tahsilat ödendi işaretlenir (değişimdeki gibi, ADR-0032 §6). Tahsilatın tutarı farka eşit değilse onay geri alınır. Çevrim içi tahsilat bağlantısı F9/F18'de gelir.
   - Mağaza borçluysa fark onaydan sonra kendi iade akışımızla geri verilir (`edit<değişiklik>` referansıyla bir kez). Bu iade hiçbir kaleme yazılmaz; düzenlenmiş kalemler farkı zaten gösterir. İade başarısız olursa düzenleme kalır; personel siparişin iade penceresinden tekrar dener.
   - Toplanan fark ayrı bir ödemedir (sistem sağlayıcısı). Personel iptali her ödemeyi kendi referansıyla ayrı geri verir. Müşterinin kendi iptali, birden fazla alınmış ödemesi olan siparişte reddedilir; o para elle geri verilir (`orders.cancel_contact_shop`).
5. **Desteklenmeyen ödeme:** Kalem düzenleme yalnızca kartla (barındırılan form ya da sistem sağlayıcısı) ödenip alınmış siparişte yapılır. Kapıda ödeme, havalesi beklenen ya da çevrim dışı ödenen siparişte reddedilir (`orders.edit_payment_unsupported`); mağaza siparişi iptal edip yenisini açar. Kapıda ödeme tutarının güncellenmesi sonraki adım (F13 sonrası).
6. **Kilit:** Düzenleme, iptal kilitlerinin (`cancelLockKeys`: kargo ve havale) altında çalışır; "Kargoya ver" ve iptal ile yarışmaz.
7. **Medusa'nın kendi düzenleme uçları kapalı:** `/admin/order-edits/*` değişiklikleri reddedilir (`orders.use_order_edit`); fark ve iade akışımızı atlamasınlar.
8. **Fatura (F8):** Faturası kesilmiş sipariş düzenlenmez. Bu kontrol fatura modülüyle F8'de bu akışın ön kontrolüne eklenir; o zamana kadar fatura yok.
9. **Denetim:** Uçlar `/admin` altında olduğu için her değişiklik denetim kaydına girer (adr/0011). Düzenleme geçmişi Medusa'nın sipariş değişikliklerinden okunur (`/admin/orders/:id/changes`, hassas okuma).

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Medusa sipariş düzenlemesi + kendi fark/iade akışımız (seçilen)** | Stok rezervasyonu ve sipariş sürümleri Medusa'da; para kurallarımız korunur | Önizleme için değişiklik açılıp vazgeçiliyor |
| Medusa'nın düzenleme uçları olduğu gibi | Hazır | Fark iadesi yok, kapıda ödeme tutarı bozulur, kilit yok |
| İptal + yeni sipariş | Basit | Sipariş numarası ve müşteri deneyimi bozulur |

## Sonuçlar

- F8 düzenlenmiş siparişin faturasını son sürümden keser; faturalı siparişte kısıt bu akışa eklenir.
- Kapıda ödemeli siparişte düzenleme için ödeme tutarının güncellenmesi ayrı bir iş olarak kalır.
