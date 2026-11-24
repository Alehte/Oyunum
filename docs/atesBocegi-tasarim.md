# Ateş Böceği — tasarım dosyası

Durum: tasarım. Kod yok. Bu dosya tek başına uygulanabilecek kadar kesin olmalıdır; "önerilir" denmeyen her sayı ve ad bağlayıcıdır. Sayıların tamamı `AYAR` nesnesinde durur (bkz. 3.8); denge ayarı yalnız oradan yapılır.

Hedef sürüm: görünen sürüm **1.2.0**, `sw.js` SURUM **13**, kayıt sürümü **3**.

Depodaki dayanaklar (uygulamadan önce oku): `js/tempoCekirdek.js` + `js/tempoKup.js` (DOM'suz çekirdek / UI ayrımı ve UMD kalıbı), `js/core.js` (`OYUN_DOSYALARI`, `oyunAc`, `gocEt`, `AppGold`, `AppSaveProgress`, `GOLD_PILLS`, `AppReset`), `js/marketKatalog.js`, `js/market.js` (`aktif`, `temayiYay`, `indeksle`), `js/marketEkran.js` (`onizlemeKur`), `sw.js` (`OYUNLAR`), `tools/odulTest.js` (işaretli blok kesme deseni), `tools/kontrastDenetim.js`.

---

## 1. Oyun özeti

Sonsuz yan kaydırmalı, tek parmak oyunu. Dikey ekran.

- **Kontrol:** ekrana basılı tut → böcek yükselir; bırak → süzülerek alçalır. Başka girdi yok. Klavye: Boşluk / Yukarı ok aynı işi görür.
- **Işık = can + görüş:** tek sayaç `isik ∈ [0,1]`. Zamanla sızar, toz toplayınca artar, engele çarpınca düşer. `isik ≤ 0` → koşu biter. Aynı sayaç görüş yarıçapını belirler: ışık azaldıkça çevre kararır. Yarıçap adalet tabanının (3.3) altına **hiç** inmez; az ışık "kör" bırakmaz, yalnız payı daraltır.
- **Bölgeler:** her 500 puanda sıradaki bölgeye geçilir, 4 bölge döner: gece ormanı → mantar mağarası → nehir kıyısı → sisli bataklık → gece ormanı… Bölge yalnız arka planı, engel karışımını ve (bataklıkta) görüş çarpanını değiştirir; fizik aynıdır.
- **Engeller (4 tür):**
  - *Dikenli dal* — tavandan ve/veya zeminden uzanan sabit sütun.
  - *Örümcek ağı* — havada asılı sabit blok; yarım hasar verir, zinciri sıfırlar.
  - *Kuş* — sabit yükseklikte, oyuncuya doğru uçan hareketli engel.
  - *Düşen dal* — tavanda asılı; böcek yaklaşınca sallanır, sarmaşık boyu kadar düşer ve asılı kalır.
- **Işık tozu:** güvenli yol boyunca dizili küçük toplar. Işık verir, puan verir, zinciri besler.
- **Toz zinciri çarpanı:** art arda toz toplandıkça puan çarpanı ×1 → ×4. 1,5 sn toz alınmazsa ya da hasar alınırsa zincir sıfırlanır.
- **Kıvılcım (opsiyonel):** seyrek, güvenli yolun dışına konan büyük ödül (ışık + puan). Almak zorunlu değildir; alınabilir ama payı dardır.
- **Puan:** mesafe + toz + kıvılcım. Koşu sonunda puana göre jeton (bölüm 4).

---

## 2. Mimari

### 2.1 Dosyalar

| Dosya | Rol |
|---|---|
| `js/atesBocegi.js` | Çekirdek. DOM/canvas/`window` oyun nesnelerine dokunmaz. UMD: tarayıcıda `window.AtesBocegi`, Node'da `module.exports` (`tempoCekirdek.js` kalıbı). |
| `js/atesBocegiOyun.js` | Canvas çizimi, girdi, ekran, ses, kayıt ve jeton köprüsü. `window.AtesBocegiOyun`. |
| `tools/atesBocegiTest.js` | Çekirdek + ekonomi testleri. |
| `tools/atesBocegiAdaletTest.js` | Tohum × bot adalet testi. |
| `tools/atesBocegiTemaTest.js` | Tema bütünlüğü + kontrast + renk körlüğü. |

Yeni görsel/ses dosyası yok.

### 2.2 `js/atesBocegi.js` — dışa açılan API

| Ad | İmza | İş |
|---|---|---|
| `AYAR` | nesne (dondurulmuş) | Tüm sabitler (3.8). |
| `ayarDogrula` | `(ayar) → string[]` | Değişmezleri denetler (3.3 ve 3.4'teki eşitsizlikler); boş dizi = geçerli. Modül yüklenirken çağrılır, hata varsa `throw`. |
| `rngOlustur` | `(tohum) → () → [0,1)` | mulberry32. Çekirdekte `Math.random` ve `Date` **yasak**. |
| `zorluk` | `(mesafe) → {z, hiz, tAra, bosluk, sizinti}` | Zorluk eğrisi (3.6). |
| `minYaricap` | `(hiz) → sayı` | Adalet tabanı (3.3). |
| `isikYaricapi` | `(isik, hiz, bolge) → sayı` | Görüş yarıçapı (3.3). |
| `bolgeNo` | `(puan) → 0..3` | `floor(puan / 500) % 4`. |
| `carpan` | `(zincir) → sayı` | `min(4, 1 + 0.5 * floor(zincir / 5))`. |
| `ureticiOlustur` | `(tohum) → {sonraki(): dilim}` | Sıradaki engel dilimini üretir (3.4, 3.5). |
| `dilimZarfi` | `(dilim) → {ust, alt}` | Dilimin güvenli boşluğu (en kötü durum zarfına göre). Testler ve botlar bunu kullanır. |
| `oyunOlustur` | `(tohum) → durum` | Başlangıç durumu. |
| `adim` | `(durum, basili) → olay[]` | Durumu **tam bir** `DT` ilerletir. Olaylar: `toz`, `kivilcim`, `hasar`, `ag`, `bolge`, `bitti`. |
| `esikOdulu` | `(eskiRekor, puan, ayar) → {jeton, adet}` | Rekor eşiği ödülü (4.2). |
| `kosuJetonu` | `(puan, toz, gunJeton, ayar) → {jeton, ham, aktif}` | Koşu jetonu + günlük sınır (4.2). |

`durum` alanları (hepsi sayı/dizi, JSON'a çevrilebilir): `t, mesafe, puan, y, vy, isik, dokunulmaz, zincir, zincirSure, toz, bolge, bitti, dilimler[], tohum`.

Ekonomi işlevleri `// EKONOMI-BASI` … `// EKONOMI-SONU` işaretleri arasında durur (test bu bloğu ayrıca keser).

### 2.3 `js/atesBocegiOyun.js`

| Ad | İş |
|---|---|
| `start()` | Ekran açılınca çağrılır: canvas boyutla, tema oku, yeni koşu başlat. |
| `dur()` | Ekrandan çıkışta: rAF'ı durdur, sesi kes. Yarım koşu **ödeme yapmadan** atılır. |
| `temaDegisti()` | `market.js temayiYay` çağırır; paleti yeniden okur, önbellekli katmanları yeniden çizer. |
| `dongu(zaman)` | rAF. Biriktirici ile sabit adım (3.1), sonra tek çizim. |
| `ciz()` | Sıra: bölge arka planı → engeller → toz/kıvılcım → iz → böcek → karanlık katman → HUD. |
| `kosuBitti()` | Tek kez: rekor, eşik ödülü, koşu jetonu, kayıt, sonuç kartı. |
| girdi | `pointerdown/up/cancel`, `keydown/up`, `blur` → `basili`. `visibilitychange` gizliyse duraklat. |

Koşu tohumu UI'da üretilir: `(Date.now() ^ (Math.random() * 2^32)) >>> 0`. Çekirdek yalnız tohumu görür.

### 2.4 Kayıt şeması ve göç (`js/core.js`)

`ait_progress` içine yeni alan:

```js
atesBocegi: { rekor: 0, kosu: 0, gun: '', gunJeton: 0 }
```

- `rekor`: en yüksek puan. `kosu`: bitirilen koşu sayısı. `gun`: `'YYYY-AA-GG'` (yerel tarih, `market.js bugun()` ile aynı biçim). `gunJeton`: o gün koşu jetonundan ödenen **ham** toplam (4.2).
- `KAYIT_SURUM` 2 → **3**. `varsayilanIlerleme()`'ye alan eklenir.
- `gocEt` içine `if(s < 3){ … p.surum = 3; degisti = true; }`: `atesBocegi` nesne değilse varsayılanla değiştir; nesneyse eksik/bozuk alt alanları tek tek onar (`rekor`, `kosu`, `gunJeton` sonlu ve ≥ 0 sayı değilse 0; `gun` metin değilse `''`). Önceki adımlara dokunulmaz. "Daha yeni sürüm → dokunma" kuralı aynen. İdempotent.
- Yazım: `AppSaveProgress({ atesBocegi: … })`, ardından `AppGold.add(n)`. `AppGold.add` nesnenin tamamını tek `Store.set` ile yazdığı için önce bellekteki `AppProgress.atesBocegi` güncellenir, sonra `AppGold.add` çağrılır (hediye kutusundaki desen). Jeton 0 ise `AppSaveProgress` tek başına çağrılır.
- `AppReset`'e işlev eklenir: açık koşuyu atar, HUD'u sıfırlar.

### 2.5 `core.js` bağlantıları

- `OYUN_DOSYALARI.ates = ['js/atesBocegi.js', 'js/atesBocegiOyun.js']`.
- `cardAtes` tıklaması: `oyunAc('ates', () => { slideForward('home','ates'); window.AtesBocegiOyun.start(); })` (`cardTempo` satırının deseni).
- `GOLD_PILLS`'e `'goldPillAtes'`.
- Geri düğmesi `atesBackBtn` → `AtesBocegiOyun.dur()` + `slideBack`.

### 2.6 `index.html` ve `style.css`

- Ana ekran kartı, `cardSuSirala`'dan sonra: `<div class="game-card playable" id="cardAtes" role="button" tabindex="0"><div class="game-icon icon-ates">…inline SVG…</div><div class="game-label theme-ates">Ateş Böceği</div></div>`.
- Ekran `id="screen-ates"`: `kc-topbar` (geri, başlık, `goldPillAtes`), HUD satırı (puan, rekor, çarpan), `<canvas id="abTuval">`, sonuç katmanı `abSonuc` (puan, rekor, jeton dökümü, "Tekrar" ve "Ana ekran").
- Stil `style.css`'te "ATES BOCEGI" başlıklı bölümde, `.ab-` önekli. JS'e stil enjekte edilmez; canvas boyutu ve renkler hariç.

### 2.7 `sw.js`

- `OYUNLAR` listesine `js/atesBocegi.js`, `js/atesBocegiOyun.js`.
- `SURUM` '13'. Başka dosya eklenmez (görsel yok).

### 2.8 Market bağlantısı

Tema = tek ürün, bütün oyunlara uygulanır. Beşinci parça eklenir: **oyun `ates`, tür `isik`**.

- **Katalog (`js/marketKatalog.js`):** her temaya `isik` alanı. Başlık yorumundaki parça listesine şu satır eklenir: `isik : Ates Bocegi isigi, tozu, izi ve karanlik tonu`. Varsayılan temada `isik: YERLESIK`.

  ```js
  isik: { isik: '#F2C078', toz: '#FFE0A8', vurgu: '#9CCB6A', karanlik: '#120C07',
          iz: { renk: '#D99A4E', sekil: 'cizgi' } }
  // ender:    iz: { renk: '#3F9FE0', sekil: 'damla' }
  // efsanevi: iz: { renk: '#FF6A2A', renk2: '#FFD07A', sekil: 'akkor' }, animasyon: 'lav'
  ```

  `iz.sekil` yalnız şu değerleri alır: `cizgi`, `damla`, `baklava`, `akkor`.
- **Okuma:** `AppMarket.aktif('ates', 'isik')`. `aktif` türe göre önbellekler; yeni tür ek kod gerektirmez. Alan yoksa `{ yerlesik: true }` döner → oyun kendi yerleşik paletini kullanır (bölüm 5, "Varsayılan" satırı).
- **Uygulayıcı (`js/market.js`):** `isikCoz(v) → {isik, toz, vurgu, karanlik, iz, animasyon}`. Saf işlev; `yerlesik`/eksik alanı yerleşik paletle tamamlar, tanınmayan `iz.sekil` → `cizgi`. Dışa `AppMarket.isikCoz` olarak açılır. Canvas oyunu olduğu için DOM'a yazan bir `…Yaz` işlevi yoktur; `temayiYay()` sonuna `if (window.AtesBocegiOyun) window.AtesBocegiOyun.temaDegisti();` eklenir.
- **Doğrulama:** `indeksle` içindeki "yeşil hedef" kuralına dokunulmaz. `isik` eksikliği temayı devre dışı **bırakmaz** (yerleşiğe düşer); eksiksizlik testle zorlanır (8.3).
- **Envanter başlığı:** `marketEkran.js:370` "Dört oyunda birden geçerli" → "Beş oyunda birden geçerli". `market.js:226` yorumu aynı şekilde.
- **Önizleme (`js/marketEkran.js`):** `atesSahnesi(ana, tema)` eklenir ve `onizlemeKur` içinde `siseSahnesi`'nden sonra çağrılır. Çizim planı 7.6'da. `.mk-onizleme` esnek satırdır (`.mo-sahne{flex:1}`); beşinci sahne sığmazsa mevcut dört sahnenin genişliği değil, yalnız `.mo-ates` sahnesinin boyutu küçültülür.

---

## 3. Fizik ve adalet

### 3.1 Dünya ve zaman

- Mantıksal dünya: genişlik `W = 50`, yükseklik `H = 100` birim (y aşağı doğru artar). Canvas bu 1:2 oranı korur, ekrana sığdırılır, kenarlarda kalan boşluk karanlık tonla doldurulur. Oyun alanı hiçbir cihazda kırpılmaz.
- Böcek sabit `X_BOCEK = 8`'de durur; dünya sola akar. Öndeki görünür mesafe `W − X_BOCEK = 42`.
- Sabit adım `DT = 1/120` sn. Döngü: `birikim += min(kareFarki, 0.1)`; `while (birikim ≥ DT) { adim(); birikim −= DT; }`; kare başına en çok 12 adım (aşan birikim atılır). Çizim adımdan bağımsızdır; ara değerleme yok.
- Bütünleme (yarı örtük Euler): `vy += a·DT; vy = kıstır(vy, −VY_YUKARI, VY_ASAGI); y += vy·DT`.
- Tavan/zemin: `y` `[Y_UST, Y_ALT] = [4, 96]` aralığına kıstırılır, sınırda `vy = 0`. Tavana/zemine değmek hasar vermez.

### 3.2 Hareket sabitleri (başlangıç değerleri)

| Sabit | Değer | Anlam |
|---|---|---|
| `A_YUKSEL` | 260 b/sn² | Basılıyken yukarı ivme |
| `G_SUZUL` | 150 b/sn² | Bırakınca aşağı ivme |
| `VY_YUKARI` | 62 b/sn | En yüksek yükselme hızı |
| `VY_ASAGI` | 40 b/sn | En yüksek alçalma hızı (süzülme) |
| `R_GORSEL` | 2,4 | Böceğin çizim yarıçapı |
| `R_CARPMA` | 1,6 | Çarpışma yarıçapı (görselden küçük: bağışlayıcı) |
| `R_TOPLA` | 3,2 | Toz/kıvılcım toplama yarıçapı |

Çarpışma: böcek dairesi (`R_CARPMA`) ile engelin eksene hizalı dikdörtgeni.

### 3.3 Tepki süresi garantisi ve minimum ışık yarıçapı

Garanti: **hiçbir engel, böceğe ulaşmasına `T_MIN = 0,60` sn'den az kala ilk kez görünür olmaz.**

Bir engelin böceğe yaklaşma hızı en çok `hiz + KUS_EK·hiz`'dır (`KUS_EK = 0,25`; kuş dışındakiler için `hiz`). Engel ışık çemberine girdiği an görünür sayılır. Buradan:

```
minYaricap(hiz) = (1 + KUS_EK) · hiz · T_MIN + PAY_R          PAY_R = 2
isikYaricapi(isik, hiz, bolge) =
    max( minYaricap(hiz),
         (R_TABAN + (R_TAVAN − R_TABAN) · isik) · SIS[bolge] )
R_TABAN = 18, R_TAVAN = 40, SIS = [1, 1, 1, 0.85]   (yalnız bataklık kısar)
```

- `hiz = 24` → taban 20; `hiz = 44` → taban 35.
- Karanlık katmanın opaklığı çember **içinde 0**'dır; karartma `R` ile `1,25·R` arasında artar. Yani `R` içindeki her şey tam kontrastla görünür (bölüm 6 buna dayanır).
- `ayarDogrula` değişmezleri: `minYaricap(HIZ_TAVAN) ≤ R_TAVAN ≤ W − X_BOCEK − 2`. (35 ≤ 40 ≤ 40.)
- Düşen dal tetik mesafesi `hiz · (T_MIN + DUSEN_UYARI)`'dır ve `minYaricap`'tan küçüktür; dal tetiklendiğinde zaten görünürdür.

### 3.4 Üreticinin geçilebilirlik kuralı

Dünya **dilim**lerden oluşur. Her dilimde bir ya da daha çok engel ve **tam bir garantili boşluk** `[ust, alt]` vardır. Boşluk, dilimdeki bütün engellerin *en kötü durum zarfı* dışında kalır:

| Tür | Dikdörtgen | Zarf (geçilebilirlik hesabında dolu sayılan) |
|---|---|---|
| Dikenli dal | genişlik 5; tavandan `ust`'e ve/veya `alt`'tan zemine | kendisi |
| Örümcek ağı | 7 × (14…20), havada | kendisi; boşluk ağın üstünde ya da altında |
| Kuş | 5 × 3,5; sabit `y`, ek hız `KUS_EK·hiz` | `y ± 1,75` şeridi, dilim boyunca |
| Düşen dal | genişlik 5; tavandan başlar, `DUSEN_UYARI = 0,25` sn sallanır, 60 b/sn düşer, sarmaşık boyunda durur | tavandan **düşmüş** alt ucuna kadar (zamanlamadan bağımsız) |

Kurallar (üretici bunları sağlayamayan adayı atar, aynı tohum akışından yenisini çeker):

1. **Minimum boşluk:** `alt − ust ≥ bosluk(z) = 24 − 8·z` (en az 16). Serbest pay: `16 − 2·R_CARPMA = 12,8`.
2. **Ardışık engel mesafesi:** iki dilimin böceğe varış zamanları arasında en az `tAra(z) = 1,90 − 0,65·z` sn (en az 1,25). Sabit engelde `Δx = hiz · tAra`; kuşta varış zamanı `(1 + KUS_EK)·hiz` ile hesaplanır.
3. **Dikey geçiş süresi:** boşluk merkezleri `c` için
   `|c₂ − c₁| ≤ V_GUVENLI · (tAra − T_MIN − T_IVME)`, `V_GUVENLI = 28` b/sn (= 0,7 · `VY_ASAGI`, yavaş yön), `T_IVME = 0,15` sn.
   `z = 1`'de en çok 14 birim, `z = 0`'da 32 birim. Yani oyuncu engeli gördükten `T_MIN` sonra harekete geçse bile yetişir.
4. **Merkez sınırı:** `c ∈ [18, 82]`.
5. **Şerit kuralı (AFK engeli):** art arda gelen her 4 dilimden en az biri zemin şeridini (`y > 90`), en az biri tavan şeridini (`y < 10`) kapatır. Zeminde ya da tavanda bekleyen oyuncu çarpar.
6. **Toz:** iki boşluk merkezi arasında kosinüs eğrisi boyunca 3–5 toz, dikey sapma ±2. Toz hiçbir engel zarfının içine konmaz.
7. **Kıvılcım:** dilim başına olasılık `0,08`. Güvenli yoldan dikeyde 10–16 birim uzağa, engel zarfı dışına konur; ulaşmak için gereken dikey yol kural 3'ün `T_IVME`'siz hâliyle (`V_GUVENLI·(tAra − T_MIN)`) sağlanmalıdır. Sağlanmıyorsa o dilimde kıvılcım yoktur.
8. **Bölge geçişi:** puan 500'ün katını geçince sıradaki dilim boş bir "nefes" dilimidir (2 sn engel yok, toz var); arka plan bu sürede çapraz geçer.
9. **Açılış:** ilk 3 dilim sabit kolaydır: yalnız dikenli dal, boşluk 30, merkez farkı ≤ 10.

Bölge engel ağırlıkları (dal / ağ / kuş / düşen dal): orman `5/2/2/1`, mağara `6/1/0/3`, nehir `3/2/5/0`, bataklık `4/4/1/1`.

### 3.5 Tohumlu deterministik üretim

- Tek girdi 32 bit `tohum`. Üretici kendi `rngOlustur(tohum)` akışını kullanır; fizik adımı rastgele sayı **çekmez**. Böylece dünya, girdiden ve kare hızından bağımsızdır: aynı tohum → aynı dilim dizisi.
- Dilimler ihtiyaç oldukça üretilir (böceğin 2·W ilerisi), arkada kalanlar atılır.
- Zorluk yalnız `mesafe`'ye bağlıdır (puana değil), bu yüzden dilim dizisi oyuncunun toz toplamasından etkilenmez. İstisna: bölge (puana bağlı) engel **ağırlıklarını** seçer. Determinizm testi bu yüzden iki biçimde yapılır: (a) aynı tohum + aynı girdi dizisi → bayt bayt aynı durum; (b) bölge sabitlenmiş üretici → girdiden bağımsız aynı dizi.

### 3.6 Zorluk eğrisi

`d` = kat edilen mesafe (birim).

```
z(d)    = 1 − exp(−d / 9000)                        // 0 → 1, hızlı başlar, doyar
hiz(d)  = min(HIZ_TAVAN, 24 + 18·z + 2·log2(1 + d / 40000))     HIZ_TAVAN = 44
tAra    = 1,90 − 0,65·z        bosluk = 24 − 8·z        sizinti = 0,028 + 0,022·z   (1/sn)
```

İlk bölüm hız ve sıklık birlikte artar (`d ≈ 9000`'de %63, `≈ 27000`'de %95); sonrası yalnız logaritmik terimle, çok yavaş. Tavandan sonra zorluk artmaz.

### 3.7 Işık, puan

| Olay | Etki |
|---|---|
| Zaman | `isik −= sizinti · DT` |
| Toz | `isik += 0,035` (≤ 1); `puan += 2 · carpan`; `zincir += 1`; `zincirSure = 1,5` |
| Kıvılcım | `isik += 0,25`; `puan += 50 · carpan` |
| Dal / kuş / düşen dal | `isik −= 0,34`; `zincir = 0`; `dokunulmaz = 1,0` sn |
| Örümcek ağı | `isik −= 0,17`; `zincir = 0`; `dokunulmaz = 1,0` sn |
| Mesafe | her 4 birimde `puan += 1` |

`dokunulmaz > 0` iken hasar alınmaz (böcek yanıp söner). Başlangıç `isik = 1`.

### 3.8 Tek ayar nesnesi

Yukarıdaki bütün sayılar `AtesBocegi.AYAR` içinde, şu gruplarla: `dunya`, `hareket`, `adalet`, `uretici`, `zorluk`, `isik`, `puan`, `ekonomi`. Çekirdekte ve UI'da `AYAR` dışında sayısal denge sabiti bulunmaz (çizim ölçüleri hariç). `Object.freeze` ile dondurulur.

---

## 4. Ekonomi

### 4.1 Mevcut durum (koddan okundu)

| Kaynak | Kazanç |
|---|---|
| Kaçış | kalp başına 10 → bölüm başına en çok 30, yalnız rekorun üstü ödenir (250 bölüm = 7.500) |
| Sırala Dur | yıldıza göre 10/20/30, yalnız fark ödenir |
| Tempo Küp | rekor eşiği `5000·2^k`: 25, 50, 75, 100, 150, 200, 300… bir kez; tam temizlik başına 25 |
| Hedef 2048 | karo ödülü: 256→10, 512→25, 1024→60, 2048→150… |
| Günlük hediye | 150–400 |
| Hediye kutuları | oyun başına 5.200, bir kez |

Harcama: tema 800 / 1.800 / 4.000 / 8.000; Gümüş Kutu 1.000, Altın Kutu 3.500; jokerler 25–400.

Ortak ilke: ödüller ilerlemeye bağlı ve tekrarla çoğaltılamaz. Ateş Böceği sonsuz ve tekrarlanabilir olduğu için **sınırsız kaynak olmamalıdır**.

### 4.2 Öneri

```
aktif   = (toz ≥ 10) ve (puan ≥ 300)
ham     = aktif ? min(40, floor(puan / 150)) : 0
tam     = min(ham, max(0, 200 − gunJeton))            // günün ilk 200 jetonu tam
jeton   = tam + floor((ham − tam) / 4)                 // sonrası dörtte bir
gunJeton += ham                                        // gün değişince 0'lanır

esikOdulu: eşik k = 1000 · 2^k; (eskiRekor, puan] aralığındaki her eşik bir kez
           ödül = [25, 50, 75, 100, 150, 200, 300], sonrası her eşikte +100
```

Koşu sonunda ödenen = `jeton + esikOdulu.jeton`. Gün anahtarı yerel tarih; `gun` bugünden farklıysa `gunJeton = 0` yapılıp `gun` güncellenir.

### 4.3 Gerekçe

- Beklenen puan hızı ~15–23 puan/sn (mesafe 6–11, toz 9–12). Acemi koşu (45 sn) ≈ 800 puan → 5 jeton. İyi koşu (3 dk) ≈ 3.600 → 24 jeton, yani bir Kaçış bölümüne denk. Koşu tavanı 40.
- Saatte ~10 iyi koşu ≈ 240 jeton; günlük sınırla 1 saat ≈ 210, 2 saat ≈ 270. Günlük hediyeyle (150–400) aynı ölçekte. Sıradan tema (800) ≈ 4 gün; mevcut dengeyi bozmaz.
- Rekor eşikleri Tempo'nun kanıtlanmış biçimi: 16.000 puana kadar toplam 400, bir kez.
- **AFK / çiftlik engeli:** (1) şerit kuralı ve ışık sızıntısı, hiç dokunmayanı ya da sürekli basılı tutanı en geç ~36 sn'de bitirir; (2) toz güvenli yoldadır (`c ∈ [18,82]`), zeminde/tavanda bekleyen toz toplayamaz → `aktif` yanlış → 0 jeton; (3) koşu tavanı ve günlük azalan getiri, kısa koşuları tekrarlamayı kazançsız kılar; (4) yarım bırakılan koşu ödeme yapmaz.
- Bu rakamlar öneridir; uygulanmadan önce kullanıcı onayı gerekir (ekonomi sayıları).

---

## 5. Tema tasarımı

Engel rengi **bütün temalarda sabittir**: dolgu `#0B0F14`, kenar çizgisi `#E9EDF2` (1,25 px). Tema engel rengini değiştiremez.

Bölge zemin tonları (ışık çemberinin içinde görünen, tema bağımsız): orman `#24402F`, mağara `#2E2A44`, nehir `#1F3F4C`, bataklık `#3A4031`. Çember içine tema ışık rengi %12 opaklıkla bindirilir.

| Tema | Nadirlik | Böcek ışığı | Toz | İz (renk, şekil) | Karanlık katman | Vurgu |
|---|---|---|---|---|---|---|
| Varsayılan (yerleşik) | — | `#FFE27A` | `#FFF3B0` | `#FFD24A`, çizgi | `#05080D` | `#9BE86B` |
| Toprak | sıradan | `#F2C078` | `#FFE0A8` | `#D99A4E`, çizgi | `#120C07` | `#9CCB6A` |
| Buz | sıradan | `#BFE9FF` | `#E6F7FF` | `#8FD0F2`, çizgi | `#060D16` | `#7FF0D0` |
| Kumsal | sıradan | `#FFE9B8` | `#FFF4D6` | `#5CC4B4`, çizgi | `#08110F` | `#58C4B4` |
| Mürekkep | nadir | `#AEB8FF` | `#DCE1FF` | `#7C88F0`, çizgi | `#07081A` | `#7FE0C0` |
| Kiraz | nadir | `#FFB3C6` | `#FFDCE5` | `#F07A98`, çizgi | `#14060B` | `#A6E08A` |
| Sedef | nadir | `#F6E6FF` | `#FFF0FA` | `#E3A9C8`, çizgi | `#120D16` | `#9FE0D0` |
| Çini | ender | `#9FD0FF` | `#F4EEDF` | `#3F9FE0`, damla | `#06101E` | `#FFA892` |
| Vitray | ender | `#FFD36A` | `#FFE9A8` | `#E8566A` / `#5C8FE8` / `#A06AE0` dönüşümlü, baklava | `#0A0B12` | `#4FD98A` |
| Lav | efsanevi | `#FFA64A` | `#FFD98A` | `#FF6A2A` → `#FFD07A`, akkor (animasyonlu) | `#120604` | `#7CF0A0` |

Kullanım: *böcek ışığı* = böcek gövdesi parıltısı ve çember tonu; *toz* = toz topları; *vurgu* = kıvılcım, çarpan göstergesi, HUD vurgusu; *karanlık katman* = çember dışı örtü (opaklık 0,94) ve canvas kenar boşluğu.

Nadirlik derinliği:

- **Sıradan / nadir:** yalnız palet. İz düz çizgi: son 0,5 sn'nin konumları, 2 px, sona doğru saydamlaşır.
- **Ender:** palet + iz şekli. *Damla* (Çini): 6 px aralıkla lale damlası biçimli damgalar. *Baklava* (Vitray): 7 px aralıkla eşkenar dörtgen, üç renk sırayla; ince `#0E1018` kontur.
- **Efsanevi:** animasyonlu iz + parçacık. *Akkor* (Lav): genişliği 2–4 px arasında nabız atan iki renkli şerit; böcekten kopan kıvılcım parçacıkları. **Sınır: aynı anda en çok 24 parçacık**, ömür ≤ 0,6 sn, yalnız konum + opaklık. "Hareketi azalt" açıkken parçacık yok, şerit sabit genişlikte.

İz yalnız süstür: böceğin arkasında (solunda) kalır, opaklığı en çok 0,6'dır, oyun bilgisi taşımaz.

Tablodaki ışık/toz/vurgu/kenar renkleri 10 palet × 4 bölge × 3 görme biçimi için bölüm 6'daki yöntemle hesaplandı: en düşük oran 3,50, eşik altı yok.

---

## 6. Okunabilirlik kuralları

Kontrast = WCAG göreli parlaklık oranı `(L₁ + 0,05) / (L₂ + 0,05)`.

**Zemin:** `zemin(tema, bolge) = karistir(bolgeTonu, tema.isik, 0,12)` (sRGB'de alfa karışımı). Karanlık katman çember içinde 0 opaklıkta olduğu için hesap bu zemine göre yapılır.

| Kural | Çift | Eşik |
|---|---|---|
| K1 | engel kenar çizgisi `#E9EDF2` ↔ zemin | ≥ 3,0 |
| K2 | böcek ışığı ↔ zemin | ≥ 3,0 |
| K3 | toz ↔ zemin | ≥ 3,0 |
| K4 | vurgu ↔ zemin | ≥ 3,0 |
| K5 | toz ↔ engel dolgusu `#0B0F14` | ≥ 4,5 |
| K6 | HUD yazısı ↔ HUD zemini | ≥ 4,5 |

**36 kombinasyon:** `tools/atesBocegiTemaTest.js` katalogdaki 9 aktif temanın her biri × 4 bölge için K1–K5'i hesaplar (36 zemin; yerleşik paletle 40). Tek bir eşik altı → test kırmızı, tema/bölge/kural/oran yazdırılır. Düzeltme yönü: zemine dokunma; açık rengi kendi tonunda beyaza doğru kaydır (`kontrastDenetim.js --duzelt` mantığı).

**Renk körlüğü:** aynı K1–K5, renkler doğrusal RGB'de Viénot (1999) matrisleriyle dönüştürüldükten sonra yeniden hesaplanır; eşikler aynıdır.

```
protanopi   : [0.11238, 0.88762, 0] [0.11238, 0.88762, 0] [ 0.00401, −0.00401, 1]
deuteranopi : [0.29275, 0.70725, 0] [0.29275, 0.70725, 0] [−0.02234,  0.02234, 1]
```

Toplam denetim: 36 × 5 kural × 3 görme biçimi = 540 oran.

**Renge bağlı olmayan ayrım (zorunlu):** hiçbir oyun bilgisi yalnız renkle verilmez. Engel = koyu dolgu + açık kenar, köşeli. Toz = küçük dolu daire, parıltılı. Kıvılcım = dört köşeli yıldız, tozun 2 katı, dönen. Böcek = en büyük parıltı, kanatlı. Hasar = yanıp sönme + titreşim. Test, kıvılcım ile tozun çizim yarıçap oranının ≥ 1,8 olduğunu `AYAR`'dan denetler.

---

## 7. Görseller

Hepsi kodla çizilir: oyun içi canvas 2D, kart/ikon inline SVG, önizleme inline SVG + CSS. Resim dosyası eklenmez.

1. **Böcek:** gövde iki elips (baş koyu `#1A1410`, karın tema ışık rengi), iki yarı saydam kanat (basılıyken hızlı, bırakınca yavaş çırpar), karın çevresinde radyal parıltı. Hasarda 1 sn yanıp söner.
2. **Engeller** (sabit renk): *dikenli dal* — hafif eğri gövde + iki yanda üçgen dikenler, uçta budak; *örümcek ağı* — iki tutunma noktası arasında radyal + halka çizgiler (yalnız kenar rengi, dolgu %35), çarpma kutusu dış çerçevesi; *kuş* — gövde + iki kanat yayı, iki karelik çırpma; *düşen dal* — sarmaşık çizgisi + dal; uyarıda ±3° sallanır.
3. **Bölge arka planları:** her bölge 3 paralaks katmanı (0,2× / 0,5× / 1× hız), ekran dışı tuvale bir kez çizilip döşenir. Orman: gövde siluetleri, yapraklar. Mağara: sarkıt/dikit, ışıldayan mantar şapkaları. Nehir: yatay su çizgileri, sazlar, ay yansıması. Bataklık: eğri kökler, sis bantları (yatay kayan yarı saydam elipsler). Katman renkleri bölge tonunun ±%15 açık/koyu hâlleri; arka plan engel kenar renginden hiçbir zaman açık olamaz.
4. **Karanlık katman:** tam ekran tema karanlık tonu, `destination-out` radyal geçişle delinir (0 → `R`: tam şeffaf; `R` → `1,25·R`: opaklaşır).
5. **Ana ekran kartı / ikon:** `.icon-ates` içinde inline SVG: koyu yeşil-lacivert gece zemini, ortada parıltılı böcek, üç toz noktası, altta dal silueti. Diğer kartların `.game-icon` ölçüsü ve köşe yarıçapı kullanılır. `.theme-ates` etiket rengi: `#FFE27A` üzerine koyu yazı.
6. **Market canlı önizlemesi (`atesSahnesi`):** 58 × 58 px inline SVG. Zemin tema karanlık tonu; ortada ışık çemberi (orman zemini + %12 ışık tonu); böcek; arkasında tema iz şekliyle 4 damga; önünde 3 toz; sağ kenarda sabit renkli küçük dal. Efsanevi temada iz şeridine CSS `animation` (opaklık nabzı); "hareketi azalt"ta kapalı.

Performans: kare başına yeni nesne/gradyan üretilmez (gradyanlar tema ya da boyut değişince yeniden kurulur); `devicePixelRatio` en çok 2.

---

## 8. Test planı

Hepsi `node tools/….js`, `tools/odulTest.js` çıktı üslubu, hata → çıkış kodu 1.

1. **Çekirdek (`atesBocegiTest.js`):** `ayarDogrula` boş döner; bozuk ayarda hata verir. Bütünleme: basılı/bırakılmış 1 sn sonra `y`, `vy` kapalı biçim değerleriyle uyumlu, hız sınırları aşılmaz, tavan/zemin kıstırması. Aynı tohum + aynı girdi → aynı durum (10.000 adım, JSON eşitliği). Farklı kare hızı taklidi (adım sayısı aynı) → aynı sonuç. `carpan`, `bolgeNo`, zincir zaman aşımı, dokunulmazlık, ışık ≤ 0 → `bitti` tek kez.
2. **Adalet (`atesBocegiAdaletTest.js`):** **en az 1000 tohum**, tohum başına 20.000 birim mesafe.
   - Yapısal: her dilimde 3.4'ün 1–7. kuralları; her engel ilk görünür olduğunda varışa kalan süre ≥ `T_MIN`.
   - **Bot A (ideal):** sıradaki boşluk merkezini hedefler, gecikmesiz. 1000/1000 tohumda **0 çarpışma**.
   - **Bot B (gecikmeli):** engeli yalnız ışık çemberine girince görür, `T_MIN` sonra tepki verir. Işık en kötü durumda sabitlenir (`isik = 0` → yarıçap = taban). 1000/1000 tohumda **0 çarpışma**. Asıl adalet kanıtı budur.
   - **Bot C (AFK):** iki biçim — hiç basmaz / hep basılı tutar. Her tohumda ≤ 40 sn'de biter, `toz < 10`, `kosuJetonu.jeton === 0`.
   - Ek: Bot B gerçek ışıkla (sabitlenmeden) oynarken ışığı hiçbir tohumda 0,25'in altına inmez (toz dengesi yeterli).
3. **Tema / kontrast (`atesBocegiTemaTest.js`):** 9 aktif temanın hepsinde `isik` alanı tam ve biçimi geçerli (7 haneli hex, `iz.sekil` izinli kümede); efsanevi dışında `animasyon` yok; 540 oran eşik üstünde; şekil oranı kuralı; engel sabit renklerinin kodda tek yerde tanımlı olması.
4. **Kayıt göçü (`kayitGocTest.js` genişler):** sürüm 2 → 3 (alan eklenir, diğerleri aynen); sürümsüz → 3; bozuk `atesBocegi` (null, sayı, dizi, bozuk alt alanlar); sürüm 4 kaydına dokunulmaz; idempotent; sıfırlama sonrası varsayılan.
5. **Ekonomi (`atesBocegiTest.js`, EKONOMI bloğu):** tablo değerleri (puan 299/300, toz 9/10, tavan 40); günlük sınırın iki yanı (`gunJeton` 190 + ham 24 → 10 + 3); gün değişimi; `esikOdulu` (0 → 16.000 = 400; rekorun altı ödenmez; rekoru 1 puan geçmek 0); koşu bir kez ödenir.
6. **Market bütünlüğü:** `isikCoz` yerleşik/eksik/bozuk girdide tam palet döner; `aktif('ates','isik')` tema değişince yeni nesne verir; mevcut `odulTest` ve market davranışı değişmez; önizleme her tema için hatasız kurulur (sahte DOM).
7. **SW offline (`swTest.js`):** iki yeni dosya `OYUNLAR`'da; `index.html`/`core.js`'in yüklediği her dosya listede; SURUM 13.
8. Mevcut 8 paket yeşil kalır.

---

## 9. Uygulama sırası

Her aşama kendi testleri yeşil olmadan sonrakine geçilmez. Commit aşama başına; push yok.

| # | Aşama | Bitiş ölçütü |
|---|---|---|
| 1 | Çekirdek iskelet: `AYAR`, `ayarDogrula`, `rngOlustur`, `zorluk`, `minYaricap`, `isikYaricapi`, hareket `adim` (engelsiz) | Test 8.1'in fizik ve determinizm kısmı yeşil |
| 2 | Üretici: dilimler, zarf, 3.4 kuralları, toz, kıvılcım, bölge geçişi | Yapısal adalet testi 1000 tohumda yeşil |
| 3 | Çarpışma, ışık, puan, zincir, olaylar | 8.1 tamamı yeşil |
| 4 | Botlar ve adalet testi | Bot A ve B 0 çarpışma, Bot C 0 jeton; ayar değişikliği yalnız `AYAR`'da |
| 5 | Ekonomi işlevleri + kayıt göçü (`core.js` sürüm 3) | 8.4 ve 8.5 yeşil; eski kayıtlar bozulmuyor |
| 6 | UI: ekran, canvas döngüsü, girdi, HUD, sonuç kartı, yerleşik paletle çizim, ana ekran kartı, `core.js` bağlantıları | Tarayıcıda oynanır; koşu sonu jeton ve rekor kayda yazılır; geri/duraklat/sıfırla doğru |
| 7 | Market: katalogda 9 temaya `isik`, `isikCoz`, `temayiYay` kancası, iz şekilleri, lav parçacıkları, önizleme, envanter metni | 8.3 ve 8.6 yeşil; tema değişince oyun anında yeni palete geçer |
| 8 | Bölge arka planları, "hareketi azalt", ses/titreşim (`AppFX`), performans (kare başına ayırma yok) | Düşük cihaz taklidinde (CPU 4× yavaş) 60 fps; azaltılmış harekette parçacık yok |
| 9 | Yayın: `sw.js` `OYUNLAR` + SURUM 13, sürüm 1.2.0, tüm testler | 8 mevcut + 3 yeni paket yeşil; bağımsız denetim temiz |

Açık kararlar (uygulamadan önce kullanıcı onayı): bölüm 4.2'deki ekonomi rakamları; sürüm numarası 1.2.0.

---

## 10. Uygulama sapmaları (Aşama A, onaylı)

Aşağıdakiler bu dosyadaki ilgili satırların yerine geçer; sayılar `AtesBocegi.AYAR`'dadır.

- **`V_GUVENLI` 28 → 20** (3.4 kural 3). Işık 0'da yarıçap `minYaricap` olduğundan `T_MIN` gecikmeli oyuncu dünyayı yalnız ~0,23 sn önceden bilir; 28 ile Bot B çarpışıyordu. Kural 3 sınırı `z = 0`'da 23, `z = 1`'de 10 birim.
- **`DUSEN_UYARI` 0,25 → 0,15** (3.3, 3.4). 0,25 ile tetik mesafesi `hiz·(T_MIN + DUSEN_UYARI)` hiçbir hızda `minYaricap`'tan küçük değildi.
- **Kural 7 (kıvılcım):** iki boşluk arasında x'te tam ortada, yoldan 10–16 uzakta, `y ∈ [10, 90]`. Kıvılcım uzaktan görünür (`T_MIN` yok); her bacak ayrı: `|ys − c₁| ≤ V_GUVENLI·tBacak` ve `|c₂ − ys| ≤ V_GUVENLI·tBacak`, `tBacak = ((b − a)/2 − R_CARPMA) / hiz` (a = önceki dilimin arka kenarı, b = yeni dilimin ön kenarı). Sapma bu koşula sığacak şekilde 10–16 içinden çekilir.
- **Bot B (8.2) tozu da görür:** ışık çemberine giren engelden o dilimin boşluğunu, giren tozdan tozun konumunu öğrenir; ikisini `T_MIN` sonra kullanır. Ek olarak **Bot D** kıvılcımı kovalar; çarpışmasız alma oranı ≥ %95 aranır.
- **Görünen bölge:** `durum.bolge` üretici ağırlıkları içindir ve puanla hemen değişir (olay yok). Yeni alan `durum.gorunenBolge` arka plan ve `SIS` içindir; nefes dilimi böceğe varınca değişir ve `bolge` olayı o an çıkar. `isikYaricapi(isik, hiz, durum.gorunenBolge)` kullanılır.
- **API ayrıntıları:** `ureticiOlustur(tohum)` → `{veri, sonraki(bolge)}`; `durum.uretici` düz veridir (rng durumu sayı), durum JSON gidiş-dönüşünden sonra aynen sürer. Dilimde `bolge` alanı vardır. Olaylarda `toz`/`kivilcim`/`hasar`/`ag` için `x, y` vardır. Ölümcül hasar aynı adımdaki tozla iptal olmaz.

## 11. Karanlıkta Süzül iyileştirmeleri (docs/gorev-karanliktaSuzul.md, 2026-11-19)

Bu bölüm önceki bölümlerin ilgili satırlarının yerine geçer. Bütün sayılar `AtesBocegi.AYAR`'dadır; burada yazanlar başlangıç değeridir, uygulama sırasında adalet testi gereği değişirse AYAR ve bu bölüm birlikte güncellenir.

### 11.1 Hareket (süzülme hissi)
- `A_YUKSEL` 260 → **170**, `G_SUZUL` 150 → **120**, `VY_YUKARI` 62 → **40**, `VY_ASAGI` 40 → **30** (b/sn², b/sn).
- **İvme rampası:** uygulanan ivme `ay` hedef ivmeye birinci dereceden yaklaşır: `ay += (hedef − ay) · (1 − e^(−DT/T_RAMPA))`, `T_RAMPA = 0,07` sn. `ay` durumda tutulur (JSON'a çevrilebilir). Basma/bırakma anında ani ivme sıçraması olmaz.
- `V_GUVENLI` 20 kalır. `T_IVME` = duruştan `V_GUVENLI`'ye, zayıf yönde (`min(A_YUKSEL, G_SUZUL)`), rampa dahil çıkış süresi; kapalı biçim yerine gerçek bütünlemeyle sayısal hesaplanır, `ayarDogrula` bunu denetler. Başlangıç değeri **0,24** sn (eski 0,15). Kural 3 sınırı `z = 0`'da ≈ 21, `z = 1`'de ≈ 8 birim: dikey istek, yavaşlayan harekete göre kendiliğinden küçülür; adalet garantisi aynı kalır.
- *Uygulama:* sayısal çıkış süresi **0,2333** sn (`cikisSuresi(20)`, ≤ 0,24). Kural 3 sınırı `z = 0`'da **21,2**, `z = 1`'de **8,2**. Kıvılcım bacakları (kural 7, bölüm 10) `T_IVME`'siz kaldı: Bot D çarpışmasız alma oranı %95'in üstünde; `T_IVME` düşülseydi yüksek hızda hiç kıvılcım konamazdı.

### 11.2 Toplama kolaylığı
- `R_TOPLA` 3,2 → **4,2** (toz ve kıvılcım).
- **Mıknatıs (yalnız toz):** böceğe `R_MIKNATIS = 7,5` birimden yakın alınmamış toz, böceğe doğru `MIKNATIS_HIZ = 26` b/sn ile kayar (dünya koordinatında, deterministik). Değişmez: `R_MIKNATIS < MERKEZ_MIN − TOZ_SAPMA − Y_UST` (= 12); tavanda/zeminde bekleyen AFK oyuncu tozu çekemez.
- Gerekçe: yalnız yarıçap büyütmek uzaktaki tozun "dokunmadan" kaybolmasına yol açar; mıknatıs tozun böceğe aktığını gösterir, bağışlayıcılığı görünür kılar. Yarıçapı ölçülü büyütmek, mıknatısa rağmen yolu bilerek terk edenin tozu kaçırmasını korur (sarmaşık tasarımı buna dayanır).
- **Bomba ve engeller hariç:** bomba kendi görsel yarıçapıyla (`R_BOMBA`) ve böceğin `R_CARPMA`'sıyla çarpışır; mıknatıs bombayı çekmez. Engel hitbox'larına dokunulmaz.
- *Uygulama (denetim sonrası):* `MIKNATIS_HIZ` 26 → **20**; değişmez `MIKNATIS_HIZ < HIZ_TABAN` (böceğin geride bıraktığı toz böceği kovalamaz). Çekilen toz, dilimi geride kalsa da çekilmeye devam eder (dilim atlanmaz, toz havada donmaz).
- *Uygulama:* `R_BOMBA` = **1,6** (çarpma mesafesi 3,2 < `R_TOPLA` 4,2). `ayarDogrula` ek olarak `R_TOPLA ≤ R_MIKNATIS`, `R_CARPMA ≤ R_GORSEL` ve AFK'nin tavanda/zeminde kıvılcım toplayamamasını (`KIVILCIM_Y_MIN − Y_UST > R_TOPLA`) denetler.

### 11.3 Böcek görsel boyutu
- `R_GORSEL` 2,4 → **3,0** (%25). `R_CARPMA` 1,6 aynı kalır.

### 11.4 Hasarlar
| Olay | Işık kaybı |
|---|---|
| Dikenli dal (`tur: 'dal'`) | **0,50** (`DAL_HASAR`, bar kapasitesinin yarısı) |
| Kuş, düşen dal | 0,34 (`HASAR`, değişmedi) |
| Örümcek ağı | 0,17 (değişmedi) |
| Bomba | **0,25** (`BOMBA_HASAR`) |
| Sarmaşık | **0,20** (`SARMASIK_HASAR`) |

Hepsinde `zincir = 0`, `dokunulmaz = 1,0` sn.

### 11.5 Bomba
- Puan **≥ 1200**'den sonra üretilen, nefes/açılış/tozsuz/sarmaşık olmayan dilimlerde olasılık **0,20**. Toz yayının iç tozlarından birinin (ilk ve son değil) yerine konur.
- Kendi ışığıyla yanıp söner: ekrana girdiği an (`x − bx ≤ W − X_BOCEK`) görünür sayılır. Kaçış adaleti: yaydan kaçmak için gereken dikey sapma (`R_BOMBA + R_CARPMA + pay`) görünür olduktan `T_MIN` sonra, gerçek hareket fiziğiyle (duruştan, zayıf yön) yetişmiyorsa o dilime bomba konmaz.
- Görsel: tozdan farklı **şekil** (dikenli/çatlaklı koyu küre + sabit açık kenar), **sabit tehlike rengi** (tema değiştiremez), yanıp sönme ve hafif titreme, toplanınca ayrı ses. Renk körlüğünde şekille ayrışır; kontrast testi kapsar.
- *Uygulama (kaçış modeli, bkz. 11.9):* oyuncu ekrana girişten `T_MIN` sonra ve önceki dilimin arkasından (`a + R_CARPMA`) önce kaçamaz. Bomba, 11.9'daki **her olası oyuncu durumu** (yükseklik × ivme) için en az bir yana (`R_BOMBA + R_CARPMA + PAY_KACIS`, `PAY_KACIS = 0,5`) yetişilebiliyorsa ve her iki yanın kaçış seviyesinden sonraki boşluğa kural 3 hızıyla (`2·T_IVME` durup dönme payı) bağlanılabiliyorsa konur; oyuncu yanını kendi durumuna göre seçer. İç tozlar sırayla denenir. Bomba dilimlerinde kıvılcım yok. Etkin oran nominal 0,20'nin altındadır (adalet testinde bilgi satırına yazılır).

### 11.6 Tozsuz bölümler
- Puan **≥ 800**'den sonra. Bir pencere **2–3 dilim** (≈ 2,5–5,7 sn) sürer; bu dilimlerde toz ve kıvılcım yoktur. İki pencere arası en az **8 dilim**. Başlama olasılığı dilim başına `0,05 + 0,01·floor((puan − 800)/1000)`, en çok **0,10**.
- Engeller pencerede de 3.4 kurallarına uyar. Işık ekonomisi: Bot B gerçek ışıkla en az 0,25 ışıkta kalmalı (8.2 ek kuralı aynen).
- *Uygulama:* tozsuz dilimde yolu gösteren toz yoktur; ışık tabanında `T_MIN` gecikmeli oyuncu boşluğu varıştan ancak ~0,2 sn önce öğrenir ve o ana kadar bildiği son noktada bekler. Üretici her dilimden sonra bir **tutma aralığı** `[tA, tU]` izler: dilim merkezi, yayının son tozu (dilimi göremeyen oyuncu, ör. asılı düşen dal, son rehberinde bekler), tehlike kaçış seviyeleri (dilimin bandına kıstırılmış); tozsuz dilimde önceki aralıkla birleşir. Tozsuz dilimin merkezi, bu aralığın tamamı yeni boşluğun serbest bandında (`R_CARPMA + PAY_KACIS` payıyla) kalacak şekilde seçilir (kural 3'ten sıkı); uygun merkez yoksa dilim tozsuz olmaz. Bomba/sarmaşık kaçış modelinin başlangıç yüksekliği de bu aralığın tehlike ucunu hesaba katar. Uygun merkezin her zaman bulunduğunu `ayarDogrula` garanti eder (`TOZ_SAPMA` + kosinüs eğrisinin son tozdaki açığı ≤ tozsuz bandı; pencere hiç kısalmaz) ve yedek dalın da şeritle birlikte aralıkta kaldığını (`MERKEZ_MAX + TOZ_SAPMA ≤ SERIT_ALT − R_CARPMA − PAY_KACIS`, simetriği). Pencere bomba/sarmaşık diliminin hemen ardından başlamaz. Işık değişmezi: `TOZSUZ_MAX · TARA_TABAN · (SIZINTI_TABAN + SIZINTI_Z) < TOZSUZ_ISIK_MAX = 0,35` (şu an 0,285). Nefes pencereyi duraklatır (nefeste toz var). Tozsuz, bomba ve sarmaşık dilimlerinde kıvılcım olmadığı için `KIVILCIM_OLASILIK` **0,08 → 0,10** (kıvılcım oranı ≥ %3 testi).

### 11.7 Sarmaşık tuzağı
- Puan **≥ 2000**'den sonra, uygun dilimlerde olasılık **0,12**. Toz yayının iç tozlarının hizasında **2–3 sütun** (genişlik 3), yayın yakın duvarı (tavan/zemin) tarafından büyür, tozu `SARMASIK_TASMA = 1` birim geçer; o tozlar sarmaşık büyümeye başlayınca "yutulur" (toplanamaz, söner).
- Zaman çizgisi (böceğin sarmaşığın ön kenarına varışına göre): uyarı (titreşen ünlem, kendi ışığıyla görünür; ekran dışındaysa sağ kenara kıstırılır) varıştan **1,05 sn** önce başlar ve **0,70 sn** sürer (`SARMASIK_UYARI ≥ T_MIN`, değişmez); sonra **0,25 sn** büyür; büyüme başladığı andan itibaren en kötü durum zarfıyla (tam boy) çarpar.
- Değişmez: `T_MIN + T_IVME + kaçışSüresi(SARMASIK_TASMA + R_CARPMA + pay) ≤ uyarı başlangıcından varışa süre`.
- Koridor: sarmaşık zarfları + dilim engel zarfları birleşince her x'te en az bir geçilebilir koridor kalır ve bu koridor önceki/sonraki boşluğa kural 3 hızıyla bağlanır (adalet testi).
- *Uygulama sapması:* uyarı varıştan **1,26 sn** önce başlar ve **0,91 sn** sürer (önerilen 1,05 / 0,70); büyüme 0,25 sn, tam boy varıştan 0,10 sn önce. Gerekçe: değişmez en kötü başlangıçla (11.9: ters tam ivme) ve zaman payıyla uygulanınca `T_MIN + T_IVME + kacisSuresi(1 + 1,6 + 0,5; ay = −120) + PAY_KACIS_SN + DT = 0,6 + 0,24 + 0,358 + 0,05 + 0,008 = 1,257 sn`; `DT`, uyarı tetiğinin adım ayrıklığından (uyarı→varış ≥ `SARMASIK_ONCE − DT`). Uyarı tetiği dilimin hızıyla hesaplanır (sütunlara varıştaki hızdan büyük; adım başına `zorluk()` çağrısı yok). Sarmaşık adayı en çok tozu (`TOZ_MAX`) alır: sütunlar iç tozlarda, daha geç sütun seçenekleri kaçış süresini uzatır; seçilen sütun sayısı uymazsa daha az sütun denenir.
- **Uyarı görünümü (bağlayıcı, denetim K1):** faz 1'de (uyarı) UI her sütunun x aralığını ve uç yüksekliğini kendi ışığıyla **hayalet silüet** olarak, ünlemle birlikte gösterir; ekran dışındaki sütunların uç yüksekliği sağ kenarda ünlemle işaretlenir. Adalet buna dayanır: Bot B uyarı başladıktan `T_MIN` sonra yönü ve her sütunun uç yüksekliğini bilir; sütunun x'ini yalnız sütun ekrandaysa (`x − bx ≤ W − X_BOCEK`) bilir, değilse en erken varışı (`x = bx + W − X_BOCEK`) varsayar. Başka iç bilgi kullanmaz. Kaçış modeli bombadakiyle aynı (11.9), yön sabit: yakın duvarın tersi; sütun başlangıcı uygun değilse diğer iç toz başlangıçları denenir, hiçbiri uymazsa sarmaşık konmaz. Sarmaşık dilimlerinde kıvılcım yok. Sarmaşık verisi dilimde `sarmasik: {yon, x1, x2, sutunlar: [{x, y, w, h, tx, ty}], faz, sure, ilerleme}`; yutulan toz `yutuldu = 1`.

### 11.8 Çakışma kuralı
- Başlangıç puanları ayrı: tozsuz 800, bomba 1200, sarmaşık 2000.
- Puan **< 5000** iken bir sarmaşık dilimi, herhangi bir tozsuz dilimine **2 dilimden** yakın olamaz. 5000 ve sonrası birlikte gelebilir.
- Üretici artık `sonraki(bolge, puan)` alır; dilim dizisi puana bağlı eşikler yüzünden girdiye bağlı olabilir. Determinizm testi (b) bölge **ve** puan sabitlenerek yapılır.
- *Uygulama:* kural sarmaşığın üretildiği puana göre uygulanır (dilimde `puan` alanı = üretim puanı): o puan < 5000 ise sarmaşık ile herhangi bir tozsuz dilim arasında dilim numarası farkı en az `CAKISMA_ARA = 2` olur, yani **aralarında en az bir sıradan dilim** bulunur (hem sarmaşık üretilirken hem pencere başlarken denetlenir). 5000 ve sonrasında yan yana gelebilirler (fark 1).

### 11.9 Kaçış süresi yardımcısı (uygulama)
- `AtesBocegi.kacisSuresi(dy, v0, ay0)`: `adim()`'daki bütünlemenin (rampa, hız sınırı, yarı örtük Euler) aynısını **zayıf yönde** (`min(A_YUKSEL, G_SUZUL)`, `min(VY_YUKARI, VY_ASAGI)`) tam girdiyle koşturur; `ay = ay0`, `vy = v0` (kaçış yönünde işaretli, negatif = tehlikeye doğru) başlangıçtan, yer değiştirme `≥ dy` **ve** hız kaçış yönüne dönmüş olduğu ilk anı verir. `kacisMesafesi(t, v0, ay0)`: aynı benzetimle `t` sn'de alınan yol (tersi). `cikisSuresi(v)`: duruştan `v` hızına çıkış süresi (`T_IVME` denetimi; 11.1 gereği duruştan).
- Ardışık iki tehlike dilimi yoktur (bomba/sarmaşık dilimini doğrudan yeni bir bomba/sarmaşık dilimi izlemez): öncekinden dönüş hareketi tepki anında aleyhte hız bırakır, kaçış modeli bunu varsaymaz.
- En kötü başlangıç (denetim O1): tepki anında olası yükseklikler `[yA, yU]` = (yol ± `TOZ_SAPMA`) ile önceki dilimin tutma aralığının (11.6) birleşimi; ivme `[−A, +A]` (`A = min(A_YUKSEL, G_SUZUL)`); dikey hız yolun aleyhte hızı (lehteyse 0); kaçış süresine `PAY_KACIS_SN = 0,05` sn eklenir. Tek yönlü kaçış (sarmaşık): tehlikeye en yakın yükseklik ve ters tam ivme (`ay = −A`). İki yönlü kaçış (bomba): her `(y, ay)` için en az bir yan yetişmeli; sabit `ay`'da aşağı yan `y ≥ f`, yukarı yan `y ≤ g`'de yetişir, `[yA, yU]` kapsanır ⇔ `f ≤ g` ya da `yA ≥ f` ya da `yU ≤ g`; `ay` 9 noktada denenir. (Her iki yanı ayrı ayrı en kötü durumla istemek çifte sayardı: bir oyuncunun ivmesi ve konumu aynı anda iki yöne de aleyhte olamaz.) Sarmaşık ve bomba `ayarDogrula` değişmezleri de ters tam ivme ve `PAY_KACIS_SN` ile hesaplanır. Önceki dilimin zarfından önce kaçış başlamaz (ışık tabanında o dilimin bandı, örneğin asılı düşen dal, görünmeyebilir). Kanıt: Bot B (ışık 0, `T_MIN` gecikmeli) bomba ve sarmaşıkta 0 isabet.

### 11.10 Görsel (B4) ve okunabilirlik
- Kendi ışığıyla görünen öğeler (bomba, sarmaşık silüeti + ünlem, ekran dışı uç işareti) karanlık katmandan sonra ikinci geçişte (`ozIsikCiz`) çizilir.
- Tehlike renkleri sabittir (`BOMBA_*`, `UNLEM_RENK`, `SARMASIK_*`; tema değiştiremez) ve hepsi koyu dış konturla (`ENGEL_DOLGU`, en az 1 cihaz pikseli) çizilir; kontrast testi renk × kontur ≥ 3 ve kontur varlığını denetler.
- Dikenli dal ekran dışı tuvalde önbelleğe alınır (anahtar w, h, yön; en çok 24 tuval). Kare başına yol segmenti ve çizim çağrısı oyun testinde sınırlıdır.
- Uzak ateş böceği noktaları tozdan küçük ve sönük kalır (tema testi).

## 12. Karanlıkta Süzül 2. tur (docs/gorev-karanliktaSuzul2.md, 2026-11-20)

Bu bölüm 3.1'deki "Tavana/zemine değmek hasar vermez" kuralının ve 3.4 kural 5'teki AFK gerekçesinin yerine geçer. Sayılar `AtesBocegi.AYAR.hareket`'tedir.

### 12.1 Tavan sersemlemesi ve zemin ölümü

**Sabitler**

| Sabit | Değer | Anlam |
|---|---|---|
| `SERSEM_SURE` | **0,9** sn | Tavana değince girdi etkisiz kalan süre (108 adım) |
| `SERSEM_UYANMA_ORAN` | **0,25** | Uyanma yüksekliği zeminin `0,25·(Y_ALT − Y_UST)` yukarısı: `Y_UYAN = 96 − 0,25·92 = 73` birim (zeminden 23 birim yukarı) |
| `ZEMIN_KORUMA` | **0,5** sn | Uyandıktan sonra zemin ölümü kapalı (60 adım) |

Türetilen (AYAR'dan hesaplanır, `ayarDogrula` denetler): ortalama süzülme hızı `(73 − 4)/0,9 = 76,7` b/sn, en büyük 115 b/sn (eğrinin ortası); fren mesafeleri `FREN_ALT = 5,23`, `FREN_UST = 11,31` birim; uyanma düşüşü (durgun uyanıp `T_MIN` = 0,6 sn bırakılı kalan, sonra basan oyuncu) 17,90 birim, yani en alt nokta 90,9 < 96.

**Kurallar (çekirdek, `adim`)**
- *Tavan:* bütünlemeden sonra `y < Y_UST` → `y = Y_UST`, `vy = ay = 0`, `sersem = SERSEM_SURE`, olay `sersem {x, y}`. Hasar değildir: ışık cezası yok (yalnız normal sızıntı), **zincir ve zincir süresi korunur** (ceza yok denildiği için; zincir yalnız hasarla ve süre dolunca sıfırlanır), `dokunulmaz` değişmez.
- *Sersemken:* girdi okunmaz. `y`, `Y_UST`'ten `Y_UYAN`'a smoothstep eğrisiyle (`u²(3 − 2u)`, `u` = geçen/`SERSEM_SURE`) artımlı ilerler; `vy` adım farkıdır, `ay = 0`. Süre dolunca **ya da** `Y_UYAN`'a varınca (hangisi önce) `vy = ay = 0` ile durgun uyanır, `zeminKoruma = ZEMIN_KORUMA`, olay `uyandi`. Normal akışta ikisi aynı adımda olur (sersemlik hep tavanda başlar); "hangisi önce" yapay durumlar için de tanımlıdır.
- *Sersemken toplama:* toz ve kıvılcım yalnız doğrudan temasla (`R_TOPLA`) alınır, ışık normal artar; **mıknatıs kapalı** (çekme yarıçapı `R_TOPLA`'ya iner, toz kıpırdamaz; UI mıknatıs kuyruğunu çizmez).
- *Sersemken engeller:* çarpışma normal kurallarla işler (hasar, zincir sıfırı, `dokunulmaz`); sersemlik sürer. `SERSEM_SURE ≤ DOKUNULMAZ` olduğundan sersemlik başına en çok bir hasar.
- *Zemin:* `y > Y_ALT` → `y = Y_ALT`, `vy = 0`; `zeminKoruma > 0` ise yalnız kıstırılır, değilse koşu biter: `bitti = 1`, `sebep = 'zemin'`, olaylar `zemin {x, y}` + `bitti {sebep: 'zemin'}`, dünya o adımda ilerlemez, sonraki `adim` boş döner (giriş kilidi). Işıkla biten koşu `sebep = 'isik'` taşır. Koruma her adımda `DT` azalır: uyanıştan sonraki 60 adımda zemine değmek öldürmez, 61. adımda öldürür.
- *Başlangıç:* `y = Y_BASLA = 50`, `sersem = zeminKoruma = 0`, `sebep = ''`. "Dokun ve başla" öncesi UI adım atmaz; hiç basmayan oyuncu ~1,7 sn'de zemine varır (anında ölüm yok). Zeminde bekleyerek hayatta kalmak artık yok; hep basılı tutan oyuncu tavan → 73 → tavan döngüsüne girer (döngü 0,9 + 1,9 sn) ve şerit dallarıyla/ışıkla biter.
- Durum alanları `sersem`, `zeminKoruma`, `sebep` düz sayıdır/dizgedir; JSON gidiş-dönüşü sersemken ve koruma içinde aynen sürer. Kayıt (AppProgress) şeması değişmedi.

**Üretici (sapma, adalet için gerekli):** bomba ve sarmaşık kaçış seviyesi `Y` artık `[Y_UST + FREN_UST, Y_ALT − FREN_ALT] = [15,31, 90,77]` içinde olmalı (eskiden `[Y_UST, Y_ALT]`): kaçışa tam hızla varan oyuncu durana kadar tavana (sersemlik) ya da zemine (ölüm) değmesin. Bağlayan yalnız tavan yanı (yaydaki en yüksek bomba 16 → yukarı kaçış 12,3). Etki: 300 tohum × 600 dilimde bomba 8410 → 8252 (−%1,9), sarmaşık 5087 → 4985 (rng kayması).

**`ayarDogrula` değişmezleri (eski AFK varsayımlarının yerine)**
- Mıknatıs/kıvılcım: duvara değen böcek (tavanda sersemliğin başladığı adım, zeminde koruma içinde kıstırılmış) en yakın tozu çekemez, kıvılcımı toplayamaz (sayılar 11.2'deki gibi; anlam güncellendi).
- `0 < SERSEM_SURE ≤ DOKUNULMAZ`; `0 < SERSEM_UYANMA_ORAN < 1`, `Y_UST < Y_UYAN < Y_ALT`; `Y_UYAN ∈ [MERKEZ_MIN, MERKEZ_MAX]` (boşluk merkezlerinin bulunabildiği bant); `Y_UYAN + R_CARPMA < SERIT_ALT` (zemin şeridinde uyanılmaz); `0 < ZEMIN_KORUMA ≤ 1`.
- **Uyanma güvenliği:** `Y_UYAN + uyanmaDususu(T_MIN) < Y_ALT` (90,9 < 96): `T_MIN` gecikmeli oyuncu koruma olmadan da zemine değmez; koruma yalnız ek paydır.
- **Kıvılcım freni:** `Y_ALT − KIVILCIM_Y_MAX > FREN_ALT` (6 > 5,23): zemine en yakın kıvılcıma tam hızla giden oyuncu frenle zemine değmez.

**Seçimin ölçümü (SERSEM_SURE)** — Bot A (ideal) 150 tohum × 6000 birimde her 3–6 sn'de bir bilerek tavana çarptı (~3750 sersemlik/aday); sersemken girdi rastgele, uyandıktan sonra `r` sn bırakılı, sonra Bot A:

| `SERSEM_SURE` | sersemken hasar/sersemlik | uyanıştan 1,5 sn hasar (r = 0,25 / 0,6) | zemin ölümü | en az zemin payı (r = 0,25 / 0,6) |
|---|---|---|---|---|
| 0,80 | 0,31 | 0,36 / 0,45 | 0 | 6,2 / 4,84 |
| 0,85 | 0,33 | 0,35 / 0,44 | 0 | 7,9 / 4,84 |
| 0,90 | 0,35 | 0,36 / 0,43 | 0 | 6,5 / 4,84 |
| 0,95 | 0,38 | 0,35 / 0,43 | 0 | 6,6 / 4,84 |
| 1,00 | 0,37 | 0,35 / 0,44 | 0 | 7,1 / 4,84 |

Uyanış durumu (73'te durgun) süreden bağımsız olduğu için toparlanma payı ve haksız ölüm oranı (0) süreyle değişmez; süre yalnız sersemken geçilen dünyayı (`hiz·SERSEM_SURE` = 22–40 birim) ve dolayısıyla sersemken çarpma olasılığını (0,31 → 0,37) etkiler. **0,9** ortadır: efekt okunacak kadar uzun, iniş 0,8'deki 86 b/sn ortalamadan yavaş, sersemken çarpma 0,8'e göre yalnız +0,04. Koruma (0,5 sn) ölçümde hiç devreye girmedi (durgun uyanan, bırakılı kalan böcek zemine 0,95 sn'de varır); güvenlik ağıdır. Kalıcı ölçüm adalet testindeki **Bot S**'dedir (60 tohum, `T_MIN` gecikmeli uyanış: 0 zemin ölümü, en az zemin payı > 0).

**Adalet testi** — Bot A, B, B gerçek ışık, uzun A/B (1000 + 100 tohum): 0 çarpışma, 0 bomba, **0 tavan (sersemlik), 0 zemin**; Bot D (kıvılcım) 0 zemin, %100 çarpışmasız. Bot C hiç basmaz: ≤ 3 sn'de zemin ölümü (ölçülen en uzun 1,71 sn), toz < 10, jeton 0. Bot C hep basılı: ≤ 40 sn'de ışıkla biter (ölçülen en uzun 15,2 sn), sersemlik döngüsü, jeton 0. **Ölçüt sapması:** sersemken toz doğrudan temasla toplandığı için hep basılı bot 1000 tohumun 2'sinde 11–12 toz topladı (eski ölçüt toz < 10); koşu jetonu yine aktif olmaz, çünkü puan en çok 164 (`AKTIF_PUAN` = 300). C1 ölçütü bu yüzden "toz < 10" yerine "koşu jetonu aktif değil". Bot S yukarıda.

**UI (`js/atesBocegiOyun.js`)**
- Sersemlik efekti: başın üstünde soluk halka + 3 yıldız (`pal.vurgu`, temadan), yıldızlar halka üzerinde döner; arkadaki yıldız soluk. Azaltılmış harekette sabit konum, dönme yok. Tavan sesi + kısa titreşim; sersemken kanat çırpması basılı tutulsa da yavaş (girdi etkisiz görünür).
- Zemin ölümü (Mario tarzı): `bitti` olayında giriş kilitlenir (`basili` sıfırlanır; `aktifMi` zaten bitti'de girdiyi yutar), dünya donar. Böcek `ZEMIN_SICRAMA = 7` birim, `ZEMIN_SICRAMA_SN = 0,3` sn'de tepeye sıçrar ve bu sırada dikey takla atarak sırt üstü döner, sonra aynı parabolle aşağı, ekran dışına düşer (~0,84 sn); ışık çemberi böceği izler ve `ZEMIN_OLUM_SN = 1,3` sn boyunca söner. Sonra mevcut sonuç kartı ve jeton akışı aynen (ödeme ölüm anında, tek kez). Azaltılmış harekette sıçrama/düşüş yok, `SONME_AZ_SN` (0,3 sn) sade sönme.

**Sapmalar / açık noktalar**
- Görev "yavaşça aşağı süzülür" ve "0,8–1,0 sn sonra zeminin %25 yukarısında uyanır" diyor; ikisi birlikte ortalama 69–86 b/sn iniş ister (normal süzülme `VY_ASAGI = 30`). Smoothstep eğrisi başı ve sonu yumuşatır (durgun başlar, durgun uyanır) ama ortası hızlıdır; cihazda his kontrolü gerekir. Daha yavaş iniş için ya süre uzamalı ya uyanma yüksekliği yükselmeli.
- Tavana çarpmanın pratik bedeli ışık değil konumdur: 73'te uyanan oyuncu sıradaki boşluğa çoğu zaman yetişemez (ölçümde sersemlik başına toplam ~0,7 çarpma).
- Bitiş kartı başlığı zemin ölümünde de "Işık Söndü"dür (akış aynen korundu).

### 12.2 Toz deseni zorluğu

> **ESKİDİ (FAZ B, §13):** risk tozu, Bot T / Bot K ve risk testleri `docs/gorev-guncelleme-oyunlar.md` B.1 gereği tamamen kaldırıldı. Aşağıdaki metin tarihçe olarak duruyor.

Hedef: yüksek skorda "her tozu toplamaya çalışan kaybeder", güvenli yolu izleyen yaşar. Sayılar `AtesBocegi.AYAR.uretici`'dedir.

**Sabitler**

| Sabit | Değer | Anlam |
|---|---|---|
| `RISK_PUAN` | **800** | Risk tozunun başladığı üretim puanı (altında desen eskisiyle bayt bayt aynı) |
| `RISK_OLASILIK` | **0,20** | 800'de dilim başına risk tozu olasılığı |
| `RISK_ARTIS` / `RISK_ADIM` | **0,10** / **400** puan | Kademeli artış: `min(RISK_TAVAN, 0,20 + 0,10·floor((puan − 800)/400))` |
| `RISK_TAVAN` | **0,65** | Olasılık tavanı (puan ≥ 2400'de 0,60, ≥ 2800'de 0,65) |
| `RISK_DERIN` | **4** birim | Tozun dal ucundan (= güvenli boşluğun kenarı) dalın içine uzaklığı |
| `RISK_PAY` | **0,4** birim | Çarpmasız uzaklık değişmezinde `R_TOPLA`'nın üstüne pay |
| `RISK_Y_MIN` / `RISK_Y_MAX` | **12** / **88** | Risk tozunun y aralığı (tavan/zemin kuralı) |

**Yerleşim kuralı (üretici)**
- Yalnız sıradan dilimde: açılış, nefes, tozsuz (11.6), bomba (11.5) ve sarmaşık (11.7) dilimlerinde risk tozu yoktur; dilim başına en çok **bir** tane.
- Olasılık tutarsa önce son risk tozunun **ters yanı** (üst/alt dönüşümlü), o yanda dikenli dal yoksa ya da toz y aralığına sığmıyorsa diğer yan denenir. Toz o yanın **dikenli dalının** x ortasına (`dal.x + DAL_GEN/2`), dal ucundan `RISK_DERIN` içeri konur: üst dalda `y = ust − 4`, alt dalda `y = alt + 4`. Yani güvenli zarfın (`dilimZarfi`) dışında, dalın içindedir; dikenli dal hasarı (`DAL_HASAR` 0,50) alınmadan toplanamaz. Ağ, kuş ve düşen dal kullanılmaz (ağın arkası açık olabilir, kuş hareketli, düşen dal varışta henüz düşmemiş olabilir).
- Risk tozu dilimin `toz` dizisinin **sonuna** `risk: 1` alanıyla eklenir (x sırası korunur; yol tozlarında bu alan yoktur). Tutma aralığı (11.6), bomba/sarmaşık seçimi ve kaçış modeli yalnız yol tozlarını kullanır; risk tozu onlardan sonra eklenir.
- **Ayrı rng akışı:** `uretici.rs` (tohumdan türetilir) dilim başına bir çekiş yapar; ana akışın tüketimi değişmez. Sonuç: 800 öncesi üretim aynen, 800 sonrası da risk tozları çıkarılınca aynen eskisi (bkz. ölçüm). Güvenli yol üzerindeki normal tozlar olduğu gibi durur; risk tozu ekstradır.
- **Puan/ışık:** risk tozu normal toz gibi `P.TOZ · carpan`, `+0,035` ışık, zincir +1 verir; ekstra yok. Koşu tavanı 40 / günlük 200 değişmedi (ekonomi bloğuna dokunulmadı).

**Mıknatıs çözümü (ölçerek seçildi): risk tozuna mıknatıs uygulanmaz.** Risk tozu yalnız doğrudan temasla (`R_TOPLA`) alınır, çekilmez; UI mıknatıs kuyruğunu risk tozunda çizmez (çekilmeyen toza kuyruk çizilmesin; renk/şekil aynı). Ölçüm (60 tohum × 20.000 birim, Bot K = güvenli boşluğun risk tarafındaki kenarından `R_CARPMA + 0,5` geçen ideal bot):

| Seçenek | Bot A (merkez) bedava risk tozu | Bot K (kenar) bedava |
|---|---|---|
| Mıknatıs açık, `RISK_DERIN` 4 | 73 / 6323 | 61 / 6369 |
| Mıknatıs açık, `RISK_DERIN` 5–8 | 0 | 0 |
| **Mıknatıs kapalı, `RISK_DERIN` 4** | **0** | **0** |

Mıknatıs açıkken güvenceyi statik bir değişmezle vermek için tozun güvenli bölgeden `R_MIKNATIS` + çekme süresince kayma kadar uzak olması gerekir (düz kenarda `RISK_DERIN ≥ 6,4`, köşe yaklaşımında ≈ 9,4 ve üstü; çekim dinamiği ayrıca); bu derinlik dal boyunu ve uygun dilimleri çok daraltır. 5–8'de ölçülen 0 yalnız ampiriktir. Mıknatıs kapalıyken güvence statiktir:

**`ayarDogrula` değişmezleri**
- *Çarpmadan alınamaz:* çarpmayan böcek dalın x aralığındaki her adımda dal ucundan `R_CARPMA` ötededir; o adımlardan önce/sonra en dik eğimle `kE = max(VY_YUKARI, VY_ASAGI)/HIZ_TABAN = 1,667` uzaklaşabilir; adım ayrıklığı `HIZ_TAVAN·DT = 0,367` dalın yarım genişliğinden düşülür (`yarim = 2,133`). Toza bu bölgenin uzaklığı `min(RISK_DERIN + R_CARPMA, (RISK_DERIN + R_CARPMA + kE·yarim)/√(1 + kE²)) = min(5,6, 4,709) > R_TOPLA + RISK_PAY = 4,6`. (İstisna: önceki bir hasarın `DOKUNULMAZ` süresi içinde çarpma işlemez; bu durumda zaten hasar alınmıştır.)
- *Tavan/zemin:* toza tam hızla giden böcek `R_TOPLA`'da alıp frenlese de duvara değmez: `RISK_Y_MIN + R_TOPLA − FREN_UST = 4,89 > Y_UST`, `RISK_Y_MAX − R_TOPLA + FREN_ALT = 89,03 < Y_ALT`. Risk = engel hasarı; sersemlik/zemin ölümü değil.
- Olasılıklar `[0, 1]`, `RISK_OLASILIK ≤ RISK_TAVAN`, `RISK_ADIM > 0`, `RISK_DERIN > 0`, `RISK_Y_MIN < RISK_Y_MAX`.

**Adalet testi (`tools/atesBocegiAdaletTest.js`)**
- Yapısal (her koşuda, her dilim): risk tozu yalnız `RISK_PUAN` ve sonrasında, sıradan dilimde, en çok bir, dizinin sonunda; bir dikenli dalın x ortasında ve içinde, güvenli zarftan `RISK_DERIN` uzakta, y aralığında; gerçek dal geometrisiyle sayısal çarpmasız uzaklık `> R_TOPLA`. Dikkat: yapısal denetimde toz sayısı, eğri sapması ve tutma aralığı yalnız yol tozlarıyla yapılır.
- **800 öncesi aynılık:** 200 tohum × 120 dilim (puan 0–799) üretim özeti (FNV-1a, dilim JSON'u) HEAD çekirdeğiyle hesaplanan `2e61cd7b`'ye eşit; 100 tohum × 600 dilim (puan 0–8400) risk tozları çıkarılınca `6a4bf060`'a eşit (ana rng akışı bozulmadı). Bot A/B/D sonuçları değişmedi (aynı puan ortalamaları, aynı dilim/tozsuz/bomba/sarmaşık sayıları).
- **Bot T (tam toplayıcı):** Bot A gibi; sıradaki dilimde alınmamış risk tozu varsa önündeki yol tozlarını izler, yetişme payı kalmayınca risk tozunu hedefler. Işık sabit (ölüm değil hasar ölçülür). **Ölçüt (a):** üretim puanı `≥ 2400` olan dilimlerde ardışık, örtüşmeyen **7 dilimlik** pencerelerde ortalama **≥ 2 hasar**, ve dilim başına hasar seçici Bot A'nın ≥ 3 katı (mutlak fark ≥ 0,2).
- **Seçici botlar (b):** Bot A ve Bot B (gerçek ışık, `T_MIN` gecikmeli; engelin x aralığındaki tozu yol saymaz — o toz dalın içinde olduğu için ışık çemberine girdiği adımda dal da girmiştir, gizli bilgi değildir) 20.000 birimi tamamlar, 800 sonrası 0 hasar, 0 risk tozu. Mevcut 1000 tohumluk Bot A/B/Bg ve uzun koşu ölçütleri aynen geçer.
- **Bot K:** risk tozunu çarpmadan (alımdan önce 1 sn / sonra 0,5 sn içinde hasarsız) almak: 0. Bot T'nin de bedava alımı 0.
- Her toz olayının puanı (risk dahil) `P.TOZ · carpan(o anki zincir)`. Çekirdek testinde (`atesBocegiTest.js`) risk tozu ile normal tozun puan/ışık/zincir sonucu birebir aynı ve risk tozu `R_MIKNATIS` içinde kıpırdamaz.

**Ölçüm sonuçları** (Bot T/K/A: 100 tohum × 20.000 birim; gerçek ışıklı Bot T ve Bot B: bu tohumların ilk 50'si; tohumlar ana kümeden ayrı)

| Üretim puanı | Bot T dilim başına hasar | Risk tozlu dilim oranı |
|---|---|---|
| 800–1600 | 0,140 | %14,0 |
| 1600–2400 | 0,239 | %23,9 |
| 2400–3200 | 0,338 | %34,0 |
| 3200–6400 | 0,321 | %32,5 |
| ≥ 6400 | 0,348 | %35,6 |

- Etkin oran nominalin altında: tavanda nominal 0,65, gerçekleşen ≈ %33–36 (dilimlerin ~%24'ü özel — tozsuz/bomba/sarmaşık/nefes —, kalanların ~%70'inde uygun dikenli dal var). Eşik **2400** seçildi: kovalar orada doyuyor (≥ 2800'de nominal tavan).
- Bot T, puan ≥ 2400: 28.455 dilim, dilim başına **0,334** hasar; 7 dilimlik pencere ortalaması **2,34** (≥ 2 hasarlı pencere %74). Risk tozlarının %93,4'ünü aldı (10.012 / 10.718). Bot A (seçici): **0,000** (0 / 10.588 risk tozu). 6 dilimlik pencerede ortalama 2,0'a çok yakın (60 tohumda 2,01) çıktığı için sınır ölçütü 7 dilim seçildi.
- Gerçek ışıkla Bot T 50 / 50 koşuda ölür, puan medyanı **1769**; seçici Bot B gerçek ışıkla 50 / 50 tamamlar, medyan 13.832, 0 hasar, 0 risk tozu.
- Bot K: 0 / 10.561 risk tozu, 0 bedava, 0 hasar.
- Yapısal: 1000 tohumluk ana küme + uzun koşularda 392.054 risk tozu (aday sıradan dilimlerin %42,9'u), en kısa çarpmasız uzaklık **4,710** (> `R_TOPLA` 4,2; değişmezdeki alt sınır 4,709), üst 189.048 / alt 203.006, ardışık risk tozlarında yan değişimi %64 (diğer yanda dal yoksa aynı yan).
- Test süresi: adalet testi 226 → 257 sn (yeni botlar 100 tohum, gerçek ışıklılar 50).

**Sapmalar / açık noktalar**
- Görev "tozların bir kısmı risk tozu olsun" diyor; yol tozu risk tozuna **dönüştürülmedi**, risk tozu yolun üstüne **eklendi**. Gerekçe: yol tozunu çıkarmak seçici oyuncunun ışık ekonomisini (Bot B gerçek ışık ≥ 0,25) ve tutma aralığı/bomba/sarmaşık seçimini değiştirirdi; "güvenli yol üzerindeki normal tozlar devam etsin" kuralı da bunu gerektirir. Açgözlü oyuncu tozun karşılığında 0,035 ışık alıp 0,50 kaybeder ve zinciri sıfırlanır.
- "Üst/alt dönüşümlü" yalnız tercih sırasıdır; tercih edilen yanda dikenli dal yoksa aynı yan kullanılır (ölçülen değişim %64).
- Mıknatısın risk tozunu çekmemesi oyuncunun fark edebileceği bir davranış farkıdır (güvenli yoldan geçerken o toz kıpırdamaz). Renk/şekil aynı; görsel ayrım eklenmedi. Cihazda his kontrolü gerekir.
- Risk tozu yalnız dikenli dalda; ağ/kuş/düşen dal kullanılmadı (yukarıdaki gerekçe). Dokunulmazlık süresi içinde risk tozu hasarsız alınabilir (önceki hasarın bedeli zaten ödenmiştir).
- Üretim özetleri (`2e61cd7b`, `6a4bf060`) üretici bilerek değiştirilirse yeniden hesaplanmalıdır.

### 12.3 Tema görselliği

Bu bölüm 5'teki "Engel rengi bütün temalarda sabittir", "bölge zemin tonları tema bağımsız" kuralları ile 11.10'daki "Tehlike renkleri sabittir" kuralının yerine geçer. Oyun yapısı (fizik, üretim, çarpışma, ekonomi, kayıt şeması) değişmedi; yalnız renkler temadan gelir.

**Temadan gelenler (her 9 temada; `marketKatalog.js` `isik` alanı)**

| Alan | Anlam | Çizimde |
|---|---|---|
| `isik`, `toz`, `vurgu`, `karanlik`, `iz` | (bölüm 5, değişmedi) | fener, toz, kıvılcım/sersemlik, karanlık örtü, iz |
| `bolgeler` (4 hex) | orman, mağara, nehir, bataklık zemin tonu | `zemin = karistir(bolgeler[b], isik, 0,12)`; paralaks katmanları bu zeminden türer |
| `uzak` | uzak katman tonu (yerleşikte soluk mavi `#7F98C0`) | `karistir(zemin, uzak, KATMAN.uzak)` |
| `engel {dolgu, kenar}` | engel koyu dolgu + açık kenar | dikenli dal, ağ, kuş, düşen dal; bomba küresi ve tüm koyu tehlike konturları `dolgu` |
| `govde {koyu, kin, plaka, kanat}` | böcek karın/baş, kanat kını, göğüs, kanat | böcek; `bocekParlak = karistir(isik, kanat, 0,55)` |
| `halo`, `haloHalka` | böcek halesi ve ışık çemberi kenar halkası rengi / opaklığı | hale sprite'ı `halo`; karanlık geçiş bandında halka (aşağıda) |
| `tehlike {ton, bitki}` | tehlike tonlama kaynağı | bomba kenar/çekirdek ve ünlem `ton`'a %15, sarmaşık gövde/yaprak `bitki`'ye %25 karışır |

Toz çekirdeği (`BOCEK_KANAT` beyaz) her temada aynıdır; risk tozu normal tozla birebir aynı çizilir (12.2).

**Yerleşik (varsayılan) palet:** `isikCoz({yerlesik:true})` eski sabitleri birebir verir (`BOLGE_TON`, `ENGEL_*`, `BOCEK_*`, `UZAK_MAVI`; `haloHalka = 0`, tehlike tonu yok, `halo = isik`). Varsayılan temada oyun pikselleri değişmez (ölçüm: ölçüm sahnesinin 4 bölge tuvali 5a öncesiyle bayt bayt aynı). Market önizlemesinin zemini artık `karistir(karistir(bolgeler[0], siyah, 0,36), isik, 0,06)`; varsayılanda eski `#162A1E` yerine `#17291E` (1 birimlik yuvarlama farkı).

**Çözüm ve önbellek:** `market.js isikCoz` ve oyundaki `paletTamamla` aynı kuralla çözer (alan alan doğrulama; geçersiz alan yerleşiğe, `halo` yoksa temanın `isik`'ine düşer; `haloHalka ∈ [0, 0,3]`). `renkCoz(pal)` engel/gövde/tehlike çizim renklerini (`rk`) **tema değişince bir kez** `gorselKur`'da hesaplar; bölge katmanları, bomba sprite'ları, hale ve halo gradyanı aynı anda yeniden kurulur, dal sprite önbelleği temizlenir. Kare başına karışım hesabı, yeni gradyan ya da nesne yok (oyun testi denetler).

**Halo halkası:** karanlık deliğinden sonra aynı dönüşümle tek `fillRect`: radyal gradyan `R`'de saydam, `HALO_TEPE = 1,07·R`'de `haloHalka`, `1,25·R`'de saydam. Çemberin içine girmez, dolayısıyla çember içindeki kontrastı etkilemez; sönmede ışıkla birlikte solar.

**Silüet dili sabit:** bomba (8 dikenli koyu küre + açık kenar + nabızlı çekirdek + dişli hale), dikenli dal (kabuk, eğri dikenler, budak), sarmaşık (koyu dış çizgili kıvrık gövde + yapraklar + filiz, kesik çizgili hayalet silüet, üçgen ünlem) şekil ve kontur kalınlıkları değişmedi. Tehlike renk ailesi testle korunur: tonlama oranları ≤ 0,25, tonlu renk taban renge CIEDE2000 ≤ 12 ve ton açısı farkı ≤ 25°.

**Palet kuralları (`tools/atesBocegiTemaTest.js`, 3 görme biçimi: normal, protanopi, deuteranopi)**
- K1–K5 (bölüm 6) her temanın **kendi** bölge tonu ve engel renkleriyle: 9 tema × 4 bölge × 5 kural × 3 = 540 oran + yerleşik 60. En düşük 3,74.
- Paralaks katmanları (koyu, açık, uzak, yakın, mantar, ay, sis) temanın kenarından koyu, kenar ve tozla ≥ 3,0; uzak nokta tozdan belirgin sönük.
- Böcek: fener (`isik`) / `govde.koyu` ≥ 3,0, `govde.kanat` / zemin ≥ 3,0, `govde.koyu` her bölge zemininden koyu.
- Tehlike (temadan tonlu 5 renk × 10 palet × 4 bölge × 3): zemine ≥ 3,0 (600 oran); koyu kontur (`engel.dolgu`) ile ≥ 3,0; bomba kenarı/çekirdeği toz ile parlaklık oranı ≥ 1,5 / 1,4; sarmaşık silüet çizgisi / koyu alt çizgi (alfa dahil) ≥ 3,0.
- Bölge kimliği: her temada 4 bölge tonu birbirinden CIEDE2000 ≥ 5 (en düşük 5,18). Kimliği asıl taşıyan katman şekilleridir (orman gövdeleri ve eğreltiler, sarkıt/dikit ve mantarlar, ay/tepeler/sazlar, ölü ağaçlar ve sis).
- Kapsam denetimi: her temanın bölge/engel/gövde/uzak/tehlike değerleri yerleşikten farklı; bozuk palet (kenar = bölge tonu, toz = dolgu, bölge = ışık) kontrast hesabında yakalanır (negatif kontrol); oyun testinde tema karesinde yerleşik engel/tehlike renkleri hiç kullanılmaz ve tema değişince dal sprite'ı yeni renklerle yeniden çizilir.
- Bölge tonları önce temanın kimliğine göre seçildi, sonra tüm kurallar ≥ 3,1 payla geçene dek siyaha doğru koyulaştırıldı (en çok %20; protanopide bomba turuncusu bağlayıcı).

**Temalar arası renk uzaklığı (ölçüm yöntemi)** — `tools/atesBocegiTemaYakala.js` gerçek `index` betiklerini (katalog, market, çekirdek, `atesBocegiOyun.js`) headless Chrome'da açar; sabit tohum, azaltılmış hareket (animasyon yok), aynı yapay sahne: üst/alt dikenli dal, ağ, kuş, düşen dal, bomba, büyümüş sarmaşık, uyarı fazında sarmaşık (ünlem + silüet), 4 toz, kıvılcım, böcek (ışık 1). Tuval 300 × 600 px (dünya ölçeği 6, dpr 1), 10 palet (9 tema + varsayılan) × 4 bölge = 40 görüntü.
- Uzaklık: görüntü 4 × 4 px bloklara bölünür, bloklar doğrusal RGB'de ortalanır, CIELAB'a (D65) çevrilir; iki temanın **aynı konumdaki** blokları arasında CIEDE2000, tüm blokların ortalaması; çift değeri 4 bölgenin ortalaması (45 çift).
- Gerekçe: sahne geometrisi her temada aynı olduğundan piksel bazlı fark yalnız rengi ölçer (histogram uzaklığı konumu yok sayar, ortalama renk zıt değişimleri birbirine götürür). CIEDE2000, karanlık ve doygun tonlarda CIE76'dan daha algısaldır. Blok ortalaması kenar yumuşatma gürültüsünü ve ince çizgi titreşimini bastırır. Karanlık örtü (çember dışı) dahildir: oyuncunun gördüğü karenin tamamı.
- CIEDE2000 uygulaması Sharma (2005) referans çiftleriyle sınanır (±0,0001).

| Ölçüm | En düşük çift | Çiftlerin ortalaması |
|---|---|---|
| Taban (5a öncesi kod) | varsayılan / vitray **1,42** | 5,97 |
| 5b (ışık, halo, gövde) | buz / çini 2,78 | 7,48 |
| 5c (bölge paletleri) | buz / çini 7,47 | 16,14 |
| **Son (5d, engeller)** | buz / çini **7,61** | **16,51** |

Sonraki en yakın çiftler: mürekkep/sedef 9,26, varsayılan/kumsal 9,37. **Sınır: her çift ΔE00 ≥ 6,0** (testte `DE_SINIR`): tabanın en düşüğünün ~4 katı ve taban ortalamasının üstü; en düşük ölçülen çiftin %21 altında pay (Chrome sürümü / yazılım çiziminden gelebilecek küçük sapmalar için). Ayrıca her temada 4 bölge görüntüsü birbirinden farklı olmalı (sahnenin gerçekten bölgeye göre çizildiğinin denetimi; en az 4,23).

**Bölge tonları**

| Tema | Orman | Mağara | Nehir | Bataklık | Engel dolgu / kenar | Halo (halka) |
|---|---|---|---|---|---|---|
| Varsayılan | `#24402F` | `#2E2A44` | `#1F3F4C` | `#3A4031` | `#0B0F14` / `#E9EDF2` | `#FFE27A` (0) |
| Toprak | `#3A3A1C` | `#46281C` | `#2A3A30` | `#493919` | `#150D07` / `#F3E3CC` | `#E8A050` (0,16) |
| Buz | `#26383C` | `#30344A` | `#1D3846` | `#34363F` | `#07101A` / `#E2F4FF` | `#8FD8FF` (0,16) |
| Kumsal | `#123B44` | `#283847` | `#003D33` | `#3E3825` | `#09130F` / `#F5ECD8` | `#5CC4B4` (0,16) |
| Mürekkep | `#163A48` | `#30225A` | `#1E2858` | `#383048` | `#090A1E` / `#E4E6FF` | `#7C88F0` (0,18) |
| Kiraz | `#3C2430` | `#48203E` | `#2E2840` | `#46282A` | `#16080E` / `#FFE4EC` | `#FF8FB0` (0,16) |
| Sedef | `#353746` | `#413452` | `#2A384B` | `#3D373E` | `#130E18` / `#F7EEFF` | `#E3B8FF` (0,14) |
| Çini | `#093A33` | `#1C2A66` | `#083657` | `#2A392A` | `#06122A` / `#F4EEDF` | `#3F9FE0` (0,18) |
| Vitray | `#0A3E25` | `#3E1660` | `#0E2A6E` | `#56301A` | `#0E1018` / `#FFE7A8` | `#C080FF` (0,18) |
| Lav | `#3A1C10` | `#46141A` | `#2E2020` | `#4A2C0E` | `#140604` / `#FFDCC0` | `#FF6A2A` (0,20) |

**Market önizlemesi:** zemin (orman tonu), böcek gövdesi ve dal dolgu/kenarı (`style` özniteliği; CSS sınıfı yerleşik değerleri taşımaya devam eder) temadan. Aşama 1 düzeltmesi korundu: CSS zemin `#05080D`, SVG zemin `rect`'i yok; normal ve otomatik karanlık modda kart köşe/kenar testi geçer.

**Sapmalar / açık noktalar**
- Tehlike renkleri yalnız %15 (bomba, ünlem) / %25 (sarmaşık) tonlanır; protanopide bomba turuncusunun zemine ≥ 3,0 kalması daha güçlü tonlamaya izin vermedi. Tema hissi tehlikede çoğunlukla koyu küre/kontur (`engel.dolgu`) ve dişli halenin tonundan gelir.
- Lav, Toprak gibi sıcak temalarda bomba halesi zeminle aynı renk ailesindedir; ayrım koyu dikenli küre + açık kenar + nabızla sağlanır (kontrast testleri geçer). Cihazda göz kontrolü önerilir.
- En yakın çift buz/çini (7,61): ikisi de mavi aileden (buz soluk gri-mavi, çini doygun kobalt/turkuaz). Sınırın üstünde ama en zayıf ayrım budur.
- `tools/atesBocegiTemaTest.js` birkaç saniye uzadı (40 görüntü + CIEDE2000; toplam ~16 sn).

---

## 13. FAZ B: zorluk güncellemesi (docs/gorev-guncelleme-oyunlar.md, 2026-11-24)

Kararlar (kullanıcı, koordinatör aracılığıyla): eşik birimi mesafe; ekranda "Bölge N", kodda `kademe`; salınan engel boşluğun dışında; hasar `I.HASAR`; risk tozu silinir; ulaşılabilirlik tam bilgili oyuncunun kinematik yetişmesi; yazı yalnız 2-5; `HIZ_TAVAN` 44; ayarlar `AYAR.zorluk`'ta (yeni dosya yok). Bütün sayılar `AtesBocegi.AYAR.zorluk`'ta.

### 13.1 Kademe (ekranda "Bölge N")
| Sabit | Değer | Anlam |
|---|---|---|
| `KADEME` | **[0, 500, 1600, 2800, 4000]** birim | Böceğin mesafesi; dilimin kademesi varış mesafesinden (`x − X_BOCEK`) |

- Yeni rampayla varış süreleri 0 / 20,4 / 60,8 / 98,6 / 131,7 sn. Bot B gerçek ışıkla eşiklere varış (medyan): tozsuz 800 puan ≈ 964 birim, bomba 1200 ≈ 1421, sarmaşık 2000 ≈ 2536. Bölge 3 bombadan, Bölge 4 sarmaşıktan sonra gelir.
- Mevcut puan eşikleri (tozsuz 800, bomba 1200, sarmaşık 2000, çakışma 5000) ve görsel biyom (`bolge`, 500 puanda bir, nefes dilimi, arpej sesi) değişmedi.
- Çekirdek her eşikte bir kez `{tur: 'kademe', kademe}` olayı üretir (durumda `kademe`). Arayüz `#abBolge`'de "Bölge N" yazar: 1,5 sn, kendiliğinden kaybolur, ses yok, oyunu durdurmaz; yeni koşu ve çıkış gizler. 5'ten sonra olay yok.

### 13.2 Hız ve tükeniş rampası
`r = kıstır((mesafe − 500) / (RAMPA_SON − 500), 0, 1)`; `hiz = min(44, eski + HIZ_EK·r)`, `sizinti = min(SIZINTI_TAVAN, eski + SIZINTI_EK·r)`.

| Sabit | Değer |
|---|---|
| `HIZ_EK` / `RAMPA_SON` | 10 / 5000 birim |
| `SIZINTI_EK` / `SIZINTI_TAVAN` | 0,012 / 0,06 |
| `HIZ_TAVAN` | 44 (değişmedi) |

| Mesafe | 500 | 1600 | 2800 | 4000 | 5000 | 8000 | 20000 |
|---|---|---|---|---|---|---|---|
| Hız (eski) | 25,01 (aynı) | 27,04 | 29,01 | 30,73 | 32,01 | 35,13 | 41,22 |
| Hız (yeni) | 25,01 | 29,49 | 34,12 | 38,51 | 42,01 | 44 | 44 |
| Sızıntı (yeni) | 0,0292 | 0,0345 | 0,0400 | 0,0452 | 0,0494 | 0,0530 | 0,0596 |

- Hız 41'e 4707 birimde, tavan 44'e 6803 birimde ulaşır (1 birim adımla ölçüldü; eski eğride 44'e ~60000'de).
- Kademe 1'de (mesafe ≤ 500) hız ve sızıntı eski formülle bit bit aynı (test).
- `tAra` ve `bosluk` eski `z` eğrisinde kalır. Aralık `hiz·tAra` birim olduğu için bütün adalet süreleri saniye cinsinden ölçeklenir. Üst hızda: `T_MIN` 0,6 sn (ışık yarıçapı tabanı `minYaricap(44)` = 35), varışlar arası en az `tAra` 1,25 sn, en küçük geçit `bosluk` 16 birim (serbest 12,8), dikey geçiş en çok 8,2 birim.
- Tozsuz pencere değişmezine rampa terimi eklendi: `3 · 1,9 · min(0,06, 0,05 + 0,012) = 0,342 < 0,35`.
- Açılış dilimlerinin merkez farkı `min(ACILIS_FARK, maxDc)` ile sınırlandı. Mesafe 0'da eskisiyle aynıdır; yalnız yüksek hızda başlatılan test koşusunda kısılır.

### 13.3 Salınan engel (Bölge 3+): ipe asılı örümcek
| Sabit | Değer |
|---|---|
| `SAL_GEN` × `SAL_BOY` | 5 × 5–8 (çarpma kutusu yalnız gövde; ip yalnız görsel) |
| `SAL_GENLIK` | 2 → 5 birim (kademe 3 başından 5 başına doğrusal) |
| `SAL_PERIYOT` | 2,4 → 1,4 sn (tepe dikey hız 5,2 → 22,4 b/sn < 30) |
| `SAL_AGIRLIK` | kademe 1–5: 0 / 0 / 2 / 3 / 5 (biyom satırına 5. ağırlık) |
| `SAL_KENAR` | 2 |

- `y = yc + gen·sin(om·d.t + faz)`. `d.t` ikinci şans geri sayımında donuktur.
- Süpürülen zarf `[yc − gen, yc + gen + h]` boşluğun bir yanındadır ve uç noktada boşluk kenarına değer. Bu yüzden her fazda geçit = `bosluk(z)` ≥ 16. Adalet testi 64 fazda ölçer.
- Ağ gibi karşı yana ek dal (`EK_DAL`) alabilir. Hasar `I.HASAR` 0,34; sersemletme, dokunulmazlık ve ışık sönmesi mevcut kurallarla aynı.
- Kademe 1–2 için 4 elemanlı biyom satırı kullanılır: rastgele sayı tüketimi ve seçim eskisiyle aynıdır.

### 13.4 Düzensiz ışık (Bölge 4+)
`j = kıstır((mesafe − 2800) / (4000 − 2800), 0, 1)`; açılış, nefes, tozsuz, bomba ve sarmaşık dilimlerine uygulanmaz.

| Sabit | Değer | Anlam |
|---|---|---|
| `DAG_Y` | 3 | y kayması ±3·j (yay sapması ±2'nin üstüne) |
| `DAG_X` | 0,35 | x kayması ± 0,35·j·toz aralığı |
| `DAG_ATLA` | 0,25 | toz düşme olasılığı 0,25·j (en az 2 toz kalır) |
| `DAG_BOSLUK` | 0,34 | ardışık iki toz düşmez; düşmede komşu noktalar arası ≤ yayın 0,34'ü |
| `ISIK_MARJ` | 5,8 | `R_CARPMA + R_TOPLA`; doğumda ışık–engel zarfı uzaklığı alt sınırı |

- Yayın son tozu kaymaz. Böylece tutma aralığı (11.6) ve tozsuz değişmezi aynı kalır.
- Kinematik ulaşılabilirlik (`ulasimSiniri`): oyuncu önceki boşluğun merkezinden (x = a + R_CARPMA, durgun) tam girdiyle tozun `R_TOPLA`'sına varır, durup döner (2·`T_IVME`) ve sonraki boşluğun serbest bandına b − R_CARPMA'da varır. Toz `KIVILCIM_Y` bandında olmalıdır. Kayan toz bu aralığa ve x'te `[a + ISIK_MARJ, b − ISIK_MARJ]`'a kıstırılır; aralık boşsa toz kaymaz. HEAD'deki mevcut yay tozları bu kurala 0 ihlalle uyuyor (en az pay 2,24; x marjı en az 6,52).
- **Sapma (ölçümle):** görevdeki "Bölge 5 tam dağınık" hedefi kısıldı. Işık 0'da `T_MIN` gecikmeli oyuncu (Bot B) sonraki boşluğu yalnız toz yolundan erken öğrenir (ışık yarıçapı tabanı yalnız ~0,2 sn bilgi payı bırakır). Ölçümler:
  - y kayması (40 tohum): `DAG_Y` 3'te 0 hasar, 4'te 2, 10'da onlarca.
  - Sınırsız düşmede (1000 tohum) Bot B ışık 0'da 15, gerçek ışıkta 6 tohumda çarptı. `DAG_BOSLUK` sonrası 0.
  - Kontrol: kıstırma açık + `DAG_Y` 15'te yapısal ulaşılabilirlik geçiyor, ama Bot B çarpıyor.
- B.1: ışıkların yerleşimi x'te engellerden ayrıktır (tozlar önceki dilim arkası ile bu dilim önü arasında). Sarmaşığın sütun hizasındaki tozları sonradan yutması bu kurala istisnadır: doğumda sütun yoktur. Test bu tozları ayrı sayar.

### 13.5 Risk tozu kaldırıldı
- Silinenler: `RISK_*` sabitleri ve değişmezleri, `riskSec`, ayrı rng akışı (`rs`, `riskYan`), mıknatıs istisnası, UI kuyruk istisnası.
- Testlerden silinenler: Bot T, Bot K, risk koşuları ve 8 adalet testi; çekirdekte 4 test; hash `2e61cd7b` / `6a4bf060`.
- Yerine eklenen test: Bölge 2 öncesi (varış ≤ 500) üretim, risk tozu çıkarılmış HEAD (32f4eef) üretimiyle bayt bayt aynı (300 tohum, 3000 dilim, özet `c40d01b6`).

### 13.6 İkinci şans
`dogmaSec`, varışı `TEMIZ_SN + tAra`'dan erken olabilecek her dilimin salınanını da siler. Varış süresinin alt sınırı `(s.x − bx) / s.hiz`'dir (hız mesafeyle azalmaz). Test gerçek ilerlemeyle ölçer: en yakın salınanın varışı ≥ `TEMIZ_SN + tAra` (kademe 3–5'te 62 salınanlı ölüm, en az pay 0,385 sn).

### 13.7 Test kancası
`oyunOlustur(tohum, {mesafe, puan})` koşuyu o mesafe ve puanla başlatır: ilk 3 dilim açılış dilimidir; kademe, biyom ve eşik puanı buna göre kurulur. Arayüz bunu kullanmaz; üretimde URL parametresi yoktur. Headless test (`tools/atesBocegiBolgeTest.js`) sayfaya eklediği sarmalayıcıyla bu kancayı kullanır.

### 13.8 Açık noktalar
- (Çözüldü, §13.9) Bomba yüksek hızda yerleşemiyordu: kaçış modeli bombayı yalnız 42 birimlik en dar ekrana girince görünür sayıyordu; hız 41'i (4707 birim) aşınca hiçbir aday geçmiyordu (HEAD'de 20000+ birimde). Ön işaret eklendi.
- Bölge yazısı ile biyom geçişi farklı anlarda gelir (biri mesafe, öteki puan).

### 13.9 Bomba ön işareti (kullanıcı kararı, denetim sonrası)
- `AYAR.uretici.BOMBA_ON_ISARET` = **6** birim. Bomba en dar ekrana (`W − X_BOCEK` = 42 birim önde) girmeden 6 birim önce, oyun dünyasının sağ kenarında bombanın y'sinde kendi ışığıyla (karanlık katmanın üstünde) bir ön işaret belirir: sola bakan bomba kenar renkli ok + bomba çekirdek renkli nokta, koyu kontur (engel dolgusu, ≥ 1 cihaz pikseli). Azaltılmış harekette yanıp sönmez. Bomba ekranda göründüğü (geniş ekranda `GW ≥ W + 6`) her durumda işaret çizilmez.
- Kaçış modeli (`bombaSec`) ve adalet testi görünürlüğü işaretten sayar (`xGor = bomba.x − (W − X_BOCEK) − 6`). Tam adalet testinde bomba görünür → çarpma en kısa süresi raporlanır (≥ `T_MIN`).
- `ayarDogrula` değişmezi üretecin ölçütüyle (`ikiYonUygun`, `f ≤ g` dalı) kurulur. `HIZ_TAVAN`'da, `T = (W − X_BOCEK + 6 − R_BOMBA − R_CARPMA) / 44 − T_MIN − PAY_KACIS_SN` = 0,368 sn. Ivme ızgarasının (9 nokta, [−A, +A]) her `ay`'ı için aşağı yanın `ay` ile ve yukarı yanın `−ay` ile T'de aldığı yolların toplamı ≥ `2·(R_BOMBA + R_CARPMA + PAY_KACIS)` olmalı. En kötüsü 10,86 ≥ 7,40. Hız sınırı yüzünden toplam `ay ≠ 0`'da `ay = 0`'dakinden küçük olabilir; yalnız `ay = 0` denetimi yetmez (sınır örneği: ON 3,2 + PAY_KACIS 0,45). `BOMBA_ON_ISARET` 0 iken değişmez kırılır.
- Adalet testi bomba görünür → çarpma süresini `T_MIN + kaçış(durgun, ivme 0) + PAY_KACIS_SN` = 0,958 sn ile sınar; testteki görünürlük sabiti 48 birim AYAR'dan türetilmez, eşitliği ayrı denetlenir.
- Bomba oranı (puan ≈ 0,75·mesafe, bomba eşiği geçilmiş dilimler; 150 tohum):

| Mesafe | HEAD | Yeni |
|---|---|---|
| 0–2000 | %16,8 | %16,7 |
| 2000–4000 | %12,6 | %12,5 |
| 4000–6000 | %11,4 | %12,0 |
| 6000–8000 | %10,8 | %11,2 |
| 8000–12000 | %10,9 | %11,6 |
| 12000–20000 | %6,2 | %10,8 |
| 20000–60000 | %0,0 | %9,6 |

- Ulaşılabilirlik bağımsız benzetimle denetlenir (adalet testi; çekirdeğin kaçış işlevlerini kullanmayan, `adim()` ile aynı bütünlemeli frenli bang-bang oyuncu). Eski `isikUlasir` (yalnız testte kullanılan totoloji) kaldırıldı.
- Alt yandaki (zemin tarafı) örümcek ipsiz çizilir; üst yandaki tavandan ipe asılıdır.
