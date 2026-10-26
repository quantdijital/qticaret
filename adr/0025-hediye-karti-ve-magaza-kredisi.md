# ADR-0025: Hediye kartı ve mağaza kredisi

- **Durum:** Kabul edildi (2026-10-26, kullanıcı önerilen seçenekle onayladı; vergi yönü mali müşavir teyidine bağlı, docs/12)
- **Tarih:** 2026-10-26

## Bağlam

F4.8: hediye kartı / mağaza kredisi çekirdekte ya da resmi eklentide varsa kullanılır, yoksa özel modül yazılır.

Medusa 2.21.2'de doğrulananlar (F4 planlaması):

- Çekirdekte hediye kartı ya da mağaza kredisi modülü yok.
- Resmi eklenti `@medusajs/loyalty-plugin`: 2.21.2 sürümü npm'de, MIT lisanslı. Peer bağımlılıkları Medusa 2.21.2'ye birebir sabit; en yenisi 2.22.1. İçinde `loyalty` (hediye kartı) ve `store-credit` modülleri var. Medusa Cloud şartı yok.

## Karar

- **Resmi eklenti kullanılır:** `@medusajs/loyalty-plugin@2.21.2` (exact; Medusa yükseltmesiyle birlikte yükseltilir). Kendi modülümüz yazılmaz.
- **Bayrakla açılır:** `promotions.gift_cards` (varsayılan kapalı). Kapalıyken eklentinin Store/Admin uçları 404 (`requireFeature` deseni).
- **Kapsam (F4):** panelden hediye kartı oluşturma ve bakiye görme, checkout'ta kullanma, iadede mağaza kredisine dönüş. Hediye kartının **satışı** (müşterinin ürün gibi satın alması) ve e-postayla gönderimi F9 bildirimleriyle.
- **Tutar:** eklentinin tutarları `lib/money` sınırından geçer; kısmi kullanım ve iade dağıtımı F4.7'nin dağıtım fonksiyonunu kullanır.
- **Güvenlik:** kart kodu en az 16 karakter, rastgele; kod denemesi `coupon` hız profiliyle sınırlanır; bakiye sorgusu kimlik başına sayılır.

## Alternatifler

| Seçenek                     | Artı                                                     | Eksi                                                              |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Resmi eklenti (seçilen)** | Medusa'nın sepet ve ödeme akışına bağlı; bakım Medusa'da | Sürüm kilidi (2.21.2); eklentinin davranışına bağımlılık          |
| Kendi modülümüz             | Tam denetim, TR'ye özel kurallar                         | Sepet, ödeme ve iade entegrasyonu baştan; yüksek bakım            |
| F4 dışına ertelemek         | F4 kısalır                                               | KK dışı ama yol haritasında F4'te; ilk müşteride ihtiyaç belirsiz |

## Sonuçlar

- Hediye kartı satışının vergi ve e-fatura karşılığı (satışta mı, kullanımda mı KDV) mali müşavirle teyit edilir; teyide kadar yalnızca panelden verilen kart ve iade kredisi açılır (satış kapalı).
- Eklenti yeni bağımlılık: kurulum kendi oturumunda, exact sürüm ve ≥14 gün kuralıyla (2.21.2 bu şartı sağlıyor).
- Medusa 2.22 yükseltmesi eklentiyle birlikte yapılır.
