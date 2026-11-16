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
