# 06 — Panel UX

> Yönetici paneli bizim uygulamamızdır: `apps/panel` (adr/0022). Görsel dil, token'lar ve klasör yapısı [docs/18](18-panel-tasarim-sistemi.md)'de; bu belge ilkeleri, sözlüğü ve ekran planını tutar.
> Medusa Admin varsayılan olarak kapalıdır (`admin.disable`, 2026-10-28, adr/0022 §3 eki); panelde ona bağlantı yoktur. Platform ekibi gerektiğinde `MEDUSA_ADMIN=on` ile geçici olarak açar. Storefront UX'i F18'de ayrı dokümanla ele alınır.

## Araçlar
- Yığın ve sürümler: docs/18 §1 (React, Tailwind v4, shadcn/ui, TanStack Router/Query/Table, RHF + Zod, Recharts, i18next)
- Veri: `@medusajs/js-sdk` (session) ile Medusa Admin API ve bizim `/admin/*` uçlarımız; aynı origin (Vite proxy / F16 reverse proxy)
- i18n: `apps/panel/src/locales/tr.json` (varsayılan), `en.json`; API hata metinleri backend'in `lib/errors/messages` kaynağından gelir (adr/0021)
- Test: Vitest + Testing Library, Playwright (e2e), axe

## İlkeler
1. **Operasyon önce.** Admin'i en çok kullanan kişi sipariş hazırlayan çalışan. En sık iş (kargoya hazırla, etiket bas) en az tıkla.
2. **Durum görünürlüğü.** Her siparişte ödeme / kargo / fatura durumu tek bakışta (renkli badge).
3. **Toplu işlem.** Etiket basma, durum güncelleme, fatura yeniden deneme toplu yapılabilir.
4. **Hata eyleme dönüşür.** "Fatura kesilemedi" yerine: neden + "yeniden dene" butonu + ilgili ayara link.
5. **Üç durum zorunlu.** Her ekranda yükleniyor (skeleton), boş durum (yönlendirici metin), hata durumu.
6. **Geri alınamaz işlemlerde onay.** İade, iptal, fatura iptali → onay diyaloğu + özet.
7. **Klavye ve erişilebilirlik.** Odak sırası, ESC ile kapanan diyaloglar, kontrast.
8. **Tutarlı dil.** Terim sözlüğü aşağıda; aynı kavram için tek kelime.
9. **Sektör nötr.** Admin metinlerinde sektör kelimesi yok; attribute şablonları dinamik etiket üretir.

## Detay sayfası düzeni (2026-11-04)
Kullanıcı (2026-11-04): "sipariş detay sayfası çok karmaşık duruyor, iletişim geçmişi büyük bir alan kaplıyor". Bir kaydın sayfası (sipariş, müşteri, ürün ve sonra yazılacaklar) en sık işten seyreğe doğru şu sırayla kurulur:

1. **Başlık** (`PageHeader`): kaydın adı ya da numarası, durum rozeti; açıklama satırında kaydın ana bilgileri tek satırda (sipariş: tarih · müşteri · toplam; ürün: eklenme ve son değişiklik); sağda sıradaki iş tek birincil düğme, gerisi "Diğer işlemler" menüsünde. Her işlem en çok iki tıkta.
2. **Uyarılar**: yalnızca dikkat isteyen bir şey varken (açık ters ibraz, havale bekliyor, etiket hazır, test modu), tam genişlik.
3. **Durum şeridi** (siparişte): adımlar tek satırda, takip numarası altında.
4. **Karar bekleyen kayıt**: iade ya da değişim talebi varsa tam genişlik kart, ana kartların üstünde.
5. **Ana alan** (`PageGrid`, 8 + 4): ana sütunda kaydın kendisi ve en sık iş (sipariş: kalemler — ek seçenek ve hediye satırlarıyla —, ödeme ve fatura tek kartta); yan sütunda kişi ve yer (müşteri ve adres tek kartta) ve kısa notlar. Yan sütunun son kartı (iç notlar) uzar; boşluğu yazılacak not doldurur. Kartları çok farklı boyda olan sayfa sütun yerine yan yana çiftlerle dizilir; satırdaki fark sütundakinden küçük kalır (ürün: genel bilgiler ↔ özet, açıklama ↔ düzen, varyantlar ↔ paket ölçüleri, görseller tam genişlik, arama motoru görünümü ↔ SEO danışmanı — danışman yazılan alanın yanında kalır, sekmeye girmez).
6. **İkincil sekmeler** (`PageTabs`, ana alanın altında): geçmiş, belge ve seyrek iş; her sekme tek kart. Sipariş: iletişim geçmişi, iade ve değişim, para iadeleri, ters ibraz, sözleşme onayı. Müşteri: siparişler, iletişim geçmişi, ileti izinleri, gruplar, KVKK talepleri, mağaza kredisi. Ürün: özellikler, katalog bilgileri, varyant görselleri, ek seçenekler, fiyat geçmişi, içerik taslakları. İlk sekme en çok bakılan; kayıt sayısı sekme adının yanında; açık sekme adreste (`?part=`), sekme değişince sayfa yukarı atlamaz. Gösterecek ve yapacak bir şeyi olmayan sekme çizilmez (ters ibraz, para iadesi yoksa sekmesi yok). Form tutan sekmeler (ürün) `keepMounted`: kaydedilmemiş düzenleme sekme değişince kaybolmaz; SEO danışmanının "Alana git"i alan bir sekmedeyse önce o sekmeyi açar.
7. **Boş durum kart değil satırdır** (`EmptyRow`): bir cümle ve varsa eylemi ("Bu siparişte iade ya da değişim talebi yok." · "İade ya da değişim talebi aç"; "Henüz ileti yok."; siparişi olmayan müşteri). Kart, içinde bir şey olunca çizilir.
8. **Uzun liste kısalır**: zaman çizelgesi (iletişim geçmişi) en yeni 3 kaydı gösterir, gerisi "Tümünü göster (n)"; tamamlanmış uzun alt liste katlanır, eksik varken açık gelir (ürün görsellerinin alt metinleri).
9. **Az alanlı bilgiler tek kartta**: müşterinin iletişim, kayıtlı adres ve fatura bilgisi tek kartın üç bölümü (geniş ekranda yan yana, telefonda alt alta).

Yeni detay sayfası bu sırayı izler; `e2e/layout.e2e.ts`, `shell.e2e.ts` ve `phone.e2e.ts` listelerin ilk kaydını açıp ölçer.

## Terim sözlüğü (tr)
| Kavram | Kullan | Kullanma |
|---|---|---|
| Order | Sipariş | Order, talep |
| Fulfillment | Gönderi | Fulfillment, teslimat paketi, gönderim |
| Parcel | Koli (fiziksel paket; etiket koliye basılır) | Paket, kargo paketi |
| Refund | İade (para), "para iadesi" | Geri ödeme |
| Return | İade (ürün) | Geri gönderim |
| Return request | İade talebi (değişim de bunun bir türü) | İade isteği |
| Chargeback | Ters ibraz | Chargeback, itiraz |
| Payment provider | Ödeme sağlayıcı | POS firması |
| Invoice | Fatura | e-belge |
| Staff | Ekip, ekip üyesi | Personel, kullanıcı |
| Audit log | Denetim kaydı | Log, işlem geçmişi |
| Webhook | Webhook | Web kancası |
| Product feed | Ürün feed'i | Ürün akışı |
| Message (e-posta/SMS) | İleti; gönderilmesi "gönderim" | Mesaj, bildirim (bildirim zildeki ekip uyarısıdır) |

"Gönderim" yalnızca bir iletinin ya da verinin gönderilmesi için kullanılır; ürünün yola çıkışı "gönderi"dir.

## Yapılan ekranlar (2026-10-25)
Dashboard, Siparişler (aşama sekmeleri + detay: kargoya ver, teslim edildi, tahsil et, iptal), Müşteriler (liste + detay, maskeli fatura bilgisi), Ürünler (liste, 5 adımlı sihirbaz, kart kart kaydeden detay, özellikler), Kategoriler (ağaç + düzenleyici), Stok (azalan/tükenen, satır içi raf adedi), Kampanyalar (yüzde/tutar/ücretsiz kargo, kod/otomatik, tarih, sınır), Raporlar (KPI, ürün performansı, gün gün satış, CSV), SEO (arama önizlemesi, katalog sağlığı), Ayarlar (Mağaza, Görünüm, SEO, Ürün özellikleri, Özellikler, İşler, Denetim kaydı). Komut menüsünde sık işler. Telefonda listeler sütun katlayarak sığar.

## Planlanan ekranlar (panel hattı P1–P6 ve ilgili fazlar)
| Ekran | Desen (docs/18 §7) | İçerik |
|---|---|---|
| Dashboard | StatCard + grafik + kurulum ilerlemesi (P1) | Dönem sayıları, satış eğrisi; bekleyen işler süzgeçli listelere açılır (aktarılamayan muhasebe kaydı ve durdurulan web kancası yalnızca kullanılıyorsa ve rol düzeltebiliyorsa, F12.1); son siparişler, çok satanlar ve mağaza SEO puanı; sıradaki kurulum adımı (yalnızca ayar yetkisi olanlara; okunamazsa tekrar dene); fatura sayısı F8'de |
| Sipariş listesi | DataTable + sekmeler (F7.7, F12.3) | Aşama sekmeleri; arama yanında ödeme (ödendi / bekliyor / iade edildi) ve kargo (gönderilmedi / etiket hazır / yolda / teslim edildi / sorunlu) süzgeçleri, adreste; sekme sayıları süzülmüş kümeyi sayar. Her aşamada seçim; toplu çubuk seçilenlerden uygun olanları sayar: etiketleri yazdır, "Teslim edildi" (yalnızca mağazanın kendi teslimatı; kargo firmasının kolisi takiple teslim olur), "Kargoya ver" |
| Global arama | Komut menüsü (⌘K, F12.9) | Yazılanla siparişler (önce tam numara; e-posta, adres), kargo takip no, müşteriler (ad, e-posta, telefon), ürünler (ad, SKU); her birinden en çok 5, sayfa ve işlemlerin üstünde. En az 2 karakter, yazma durunca sorulur; pencere üstte sabit. Her arama kayıtlı okuma (müşteri adı döner) |
| Sipariş detay | Detay sayfası düzeni (P4, F7) | Başlıkta numara, aşama, tarih · müşteri · toplam ve sıradaki iş; adım şeridi ve takip numarası; iade ya da değişim talebi varsa tam genişlik kart. Solda kalemler (ek seçenek ve hediye satırlarıyla), ödeme ve fatura tek kartta; sağda müşteri ve teslimat adresi (paketlenene kadar düzenlenir), iç notlar (yazan ve zaman; operasyon da yazar, salt okunur yalnızca görür; notu yazan ya da sahip siler). Altta sekmeler: iletişim geçmişi (siparişin, kolilerinin ve iade taleplerinin iletileri, maskeli adresle; gönderilmeyenler nedeniyle, F12.8; en yeni 3, "Tümünü göster"), iade ve değişim (talep yoksa tek satır ve "İade ya da değişim talebi aç"), para iadeleri, ters ibraz (varsa), sözleşme onayı (yasal onay kaydı) |
| Müşteri detay | Detay sayfası düzeni (F12) | Üstte iletişim, kayıtlı adresler ve fatura bilgisi (maskeli) tek kartta; altında sekmeler: siparişler, iletişim geçmişi (müşteriye giden her ileti, gönderilmeyenler nedeniyle), ileti izinleri, gruplar, KVKK talepleri, mağaza kredisi (yalnızca üyeye) |
| Ürün sihirbazı ve düzenleme | Wizard + FormSection (P3, F3) | Temel bilgi → görseller → fiyat ve stok → özellikler (şablon) → katalog ve SEO → yayınla; düzenlemede aynı bölümler; düzenleme sayfası Detay sayfası düzeninde: ana kartlar çiftler halinde, ikincil bölümler sekmelerde |
| Entegrasyonlar | Sayfa | Gruplu kartlar (ödeme, kargo, iletişim, Google ve pazarlama, muhasebe, altyapı); her satırda durum ve nedeni, canlı yanıt, bağlantı testi, ayar sayfasına bağlantı ve son hatalar (kodlarıyla, açılır liste). Yalnızca sahip ve yönetici (F12.2, adr/0002 ek) |
| Operasyon | Sayfa | Kargoya hazır listesi, toplu etiket, filtreler |
| Ayarlar > Görünüm | Sayfa (P1) | Marka rengi, logo, köşe, yoğunluk, mod; canlı önizleme (docs/18 §5) |
| Kurulum sihirbazı | Wizard (P2) | Mağaza bilgileri → ilk ürün → kargo → ödeme → yayına al; atlanabilir, ilerleme kalıcı |
| Ayarlar > Özellikler | Sayfa | Feature flag'ler |
| Ayarlar > Yasal metinler | Sayfa | Sürümlü sözleşme editörü |
| Ayarlar > Mağaza künyesi | Sayfa | Unvan, MERSİS, VKN, KEP, ETBİS; eksik alan uyarısı (F13) |
| Ayarlar > Fatura ve muhasebe > KDV oranları (`?part=vat`; 2026-11-04, adr/0007 Ek) | Sekme: kart içinde tablo | Ad (varsayılan ve kaldırılmış rozeti), oran, bağlı ürün sayısı (varsayılanın: oran seçilmemiş ürünler). Bir cümle: fiyatlar KDV dahil girilir, oran ürün başına seçilir. "Oran ekle" (küçük diyalog: `NumberField` % ekli, 2 ondalık; ad "KDV %X" olarak dolar, elle yazılınca yüzdeyi izlemez); satır menüsü: yeniden adlandır, varsayılan yap (onayla; ne değiştiğini söyler), kaldır (varsayılan ya da ürünü olan oranda kapalı, neden menüde yazar; diğerinde onayla), kaldırılmışı geri al. Yalnızca sahip yazar (`vatRates`); diğer roller tabloyu eylemsiz görür. Ürün formundaki KDV seçimi bu oranları "Varsayılan (KDV %20)" ile listeler |
| Ayarlar > Kargo ve teslimat > Adres verisi (`?part=addresses`; 2026-11-04, adr/0008 Ek) | Sekme: tek kart | İl, ilçe, mahalle ve köy sayıları (üç eşit kutu); kaynak (TürkiyeAPI, veri seti sürümü ve tarihi, ya da elle yüklenen dosya), son güncelleme. Veri yoksa uyarı: müşteri ödeme sayfasında il seçemez. "Şimdi güncelle" yalnız sahipte (`trAddressSync`); iş sürerken ilerleme çubuğu (indiriliyor / kaydediliyor), bitince "X eklendi, Y değişti, Z kaldırıldı" ya da "veriler güncel", hata olursa nedeni. Diğer roller düğme yerine kimin güncelleyebileceğini görür. Altta kaynak cümlesi (TürkiyeAPI, TÜİK ve PTT kaynaklı açık veri, MIT) |
| Denetim kaydı | Sayfa | Tür sekmeleri; kişi, kaynak (gruplu) ve tarih süzgeçleri adreste; satır yan panelde açılır (sonuç, istek kimliği, IP, tarayıcı, alan alan değişiklik); dışa aktarım aynı süzgeçlerle (F12.5) |
| İçe/dışa aktarma | Sayfa | Şablon indir, dosya yükle, ilerleme, satır bazlı hata raporu (F3) |
| Toplu düzenleme | Ürün listesi (seçim çubuğu + pencere) | Fiyat, stok, yayın durumu, kategori, SEO şablonu, eksik alt metin; iş olarak koşar, rapor indirilir (F3.10) |
| Yönlendirmeler | Sayfa | 301/302 listesi, toplu yükleme (F3) |
| Stok | DataTable (P3, F3) | Depo bazlı stok, düşük stok listesi, hareket geçmişi |
| Fiyat geçmişi | Ürün sayfası bölümü (F4) | Varyant fiyat grafiği, son 30 gün en düşük |
| SEO ve paylaşım | Ürün/kategori/marka sayfasında yan panel (F3) | Skor, bulgular + "neden önemli", tek tık düzeltmeler, SERP/WhatsApp/Instagram önizleme, UTM'li paylaşım bağlantısı |
| SEO paneli | Sayfa | Başta kurulum kontrol listesi (yalnızca eksikler; tamamlanan kalkar, hepsi bitince kart gider; F12.10); mağaza skoru, en düşük varlıklar, 404 + 301 oluştur, zincir/mükerrer/öksüz, GSC/CWV kartları, denetim raporu (F3, F10, F12) |
| Markalar | Sayfa | Marka listesi/detay, SEO alanları (F3) |
| İçerik | Sayfa | Sayfalar, blog, facet landing (özgünlük göstergesi, parti yayını) (F3) |
| Ortam kütüphanesi (`/media`, Vitrin grubu; 2026-11-04) | Küçük resim ızgarası + yan panel | Mağazanın yüklediği ya da adresten aldığı bütün görseller, en yenisi önce; dosya adı/alt metinle arama, sayfalama. "Görsel yükle": sürükle-bırak ya da dosya seçimi, çoklu, dosya dosya durum ve ilerleme çubuğu (JPG, PNG, WebP, AVIF; ≤ 10 MB; SVG ve GIF reddedilir). Bir görsel yan panelde açılır: önizleme, dosya adı (yalnızca görünen ad; adres değişmez) ve alt metin, yükleyen ve tarih, adresi kopyala, kullanıldığı yerler (ürün, ürün açıklaması, marka logosu, sayfa/yazı, açılış sayfası, toplu ileti, vitrin tasarımı, mağaza logosu, paylaşım görseli, sayfanın kendi paylaşım görseli, geçmiş siparişler; açılabilenler bağlantılı). Kullanılan görsel silinmez (409 `media.in_use`); kullanılmayan onayla dosyalarıyla silinir. Yükleme/silme/yeniden adlandırma sahip ve yönetici (`catalog` yetkisi). Vitrin grubunda: görselleri en çok vitrin, sayfalar ve logolar kullanır. Görsel alanlarının hepsi (`MediaField` → `MediaPicker`: Kütüphane / Bilgisayardan yükle / Adres) buradan seçer; ürün galerisi kendi sürükle-bırakını korur, yanında "Kütüphaneden seç" |
| Soru-Cevap moderasyonu | Sayfa | Bekleyen sorular/cevaplar, toplu onay (F10) |
| Değişim ve sipariş düzenleme | Sayfa (F7) | Değişim talepleri, fark tutarı, sipariş düzenleme geçmişi |
| Ters ibraz | Sayfa | Açık ibrazlar, belge paketi indir, durum (F6) |
| Promosyonlar | Sayfa | Kupon/kampanya oluşturma, kullanım istatistiği, toplu kod üretimi (F4) |
| Havale onayları | Sayfa | Ödeme bekleyen siparişler, onay/iptal, kalan süre (F6) |
| İade talepleri | Sayfa | Talep listesi, onay/ret, depoya varış kontrolü (F7) |
| Yorum moderasyonu | Sayfa | Onay bekleyen yorumlar, toplu onay/ret (F10) |
| Raporlar | Sayfa | Satış, finans/KDV, stok raporları, dışa aktarma (F11) |
| Muhasebe aktarımı | Sayfa | Aktarım durumu, hatalılar, yeniden dene (F11) |
| API ve webhook'lar | Sayfa | API anahtarları, webhook abonelikleri, teslim logu (F11) |
| Şüpheli siparişler | Sayfa | Dolandırıcılık inceleme kuyruğu (F15) |
| Geçiş | Sayfa | Kaynak seçimi, dry-run raporu, çalıştırma durumu (F14) |

## SEO ve içerik girişi deneyimi (ilke)
- Ürün formunda SEO sekmesi değil, **yan panel**: kullanıcı yazarken skor ve bulgular canlı güncellenir; "düzelt" tek tık.
- Boş SEO alanları gri "şablondan üretilecek" önizlemesiyle gösterilir; kullanıcı isterse ezer.
- Yayın düğmesi eşik altında uyarı metni gösterir ("3 kritik bulgu var"); tenant isterse yayın kapısını zorunlu yapar.
- Toplu içe aktarmada dosya seçilir seçilmez ön değerlendirme özeti ("%40 üründe görsel yok").
- Her bulguda "neden önemli" kısa, Türkçe, sektör nötr; terim sözlüğüne uyar.

## Kontrol listesi (her panel PR'ı)
- [ ] docs/18 §9 listesi: yalnızca token, kara liste yok, tek birincil eylem, üç durum, sözlük, klavye/axe, mobil, açık/koyu
- [ ] Rol kontrolü hem UI'da hem API'de: API `lib/staff/permissions.ts` (yeni yazma ucu birim testindeki listeye eklenir), UI `useCan`/`needs` (adr/0040)
- [ ] Playwright duman testi eklendi: yeni ekran `apps/panel/e2e/smoke.e2e.ts` listesinde; çok kullanılan ekransa axe listesinde (docs/07 E2E)
