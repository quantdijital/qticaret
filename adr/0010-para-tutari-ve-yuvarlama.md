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
