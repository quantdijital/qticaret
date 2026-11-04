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

## Ek: Medusa adres alanlarına eşleme ve doğrulama (F1 S5, 2026-10-24)
**Eşleme** (yalnızca `country_code = tr` adreslerde):
| TR kavramı | Medusa alanı | Not |
|---|---|---|
| İl | `province` | Ad ile yazılır (ör. "İstanbul"); kargo etiketi ve faturada okunur kalır |
| İlçe | `city` | |
| Mahalle | `address_2` | Storefront mahalleyi listeden seçer; daire/kat bilgisi `address_1`'e yazılır |
| Cadde/sokak, bina ve daire no | `address_1` | Serbest metin |
| Telefon | `phone` | E.164'e normalleştirilir (`+905321234567`) |

**Kurallar:**
- Doğrulama, adreste yazılanın tutarlılığını denetler; eksik alan istemez. Sepet, alıcı yazarken yalnızca ülke taşıyabilir. Zorunlu alanlar checkout'ta (F7) denetlenir.
- İl referans veride olmalı. İlçe ilin altında olmalı. İl verilmeden ilçe, ilçe verilmeden mahalle kabul edilmez.
- Mahalle denetimi yalnızca ilçenin mahalle verisi yüklüyse yapılır.
- Posta kodu: 5 hane, ilk iki hane ilin plaka kodu. Mahalle eşleşmişse posta kodu mahalleninkiyle aynı olmalı.
- Telefon TR formatında olmalı.

**Uygulandığı yer:**
- **Middleware:** `src/api/validation/tr-address.ts`, şu route'larda: `POST /store/customers/me/addresses[/:address_id]`, `POST /store/carts`, `POST /store/carts/:id`. Core'un gövde doğrulamasından sonra çalışır (`req.validatedBody`). Kısmi güncellemeyi kayıtlı adresle birleştirerek denetler.
- **Hata yanıtı:** 400 `{ type: "invalid_data", issues: [{ field, code }] }`. `code` storefront için i18n anahtarıdır (`tr_address.district_not_in_province` vb.).
- **İkinci savunma hattı:** `createCartWorkflow` / `updateCartWorkflow` `validate` hook'ları (`src/workflows/hooks/validate-cart-tr-address.ts`). Store API dışından gelen sepet işlemlerini de kapsar.
- **Müşteri adresleri:** Core'da `validate` hook'u yok. `createCustomerAddressesWorkflow.hooks.addressesCreated` ve `updateCustomerAddressesWorkflow.hooks.addressesUpdated` kaydı denetler; hata workflow'u düşürür ve compensation yazımı geri alır. Admin düzenlemeleri de kapsanır (`src/workflows/hooks/validate-customer-address-tr-address.ts`).

## İnceleme sonrası düzeltmeler (2026-10-24)
- **Türkçe karakter kullanılmadan yazılan adlar:** "Istanbul", "Kadikoy", "Caferaga Mah." gibi girdiler ASCII'ye katlanmış anahtarla eşleşir. Önce tam eşleşme aranır. Katlanmış eşleşme yalnızca tek bir yere çıkıyorsa kabul edilir; belirsizse adres reddedilir.
- **Sayfalama:** Store route'larında `limit` en fazla 100 (docs/04). Mahallesi 100'den çok olan ilçeler için istemci sayfalar.
- **Cache:** Yanıta `Vary: x-publishable-api-key` eklendi; paylaşılan bir cache anahtarsız isteğe cevap vermez.
- **Sorgu hata mesajları:** i18n anahtarıdır (`tr_address.province_code_invalid`, `tr_address.district_id_invalid`).

## Ek: Kaynak TürkiyeAPI (2026-11-04)
Kullanıcının isteği: "il ilçe belediye mahalle vs için veri apisi burası (docs.turkiyeapi.dev) ... mevcutta birkaç il var". Geliştirme veritabanındaki 6 il, testlerin elle hazırlanmış örneğiydi (`integration-tests/fixtures/tr-address.csv`), `tr-address:import` ile elle yüklenmişti; hiçbir seed onu yazmıyordu.

**Karar:** Adres verisinin kaynağı TürkiyeAPI v2'dir (MIT; ayrıntı, şartlar, sınırlar: docs/entegrasyonlar/turkiye-api.md). Dosya kaynağı operatör için kalır. Veri çalışma anında sorulmaz; içe aktarılıp bizde tutulur: alternatifler tablosundaki "harici adres API'si" itirazları (gecikme, adresin dışarı gitmesi) geçerliliğini korur.

- **Model:** `tr_district.external_id`, `tr_neighborhood.external_id`, `kind` (`neighborhood` | `village`), `postal_code_status` (`official` | `derived` | `estimated`; dosyada boş = resmi). Ad tekilliği yalnız etkin kayıtlarda (`WHERE deleted_at IS NULL AND is_active = true`): kaldırılmış bir yer, aynı adı alan yeni yerin yanında durabilir. Yeni tablo `tr_address_sync`: başarılı her içe aktarma (kaynak, veri seti sürümü ve tarihi, sayılar), içe aktarmayla aynı transaction'da yazılır.
- **Köyler** ilçenin altında `kind: village` yerleşimi olarak, "<ad> Köyü" adıyla. **Belde mahalleleri** "<ad> (<belde>)" adıyla: bir ilçede aynı adlı birden çok mahalle olabildiği için (ayrı belde, ayrı posta kodu). Belediye ayrı bir adres düzeyi değil. Medusa adres alanlarına eşleme (yukarıdaki Ek) değişmedi.
- **Fark:** önce kaynağın kimliği, yoksa doğal anahtar; kimliği girdide başka kayda ait olan kayıt adından alınmaz. Anahtarı değişen kayıtlar önce pasife alınır, sonra güncellenir; zincir halindeki ad değişiklikleri ve takaslar tekillik indeksine takılmaz. Sıra: kaldırılanlar, park edilenler, güncellemeler, yeniler; hepsi tek transaction'da.
- **Bütünlük:** TürkiyeAPI verisi yalnız tamsa (her koleksiyon `/meta`'daki sayı kadar, 81 il, indirme boyunca aynı sürüm) yazılır ve eksikleri pasifleştirir. Eksik veri, ulaşılamayan servis ya da indirme sırasında değişen sürümde mağazanın verisi değişmez.
- **Posta kodu doğrulaması:** il plakası kuralı her zaman. Mahalleyle birebir eşleşme yalnız resmi kodda; türetilmiş/tahmini kodda müşterinin yazdığı kabul edilir.
- **İş mantığı:** `importTrAddressWorkflow` (sürüm kontrolü → okuma + içe aktarma → denetim kaydı). Okuma adımları dışarıda bir şey değiştirmez. İçe aktarma tek transaction'dır ve tamamlanınca geri alınmaz: geri almak eski veri setini geri getirmek olurdu. Ardından yalnız ekleme yapan denetim kaydı gelir.
- **Giriş noktaları:** panel düğmesi (yalnız sahip, `trAddressSync` yeteneği; `POST /admin/tr-address/sync` bir `tr_address.sync` işi başlatır, hız sınırı sağlayıcı çağrılarınınki), `GET /admin/tr-address/status` (her rol), haftalık iş (`/meta` değişince işi kuyruğa koyar), `tr-address:import source=turkiyeapi`, `tenant:bootstrap` ve `seed:demo` (hiç içe aktarma yoksa; ağ yoksa uyarıyla atlar).
- **Sıklık:** "Yılda bir import" (Sonuçlar) yerine haftalık kontrol. Aylık zamanlama Medusa'nın süreç içi zamanlayıcısında döngüye girdiği için (Node 24,8 günden uzun zamanlayıcıyı hemen çalıştırır) haftalık seçildi; kontrol tek istektir.
- **Sıralama:** `sort_key` noktalama işaretlerini saymaz ("Fatih (Akın)" "Fatih Akın" gibi sıralanır). Etkisi yalnız noktalama içeren adlarda olur; bir sonraki içe aktarma bu adların anahtarını günceller.
- **Lisans kalemi (docs/12):** TürkiyeAPI MIT lisanslıdır ve şartları adres formlarında kullanımı açıkça sayar. TÜİK/PTT kaynaklı verinin ticari kullanımı avukat kalemi olarak açık kalır.
