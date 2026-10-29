# ADR-0031: Kargo altyapısı, gönderi takibi ve etiketler

- **Durum:** Kabul edildi (2026-10-28 gece, otonom çalışma; kullanıcı 2026-10-28 öğlen onayladı).
- **Tarih:** 2026-10-28
- **İlgili:** F7.1–F7.8, F7.10, F7.14; ADR-0027 (sağlayıcı bilgileri panelden), ADR-0029 (kapıda ödeme), docs/entegrasyonlar/geliver.md

## Bağlam

F7 kargoyu üç parçada istiyor:
- Sipariş hazırlanınca gönderi oluşturulsun, etiket basılsın.
- Gönderi taşıyıcıda ilerledikçe sipariş kendiliğinden güncellensin.
- Bir aracı (Geliver) ve sonra doğrudan taşıyıcılar aynı arayüzden bağlansın.

Geliver'in resmi SDK'sından okunanlar (`GeliverApp/geliver-js`):
- REST, `https://api.geliver.io/api/v1`, `Authorization: Bearer <token>`.
- Yanıt zarfı `{ result, data, message, code }`; `result: false` hata.
- Gönderi `POST /shipments`. Teklifler zaman uyumsuz dolar: yüzde 100'e ulaşana kadar `GET /shipments/:id` ile beklenir.
- Teklif kabulü (`POST /transactions`) etiketi satın alır. Etiket PDF'i `labelURL`'de; takip numarası sonra dolabilir.
- İptal `DELETE /shipments/:id`; iade `POST /shipments/:id` ile `isReturn`.
- Test gönderisinde her `GET` durumu bir adım ilerletir.
- Kapıda ödeme `productPaymentOnDelivery` ve siparişin tutarıyla.
- Bildirim `TRACK_UPDATED` olayıdır, gövdesi gönderinin kendisidir.
- **Bildirim imzası SDK'da da uygulanmamış:** doğrulama kapalı örnekleniyor, imza algoritması belgelenmemiş.

## Karar

1. **Sağlayıcı ve hesap:**
   - `fulfillment-geliver` bir Medusa fulfillment module provider'ıdır (`geliver_geliver`; Medusa 2.21.2 fulfillment sağlayıcılarına `fp_` öneki koymuyor).
   - Mağaza Geliver hesabını panelden bağlar (ADR-0027 deseni, `integration-credentials`'a `geliver`): gizli API anahtarı ve test modu.
   - Gönderici adresi, mağazanın varsayılan deposunun adresinden Geliver'de bir kez oluşturulur; kimliği hesap ayarında tutulur.
   - Geliver istemcisi `lib/clients` tabanlıdır: zaman aşımı, yeniden deneme, devre kesici, log redaksiyonu.
   - Sahte Geliver `packages/testing`'de yazılır. Gerçek hesapla deneme sunucuya çıkışa kalır (ödemelerdeki gibi).
2. **Fiyat (F7.2):**
   - Desi = en × boy × yükseklik / 3000 ile ağırlığın büyüğü; ürün ölçüleri varyanttan okunur (Medusa fiyat bağlamındaki ve siparişteki kalemlere varyantın ağırlık ve ölçülerini veriyor; testle doğrulandı).
   - Ölçüler mağazanın biriminde saklanır (Ayarlar > Mağaza: g/kg, cm/mm). Sağlayıcı birimleri çağrı anında paylaşılan kapsayıcıdan okur (`platform-settings`'in `store` bölümü, salt okunur). Bu, PayTR sağlayıcısının taksit ayarını okuması gibi dar bir istisnadır: `calculatePrice`'a gelen `data` istemciden gelir, birimleri taşıyacak başka güvenli kanal yoktur.
   - Ölçüsü ya da ağırlığı eksik ürün açıklayıcı hatayla durur (`shipping.dimensions_missing`, ürün adlarıyla).
   - Hesaplanan seçenek Geliver'in fiyat listesinden seçilen servisin fiyatını kullanır. Desi ve servise göre önbelleğe alınır (10 dk).
   - Sabit ücretli seçenek de Geliver'le gönderilebilir: fiyat mağazanın, gönderi Geliver'in.
3. **Gönderi ve etiket (F7.3):**
   - "Kargoya ver" gönderiyi oluşturur: teklif beklenir, seçenekteki servis (yoksa en ucuzu) kabul edilir, etiket satın alınır.
   - Gönderici adresi ve kapıda ödeme tutarı sağlayıcıya iş akışımızdan Medusa'nın `additional_data`'sıyla gelir (`qt_ship`). Bu işaret olmadan (Medusa'nın kendi fulfillment ucundan) gönderi açılmaz. Böylece sağlayıcı depo ve ödeme modüllerine erişmez.
   - Gönderici adresi saklanmaz: depo başına Geliver hesabında işaretle (`qt-<depo>`) aranır, adres değiştiyse ya da yoksa oluşturulur.
   - Etiket satın alınamazsa Geliver'deki gönderi geri çekilir, sipariş paketlenmemiş kalır.
   - Etiket PDF'i indirilip **özel** dosya deposuna yazılır; herkese açık adresi yoktur.
   - Panel etiketi yalnızca personel ucundan alır (`requireUserActor`, hassas okuma olarak denetim kaydı). Etikette alıcının adı, adresi ve telefonu var.
   - Medusa'nın gönderi kaydı ("kargoya verildi") etiket basılınca değil, taşıyıcı paketi aldığında atılır.
   - Kapıda ödemeli siparişin gönderisi `productPaymentOnDelivery` ve ödeme tutarıyla oluşturulur. Kurye tutarın tamamını bir kolide tahsil ettiği için böyle bir sipariş taşıyıcıyla tek koli gider: kısmi ya da ikinci koli reddedilir.
4. **Takip (F7.5, F7.6):**
   - `shipment-tracking` modülü gönderinin iç durumunu ve olay geçmişini tutar.
   - İç durumlar: `created`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `returned`, `failed`, `canceled`.
   - **Bildirime güvenilmez, ipucu sayılır:**
     - Adres `POST /hooks/geliver`; sır taşımaz. Medusa'nın istek günlüğü yolu ve sorgu dizesini olduğu gibi yazar, adresteki bir anahtar günlüğe düşerdi.
     - Gövdedeki gönderi kimliği yalnızca izlediğimiz bir gönderiyi Geliver API'sinden yeniden okumak için kullanılır. Durum her zaman API'nin yanıtından yazılır.
     - Bildirimle bir gönderi en çok dakikada bir yeniden okunur (kilit altında); uç webhook hız sınırının içindedir. Kötüye kullanım en fazla API okuması üretir, durum yazamaz.
     - Geliver'in test gönderisi her okumada bir adım ilerler. Bu yüzden dağıtılmış bir mağazada test kolileri bildirimle okunmaz, yalnızca sorgu işiyle ilerler.
     - Medusa'nın kendi fulfillment uçlarında `qt_` ile başlayan `additional_data` reddedilir: `qt_ship` işareti yalnızca bizim iş akışımızdan gelir.
   - Bildirim gelmeyen açık gönderileri zamanlanmış iş aynı yoldan sorar.
   - Bir durum geçişi gönderi başına tek kez uygulanır: tekil indeks ve kilit, ileri doğru geçiş. Bildirim ve sorgu aynı güncellemeyi iki kez uygulamaz (KK).
   - `picked_up` Medusa'nın gönderi kaydını (`createOrderShipmentWorkflow`), `delivered` teslim kaydını (`markOrderFulfillmentAsDeliveredWorkflow`) tetikler.
   - Her geçiş bir olay yayar (`shipment.status_changed`). Müşteri bildirimi F9'da bu olaya bağlanır.
5. **Doğrudan taşıyıcılar (F7.14):**
   - Aynı `AbstractFulfillmentProviderService` arayüzü, ortak sözleşme test paketi ve aynı iç durum tablosu kullanılır.
   - Hangi taşıyıcının yazılacağı ilk müşterinin anlaşmalı firmasına bağlıdır: kullanıcıya sorulacak.
6. **Yeni bağımlılık yok:** Geliver SDK'sı kullanılmaz. SDK küçük, yeniden deneme davranışı istemediğimiz şekilde (4xx'i de tekrar dener), ve kendi istemci tabanımız (redaksiyon, devre kesici) zaten var. Uçlar SDK'dan okunup kendi istemcimize yazılır.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Bildirim ipucu + API'den yeniden okuma (seçilen)** | İmza olmadan da sahte durum yazılamaz | Her bildirim bir API çağrısı (gönderi başına dakikada en çok bir) |
| Adreste gizli anahtar | Yabancı istekleri baştan eler | Medusa'nın istek günlüğüne düşer; yeniden okuma zaten yeterli |
| Bildirim gövdesini doğrudan yazmak | Hızlı | İmza yok: adresi bilen herkes "teslim edildi" yazar |
| Yalnızca sorgu (bildirim yok) | En basit | Gecikme; çok gönderide gereksiz yük |
| Geliver SDK'sı | Hazır tipler | 4xx'i de tekrar deniyor, redaksiyon yok, yeni bağımlılık |
| Etiket için süreli imzalı adres | Panel dışında da açılır | Adres sızarsa süresi boyunca kişisel veri açık |

## Sonuçlar

- Geliver bildirim imzasını yayınlarsa imza kontrolü bildirime eklenir; yeniden okuma yine kalır.
- Geliver'in takip durum kodları SDK'da listelenmiyor. Eşleme gönderi durumundan (`CREATED` … `DELIVERED`, `RETURNED`, `FAILED`) yapılır; gerçek hesapla doğrulanacak (sunucuya çıkışta).
- Kapıda ödeme tahsilatının kargo mutabakatı (ADR-0029) Geliver'in raporladığı alana bağlanır; alan gerçek hesapla netleşene kadar "Tahsil et" elle kalır.
- İade (RMA), değişim, sipariş düzenleme ve müşteri iptali ayrı bir ADR'de (F7.9, F7.11–F7.13).

## Ek: etiket boyutu ve baskı (2026-10-29)
- **Ayar:** Ayarlar > Kargo > Kargo etiketi (`shipping.label_format`, `label_custom`).
  - Hazır ölçüler: 100×150 mm (varsayılan), 100×100, 80×80, A4 (sayfada 4 etiket, kesme çizgileriyle).
  - Özel ölçü: en 70–210 mm, boy 70–297 mm. 70 mm'nin altında barkod, alıcı ve adres okunaklı sığmıyor; kullanıcının önerdiği 50×50 bu yüzden yok.
- **Yurtiçi etiketi** gönderi açılırken seçilen ölçüde çizilir. Yazılar sayfaya göre küçülür; barkod modülü 0,375 mm'yi geçmez, yalnızca genişlik gerektirirse incelir; barkod en az 10 mm yüksek kalır.
- **Baskı (tekli ve toplu):** `imposePdfs` ile her etiket sayfası seçilen sayfaya orantılı sığdırılır, büyütülmez, gerekirse çeyrek döndürülür. Aras ve Geliver'in kendi etiketi böylece aynı kâğıda basılır.
  - Hiçbir şey çizilmemiş etiket sayfası basılmaz, "okunamadı" sayılır.
  - Yerleştirilemeyen etiket yalnızca kendini düşürür.
- **Sipariş listesi:**
  - Kargoya verilmeden önce müşterinin seçtiği kargo ve etiket çıkıp çıkmayacağı gösterilir.
  - "Etiket hazır" siparişler seçilince etiketleri yeniden toplu yazdırılır; "Kargoya ver" yalnızca henüz verilmemişleri gönderir.

