# ADR-0030: Ters ibraz kaydı ve belge paketi

- **Durum:** Kabul edildi (2026-10-28 gece, otonom çalışma: önerilen seçenek uygulandı; kullanıcı sabah gözden geçirecek, PROGRESS "Gözden geçir").
- **Tarih:** 2026-10-28
- **İlgili:** F6.7, ADR-0026 (barındırılan form), docs/12 (kod dışı gereksinimler), F11 (muhasebe), F13 (yasal metin onayları)

## Bağlam

Kart sahibi bankasına itiraz edebilir (ters ibraz, chargeback). Bu durumda sağlayıcı (PayTR, iyzico) mağazadan belge ister ve süre verir. İki sağlayıcının ters ibraz bildirimi:
- PayTR'de bildirim yok (ADR-0026).
- iyzico'nun bildirimi webhook'la gelir; webhook gerçek firmaya kadar ertelendi.

Bu yüzden ilk sürüm elle kayıtla çalışır. Mağaza sağlayıcıdan gelen e-postayı ya da panel bildirimini görüp kaydı açar.

Belge paketinde siparişin kanıtları yer alır: sipariş özeti, ödeme kaydı, kargo ve teslim kanıtı, sözleşme onayı, zaman. Kargo kanıtı F7'de, sözleşme onayı F13'te olgunlaşacak. Paket bugün eldekiyle üretilmeli ve o fazlarda kendiliğinden zenginleşmeli.

## Karar

1. **Modül `chargebacks`.** Kayıt şu alanları tutar: sipariş, ödeme, sağlayıcı ve sağlayıcının referansı, tutar (kuruş) ve para birimi, sebep kodu, son tarih, not, açan, kapanış.
   - Sebep kodları: ulaşmadı, yetkisiz işlem, tarif edildiği gibi değil, mükerrer, diğer.
   - Durumlar: `open` → `evidence_submitted` → `won` | `lost`. `open`'dan doğrudan `won`/`lost` da olur. Kapanan kayıt yeniden açılmaz.
2. **Açma kuralları (workflow):**
   - Sipariş var ve yakalanmış (`captured`) bir ödemesi olmalı.
   - Tutar ödenenden fazla olamaz.
   - Aynı ödemede aynı anda tek açık kayıt olabilir.
   - Fiyat ve tutar sunucuda doğrulanır; istemcinin tutarı ödenenle sınırlanır.
3. **Belge paketi:**
   - Tek, kendi içinde tam bir HTML belgesidir (stil gömülü, dış kaynak yok). Tarayıcıdan PDF olarak yazdırılabilir.
   - `GET /admin/chargebacks/:id/evidence` ile tek tıkla iner.
   - İçerik:
     - sipariş özeti (kalemler, tutarlar, tarih);
     - teslimat adresi (maskesiz: belge bankaya gider; erişim yalnızca personelde, denetim kaydıyla);
     - ödeme kaydı (sağlayıcının o anki kaydı: işlem no, kart markası ve son 4 hane, taksit);
     - kargo kayıtları (gönderi, takip numarası, teslim zamanı);
     - yapılan iadeler;
     - zaman çizelgesi.
   - Sözleşme onayı ve IP bilgisi bugün saklanmıyor. Paket bunu açıkça yazar ve F13'te otomatik dolar. IP'nin saklanması KVKK açısından ayrıca karar ister (F13).
   - Yeni bağımlılık yok: zip ya da PDF kütüphanesi eklenmez.
4. **Kaybedilen ibraz:**
   - Kaydın kapanışı bir olay yayınlar (`chargeback.lost`) ve denetim kaydına girer.
   - Muhasebe kaydı F11'de bu olayla yazılır.
   - Siparişin iade defterine otomatik iade yazılmaz: para bankadan gitti, mağazanın iadesi değil.
5. **Panel:**
   - Siparişler altında "Ters ibrazlar" kuyruğu: duruma göre süzülür, son tarihi yaklaşanlar önde.
   - Sipariş sayfasında açık kayıt uyarısı ve "Ters ibraz kaydı aç" eylemi.
   - Kayıt penceresinde durum değişikliği ve belge paketi.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Tek HTML belge (seçilen)** | Bağımlılık yok, her tarayıcıda açılır, PDF'e yazdırılır | Sağlayıcının yükleme formuna ek olarak PDF gerekirse yazdırma adımı |
| Zip (JSON + belgeler) | Makineye okunur | Yeni bağımlılık (yazıcı), bankaya gitmez, insan okuması zor |
| Sunucuda PDF | Doğrudan yüklenir | Ağır bağımlılık (tarayıcı motoru ya da PDF kütüphanesi), yazı tipi/Türkçe karakter sorunu |

## Sonuçlar

- Sağlayıcı bildirimi gelince (iyzico webhook, gerçek firma) kayıt otomatik açılır; aynı modül ve workflow kullanılır.
- Belge paketi F7 (kargo kanıtı) ve F13 (onay kaydı) geldikçe kendiliğinden zenginleşir.
- Kaybedilen ibrazın muhasebe etkisi F11'de.
