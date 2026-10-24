# ADR-0009: Müşteri vergi kimliği (TCKN / VKN) saklama ve gösterimi

- **Durum:** Kabul edildi (2026-10-24, F1 S7)
- **Tarih:** 2026-10-24

## Bağlam
Fatura için müşteri bilgileri gerekir (F8, docs/entegrasyonlar/e-fatura.md):
- **Bireysel müşteri:** TCKN
- **Kurumsal müşteri:** VKN + vergi dairesi

docs/04 şu kuralları koyar:
- TCKN loglarda ve admin listelerinde maskeli olmalı, detayda yetkiye bağlı açılmalı.
- Okuma işlemi audit log'a düşmeli (F2.5).
- Gerekirse uygulama katmanında AES-256-GCM ile şifrelenmeli.

Medusa 2.21.2'de doğrulananlar:
- **Store route'ları:** Store'daki müşteri route'ları (`POST /store/customers`, `/store/customers/me`) `additional_data` taşımıyor.
- **Admin müşteri listesi:** Sütunları genişletilemiyor; detay sayfasında `customer.details.*` widget bölgeleri var.
- **Bağlantı:** Müşteriye `defineLink` ile özel bir modül bağlanabilir.

## Karar
- **Ayrı modül:** `billing-profile` modülü kurulur. Müşteri ile 1-1 link kurulur, `metadata` kullanılmaz.
  - Alanlar: `type` (bireysel/kurumsal), `legal_name`, `tax_office`, `tax_id_encrypted`, `tax_id_hash`, `tax_id_last4`.
- **Şifreleme:**
  - **Saklama:** TCKN/VKN, `PII_ENCRYPTION_KEY` (env şemasına eklenir, ≥32 bayt) ile **AES-256-GCM** kullanılarak şifreli saklanır. Kayıtta anahtar sürümü (`key_version`) tutulur, böylece anahtar döndürmeye hazır olur.
  - **Arama:** Eşitlik araması ve tekillik kontrolü için ayrı bir anahtarla HMAC-SHA256 tutulur.
  - **Gösterim:** Maskeli gösterim için `last4` saklanır.
- **Doğrulama:** TCKN için 11 hane ve resmi kontrol hanesi algoritması, VKN için 10 hane ve kontrol algoritması uygulanır (Zod). Gerçek kişi doğrulaması (NVİ) yapılmaz.
- **Store API:** `GET/POST /store/customers/me/billing-profile` (oturum zorunlu). Yanıtta yalnızca maskeli değer (`*******1234`) döner, tam değer asla dönmez.
- **Admin:**
  - Müşteri detayında widget, maskeli değeri gösterir. Core müşteri listesinde vergi kimliği hiç görünmez.
  - Tam değeri göstermek yetki (F12) ve audit log (F2.5) gerektirir. O zamana kadar yalnızca maske gösterilir.
- **Loglama:** Bu alanlar hiçbir log çağrısına geçirilmez; maskeleme yardımcısı merkezi tutulur. pino redaksiyon listesinde `tckn`/`taxId` zaten var (F2.10).

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Müşteri `metadata`'sında düz metin | En kolay | Şifresiz; admin JSON görünümünde açık; tip ve doğrulama yok |
| **Ayrı modül + şifreleme + HMAC** | KVKK'ya uygun, maskeleme doğal, aranabilir | Anahtar yönetimi gerekir |
| Ayrı modül, şifrelemesiz | Basit | DB sızıntısında TCKN açık; docs/04'ün "gerekirse" maddesi canlı öncesi tekrar açılır |

## Sonuçlar
- **Anahtarlar:** Env şemasına `PII_ENCRYPTION_KEY` ve `PII_HASH_KEY` eklenir (init-dev-env üretir). Prod'da secret store'da tutulur (adr/0002). Anahtar döndürme prosedürü F15'te.
- **Bağımlı fazlar:**
  - F8 e-fatura tam değeri yalnızca fatura oluşturma adımında çözer.
  - F2.5 audit log okuma kaydını ekler.
  - F12 "tam değeri göster" yetkisini ekler.

## Uygulama (F1 S7)
- **Modül:** `src/modules/billing-profile`.
  - Anahtarlar modül seçeneği olarak verilir (`PII_ENCRYPTION_KEY`, `PII_HASH_KEY`; env şemasında 64 hex karakter zorunlu). Anahtara yalnızca modül erişir.
  - `prepareProfileData` doğrular, şifreler (AES-256-GCM, alana bağlı AAD) ve HMAC'ler. `revealTaxId` yalnızca F8 içindir.
- **Kurumsal profil:** VKN veya TCKN kabul eder (şahıs şirketi). Bireysel profil yalnızca TCKN kabul eder.
- **Workflow:** `billing-profile-upsert-for-customer`. Oluşturma veya güncelleme ve link adımlarının hepsinde compensation var. Girdide düz TCKN taşındığı için workflow `store` ile çalıştırılmamalı.
- **Store API:** `GET/POST /store/customers/me/billing-profile` (session veya bearer). Hata mesajları i18n anahtarıdır (`billing_profile.tax_id_invalid`, `billing_profile.tax_office_required`) ve numarayı tekrar etmez.
- **Admin:** `GET /admin/customers/:id/billing-profile` (maskeli) ve `customer.details.after` widget'ı.
- **Silme:** Medusa'nın müşteri silme workflow'u link'leri kaldırmadığı için link'in `deleteCascade`'i tetiklenmiyor. `deleteCustomersWorkflow.hooks.customersDeleted` profili soft-delete eder (compensation ile).
- **Kabul edilen risk:** Admin, `GET /admin/customers?fields=*billing_profile` ile şifreli değeri ve HMAC'i görebilir; açık değeri göremez. HMAC anahtarsız kaba kuvvete dayanıklıdır. Alan bazlı admin yetkisi F12'de ele alınır.
- **Kanıt:** `integration-tests/http/billing-profile.spec.ts`. TCKN yanıtlarda, `billing_profile` ve `workflow_execution` tablolarında ve stdout/stderr loglarında açık metin olarak yok.
