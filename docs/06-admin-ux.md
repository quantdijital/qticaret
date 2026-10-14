# 06 — Admin UX

> Bu aşamada UX odağı **admin paneli**. Storefront UX'i F13'te ayrı dokümanla ele alınır.

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

## Planlanan ekranlar (F8)
| Ekran | Tür | İçerik |
|---|---|---|
| Dashboard özet | Widget (home) | Ciro, bekleyen, kargoya hazır, hatalı ödeme/fatura sayıları |
| Sipariş detay ek bilgi | Widget (order.details) | Ödeme sağlayıcı detayı, kargo takip zaman çizelgesi, fatura durumu, yasal onay kaydı |
| Ürün attribute'ları | Widget (product.details) | Şablona göre dinamik form |
| Entegrasyonlar | Route | Sağlayıcı kartları: durum, bağlantı testi, son hata |
| Operasyon | Route | Kargoya hazır listesi, toplu etiket, filtreler |
| Ayarlar > Özellikler | Route | Feature flag'ler |
| Ayarlar > Yasal metinler | Route | Sürümlü sözleşme editörü |
| Denetim kaydı | Route | Filtrelenebilir audit log |

## Kontrol listesi (her admin PR'ı)
- [ ] Yükleniyor/boş/hata durumları var
- [ ] Tüm metinler i18n anahtarı
- [ ] Rol kontrolü hem UI'da hem API'de
- [ ] Mobil genişlikte bozulmuyor (tablet kullanan depo çalışanı)
- [ ] Playwright smoke testi eklendi
