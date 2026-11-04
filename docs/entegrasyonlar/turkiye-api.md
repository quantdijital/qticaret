# TürkiyeAPI: il, ilçe, mahalle ve köy verisi

Adres referans verisinin (`tr-address` modülü, adr/0008) kaynağı. Kullanıcının isteği (2026-11-04): "il ilçe belediye mahalle vs için veri apisi burası". Elle hazırlanmış örnek veri (6 il) yerine 81 ilin tamamı, her ilçe, mahalle ve köy.

## Servis
- **Adres:** `https://api.turkiyeapi.dev/v2` (testte `TURKIYEAPI_BASE_URL`; yalnız development/test'te kabul edilir). Anahtar yok, kimlik doğrulama yok.
- **Doğrulama:** `GET /v2/openapi.json` (API 2.0.3) ve `GET /v2/meta` 2026-11-04'te okundu.
- **Veri seti (2026-11-04):** sürüm `2025`, `lastUpdated` `2026-05-21`; 81 il, 973 ilçe, 1.377 belediye, 32.279 mahalle, 18.183 köy.
- **Kaynakları (`/meta`):** TÜİK MEDAS (yerleşim kimlikleri, adlar, nüfus), PTT Kargo (posta kodları), MSB Harita Genel Müdürlüğü (alan), Türk Telekom (alan kodları), OpenStreetMap (merkez koordinatları).

## Kullandığımız uçlar
| Uç | Ne için |
|---|---|
| `GET /v2/meta` | Veri seti sürümü, tarihi, koleksiyon sayıları. Senkronun başında ve sonunda okunur |
| `GET /v2/datasets/{provinces,districts,municipalities,neighborhoods,villages}.json` | Koleksiyonun tamamı, tek istekte (çıplak JSON dizisi; `ETag`, `Cache-Control: public, max-age=3600`). Şartlar toplu okuma için bunu önerir |
| `GET /v2/{koleksiyon}?limit=1000&offset=…&sort=id` | Veri seti dosyası alınamazsa yedek: sayfalı liste (`{ data, meta: { total, … } }`), yaklaşık 60 istek |

Kullanmadıklarımız: arama, tekil kayıt ve iç içe uçlar (`/provinces/{id}/districts` vb.), sürümlü dosya (`/datasets/2025/…`; sürüm `/meta`'dan okunup kaydedilir, son dosya indirilir).

## Okuduğumuz alanlar
| Koleksiyon | Alanlar |
|---|---|
| İl | `id` (= plaka kodu), `name` |
| İlçe | `id`, `name`, `provinceId` |
| Belediye | `id`, `name`, `type` (`province_center`, `district_center`, `town`), `districtId` |
| Mahalle | `id`, `name`, `districtId`, `municipalityId`, `postalCode` (5 hane), `postalCodeStatus` (`official`, `derived`, `estimated`) |
| Köy | `id`, `name`, `districtId`, `postalCode`, `postalCodeStatus` (`official`, `estimated`) |

Okumadıklarımız: nüfus, alan, rakım, koordinatlar, telefon alan kodları, bölge. Koordinatlar OpenStreetMap'ten (ODbL) gelir; saklamadığımız için ODbL yükümlülüğü doğmaz.

## Eşleme (`src/lib/tr-address/turkiyeapi/map.ts`)
| TürkiyeAPI | Bizde | Not |
|---|---|---|
| İl | `tr_province` | `code` = `id`, iki haneye tamamlanır ("06") |
| İlçe | `tr_district` | `external_id` = `turkiyeapi:district:<id>` |
| Mahalle | `tr_neighborhood`, `kind: neighborhood` | `external_id` = `turkiyeapi:neighborhood:<id>`. Belde (`town`) belediyesinin mahallesi "Fatih (Kırka)" adını alır: bir ilçede birden çok belde olabilir, mahalle adları tekrarlar ("Fatih" bir ilçede altı kez), posta kodları ayrıdır |
| Köy | `tr_neighborhood`, `kind: village` | "Alcalı Köyü" adıyla, ilçesine bağlı. Kırsal adresler için gerekir; aynı ilçedeki aynı adlı mahalleyle karışmaz. `external_id` = `turkiyeapi:village:<id>` |
| Belediye | (adres düzeyi değil) | Yalnız beldelerin adını mahalleye eklemek için okunur |
| `postalCode`, `postalCodeStatus` | `postal_code`, `postal_code_status` | Dosyadan gelen verinin durumu boş, resmi sayılır |

Vitrin sözleşmesi değişmedi: adreste `province` = il adı, `city` = ilçe adı, `address_2` = listedeki ad ("Fatih (Kırka)", "Alcalı Köyü"). Liste sırası harflere göre; parantez sayılmaz (Fatih, Fatih (Akın), Fatih (Kırka), Fatih Köyü).

## Posta kodları
- Mahallede ve köyde zorunlu, 5 hane. `official`: PTT verisinden doğrudan; `derived`: PTT'de kodu bilinen önceki yerleşimden türetilmiş; `estimated`: diğer açık kaynaklardan, komşu yerleşimlerden tahmin. 2026-11-04'te 112 mahalle `derived`/`estimated`, 21 köy `estimated`.
- **Doğrulama:** posta kodunun ilk iki hanesi her zaman ilin plakası olmalı. Mahallenin koduyla birebir eşleşme yalnız kod `official` (ya da dosyadan) ise aranır; türetilmiş/tahmini kodda müşterinin yazdığı kabul edilir.
- İlinin plakasıyla başlamayan posta kodlu kayıt içe aktarılmaz, rapora `postal_code_mismatch` olarak düşer.

## Senkron
- **Akış (`importTrAddressWorkflow`):** `/meta` → beş veri seti dosyası → tamlık denetimi (her koleksiyon `/meta`'daki sayı kadar, 81 il) → `/meta` yeniden (indirme sırasında sürüm değiştiyse iptal) → tek transaction'da içe aktarma + `tr_address_sync` kaydı → denetim kaydı (`tr_address.imported`).
- **Fark:** önce TürkiyeAPI kimliği, yoksa doğal anahtar (il plakası / ilçe adı / mahalle adı). Adı değişen ya da başka ilçeye taşınan yer güncellenir; veri setinde artık olmayan yer `is_active=false` olur, silinmez. Aynı veriyle ikinci senkron hiçbir şeyi değiştirmez.
- **Giriş noktaları:**
  - Panel: Ayarlar > Kargo ve teslimat > Adres verisi > "Şimdi güncelle" (yalnız sahip) → `POST /admin/tr-address/sync` → `tr_address.sync` işi; ilerleme ve rapor `GET /admin/tr-address/status` ile.
  - Haftalık iş (`tr-address-sync`, pazartesi 05:10): `/meta`'yı okur, mağazadaki sürümden farklıysa işi kuyruğa koyar.
  - Komut: `pnpm --filter @qticaret/backend tr-address:import source=turkiyeapi [if-changed]`.
  - Kurulum: `tenant:bootstrap` ve `seed:demo` hiç içe aktarma yapılmamış mağazada çalıştırır; ağ yoksa uyarıyla atlar.
- **Sıklık:** TürkiyeAPI veri setini yılda bir yeniler. Haftalık kontrol tek bir `/meta` isteğidir. Medusa'nın süreç içi zamanlayıcısı bir sonraki çalışmayı zamanlayıcıyla bekler; Node 24,8 günden uzun zamanlayıcıyı hemen çalıştırır, bu yüzden aylık zamanlama döngüye girer. Kontrol bu nedenle haftalıktır.

## Sınırlar ve hata durumları
- **Hız sınırı:** istemci başına dakikada 300, 5 dakikada 1.000 istek (README). Senkron 7 istek; yedek yol yaklaşık 60. 429 gelirse istemci `Retry-After`'a uyar.
- **İstemci:** platformun HTTP istemcisi (`src/lib/clients`): 60 sn zaman aşımı, yeniden deneme, devre kesici, sorgu ve gövde loglanmaz, en çok 64 MB yanıt. En büyük dosya mahalleninki; belediye dosyasından (1.377 kayıt, ~300 KB) tahminen 7-9 MB.
- **Hata kodları (panelde ve işin raporunda):** `tr_address.source_unavailable` (ulaşılamadı), `tr_address.dataset_incomplete` (eksik veri), `tr_address.dataset_changed` (indirme sırasında güncellendi). Hepsinde mağazanın verisi değişmez.

## Lisans ve şartlar
- **Lisans:** proje MIT (github.com/ubeydeozdmr/turkiye-api, `LICENSE`; OpenAPI `info.license`). Verinin ayrı bir lisansı yazılı değil.
- **Şartlar (docs.turkiyeapi.dev/tr/v2/guide/terms):** ücretsiz, anahtarsız. İzin verilen kullanım örnekleri arasında adres formları, konum seçicileri ve iç veri akışları sayılıyor. Yasak olanlar: aşırı yük, hız sınırını aşmaya çalışmak, istekte kişisel veri ya da secret göndermek, servisi resmi bir devlet hizmeti gibi sunmak. Yüksek hacim için veri seti indirmesi öneriliyor. Veri "olduğu gibi" verilir: SLA yok, doğruluk garantisi yok. Proje hiçbir kurumla bağlantılı değil.
- **Sonuç:** veriyi kendi veritabanımızda tutmak şartlarla uyumlu: haftada bir `/meta`, değişince bir kez indirme. Panelde kaynak adıyla belirtilir. İsteklere adres ya da kişi bilgisi girmez: yalnız sabit uç adresleri çağrılır.
- **Açık:** TÜİK/PTT kaynaklı verinin ticari kullanımı docs/12'deki avukat kalemi olarak kalır (kurulmuş şirket ve danışman yok, 2026-10-31).

## KVKK
Referans veri; kişi verisi değil. `docs/kvkk-envanter.md` değişmedi.

## Test
- Gerçek API'ye test isteği gitmez. `packages/testing/src/turkiyeapi/`: sahte TürkiyeAPI (aynı zarflar, `/meta`, veri seti dosyaları, sayfalı listeler; servis kapalı ve dosya hatası senaryoları) ve küçük sentetik veri seti (81 il, ilçe başına bir kayıt, belde ve köy örnekleri).
- Birim: eşleme, tamlık/sürüm denetimi, istemcinin yedek yolu, fark planı, komut argümanları. Modül: ad değişikliği, ad takası, taşınma, kaldırılıp aynı adla yeniden gelen yer, elle yüklenmiş örneğin devralınması. HTTP: `tr-address-sync.spec.ts`.
- Geliştirmede gerçek API kullanılır (herkese açık); `pnpm dev:turkiyeapi` yok.
