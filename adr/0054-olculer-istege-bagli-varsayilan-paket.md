# ADR-0054: Ölçüler isteğe bağlı, kargo varsayılan paketle

- **Durum:** Kabul (2026-11-03)
- **Tarih:** 2026-11-03
- **İlgili:** ADR-0031 (kargo altyapısı, desi), ADR-0035 (Aras ve Yurtiçi), ADR-0042 (taşıma), docs/03 F3.1 ve F7.2, docs/14 P-DATA-05, docs/entegrasyonlar/yurtici.md

## Bağlam

F3.1 fiziksel ürünün her varyantı için ağırlık ve üç ölçüyü yayın şartı yapmıştı (`catalog.dimensions_required`). F7.2 de ölçüsü eksik ürünün kargo ücretini hesaplamıyordu (`shipping.dimensions_missing`). Sonuçları:

- Ölçüsüz ürün yayınlanamıyordu; katalog içe aktarmada reddediliyor, taşımada taslak geliyordu.
- WooCommerce mağazalarının çoğu ölçü girmediği için taşınan ürünlerin çoğu taslak kalıyordu.

Sahibin kararı (2026-11-03):

> "Fiziksel bir ürünü yayınlamak için her varyantın ağırlığı ve ölçüleri girilmeli. şu tarz zorunlulukları isteğe bağlı bırakabilirsin aynı şekilde kargo içinde her şeyi böyle zorunlu tutarsan çalışmamız zor olur. kargocu zaten desiyi kendisi özellikle hesaplar. müşteri hesaplamadan yollasa bile."

## Karar

1. **Ölçüler her yerde isteğe bağlı.**
   - Yayın ölçü beklemez. Yayın kuralı (`publish-rules.ts`, ürün kancaları, katalog adımı) kaldırıldı.
   - `catalog.dimensions_required` ve `shipping.dimensions_missing` anahtarları silindi.
   - Panelin yayına hazırlık listesinde ölçüler "önerilir"dir, zorunlu değildir.
2. **Varsayılan paket.**
   - Ayarlar > Kargo'da `shipping.default_parcel` (`weight`, `length`, `width`, `height`), mağazanın biriminde (g/kg, cm/mm).
   - Her değer sıfırdan büyük ve en çok 1.000.000 olmalı.
   - Kaydedilmemişken `null`. O zaman platformun paketi geçerlidir: **1 kg, 30 × 20 × 10 cm**, mağazanın birimine çevrilir.
   - Bu paket **2 desi** eder: hacim 6000 cm³ / 3000 = 2, ağırlık 1 kg. Türk taşıyıcılarının fiyat listelerinde küçük kolinin bandıdır.
   - Varsayılan `null` tutulur, sabit bir sayı tutulmaz. Böylece kg ya da mm kullanan mağazada "1000 kg" gibi bir yanlışlık olmaz.
3. **Kargo hesabı (`lib/shipping/parcel.ts`).**
   - Kalemde eksik olan her değer (boş ya da 0) varsayılan paketten alınır. Bu alan alan ve **birim başına** yapılır: 3 adet ölçüsüz ürün 3 varsayılan paket sayılır.
   - Yalnız ölçü olamayacak değer (sıfırdan küçük, sayı değil) `shipping.measures_invalid` ile durur.
   - Desi artık küçük kenarlı küpten değil, hacmin kendisinden hesaplanır. Önceden 30 × 20 × 10 cm'lik paket küpe çevrilince 2,1 desi ediyordu.
   - Tek adetlik koli kendi kutu şeklini korur. Birden çok adet, hacimleri toplanıp küp olarak gönderilir.
   - Kolideki her kalem kendi ölçüsünü taşıyorsa koli "ölçülü"dür (`Parcel.measured`).
4. **Taşıyıcılara ne gider.**
   - **Geliver:** fiyat listesi ve gönderi ölçü ister. Ürünün ölçüsü, yoksa varsayılan paket gider.
   - **Aras:** `VolumetricWeight` ve `Weight` alanlarına kolinin desisi ve ağırlığı gider. Ölçüsüz kalem için varsayılan paket kullanılır.
   - **Yurtiçi:** V3 belgesinde `desi` ve `kg` isteğe bağlıdır (H): yetki yoksa şube ölçer. Kolideki bir kalemin kendi ölçüsü yoksa ikisi de **gönderilmez**; uydurma değer gitmez. Bizim etiketimiz de yalnız gönderileni basar.
   - **Mağazanın ücret tablosu** (sepetteki fiyat) varsayılan paketle hesaplanır. Ürün sayfasının `shippingDetails` alanı da aynı ücreti gösterir. Dijital ve hizmet ürünlerinde kargo yoktur.
   - Akakçe beslemesindeki hacim ise yalnız ürünün kendi ölçüsünden gelir.
   - Taşıyıcı gerçek koliyi kendisi ölçer. Fark taşıyıcıyla mağaza arasındadır.
5. **İçe aktarma ve taşıma.**
   - Ölçüsüz satır artık reddedilmez ve taslağa çevrilmez; durumu tablonun ya da kaynağın durumudur.
   - İçe aktarma raporunda ürün satırına "Ölçü yok; kargo varsayılan paketle hesaplanır." notu düşer.
   - Taşımanın Notlar sayfasında da her ürün için `migration.product_no_parcel` notu düşer.
   - Taşımadaki "varsayılan paket" seçeneği isteğe bağlı bir kolaylık olarak kalır: verilen paket ölçüsüz ürünlerin kendi alanlarına yazılır.
6. **SEO advisor yalnız önerir.**
   - P-DATA-05 "yüksek"ten "düşük"e indi. Metni: "ölçü girilmezse kargo ücreti varsayılan pakete göre hesaplanır".
   - Yayın kapısı yalnız kritik bulgularda engeller. Bu kural hiçbir zaman engel değildir.
   - Kural sürümü 5 oldu: gece denetimi ürünleri yeniden puanlar.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Varsayılan paket, ölçü isteğe bağlı (seçilen)** | Yayın ve taşıma takılmaz; sepet her zaman ücret gösterir | Ölçüsüz üründe ücret tahmindir; fark taşıyıcı ölçünce çıkar |
| Ölçü zorunlu (önceki) | Ücret kesin | Sahip istemiyor; taşınan katalog taslak kalıyor |
| Ölçüsüz üründe sabit ücret | Basit | Ağır ya da büyük üründe çok yanlış; desi tablosuyla tutarsız |
| Yurtiçi'ye de varsayılan paketi göndermek | Tek kural | Belgeye göre alan isteğe bağlı ve şube ölçüyor: uydurma değer göndermek gereksiz |

## Sonuçlar

- Kargo ücretinin doğruluğu artık mağazanın varsayılan paketine bağlıdır. Panel bu paketin kaç desi ettiğini gösterir.
- Gösterge panelindeki "ağırlığı ya da ölçüsü eksik" sayacı bilgi olarak kalır.
- Önceden "ölçüsüz, taslak" gelmiş ürünler kendiliğinden yayına alınmaz. Sahip isterse yayınlar.
