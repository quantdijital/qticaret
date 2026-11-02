# ADR-0047: Vitrin iletişim formu

- **Durum:** Kabul edildi (2026-11-02, otonom; kullanıcı "bana soru sorma, işlevsel yapıların hepsini kur" dedi; gözden geçir)
- **Tarih:** 2026-11-02
- **İlgili:** F18 D10; adr/0041 §6 (KVKK talepleri); adr/0044 (iş kanıtı); adr/0036 (personel bildirimleri); docs/kvkk-envanter

## Bağlam

Vitrinin `/iletisim` sayfası yalnızca WhatsApp, telefon ve e-posta bağlantısı gösteriyordu (docs/19). Form için iki karar bekliyordu:
- Yazılan kişisel veri nerede, ne kadar tutulur?
- Personel mesajın geldiğini nereden öğrenir?

## Karar

1. **Mesaj backend'de saklanır, panelden yanıtlanır** (yeni `contact-messages` modülü). Yalnız e-postayla iletmek, gönderim ayarlanmamış mağazada mesajı kaybettirirdi. Personelin posta kutusunda da kontrolsüz kopyalar bırakırdı.
2. **Yazılan her şey mühürlü durur.** Ad, e-posta, telefon ve mesaj tek şifreli alanda (`sealed`, `PII_ENCRYPTION_KEY`) tutulur. E-posta ayrıca anahtarlı özetle tutulur (`email_hash`). Bu özet, KVKK talebinde kişinin misafir mesajlarını bulmak içindir. Açık metin olarak yalnızca konu ve sipariş numarası durur.
3. **Konu sabit bir listeden seçilir:** sipariş, ürün, iade ve değişim, ödeme, diğer. Telefon isteğe bağlıdır ve Türk numarası olmalıdır. Mesaj 10–3000 karakterdir. Giriş yapmış müşterinin mesajı hesabına bağlanır.
4. **Kötüye kullanıma karşı:**
   - Hız sınırı adres başına saatte 10, gönderen e-postası başına saatte 5'tir.
   - Aynı adresten saatteki ilk mesajdan sonrası için iş kanıtı istenir (`contact` kapsamı).
   - E-posta alan adının posta kabul etmesi gerekir.
   - Yanıt yalnızca "alındı" der.
5. **Personel bildirimi:** panel ziline düşer (`contact_message`). Personel listesi varsa e-posta da gider (`staff.contact_message`). Bu e-posta Ayarlar > Bildirimler'den kapatılabilir ve varsayılanı açıktır.
   - Zilde ve e-postada **yalnızca konu** bulunur. Gönderenin adı ve mesaj panelde okunur.
     - Ad zil kaydında kalsaydı mesajın silinmesinden, saklama süresinden ve KVKK silmesinden sonra da yaşardı.
     - Gönderenin yazdığı metin mağazanın kendi adresinden giden e-postada oltalamaya alet olabilirdi.
   - E-posta mağaza genelinde en çok **10 dakikada bir** gider. Bu sınır olmasaydı birçok adresten gelen mesaj seli siparişlerin de kullandığı günlük e-posta bütçesini bitirebilirdi.
   - Bu iki karar üçüncü güvenlik incelemesinden (2026-11-02) geldi.
6. **Panel:** Müşteriler > İletişim mesajları.
   - Bekleyenler eskiden yeniye, yanıtlananlar yeniden eskiye sıralanır.
   - "Yanıtlandı" işaretini `operations` rolü de koyabilir. Silme yetkisi yöneticidedir.
   - Liste okuması kişisel veri okuması olarak denetim kaydına geçer.
7. **Saklama ve KVKK:**
   - Mesaj geldiği günden 365 gün sonra silinir (gece işi `contact_messages`; süre öneridir, danışman onayı bekler).
   - Personelin sildiği mesaj gizlenmez, kalıcı silinir.
   - KVKK veri kopyasında (`iletişim_mesajları`) ve silmede, kişinin hesabıyla ve e-posta özetiyle bulunan mesajlar yer alır.

## Sonuçlar

- **Backend:**
  - `modules/contact-messages`
  - `workflows/contact/{messages,customer-data}.ts`
  - `POST /store/contact-messages`
  - `GET /admin/contact-messages`
  - `POST`/`DELETE /admin/contact-messages/:id`
  - `subscribers/contact-message-alerts.ts`
  - `api/http/contact-routes.ts`
- **Testler:** HTTP `contact-messages.spec.ts` (5 senaryo). İlgili takımlar yeşil: yetki, şablon sayısı, saklama, KVKK.
- **Vitrin:** `/iletisim` sayfası içerik sayfasıysa formu da gösterir.
- **Açık:** Personelin yanıtı panelden e-postayla gönderilmiyor; personel kendi posta programından yanıtlıyor. Panelden yanıt ileride eklenebilir (şablon, gönderim kaydı, KVKK etkisi).

## Ek (2026-11-02): misafirin KVKK başvurusu

- **Sorun:** Giriş yapmış müşteri veri kopyası ve silme talebini hesabından açıyor (adr/0041 §6, kanal `account`). Hesabı olmayan kişinin (misafir alıcı, yalnızca bülten ya da stok bildirimi bırakan) vitrinde bir yolu yoktu.
- **Karar:** İletişim formuna `kvkk` konusu ("KVKK başvurusu") eklendi (`CONTACT_SUBJECTS`, vitrin `contact.subjects.kvkk`). Yeni uç ya da tablo yok; mesaj öteki mesajlar gibi mühürlü saklanır, aynı hız sınırı, iş kanıtı ve alan adı denetiminden geçer. Migration: `Migration20261102201858` (konu kısıtına `kvkk`).
- **Yasal süre:** Başvuru geldiği andan 30 gün içinde yanıtlanır (KVKK md. 13). Süre personelin kaydettiği taleplerle aynı hesaplanır: `lib/legal/answer-due.ts` (`privacyAnswerDue`, iki `privacy-requests` ucu da bunu kullanır). Son gün mağazanın saat dilimiyle yazılır.
  - Zil kaydı başlığı "Yeni KVKK başvurusu", açıklaması son günü söyler (`contact.kvkk_received`); verisinde `due_at` (ISO) durur, panel kendi dilinde bundan yazar.
  - Personel e-postası (`staff.contact_message`) konu `kvkk` ise son günü ve kimlik doğrulama hatırlatmasını ekler (`staff_contact.kvkk_due`, ön metin `staff_contact.kvkk_preheader`).
  - Personel e-postasının 10 dakikalık sınırı KVKK başvurusu için ayrı sayılır (`contact:staff-mail:kvkk`): öteki mesajların seli yasal süreli bir başvurunun e-postasını geciktirmez. Sınır yine 10 dakikada birdir.
- **Panel (ayrı iş):** Konu etiketi `kvkk` panelin çevirilerine eklenmeli; zildeki `due_at` gösterilebilir. Personel başvuruyu bir müşteri hesabına bağlayabiliyorsa talebi Müşteriler > KVKK talepleri'ne (kanal `email`/`other`) de kaydeder; misafirse yanıt e-postayla verilir.
- **Testler:** HTTP `contact-messages.spec.ts` (KVKK başvurusu: zil `due_at`, e-postada son gün, öteki mesajın e-posta sınırından bağımsız), birim `answer-due`, şablon testi.
- **Açık:** Misafir başvurusunun kimlik doğrulaması (e-posta sahipliği) elle yapılır; otomatik doğrulama ve misafir verisinin dışa aktarımı ileride (kvkk-envanter).
