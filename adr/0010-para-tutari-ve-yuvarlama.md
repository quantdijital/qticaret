# ADR-0010: Para tutarı temsili, yuvarlama ve oransal dağıtım (`lib/money`)

- **Durum:** Kabul edildi (2026-10-24, F2 S1)
- **Tarih:** 2026-10-24

## Bağlam

F4 (indirim dağıtımı, fiyat geçmişi), F5/F6 (ödeme, kısmi iade) ve F8 (fatura satırları) aynı tutar aritmetiğine dayanır.
docs/10 float aritmetiğini yasaklar ve tek bir para modülü ister. docs/07 "kısmi iadede kuruş farkı oluşmaz" senaryosunu zorunlu tutar.

Medusa 2.21.2'de doğrulananlar (F2 planlaması):

- **Temsil:** Tutarlar **ana birimde ondalık** tutulur (`20.5` = 20,50 TL). `model.bigNumber()` iki kolon üretir: `numeric` ve asıl kaynak olan `raw_<ad>` (`{ value, precision: 20 }`).
- **Yardımcılar:** `BigNumber` ve `MathBN` (bignumber.js tabanlı) `@medusajs/framework/utils`'ten gelir. API yanıtları tutarı `number` olarak serileştirir.
- **TRY:** `decimal_digits: 2`, `rounding: 0`. Medusa global bir yuvarlama kuralı koymuyor; `MathBN.convert(x, 2)` bignumber.js varsayılanı ROUND_HALF_UP'ı (eşitlikte sıfırdan uzağa) kullanır.

## Karar

- **İç temsil kuruştur:** `Kurus` markalı bir tam sayı tipi (`number`, `Number.isSafeInteger` ile korunur). Toplama, çıkarma ve dağıtım yalnızca kuruşla yapılır.
- **Medusa sınırında dönüşüm:**
  - `fromMedusaAmount(BigNumberValue | raw)` → `Kurus`. `MathBN` ile yapılır; `number` üzerinden geçmez.
  - İkiden fazla ondalığı olan bir tutar sessizce yuvarlanmaz. Çağıran açıkça `round` seçmezse hata fırlatılır.
  - `toMedusaAmount(Kurus)` → ana birim (string/BigNumber).
  - Sağlayıcıya özgü biçimler (ör. iyzico string tutarı) yine yalnızca provider sınırında üretilir (apps/backend/CLAUDE.md).
- **Yuvarlama:** Tek kural **yarım yukarı, sıfırdan uzağa** (ROUND_HALF_UP; Medusa/bignumber.js ile aynı). Oranlar baz puan (`bps`, %20 = 2000) olarak verilir; oran ile çarpma tam sayı aritmetiğiyle yapılır, sonra bu kurala göre yuvarlanır.
- **Oransal dağıtım:** En büyük kalan yöntemi (Hamilton) kullanılır.
  - Parçaların toplamı her zaman girdiye eşittir.
  - Kalan kuruşlar en büyük kesirli paya, eşitlikte büyük ağırlığa, o da eşitse ilk sıraya verilir. Sonuç deterministiktir.
  - Ağırlıkların hepsi sıfırsa tutar eşit bölünür. Negatif ağırlık hata verir. Negatif tutar (iade) işaret korunarak dağıtılır.
- **Kapsam dışı:** KDV dahil fiyattan matrah ayırma ve satır vergisi hesabı F4/F8'de bu ilkellerle yazılır. `lib/money` vergi bilmez.

## Alternatifler

| Seçenek                             | Artı                                                | Eksi                                                                                           |
| ----------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Kuruş tam sayı + sınırda MathBN** | Kuruş kaybı imkânsız, test etmesi kolay, JSON dostu | Her sınırda dönüşüm gerekir                                                                    |
| Her yerde Medusa `BigNumber`        | Dönüşüm yok                                         | Dağıtımda kuruş kaybı yine elle çözülür; ondalık hassasiyet hataları gizlenir                  |
| `bigint` kuruş                      | Sınırsız büyüklük                                   | JSON'a serileşmez; TRY tutarları `Number.MAX_SAFE_INTEGER` (~90 trilyon TL) sınırına yaklaşmaz |
| Banker's rounding (yarım çifte)     | İstatistiksel olarak yansız                         | Fatura ve muhasebe pratiğiyle uyumsuz olabilir; Medusa'nın davranışından sapar                 |

## Sonuçlar

- Yuvarlama kuralı ve kalem bazlı indirim dağıtımının faturada nasıl görüneceği mali müşavirle teyit edilir (docs/12). Kural değişirse tek yer `lib/money`'dir.
- F4.7 indirim dağıtımı, F5/F6 kısmi iade ve F8 fatura satırları bu modülü kullanır. Uç durum testleri (1 kuruşu 3'e bölme, sıfır ağırlık, tek kalem, negatif tutar) S1'de yazılır.
- **Ardışık kısmi iadeler:** `allocateKurus` her çağrıda bağımsız yuvarlar. Bu yüzden ayrı ayrı yapılan dağıtımlar satır bazında kayabilir: `1` kuruşu `[1, 1]` ağırlıkla iki kez dağıtmak `[2, 0]` verir. Toplam doğru kalır, ama bir satırın iadesi o satırın payını aşabilir.
  - En büyük kalan yöntemi toplam arttıkça monoton değildir (Alabama paradoksu). Bu nedenle "kümülatif dağıt, farkı al" yaklaşımı da tek başına güvenli değildir.
  - F4.7 ve F6 kısmi iadeyi, satır başına iade edilebilir kalan tutarı tavan alan bir dağıtımla yazar ve docs/07 senaryosuyla test eder.

## Uygulama (F2 S1)

- **Kod:** `apps/backend/src/lib/money/`.
  - `kurus.ts`: `Kurus` tipi, toplama/çıkarma, `multiplyByRateBps`.
  - `allocate.ts`: `allocateKurus`.
  - `medusa.ts`: `fromMedusaAmount`, `toMedusaAmount`.
- **Ara hesap:** Oran çarpımı ve dağıtım ara hesapları `BigInt` ile yapılır. `amount × bps` 2^53'ü aşsa da sonuç kesin kalır (testli).
- **Medusa sınırı:**
  - `fromMedusaAmount` Medusa'nın `MathBN.convert`'inin kabul ettiği her biçimi okur: number, string, raw `{ value, precision }`, `BigNumber`.
  - Kuruş altı hane varsa hata verir; yuvarlama yalnızca `allowRounding` ile yapılır. Örneğin `0.1 + 0.2` (float gürültüsü) sessizce 30 kuruşa dönmez.
  - MathBN `null`/`undefined`'ı 0, `"0x10"`'u 16, `"1e2"`'yi 100 olarak okur. `fromMedusaAmount` bunları reddeder: eksik tutar (ör. sorguda seçilmemiş alan) 0 kuruş olarak işlenmez. String girdi yalnızca düz ondalık olabilir.
  - `toMedusaAmount` `"20.50"` biçiminde string döner.
- **Kanıt:** `src/lib/money/__tests__/` (55 test). Dağıtımda tohumlu 1000 rastgele vaka çalıştırılır: toplam korunur ve her parça tam paydan 1 kuruştan az sapar. Diğer testler: yarım kuruşta sıfırdan uzağa yuvarlama, eşitlik kuralları, negatif tutar, gidiş-dönüş.

## Uygulama (F4.7)

- **Satır payları (`lib/orders/shares.ts`):** Medusa indirimi kalemlere kuruş altı haneyle dağıtır (%10 × 33,33 = 3,333). `lineShares` bunları kuruşa çevirir:
  - Fiyatlar Medusa'nın tam tutarlarına göre bölünür; kuruşlu fiyat olduğu gibi kalır.
  - İndirim tam paylarına göre dağıtılır, her satırda satır fiyatı tavandır.
  - Ödeme, fiyattan indirim düşülerek bulunur. Ödemelerin toplamı, siparişin yarım yukarı yuvarlanmış toplamına eşittir.
- **`lib/money` ekleri:**
  - `allocateCappedKurus`: tavanlı dağıtım. Tavanını aşan parça tavanda sabitlenir; kalan, diğerlerine ağırlıklarıyla dağıtılır.
  - `prorateKurus`: oransal pay, yarım yukarı.
  - `weightOfMedusaAmount`: Medusa tutarını milyonda bir lira cinsinden ağırlığa çevirir, kuruş altı haneleri korur.
- **Saklanan değer:** Hesaplanan toplamlar Medusa'nın sakladığı ham değerle (20 hane) alınır, iç değeriyle alınmaz. İç değerde bölme artığı kalır (90,045 → 90,04499…988), bu da yarım kuruşu Medusa'nın tahsil ettiğinin tersine yuvarlar. Sorgu tutarları da `raw_*` alanlarından okunur.
- **Sonraki kargolar:** İade, değişim ve talep kargoları paylara girmez. Bunlar müşterinin ödediği tutar değil, mağazanın sonraki gideridir.
- **Tam adet:** Satır tutarları Medusa'nın kendi formülüyle (`getLineItemTotals`, `getShippingMethodTotals`) `detail` verilmeden hesaplanır. Medusa'nın siparişteki `total`'ı iade edilen adetleri düşer; paylar düşmez, yoksa her iade bir sonrakini kaydırırdı.
- **Sürüm tuzağı:** Medusa her sipariş değişikliğinde (karşılama, gönderi, iade) ayarlamaları yeni sürüme kopyalar. Query bütün kopyaları döner; okuyucu güncel sürümünkileri alır. Medusa'nın kendi sipariş okumaları da böyle yapar. Entegrasyon testinde teslim edilmiş sipariş dört kopya taşıyordu.
- **Birim iadesi (`lib/orders/refunds.ts`):** İade kümülatif hesaplanır: n birimin ödediğinden n − 1 birimin ödediği düşülür (`prorateKurus`). Böylece birimler nasıl gruplanırsa gruplansın satırın iadeleri satırın ödemesine eşit olur. Satır başına ayrı defter gerekmez: Medusa siparişin değişikliklerini sırayla yürütür, iade de teslim alınmadan önce hesaplanır.
- **Serbest tutar:** İyi niyet iadesi ya da sonradan düzeltilen fiyat gibi tutarlar `spreadRefund` ile satırların kalanına göre dağıtılır. `allocateCappedKurus` hiçbir satırı kalanının üstüne çıkarmaz, böylece satır satır iade yapan sağlayıcı (iyzico) reddetmez. Satır başına kalanın kaydı F5'te ödeme sağlayıcısının işlem eşlemesiyle tutulur.
- **İade edilebilir tutar:** Ödemelerin tahsil edilen − iade edilen toplamıdır. Medusa'nın `refundPaymentWorkflow` sınırıyla aynıdır.
- **Uç:** `GET /admin/orders/:id/money`. Panelin sipariş sayfası satır ödemelerini, indirim paylarını, toplamları ve iade edilebilir tutarı buradan gösterir.
- **Kanıt:** `lib/orders/__tests__/` (tohumlu 500 rastgele sipariş: toplam korunur, indirim fiyatı aşmaz, satır Medusa'dan 2 kuruştan az sapar), `lib/money/__tests__/capped.unit.spec.ts` (1000 rastgele vaka: tavan aşılmaz, toplam korunur), `integration-tests/http/order-money.spec.ts` (KK).
