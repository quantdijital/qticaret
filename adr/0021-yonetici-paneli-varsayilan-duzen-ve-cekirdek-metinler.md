# ADR-0021: Yönetici paneli varsayılan düzeni ve çekirdek Türkçe metinler

- **Durum:** Önerildi
- **Tarih:** 2026-10-25

## Bağlam

- **İhtiyaç:** Mağaza sahipleri paneli zor buluyor (docs/17). Başlangıç sayfası eklendi ama menüde çekirdek öğelerin altında kalıyor. Çekirdek ekranların Türkçesi sözlüğümüzle (docs/06) çelişiyor.
- **Medusa 2.21.2'de doğrulanan** (docs/17 bölüm 2, kaynak yolları orada):
  - Açılış sayfası (`/` → `/orders`) ve giriş sonrası yönlendirme sabit; genişletme noktası yok.
  - Menüde uzantı öğeleri çekirdek öğelerden sonra gelir; `rank` yalnızca uzantıları sıralar.
  - Menü ve ayarlar menüsü `LayoutComposer`'dır. Sıra ve gizleme sunucuda saklanan düzen tercihidir: `POST /admin/layouts/:zone/configuration` (2.17.2+). `is_default: true` herkes için sistem varsayılanı yazar. Bölgeler `sidebar` ve `settings.sidebar`; öğe kimlikleri `core:nav:<yol>`, `core:settings-nav:<yol>`.
  - Uzantı çevirileri çekirdek çevirilerin üstüne `deepMerge` edilir; aynı anahtarda uzantı kazanır.
- **Bugünkü kuralımız:** Her admin çeviri anahtarı `qticaret.` altında (`src/admin/i18n/index.ts`, birim testi). Çekirdek anahtar ezmek bu kuralı değiştirir.
- **Kısıt:** Medusa çekirdeği değiştirilmez (altın kural 2). Sürüm yükseltmesinde kırılan bir şey sessiz kalmamalı.

## Karar (öneri)

1. **Varsayılan düzen tenant kurulumunda yazılır.**
   - `tenant:bootstrap` çekirdek `setLayoutConfigurationWorkflow` ile `is_default: true` yazar:
     - `sidebar`: `core:Searchbar`, sonra `core:nav:/home` (Başlangıç), sonra çekirdek öğeler.
     - `settings.sidebar`: bizim ayar sayfalarımız `general` bölümüne. Geliştirici öğeleri (`/settings/publishable-api-keys`, `/settings/secret-api-keys`, `/settings/workflows`, `/settings/search`) `hidden: true`.
   - Bir bölgede sistem varsayılanı varsa dokunulmaz (idempotent; mağazanın ya da platform ekibinin seçimi korunur).
   - Gizlemek yalnızca menüden kaldırır. Adresle erişim ve yetki değişmez; koruma API'dedir.
2. **Çekirdek Türkçe metinlerde sınırlı ezme.**
   - `src/admin/i18n/core-overrides/tr.json` ayrı dosyada tutulur ve `translation` ad alanına birleştirilir. Yalnızca `tr`; İngilizce çekirdek metinlere dokunulmaz.
   - Liste kısa ve gerekçelidir (docs/17 bölüm 3.6 ve bizim API hata anahtarlarımız, ör. `errors.too_many_requests`). Her anahtar sözlükteki bir terime bağlanır.
   - Test, ezilen anahtarları bir izin listesiyle sınırlar. `qticaret.` dışındaki her anahtar listede olmak zorundadır.
   - Medusa yükseltme kontrol listesine bir madde eklenir: ezilen anahtarlar yeni `tr.json`'da hâlâ var mı?
3. **Başlangıç'ta widget bölgesi (sonraki dilim).** F12.1 kartları için `LayoutComposer` (`@medusajs/dashboard/components`, 2.16.0+) `qticaret.home` önekiyle kullanılır. Bu, docs/06'daki "yalnızca `@medusajs/ui`" kuralına tek istisnadır; paket zaten bağımlılıktır.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Düzen tercihi + sınırlı metin ezme (öneri)** | Belgelenmiş çekirdek mekanizmalar; çekirdeğe dokunmaz; mağaza değiştirebilir | Yükseltmede anahtar adı değişirse ezme sessizce düşer (test ve kontrol listesiyle azaltılır) |
| Hiçbir şey yapmamak | Bakım yok | Başlangıç menünün altında kalır; jargon sürer |
| Giriş ekranına `state.from` yazıp girişte Başlangıç'ı açmak | Açılış sayfası değişir | Belgelenmemiş iç ayrıntı; yükseltmede sessizce bozulabilir |
| Dashboard'u fork'lamak / patch'lemek | Tam kontrol | Altın kural 2'ye aykırı; her yükseltmede birleştirme yükü |
| Çekirdek ekranların yerine kendi ekranlarımız | Tam sade dil | Çok büyük iş; çekirdek özelliklerden kopar |

## Sonuçlar

- Bootstrap bir backend adımı kazanır; HTTP entegrasyon testi varsayılan düzeni ve ikinci çalıştırmada dokunmamayı doğrular.
- `i18n` birim testi değişir: `qticaret.` dışı anahtarlar yalnızca izin listesinden.
- `is_default` için Medusa ayrı yetki istemez; her admin herkesin varsayılan menüsünü değiştirebilir. Etkisi arayüzle sınırlı. Rol modelinde (F12.6) değerlendirilir.
- Mevcut tenant'lar için bir kerelik `medusa exec` script'i gerekir; bootstrap yeniden çalıştırılabilir olduğu için aynı adım kullanılır.
