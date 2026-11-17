# ADR-0005: İçerik ve SEO önerileri — kural motoru önce, LLM opsiyonel

- **Durum:** Kabul edildi (kural motoru F3.13'te uygulandı ve LLM'siz çalışıyor; LLM taslakları isteğe bağlı ve kapalı başlar, kullanıcı 2026-10-31'de "LLM kapalı" seçti). **Ek (2026-11-17):** §3'ün sağlayıcı kısmı (tek `ContentDraftProvider`, `ai_content_drafts` bayrağı) adr/0071 ile genişletildi ve yerini servis kaydına bırakıyor; §1, §2 ve §3'ün ilkeleri (yalnız ürün verisi, çıktı taslaktır, kural motorundan geçer, sektör nötr istem) yürürlükte.
- **Tarih:** 2026-10-22

## Bağlam
Hedef: tenant ürün/kategori/sayfa girerken anında SEO ve içerik kalitesi önerileri alsın (`docs/13-seo-mimarisi.md`).
Shopify "Magic" gibi rakip özellikler LLM tabanlıdır. Ancak LLM'e tam bağımlılık; maliyet, gecikme, tutarsızlık,
veri yurt dışına aktarımı (KVKK) ve "ölçekli içerik kötüye kullanımı" (Google politikası) riskleri taşır.

## Karar
1. **Kural motoru birincil ve zorunlu** (`seo-advisor` modülü, F3.13): deterministik, hızlı (<50 ms), çevrimdışı çalışır,
   skor + bulgu + tek tıkla düzeltme üretir. Hiçbir dış servise bağımlı değildir.
2. **Şablon tabanlı üretim** (LLM'siz): başlık/meta/alt metin şablonları ürün adı, marka, attribute'lardan üretilir.
3. **LLM taslakları opsiyonel ve adaptör arkasında** (`ContentDraftProvider` arayüzü, F10.13): açıklama taslağı, meta önerisi,
   alt metin, SSS taslağı, paylaşım metni. Sağlayıcı değiştirilebilir (bulut API veya self-host model).
   - Tenant başına açık/kapalı flag (`ai_content_drafts`) ve aylık kota.
   - Yalnızca ürün/içerik verisi gönderilir; kişisel veri, sipariş, müşteri verisi asla.
   - Çıktı her zaman **taslaktır**; insan onayı olmadan yayımlanmaz; taslak kaynağı (`source: ai_draft`) kaydedilir.
   - Üretilen metin kural motorundan geçer; skoru düşükse önerilmez.
   - Sektör nötr prompt kütüphanesi; prompt'lar attribute şablonundan beslenir (sektör adı kodda geçmez).
4. LLM sağlayıcı seçimi ve veri işleme sözleşmesi `docs/12-kod-disi-gereksinimler.md`'de izlenir; yerleşim ADR-0003 ile uyumlu olmalıdır.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Yalnızca LLM | Hızlı geliştirme, "sihirli" his | Maliyet, bağımlılık, tutarsızlık, KVKK/yerleşim riski, çevrimdışı çalışmaz |
| **Kural motoru + opsiyonel LLM** | Deterministik taban, ölçeklenebilir maliyet, sağlayıcı bağımsız | İki katman bakımı |
| Hiç öneri yok | Sıfır iş | Rakiplerin gerisinde kalır, hedefle çelişir |

## Sonuçlar
- Kural seti sürümlenir ve testlidir; her kuralın i18n'li açıklaması ve "neden önemli" metni vardır.
- Skor formülü dokümante edilir; tenant'a gizemli görünmez.
- LLM fazı, kural motoru canlıda en az bir tenant'ta kullanıldıktan sonra başlar.
