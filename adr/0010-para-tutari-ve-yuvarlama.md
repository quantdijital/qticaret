# ADR-0010: Para tutarı temsili, yuvarlama ve oransal dağıtım (`lib/money`)

- **Durum:** Önerildi (F2 S1'de karara bağlanacak)
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
| Seçenek | Artı | Eksi |
|---|---|---|
| **Kuruş tam sayı + sınırda MathBN** | Kuruş kaybı imkânsız, test etmesi kolay, JSON dostu | Her sınırda dönüşüm gerekir |
| Her yerde Medusa `BigNumber` | Dönüşüm yok | Dağıtımda kuruş kaybı yine elle çözülür; ondalık hassasiyet hataları gizlenir |
| `bigint` kuruş | Sınırsız büyüklük | JSON'a serileşmez; TRY tutarları `Number.MAX_SAFE_INTEGER` (~90 trilyon TL) sınırına yaklaşmaz |
| Banker's rounding (yarım çifte) | İstatistiksel olarak yansız | Fatura ve muhasebe pratiğiyle uyumsuz olabilir; Medusa'nın davranışından sapar |

## Sonuçlar
- Yuvarlama kuralı ve kalem bazlı indirim dağıtımının faturada nasıl görüneceği mali müşavirle teyit edilir (docs/12). Kural değişirse tek yer `lib/money`'dir.
- F4.7 indirim dağıtımı, F5/F6 kısmi iade ve F8 fatura satırları bu modülü kullanır. Uç durum testleri (1 kuruşu 3'e bölme, sıfır ağırlık, tek kalem, negatif tutar) S1'de yazılır.
