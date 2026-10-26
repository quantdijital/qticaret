# ADR-0023: Fiyat geçmişi ve indirimli fiyat gösterimi (son 30 gün kuralı)

- **Durum:** Kabul edildi (2026-10-26, kullanıcı önerilen seçenekle onayladı; kural hukukçu teyidine bağlı, docs/12)
- **Tarih:** 2026-10-26

## Bağlam

F4.2 her varyant fiyat değişikliğinin kaydını, F4.3 indirimli üründe "son 30 günün en düşük fiyatı"nı ister. Fiyat Etiketi Yönetmeliği'nin indirimli satış hükmü (indirimden önceki fiyat = indirimden önceki 30 günde uygulanan en düşük fiyat) tasarım rehberidir; kesin kural avukatla teyit edilir. JSON-LD'deki üstü çizili fiyat (`StrikethroughPrice`, docs/13) **aynı kaynaktan** beslenir.

Medusa 2.21.2'de doğrulananlar (F4 planlaması, kaynak kodu):

- Fiyatlar Pricing modülünde `price` satırları; fiyat listesi fiyatları da `price` satırı.
- Modül olayları `pricing.price.created|updated|deleted` (ve `pricing.price_list.*`) yalnızca `{ id }` taşıyor; eski tutar yok. Çalışma anında yayıldıkları entegrasyon testiyle kanıtlanacak.
- Fiyat listesi workflow olayları (`price-list.prices_added` vb.) 2.21.2'de **yok**; 2.22.1'de geliyor.
- Fiyat listesinin `starts_at`/`ends_at` sınırı geçildiğinde hiçbir olay yok: satıştaki fiyat zamanla, yazma olmadan değişiyor.
- `calculated_price`: `sale` listesi varsayılan fiyattan düşükse kazanıyor, `original_amount` varsayılan fiyat kalıyor; `override` listesinde ikisi de liste fiyatı. Müşteri grubu fiyatları yalnızca o grubun bağlamında.

## Karar

- **Kaydedilen şey satıştaki fiyattır**, satırların kendisi değil: varyant ve para birimi başına, herkese açık bağlamdaki (müşteri grubu yok) `calculated_amount` ve `original_amount`. 30 gün kuralı müşterinin gördüğü fiyatla ilgilidir; ham satırlar zamanlı listeleri ve kural önceliğini anlatmaz.
- **Modül `price-history`, append-only** (stock-ledger gibi `refuseWrite`): `variant_id`, `currency_code`, `amount`, `original_amount`, `price_list_id` (satıştaki fiyatı veren liste, yoksa null), `reason` (`price_change` | `price_list` | `schedule` | `opening` | `reconcile`), `actor_id`, `recorded_at`. İndeks `(variant_id, currency_code, recorded_at)`.
- **Yakalama üç yoldan, hepsi aynı adıma:** "varyantın satıştaki fiyatını hesapla, son kayıttan farklıysa yaz" (aynıysa yazmaz; tekrar gelen olay zararsız):
  1. `pricing.price.*` ve `pricing.price_list.*` olaylarına subscriber; fiyat satırından varyant(lar) bulunur.
  2. Zamanlama işi (saatlik): son çalışmadan beri `starts_at`/`ends_at` sınırı geçen listelerin varyantları ve gece tam eşitleme.
  3. Açılış bakiyesi: migration script'iyle mağaza başına bir kez.
- **30 gün değeri:** "İndirimden önceki fiyat" = indirimin başladığı andan önceki 30 günde kaydedilen en düşük `amount`. İndirim başlangıcı, `amount < original_amount` durumunun kesintisiz başladığı kayıttır. Hesap `lib/pricing` içinde saf fonksiyon (fixture'lı test).
- **Store API:** ürün yanıtına `price_display` (varyant başına: güncel, liste fiyatı, indirimden önceki fiyat, indirimde mi). JSON-LD `StrikethroughPrice` aynı fonksiyondan.
- **Gösterim kuralı tek yerde:** hukukçu kuralı farklı teyit ederse (ör. pencere ya da başlangıç tanımı) yalnızca `lib/pricing` değişir.

## Alternatifler

| Seçenek                                 | Artı                                              | Eksi                                                                   |
| --------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **Satıştaki fiyatın geçmişi (seçilen)** | Kural doğrudan hesaplanır; zamanlı listeler dahil | Hesaplama maliyeti, saatlik iş                                         |
| Ham `price` satırlarının geçmişi        | Olaylarla birebir                                 | Zamanlı liste ve öncelik yeniden kurulmalı; olay eski tutarı taşımıyor |
| Medusa 2.22'yi bekle (liste olayları)   | Daha zengin olaylar                               | Zamanlama sınırı yine olaysız; yükseltme ayrı PR                       |
| Yalnızca gece anlık görüntüsü           | Basit                                             | Gün içi indirim kaçar; 30 gün hesabı günlük çözünürlükte kalır         |

## Sonuçlar

- Hukukçu teyidi gelene kadar kural varsayılan tanımla çalışır, Store API'de `price_display.rule_version` ile işaretlenir.
- Müşteri grubu fiyatları geçmişe girmez (herkese açık değil); B2B (F19) gerekirse ayrı karar.
- Medusa 2.22 yükseltmesinde (en erken 2026-11-06) liste olayları subscriber'a eklenir; zamanlama işi kalır.
- Panel ürün sayfasında "fiyat geçmişi" grafiği ve indirim uyarısı ("bu indirim, 30 günün en düşük fiyatına göre gösterilecek") F4 panel işinde.
