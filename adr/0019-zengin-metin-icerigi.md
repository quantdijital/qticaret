# ADR-0019: Zengin metin içeriği (içerik sayfaları, blog, açıklamalar)

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama F3.16)
- **Tarih:** 2026-10-25

## Bağlam

- **İhtiyaç:** F3.16 içerik sayfaları, blog yazıları ve facet landing metinleri için zengin metin editörü ister. Ürün açıklamaları da biçimli metin taşır.
- **Mevcut:** Admin `@medusajs/ui` kullanır; zengin metin bileşeni yoktur. Medusa ürün açıklamasını düz metin alanında tutar.
- **Riskler:**
  - Zengin metin storefront'ta HTML olarak basılır (stored XSS).
  - JSON-LD ve `description` meta'sı düz metin ister.
  - Advisor (doc 14 §3.8) yapıyı okur: başlık seviyeleri, paragraf uzunluğu, tablo.

## Karar (öneri)

- **Saklama biçimi: belge JSON'u (ProseMirror şeması), HTML değil.**
  - İzinli düğümler: paragraf, başlık (h2–h4), liste, alıntı, tablo, görsel (yalnızca kendi medya kütüphanemizden), bağlantı (http/https ve site içi).
  - Kısa kodlar: ürün ve kategori kartı.
  - Şema dışı düğüm ve işaret kaydedilirken reddedilir (Zod).
- **Editör:** Tiptap 3 (MIT, ProseMirror tabanlı); yalnızca admin paketinde.
- **Çıktı:** Sunucu belgeyi kendi oluşturucumuzla HTML'e çevirir; allowlist dışında etiket ya da öznitelik üretmez. Ayrıca düz metin özeti üretir (meta, JSON-LD, advisor).
  - `sanitize-html` gibi bir temizleyiciye gerek kalmaz: girdi HTML değildir.
- **Ürün açıklaması:** Medusa'nın düz metin alanı korunur. Zengin içerik `content` modülüne bağlanır (ürünle link).

## Alternatifler

| Seçenek                           | Artı                                                | Eksi                                             |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| **Belge JSON + kendi oluşturucu** | XSS yüzeyi yok; yapı advisor'a hazır; tema bağımsız | Editör ve oluşturucu bakım ister                 |
| HTML + sanitize-html              | Basit; her editörle çalışır                         | Temizleyici atlatma riski; yapı analizi zor      |
| Markdown                          | Taşınabilir, basit                                  | Tablo ve kısa kod sınırlı; kullanıcı dostu değil |

## Sonuçlar

- Tiptap paketleri yeni bağımlılıktır (yalnızca admin paketi; exact sürüm, ≥14 gün).
- Geçiş araçları (F14) HTML'i belge JSON'una çeviren bir dönüştürücü ister; çevrilemeyen öğeler rapora düşer.

## Uygulama notu (F3 T13, 2026-10-26)

- **Kod:**
  - Belge, oluşturucu ve okuyucu `src/lib/content` altında (`doc.ts`, `render.ts`, `stats.ts`). Modül `src/modules/content` (`content_entry`, `kind`: page/post).
  - Editör yönetici panelinde (`apps/panel/src/features/content/editor`), Medusa Admin'de değil (adr/0022). Tiptap 3.31.4.
- **İzin listesi:**
  - Kararla aynı: paragraf, h2–h4, liste, alıntı, tablo, görsel, bağlantı, ürün ve kategori kartı. İşaretler yalnızca kalın, italik ve bağlantı.
  - Alıntı ve liste maddesi yalnızca paragraf ve liste; tablo hücresi yalnızca paragraf taşıyor. Editör de aynı şemaya daraltıldı.
- **Sınırlar:** belge şemadan önce yığınla ölçülüyor (20.000 düğüm, 12 derinlik, 200.000 karakter). Birleşimler `type` ayrımlı, böylece doğrulama düğüm sayısıyla doğrusal.
- **Bağlantı:** http(s) ya da site içi yol. `javascript:`, `data:`, `//`, ters eğik çizgi, kontrol ve görünmez biçim karakterleri, `kullanıcı@` içeren adresler reddediliyor.
- **Görsel:** yalnızca medya kütüphanesine yüklenmiş (dosyası olan) kayıtlar. Kayıt görseli "bağlı" işaretliyor, gece süpürmesi silmiyor.
- **Kartlar:** belgede yalnızca id. HTML'e çevrilirken canlı kaydın güncel adı ve url-registry'deki yolu basılıyor; yayında olmayan kart çıkmıyor.
- **Ürün açıklaması:** Kararın "ürün açıklaması content'e bağlanır" kısmı uygulanmadı (PROGRESS karar 73).
