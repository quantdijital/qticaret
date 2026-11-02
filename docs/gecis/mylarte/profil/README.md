# mylarte mağaza profili

Geliştirme mağazasını mylarte'nin yapısıyla kurar: mağaza adı ve iletişim, yasal kimlik, ücretsiz kargo eşiği, ana sayfa SEO'su ve girişi, duyuru şeridi, üst bağlantılar, menü, alt bilgi sütunları, güven rozetleri, WhatsApp, marka rengi (`#076599`), 4 içerik sayfası (`../sayfalar/`: hakkımızda, iletişim, SSS, toptan) ve taşıma paketi (`paket.json`: 48 kategori, 13 marka, eski adresleriyle).

```sh
pnpm --filter @qticaret/backend shop:profile ../../docs/gecis/mylarte/profil hide-demo
```

- Tekrar çalıştırılabilir: ayarlar ve sayfalar güncellenir, taşıma kaynak anahtarıyla aynı kayıtları bulur, çoğaltmaz.
- **Yasal metinler içerik sayfası değildir:** sözleşmeler, KVKK, çerez, iade ve kargo politikaları Ayarlar > Yasal'da firma bilgilerinden üretilir ve `/yasal/...` adreslerinde yayınlanır; alt bilgideki yasal bağlantılar oradan gelir. Profilin eskiden açtığı 8 yasal sayfa `retired_pages` ile (varsa) silinir; eski site metinleri yalnız başvuru için `../eski-yasal-metinler/`.
- `hide-demo`: demo tohumunun kategorileri vitrinden kalkar (kayıtlar durur; demo ürünler ve ödeme deneme sayfası onları kullanır).
- Eski mylarte adreslerinden 301'ler taşımanın kesim adımında uygulanır (`docs/runbooks/gecis.md`), şimdi değil.
- Ürünleri mağaza sahibi ekler. Menüdeki ve alt bilgideki kategori adresleri taşımanın ürettiği adreslerdir (`/kategori/{üst}/{alt}`); adres stili kararı `../esleme.md` §3.
- Henüz vitrinde olmayan sayfalara bağlantı verilmedi: Yorumlar, Hesabım, Tüm Ürünler (`/magaza`).
