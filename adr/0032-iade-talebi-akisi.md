# ADR-0032: İade talebi (RMA) akışı

- **Durum:** Kabul edildi (2026-10-28 sabaha karşı, otonom çalışma: önerilen seçenek uygulandı; kullanıcı sabah gözden geçirecek, PROGRESS "Gözden geçir").
- **Tarih:** 2026-10-28
- **İlgili:** F7.9 (iade talebi), F7.11 (değişim, bu akışın üstüne kurulur), ADR-0031 (kargo), F5 V5 (kalem bazlı iade), F8 (iade faturası), F13 (cayma hakkı metinleri)

## Bağlam

F7.9 iade talebini uçtan uca istiyor:
1. Müşteri talep açar, neden kodunu seçer.
2. Mağaza onaylar ya da reddeder.
3. Onaylanınca müşteriye iade kodu verilir.
4. Ürün depoya varınca kontrol edilir.
5. Para iadesi yapılır, stok geri girer, iade faturası kesilir.

Medusa v2'nin iade modeli (Kaynak: core-flows v2.21.2) şöyle çalışıyor:
- İade sipariş değişikliği olarak açılır, kalemler istenir ve onaylanır. Bunlar ayrı iş akışları: `beginReturnOrderWorkflow`, `requestItemReturnWorkflow`, `confirmReturnRequestWorkflow`.
- Teslim alma da aynı şekilde aşamalıdır: `beginReceiveReturnWorkflow`, `receiveItemReturnRequestWorkflow`, `confirmReturnReceiveWorkflow`. Onayda stok iadenin deposuna geri girer.
- Medusa'da "talep edildi, mağaza değerlendiriyor" durumu yoktur: iade açılınca istenmiş sayılır.
- Para iadesi yapmaz; yalnızca siparişin ödeme toplamını günceller.
- Tek adımlı `createAndCompleteReturnOrderWorkflow` "şimdi teslim al" seçildiğinde istenen kalemleri değil siparişin bütün kalemlerini teslim alır. Kısmi iade için uygun değil.

## Karar

1. **`return-requests` modülü.** Müşterinin talebi Medusa'dan ayrı kaydedilir:
   - sipariş, müşteri, kalemler ve adetler, neden kodu, müşteri notu;
   - durum: `requested` → `approved` | `rejected` → `received` → `refunded`, ayrıca `canceled`;
   - karar notu, kararı veren ve zaman;
   - Medusa iadesinin kimliği, iade kodu ve takip numarası, iade tutarı ve referansı.
   - Bir siparişte aynı anda tek açık talep olur (kısmi tekil indeks).
   - Kişisel veri yok: adres ve ad siparişte.
2. **Neden kodları sabit liste:** hasarlı geldi, yanlış ürün, tarif edildiği gibi değil, fikrim değişti, beden/ölçü uymadı, diğer. Metinleri storefront ve panelde i18n.
3. **Talep kuralları (Store, oturum açmış müşteri, kendi siparişi):**
   - Yalnızca teslim edilmiş ya da kargodaki kalemler, gönderilenden önceki talepler düşülerek iade edilebilir.
   - Süre son teslimden itibaren 14 gündür (mesafeli satış cayma süresi). Teslim edildi işaretlenmeyen koli çıkışından 30 gün sonra teslim edilmiş sayılır; süre böylece sonsuza kadar açık kalmaz. Mağazaya özel süre ve istisnalar F13'te ayara bağlanır.
   - Daha önce istenenler düşülürken talep sayısı ile Medusa'nın o kalemdeki iade sayılarından büyüğü alınır.
   - Sipariş kilidi altında çalışır, aynı anda tek talep açılır.
4. **Onay (panel, personel):**
   - Medusa iadesi aşamalı iş akışlarıyla açılır ve onaylanır, kargo yöntemi olmadan: Medusa iade gönderisini kendisi açmaz.
   - Sipariş Geliver'le gittiyse iade gönderisi Geliver'de açılır (`POST /shipments/:id { isReturn }`). İade, istenen kalemlerin en çoğunu taşımış koliye açılır (çok kolili sipariş). Barkod ya da takip numarası müşteriye iade kodu olarak verilir; etiket özel depoya yazılır.
   - Mağaza kendi gönderdiyse iade kodu olmadan onaylanır. Doğrudan taşıyıcı (F7.14) gelince onun iade kodu kullanılır.
   - Ret bir notla kapanır.
5. **Depoya varış (panel):**
   - Personel her kalem için sağlam ve hasarlı gelen adedi ayrı girer; eksik gelen düşülür.
   - Medusa teslim alma iş akışları çalışır: sağlamlar stoğa döner, hasarlılar Medusa'nın "dismiss" yoluyla sayılır ama stoğa dönmez.
   - Para iadesi kendi iade akışımızla kalem bazında, sağlam ve hasarlı adetlerin toplamı için yapılır (F4.7 payları, sağlayıcı kuralları, `return<talep>` referansıyla bir kez).
   - Kargo ücreti varsayılan olarak iade edilmez. Teslim almada personel "kargo ücretini de iade et"i seçer; panel bunu hasarlı, yanlış ve tarif edildiği gibi olmayan üründe işaretli önerir. Müşterinin seçtiği neden tutarı tek başına belirlemez (kural 5).
   - `return.refunded` olayı talep "refunded"a geçerken bir kez yayınlanır. İade faturası F8'de bu olaya bağlanır.
   - Onay, teslim alma ve para iadesi siparişin iade kilidi altında talebi yeniden okur; durum yazımı beklenen durumdan yapılır. İki tıklama ikinci Medusa iadesi ya da ikinci para iadesi açmaz.
6. **Değişim (F7.11)** bu akışın üstüne kurulur (ek, 2026-10-28; Medusa v2.21.2 exchange iş akışları kaynaktan doğrulandı):
   - Talebin türü `exchange` olur ve iade edilen her ürün için aynı ürünün başka varyantı (beden, renk) aynı adetle istenir.
   - **Onayda** Medusa'nın değişimi açılır:
     - iade edilecek kalemler istenir;
     - yeni kalemler Medusa'nın güncel fiyatıyla eklenir;
     - yeni kalemler için siparişin kargo seçeneğiyle ücretsiz bir giden kargo yöntemi eklenir, böylece stokları ayrılır;
     - değişim onaylanır, iade gönderisi iadedeki gibi açılır.
   - **Fark tutarı** Medusa'nın sipariş özetinden okunur (yeni kalemler eksi iade edilenler) ve talepte saklanır.
     - Mağaza borçluysa (ucuz varyant) fark, teslim almada kendi iade akışımızla geri verilir.
     - Müşteri borçluysa onay farkı gösterir. Tahsilat bağlantısı bildirimler ve storefront'la gelir (F9/F18); o zamana kadar mağaza farkı başka yolla alır ya da talebi reddeder.
   - **Teslim almada** iade edilen kalemler stoğa döner. Yeni kalemler siparişin "Kargoya ver"iyle gider (sipariş planı onları gönderilecek kalem olarak görür).
7. **Medusa'nın kendi iade, değişim ve talep (claim) rotaları kapalıdır** (güvenlik incelemesi 2026-10-28):
   - `/store/returns` sipariş kimliğini bilen herkese iade açtığı için 404 döner.
   - `/admin/returns`, `/admin/exchanges`, `/admin/claims` altındaki değişiklikler reddedilir (okumalar denetimli kalır). Akışlarımız Medusa iş akışlarını doğrudan çağırır, bu rotaları kullanmaz.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kendi talep kaydı + Medusa'nın aşamalı iadesi (seçilen)** | Onay/ret adımı, neden kodu, iade kodu ve para iadesi bizim kurallarımızla; stok Medusa'nın kendi akışıyla | İki kayıt (talep ve Medusa iadesi) birlikte tutulur |
| Yalnızca Medusa iadesi | Tek kayıt | Talep/onay yok; müşteri talebi doğrudan iade olur, ret için iptal gerekir |
| `createAndCompleteReturnOrderWorkflow` | Tek çağrı | Teslim almada bütün kalemleri alıyor (kısmi iade bozulur) |

## Sonuçlar

- İade faturası (F8), muhasebe kaydı (F11) ve müşteri bildirimleri (F9) `return.refunded` ve durum değişikliklerine bağlanır.
- Cayma süresi, iade edilemeyen ürün türleri (hijyen, kişiye özel) ve iade kargo ücretini kimin ödediği F13'te mağaza ayarı olur.
