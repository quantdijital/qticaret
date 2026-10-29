import type { SheetCell } from "../../../lib/sheets"

/**
 * The template's and the export's second sheet (F3.9): what each column
 * takes. The words are the server's Turkish, as the headers are.
 */
export const HELP_ROWS: readonly SheetCell[][] = [
  ["Sütun", "Ne yazılır"],
  [
    "Tanıtıcı",
    "Ürünün adresi (ör. seramik-kupa). Varsa ürün güncellenir, yoksa eklenir. Boş bırakılırsa ürün adından üretilir. Varyantlı ürünün her satırında aynı tanıtıcı olur.",
  ],
  ["Ürün adı", "Yeni ürün için zorunlu."],
  ["Durum", "Taslak ya da Yayında. Boşsa yeni ürün taslak olur."],
  ["Açıklama", "Ürün açıklaması (düz metin)."],
  [
    "Kategoriler",
    "Kategori tanıtıcıları, | ile ayrılır (ör. mutfak|bicaklar). İlki birincil kategori olur.",
  ],
  ["Koleksiyon, Marka", "Tanıtıcıları (panelde listelenen adresleri)."],
  [
    "Ağırlık, Uzunluk, Genişlik, Yükseklik",
    "Mağaza ayarlarındaki birimlerle (başlıktaki parantez). Ondalık için virgül kullanılabilir.",
  ],
  ["SEO başlığı, SEO açıklaması, Odak kelime", "Boşsa mağazanın SEO şablonu kullanılır."],
  [
    "Özellik şablonu",
    'Şablonun tanıtıcısı. "Özellik: anahtar" sütunları bu şablonun özellikleridir; seçenek adı ya da değeri, birden çoğu | ile, Evet/Hayır, sayı.',
  ],
  [
    "Seçenek 1–3 adı ve değeri",
    "Varyantın seçenekleri (ör. Beden = M). Seçeneksiz üründe boş kalır. Var olan üründe yeni seçenek değerleri panelden eklenir.",
  ],
  ["SKU, Barkod", "Varyantın stok kodu ve barkodu (GTIN). Var olan varyant önce SKU ile bulunur."],
  [
    "Fiyat (TRY)",
    "Satış fiyatı, en fazla 2 ondalık (ör. 1.250,50). Diğer para birimlerindeki fiyatlar korunur.",
  ],
  [
    "Maliyet (TRY)",
    "Birim maliyet, KDV hariç, en fazla 2 ondalık. Yalnızca stok raporlarında kullanılır; müşteri görmez.",
  ],
  ["Stok", "Varsayılan depodaki adet."],
  [
    "Genel",
    'Boş hücre o alanı değiştirmez. Görseller panelden eklenir. Önce "Kontrol et" ile dosyanın ne yapacağını görün.',
  ],
]

export const HELP_WIDTHS = [32, 110] as const
