# ADR-0086: Varyantın indirimli fiyatı (WooCommerce "İndirimli fiyat" ve "Zamanla")

- **Durum:** Kabul (otonom, gözden geçir; sahibin isteği 2026-11-25)
- **Tarih:** 2026-11-25
- **İlgili:** adr/0023 (fiyat geçmişi, indirim öncesi fiyat kuralı, 10 gün), adr/0010 (kuruş), adr/0037 §6 (Medusa kaydına `metadata` ile sahiplik işareti), adr/0068 (toptan fiyat listeleri), adr/0066 (yayımlanmış biçim sözleşmesi), docs/13 (JSON-LD), docs/12 (hukuk teyidi).
- **Dayanak:** sahip (2026-11-25): "WooCommerce'deki gibi indirimli fiyat alanı ekle": varyant başına "Normal fiyat" ve "İndirimli fiyat", isteğe bağlı başlangıç ve bitiş tarihiyle.

## Bağlam (kod, 2026-11-25 `dev`)

- Ayrı bir "indirimli fiyat" alanı yok. İndirim bugün iki yoldan gelir: panelin **Fiyat listeleri** ekranı (Medusa `sale` listesi, F4.1) ve herkese uygulanan otomatik kampanya (adr/0023 Ek 2026-11-05).
- Vitrindeki üstü çizili fiyat Medusa'nın `original_amount`'ı değildir: **satıştaki fiyatın geçmişinden** (`price-history` modülü) indirim öncesi kuralıyla (indirimden önceki 10 günün en düşüğü, `tr-10d-1`) hesaplanır (`lib/pricing/display.ts`, `priceDisplays`). Kart, ürün sayfası, JSON-LD (`StrikethroughPrice`), ürün akışları (`g:price`/`g:sale_price`), `/kampanyalar` ve GA4 hep bu tek kaynaktan okur.
- Geçmiş, Medusa'nın `calculated_price`'ını (herkese açık bağlam) kaydeder; fiyat ve fiyat listesi olaylarıyla, liste sınırlarını dakikalık işle (`jobs/price-list-boundaries.ts`) ve saatlik kontrolle yakalar. Yani zamanlı bir `sale` listesi bugün de geçmişe, vitrine ve sepete doğru yansır.
- Medusa 2.22.6 (kaynak doğrulandı): `sale` listesi yalnız varyantın kendi fiyatından düşükse kazanır, `original_amount` kendi fiyat kalır; birden çok `sale` listesinde en düşüğü kazanır; liste tarihleri fiyat hesabında (sepet dahil) uygulanır. Ürünün `variants.prices` okuması liste fiyatlarını içermez (`populateWhere: { prices: { price_list_id: null } }`), `updatePriceSets` liste fiyatlarına dokunmaz: panelin "Normal fiyat" kaydı indirimli fiyatı silmez.

## Karar

1. **Saklama: varyant başına bir Medusa `sale` fiyat listesi.** Listenin `starts_at`/`ends_at`'ı indirimin günleridir, tek fiyatı mağazanın para birimindedir (mağazanın varsayılan para birimi; Fiyat listeleri indirimiyle aynı). Liste `metadata: { managed_by: "variant_sale", variant_id }` ile işaretlenir; adı "Ürün · Varyant".
   - Neden varyant başına: Woo'da zamanlama varyant başınadır ve Medusa'da tarih fiyatın değil listenin alanıdır. Ürün ya da mağaza başına tek liste, farklı günlerde biten varyantları taşıyamaz.
   - Neden metadata değil liste: fiyat istemciden alınmaz, Medusa'nın kendi fiyat hesabı (sepet, ödeme) indirimli fiyatı ancak bir fiyat satırı olarak bilir. Liste olunca sepet, geçmiş, gösterim, dizin, akışlar ve JSON-LD **hiç değişmeden** doğru çalışır.
2. **Yazma tek yerden:** `POST /admin/products/:id/sale-prices` (`set` / `clear`, en çok 500 varyant) → `setVariantSalesWorkflow`. Tutar ya da yüzde alınır; yüzde sunucuda varyantın kendi fiyatından hesaplanır (yarım yukarı kuruşa, adr/0010). Doğrulama: varyant o ürünün; kendi fiyatı var; indirimli fiyat > 0 ve **kendi fiyatından düşük** (eşit ya da yüksek değer indirim değildir, Medusa zaten o fiyattan satmaz); bitiş başlangıçtan sonra ve geçmemiş. Değişmeyen indirim yeniden yazılmaz.
   - Sıra: yeni liste önce yapılır, eskisi sonra silinir (ara anda tam fiyata düşmez); Medusa'nın `createPriceListsWorkflow` ve `deletePriceListsWorkflow`'u kendi telafileriyle geri alınır (yapılan silinir, silinen geri gelir). Ürün başına kilit (çift tık).
   - Okuma: `GET /admin/products/:id/sale-prices` her varyantın kendi fiyatını ve süren ya da gelecek indirimini verir; bitmiş indirim yok sayılır.
3. **Hukuki referans fiyat değişmez.** Üstü çizili fiyat "Normal fiyat" değildir; adr/0023 kuralıyla geçmişten gelir. Normal fiyatı indirimden hemen önce artırılmış ürün, normal fiyatı ne olursa olsun son 10 günün en düşüğüyle gösterilir ya da hiç indirimli gösterilmez. Panel bunu indirimli fiyat alanının yanındaki ipucuyla söyler; mevcut "Fiyat geçmişi" bölümü nedenini gösterir.
4. **Kampanya ve listelerle etkileşim:** Aynı varyantı fiyatlayan başka bir `sale` listesi (Fiyat listeleri ekranı) varsa Medusa **düşük olanı** satar; otomatik kampanya indirimli fiyatın üstüne uygulanır (sepette olduğu gibi). Toptan (`override`, müşteri grubu) listeleri herkese açık fiyatı değiştirmez. Fiyat listelerinin çakışma uyarısı (`/admin/price-lists/:id/lines`) varyantın indirimini adıyla gösterir.
5. **Fiyat listeleri ekranı:** varyant indirim listeleri Medusa'nın `GET /admin/price-lists` cevabından çıkarılır (toptan listeleri gibi) ve Medusa'nın liste yazma yollarına kapalıdır (`409 variant_sale.managed`): yalnız ürün sayfasından değişir.
6. **Yetki ve denetim:** yazma sahip ve yöneticinin (`operations` hayır; fiyat listesi indirimi gibi). Denetim kaydı ürün için `variant:<id>:sale` → "80.00 try başlangıç/bitiş" önce/sonra yazar.
7. **Vitrin:** değişiklik yok. `price-display` indirimli fiyatı `current`, kurala göre önceki fiyatı `before` olarak verir; Atölye'nin mevcut "%X indirim" rozeti ve üstü çizili fiyatı bunu çizer (adr/0066: yayımlanmış biçimlere dokunulmaz).
8. **Akış ve JSON-LD:** Google/Meta akışı `g:sale_price`'ı ve JSON-LD teklifinin `price` / `StrikethroughPrice`'ını bugün de `priceDisplays`'den yazar; indirimli fiyat kendiliğinden girer.

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Varyant başına `sale` listesi (seçilen)** | Sepet, geçmiş, gösterim, akış değişmeden doğru; zamanlama Medusa'da | Liste sayısı indirimdeki varyant kadar; ekrandan gizleme gerekir |
| Ürün ya da mağaza başına tek liste | Az kayıt | Varyant başına tarih yok |
| Varyant `metadata`'sında fiyat | Basit okuma | Sepet ve ödeme bilmez; fiyatı ikinci bir yerde hesaplamak gerekir (altın kural 5) |
| Fiyat kuralı (`price_rules`) | Tek fiyat seti | Kuralda tarih yok; bağlamsız fiyat hesabında eşleşmez |

## Sonuçlar ve açıklar

- Silinen ürünün listesi boş kalır (fiyat seti gider); gizli olduğu için zararsız, ayrı temizlik işi gerekmez.
- **Açık:** `priceValidUntil` (docs/13) ve Google `sale_price_effective_date` henüz yazılmıyor: `PriceDisplay`'e satıştaki listenin bitişini eklemek ayrı bir iş. Akış her yenilemede doğru fiyatı yazar; bitişle akış yenilemesi arasında Google eski indirimli fiyatı görebilir.
- **Açık:** dakikalık sınır işi bir dakikadan kısa süren indirimi kaçırabilir (adr/0023'teki bilinen sınır).
- Hukuk: indirim öncesi fiyat kuralının avukat teyidi docs/12'de sürüyor; bu karar kuralı değiştirmez.
