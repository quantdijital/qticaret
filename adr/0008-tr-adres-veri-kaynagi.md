# ADR-0008: Türkiye adres referans verisi (il/ilçe/mahalle) kaynağı ve modeli

- **Durum:** Kabul edildi (2026-10-24, F1 S3). Veri setinin lisansı docs/12'de avukatta açık.
- **Tarih:** 2026-10-24

## Bağlam
`tr-address` modülü 81 il, ~970 ilçe ve ~32 bin mahalleyi posta kodlarıyla tutar. Bu veri F1.4 adres doğrulamasının ve storefront adres formlarının temelidir.

Araştırma (2026-10-24) sonucu:
- Resmi ve açık lisanslı (indirilebilir) bir PTT veri seti doğrulanamadı.
- Mevcut kaynaklar PTT/TÜİK verisinden derlenmiş üçüncü taraf projeler (GitHub, Kaggle), lisansları farklı.
- Posta kodu 5 hanelidir ve ilk iki hanesi il plaka kodudur. Bu kural veri setinden bağımsız doğrulanabilir.

## Karar
- **Kaynaktan bağımsız import:** `src/scripts/import-tr-address.ts` normalleştirilmiş bir CSV/JSON alır (il, ilçe, mahalle, posta kodu, kaynak kimliği). Her kaynak için küçük bir adaptör yazılır.
- **Veri dosyası repoya girmez**, lisans netleşene kadar. Operatör dosyayı provisioning sırasında sağlar (F16 tenant bootstrap). Repoda yalnızca testler için küçük, elle hazırlanmış bir **fixture** (birkaç il/ilçe/mahalle) bulunur.
- **İdempotent import:** Doğal anahtar il kodu / ilçe adı / mahalle adı ile upsert yapılır. Kaldırılan kayıtlar silinmez, `is_active=false` olur; eski adresler bozulmaz.
- **Toplu yükleme:** Servisin dizi alan `createX` metotlarıyla, partiler halinde. Performans yetmezse `@InjectManager` ile ham SQL'e geçilir (F1.3'te ölçülecek).
- **Model:**
  - `tr_province` (plaka kodu, ad)
  - `tr_district` (ad, il) → `(province_id, name)` üzerinde unique
  - `tr_neighborhood` (ad, posta kodu, ilçe) → `(district_id, name)` üzerinde unique
  - Ad alanları `searchable`.
- **Store API:** `GET /store/tr-address/provinces|districts?province=|neighborhoods?district=`, publishable key zorunlu (Medusa varsayılanı), sayfalı. Yanıtlar referans veri olduğu için HTTP cache başlıklarıyla döner. Medusa'nın caching modülü feature flag arkasında, şimdilik kullanılmıyor.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **Kaynaktan bağımsız import, veri repoda değil** | Lisans riski yok, kaynak değiştirilebilir | Provisioning'de dosya sağlanmalı |
| Üçüncü taraf veri setini repoya koymak | Kurulum kolay | Lisans/güncellik riski; repo şişer |
| Harici adres API'si (çalışma anında) | Hep güncel | Dış bağımlılık, gecikme, KVKK (adres dışarı gider), maliyet |

## Sonuçlar
- docs/12'ye "adres referans verisi kaynağı ve lisansı" kalemi eklendi (avukat). Canlı öncesi (F16) netleşmeli.
- Veri güncelliği: yılda bir import ve değişiklik raporu (yeni / pasifleşen mahalle).

## Uygulama (F1 S3)
- **Modül:** `src/modules/tr-address`. `match_key` (Türkçe büyük harf, mahallede "Mah./Mahallesi" eki atılır) eşleştirme ve tekillik içindir. `sort_key` (iki haneli kodlar) Türkçe alfabetik sırayı veritabanı collation'ından bağımsız kılar.
- **Import:** `pnpm --filter @qticaret/backend tr-address:import <dosya.csv|json> [--deactivate-missing]`.
  - Tek transaction.
  - Hatalı satır diğerlerini bozmaz, gerekçe koduyla raporlanır: `postal_code_mismatch`, `invalid_province_code`, `province_name_conflict`, `neighborhood_postal_code_conflict`, `invalid_shape`.
  - Pasifleştirme yalnızca `--deactivate-missing` ile yapılır: kısmi bir dosya ülkenin geri kalanını pasifleştirmesin.
- **Ölçüm (2026-10-24, yerel Postgres 16):** 32.076 mahalle (81 il × 12 ilçe × 33 mahalle, sentetik), ilk yükleme ~4,3 sn, değişmeyen veriyle yeniden yükleme ~1,6 sn. Servisin toplu `create/update` metotları yeterli, ham SQL gerekmedi.
- **Satır kaynak kimliği:** Satıra yazılmıyor. Kaynak adı import komutunun loguna düşer; gerekirse F16'da eklenir.
