# KA154 Gençlik Katılımı Faaliyetleri — 2. Tur Başvurusu (Türkçe Taslak)

**Çağrı:** Erasmus+ 2026 — KA154-YOU Round 2
**Son başvuru tarihi:** 1 Ekim 2026, 12:00 (Brüksel saati)
**Başvuran:** {{BASVURAN_TIPI: `4 kişilik genç gayri resmi grup (13-30 yaş, temsilci ≥18)` VEYA `Türkiye merkezli genç derneği`}}
**Temsilci / yasal temsilci:** {{AD_SOYAD}}
**Koordinatör ülke:** Türkiye (Programme Country)
**Hibe türü:** Tek seferlik toplu ödeme (lump sum)
**Talep edilen tutar:** 48.000 € (ölçekleme sonrası 45.000 € bandına oturtulacak)
**Proje süresi:** 12 ay (01.01.2027 – 31.12.2027)
**Proje başlığı:** *DiscoverEU Companion — DiscoverEU programına katılım eşiğini düşüren erişilebilir, yeşil ve kapsayıcı genç katılım aracı*

**Kanıt bağlantıları (form eklerinde referans olarak verilecek):**
- Kaynak kod: `https://github.com/embeddedJedi/discovereu-companion`
- Canlı uygulama: `{{CANLI_URL}}`
- Mimari ve özellik tescili: `PROGRESS.md` (repo kökü)
- Veri setleri: `/data/*.json` (33 ülke kapsamı), `/i18n/*.json` (6 dil)
- Açık kaynak lisansı: MIT

---

## 1. Proje Özeti *(maksimum 2000 karakter — bu bölüm ≈ 1.870 karakter)*

DiscoverEU Companion, 18 yaşındaki Avrupalı gençlerin DiscoverEU tren seyahatlerini planlamasına, bütçelemesine ve sürdürülebilir biçimde deneyimlemesine yardımcı olan, açık kaynaklı (MIT), çerçeve kullanmayan, tek sayfalık bir web uygulamasıdır. Uygulama 33 Programme Country için evrensel olarak çalışır; Türkiye'den başvuran ve Schengen vize sürecinde ek engellerle karşılaşan gençler için ise özel bir destek katmanı sunar. Araç 2026-04-22 tarihinde yayımlanmış, hâlihazırda 6 dil arayüzü, erişilebilirlik filtresi, zorunlu rezervasyon uyarı sistemi, 4 koltuk kredisi takipçisi, CO₂ rozeti ve Rainbow Map gibi, programın kapsayıcılık ve yeşil hareketlilik önceliklerine doğrudan cevap veren özellikler barındırmaktadır.

Önerdiğimiz 12 aylık KA154 projesi, yayındaki bu dijital katılım aracını merkeze alarak; (i) dört şehirde hibrit genç diyalog etkinlikleri, (ii) gençler tarafından yürütülen 4 dilli yerelleştirme maratonu, (iii) engelli gençlik dernekleriyle WCAG AAA erişilebilirlik denetimi, (iv) İstanbul'da iki günlük yüz yüze "maker sprint", (v) yeşil hareketlilik veri hikâyeciliği kampanyası ve (vi) EACEA ile ulusal ajanslara sunulacak 4 sayfalık Politika Önerileri Raporu üretecektir.

Proje; Gençlik Stratejisi 2019-2027'nin *Engage · Connect · Empower* eksenleriyle tam hizalanır, DiscoverEU'ya katılım eşiğini düşürmeyi, fırsatları kısıtlı gençlerin sesini karar alıcılara taşımayı ve sürdürülebilir hareketliliği teşvik etmeyi hedefler. Tüm çıktılar CC-BY-4.0 lisansıyla kamuya açık yayımlanacaktır.

---

## 2. Gerekçe ve İhtiyaç Analizi *(maksimum 3000 karakter — bu bölüm ≈ 2.880 karakter)*

DiscoverEU her yıl on binlerce 18 yaşındaki genci Avrupa'yı tren ile keşfetmeye davet eder; ancak programa katılım pratiği hâlâ dört somut engelle gölgelenmektedir:

1. **Bilgi asimetrisi ve karar felci.** Katılımcıların büyük kısmı zorunlu rezervasyon kuralları, koltuk kredisi limitleri ve sınır ötesi tren bağlantıları konusunda yeterli rehberliğe erişemiyor; sonuçta rezervasyon cezaları veya kullanılmayan krediler yaşanıyor. Canlı uygulamamızın `features/reservations.js` ve `features/seat-credits.js` modülleri bu boşluğu kapatmak için özel olarak yazılmıştır.

2. **Dil ve erişilebilirlik bariyeri.** Resmi DiscoverEU kaynakları sınırlı sayıda dilde mevcut; ekran okuyucu, klavye-yalnız gezinme veya disleksi desteği için sistematik bir araç yoktur. Uygulamamız bugün 6 dil (EN, TR, DE, FR, ES, IT iskeletleri) ve erişilebilirlik filtresi ile çalışmakla birlikte, tam AAA uyumu için gerçek kullanıcılarla test edilmeye ihtiyaç duymaktadır.

3. **Türkiye ve diğer vize-yükümlü Programme Country'lerin gençleri için ek yük.** Schengen başvuru süreci, konsolosluk randevu takibi ve ülkeye özgü belge listesi, fırsatları kısıtlı gençler için caydırıcıdır. `features/consulate-reminder.js` ve TL bütçe modülü bu yüke doğrudan cevap verir; ancak dijital araç tek başına yeterli değildir — yüz yüze rehberlik etkinlikleriyle tamamlanması gerekir.

4. **Gençlerin politika geri bildirim döngüsüne erişimi zayıf.** DiscoverEU katılımcılarının deneyimleri EACEA ve ulusal ajanslara yapılandırılmış biçimde ulaşmıyor. Avrupa Gençlik Stratejisi'nin "demokratik yaşama aktif katılım" ekseni, bu döngüyü kurmayı açıkça beklemektedir.

**Kanıt temeli:** Projenin açık depo geçmişi (bkz. `PROGRESS.md`, 5 alt-proje tamamlandı), 2026-04-22 lansmanı sonrası erişim verisi, LinkedIn üzerinden DG EAC Youth Unit ile yapılan ilk temaslar ve Türkiye UA'ya iletilen tanıtım mektubu; gencin sesinin toplandığı mevcut "gelecek bana mektup" (futureMe) ve "günlük cesaret" (daily-dare) modülleri somut katılım verisi üretmektedir. Buna ek olarak, Erasmus+ Gençlik Stratejisi Dahil Etme ve Çeşitlilik Eylem Planı, fırsatları kısıtlı gençlerin programlara katılım oranının halen hedef altında olduğunu kaydetmektedir.

Bu proje, yayındaki aracı gerçek genç sesleriyle test ederek, çok dilli hale getirerek ve politika önerilerine dönüştürerek; dijital katılımı anlamlı, kapsayıcı ve ölçülebilir bir gençlik diyaloguna bağlar.

---

## 3. Hedefler *(maksimum 2500 karakter — bu bölüm ≈ 2.380 karakter)*

Proje, SMART ilkesine uygun beş hedef etrafında kurgulanmıştır:

**H1 — Erişim eşiğini düşürmek.** 12 ay içinde DiscoverEU Companion'ın arayüzünü DE, FR, ES ve IT dillerinde %100 kapsama oranına çıkarmak (`/i18n/*.json` dosyalarında ölçülebilir), böylece yaklaşık 180 milyon genç Avrupalının anadilinde araca erişmesini sağlamak.

**H2 — Fırsatları kısıtlı gençlerin sesini yapılandırmak.** 4 şehirde (İstanbul, Berlin, Madrid, Varşova) hibrit diyalog etkinlikleri yoluyla en az 300 gençle doğrudan temas kurmak, bunların en az %50'sinin fırsatları kısıtlı genç tanımına girmesini sağlamak (Erasmus+ Inclusion Action tanımları temel alınacak).

**H3 — Erişilebilirliği kanıtlanmış düzeye çıkarmak.** Engelli gençlik dernekleriyle iş birliği içinde WCAG 2.2 AAA seviyesinde bağımsız bir denetim raporu üretmek, ekran okuyucu, klavye-yalnız, disleksi ve renk körlüğü senaryolarını gerçek kullanıcılarla test etmek, bulguları kamuya açık biçimde yayımlamak.

**H4 — Yeşil hareketlilik anlatısını somutlaştırmak.** Uygulamanın v1.4 sürümünde yer alacak `impact.html` kamuya açık gösterge paneli aracılığıyla, katılımcıların tren tercihlerinin uçak yerine tasarruf ettirdiği CO₂ emisyonunu hesaplayan ve CC-BY-4.0 lisansıyla yayımlanan ilk açık veri setini üretmek.

**H5 — Gençlik politikasında somut çıktı.** Proje sonunda 4 sayfalık *Recommendations Brief* hazırlamak ve bu raporu EACEA, Türkiye Ulusal Ajansı ile en az bir başka ülkenin ulusal ajansına resmi yoldan iletmek; her kuruluştan yazılı alındı kanıtı almak.

Her hedef, proje kapanış raporunda nicel göstergeyle kapatılacaktır (çeviri kapsama yüzdesi, katılımcı sayısı, denetim raporu URL'si, veri seti DOI'si, resmi alındılar). Hedefler, Avrupa Gençlik Stratejisi'nin *Engage · Connect · Empower* üçlüsüyle birebir eşlenmiştir; hiçbir hedef ölçülemez biçimde bırakılmamıştır.

---

## 4. Hedef Gruplar ve Fırsatları Kısıtlı Gençlere Erişim *(maksimum 2500 karakter — bu bölüm ≈ 2.300 karakter)*

**Birincil hedef grup:** 18-20 yaş aralığında, DiscoverEU başvurusu yapmış veya yapmayı düşünen gençler. Coğrafi odak: Türkiye (200 genç) + Almanya, İspanya, Polonya (her biri yaklaşık 30-35 genç) + çevrim içi bileşen aracılığıyla 33 Programme Country'e açık erişim.

**Sayısal taahhüt:**
- 300+ gençle doğrudan temas (200 TR + 100 EU)
- En az %50 fırsatları kısıtlı genç katılımı (≥150 genç)
- 20 gençle iki günlük İstanbul maker sprint'i (en az 10 kişi fırsatları kısıtlı)
- Çevrim içi katılım yoluyla en az 2.000 benzersiz kullanıcı erişimi (açık analitik, kişisel veri toplamadan)

**Fırsatları kısıtlı genç tanımı (Erasmus+ Inclusion & Diversity Framework temelli):** engellilik (fiziksel, duyusal, bilişsel, öğrenme güçlüğü), ekonomik engeller (hane gelir alt çeyreği), coğrafi engeller (kırsal/küçük kent), eğitim güçlükleri, kültürel farklılıklar (göçmen/mülteci geçmişi), sağlık koşulları.

**Erişim stratejisi — ulaşılması zor gruplara ulaşma:**
- **Engelli gençler:** Türkiye'de iki engelli gençlik derneği (MoU'lar proje başlangıcında imzalanacak) ile doğrudan davet; etkinlik mekânları fiziksel erişilebilirlik denetiminden geçecek; Türk İşaret Dili tercümesi bütçelenmiştir.
- **Ekonomik engeli olan gençler:** Tüm etkinlikler katılımcı için ücretsizdir; ulaşım ve yemek inclusion support kaleminden karşılanır; uygulamanın TL bütçe modülü düşük bütçeli senaryolar için özel olarak tasarlanmıştır.
- **Kırsal/küçük şehir gençliği:** Hibrit format — her fiziksel etkinliğin eş zamanlı çevrim içi katılım bileşeni vardır; tüm materyaller sonradan açık arşivde yayımlanır.
- **Vize-yükümlü gençler:** Türkiye odaklı konsolosluk takip modülü ve Schengen belge kontrol listesi, başvuru sürecinde fiilen karşılaşılan engeli hedefler.

**Toplumsal cinsiyet dengesi hedefi:** %50 ± 10 kadın/erkek/non-binary dağılımı; başvuru formlarında zorunlu olmayan öz-beyan alanıyla izlenecek.

Tüm veriler KVKK + GDPR uyumlu toplanacak, pseudonymised analiz yapılacak, ham veri proje kapanışında silinecektir.

---

## 5. Faaliyetler *(maksimum 5000 karakter — bu bölüm ≈ 4.770 karakter)*

Proje altı ana faaliyet etrafında kurgulanmıştır. Tüm faaliyetler gençler tarafından yönetilir, non-formal öğrenme ilkelerine dayanır ve mevcut dijital araçla (DiscoverEU Companion) entegre şekilde yürütülür.

### F1 — Dört Hibrit Genç Diyalog Etkinliği *(4 etkinlik × 1 gün, 40-60 katılımcı/etkinlik)*
**Yer:** İstanbul (Mart 2027), Berlin (Mayıs 2027), Madrid (Eylül 2027), Varşova (Kasım 2027).
**İçerik:** "DiscoverEU bizim için nasıl işler hale gelir?" temalı gençlik diyaloğu; v1.2 konsorsiyum kısa listesindeki yerel ortak kuruluşlarla birlikte düzenlenir. Her etkinlik: sabah oturumu (mevcut engellerin haritalanması), öğleden sonra co-design oturumu (uygulamada yeni özellik fikirleri), akşam karar alıcı paneli (yerel UA temsilcisi veya belediye gençlik birimi). Hibrit bileşen: canlı Türkçe/İngilizce simultane çeviri + kayıtların açık arşivde yayımlanması. Çıktı: her etkinlikten yapılandırılmış bir tutanak → EACEA'ya gönderilecek genel rapora girdi.

### F2 — Yerelleştirme Maratonu *(sürekli; 6 ay; 20+ gönüllü çevirmen)*
**Yer:** GitHub tabanlı dağıtılmış katkı akışı + ayda bir çevrim içi "translation jam".
**İçerik:** Uygulamanın tam arayüz yüzeyinin (~1.400 dize) DE, FR, ES, IT dillerine %100 çevrilmesi. Genç gönüllü çevirmenler, bir koordinatör gözetiminde çalışır; her dil için en az üç çapraz okuyucu. Çıktı: `/i18n/de.json`, `fr.json`, `es.json`, `it.json` dosyalarının production-ready hale gelmesi; her çevirmen için dijital katılım belgesi (Youthpass uyumlu).

### F3 — Erişilebilirlik Denetim Sprinti *(3 ay; 15-20 test kullanıcısı)*
**Yer:** İstanbul + çevrim içi.
**İçerik:** Engelli gençlik dernekleriyle iş birliği içinde WCAG 2.2 AAA denetimi. Senaryolar: NVDA/VoiceOver ekran okuyucu, yalnızca klavye gezinme, disleksi dostu tipografi, renk körlüğü simülasyonu, bilişsel yük değerlendirmesi. Her test oturumu iki gençten (bir test eden + bir gözlemci) oluşur. Çıktı: kamuya açık `accessibility-audit-2027.pdf` raporu, GitHub Issues'a bağlı ≥30 düzeltme ticket'ı, çözümlerin en az %80'inin proje süresi içinde kodda kapatılması.

### F4 — Yeşil Hareketlilik Veri Hikâyeciliği Kampanyası *(4 ay)*
**Yer:** Çevrim içi + sosyal medya.
**İçerik:** v1.4 Impact Dashboard'un (`/impact.html`) kamuya açılması; katılımcıların tren tercihlerinin uçakla karşılaştırmalı CO₂ tasarrufunu toplulaştırıp anonim biçimde gösterir. Genç editörlerden oluşan 5 kişilik bir "veri gazetesi" ekibi, ay boyunca 8 kısa veri hikâyesi (Instagram Reels + blog yazısı) yayımlar. Çıktı: CC-BY-4.0 lisanslı açık veri seti + 8 içerik + toplu erişim istatistiği.

### F5 — İstanbul Maker Sprint *(2 gün; 20 genç; Temmuz 2027)*
**Yer:** Teknopark İstanbul (gençlik dostu mekân, erişilebilir).
**İçerik:** 4 kişilik takımlarda 5 küçük grup halinde, uygulamanın gelecek özelliklerini birlikte tasarlar (co-design). Non-formal öğrenme yöntemleri: design thinking, empathy map, prototip çizimi. Katılımcıların en az yarısı fırsatları kısıtlı genç kontenjanından seçilir. Çıktı: 5 özellik prototipi, en az 2'sinin proje sonu itibarıyla koda geçirilmesi, her katılımcı için Youthpass sertifikası.

### F6 — Politika Diyaloğu ve Öneriler Raporu *(son 2 ay)*
**Yer:** Çevrim içi + Brüksel/Ankara yüz yüze teslim.
**İçerik:** F1-F5 çıktılarının sentezinden oluşan 4 sayfalık *Recommendations Brief*; gençler tarafından yazılır, iki karar alıcıyla yapılan kapanış yuvarlak masa toplantısında müzakere edilir. Resmi olarak EACEA `EAC-YOUTH@ec.europa.eu` adresine, Türkiye UA'ya ve en az bir başka ulusal ajansa iletilir; yazılı alındı kanıtları proje kapanış dosyasına eklenir.

**Hazırlayıcı ziyaret:** F1 etkinliklerinden önce iki ortak şehirde (Berlin + Madrid) birer hazırlayıcı ziyaret gerçekleştirilecek (her biri 2 gün, 2 kişi).

---

## 6. Metodoloji *(maksimum 2500 karakter — bu bölüm ≈ 2.340 karakter)*

Proje baştan sona **non-formal öğrenme** ve **gençler tarafından yönetim** ilkelerine dayanır. Karar alma yapısı ikili katmanlıdır: (i) 4 kişilik gayri resmi gençlik çekirdek grubu (proje sahibi), (ii) her faaliyet için oluşturulan 3-5 kişilik genç görev güçleri. Yetişkin danışmanlar yalnızca finans uyumu ve yasal temsil rolündedir, içerik kararlarına müdahale etmezler.

**Gençlik katılımı boyutu (youth participation dimension):**
- Her faaliyetin tasarımı, yürütmesi ve değerlendirmesinde 13-30 yaş aralığı gençler çoğunluktadır.
- Politika Önerileri Raporu tamamen gençler tarafından yazılır; yetişkin redaksiyonu yalnızca dilbilgisi düzeyindedir.
- Tüm etkinliklerde "empty chair" ilkesi uygulanır: en az bir karar alıcının gençlerin sorularına yüz yüze cevap vermesi zorunludur.

**Non-formal yöntemler:**
- Open Space Technology (F1 diyalog etkinliklerinin sabah oturumları)
- Design Thinking + empathy mapping (F5 maker sprint)
- Peer review + pair translation (F2 yerelleştirme)
- User-centered accessibility testing, think-aloud protokolü (F3)
- Data storytelling, kolektif düzenleme (F4)
- Policy co-drafting, roleplay müzakere simülasyonu (F6)

**Dijital katılım araçları kapsayıcılığın aracıdır, amacı değildir.** DiscoverEU Companion etkinlikler için ortak bir referans nesnesi işlevi görür; katılımcılar uygulamayı gerçek zamanlı kullanır, bulgularını GitHub Issues'a açık olarak düşer, değişiklikler proje süresi boyunca izlenebilir.

**Youthpass entegrasyonu:** Her katılımcıya, sekiz temel yetkinlik üzerinden Youthpass sertifikası verilir. Sertifika içeriği katılımcı ile birlikte doldurulur (self-assessment + peer feedback).

**İzleme ve değerlendirme:** Ön-anket + son-anket (Likert + açık uçlu), katılımcı günlükleri, dış erişilebilirlik denetimi, GitHub üzerinden açık proje metriği. Tüm veriler GDPR/KVKK uyumlu toplanır; kişisel veri en aza indirilir, anonim toplulaştırılmış veri CC-BY-4.0 ile yayımlanır.

---

## 7. Beklenen Etki ve Yaygınlaştırma *(maksimum 3000 karakter — bu bölüm ≈ 2.870 karakter)*

**Bireysel katılımcı düzeyinde etki (hedef):**
- 300+ gence doğrudan ulaşım; %50+ fırsatları kısıtlı genç.
- Tüm katılımcılarda sekiz Youthpass yetkinliğinde öz-bildirim artışı (ön/son-anket karşılaştırması).
- En az 100 katılımcının proje sonrası DiscoverEU başvurusunda bulunması veya mevcut başvurusunu tamamlaması.
- En az 25 genç gönüllü çevirmen/test eden/veri hikâyecisinin "aktif Avrupa vatandaşlığı" deneyimi edinmesi.

**Kuruluş ve topluluk düzeyinde etki (hedef):**
- DiscoverEU Companion uygulamasının 4 yeni dilde %100 kapsama erişmesi (EN + TR + DE + FR + ES + IT = 6 tam dil).
- WCAG 2.2 AAA uyumuna ulaşılması; denetim raporunun kamuya açık yayımlanması.
- CC-BY-4.0 açık veri setinin (DiscoverEU CO₂ Impact Dataset) üretilip kamuya açılması — bilgimiz dahilinde DiscoverEU deneyimine odaklanan ilk açık veri seti.
- 4 hibrit etkinlikten elde edilen önerilerin EACEA'ya ve en az iki ulusal ajansa resmi iletimi.

**Sistem düzeyinde etki (hedef):**
- Gençlerin DiscoverEU politika tartışmasına yapılandırılmış biçimde dâhil edilmesi için tekrarlanabilir bir model üretilmesi.
- EACEA'nın *useful-links* sayfasında uygulama referansının oluşturulması için somut bir diyalog hattının açılması.
- Türkiye UA'nın dijital kapsayıcılık ve yeşil hareketlilik önceliklerinde kullanılabilecek bir vaka çalışmasının üretilmesi.

**Yaygınlaştırma planı (12 ay boyunca süreklidir, proje son 3 ayında yoğunlaşır):**
- **Kanallar:** proje web sitesi (`{{CANLI_URL}}/impact.html`), GitHub README, LinkedIn, Instagram/TikTok (genç editör ekibi), European Youth Portal başvurusu, SALTO-YOUTH Toolbox'a kaynak kaydı, EPALE blog yazısı, ERASMUS+ Project Results Platform zorunlu kaydı.
- **Formatlar:** 8 kısa veri hikâyesi, 4 etkinlik tutanağı, 1 denetim raporu, 1 veri seti (+ veri sözlüğü), 1 politika önerileri raporu, 4 çeviri bilgi notu, 1 kapanış web semineri (çevrim içi, kayıt açık arşivde).
- **Dil:** tüm çıktılar EN + TR minimum; ana rapor 6 dilde özet.
- **Lisans:** kod MIT, içerik CC-BY-4.0, veri CC-BY-4.0.
- **Sürdürülebilirlik köprüsü:** KA220-YOU 2027 Mart başvurusuna kanıt klasörü olarak kullanılacaktır (bkz. Bölüm 8).

---

## 8. Proje Sonrası Sürdürülebilirlik *(maksimum 2000 karakter — bu bölüm ≈ 1.900 karakter)*

**Dijital ürünün sürdürülebilirliği:** DiscoverEU Companion, proje öncesinde zaten yayında ve açık kaynaklı (MIT) olduğu için proje bitimine bağımlı değildir. Proje süresince yapılan tüm geliştirmeler (çeviriler, erişilebilirlik düzeltmeleri, impact dashboard) doğrudan ana kod tabanına işlenir ve bakımı sıfır maliyetli GitHub Pages altyapısında devam eder. Alan adı yenileme maliyeti yıllık ≈ 15 €'dur ve çekirdek ekip tarafından karşılanır.

**Topluluk sürdürülebilirliği:** Proje sonunda en az 25 aktif gönüllü katkıcının GitHub üzerinden devam etmesi hedeflenir. "Good first issue" etiketi, katkı rehberi (CONTRIBUTING.md), aylık çevrim içi topluluk çağrısı ve Youthpass tanıma mekanizması ile topluluk akışı korunur.

**Kurumsal sürdürülebilirlik:** F1 etkinliklerinde kurulan dört şehirli ortak ağı, 2027 Mart KA220-YOU Cooperation Partnerships başvurusunun konsorsiyum çekirdeğini oluşturur. Bu başvuru (250.000 € bandında), dijital aracın büyümesini 2028-2030 döngüsünde finanse edecektir; dolayısıyla mevcut KA154 projesi, orta vadeli bir finansman zincirinin ilk halkasıdır. Paralel olarak ESC Host Quality Label başvurusu yapılır; onay hâlinde ESC51 aracılığıyla 1-2 gönüllünün 2028'de yerelleştirme ve topluluk işleri için evsahipliği sağlanır.

**Politika sürdürülebilirliği:** EACEA'ya ve ulusal ajanslara iletilen Öneriler Raporu, yıllık olarak güncellenip yeniden sunulacaktır; bu döngü çekirdek ekibin gönüllü taahhüdü altındadır.

**Çıktı korunurluğu:** Tüm çıktılar kamuya açık lisanslarla (MIT, CC-BY-4.0) yayımlandığı için, proje ekibi dağılsa dahi materyal kullanılabilir kalır; Zenodo'ya DOI'li arşivleme yapılır.

---

## 9. Bütçe Anlatısı *(maksimum 1500 karakter — bu bölüm ≈ 1.470 karakter)*

Toplam talep: **45.000 €** (tek seferlik toplu ödeme). Kalemler KA154 birim maliyet menüsüne eşlenmiştir; ayrıntılı dağılım ek dosyada sunulmuştur (`ka154-r2-budget-breakdown-tr.md`).

- **Aktivite maliyetleri — 4 hibrit diyalog etkinliği:** 12.000 € (etkinlik başına 3.000 €: mekân, yemek, simultane çeviri, yerel ulaşım). F1.
- **İstanbul Maker Sprint:** 6.000 € (iki gün mekân + yemek + kolaylaştırıcı + malzeme). F5.
- **Erişilebilirlik testi + katılımcı yol desteği:** 8.000 €. F3.
- **Yerelleştirme koordinatörü onorer:** 6.000 € (6 ay × 1.000 €, yarı zamanlı eşdeğer). F2.
- **İletişim, görsel tasarım, çeviri materyalleri:** 4.000 €. F4 + F6 + yaygınlaştırma.
- **Koordinatör zamanı (0,3 FTE × 12 ay):** 6.000 € (öncelikle gönüllü; hibe yalnızca fiili iş yükünü tanır).
- **Inclusion support top-up** (fırsatları kısıtlı gençler için ek ulaşım, refakatçi, TİD çevirmeni, diyet uyumu): 3.000 €.

Toplu ödeme modeli gereği, ödeme tek kalem olarak gerçekleşir; iç takip kolaylığı için yukarıdaki kırılım kullanılacaktır. Eş finansman: çekirdek ekibin gönüllü emeği + Teknopark İstanbul'un ücretsiz mekân desteği (piyasa değeri ≈ 2.500 €, in-kind). Her faaliyet somut çıktıya bağlıdır; çıktı üretilmezse ilgili pay geri iade edilir (tipik KA154 "completion of activities" kuralı).
