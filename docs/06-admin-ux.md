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

## Terim sözlüğü (tr)
| Kavram | Kullan | Kullanma |
|---|---|---|
| Order | Sipariş | Order, talep |
| Fulfillment | Gönderi | Fulfillment, teslimat paketi |
| Refund | İade (para) | Geri ödeme |
| Return | İade (ürün) | Geri gönderim |
| Payment provider | Ödeme sağlayıcı | POS firması |
| Invoice | Fatura | e-belge |

## Yapılan ekranlar (2026-10-25)
Dashboard, Siparişler (aşama sekmeleri + detay: kargoya ver, teslim edildi, tahsil et, iptal), Müşteriler (liste + detay, maskeli fatura bilgisi), Ürünler (liste, 5 adımlı sihirbaz, kart kart kaydeden detay, özellikler), Kategoriler (ağaç + düzenleyici), Stok (azalan/tükenen, satır içi raf adedi), Kampanyalar (yüzde/tutar/ücretsiz kargo, kod/otomatik, tarih, sınır), Raporlar (KPI, ürün performansı, gün gün satış, CSV), SEO (arama önizlemesi, katalog sağlığı), Ayarlar (Mağaza, Görünüm, SEO, Ürün özellikleri, Özellikler, İşler, Denetim kaydı). Komut menüsünde sık işler. Telefonda listeler sütun katlayarak sığar.

## Planlanan ekranlar (panel hattı P1–P6 ve ilgili fazlar)
| Ekran | Desen (docs/18 §7) | İçerik |
|---|---|---|
| Dashboard | StatCard + grafik + kurulum ilerlemesi (P1) | Dönem sayıları, satış eğrisi; bekleyen işler süzgeçli listelere açılır (aktarılamayan muhasebe kaydı ve durdurulan web kancası yalnızca kullanılıyorsa ve rol düzeltebiliyorsa, F12.1); son siparişler, çok satanlar ve mağaza SEO puanı; sıradaki kurulum adımı (yalnızca ayar yetkisi olanlara; okunamazsa tekrar dene); fatura sayısı F8'de |
| Sipariş listesi | DataTable + sekmeler (F7.7, F12.3) | Aşama sekmeleri; arama yanında ödeme (ödendi / bekliyor / iade edildi) ve kargo (gönderilmedi / etiket hazır / yolda / teslim edildi / sorunlu) süzgeçleri, adreste; sekme sayıları süzülmüş kümeyi sayar. Her aşamada seçim; toplu çubuk seçilenlerden uygun olanları sayar: etiketleri yazdır, "Teslim edildi" (yalnızca mağazanın kendi teslimatı; kargo firmasının kolisi takiple teslim olur), "Kargoya ver" |
| Global arama | Komut menüsü (⌘K, F12.9) | Yazılanla siparişler (önce tam numara; e-posta, adres), kargo takip no, müşteriler (ad, e-posta, telefon), ürünler (ad, SKU); her birinden en çok 5, sayfa ve işlemlerin üstünde. En az 2 karakter, yazma durunca sorulur; pencere üstte sabit. Her arama kayıtlı okuma (müşteri adı döner) |
| Sipariş detay | Sayfa (P4, F7) | Kalemler, ödeme/kargo/fatura durumu tek bakışta, kargo takip zaman çizelgesi, yasal onay kaydı. İç notlar sağ sütunun sonunda: yazan ve zaman; operasyon da yazar, salt okunur yalnızca görür; notu yazan ya da sahip siler. İletişim geçmişi sol sütunun sonunda: siparişin, kolilerinin ve iade taleplerinin iletileri, maskeli adresle; gönderilmeyenler nedeniyle (F12.8) |
| Müşteri detay | Sayfa (F12) | Siparişler ve iletişim geçmişi (müşteriye giden her ileti, gönderilmeyenler nedeniyle) solda; iletişim, ileti izinleri, gruplar, adresler, fatura bilgisi sağda |
| Ürün sihirbazı ve düzenleme | Wizard + FormSection (P3, F3) | Temel bilgi → görseller → fiyat ve stok → özellikler (şablon) → katalog ve SEO → yayınla; düzenlemede aynı bölümler |
| Entegrasyonlar | Sayfa | Gruplu kartlar (ödeme, kargo, iletişim, Google ve pazarlama, muhasebe, altyapı); her satırda durum ve nedeni, canlı yanıt, bağlantı testi, ayar sayfasına bağlantı ve son hatalar (kodlarıyla, açılır liste). Yalnızca sahip ve yönetici (F12.2, adr/0002 ek) |
| Operasyon | Sayfa | Kargoya hazır listesi, toplu etiket, filtreler |
| Ayarlar > Görünüm | Sayfa (P1) | Marka rengi, logo, köşe, yoğunluk, mod; canlı önizleme (docs/18 §5) |
| Kurulum sihirbazı | Wizard (P2) | Mağaza bilgileri → ilk ürün → kargo → ödeme → yayına al; atlanabilir, ilerleme kalıcı |
| Ayarlar > Özellikler | Sayfa | Feature flag'ler |
| Ayarlar > Yasal metinler | Sayfa | Sürümlü sözleşme editörü |
| Ayarlar > Mağaza künyesi | Sayfa | Unvan, MERSİS, VKN, KEP, ETBİS; eksik alan uyarısı (F13) |
| Denetim kaydı | Sayfa | Tür sekmeleri; kişi, kaynak (gruplu) ve tarih süzgeçleri adreste; satır yan panelde açılır (sonuç, istek kimliği, IP, tarayıcı, alan alan değişiklik); dışa aktarım aynı süzgeçlerle (F12.5) |
| İçe/dışa aktarma | Sayfa | Şablon indir, dosya yükle, ilerleme, satır bazlı hata raporu (F3) |
| Toplu düzenleme | Ürün listesi (seçim çubuğu + pencere) | Fiyat, stok, yayın durumu, kategori, SEO şablonu, eksik alt metin; iş olarak koşar, rapor indirilir (F3.10) |
| Yönlendirmeler | Sayfa | 301/302 listesi, toplu yükleme (F3) |
| Stok | DataTable (P3, F3) | Depo bazlı stok, düşük stok listesi, hareket geçmişi |
| Fiyat geçmişi | Ürün sayfası bölümü (F4) | Varyant fiyat grafiği, son 30 gün en düşük |
| SEO ve paylaşım | Ürün/kategori/marka sayfasında yan panel (F3) | Skor, bulgular + "neden önemli", tek tık düzeltmeler, SERP/WhatsApp/Instagram önizleme, UTM'li paylaşım bağlantısı |
| SEO paneli | Sayfa | Mağaza skoru, en düşük varlıklar, 404 + 301 oluştur, zincir/mükerrer/öksüz, GSC/CWV kartları, denetim raporu, kurulum kontrol listesi (F3, F10, F12) |
| Markalar | Sayfa | Marka listesi/detay, SEO alanları (F3) |
| İçerik | Sayfa | Sayfalar, blog, facet landing (özgünlük göstergesi, parti yayını) (F3) |
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
