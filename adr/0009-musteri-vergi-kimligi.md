# ADR-0009: Müşteri vergi kimliği (TCKN / VKN) saklama ve gösterimi

- **Durum:** Önerildi (F1.5 oturumunda kabul edilecek)
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

## Karar (öneri)
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
