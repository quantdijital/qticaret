# 06 — Admin UX

> Bu aşamada UX odağı **admin paneli**. Storefront UX'i F18'de ayrı dokümanla ele alınır.

## Araçlar
- Medusa Admin SDK: widget'lar (`defineWidgetConfig`) ve özel sayfalar (`defineRouteConfig`)
- `@medusajs/ui` bileşenleri — admin'in görsel dilini bozmamak için **sadece** bu kütüphane (+ ikonlar)
- Veri: TanStack Query (Medusa JS SDK ile), formlar: React Hook Form + Zod
- i18n: `src/admin/i18n/tr.json` (varsayılan), `en.json`
- Test: Playwright (Playwright MCP ile Claude da gezer), axe ile erişilebilirlik

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

## Planlanan ekranlar (F12 ve ilgili fazlar)
| Ekran | Tür | İçerik |
|---|---|---|
| Dashboard özet (Başlangıç) | Route `/home` (Medusa'da `home` widget bölgesi yok; docs/17) | Kurulum kontrol listesi ve hızlı işlemler (var); ciro, bekleyen, kargoya hazır, hatalı ödeme/fatura sayıları (özet ucu ile) |
| Sipariş detay ek bilgi | Widget (order.details) | Ödeme sağlayıcı detayı, kargo takip zaman çizelgesi, fatura durumu, yasal onay kaydı |
| Ürün attribute'ları | Widget (product.details) | Şablona göre dinamik form |
| Entegrasyonlar | Route | Sağlayıcı kartları: durum, bağlantı testi, son hata |
| Operasyon | Route | Kargoya hazır listesi, toplu etiket, filtreler |
| Ayarlar > Özellikler | Route | Feature flag'ler |
| Ayarlar > Yasal metinler | Route | Sürümlü sözleşme editörü |
| Ayarlar > Mağaza künyesi | Route | Unvan, MERSİS, VKN, KEP, ETBİS; eksik alan uyarısı (F13) |
| Denetim kaydı | Route | Filtrelenebilir audit log |
| İçe/dışa aktarma | Route | Şablon indir, dosya yükle, ilerleme, satır bazlı hata raporu (F3) |
| Toplu düzenleme | Route | Fiyat/stok/durum toplu güncelleme (F3) |
| Yönlendirmeler | Route | 301/302 listesi, toplu yükleme (F3) |
| Stok | Widget + Route | Depo bazlı stok, düşük stok listesi, hareket geçmişi (F3) |
| Fiyat geçmişi | Widget (product.details) | Varyant fiyat grafiği, son 30 gün en düşük (F4) |
| SEO ve paylaşım | Widget (product/category/brand.details) | Skor halkası, bulgular + "neden önemli", tek tık düzeltmeler, SERP/WhatsApp/Instagram önizleme, UTM'li paylaşım bağlantısı (F3) |
| SEO paneli | Route | Mağaza skoru, en düşük varlıklar, 404 + 301 oluştur, zincir/mükerrer/öksüz, GSC/CWV kartları, denetim raporu, kurulum kontrol listesi (F3, F10, F12) |
| Markalar | Route | Marka listesi/detay, SEO alanları (F3) |
| İçerik | Route | Sayfalar, blog, facet landing (özgünlük göstergesi, parti yayını) (F3) |
| Soru-Cevap moderasyonu | Route | Bekleyen sorular/cevaplar, toplu onay (F10) |
| Değişim ve sipariş düzenleme | Widget + Route | Değişim talepleri, fark tutarı, sipariş düzenleme geçmişi (F7) |
| Ters ibraz | Route | Açık ibrazlar, belge paketi indir, durum (F6) |
| Promosyonlar | Route | Kupon/kampanya oluşturma, kullanım istatistiği, toplu kod üretimi (F4) |
| Havale onayları | Route | Ödeme bekleyen siparişler, onay/iptal, kalan süre (F6) |
| İade talepleri | Route | Talep listesi, onay/ret, depoya varış kontrolü (F7) |
| Yorum moderasyonu | Route | Onay bekleyen yorumlar, toplu onay/ret (F10) |
| Raporlar | Route | Satış, finans/KDV, stok raporları, dışa aktarma (F11) |
| Muhasebe aktarımı | Route | Aktarım durumu, hatalılar, yeniden dene (F11) |
| API ve webhook'lar | Route | API anahtarları, webhook abonelikleri, teslim logu (F11) |
| Şüpheli siparişler | Route | Dolandırıcılık inceleme kuyruğu (F15) |
| Geçiş | Route | Kaynak seçimi, dry-run raporu, çalıştırma durumu (F14) |

## SEO ve içerik girişi deneyimi (ilke)
- Ürün formunda SEO sekmesi değil, **yan panel**: kullanıcı yazarken skor ve bulgular canlı güncellenir; "düzelt" tek tık.
- Boş SEO alanları gri "şablondan üretilecek" önizlemesiyle gösterilir; kullanıcı isterse ezer.
- Yayın düğmesi eşik altında uyarı metni gösterir ("3 kritik bulgu var"); tenant isterse yayın kapısını zorunlu yapar.
- Toplu içe aktarmada dosya seçilir seçilmez ön değerlendirme özeti ("%40 üründe görsel yok").
- Her bulguda "neden önemli" kısa, Türkçe, sektör nötr; terim sözlüğüne uyar.

## Kontrol listesi (her admin PR'ı)
- [ ] Yükleniyor/boş/hata durumları var
- [ ] Tüm metinler i18n anahtarı
- [ ] Rol kontrolü hem UI'da hem API'de
- [ ] Mobil genişlikte bozulmuyor (tablet kullanan depo çalışanı)
- [ ] Playwright smoke testi eklendi
