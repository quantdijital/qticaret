# ADR-0065: Canlı tema düzenleyici: önizleme köprüsü ve anında yansıma

- **Durum:** Kabul (sahip, 2026-11-15; kararlar aşağıda)
- **Tarih:** 2026-11-15
- **İlgili:** adr/0049 (tema düzenleyici; Ek 2026-11-02 önizleme ve güvenlik incelemesi; Ek 2026-11-14 §8 `data-qs` bölüm kutusu), adr/0046 §4 (vitrin CSP'si) ve §5 (Store API yalnız vitrin sunucusundan), adr/0053 §B ve adr/0062 (tema ayarları), adr/0057 (tema derleme anında), adr/0063 §3 (tema ayarı ve menüler taslakta), adr/0040 (roller), docs/04 (güvenlik), docs/05 ve docs/21 (performans), docs/13 §5 (önizleme `noindex`)
- **Dayanak:** sahip (2026-11-15): "storefront da her değişiklikten sonra sayfa yeniliyor gibi oluyor, çok rahatsız edici, akıcı bir deneyim değil. divi veya elementordeki gibi akıcı bi şekilde tasarım yapamıyorum. yeni bir bölüm ekleyince sayfada onu aramakla uğraşıyorum, yeni bölüme otomatik yavaşça kaymalı." ve "bizde bunların hepsi olmalı, doğru bir mimari yapı ile yapalım, gerekirse değişikliğe gideriz." Kalıcı tercih: büyük platformlar (önce Shopify, sonra Elementor, Divi) nasıl yapıyorsa örnek alınır.

## Bağlam

### Bugünkü akış (kodda doğrulandı)

1. **Bekleme.** Düzenleyicideki her değişiklik, bölüm eklemek ya da gizlemek gibi tek tıklık işler de dahil, 1,5 sn sessizlik bekler (`apps/panel/src/features/storefront/layout/use-autosave.ts:8` `AUTOSAVE_MS = 1500`, `:80-88`). Kayıt tek uçuşludur. Sorun varken kayıt yapılmaz (`blocked`, `theme-editor.tsx:70-75`).
2. **Her kayıtta yeni bağlantı.** Kayıt başarılı olunca `round` bir artar (`use-autosave.ts:56`, sıfırlamada `:109`). Önizleme sorgusunun anahtarında `round` vardır (`editor/preview-frame.tsx:123-129`), bu yüzden her kayıt `POST /admin/storefront-layout/preview` ile yeni bir imzalı bağlantı ister (`api/layout.ts:116-117`).
3. **Jeton kayda bağlı.** Backend jetonu düzen satırının kimliği ve `updated_at` değeriyle imzalar (`apps/backend/src/api/admin/storefront-layout/preview/route.ts:18-21`). MAC kaydedilme anını içerir (`lib/content/preview-token.ts:35-38`). Okuma ucu bu anı o anki `updated_at` ile karşılaştırır (`:64-67`, `api/store/storefront-layout/preview/[token]/route.ts:20-28`). Sonraki her kayıt eski bağlantıyı 404'e düşürür. Bu bilinçli bir güvenlik kararıydı: paylaşılan bağlantı, oluşturulduktan sonra yazılanı göstermesin (`preview-token.ts:4-10`; adr/0049 "düzenleyici her kayıttan sonra yenisini alır"). Anahtar `PII_HASH_KEY`, bağlam `layout-preview:v1` (`lib/orders/access-token.ts:18`, `preview-token.ts:83`).
4. **Tam sayfa yükleme.** Yeni jeton yeni yol demektir (`layout/preview-url.ts:26-36`). iframe'in `src`'i değişir (`preview-frame.tsx:132-133`, `:175`). Belge baştan yüklenir: HTML, RSC, hidrasyon, yazı tipleri, görseller. Kaydırma en üste döner. İstemci durumu da (açık slayt, sekme) kaybolur. Kullanıcı bu sırada "yenileniyor" göstergesini görür (`:196-203`). Beyaz ekranın görünüp görünmemesi tarayıcıya bağlıdır: Chrome'un "paint holding" özelliği aynı köken içindeki gezintide eski kareyi bir süre tutar (developer.chrome.com/blog/paint-holding). Kaydırmanın sıfırlanması ve sayfanın baştan kurulması ise her tarayıcıda olur. Sayfa (`?sayfa=`) ya da örnek ürün değişimi de aynı biçimde `src` değiştirir.
5. **Vitrin tarafı.** `/onizleme/[token]` (`apps/storefront/src/app/onizleme/[token]/page.tsx:84-90`) taslağı `layoutPreview` ile okur. İstek `cache: "no-store"` ile gider (`lib/store-api/core.ts:84`). Vekil, jetonu yalnız kendi koyduğu `x-qt-layout-preview` başlığıyla iletir (`proxy.ts:155-161`). Bu sayede `currentLayout()` üst ve alt bilgide de taslağı okur (`lib/views/layout.ts:31-35`). Önizleme sayfaları şu başlıklarla döner: `x-robots-tag: noindex, nofollow` ve `cache-control: private, no-store` (`proxy.ts:222-230`), meta `noindex,nofollow` ve `referrer: no-referrer` (`page.tsx:59-64`).
6. **Çerçeve izni.** `frame-ancestors` yalnız `/onizleme/` yolunda panelin kökenini (`PANEL_ORIGIN`) adlandırır (`proxy.ts:133`, `lib/security/csp.ts:76`, `:98`). Diğer bütün sayfalarda `X-Frame-Options: DENY` ve `frame-ancestors 'none'` geçerlidir (`next.config.ts:63-77`). Canlıda `PANEL_ORIGIN` https olmak zorundadır (`lib/env.ts:80-83`). CSP'nin geri kalanı: `script-src 'self' 'nonce-…' 'strict-dynamic'`, üretimde `style-src 'nonce-…'`, `style-src-attr` için yalnız iki Radix özeti (`csp.ts:88-90`). iframe'in sandbox değeri `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox` (`preview-frame.tsx:177`).
7. **DOM'da bölüm kimliği yok.** `Blocks` bölüm kimliğini yalnız React `key`'i olarak kullanır (`packages/themes/atolye/src/sections/Blocks.tsx:154-168`). `Look`, görünüm ayarı olmayan bölümde hiç kutu çizmez (`Look.tsx:27-29`). Başlık kimliği `bolum-<id>` yalnız bazı bölümlerde var (`sections/plan.ts:6`, ör. `Blocks.tsx:83`). Giriş, bant, güven rozetleri ve kayan yazıda yok. Yan yana duran ürün rafları tek sekmeli rafta birleşir (`Blocks.tsx:63-65`). Yardım bölümü SSS'nin içinde çizilir (`:39-41`). adr/0049 Ek 2026-11-14 §8 her bölüme `data-qs="<kimlik>"` taşıyan bir dış kutu kararı verdi (özel CSS'i kapsamlamak için). Bu karar henüz uygulanmadı: depoda `data-qs` geçmiyor.
8. **Panel ile vitrin arasında kanal yok.** Panelde ve vitrinde `postMessage` kullanılmıyor. Tek istisna ödeme formu (`packages/ui/src/components/payment-frame.tsx:44`, `:67`). Ağaçtan bir bölüm seçilince yalnız formu açılır (`theme-editor.tsx:176-178`). Yeni eklenen bölümün de formu açılır (`:274-280`). Önizleme hiçbir durumda kımıldamaz.
9. **Ölçek.** Önizleme, cihaz genişliğinde çizilip küçültülür (`editor/preview-fit.ts:28-37`, `transform: scale(…)` `preview-frame.tsx:179`). Ölçek 1 ya da daha küçüktür.
10. **Bugün korunanlar.** Geri al/yinele (`layout/editor-state.ts`, 100 adım, yazım birleştirme), klavye kısayolları (`use-undo-keys.ts`), çıkış uyarısı (`theme-editor.tsx:282` `LeaveGuard when={autosave.dirty}`), taslak, yayın, sürüm geçmişi, "yeni sekmede önizle" (`use-editor-actions.ts:81-106`). Eşzamanlı düzenlemede son kayıt kazanır (adr/0049 "Bilinen sınır"). Taslak kaydı düzen kilidi altında yapılır (`workflows/storefront/layout.ts:80`).
11. **Tema ayarları tek bir `:root` kuralıdır.** `entry.style(settings)` saf bir işlevdir. Kök düzende nonce'lu tek bir `<style>` öğesine basılır (`apps/storefront/src/themes/entry.ts`, `themes/atolye.ts`, `app/layout.tsx:35-61`).

**Gecikme.** Sahibin gözlemi: değişiklik başına yaklaşık 2 sn. Bu süre ölçülmedi. Kodda sabit olan kısmı 1,5 sn beklemedir. Üstüne kayıt isteği, bağlantı isteği ve tam sayfa yükü biner. Üretim derlemesinde ana sayfanın TTFB'si 95–135 ms, masaüstü LCP'si 0,23 sn (docs/21). `pnpm dev`'deki geliştirme sunucusu bunun birkaç katıdır. Gecikmenin en büyük kalemi beklemenin kendisi. Kalan kısmın asıl sorunu süre değil, sayfanın baştan kurulması.

### Hedef deneyim

| # | İstek | Mimari karşılık | Faz |
| --- | --- | --- | --- |
| 1 | Değişiklik anında görünür, sayfa baştan yüklenmez, kayıt arka planda olur | Kararlı oturum (§1), köprü (§2), `router.refresh()` (§3); görünüm ayarında iyimser yama (§3) | 1 (yükleme biter), 3 (anında) |
| 2 | Önizleme olduğu yerde kalır | iframe adresi değişmez; RSC birleştirmesi kaydırmayı korur (§3) | 1 |
| 3 | Seçilen, yeni eklenen ya da taşınan bölüme yumuşak kayma ve kısa vurgu | `select` / `scroll-to` mesajları, `data-qs` işareti (§2, §4, §6) | 1 |
| 4 | Önizlemede üstüne gelince çerçeve ve ad; tıklayınca form | iframe içinde katman (§4), `hover` / `click` mesajları | 2 |
| 4+ | Sayfa üstünde doğrudan metin düzenleme | Alan işareti ve ayrı ADR (§9) | 4 |
| 5 | Geri al/yinele, çıkış uyarısı, taslak/yayın ayrımı | Değişmez; köprü bunların üstüne oturur (§5) | hepsi |
| 6 | Ölçülebilir etki süresi | Bütçe ve ölçüm (§8) | 1'de ölçüm, 3'te bütçe |

## Başkaları nasıl yapıyor

| Ürün | Önizleme | Değişiklik nasıl yansır | Seçim ve kaydırma | Kaynak |
| --- | --- | --- | --- | --- |
| **Shopify tema düzenleyici** | Ayrı önizleme. iframe olduğu belgede yazmıyor (**doğrulanmadı**) | İçerik "dynamically added, removed, or re-rendered directly onto the existing DOM, without reloading the entire page". Önizleme kaydedilmemiş değişikliği gösterir; geri al/yinele kayda kadar çalışır | Seçilen bölüme editör "automatically scrolls to the section". Olaylar: `shopify:section:load/unload/select/deselect/reorder`, `shopify:block:select/deselect`, `shopify:inspector:activate/deactivate`; `detail.load` olayın yeniden çizimden mi seçimden mi geldiğini söyler. Editör içi bilgi: `Shopify.designMode`, `request.design_mode`. Inspector bölümleri `data-shopify-editor-section` / `-blocks` özniteliklerinden ve `getBoundingClientRect()` ile bulur | [Bölüm entegrasyonu](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks), [Inspector](https://shopify.dev/docs/storefronts/themes/best-practices/editor/preview-inspector), [Düzenleyici](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview) |
| Shopify Section Rendering API | Yok (vitrinin kendi JS'i için) | `sections=` en çok 5 bölümün HTML'ini, `section_id=` tek bölümü döndürür. Ayar API'den verilemez, kayıtlıdan çizilir. Editörün kendisi bunu kullanıyor mu: **doğrulanmadı** | Yok | [section-rendering](https://shopify.dev/docs/api/section-rendering) |
| Elementor | Panel + önizleme alanı | Önizleme "rendered by a JavaScript engine, typically without loading from the server side". Widget başına PHP `render()` ve JS `content_template()`: iki ayrı şablon | Editör ile önizleme aynı kökende, doğrudan erişim | [Widget rendering](https://developers.elementor.com/docs/widgets/widget-rendering), [Preview](https://developers.elementor.com/docs/editor/elementor-preview) |
| Divi 5 | Visual Builder (TS/React) | Builder React `edit` ile, ön yüz PHP ile çizer. İkisinin aynı tutulması gerektiği belgede açıkça kabul ediliyor | Sayfa üstünde düzenleme. iframe kullanıp kullanmadığı **doğrulanmadı** | [Divi 5](https://dev.elegantthemes.com/docs/introducing-divi-5/what-is-divi-5/) |
| WordPress Site Editor | iframe ("have always been iframed") | Bloklar istemcide `edit` ile çizilir. Sunucu çizimi (`ServerSideRender`) "fallback or legacy" sayılır | Blok seçimi tuvalde | [WP 6.3](https://make.wordpress.org/core/2023/07/18/miscellaneous-editor-changes-in-wordpress-6-3/), [ServerSideRender](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-server-side-render/) |
| Sanity Presentation | iframe; Comlink (`postMessage` üstünde el sıkışma, nabız, köken doğrulama) | Next.js App Router'da `<SanityLive />` her değişiklikte `router.refresh()` çağırır; bütün rota yeniden çizilir, yavaş parçalar `<Suspense>`'e alınır | Stega ya da `data-` öznitelikli katman; tıklayınca alan açılır | [Mimari](https://www.sanity.io/docs/visual-editing/visual-editing-architecture), [Performans](https://www.sanity.io/docs/visual-editing/presentation-performance) |
| Storyblok | iframe + bridge | `input` olayı kaydedilmemiş belgeyi taşır, `change` kayıttır. React SDK v8 RC'deki `StoryblokPreview`, değişikliği bir Server Action ile sunucuda yeniden çizer (varsayılan 200 ms bekleme), güncelleme gelene kadar eski içeriği ekranda tutar | `data-blok-c` / `data-blok-uid` işaretleri | [Bridge](https://www.storyblok.com/docs/libraries/js/preview-bridge), [v8 RC](https://www.storyblok.com/docs/libraries/js/react-sdk/v8rc) |
| Builder.io | iframe + `postMessage` | Sayfadaki bileşen kendini editöre tanıtır; editör değişiklikleri JSON olarak gönderir, istemcide çizilir | Editörde | [Teknik](https://www.builder.io/c/docs/how-builder-works-technical) |
| Contentful Live Preview | iframe | Güncelleme "only happening on the client-side". `targetOrigin` izinli kökenleri sayar. README: Draft Mode iframe'de paylaşılmayabilir | Inspector | [README](https://github.com/contentful/live-preview/blob/main/README.md) |
| Payload | iframe + `postMessage` | İstemci yolu (`useLivePreview`) her değişiklikte, kaydedilmemişi de gösterir. RSC yolu (`RefreshRouteOnSave`) yalnız kayıtta `router.refresh()` çağırır; otomatik kayıt önerilir. Köken `serverURL` ile denetlenir | Yok | [Server](https://payloadcms.com/docs/live-preview/server), [Client](https://payloadcms.com/docs/live-preview/client) |

**Next.js 16.** `router.refresh()` belgedeki tanımı: "The client will merge the updated React Server Component payload without losing unaffected client-side React (e.g. `useState`) or browser state (e.g. scroll position)". Sunucu önbelleğini temizlemez (["useRouter"](https://nextjs.org/docs/app/api-reference/functions/use-router)). Draft Mode `__prerender_bypass` çerezini kullanır. Üretimde bu çerez `SameSite=None; Secure` olur ve `Partitioned` taşımaz ([kaynak](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/async-storage/draft-mode-provider.ts)). Safari ve Firefox üçüncü taraf çerezleri varsayılan olarak kısıtlar ([MDN](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies)). Bu yüzden başka sitedeki bir iframe'de Draft Mode düşebilir.

**Alınan dersler.**
1. Önizleme sayfası değiştirilmez, yerinde güncellenir. Bütün emsaller böyle çalışıyor.
2. Bölümleri DOM'da işaretlemek, editör olaylarını tanımlamak ve seçilen bölüme editörün kaydırması Shopify'ın sözleşmesidir. Doğrudan örnek alınır.
3. İki ayrı çizim yolu, yani sunucu şablonu artı istemci şablonu (Elementor, Divi, WP), hız kazandırır ama iki kopyanın birbirinden kopma bedelini getirir. RSC'de tek çizim yolu bu bedeli baştan kaldırır.
4. Bizim yığına en yakın emsaller Sanity ve Payload'un RSC yolu: değişiklik kaydedilir, ardından `router.refresh()` gelir. Hız beklemenin kısalığından ve sorgu maliyetinden gelir. Storyblok v8 ise kaydedilmemiş durumu bir Server Action ile çizer. Ölçüm sonrasına bırakılan seçenek budur (§3).
5. Köprü bir el sıkışmayla başlar. Köken her iki yönde tam olarak denetlenir (MDN [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage): "Always specify an exact target origin, not `*`").
6. Jeton çerezde değil yolda durur. Bizim bugünkü yolumuz zaten bu ve iframe'de çerez sorunlarını baştan önler.

## Karar: katmanlı mimari

Beş katman üst üste kurulur. Her biri altındakinin üstünde tek başına teslim edilebilir.

1. **Kararlı önizleme oturumu.**
2. **Düzenleyici köprüsü** (`postMessage`).
3. **Yeniden çizim:** sunucudan `router.refresh()`, görünüm ayarlarında üstüne iyimser yama.
4. **Bölüm işaretleme sözleşmesi ve vurgu katmanı.**
5. **İki hızlı kayıt.**

Bugünkü taslak, yayın ve geri al/yinele modeli olduğu gibi kalır.

### 1. Kararlı önizleme oturumu

- **Yeni jeton türü.** `sfs_` önekli oturum jetonu, kayda değil düzenleyici oturumuna bağlıdır. Bugünkü `sfl_` bağlantısı "yeni sekmede önizle" ve paylaşım için olduğu gibi kalır: kayıt anında donar, 24 saat yaşar (§3'ün güvenlik kararı korunur).
- **İmza ve sunucu kaydı birlikte.** Jeton `sfs_<128 bit rastgele kimlik>.<son>.<mac>` biçimindedir. `previewSigner` kendi bağlamıyla (`layout-session:v1`) kullanılır. Oturum Redis'te kiracı ad alanıyla tutulur (`lib/redis`, `tenantNamespace`): `{ user_id, created_at, last_seen }`. Jetonun geçmesi için imzanın doğru olması **ve** kaydın Redis'te bulunması gerekir. Redis'e ulaşılamazsa uç 404 döner ve panel bugünkü `sfl_` akışına düşer (bkz. Geri alma).
- **Ömür.** Boşta 30 dk; panel açıkken birkaç dakikada bir yenilenir; en çok 12 saat. Aşağıdaki durumlarda iptal edilir:
  - düzenleyiciden çıkışta `DELETE`,
  - oturum kapatılınca,
  - kullanıcı devre dışı bırakılınca ya da rolü değişince.
- **Uçlar.**
  - `POST /admin/storefront-layout/editor-session` oturumu açar ve `{ path, url, expires_at }` döner. Yalnız düzen yazabilen roller kullanabilir (`owner`, `admin`; adr/0049 §5, adr/0040). Hız sınırı vardır.
  - `PUT …/editor-session/:id` oturumu yeniler, `DELETE …/editor-session/:id` iptal eder.
  - `GET /store/storefront-layout/session/:token` taslağın **son kaydedilmiş hâlini** verir. Yanıtın biçimi bugünkü önizleme ucunun yanıtıyla aynıdır; ek olarak `edition` alanı (taslağın `updated_at`'i) taşır. İlk satırda `Cache-Control: private, no-store` yazar.
- **Vitrin.** Vekilin jeton düzeni (`proxy.ts:41`) `sfs_` önekini de kabul eder. Başlık aynı kalır (`x-qt-layout-preview`). `currentLayout()` ve `/onizleme/[token]` hangi ucu çağıracağını önekten seçer.
- **Sonuç.** iframe adresi oturum boyunca değişmez. Kayıt, sayfa değişimi ve örnek ürün değişimi adres değiştirmez, köprü mesajıyla yapılır (§2 `navigate`).

### 2. Düzenleyici köprüsü

- **Zarf.** Her mesaj şu biçimdedir: `{ channel: "qt-editor", v: 1, type, seq, payload }`. `seq` mesaj sırasını tutar, yanıtlar onu geri taşır. Şemalar `@qticaret/types` içinde zod ile yazılır (`editor-bridge`; paket zaten zod kullanıyor). Panel ve vitrin aynı şemayı kullanır. Şemaya uymayan, sürümü tanınmayan ya da 64 KB'den büyük mesaj sessizce atılır ve sayılır.
- **Panelden vitrine giden mesajlar:**

  | Tür | Yük | Ne yapar |
  | --- | --- | --- |
  | `init` | `scale`, `labels` (kimlik → görünen ad), `selected`, `inspect` | El sıkışmayı tamamlar |
  | `refresh` | `edition` | Bu sürümü çiz (`router.refresh()`) |
  | `select` | `id \| null`, `reveal`, `flash` | Seçim çerçevesi; görünmüyorsa kaydır |
  | `hover` | `id \| null` | Panel ağacının üstüne gelinen satırını önizlemede çerçeveler |
  | `scroll-to` | `id`, `block: "start" \| "center"` | Seçimi değiştirmeden kaydırır |
  | `navigate` | `page` (yalnız göreli yol; `previewPage` ile doğrulanır) | Sayfayı ya da örnek ürünü değiştirir (`router.replace`) |
  | `patch` | `{ kind: "theme", settings }` \| `{ kind: "look", id, look }` \| `{ kind: "hidden", id, hidden }` | İyimser yama (§3) |
  | `scale` / `labels` / `inspect` | — | Ölçek, adlar ve inceleme kipi değişir |

- **Vitrinden panele giden mesajlar:**

  | Tür | Yük |
  | --- | --- |
  | `ready` | `v`, `path`, `edition` (el sıkışma) |
  | `rendered` | `edition`, `ms` |
  | `sections` | `[{ id, top, height, visible }]` |
  | `click` | `id` |
  | `hover` | `id \| null` |
  | `missing` | `id`, `reason: "hidden" \| "scheduled" \| "other_page" \| "timeout"` |
  | `key` | `undo` \| `redo` \| `escape` |
  | `navigate-request` | `path` |
  | `error` | `code` |

- **Köken.** Panel yalnız `event.origin === STOREFRONT_ORIGIN && event.source === iframe.contentWindow` koşulunu sağlayan mesajı kabul eder. Vitrin yalnız `PANEL_ORIGIN` kökeninden ve `event.source === window.parent` olan mesajı kabul eder. `targetOrigin` her iki yönde tam kökendir, `*` asla kullanılmaz. Köprü yalnız çerçeve içindeyken (`window.parent !== window`) ve jeton `sfs_` ise etkinleşir. Panelin kökeni sunucudan, `frame-ancestors`'ta kullanılan `panelOrigins(env)` değerinden prop olarak gelir; istemci tahmin etmez. Panelin `STOREFRONT_ORIGIN`'i canlı derlemede yalnız `VITE_STOREFRONT_ORIGIN`'dir; tanımlı değilse köprü açılmaz ve imzalı bağlantı akışı (`sfl_`) çalışır, geliştirmede `http://localhost:8000` varsayılır (güvenlik incelemesi 2026-11-15).
- **Yalnız önizleme rotasında.** Köprü bir istemci bileşenidir (`EditorBridge`). Yalnız `/onizleme/[token]` sayfası onu `sfs_` jetonunda dinamik içe aktarmayla yükler. Next istemci paketlerini rotaya göre böldüğü için canlı sayfalara tek bayt eklenmez. Bunu bir derleme denetimi doğrular (§8).
- **CSP.** Değişmez. Köprü kendi paket dosyasından nonce'lu yüklenir (`strict-dynamic`). `postMessage` için `connect-src` gerekmez. İyimser yamanın stili, sunucunun prop olarak verdiği nonce'la köprünün kendi `<style>` öğesine yazılır. Katmanın konumu CSSOM ile verilir. `style-src-attr` yalnız işaretlemedeki ve `setAttribute` ile yazılan öznitelikleri kapsar; bu Faz 2'de CSP ihlal dinleyicili e2e ile doğrulanır (**doğrulanmadı**).
- **Tema olayları** (Shopify'daki karşılıkları). Köprü önizleme belgesinde `qt:section:select` / `qt:section:deselect` (`{ sectionId, load }`) DOM olaylarını yayar. Bunları dinlemek temanın isteğine bağlıdır: Atölye, gizli sekmedeki rafı açmak ya da slaytı durdurmak için kullanır. Kök öğeye `data-qt-editor` (`Shopify.designMode` karşılığı) ve inceleme kipinde `data-qt-inspect` yazılır. Tema bunlarla otomatik oynatmayı ve inceleme sırasında yapışkan üst bilgiyi kapatabilir (Shopify inspector önerisi). Shopify'ın `section:load` ve `section:unload` olaylarına gerek yoktur: RSC birleştirmesi değişen bileşeni React yaşam döngüsüyle yeniden kurar, sayfanın JS'i HTML takasıyla ölmez.

### 3. Yeniden çizim stratejisi

| Seçenek | Gecikme (kayıttan sonra, tahmin) | Karmaşıklık | Tema sözleşmesi | Veri isteyen bölüm (ürün rafı, kategori sayımı) | Güvenlik | Test | Karar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **(1) `router.refresh()`**: kayıttan sonra bütün rota sunucudan yeniden çizilir, RSC birleşir | ~150–400 ms (docs/21 TTFB'si + aktarım) | Düşük; köprüde single-flight | Değişmez | Doğal: sunucu her şeyi bugünkü gibi getirir | Yeni yüzey yok; okuma bugünkü uçtan | Kolay (e2e) | **Seçilen, temel yol** |
| (2) Kaydedilmemiş taslağı `postMessage` ile gönderip sunucuda geçici çizdirmek (Storyblok v8 benzeri Server Action) | Bir gidiş dönüş daha az (~100 ms) | Orta-yüksek: backend'de belge kabul eden yeni bir `/store` ucu, doğrulama ve çözüm ikinci kez | Değişmez | Doğal | Tarayıcı zincirinden tam belge kabul eden uç: DoS ve doğrulama yüzeyi | Orta | Ölçüme bağlı; bütçe tutmazsa |
| (3) Bölüm başına yeniden çizim (Shopify Section Rendering benzeri) | Bölüm büyüklüğüyle orantılı | Yüksek: Next'te bölümün RSC'sini tek başına üretmenin belgelenmiş yolu yok (Server Action JSX döndürür, ama bu kalıp rota çizimi kadar oturmuş değil) | Bölümün tek başına çizilebilmesi gerekir: kategori sayfasında ızgara ve yan sütun, birleşik raf ve SSS+yardım gibi | Bölüm başına getirme | Yeni uç | Zor | Ölçüme bağlı; büyük sayfada (1) yavaşsa |
| (4) İstemcide çizim (Elementor, Builder, Payload istemci yolu) | En düşük | Çok yüksek | Atölye bölümleri sunucu bileşeni ve sunucu verisine bağlı; ikinci tema yazanın her bölümü istemcide de çalışacak biçimde yazması gerekir; iki yol birbirinden kopar | Kırık: vitrin tarayıcıdan Store API çağırmıyor (adr/0046 §5), raf verisi istemcide yok | Taslak verisi istemcide | Zor | Reddedildi |
| **(5) İyimser yama + arkadan doğrulayan (1)** | Görünümde < 1 kare | Orta, kapsamı dar tutulursa | Temanın `style(settings)` işlevi saf ve istemcide çalışır olmalı (bugün öyle); `Look` öznitelikleri | Uygulanmaz (yalnız görünüm) | Değerler şemadan geçer, serbest CSS yok | Birim + e2e | **Seçilen, Faz 3** |

- **Karar: (1) + (5).** Faz 1'de (1) tek başına tam yüklemeyi bitirir. Faz 3'te (5) görünümü anında yapar. (2) ve (3), Faz 3'ün ölçümü bütçeyi tutturamazsa ayrı ekle açılır. İkisi de köprünün sözleşmesini değiştirmez, yalnız `refresh`'in arkasındaki işi değiştirir.
- **(1)'in ayrıntısı.**
  - Köprü `refresh`'i `startTransition(() => router.refresh())` ile çalıştırır. Geçiş bitince sunucunun çizdiği `edition` değerini (köprüye prop olarak gelir) `rendered` ile panele bildirir.
  - Aynı anda tek yenileme çalışır. Bu sırada gelen istek sona bir kez daha eklenir (autosave'deki tek uçuş deseni).
  - Geçiş sırasında React açılmış Suspense sınırlarını yeniden yedek görünüme döndürmez; eski içerik yenisi gelene kadar ekranda kalır (Storyblok'un "keeping the current content on screen" davranışı).
  - Yavaş bölümler gerekirse `<Suspense>`'e alınır (Sanity önerisi).
  - Bölümlerin `key` değeri kimliktir (`Blocks.tsx:157`). Taşınan bölümün DOM'u ve istemci durumu yeniden kurulmadan yer değiştirir.
- **(5)'in kapsamı** (yalnız görünüm, sunucuyu beklemeden):
  - **(a) Tema ayarları:** köprü temanın `entry.style(settings)` işlevini istemcide çalıştırır ve sonucu kendi nonce'lu `<style>` öğesine yazar. Bu öğe kök düzendekinden sonra geldiği için onu ezer. Ayarlar önce adr/0062'nin şemasından (renk biçimi, sabit listeler) geçer. Yazı tipi değişince yeni yüz yüklenirken kısa bir yanıp sönme olabilir.
  - **(b) Bölüm görünümü** (`look`: zemin, boşluk, hiza, genişlik): `Look` kutusunun `data-*` öznitelikleri yazılır.
  - **(c) Gizle/göster:** köprünün stilinde `[data-qs="…"]{display:none}` kuralı.
  - **Yama günlüğü:** köprü yazdığı her yamayı kaydeder. `rendered` geldiğinde önce yamaları geri alır, sonra sunucunun çizdiğini bırakır. Bunun nedeni şu: React bir özniteliği yalnız kendi önceki değerinden farklıysa yazar. Geri alınmayan bir yama, değer eski hâline döndüğünde (ör. geri al) DOM'da yanlış kalabilirdi. Metin, sıra, kaynak ve veri değişiklikleri yamalanmaz; onlar (1) ile gelir.

### 4. Bölüm işaretleme sözleşmesi ve vurgu katmanı

- **İşaret: `data-qs="<bölüm kimliği>"`.** Bu, adr/0049 Ek §8'deki kutunun kendisidir. Özel CSS'i kapsamlamak ve düzenleyicinin bölümü bulması için tek kutu ve tek öznitelik kullanılır. Kimlik biçimi `^[a-z0-9]{6,24}$` olduğundan seçicide güvenlidir.
- **Sözleşme maddeleri** (`packages/ui` tema sözleşmesine yazılır, `sectionMark(id)` yardımcısıyla):
  - Sayfada görünen her bölüm, gövde, üst ve alt bilgi ile ana bölümler (`product_main`, `category_main`) dahil, `[data-qs="<id>"]` ile **tam bir öğeye** çözülür.
  - Kutu gerçek bir kutudur. `display: contents` olamaz, çünkü boyutu ve kaydırma hedefi olmaz.
  - Başka bir bölümün içinde çizilen bölüm (sekmeli raftaki raf, SSS'nin içindeki yardım) kendi öğesinde kendi işaretini taşır. Gizli bir sekmede durabilir; köprünün `qt:section:select` olayıyla tema onu açar.
  - Görünüm ayarı olmayan bölüm de kutu alır. Bugün `Look` bu durumda kutu çizmiyor (`Look.tsx:27-29`); kutunun düzene etkisi E8 işiyle birlikte ekran görüntüsü karşılaştırmasıyla denetlenir.
  - Tür ve ad DOM'a yazılmaz: panel bunları belgeden bilir, köprüye `labels` ile gönderir.
- **Canlıda da var (önerilen; açık karar 4).** E8 özel CSS için işareti canlıda zaten istiyor. Bölüm başına yaklaşık 20 bayt, sıkıştırmadan önce sayfa başına 0,5 KB'nin altında. SEO'ya etkisi yok: anlam taşımayan bir `data-` özniteliği. Editöre özel her şey (`data-qt-editor`, katman, olaylar) yalnız önizlemededir.
- **Bloklar** (slayt, SSS maddesi, rozet). Shopify'daki `block:select` karşılığı `data-qb` işaretidir ve Faz 2'nin isteğe bağlı parçasıdır. Önkoşulu, tekrarlanan öğelerin belgede kalıcı bir kimliği olmasıdır. Bu ayrıca doğrulanır; yoksa ayrı iş olur.
- **Vurgu katmanı iframe'in içinde çizilir.** Seçim çerçevesi, üstüne gelme çerçevesi ve ad etiketi köprünün kendi öğesinde, bir shadow root altında durur. Temanın stili ve kapsamlanmış özel CSS buraya ulaşamaz.
  - Konum `getBoundingClientRect()` ile hesaplanır; sayfa kaydıkça katman da doğal olarak kayar.
  - Panelin uyguladığı ölçek (`preview-fit.ts`) iframe'in içindeki CSS pikselini değiştirmez, bu yüzden koordinat dönüşümü gerekmez. Yalnız görsel kalınlık telafi edilir: çizgi `2px / scale`, etiket `12px / scale`. Ölçek `init` ve `scale` mesajlarıyla gelir.
  - Panelin üstünde çizilen katman reddedildi: her kaydırma, boyut değişimi ve animasyonda konum akışı ve `ölçek × konum + iframe ofseti` dönüşümü gerekirdi, katman bir kare geride kalırdı.
  - Tema için kural Shopify'daki gibidir: negatif kenar boşluğundan kaçınılır, gizli öğe `display:none` olur.

### 5. Kayıt modeli

- **Tek taslak kalır.** Ayrı bir "çalışma taslağı" katmanı kurulmaz. Taslak zaten çalışma kopyasıdır: sürüm yalnız yayında yazılır, kayıt geçmişi kirletmez (`workflows/storefront/layout.ts`). Payload'un RSC yolu da kayıt + yenileme biçimindedir.
- **İki hız.**
  - **Ayrık eylemler** (ekle, sil, taşı, gizle/göster, seçim kutusu, renk seçimi bırakılınca) beklemeden kaydedilir. Tek uçuş kuralı aynen geçerlidir. Bu Faz 1'de gelir.
  - **Metin yazımı** bugünkü birleştirme anahtarıyla (`merge`) 1,5 sn yerine yaklaşık 400 ms bekler. Bu Faz 3'te gelir; Storyblok'un varsayılanı 200 ms.
  - Sorunlu belge yine kaydedilmez. Önizleme son geçerli hâli gösterir, panel bugünkü gibi sorunu işaretler.
- **Geri al/yinele** istemcide kalır (`editor-state.ts`). Geri almak da bir belge değişikliğidir: kaydedilir, yenilenir, görünümse yamalanır. Odak önizlemedeyken basılan Ctrl/Cmd+Z ve Shift+Z köprüden `key` mesajıyla panele iletilir. Bugün odak iframe'deyse kısayol panele ulaşmıyor.
- **Çıkış uyarısı** değişmez (`LeaveGuard`). Çıkışta oturum iptal edilir.
- **Eşzamanlı iki düzenleyici** (açık karar 3).
  - Önerilen yol çatışma tespitidir. Kayıt, son okunan `updated_at` değerini `If-Match` olarak gönderir; uyuşmazsa `409 storefront_layout.draft_conflict` döner ve panel "başka biri değiştirdi: yeniden yükle / benimkini kaydet" diye sorar. Migration gerekmez.
  - Oturum kaydı aynı zamanda varlık bilgisidir: "Ayşe de düzenliyor".

### 6. Akışlar

- **Açılış.** Panel oturumu açar ve iframe'i bir kez yükler. Köprü `ready` gönderir, panel `init` ile yanıtlar. 5 sn içinde `ready` gelmezse panel bugünkü `sfl_` akışına düşer ve "canlı önizleme kullanılamıyor" der.
- **Seçim (ağaç → önizleme).**
  1. Form açılır ve `select { id, reveal: true, flash: true }` gönderilir.
  2. Köprü `[data-qs=id]`'yi arar. Bulamazsa `missing` gönderir: gizli, zamanlaması dışında (yayın zamanlaması, `layout/schedule.ts`) ya da başka sayfada. Panel nedeni satırın yanında söyler.
  3. Bölüm görünür alandaysa kaydırma olmaz (açık karar 5). Değilse `scrollIntoView({ behavior: "smooth", block: "start" })` çalışır. Yapışkan üst bilgi için `[data-qs]{scroll-margin-top: …}` kullanılır.
  4. `qt:section:select` olayı yayılır.
  5. İnce bir seçim çerçevesi kalır, 1,2 sn süren bir vurgu sönümlenir.
- **Yeni bölüm.**
  1. `add` uygulanır ve beklemeden kaydedilir.
  2. Kayıt bitince panel `refresh { edition }` ile `select { id, reveal, flash }` gönderir.
  3. Köprü seçim isteğini `rendered.edition` ilgili kayda ulaşıp öğe DOM'a girene kadar bekletir, sonra kayar ve vurgular.
  4. 5 sn içinde olmazsa `missing: timeout` gönderir.
- **Taşıma.** Yenilemeden sonra taşınan bölüm görünür alanın dışına çıktıysa onun yerine kayılır ve vurgulanır. Silmede kaydırma yoktur.
- **Sayfa, örnek ürün ve cihaz.** Sayfa ve örnek ürün değişimi `navigate` ile yapılır (`router.replace`). Yeni sayfa en üstten açılır. Cihaz değişimi yalnız genişliği değiştirir, yükleme olmaz.
- **Önizlemeden seçim (Faz 2).**
  - İnceleme kipinde `pointermove`, `requestAnimationFrame` ile seyreltilir. En yakın `[data-qs]` atası çerçevelenir ve adı gösterilir. `hover` mesajıyla panel ağacındaki satır da vurgulanır; panel ağacında üstüne gelinen satır da önizlemede çerçevelenir.
  - Tıklama yakalama evresinde alınır (`preventDefault`). `click { id }` gider; panel formu açar ve seçimi gönderir. Bölüm zaten göründüğü için kaydırma olmaz.
  - Bağlantılara tıklamak gezinti yapmaz, `navigate-request` olur. Panel yolu sayfa türüne ve örneğe çevirir (ürün ise ürün sayfası + o ürün).
  - "İncele" düğmesi kipi kapatır; o zaman önizleme normal sayfa gibi kullanılır (Shopify'ın inspector düğmesi).
- **Hareket azaltma.** `prefers-reduced-motion: reduce` iframe'in içinde okunur. Kaydırma `behavior: "auto"` olur, vurgu canlandırılmaz; çerçeve 1,2 sn durağan görünür.
- **Klavye.**
  - Birincil yol bugün de erişilebilir olan panel ağacıdır.
  - Faz 2'de önizleme odaktayken inceleme kipinde `Alt+↓` ve `Alt+↑` bölümler arasında gezer, `Enter` formu açar, `Escape` odağı panele döndürür (`key: escape`). Kesin tuşlar uygulamada erişilebilirlik denetimiyle belirlenir.
  - Seçim panelde `aria-live` ile duyurulur ("Seçildi: Öne çıkan ürün").

### 7. Güvenlik

`security-reviewer` incelemesi Faz 1'de (oturum, uç, köprü kökeni), Faz 3'te (yama) ve Faz 4'te (satır içi düzenleme) zorunludur. Ayrıca Deniz bakar.

| Tehdit | Önlem |
| --- | --- |
| **Çalınan önizleme bağlantısı** (iframe adresi, tarayıcı geçmişi, günlük) | `sfs_` jetonu yalnız taslağı okur, yazamaz. Boşta 30 dk, en çok 12 saat yaşar. Redis'ten iptal edilir (çıkış, oturum kapatma, rol değişimi). `no-referrer`, `noindex`, `no-store` başlıkları korunur. Jetonun geçtiği yol günlükte maskelenir (F2'nin redaksiyonu, docs/04). Uçta hız sınırı vardır. Paylaşmak için ayrı ve donmuş `sfl_` bağlantısı kalır. |
| **Kötü niyetli sayfa iframe'e ya da panele mesaj atar** | İki yönde tam köken ve `event.source` denetimi, zod şeması, boyut sınırı, sürüm alanı. `frame-ancestors` vitrini yalnız panelin çerçevelemesine izin verir. Köprü yalnız çerçeve içinde ve `sfs_` jetonunda çalışır. Köprünün yapabildikleri düşük yetkilidir: kaydırma, çerçeve, yenileme, şemadan geçmiş görünüm değeri. Yazma, serbest CSS, HTML, `eval` ve dış adrese gezinti yoktur. `navigate` yalnız `previewPage`'in kabul ettiği göreli yolu açar. Vitrinden gelen her mesaj panelde güvenilmez sayılır: kimlik belgede yoksa atılır, hiçbir değer HTML olarak basılmaz. |
| **Panelde XSS** | Bu durumda saldırgan zaten yönetici API'sini elinde tutar; köprü ona yeni bir yetki eklemez. Panel CSP'si ve `frame-ancestors 'none'` F16'da gelir (docs/04). |
| **Taslaktaki içerikle önizlemede betik çalıştırma** | Taslak canlıyla aynı hattan çizilir: zengin metin sunucuda temizlenir, özel CSS E8 süzgecinden geçer, CSP nonce'ludur. Köprü `dangerouslySetInnerHTML` kullanmaz, adları `textContent` ile yazar. Yamanın CSS'i yalnız temanın `style()` işlevinden, şemadan geçmiş değerlerle üretilir. |
| **Kiracılar arası** | Instance-per-tenant: anahtar (`PII_HASH_KEY`) ve Redis ad alanı kiracıya özgüdür. Bağlam (`layout-session:v1`) diğer jeton türlerinden ayrıdır; bir türün jetonu öbür türün ucunu açmaz (bugünkü test deseni). |
| **Yenileme fırtınası (DoS)** | Köprüde tek uçuş; vitrin ucunda ve oturum açmada hız sınırı. |
| **Çerez ve iframe** | Draft Mode ve çerez kullanılmaz; jeton yolda durur. Safari ve Firefox'un üçüncü taraf çerez kısıtları bizi etkilemez. iframe sandbox'ı aynen kalır: `allow-same-origin`, vitrinin kendi kökenine RSC isteği yapabilmesi için gerekli; panelin kökeni farklıdır. |

### 8. Performans ve ölçüm

- **Canlı vitrine etki sıfır olmalı.** Köprü yalnız önizleme rotasında, dinamik içe aktarmayla yüklenir. Bir derleme denetimi `.next` istemci başvuru dosyalarında köprü modülünün `/onizleme` dışında hiçbir rotada geçmediğini doğrular. Canlıda yeni başlık, yeni çerez ve önbellek değişikliği yoktur. Tek ek `data-qs`'tir; o da E8 ile ortaktır. Önizleme rotası zaten `noindex` (`proxy.ts:222-224`, `page.tsx:62`).
- **Bütçe.** Ölçüm üretim derlemesinde yapılır (`next build && next start`, docs/21 kurulumu), p75 değerleriyle:

  | Değişiklik türü | Hedef p75 | Üst sınır p95 | Ölçülen aralık |
  | --- | --- | --- | --- |
  | Görünüm (tema ayarı, bölüm görünümü, gizle) | < 100 ms | 150 ms | Girdiden önizlemede boyamaya |
  | İçerik ve sıra (metin, ekle, taşı, sil) | < 500 ms | 1000 ms | Kayıt anından (ayrık eylemde girdi anı, yazımda bekleme sonu) `rendered`'a |
  | Veri isteyen değişiklik (raf kaynağı, kategori seçimi) | < 1000 ms | 2000 ms | Aynı |
  | Seçim ve kaydırma | Kaydırma 100 ms içinde başlar | — | `select`'ten ilk kaydırma karesine |

- **Gerekçe.**
  - 100 ms, Nielsen'in "anlık" eşiği ([0,1 / 1 / 10 sn](https://www.nngroup.com/articles/response-times-3-important-limits/)) ve RAIL'in "100 ms içinde yanıt" ilkesidir ([web.dev](https://web.dev/articles/rail)). Görünüm ayarı sürüklenip denenir, bu yüzden kare kare izlenmelidir.
  - 500 ms, düşünce akışını bozmayan 1 sn sınırının içinde kalır ve ağ ile sunucu çizimine pay bırakır. INP'nin "iyi" eşiği olan 200 ms ([web.dev/inp](https://web.dev/articles/inp)) panelin kendi etkileşimleri için geçerlidir.
  - Üretim derlemesinde ana sayfanın TTFB'si 95–135 ms (docs/21). Kayıt artı yenileme için 500 ms gerçekçi. Bu tahmin Faz 1'in ölçümüyle doğrulanır.
- **Nasıl ölçülür.**
  - Panel her değişikliğe bir `editId` verir ve `performance.timeOrigin + performance.now()` ile damgalar.
  - Köprü yamadan sonra iki `requestAnimationFrame` geçince, yenilemeden sonra geçiş bitince aynı saatle damgalayıp `rendered`'a ekler. Aynı makinede iki belgenin saati karşılaştırılabilir.
  - Panel değerleri geliştirmede konsola, testte Playwright'a verir. Playwright e2e testi üretim derlemesinde 20 değişikliğin p75'ini bütçeyle karşılaştırır.

### 9. Sayfa üstünde metin düzenleme (ileri faz, ayrı ADR)

- **Ne gerekir.**
  - Alan işareti: `data-qf="<alan yolu>"`, metni taşıyan öğede. Sanity'nin `data-` / stega işaretinin karşılığı.
  - Köprüde `contenteditable="plaintext-only"` ile düz metin düzenleme ve her tuş vuruşunu panele bildiren `field-input` mesajı. Panel belgeyi günceller; geri al, birleştirme ve kayıt bugünkü yoldan işler.
  - Zengin metin için ayrı bir editör yüzeyi. Değişkenli metinler için kural: `{{…}}` belirteçleri önizlemede çözülmüş görünüyor, düzenlemede ham belirteç gösterilmeli.
  - Erişilebilirlik ve doğrulama: uzunluk sınırı, boş başlık.
- **Neden şimdi değil.** Faz 1–3 sahibin üç şikâyetini (yeniden yükleme, kaydırma, bölüm arama) çözer. Metin düzenleme her bölüm bileşenine alan işareti ekletir. Tema sözleşmesine kalıcı bir yük olduğu için ayrı karar ister. Divi ve Elementor emsalinde bu, iki çizim yolunun en çok koptuğu yerdir. Bizde tek yol kalır, ama her metin alanının DOM'da bulunabilir olması gerekir.
- **Ne zaman.** Faz 3 bittikten ve sahip kullandıktan sonra. Faz 3'ün `data-qs` ve köprü altyapısı bunun önkoşuludur.

## Değerlendirilen seçenekler

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| Bugünkü hâli korumak (her kayıtta yeni `sfl_` bağlantısı + tam yükleme) | Değişiklik yok; paylaşılan bağlantının güvenlik kararı basit | Sahibin şikâyetinin tamamı sürer | Reddedildi |
| Yalnız beklemeyi kısaltmak | Tek satır | Tam yükleme ve kaydırma sıfırlanması daha sık olur, rahatsızlık artar | Reddedildi |
| Kararlı jeton + `iframe.contentWindow.location.reload()` | Basit | Yine tam yükleme; kaydırma kaybolur | Reddedildi |
| **Katmanlı mimari: kararlı oturum + köprü + `router.refresh()` + iyimser görünüm yaması (seçilen)** | Tek çizim yolu; tema sözleşmesine yalnız `data-qs` ve isteğe bağlı olaylar eklenir; emsallerle uyumlu (Shopify'ın olay ve işaret sözleşmesi, Sanity ve Payload'un RSC yolu) | Yeni oturum türü ve köprü; Redis bağımlılığı (düşerse eski akış) | **Seçildi** |
| Draft Mode çerezi ile önizleme | Next'in kendi yolu | Başka sitedeki iframe'de `SameSite=None` çerez Safari ve Firefox'ta düşebilir; bizim jeton-yol modelimiz bunu zaten çözüyor | Reddedildi |
| İstemcide çizim (seçenek 4) | En hızlısı | İki çizim yolu, veri bölümleri kırık, tema sözleşmesi ağırlaşır | Reddedildi |
| Kaydedilmemiş taslakla sunucu çizimi (seçenek 2) / bölüm başına çizim (seçenek 3) | Daha düşük gecikme olasılığı | Yeni uç ve doğrulama yüzeyi / Next'te belgelenmiş yolu yok | Ölçüme bağlı, ayrı ek |
| Düzenleyiciyi vitrinin içine almak (iframe'siz, Divi gibi) | Gerçek sayfada düzenleme | Panel ayrı uygulama (adr/0022); yönetici yetkisi vitrin kökenine taşınır; canlı pakete düzenleyici kodu girer | Reddedildi |

## Sonuçlar

- **Değişen sözleşmeler.**
  - adr/0049 Ek 2026-11-02 "Önizleme": düzenleyici artık her kayıtta yeni bağlantı almaz, oturum jetonu kullanır. Paylaşılan `sfl_` bağlantısı aynı kalır.
  - adr/0049 Ek §8: `data-qs` kutusu düzenleyici için de sözleşmedir ve Faz 1'in önkoşuludur; E8'den önce yapılabilir.
  - `packages/ui` tema sözleşmesi: `sectionMark`, `qt:section:*` olayları, `data-qt-editor`.
  - `@qticaret/types` `editor-bridge` şemaları.
  - Düzen kaydında `If-Match` (açık karar 3'e bağlı).
- **Yeni.**
  - backend: `api/admin/storefront-layout/editor-session`, `api/store/storefront-layout/session/[token]`, `lib/storefront/editor-session.ts` (Redis, imza).
  - vitrin: `components/editor-bridge/` (yalnız önizleme), vekil düzeni.
  - panel: `editor/bridge/` (istemci, mesajlar, ölçüm), `preview-frame.tsx`'in kararlı adrese geçmesi.
- **Bilinen sınırlar.**
  - Kartlardaki "Az kaldı" gibi herkese açık uçtan gelen veriler önizlemede yayındakini gösterir (adr/0049; değişmez).
  - Menüler ekranındaki değişiklikler hemen yayındadır, önizlemeye yenilemeyle gelir.
  - Bölüm başına özel CSS'in iyimser yaması yoktur, (1) ile gelir.
- **Riskler.**
  1. `router.refresh()` bütün rotayı çizer. Ağır sayfada bütçe tutmayabilir. Azaltma: Faz 1'de ölçüm, `<Suspense>`, gerekirse seçenek 2 ya da 3.
  2. Next sürümlerinde yenileme davranışı değişebilir (kaydırma, istemci durumu). Azaltma: kaydırmanın korunduğunu sabitleyen e2e testi; Next yükseltmesinde zorunlu koşu.
  3. Dışarıdan DOM yaması React ile çatışabilir. Azaltma: kapsam dar (köprünün kendi stili ve `Look` öznitelikleri), yama günlüğü, `rendered`'da geri alma.
  4. `data-qs` kutusu düzeni bozabilir. Azaltma: canlı sayfalarda ekran görüntüsü karşılaştırması; E8 ile tek iş.
  5. Redis kesintisi oturumu düşürür. Azaltma: eski akışa otomatik dönüş ve "canlı önizleme kullanılamıyor" bildirimi.
  6. Odağın iframe'e kayması kısayolları yutar. Azaltma: `key` iletimi.
- **Geri alma.** Panelde `VITE_EDITOR_BRIDGE` bayrağı (varsayılan açık; `.env.example`'a yazılır). Kapalıyken bugünkü `sfl_` akışı aynen çalışır; bu yol silinmez. Her faz kendi bayrağıyla ya da kendi PR'ı geri alınarak kaldırılabilir. Backend uçları ek niteliğindedir, eski uçlar değişmez.

## Sahip kararları (2026-11-15)

Aşağıdaki "açık kararlar" bölümündeki şıklar şöyle kapandı; gövdede bunlarla çelişen bir cümle varsa bu bölüm geçerlidir. Sahibin genel hükmü: "bizde bunların hepsi olmalı, doğru bir mimari yapı ile yapalım, gerekirse değişikliğe gideriz."

| # | Karar | Seçilen | Kim |
| --- | --- | --- | --- |
| 1 | Önizlemede tıklama | **Tıklama her zaman gezer; bölümün üstüne gelince köşesinde "Düzenle" etiketi çıkar, ona tıklayınca formu açılır.** "İncele / Gez" kipi yok (önerilen şık seçilmedi). Etiket klavyeyle de erişilir olmalı; dokunmatikte her bölümde görünür küçük bir tutamak. | sahip |
| 2 | Anında yansımanın kapsamı | Görünüm ayarları ve gizle/göster; içerik sunucudan | sahip |
| 3 | İki kişi aynı anda düzenlerse | Uyarı + çakışmada sor | sahip |
| 5 | Seçilen bölüme kayma | Bölüm ekranda değilse kay; yeni eklenen bölüme her zaman | sahip |
| 4 | Bölüm işareti canlı sitede | Evet | Oğuzhan (önerilen şık) |
| 6 | Paylaşılan bağlantı | Bugünkü gibi donmuş | Oğuzhan (önerilen şık) |
| 7 | Sayfa üstünde metin düzenleme | Önce düz metin, ayrı ADR ile | Oğuzhan (önerilen şık) |

Yetki notu (sahip, 2026-11-15): backend ve güvenlik parçaları dahil bütün fazları Oğuzhan tarafı yazar; güvenlik dokunan PR birleşmeden önce `security-reviewer` koşulur (CLAUDE.md "Ortak çalışma"), Deniz'e haber notu düşülür.

## Sahibin onayına bırakılan açık kararlar

1. **Önizlemede tıklayınca ne olsun?**
   - (a) **Önerilen:** inceleme kipi açıkken tıklama bölümü seçer, formu açar, bağlantılar izlenmez. Üst çubuktaki "İncele" düğmesi kipi kapatır, o zaman önizleme normal site gibi gezilir. Shopify'ın inspector'ı bu düzende çalışıyor.
   - (b) Tıklama her zaman gezinir; seçim için bölümün köşesindeki "Düzenle" etiketine tıklanır.
   - (c) Seçim yalnız Alt+tıklama ile yapılır.
2. **Anında yansımanın kapsamı (Faz 3).**
   - (a) **Önerilen:** tema ayarları (renk, yazı tipi, köşe, düğme), bölüm görünümü (zemin, boşluk, hiza, genişlik) ve gizle/göster anında görünür. Metin ve sıra yarım saniye içinde sunucudan gelir.
   - (b) Hiçbir şey yamalanmaz, her şey yarım saniye içinde sunucudan gelir. Daha basit, görünüm ayarı sürüklenirken akıcı değil.
   - (c) (a) artı metin alanları anında; Faz 4'ün alan işaretini öne çeker.
3. **Aynı anda iki kişi düzenlerse?**
   - (a) **Önerilen:** ikisi de düzenleyebilir. "Ayşe de düzenliyor" uyarısı çıkar. Biri diğerinin kaydını ezmek üzereyse panel sorar.
   - (b) Kilit: düzenleyici aynı anda tek kişide açılır, ikinci kişi salt okur ya da kilidi devralır.
   - (c) Bugünkü gibi son kayıt kazanır.
   - Shopify'ın bu durumdaki davranışı belgede bulunamadı (**doğrulanmadı**).
4. **Bölüm işareti canlı sitede de dursun mu?**
   - (a) **Önerilen:** evet. Gelişmiş CSS (E8) bunu zaten istiyor; sayfa başına yarım KB'nin altında, SEO etkisi yok. Shopify da canlı sayfada bölümleri `shopify-section-<id>` kimlikli kutuya sarar (**doğrulanmadı**).
   - (b) Yalnız önizlemede. Bu durumda özel CSS için ayrı bir kapsamlama yolu gerekir.
5. **Seçilen bölüme kayma.** Ayar olarak sunulabilir: düzenleyicide "Seçilen bölüme kaydır" anahtarı.
   - (a) **Önerilen:** yalnız bölüm ekranda değilse yumuşak kayma ve 1,2 sn vurgu; ayar varsayılan açık.
   - (b) Her seçimde bölümü ekranın başına getir (Shopify'ın belgelenen davranışı "automatically scrolls to the section").
   - (c) Kayma yok, yalnız vurgu.
6. **Paylaşılan önizleme bağlantısı.**
   - (a) **Önerilen:** bugünkü gibi kalır. Bağlantı oluşturulduğu andaki taslağı gösterir, sonraki kayıtta kapanır.
   - (b) Paylaşılan bağlantı da taslağı canlı izler. Gönderilen kişi sonradan yazılanı da görür; 2026-11-02 güvenlik kararını geri çevirir.
7. **Sayfa üstünde metin düzenleme (Faz 4).**
   - (a) **Önerilen:** Faz 3'ten sonra ayrı ADR ile, önce yalnız düz metin alanları (başlık, alt başlık, düğme yazısı).
   - (b) Zengin metin dahil tek seferde.
   - (c) Hiç yapılmaz; form yeterli.

## Uygulama planı

| Faz | Kapsam | Boyut | Paketler | Kim bakar | Testler | Ölçüm |
| --- | --- | --- | --- | --- | --- | --- |
| **1. Yeniden yükleme ve kaydırma biter; bölüme kayma ve vurgu** | 1.1 `data-qs` kutusu (Atölye gövde, üst/alt bilgi, ana bölümler; `sectionMark` sözleşmesi). 1.2 Oturum jetonu: Redis kaydı, admin ve store uçları, vekil düzeni. 1.3 Köprü: `ready`/`init`, `refresh` → `router.refresh()`, `rendered`, `select`, `scroll-to`, `navigate`, `missing`, `key`. 1.4 Panel: kararlı adres, köprü istemcisi, kayıttan sonra `refresh`, ayrık eylemlerde beklemesiz kayıt, yeni ve taşınan bölüme kayma ve vurgu, `prefers-reduced-motion`, eski akışa dönüş | L (1.1 S, 1.2 M, 1.3 M, 1.4 M; her biri ayrı PR) | `packages/ui`, `packages/themes/atolye`, `packages/types`, `apps/backend`, `apps/storefront`, `apps/panel` | Deniz (backend, güvenlik); `security-reviewer`; 1.1 Oğuzhan | Birim: jeton (imza, süre, iptal, tür karışmaması), mesaj şemaları, köken reddi, tek uçuş. HTTP: oturum açma yetkisi (`owner`/`admin`, diğerleri red), iptal sonrası 404, Redis yokken 404, `no-store`. Vitrin: köprü yalnız `sfs_` ve çerçevede; paket denetimi (köprü modülü yalnız `/onizleme`'de). Panel: kayıttan sonra `src` değişmez, yeni bölümde `select` gider. Playwright: kaydırılmış önizlemede değişiklik → `scrollY` korunur, belge yeniden yüklenmez (`performance.navigation` girdisi tek); bölüm ekle → bölüm görünür alanda; kötü kökenden mesaj etkisiz | `rendered.ms` ve uçtan uca süre; içerik p75 raporu |
| **2. Önizlemeden seçme ve üstüne gelince çerçeve** | Shadow root'ta katman, ölçek telafisi, `hover` (iki yön), `click` → form, inceleme kipi ve düğmesi, bağlantı → `navigate-request`, `qt:section:select` (Atölye: sekmeli raf, slayt), `data-qt-editor`, klavye gezintisi, isteğe bağlı `data-qb` | M | `apps/storefront`, `apps/panel`, `packages/ui`, `packages/themes/atolye` | Oğuzhan; köken değişirse Deniz | Birim: en yakın bölümü bulma, ölçek hesabı. Playwright: üstüne gel → çerçeve ve ad; tıkla → doğru form; birleşik rafta gizli sekmedeki rafın seçilmesi; CSP ihlali yok; a11y (klavye, `aria-live`) | Seçimde kaydırma başlangıcı < 100 ms |
| **3. Anında yansıma** | İyimser yama (tema ayarı `style()`, `look` öznitelikleri, gizle), yama günlüğü ve geri alma, metin yazımında 400 ms, bütçe testi; ölçüm tutmazsa seçenek 2 ya da 3 için ek | M | `apps/storefront`, `apps/panel`, `packages/types` | Deniz (yama güvenliği), `security-reviewer` | Birim: yama → geri alma → sunucu çizimi aynı DOM; şemadan geçmeyen değer reddi. Playwright (üretim derlemesi): görünüm p75 < 100 ms, içerik p75 < 500 ms, veri p75 < 1000 ms; geri al sonrası yamanın kalmadığı | §8 tablosu, 20 değişiklik |
| **4. Sayfa üstünde metin** | Ayrı ADR: `data-qf`, düz metin `contenteditable`, `field-input`, belirteç kuralı | L | tema, köprü, panel | Deniz, `security-reviewer` | Ayrı ADR'de | Tuş vuruşundan boyamaya < 50 ms |

- **Sıra.** Faz 1 tek başına sahibin üç şikâyetini (yeniden yükleme, kaydırma, bölüm arama) bitirir. Faz 2 Divi ve Elementor hissini, Faz 3 "anında" hissini getirir.
- **Önkoşullar.** 1.1, E8 (adr/0049 Ek §8) ile tek iş olarak yapılır; Oğuzhan'ın alanıdır (tema). 1.2 Deniz'in alanıdır (backend, Redis, güvenlik); Oğuzhan başlamadan haber verir. Faz 1'in ölçüm sonucu bu ADR'a ek olarak yazılır ve Faz 3'ün kapsamı ona göre kesinleşir.

## Doğrulanmayanlar (bu ADR yazılırken)

- Shopify önizlemesinin iframe olduğu, editörün Section Rendering API'yi kullanıp kullanmadığı, hangi ayarın bütün önizlemeyi yenilediği, canlı sayfadaki `shopify-section-<id>` kutusu ve eşzamanlı düzenleme davranışı.
- Elementor'un `content_template()` olmayan widget'ı AJAX ile sunucuda çizdiği; Divi 5'in iframe kullanıp kullanmadığı; Contentful'ün `postMessage` ve `data-contentful-*` ayrıntıları (resmi sayfa erişilemedi).
- CSSOM ile yazılan konum stilinin `style-src-attr`'e takılmadığı (Faz 2'de e2e ile doğrulanacak); `startTransition` ile `router.refresh()`'in bitişinin güvenilir biçimde yakalanabildiği (Faz 1'in ilk işi).
- Sahibin bildirdiği yaklaşık 2 sn gecikme ölçülmedi; bileşenleri koddan ve docs/21'den çıkarıldı. Tekrarlanan öğelerin (slayt, SSS maddesi) kalıcı kimliği olup olmadığı.

## Ek 2026-11-15: Faz 2 uygulaması ve sistem sayfaları önizlemede

### 1. Faz 2 sahip kararı 1'e göre uygulandı

- **İnceleme kipi ve "İncele" düğmesi yok.** Önizlemede tıklama gezer. Gezinti önizlemenin içinde kalır. Bölümün üstüne gelince kesik çizgili çerçeve ve sağ üst köşede "Düzenle · <bölüm adı>" etiketi çıkar. Görünümün üstündeki kısa bölümde (üst bilgi) etiket bölümün alt kenarına asılı, solda durur; köşedeki sepet, favori ve arama örtülmez. Etikete basılınca `click` gider, panel formu açar ve `aria-live` ile "Seçildi: …" der. Dokunmatik ekranda (`hover: none`) her bölümde küçük bir "Düzenle" tutamağı görünür. Klavyede önizleme odaktayken `Alt+↓` / `Alt+↑` bölümler arasında gezer ve odağı etikete verir; etiket bir düğmedir, `Enter` ile açılır. `Escape` Faz 1'deki gibi odağı panele döndürür.
- **Katman** `qt-editor-layer` öğesinde, kapalı (`closed`) bir shadow root altındadır. Stili nonce'lu tek bir `<style>` öğesidir. Konum ve boyut CSSOM ile yazılır (`element.style.*`); `style` özniteliği ve `setAttribute("style")` kullanılmaz. Adlar `textContent` ile yazılır. Çizgi ve etiket `1/scale` katsayısıyla büyür.
- **Yeni mesajlar** (her biri yeni tür; eski türlere alan eklenmedi, böylece sürüm farkındaki taraf tanımadığını atar):
  - panelden vitrine `hover { id | null }` ve `labels { edit, names }` (en çok 400 ad, ad en çok 120 karakter);
  - vitrinden panele `hover { id | null }`, `click { id }`, `navigate-request { path, previewable }`, `location { path, sections }` ve `left { path | null }`.
  - `location`, çizilen sayfadaki bölüm kimliklerini sayfa sırasıyla taşır. Panel sayfanın türünü bunlardan çıkarır: ürün bölümleri varsa ürün sayfası ve o ürün örnek olur, kategori bölümleri varsa kategori sayfası, ana sayfa bölümleri varsa ana sayfa. Hiçbiri yoksa (sepet, arama, marka, blog) sayfa olduğu gibi gösterilir. Bu durumda panel "Önizlemede <yol> açık; bu sayfada üst ve alt bilgi düzenlenir" der, sayfa ya da örnek seçilince geri döner.
  - `left`: sayfa önizlemeden kendi başına çıkarsa (Next'in istemci gezintisi) köprü bunu söküm sırasında bildirir ve panel çerçeveyi o sayfa için önizleme adresinde yeniden yükler. Tarayıcıda istemci gezintisiyle (`router.push("/urun/…")`) doğrulandı: çerçeve önizlemeye döndü, panel ürün sayfasını seçti. Tam sayfa yüklemesinde (`location.assign`) Faz 1'in "5 sn'de `ready` yok" yolu çalışır. Yeniden açma 10 sn'de en çok 3 kez yapılır; aşılırsa panel imzalı bağlantıyla "Canlı önizleme kullanılamıyor" bildirimine düşer (bir sayfanın kendini sürekli yönlendirmesi döngü kuramaz).
- **Tutulan gezinti** (yakalama evresinde, `preventDefault` + `stopPropagation`):
  - Aynı kökenli düz sol tıklamalı bağlantılar panele sorulur.
  - Çerçevenin sandbox'ında `allow-forms` yoktur, tarayıcı form göndermez. `GET` arama formunda köprü `Enter`'ı ve gönder düğmesini (büyüteç) sentetik bir `submit` olayına çevirir. Yakalama evresinde `preventDefault` yapılır, adres panele `navigate-request` ile sorulur. Burada `stopPropagation` yoktur: sayfanın kendi `onSubmit`'i (açılır öneri panelini kapatma) çalışır. Arama böylece önizlemenin içinde `/arama?q=` açar (tarayıcıda doğrulandı).
  - Değiştirici tuşlu tıklama, `target="_blank"`, `download`, sayfa içi `#` atlaması, `mailto:` ve `tel:` tarayıcıya bırakılır.
  - Başka köken, `javascript:`/`data:` gibi şemalar, `/onizleme/…` adresleri ve `%2F`, `%5C`, `%00`, boşluk ya da denetim karakteri içeren yollar tutulur ve sessizce atılır.
  - Ödeme, hesap ve giriş gibi yollar `previewable: false` ile sorulur; panel "önizlemede açılmaz" der, gezinti olmaz.
  - React'in işlev eylemli formları ve `POST` formları (Server Action: sepete ekle, adet, indirim kodu) çerçevede **çalışmaz**. `allow-forms` olmadığı için tarayıcı gönderimi engeller (konsolda "Blocked form submission"). Bu bilinen bir sınırdır. `allow-forms` eklemek ayrı bir güvenlik kararıdır: çerçevedeki sayfanın bütün formları (POST'lar dahil) panelin içinden gönderilebilir hâle gelir. Önizleme görünüm içindir; sepet yazmaları yayındaki sitede denenir.
- **Tema olayları.** `qt:section:select` / `qt:section:deselect` (`{ sectionId, load: false }`, kabaran) seçimde kaydırmadan önce yayılır; `data-qt-editor` kök öğeye yazılır, söküldüğünde silinir. Seçili bölüm ayrıca `data-qt-selected` taşır. Yeni eklenen bölüm, tema parçası dinlemeye başlamadan önce bulunur; parça bağlanırken bu işareti okur. Henüz çizilemeyen bölüm (ör. slaytları eksik) sonraki yeniden çizimde ya da çerçeve yeniden açılınca (`init`) duyurulur. Atölye bu olaylarla iki şey yapar: sekmeli raftaki gizli sekmenin hapını işaretler (`ShelfTabsReveal`: canlı sayfada bir `<span hidden>` ve küçük bir istemci parçası ekler) ve seçili slaytın otomatik oynatmasını durdurur.
- **Yapılmayanlar.** İsteğe bağlı `data-qb` blok işareti yapılmadı: tekrarlanan öğelerin kalıcı kimliği hâlâ doğrulanmadı, ayrı iş. CSP ihlal dinleyicili e2e ve Playwright turları bu PR'da yazılmadı; tarayıcı doğrulaması birleşmeden önce elle yapılır.

### 2. Sistem sayfaları önizlemede: `/sepet` ve `/arama` (yapıldı)

- **Sorun.** `previewPage` sistem yollarını ana sayfaya düşürüyordu. Sepet ve arama sonuçları taslak temasıyla görülemiyordu; önizlemede arama yapınca ya da sepete gidince ana sayfa açılıyordu.
- **Karar.** Yalnız canlı oturumda (`sfs_`) `?sayfa=/sepet…` sepet sayfasını, `?sayfa=/arama?q=…` arama sonuçlarını taslağın üst/alt bilgisi ve tema ayarlarıyla çizer (`previewPage(raw, { system: true })`, `DesignPreviewScreen`'in `cart` ve `search` dalları). Paylaşılan `sfl_` bağlantısı bugünkü sayfalarla kalır.
- **Neden güvenli.** Önizleme yalnız çizimi taslak temasıyla yapar. Sepet verisi ziyaretçinin kendi çerezinden gelir. Jeton yeni veri erişimi vermez, yalnız taslak düzeni okur. Yanıt `/onizleme/` yolunda olduğu için vekil `no-store` + `noindex, nofollow` yazar, ölçüm etiketleri kapalı kalır (`x-qt-url`). Sepetteki yazma eylemleri (adet, kod, ek seçim) çerçevede çalışmaz: sandbox'ta `allow-forms` yok, Server Action formu gönderilemez (§1). Önizleme sepeti yalnız gösterir, değiştirmez. Ödeme, hesap, giriş ve diğer sistem yolları açılmaz; köprü onları `previewable: false` sayar, sunucu da ana sayfaya düşürür.
- **Bilinen sınırlar.**
  - Panel başka bir sitedeyse (üçüncü taraf çerçeve) tarayıcı `SameSite=Lax` sepet çerezini göndermez. Önizlemede sepet boş görünür (boş sepet tasarımı). Bu tarayıcı kuralıdır, düzeltilmez.
  - Sepet yazmaları (adet, sepete ekle, indirim kodu) önizlemede çalışmaz (bkz. §1). `left` yolu bugün yalnız istemci gezintisinde devreye girer.
  - Önizlemede yapılan aramalar mağazanın arama raporuna sayılır. Sayım backend'de, ilk süzülmemiş sayfada yapılır (`/store/listings/products`). Vitrin tek başına atlatamaz, backend'de önizleme işaretiyle atlama ayrı iş.
  - Önizlemede başka sayfaya geçince arama açılır paneli açık kalabilir: kök düzen istemci gezintisinde kalıcıdır, canlıda tam sayfa yüklemesi olur.
- **Önerilen ama yapılmayan.** Ödeme ve hesap sayfaları önizlemeye alınmadı. Ödeme sağlayıcı çerçeveleri iç içe iframe'de CSP `frame-ancestors` ve `form-action` kurallarına girer, hesap sayfaları oturum çerezine bağlıdır. Bunlar ayrı karar ister: ya örnek veriyle "tasarım görünümü" çizilir ya da yalnız yeni sekmede açılır.

### 3. Güvenlik incelemesi (2026-11-15)

KRİTİK, YÜKSEK ya da ORTA bulgu yok. Düşük ve bilgi bulguları:

- **DÜŞÜK-1, nonce (kapandı).** `router.refresh()` her yeniden çizimde sayfayı yeni bir nonce ile çizer, ama geçerli CSP ilk yanıtınkidir. Köprü nonce'u ilk değerinde dondurur (`useRef`), katman ve stil öğesi o nonce ile kalır. Panel her `ready`'de etiketleri yeniden gönderir.
- **DÜŞÜK-2, yeniden açma döngüsü (kapandı).** `left` ve beklenmeyen gezinti yeniden açmaları 10 sn'de en çok 3 kezdir. Aşılırsa panel vazgeçer, imzalı bağlantı ve "Canlı önizleme kullanılamıyor" bildirimi gösterilir.
- **DÜŞÜK-3, önizleme aramaları raporda (sonraya).** §2 bilinen sınırlar.
- **BİLGİ-1, `allow-forms` (ADR düzeltildi).** Ek, form gönderiminin çerçevede çalıştığını söylüyordu, doğrusu yukarıda. Sepet yazmaları bilinen sınırdır; `allow-forms` eklenmedi.
- **BİLGİ-2/3 (kapandı).** `ready.path` paylaşılan `framePath` kuralıyla doğrulanır, köprü yalnız `shownPage()` gönderir. `PREVIEW_ROOT` büyük/küçük harf duyarsızdır. Bölüm adı 80 karakterle sınırlıdır (`BRIDGE_MAX_NAME`). Atlatma vakaları `preview.spec.ts`'te.
- **Doğrulanmayan.** CSP ihlali geliştirme sunucusunda 0 (orada `style-src 'unsafe-inline'` açık). Üretim derlemesinde CSP ayrıca doğrulanmadı.

## Ek 2026-11-15: Faz 2b, öğe düzeyinde "Düzenle"

§9'daki alan işaretinin ilk kullanımı. Metin sayfa üstünde düzenlenmez; öğeye basınca panel o alanı açar.

- **Ne basılıyor.** `data-qf="<alan yolu>"`: tasarımdaki yol, küçük harf sözcük ve sayıların noktayla birleşimi (`heading`, `links.0`, `slides.2.heading`; en çok 4 parça, 80 karakter, `BRIDGE_FIELD_KEY`). İşaret metni ya da görselin kutusunu taşıyan öğededir, kendi bölümünün `data-qs` öğesinin içindedir. **Yalnız düzenleyicinin canlı oturumunda** (`sfs_`) basılır: görünümler o istekte `editor: true` taşır, `fieldMark()` başka hiçbir yerde bir şey yazmaz. Bu, açık karar 4'teki bölüm işaretinden farklıdır: yayındaki HTML ve görünüm kilidi değişmez, paylaşılan `sfl_` bağlantısında da işaret yoktur. Tekrarlanan parça (slayt, düğme, duyuru satırı) tasarımdaki yerini taşır, çizimdeki sırasını değil: atlanan slayttan ya da adı/adresi kırık düğmeden sonra gelen öğe kendi yerini söyler (`HeroCatalogSlideView.at`, `actionsAt`).
- **İşaretli alanlar (Atölye).**
  - Açılış (`hero`, standart): `heading`, `text`, `links.0`, `image`.
  - Katalog açılışı (`category_list`): `eyebrow`; slaytsız kayıtta `heading`, `text`, `links.0`, `links.1`, `image`; slaytlıda `slides.N.heading|text|links.M|image`.
  - Kayan açılış (`hero_slider`): `slides.N.image|heading|text|link`.
  - Slayt denetimleri (2026-11-19; katalog açılışı iki ve üstü slaytta, kayan açılış): oklar `scroller.arrows`, noktalar `scroller.dots`, görünür durdur düğmesi `scroller.play_button`; panelde ilgili kaydırma ayarı açılır (adr/0049 Ek 2026-11-19).
  - Ortak başlıklı bölümlerin başlığı (`SectionHead`): `title` (ürün rafı sekmesizken, kategoriler, markalar, yazılar, yorumlar, Google puanı [2026-11-27 kaldırıldı, adr/0058], fiyat bantları).
  - Duyuru şeridi: önizlemede şeride `data-qs` ve satırlara `lines.N`.
  - Yayılım (kalan bölümler): SSS `title`, `items.N.question|answer`; yardım `title`, `text` (SSS'ye bağlıysa başlık görünmediği için işaretsiz); bülten (sayfa ve alt bilgi) `title`, `text`; metin `title`, `body`; öne çıkan ürün `title`, `text`; güven rozetleri `badges.N.title|text`; bant `slides.N.image`, `heading`, `text`, `link`, `second_link`; kayan yazı `items.N.text|subtext` (yalnız ilk tur, kopyalar işaretsiz); fiyat bantları `bands.N.label|text`; katalog üst bilgisi `search_placeholder`, `highlight_link`.
  - Sekmeli raf: sekme 0 `title`, sekme k `tabs.k.M` (M çizilen sekme sayısı; panel kendi rafının sayısıyla karşılaştırır, tutmazsa yalnız rafı açar). Sütunlu raf: liste 0 `title`, liste k `lists.(k-1).title`.
  - "Tümünü gör" bağlantısı (2026-11-15 ek): ürün rafı ve kategoriler `more`, yalnız mağaza kendi bağlantısını seçtiyse (formdaki "Tümünü gör bağlantısı" / "Başlığın yanındaki bağlantı" alanı; rafın başlığında, sekme satırının yanında ya da sütunlu rafın altında). Temanın kendi yedeği ("Tüm kategoriler" → `/kategoriler`) işaretsizdir: formda karşılığı olan öğe yoktur.
  - Kayıttaki dizin: atlanan öğeden sonra gelen öğe kendi tasarım yerini taşır (`BannerSlideView.secondFirst`, `ShelfListView.at`, fiyat bandı `at`). Alt bilgi bülteni ve üst bilgi şeridi yalnız düzenleyicide `data-qs` basar (`ShopView.newsletter.mark`, `ShopView.editor`); yayındaki HTML değişmez.
- **Katman.** Faz 2 katmanının kapalı shadow root'unda durur (`field-layer.ts`). İmleç işaretli öğedeyse öğeye ince düz çerçeve ve sol üst kenarına küçük "Düzenle" etiketi çizilir; etiket bölümün kendi etiketine çarparsa öğenin altına iner. Arama öğeden bölümün öğesine kadar yukarı yürür, ötesine geçmez. Klavyede `Alt+↓/↑` bölüme gelince bölümün görünen alanları için birer düğme açılır, sekme sırasında bölüm etiketinin ardından gelir. Dokunmatikte öğe etiketi yoktur, bölüm tutamağı yol olarak kalır. Erişilebilir ad öğenin kendi metninden (görselde `alt`) `textContent` ile yazılır.
- **Mesaj.** Vitrinden panele yeni tür `field { id, field }` (eski türlere alan eklenmedi). Doğrulama Faz 2'deki gibidir, ayrı nonce yoktur: panel mesajı yalnız çerçevenin tam kökeninden ve kendi penceresinden (`event.source`) alır, şemadan geçirir (bölüm kimliği ve alan yolu biçimi, 64 KB). Çerçevenin sandbox'ı değişmedi. Panele iş yaptıran basışlar (`click`, `field`, `navigate-request`) `key` gibi kapıdan geçer: yalnız çerçeve odaktayken (çerçevede basmak odağı ona taşır) ve saniyede en çok 4 tane alınır (`createFrameGate`; güvenlik incelemesi 2026-11-15). İşaretler ve `editor: true` yalnız jetonun biçimiyle değil, arka ucun açtığı geçerli bir oturumla basılır (`isEditorSession`, `layoutSession`'ın istek önbelleğinden, ek çağrı yok); uydurma ya da biten `sfs_` adresinin 404 sayfası işaretsizdir.
- **Panelde.** Bölüm belgede yoksa mesaj atılır. Alan yolu serbest metin olarak kullanılmaz: DOM seçicisine konmaz, ekrana yazılmaz; o bölümün türü için bilinen alan listesine parça parça eşlenir (`forms/preview-fields.ts`, formlar öğe kimliklerini buradan alır). Eşlenirse bölüm açılır, alanın grubu açılır, alan görünür yere kaydırılır (`prefers-reduced-motion`'da anında), odaklanır ve kısa süre işaretlenir; slayt alanında o slaytın düzenleme diyaloğu alanda açılır (görselde kutunun ilk düğmesi odaklanır). Eşlenmezse yalnız bölüm açılır. `aria-live` "Seçildi: …; ilgili alana gidildi" der.
- **Kapsam dışı.** Duyuru şeridinin `data-qs`'i yayında hâlâ yok (E8 özel CSS ile birlikte, görünüm kilidini değiştirdiği için ayrı iş). İşaretlenmeyenler: alt bilgi çubuğu (formunda metin ya da görsel alanı yok, yalnız gösterim seçimleri: profiller, ödeme yolları, yukarı çık düğmesi; 2026-11-15 doğrulandı), üst bilgi yardımcı şerit bağlantıları (menülerden gelir, bölüm formunda değil), sabit "tümünü gör" bağlantıları (yazılar `/blog`, yorumlar `/yorumlar`, katalog açılışının "Tüm kategoriler"i, bağlantılı kategori kartının kendi "Tümünü gör"ü: formda alanları yok), müşteri fotoğrafları ve Google/yorum içerikleri (salt çizim), kayan yazı bağlantısı (metinle aynı alanı kaplar). Sayfa üstünde metin düzenleme (`contenteditable`, `field-input`) §9'daki gibi ayrı ADR'dir.
- **Doğrulanmayan.** Tarayıcıda denenmedi: üretim CSP'sinde öğe çerçevesi ve etiket konumu, kapalı shadow root'ta klavye düğmelerinin sekme sırası, slayt diyaloğunun telefonda açılışı.

## Ek 2026-11-16: Ayar panelinde sekmeler, kapalı gruplar ve arama

Sahip isteği: bölüm paneli "çok karışık ve boğucu"; Elementor'deki gibi İçerik / Stil / Gelişmiş, gruplara ayırma ve alt başlıklar uygulayıcıya bırakıldı.

- **Karar.** Bölüm panelinin gövdesi üç sekme: İçerik (bölümün söylediği ve gösterdiği), Stil (biçim, diziliş, kayma, hareket, zemin ve görünüm), Gelişmiş (boşluk, görünürlük, seyrek ince ayarlar). Sekmenin içinde gruplar başlığına kadar kapalı gelir; yalnız Stil'deki "Biçim" açık gelir (ilk seçilen şey; ürün rafı da artık biçimini bu ayrı grupta gösterir, "Diziliş" kapalı). Sekmede tek grup varsa başlıksız açık durur, tek sekmeli panelde sekme çubuğu çizilmez. Panelin üstünde yalnız o bölümün ayarlarında arayan kutu vardır. Tema ayarları paneli sekmesiz, kapalı gruplar ve kendi aramasıyla.
- **Tek kaynak.** `editor/panel-groups.ts` grup adını sekmesine ve başlığına bağlar; formlar JSX'te kalır, her `PanelGroup` bir ad taşır. Alanın yeri grubunun yeridir (`field-registry.ts`). Listede olmayan ya da adsız grup İçerik'te kendi başlığıyla görünür (güvenli varsayılan); `panel-groups.spec.tsx` her bölüm türünü ve biçimini açıp bunu yakalar. Yeni ayar ekleyen sekmesini ve grubunu bildirir (docs/18 §7.1).
- **İşaretler.** Varsayılandan farklı ayar tutan grubun başlığında sayı, böyle bir grup tutan sekmenin adında küçük nokta. Görünüm, Boşluk, Diğer ayarlar ve katalog üst bilgisinin dört grubu kendi sayısını verir; sayı vermeyen grup, içinde "Varsayılana dön" çizilen ayarları sayar (`group-mark.ts`, `ResetButton`). Varsayılanı olmayan alanlar (yazı, görsel, ürün seçimi) sayılmaz.
- **Arama ve odak.** Arama çizilmiş panelden okunur (ad, terim, yardım metni, seçenek adları; Türkçe ve aksan duyarsız); sonuç "Sekme › Grup" der, seçilince sekme ve grup açılır, alan odaklanır. Editörün bütün bölümlerdeki genel araması ve önizlemedeki "Düzenle" etiketi de aynı yoldan sekmeyi ve grubu açar. Açılan/kapanan gruplar bölüm türü başına bu tarayıcıda hatırlanır; depolama yoksa yine çalışır.
- **Kapsam dışı.** Yayımlanmış biçimler, ayar anlamları ve kayıtlı düzenler değişmez (yalnız panelin düzeni); görünüm kilidi etkilenmez.
