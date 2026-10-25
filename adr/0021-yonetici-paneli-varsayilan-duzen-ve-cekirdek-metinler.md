# ADR-0021: Yönetici paneli varsayılan düzeni, çekirdek Türkçe metinler ve hata mesajları

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama admin kullanılabilirlik dilim 2)
- **Tarih:** 2026-10-25

## Bağlam

- **İhtiyaç:** Mağaza sahipleri paneli zor buluyor (docs/17). Başlangıç sayfası eklendi ama menüde çekirdek öğelerin altında kalıyor. Çekirdek ekranların Türkçesi sözlüğümüzle (docs/06) çelişiyor. Bizim API hata anahtarlarımız çekirdek ekranlarda ham görünüyor (`errors.limit_too_large`, `catalog.dimensions_required`).
- **Medusa 2.21.2'de doğrulanan** (docs/17 bölüm 2):
  - Açılış sayfası (`/` → `/orders`) ve giriş sonrası yönlendirme sabit; genişletme noktası yok.
  - Menüde uzantı öğeleri çekirdek öğelerden sonra gelir; `rank` yalnızca uzantıları sıralar.
  - Menü ve ayarlar menüsü `LayoutComposer`'dır. Sıra ve gizleme sunucuda saklanan düzen tercihidir:
    - Sistem varsayılanı settings modülünde: `setSystemDefaultLayoutConfiguration(zone, { widgets })`, `getSystemDefaultLayoutConfiguration(zone)`.
    - Bölgeler `sidebar` ve `settings.sidebar`. Ayar bölümleri `general`, `developer`, `myAccount`, `extensions`.
    - Öğe kimlikleri `core:nav:<yol>` ve `core:settings-nav:<yol>`; uzantı öğeleri de aynı biçimde (`core:nav:/home`).
    - Sırası verilmeyen öğe `order: 0` alır ve kaynaktaki sırasında kalır.
  - Uzantı çevirileri çekirdek çevirilerin üstüne `deepMerge` edilir; aynı anahtarda uzantı kazanır.
  - **Hata gösterimi:** Çekirdek formlar API hatasını `toast.error(error.message)` ile, çevirmeden basar; giriş formu da aynı. Dashboard SDK'sı session modunda çalışır: yalnızca çerez gönderir, `Authorization` başlığı göndermez.
- **Kısıt:** Medusa çekirdeği değiştirilmez (altın kural 2). Sürüm yükseltmesinde kırılan bir şey sessiz kalmamalı.

## Karar

1. **Varsayılan düzen tenant kurulumunda yazılır** (`src/scripts/bootstrap/admin-layout.ts`).
   - `sidebar`: `core:Searchbar` (sıra -2), `core:nav:/home` (sıra -1); çekirdek öğeler kendi sırasında.
   - `settings.sidebar`:
     - Bizim ayar sayfalarımız `general` bölümüne taşınır.
     - Geliştirici öğeleri `hidden: true`: yayınlanabilir ve gizli API anahtarları, iş akışları, arama. Kullanıcı kararı: mağaza sahibi geliştirici alanlarını görmez.
   - Bir bölgede sistem varsayılanı varsa dokunulmaz (idempotent; mağazanın ya da platform ekibinin seçimi korunur).
   - Gizlemek yalnızca menüden kaldırır. Adresle erişim ve yetki değişmez; gerçek kısıtlama rol modeliyle gelir (F12.6, Medusa RBAC).
2. **Mağaza adı kurulumda sorulur.** `tenant:bootstrap --store-name="..."`. Mağaza hâlâ Medusa'nın varsayılan adını ("Medusa Store") taşıyorsa ad verilmeden kurulum yapılmaz; sonraki çalıştırmalarda bayrak verilmezse ad korunur. Provizyon (F17) adı sorup geçirir.
3. **Çekirdek Türkçe metinler sözlüğe göre ezilir** (`src/admin/i18n/core-overrides/tr.json`).
   - Terimler: Fulfillment → Gönderi ("Hazırlandı", "Kargoya hazırla"); Inventory → Stok (stok kalemi, stok seti); Allocate → stoktan ayır; Backorder → "Stok bitince de satışa izin ver"; Pickup → Mağazadan teslim; Handle → URL adresi.
   - Yalnızca `tr`; İngilizce çekirdek metinlere dokunulmaz.
   - Birim testi: bu dosya `qticaret.` anahtarlarına dokunamaz, metinler boş olamaz.
   - Medusa yükseltmesinde `scripts/check-core-overrides.mjs` yeni sürümün `tr.json`'una karşı çalıştırılır: anahtar silinmişse ya da yer tutucu değişmişse hata verir.
4. **Dashboard'a hata mesajı cümle olarak döner** (`src/api/http/dashboard-messages.ts`).
   - Dashboard isteği:
     - `/admin/*`: `Authorization` başlığı olmayan, session çereziyle doğrulanmış istek.
     - `/auth/user/*`: `Authorization` başlığı olmayan, `Origin` taşıyan istek (giriş formu).
   - Bizim anahtarımız `message`'da Türkçe cümleye döner; anahtar `code`'da kalır. Bilinmeyen anahtar, kodu anan genel bir cümle alır.
   - API istemcileri (`Authorization` gönderenler, entegrasyonlar, testler) anahtarı `message`'da almaya devam eder.
   - Metinlerin tek kaynağı `src/lib/errors/messages/{tr,en}.ts`; admin çevirisi `qticaret.serverErrors`'ı buradan kurar.
5. **Başlangıç'ın sipariş sayıları sunucudan gelir:** `GET /admin/home/summary`.
   - Döndürdükleri: açık sipariş sayısı, kargoya hazırlanmayı bekleyenler (ödemesi alınmış ya da onaylanmış, canlı gönderisi olmayan), bugünkü sipariş sayısı ve para birimi başına satış toplamı.
   - Yalnızca durum ve tutar okunur. Kişisel veri olmadığı için okuma kaydı gerekmez (adr/0011).
   - Açık siparişler en çok 1000 tanesi okunarak sayılır; fazlası `capped` ile bildirilir.
6. **Başlangıç'ta widget bölgesi (sonraki dilim).** F12.1 kartları için `LayoutComposer` (`@medusajs/dashboard/components`, 2.16.0+) `qticaret.home` önekiyle kullanılır. docs/06'daki "yalnızca `@medusajs/ui`" kuralına tek istisnadır; paket zaten bağımlılıktır.

## Alternatifler

| Seçenek                                                        | Artı                                                                         | Eksi                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Düzen tercihi + metin ezme + sunucuda hata cümlesi (karar)** | Belgelenmiş çekirdek mekanizmalar; çekirdeğe dokunmaz; mağaza değiştirebilir | Yükseltmede anahtar adı değişirse ezme düşer (kontrol betiği ile yakalanır) |
| Hiçbir şey yapmamak                                            | Bakım yok                                                                    | Başlangıç menünün altında kalır; jargon ve ham hata anahtarları sürer       |
| Hata anahtarlarını da çekirdek çeviriye eklemek                | Sunucu değişmez                                                              | Çekirdek `error.message`'ı çevirmeden bastığı için işe yaramaz              |
| Her isteğe Türkçe mesaj döndürmek                              | Basit                                                                        | API istemcileri ve testler kararlı anahtarı kaybeder                        |
| Giriş ekranına `state.from` yazıp girişte Başlangıç'ı açmak    | Açılış sayfası değişir                                                       | Belgelenmemiş iç ayrıntı; yükseltmede sessizce bozulabilir                  |
| Dashboard'u fork'lamak / patch'lemek                           | Tam kontrol                                                                  | Altın kural 2'ye aykırı; her yükseltmede birleştirme yükü                   |

## Sonuçlar

- **Bootstrap:** Mağaza adı ve admin düzeni adımları eklendi. HTTP entegrasyon testi varsayılan düzeni, ikinci çalıştırmada dokunmamayı ve mağaza adı zorunluluğunu doğrular. Mevcut tenant'larda bootstrap yeniden çalıştırılır (idempotent).
- **Yetki:** `is_default` için Medusa ayrı yetki istemez; her admin herkesin varsayılan menüsünü değiştirebilir, gizli bir öğeyi kendi düzeninde yeniden açabilir. Etkisi arayüzle sınırlı; rol modelinde (F12.6) değerlendirilir.
- **Gizli API anahtarları:** Menüden kalktıkları için mağaza sahibi aktif tam yetkili anahtarları fark etmeyebilir. Platform tarafında periyodik kontrol ya da Başlangıç'ta "aktif gizli anahtar" uyarısı F12.6/F17'de değerlendirilir.
- **Dil:** İngilizce kullanan bir admin, dashboard'dan gelen hata mesajını Türkçe görür (tenant varsayılan dili). Çok dil F19'da kullanıcı tercihine bağlanır.
- **Yeni hata anahtarları:** Her yeni hata anahtarı `lib/errors/messages`'a iki dilde cümlesiyle eklenir (docs/10).
