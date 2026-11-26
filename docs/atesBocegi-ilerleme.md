Yapıldı: ad, kart/etiket, market beyaz zemin, ışık sönme, Dokun ve başla animasyonu, Su Sırala öğretici.
Yapılmadı (sonraki oturum): hareket yumuşatma, toplama yarıçapı/mıknatıs, bomba, dikenli dal hasarı (yarım bar), tozsuz bölümler, sarmaşık tuzağı, böcek modeli ve genel görsel iyileştirme (%25 büyütme dahil), denetim.

## 2026-11-19 oturumu (docs/gorev-karanliktaSuzul.md)
Yapıldı:
- AŞAMA 0: market önizleme koyulaştırıldı + headless Chrome piksel testi (c0db16a).
- AŞAMA A: hareket rampası, mıknatıs + R_TOPLA 4,2, R_GORSEL 3,0, bomba, dal hasarı 0,5, tozsuz bölümler, sarmaşık + uyarı/silüet, çakışma kuralı, testler (2aecb4b). Kararlar tasarım §11.
- AŞAMA B4: böcek modeli, engeller, bölge katmanları, toz, bomba, sarmaşık görselleri; sw.js SURUM 16 (f18977a).
- AŞAMA D: iki tur bağımsız denetim; tur 1 (silüet konturu, dal sprite önbelleği, yutulan toz sönmesi, market böceği) ve tur 2 (bomba patlaması dikey hızı, hareketi azaltta kanat/hale, yaprak/filiz konturu, dal desen varyantı) düzeltildi. Tüm testler yeşil.
- Kapsam dışı bırakılan: tritanopi testi (tasarım protanopi + deuteranopi şart koşuyor).
- Ekonomi: kullanıcı onayıyla sabitlere dokunulmadı (mıknatıs puanı artırıyor).
Cihazda bakılacak: süzülme hissi; bomba okunaklılığı; sarmaşık silüeti; market önizlemesi (Sedef, Buz); düşük cihazda fps.

## 2026-11-20 oturumu (docs/gorev-karanliktaSuzul2.md)
Yapıldı (sw.js SURUM 16 → 17, görünen sürüm 1.2.0):
- AŞAMA 1 (29b7f0b, 7573e1e): market önizlemesindeki beyaz karenin gerçek sebebi Android Chrome otomatik karanlık modu. Mod SVG zemin dolgusunu ters çeviriyordu. Zemin artık CSS'te (#05080D, 6px köşe). Böcek gövdesi ve dal canvas'ta çiziliyor. Test: tools/marketKartYakala.js gerçek market envanterini normal ve otomatik karanlık modda çiziyor; 10 kartın köşe, kenar ve iç pikselleri denetleniyor.
- AŞAMA 2 (2ef6ea1): Kaçış yılanında Lav ve Mürekkep'in en koyu gövde renkleri açıldı. Lav #FF8A3C 3:1 göz oranını geçmediği için #C47A10 yapıldı (sapma). Test: tools/yilanGozTest.js (beyaz göz/gövde ≥ 3, gövde/kontur ≥ 1,6, Lav gövde renkleri arası ΔE ≥ 10). Diğer temalarda 3:1 altı (yalnız raporlandı): toprak, buz, kumsal, sedef, çini (hedef), vitray; kiraz gövde/kontur 1,29.
- AŞAMA 3 (b486540): tavan sersemlemesi ve ölümcül zemin. SERSEM_SURE 0,9 sn; uyanma Y 73, yani oyun alanının %25'i kadar zeminin yukarısı; ZEMIN_KORUMA 0,5 sn. Tasarım §12.1.
- AŞAMA 4 (35b90a3): 800 puandan sonra risk tozu, dikenli dalın ucundan 4 birim içeride; mıknatıs çekmez, ekstra puan yok. 2400 puandan sonra tam toplayıcı bot 7 dilimde ort. 2,34 hasar alıyor, seçici bot 0. Tasarım §12.2.
- AŞAMA 5 (2ecc1ad, 56c260c, ffcfa0f, 462c73b): 9 temada ışık halkası, halo, böcek gövdesi, bölge paletleri, engel ve tehlike tonları temadan geliyor. Silüetler değişmedi. ΔE (CIEDE2000, gerçek canvas çizimi, 4 bölge) taban: en düşük çift 1,42; son: en düşük çift 7,61 (buz/çini); sınır 6. En düşük kontrast 3,74. Tasarım §12.3.
- AŞAMA 6 (dedaf71): gümüş ve altın sandık sahip olunan temayı vermez; boş grup oranı kalan gruplara dağıtılır; tema kalmayınca sandık pasif olur ve jeton harcanmaz. Gümüş .59375/.35625/.05/0, altın .10/.35/.30/.25; fiyatlar aynı. Test: tools/sandikTest.js.
- Denetim: 1 tur (opus); kritik bulgu yok. Otomatik karanlıkta önizleme içi, iade artıkları ve test adları düzeltildi (7573e1e).
Cihazda bakılacak:
- Sersem inişi: 0,9 sn'de 69 birim iniliyor (ort. 77, tepe 115 b/sn; normal düşüş 30). "Yavaşça süzülme" hissi tutmayabilir. Ayar AYAR.hareket'te.
- Tavan sersemlemesi başına ~0,7 engel çarpması ölçüldü (uyanmada sıradaki boşluk kaçabiliyor).
- Zemin ölümü animasyonu; bitiş başlığı yine "Işık Söndü".
- Risk tozunun dal içinde okunurluğu.
- Tema hissi: buz/çini ayrımı; Lav/Toprak'ta bomba halesi; Sedef/Kiraz pastel bölge tonları; halo halkası yoğunluğu.
- Market önizlemesi otomatik karanlıkta (Android "web içeriğini karart").
- Sandık pasif düğme metni (320 px'te iki satır).

## 2026-11-22 oturumu (docs/gorev-karanliktaSuzul3.md)
Yapıldı (sw.js SURUM 17 → 19, görünen sürüm 1.2.0):
- AŞAMA 1 (e6cd1fd): market minisinin zemini opak #05080D'den Tempo ile aynı yarı saydam rgba(8,12,22,.55)'e geçti. Kart zemini ve tema tonu artık minide görünüyor. Boyut 68 px, köşe 10 px. Sağ kenardaki ince çizgi, kenara yapışık tam boy dikenli daldı; kenardan 6 birim içeride, üstten sarkan kısa dal olarak yeniden çizildi. Zemin CSS'te kaldı, bu yüzden otomatik karanlıkta beyaz kare oluşmuyor.
  - Eşikler: mini ile kart arası dE76 1,5-22 (ölçülen 3,07-19,04); Tempo minisinden sapma ≤ 2,5 (ölçülen en yüksek Lav 2,15); ışık, toz ve dal kenarı WCAG ≥ 3 (ölçülen 9,2-17); önizleme koyuluğu ort/köşe ≤ 0,065.
  - Diğer 4 mini Aşama 1 öncesiyle (9d29413) piksel düzeyinde aynı (Süzül minisi gizliyken fark 0). Sağ kenar çizgisi testi: yeni sürümde 0 px, eskisinde 38 px.
- AŞAMA 2 (50552c8, düzeltme 407f431): oyun alanı tam ekran. Kullanıcı kararı 3. seçenek: görünür alan ve üretim ufku birlikte genişler.
  - Ölçek artık yüksekliğe göre (H=100). Görünür genişlik GW en az 50, en çok 20:9 (222,2). Bu sınırı aşan kısım yalnız arka plan ve karanlık olarak çizilir. En/boy oranı 0,5'in altındaki ekranlarda üst ve alt bantlar sahne dokusuyla dolar.
  - Üretim ufku cihazdan bağımsız: U.UFUK = 230 birim (eski adı ONDE*W = 100). Hiçbir nesne görünür alanın içinde doğmaz; en küçük doğuş ekran x'i 242,6.
  - Gerçek GW değerleri: 360x800'de 53,7; 412x915'te 52,6; 390x844'te 54,7; masaüstü çerçevesinde 56,4. Telefondaki asıl kazanç yan bantların kalkması.
  - Eşik telafisi (ileriTozPuani): eşikler, böcek ile yeni dilim arasındaki 130 birimdeki alınmamış tozların zincir çarpanıyla değerine göre öne çekilir. Toz terimi en çok 100. esikPuan azalmaz. Telafisiz kayma +108..+122 puandı. Yeni sürümde 50 birimlik ekranda medyan eskiden en çok +14 sapıyor; en kötü durum eşiğin 3 puan altı (Bot A, sarmaşık).
  - 20:9 ekranda eşik dilimi, oyuncunun puanı eşiğin ~30-42 altındayken görünür alana girer. Bu, aynı dünyayı daha uzaktan görmenin sonucu.
  - Adalet testine iki yeni kural eklendi: üretim puanı ≤ puan + 132,5; dört eşik için, eşiği geçen ilk dilim 50 birimlik ekrana girerken puan ≥ eşik − 5. Eski eşiklerin hiçbiri gevşemedi. 1000 tohum, 27/27.
  - Yeni test dosyası tools/atesBocegiGenislikTest.js (38 test): 360x800, 412x915, 390x844, masaüstü çerçevesi, yatay 915x412, kurulu uygulama 411x960.
- Denetim: 1 tur (opus); kritik bulgu yok. Önemli bulgular (telafinin fazla ileri gitmesi, SURUM 19'a çıkmamıştı, HEAD'e bağlı referans testi kendini kendisiyle karşılaştırıyordu, dar ekran yolu sınanmıyordu) 407f431'de düzeltildi.
- Tüm paketler yeşil: adalet 27, çekirdek 151, oyun 67, tema 55, genişlik 38, sw 22, dokumAnim 25, hediye 14, kacisCoz 17, kacisGiris 13, kayitGoc 31, odul 13, sandik 15, suSiralaCoz 26, yilanGoz (zorunlu hata 0).
- Karanlık katmanı (kullanıcı onayıyla): kc her karede sıfırdan kuruluyor (önceden birikip tamamen opak oluyordu). Işık dışında yalnız arka plan dekoru DEKOR_SIZINTI 0,11 ile görünüyor (ölçülen oran 0,127-0,128, 8 bit yuvarlama). Dal, toz ve kıvılcım yalnız ışıkla görünüyor. Bomba ve sarmaşık uyarısı istisna, kendi ışığıyla görünüyor (adalet tasarımı). Dar ekran bantları ve 20:9 ötesindeki atmosfer alanı da aynı. SURUM 20. Tema kontrastı en düşük 3,74; adalet 27/27.
Kabul edilen: karanlık tuvali artık tam tuval boyutunda (yatay telefonda ~4 MB, yatay tablette ~13 MB). Aşama 1'de köşe eşiği .02'den .065'e gevşetildi; beyaz kare yine yakalanıyor.
Cihazda bakılacak:
- Telefonda mini zemini (Sedef, Lav, Buz), otomatik karanlık mod açık ve kapalı.
- Tam ekran oyun: yan bant kalmadı mı, HUD ve "Dokun ve başla" ortalı mı.
- Yatay ekran (kurulu uygulama): böcek ve ışık çok küçük.
- Işık dışındaki dekor (%11) gerçek ekranda seçiliyor mu; çok soluksa DEKOR_SIZINTI en çok 0,15.
- Çentikli ekran: safe-area dolgusuyla .ab-alan genişliği.
- Eşik hissi: risk tozu, bomba ve sarmaşık eskisiyle aynı puanlarda mı geliyor. Hiç toz toplamayan oyuncuda eşik en kötü ~85 puan erken gelebilir.

## 2026-11-24 oturumu (docs/gorev-guncelleme-oyunlar.md FAZ B; commit koordinatörde)
Yapıldı (sw.js SURUM 23 → 24; ayrıntı tasarım §13):
- Risk tozu, Bot T / Bot K ve risk testleri silindi. Bölge 2 öncesi üretim, risk tozu çıkarılmış HEAD (32f4eef) üretimiyle bayt bayt aynı (özet `c40d01b6`).
- Kademe (ekranda "Bölge N", mesafe): 0 / 500 / 1600 / 2800 / 4000 birim (0 / 20 / 61 / 99 / 132 sn). Yazı 1,5 sn, yalnız 2–5, sessiz. Biyom değişimi aynen.
- Hız ve tükeniş rampası kademe 2'den: `HIZ_EK` 10, `RAMPA_SON` 5000, `HIZ_TAVAN` 44 (6803 birimde; 41'e 4707), `SIZINTI_EK` 0,012, `SIZINTI_TAVAN` 0,06. Kademe 1 bit bit eskisi.
- Salınan engel (kademe 3+): ipe asılı örümcek; genlik 2 → 5, periyot 2,4 → 1,4 sn. Süpürülen zarf boşluğun dışında, her fazda geçit ≥ bosluk. Hasar 0,34.
- Düzensiz ışık (kademe 4+): `DAG_Y` 3, `DAG_X` 0,35, `DAG_ATLA` 0,25, `DAG_BOSLUK` 0,34. Kinematik ulaşılabilirlik ve `ISIK_MARJ` 5,8 ile kıstırılıyor.
- İkinci şans: salınan da temizleniyor; en yakın salınanın varışı ≥ `TEMIZ_SN + tAra`.
- Test kancası `oyunOlustur(tohum, {mesafe, puan})`. Yeni headless test `tools/atesBocegiBolgeTest.js`: yerel sunucu, 390x844, normal ve `?reklamTest=1`.
Sapmalar: "Bölge 5 tam dağınık" kısıldı (y kayması ±3, düşme sınırlı); ışık 0'da `T_MIN` gecikmeli Bot B'nin tek erken bilgisi toz yolu (ölçüm §13.4). Bomba ~4700 birimden sonra yerleşemiyordu; kullanıcı kararıyla 6 birimlik bomba ön işareti eklendi, oran üst hızda %9,6-11,6 (§13.9). Alt örümcek ipsiz.
Cihazda bakılacak:
- Hız rampası hissi (2 dk'da 25 → 44).
- Örümceğin ışıkta okunurluğu (9 tema).
- "Bölge N" yazısının yeri (HUD'un altı, %16).
- Düzensiz ışığın görünür olup olmadığı.

## 2026-11-26 oturumu (docs/gorev-performans-efekt-suzul.md FAZ 3; commit koordinatörde)
Yapıldı (sw.js SURUM 27 → 28; ayrıntı tasarım §14):
- Bölge 5'te zorluk derecesi d: 4000'den sonra her 1500 birimde +1, en çok 8 (16000'de plato). Gösterilmez. Ayarlar `AYAR.zorluk` `D_*` (js/atesBocegi.js).
- d ile: engel arası 1,20 sn'ye kadar kısalır, boşluk 16'ya iner, bomba olasılığı 0,20 → 0,55, sarmaşık 0,12 → 0,20, örümcek ağırlığı 5 → 8, örümcek genliği 5 → 6 ve periyodu 1,4 → 1,3 sn, düzensiz ışık artar, sızıntı en çok +0,006/sn. Örümcek → bomba ve bomba → örümcek kombinasyonları sıklaşır.
- 4000 öncesi ve d = 0 (5500 öncesi) üretim HEAD (5bb9227) ile bayt bayt aynı (adalet testi özetleri).
- Yeni araç tools/atesBocegiDikkatliBot.js: 250-350 ms tepki + küçük nişan hatası; d arttıkça hayatta kalma mesafesi düşer, değişmez ihlali 0.
- Adalet testi 34/34 (429 sn): üç bot d = 8'de 0 hasar (60000 ve yeni 16000 kümesi, 200'er tohum). En kısa tepki 0,6073 sn, bomba ön işaret 1,0182 sn, örümcek geçidi 16,000, ulaşılamaz ışık 0.
- Dikkatli bot (200 tohum, 16000'den): ortalama mesafe d 0 26616 → d 8 8169; Bölge 5 başından gerçek ilerlemede 26880 → 15335.
- Kıvılcım testi: derece öncesi ≥ %3; eşik plato kovasında (d = 8) ≥ %0,25 (ölçülen %0,48). Sık engelde kıvılcım bacak sınırına sığmıyor. `ayarDogrula` platoda kıvılcımın sığmadığı `D_TARA_MIN`'i (1,15 ve altı) reddeder.
- Denetim düzeltmeleri: ikinci şans varışı ön kenardan (`R_CARPMA`) ve rampada hızın üst sınırıyla ölçülüyor (§14.8; test kesin, d = 8 ve 60000+ kümeleri). Işık ekonomisinin birleşik etkisi §14.7'de. Kalıcı test eklendi: `D_MAX` 0 kopyası HEAD ile birebir (atesBocegiTest). Dikkatli botta tepki ölçümü toleranssız; "ortalama düştü" kararı sabit kümede.
Cihazda bakılacak:
- Zorluk hissi 16000'den sonra (yaklaşık 7 dk oyun). Çok sertse `D_BOMBA` / `D_TARA` küçült ya da `D_ADIM` büyüt; yumuşaksa `D_MAX` artırma yerine `D_*` uç değerlerini büyüt (sınırlar `ayarDogrula`'da).
- Kıvılcım yüksek d'de nadir (%0,4); ışık dengesi.
- Örümcek + bomba arka arkaya geldiğinde okunurluk.
