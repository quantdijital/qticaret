/**
 * The il and ilçe lists the fake DHL eCommerce serves (CBS Info,
 * `getcities`, `getdistricts/{cityCode}`), in DHL's shape: the name in
 * capitals with the plate as a suffix ("İSTANBUL  34"), the code a number.
 * Every il by its plate; the ilçe of the provinces `seed:demo` sends
 * parcels to (apps/backend/src/scripts/seed/orders), and "Merkez" for the
 * rest. Codes are the fake's own: real DHL's are asked of DHL.
 */

// prettier-ignore
const CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin",
  "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale",
  "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum",
  "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin",
  "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli",
  "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas",
  "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak",
  "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan",
  "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
]

// prettier-ignore
const DISTRICTS: Readonly<Record<number, readonly string[]>> = {
  1: ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan",
    "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  6: ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk",
    "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik",
    "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan",
    "Şereflikoçhisar", "Yenimahalle"],
  7: ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa",
    "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca",
    "Manavgat", "Muratpaşa", "Serik"],
  16: ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles",
    "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi",
    "Yenişehir", "Yıldırım"],
  26: ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi",
    "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
  34: ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy",
    "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece",
    "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa",
    "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik",
    "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla",
    "Ümraniye", "Üsküdar", "Zeytinburnu"],
  35: ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca",
    "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun",
    "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere",
    "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  41: ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit",
    "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
  42: ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli",
    "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır",
    "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu",
    "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
  61: ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı",
    "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı",
    "Tonya", "Vakfıkebir", "Yomra"],
}

const upper = (name: string): string => name.toLocaleUpperCase("tr")

/** `getcities`: every il, its plate as the code and the name's suffix. */
export const fakeCities = (): { code: string; name: string }[] =>
  CITIES.map((name, index) => {
    const plate = String(index + 1).padStart(2, "0")
    return { code: plate, name: `${upper(name)}  ${plate}` }
  })

/** `getdistricts/{cityCode}`: the il's ilçe, coded `<plate><nn>`; empty for an unknown il. */
export function fakeDistricts(cityCode: string) {
  const plate = Number(cityCode)
  const city = CITIES[plate - 1]
  if (!Number.isInteger(plate) || !city) {
    return []
  }
  return (DISTRICTS[plate] ?? ["Merkez"]).map((name, index) => ({
    cityCode: String(plate),
    cityName: upper(city),
    code: String(plate * 100 + index + 1),
    name: upper(name),
  }))
}
