// suSiralaCozTest.js — Su Sirala normal modun 250 bolumunu dogrular.
// Calistirma:  node tools/suSiralaCozTest.js        (hata varsa cikis kodu 1)
//
// OLCUTLER
// 1) Gecerlilik: sise sayisi = renk + bos (en fazla 12), her rengin birim sayisi
//    o rengin ev sisesinin kapasitesine esit, hicbir sise tasmiyor, bos siseler
//    en buyuk kapasitede, perde yalniz dolu sisede ve ust katman acik,
//    baslangicta hazir renk yok (bedavaMi).
// 2) Tam bilgiyle cozulebilirlik: A* + kabul edilebilir alt sinir (suSiralaUret.altSinir)
//    EN KISA cozumu bulur. Yol oyundaki (perdeli) tahtada hamleGecerliMi/hamleUygula
//    ile oynatilip kazanildiMi ile dogrulanir.
//    1-100: en kisa <= cozumHamle (3 yildiz imkanli). 101-250: cozumHamle =
//    ceil(1.3 x en kisa) (suSiralaUret.butce); boylece en kisa <= cozumHamle, 3 yildiz imkanli.
//    Pencere ve egri kontrolleri en kisa cozum uzerinden yapilir.
// 3) Bilgisiz oyuncu (perdeli her bolum): suSiralaUret.bilgisizBot. Bot yalniz
//    gorunen katmanlari, sise kapasitelerini, perde acildikca gordugu renkleri
//    (Bastan basla sonrasinda da hatirlar), oyunun reddettigi hamleleri ve
//    "bitmedi" bilgisini kullanir; perdeli hucreleri bunlarla celismeyen rastgele
//    bir hipotezle doldurup planlar, celiski gorunce yeniden planlar. Gercek
//    tahtanin gizli katmanina hic bakmaz, joker kullanmaz.
//    Bir deneme = bot, en fazla AYAR.BOT_BASTAN (3) kez "Bastan basla" yaparak bitirir.
//    Uretici adaylari AYAR.BOT_TOHUMLARI (1-48) ile eler (hepsi gecmeli, en fazla
//    AYAR.BOT_SON_DENEME (6) tanesi son denemeye kalabilir). Test, uretimde
//    HIC kullanilmayan AYRI kume AYAR.TEST_BOT_TOHUMLARI (101-110) ile olcer; boylece
//    tohum secimi bota asiri uyum saglamissa ortaya cikar.
//    OLCUT: her perdeli bolumde (1-250) 10 test tohumundan en fazla 1 basarisiz;
//    101-250 toplaminda basarisiz oran <= %1.
//    NOT: bu bir bot olcutudur, mantiksal kanit degildir. "Bilgisiz oyuncu her zaman
//    bitirir" demez; makul bir gorunen-bilgi stratejisinin, ezberlenmemis rastgelelikle
//    de bitirebildigini gosterir. Tam bilgiyle cozulebilirlik (2) ayrica kanitlidir;
//    tahta deterministik ve "Bastan basla" ucretsiz oldugundan bilgi her denemede birikir.
//    Bot sinirlari (dugum/hamle/plan) yalniz botu zayiflatir; olcutu gevsetmez.
// 4) 1-100 degismedi: profil ciktisi, tablo kayitlari ve kurulan tahtalar
//    (tup, kap, perde, yildiz butcesi) degisiklik oncesi alinan sha256 ozetleriyle ayni.
// 5) 101-250 tur dagilimi: her 10'lukta temel, boyut, karanlik var; temel 90 (%60);
//    her 25'likte her turden en az 1, duz disindakilerden en az 3.
// 6) Egri: renk ve perde sayisi azalmaz, bir adimda en fazla 1 artar; tuzak bandi
//    azalmaz; 10'luk cozum ortalamalari arasinda en fazla 3 hamle fark (100/101 siniri dahil).
// tuzakOrani pahali oldugu icin yeniden olculmez; 101-250'de profil bandinda mi bakilir.
'use strict';
const crypto = require('crypto'), assert = require('assert');
const U = require('./suSiralaUret');
const { S, T } = U.yukle();

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}
const ozet = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bas = Date.now();

const bolumler = [];
for (let n = 1; n <= 250; n++) bolumler.push(S.bolumUret(n));
const ileri = bolumler.slice(100);

// ---- 4) 1-100 degismedi ----
console.log('1-100 degismedi');
dene('profil ozeti', () => {
  const p = [];
  for (let n = 1; n <= 100; n++) p.push(S.bolumProfili(n));
  assert.strictEqual(ozet(p), '8d54a59ecfd311ef5926ec73f3074524c2d2a4bdd7d89dd563cb3a1ad9bbe4e0');
});
dene('tablo kayitlari ozeti', () =>
  assert.strictEqual(ozet(T.slice(0, 100)), '93f28b425c3776bc606e851ea63ab62b3300629af77b6c84abb2eecd8c4df98b'));
dene('kurulan tahtalar ozeti', () => {
  const b = bolumler.slice(0, 100).map(x => [x.tupler, x.kaplar, x.gizli, x.yildizButce]);
  assert.strictEqual(ozet(b), '3609906fd31895ce4699378441acf99ce79bc9c1a3dccc1b86c8d7c3566cc95a');
});

// ---- 1) gecerlilik ----
console.log('Gecerlilik');
dene('tablo 250 kayit, bicim [tohum, tuzak, cozum]', () => {
  assert.strictEqual(T.length, 250);
  T.forEach((k, i) => assert.ok(k.length === 3 && k.every(Number.isInteger) && k[0] >= 0 && k[2] > 0, 'kayit ' + (i + 1)));
});
dene('250 tahta kurallara uygun', () => {
  const hata = [];
  bolumler.forEach(B => {
    const p = B.profil, n = B.bolumNo, say = {};
    const enBuyuk = Math.max.apply(null, B.kaplar);
    let ok = B.tupler.length === p.renk + p.bos && B.tupler.length <= 12 && !S.bedavaMi(B);
    B.tupler.forEach((t, i) => {
      t.forEach(c => { say[c] = (say[c] || 0) + 1; });
      if (t.length > B.kaplar[i]) ok = false;
      if (i >= p.renk && (t.length !== 0 || B.kaplar[i] !== enBuyuk)) ok = false;
      if (B.gizli[i] > 0 && B.gizli[i] !== t.length - 1) ok = false;
    });
    for (let r = 0; r < p.renk; r++) if (say[r] !== B.kaplar[r]) ok = false;
    if (Object.keys(say).length !== p.renk) ok = false;
    if (!ok) hata.push(n);
  });
  assert.deepStrictEqual(hata, []);
});
dene('101-250 tuzakOrani profil bandinda', () => {
  const hata = ileri.filter(B => !(B.tuzakOrani >= B.profil.tuzakAlt && B.tuzakOrani <= B.profil.tuzakUst)).map(B => B.bolumNo);
  assert.deepStrictEqual(hata, []);
});
dene('101-250 tahta turu profile uyuyor', () => {
  const hata = ileri.filter(B => {
    const p = B.profil, boy = U.farkliBoy(B), perde = B.gizli.filter(x => x > 0).length;
    const karisik = p.tur === 'temel' || p.tur === 'boyut';
    return (karisik ? boy < 2 : boy !== 1) || perde !== p.gizliTup;
  }).map(B => B.bolumNo);
  assert.deepStrictEqual(hata, []);
});

// ---- 2) tam bilgiyle cozulebilirlik ----
console.log('Tam bilgiyle cozum (A*, en kisa)');
const enKisa = [];
const cozumsuz = [], dogrulanamayan = [], ucYildizYok = [], butceFarkli = [];
bolumler.forEach(B => {
  const c = U.enKisaCozum(B);
  enKisa.push(c.yol ? c.yol.length : -1);
  if (!c.yol) { cozumsuz.push(B.bolumNo + (c.tam ? '' : '(sinir)')); return; }
  if (!U.yoluDogrula(B, c.yol)) dogrulanamayan.push(B.bolumNo);
  if (B.bolumNo <= 100 && c.yol.length > B.cozumHamle) ucYildizYok.push(B.bolumNo + ':' + c.yol.length + '>' + B.cozumHamle);
  if (B.bolumNo > 100 && !(c.yol.length <= B.cozumHamle && B.cozumHamle === U.butce(c.yol.length)))
    butceFarkli.push(B.bolumNo + ': en kisa ' + c.yol.length + ', kayit ' + B.cozumHamle);
});
dene('250/250 cozum bulundu', () => assert.deepStrictEqual(cozumsuz, []));
dene('cozumler oyundaki tahtada dogrulandi', () => assert.deepStrictEqual(dogrulanamayan, []));
dene('1-100: en kisa cozum <= cozumHamle (3 yildiz imkanli)', () => assert.deepStrictEqual(ucYildizYok, []));
dene('101-250: en kisa <= cozumHamle = ceil(1.3 x en kisa)', () => assert.deepStrictEqual(butceFarkli, []));

// ---- 3) bilgisiz oyuncu ----
const testTohum = U.AYAR.TEST_BOT_TOHUMLARI;
console.log('Bilgisiz oyuncu (perdeli bolumler, ayri tohum kumesi ' + testTohum[0] + '-' +
  testTohum[testTohum.length - 1] + ', en fazla ' + U.AYAR.BOT_BASTAN + ' kez bastan)');
dene('test tohumlari uretimde kullanilmiyor', () =>
  assert.ok(testTohum.every(t => U.AYAR.BOT_TOHUMLARI.indexOf(t) < 0)));
const esikAsan = [], basarisizBolum = [];
const bot = { eski: [0, 0], yeni: [0, 0] };   /* [basarisiz, deneme] */
bolumler.forEach(B => {
  if (!U.perdeliMi(B)) return;
  const k = U.bilgisizBasarisiz(B, testTohum);
  const g = bot[B.bolumNo <= 100 ? 'eski' : 'yeni'];
  g[0] += k; g[1] += testTohum.length;
  if (k > 0) basarisizBolum.push(B.bolumNo + ':' + k);
  if (k > 1) esikAsan.push(B.bolumNo + ':' + k + '/' + testTohum.length);
});
console.log('       1-100: ' + bot.eski[0] + '/' + bot.eski[1] + ' basarisiz, 101-250: ' + bot.yeni[0] + '/' + bot.yeni[1] +
  ' basarisiz' + (basarisizBolum.length ? '  [' + basarisizBolum.join(' ') + ']' : ''));
dene('her perdeli bolumde en fazla 1/' + testTohum.length + ' basarisiz', () => assert.deepStrictEqual(esikAsan, []));
dene('101-250 toplam basarisiz oran <= %1', () => assert.ok(bot.yeni[0] * 100 <= bot.yeni[1],
  bot.yeni[0] + '/' + bot.yeni[1]));

// ---- 5) dagilim ----
console.log('101-250 tur dagilimi');
console.log('       dilim    duz  boyut  karanlik  ikisi(temel)');
for (let a = 101; a <= 250; a += 25) {
  const s = { duz: 0, boyut: 0, karanlik: 0, temel: 0 };
  for (let n = a; n < a + 25; n++) s[S.bolumProfili(n).tur]++;
  console.log('       ' + a + '-' + (a + 24) + '  ' + [s.duz, s.boyut, s.karanlik, s.temel].map(x => String(x).padStart(5)).join(' '));
  dene(a + '-' + (a + 24) + ': her turden >= 1, duz disindakilerden >= 3', () => {
    assert.ok(s.duz >= 1 && s.boyut >= 3 && s.karanlik >= 3 && s.temel >= 3, JSON.stringify(s));
  });
}
dene('her 10\'lukta temel, boyut, karanlik var; ayni cesitleme art arda gelmez', () => {
  for (let a = 101; a <= 250; a += 10) {
    const t = {};
    for (let n = a; n < a + 10; n++) t[S.bolumProfili(n).tur] = 1;
    ['temel', 'boyut', 'karanlik'].forEach(x => assert.ok(t[x], a + ' blogunda ' + x + ' yok'));
  }
  for (let n = 102; n <= 250; n++) {
    const x = S.bolumProfili(n).tur;
    assert.ok(x === 'temel' || x !== S.bolumProfili(n - 1).tur, 'bolum ' + n + ' ' + x);
  }
});
dene('150 bolumde temel 90 (%60), boyut 22-30, karanlik 30, duz 7-8', () => {
  const p = ileri.map(B => B.profil), say = x => p.filter(q => q.tur === x).length;
  assert.strictEqual(say('temel'), 90);
  assert.ok(say('boyut') >= 22 && say('boyut') <= 30);
  assert.strictEqual(say('karanlik'), 30);
  assert.ok(say('duz') >= 7 && say('duz') <= 8);
});

// ---- 6) egri ----
console.log('Egri yumusakligi');
dene('renk azalmaz, adim <= 1', () => {
  for (let n = 101; n <= 250; n++) {
    const f = S.bolumProfili(n).renk - S.bolumProfili(n - 1).renk;
    assert.ok(f >= 0 && f <= 1, 'bolum ' + n);
  }
});
dene('perde sayisi her turde azalmaz, adim <= 1 (100 -> 101 dahil)', () => {
  const son = { temel: 4, karanlik: 4 };   /* 96-100'de 4 perde */
  ileri.forEach(B => {
    const p = B.profil;
    if (!(p.tur in son)) return;
    const f = p.gizliTup - son[p.tur];
    assert.ok(f >= 0 && f <= 1, 'bolum ' + p.bolumNo + ' ' + p.tur);
    son[p.tur] = p.gizliTup;
  });
});
dene('tuzak bandi her turde azalmaz', () => {
  const son = {};
  ileri.forEach(B => {
    const p = B.profil, s = son[p.tur];
    if (s) assert.ok(p.tuzakAlt >= s[0] && p.tuzakUst >= s[1], 'bolum ' + p.bolumNo);
    son[p.tur] = [p.tuzakAlt, p.tuzakUst];
  });
});
const ort = (a, b) => { let t = 0; for (let n = a; n <= b; n++) t += enKisa[n - 1]; return t / (b - a + 1); };
dene('10\'luk en kisa cozum ortalamalari: komsu fark <= 3, 101-110 < 241-250', () => {
  let once = ort(91, 100);
  for (let a = 101; a <= 250; a += 10) {
    const o = ort(a, a + 9);
    assert.ok(Math.abs(o - once) <= 3, a + ': ' + once.toFixed(1) + ' -> ' + o.toFixed(1));
    once = o;
  }
  assert.ok(ort(101, 110) < ort(241, 250));
});
const deger = n => 'cozum ' + bolumler[n - 1].cozumHamle + ' (en kisa ' + enKisa[n - 1] + ', 10\'luk ort ' +
  ort(Math.max(1, n - 9), n).toFixed(1) + '), perde ' + bolumler[n - 1].profil.gizliTup;
[100, 150, 200, 250].forEach(n => console.log('       ' + n + ': ' + deger(n)));

console.log('\n' + gecti + ' kontrol gecti' + (process.exitCode ? ', HATA VAR' : '') +
  '  (' + Math.round((Date.now() - bas) / 1000) + ' sn)');
