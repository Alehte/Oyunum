// kacisCozTest.js — Kacis? normal bolumlerinin (js/bolumler.js) cozucu testi.
// Calistirma:  node tools/kacisCozTest.js
//
// Hareket kurali TAHMIN EDILMEZ: js/kacis.js'ten DIR_VECTORS, deriveDir ve
// simulateExit (findBlocker = simulateExit(..., false)) metin olarak kesilip
// vm icinde calistirilir. Oyundaki gibi:
//   - yilanin yonu deriveDir(cells): kafanin bir onceki hucreye gore yonu
//   - dokunulan yilan kafa yonunde duz kayar; yolunda (tahta icinde) baska
//     yilan ya da kendi govdesi varsa engellenir -> kalp kaybi (handleSnakeTap)
//   - cikan yilan doluluk haritasindan duser (buildOccupancy, exiting)
//   - kahraman (isHero) cikinca bolum biter.
// KC_BOARD_PAD / KC_VIEW_* ile eklenen kenar hucreleri bostur; desen ortalanir
// (loadLevel offR/offC). Bos kenar engel uretmez, bu yuzden cozucu bolumun kendi
// cols x rows olcusunde calisir.
//
// Zorluk olculeri (bolumler.js notlari "M:.. D:.. tuzak:.."; 1-100 icin notlarla
// birebir dogrulandi):
//   M     = kahramandan once MUTLAKA cikarilmasi gereken yilan sayisi
//           (kahramanin yolunu kesenlerin, onlari kesenlerin... kapanisi)
//   D     = bu bagimlilik agacinda kahramanin ustundeki en uzun zincir
//   tuzak = gerekmeyen (dokunmaya degmeyen) yilan sayisi = toplam - M - 1
// Bu modul tools/kacisUret.js tarafindan da kullanilir (require).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const JS = path.join(__dirname, '..', 'js');

// ---- kacis.js'ten kural fonksiyonlarini kes ----
function fonksiyonKes(kaynak, ad) {
  const bas = kaynak.indexOf('function ' + ad + '(');
  if (bas < 0) throw new Error('kacis.js: ' + ad + ' bulunamadi');
  let i = kaynak.indexOf('{', bas), derin = 0;
  for (; i < kaynak.length; i++) {
    if (kaynak[i] === '{') derin++;
    else if (kaynak[i] === '}' && --derin === 0) return kaynak.slice(bas, i + 1);
  }
  throw new Error('kacis.js: ' + ad + ' kapanmiyor');
}
const kacisKaynak = fs.readFileSync(path.join(JS, 'kacis.js'), 'utf8');
const dirSatir = /const DIR_VECTORS = \{[^\n]*\};/.exec(kacisKaynak);
if (!dirSatir) throw new Error('kacis.js: DIR_VECTORS bulunamadi');
const KURAL = {};
vm.runInNewContext(dirSatir[0] + '\n' + fonksiyonKes(kacisKaynak, 'deriveDir') + '\n' +
  fonksiyonKes(kacisKaynak, 'simulateExit') + '\nthis.deriveDir = deriveDir; this.simulateExit = simulateExit;', KURAL);

function dolulukKur(yilanlar) {        // buildOccupancy karsiligi
  const m = new Map();
  yilanlar.forEach(s => s.cells.forEach(([r, c]) => m.set(r + '_' + c, s.id)));
  return m;
}
function hazirla(b) {                  // loadLevel karsiligi: yon deriveDir ile
  KURAL.KC_ROWS = b.rows; KURAL.KC_COLS = b.cols;
  return b.snakes.map(s => ({ id: s.id, isHero: !!s.isHero, cells: s.cells, dir: KURAL.deriveDir(s.cells, s.dir) }));
}
// Tum olculer + kalp kaybetmeden cozum sirasi
function analiz(b) {
  const ys = hazirla(b), occ = dolulukKur(ys), ad = {};
  ys.forEach(s => { ad[s.id] = s; });
  const keser = {};
  ys.forEach(s => { const h = KURAL.simulateExit(s, occ, true); keser[s.id] = h; });
  const kendiniKeser = ys.filter(s => KURAL.simulateExit(s, dolulukKur([s]), false) === s.id).map(s => s.id);
  // gereken kume: kahramandan keser iliskisinin kapanisi
  const gerek = new Set(), yig = ['green'];
  while (yig.length) { const x = yig.pop(); if (gerek.has(x)) continue; gerek.add(x); keser[x].forEach(y => yig.push(y)); }
  // en uzun zincir (dongu varsa cozulemez -> Infinity)
  const der = {}, yolda = new Set();
  function derinlik(x) {
    if (der[x] !== undefined) return der[x];
    if (yolda.has(x)) return Infinity;
    yolda.add(x);
    let m = 0; keser[x].forEach(y => { m = Math.max(m, derinlik(y) + 1); });
    yolda.delete(x);
    return (der[x] = m);
  }
  const D = derinlik('green');
  // cozum: yalnizca gereken yilanlar, yolu acik olani sirayla cikar (handleSnakeTap)
  const hamle = [], kalan = new Set(gerek), canli = new Map(occ);
  let ilerle = true;
  while (kalan.has('green') && ilerle) {
    ilerle = false;
    for (const id of kalan) {
      if (id === 'green' && kalan.size > 1) continue;
      if (KURAL.simulateExit(ad[id], canli, false) === null) {
        hamle.push(id); kalan.delete(id); ad[id].cells.forEach(([r, c]) => canli.delete(r + '_' + c));
        ilerle = true;
      }
    }
  }
  return { M: gerek.size - 1, D, tuzak: ys.length - gerek.size, hamle, kendiniKeser,
           serbest: ys.filter(s => keser[s.id].length === 0).length };
}
// Hamle sirasini oyunun kuraliyla bastan oynat: 3 kalp, engelde -1 kalp
function oynat(b, hamle) {
  const ys = hazirla(b), ad = {};
  ys.forEach(s => { ad[s.id] = s; });
  const occ = dolulukKur(ys);
  let kalp = 3;
  for (const id of hamle) {
    if (kalp <= 0) return { kalp, bitti: false };
    const s = ad[id];
    if (!s || s.cikti) return { kalp, bitti: false };
    if (KURAL.simulateExit(s, occ, false)) { kalp--; continue; }
    s.cikti = true; s.cells.forEach(([r, c]) => occ.delete(r + '_' + c));
    if (s.isHero) return { kalp, bitti: true };
  }
  return { kalp, bitti: false };
}
// Veri gecerliligi: hata metni dizisi (bos = gecerli)
function gecerlilik(b, palet) {
  const h = [];
  if (!(Number.isInteger(b.cols) && Number.isInteger(b.rows) && b.cols >= 2 && b.rows >= 2 && b.cols <= 35 && b.rows <= 35)) h.push('tahta olcusu ' + b.cols + 'x' + b.rows);
  if (!b.snakes.length || b.snakes[0].id !== 'green' || b.snakes[0].isHero !== true) h.push('kahraman ilk sirada degil');
  const dolu = new Map();
  b.snakes.forEach((s, i) => {
    if (s.id !== (i === 0 ? 'green' : 's' + (i - 1))) h.push('id ' + s.id);
    if (i > 0 && s.isHero) h.push(s.id + ' ikinci kahraman');
    if (!/^#[0-9A-Fa-f]{6}$/.test(s.color || '') || (palet && s.color !== palet[i])) h.push(s.id + ' renk ' + s.color);
    if (s.cells.length < 2) h.push(s.id + ' tek hucre');
    s.cells.forEach(([r, c], k) => {
      if (!(r >= 0 && r < b.rows && c >= 0 && c < b.cols)) h.push(s.id + ' tahta disi ' + r + ',' + c);
      const a = r + '_' + c;
      if (dolu.has(a)) h.push(s.id + ' cakisma ' + dolu.get(a) + ' @' + a);
      dolu.set(a, s.id);
      if (k > 0) { const [pr, pc] = s.cells[k - 1]; if (Math.abs(pr - r) + Math.abs(pc - c) !== 1) h.push(s.id + ' komsu degil @' + k); }
    });
  });
  return h;
}
// Zorluk ozeti (egri yumusakligi icin tek sayi)
function zorluk(o) { return o.M + 2 * o.D + o.tuzak / 2; }

function yukle(dosya) {
  const kutu = {};
  new Function('window', fs.readFileSync(dosya, 'utf8'))(kutu);
  return kutu.BOLUMLER;
}
function notlar(metin) {      // "// n — M:a D:b tuzak:c | tahta AxB[ | tur:x]"
  const out = [];
  metin.split('\n').forEach(l => {
    const m = /^\s*\/\/ (\d+) — M:(\d+) D:(\d+) tuzak:(\d+) \| tahta (\d+)x(\d+)(?: \| tur:([a-z]+))?\s*$/.exec(l);
    if (m) out[Number(m[1]) - 1] = { M: +m[2], D: +m[3], tuzak: +m[4], cols: +m[5], rows: +m[6], tur: m[7] || null };
  });
  return out;
}

module.exports = { KURAL, analiz, oynat, gecerlilik, zorluk, yukle, notlar };

// ======================= TESTLER =======================
if (require.main === module) {
  const bas = Date.now();
  let gecti = 0;
  function dene(ad, fn) {
    try { fn(); gecti++; console.log('  ok  ' + ad); }
    catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
  }
  const DOSYA = path.join(JS, 'bolumler.js');
  const metin = fs.readFileSync(DOSYA, 'utf8');
  const B = yukle(DOSYA), N = notlar(metin);
  const palet = /var PALET = '([0-9A-Fa-f]+)'/.exec(metin)[1].match(/.{6}/g).map(r => '#' + r);
  const A = B.map(analiz);

  console.log('Kacis? bolum verisi');
  dene('250 bolum ve baslik "(250 adet)"', () => {
    assert.strictEqual(B.length, 250);
    assert.ok(metin.indexOf('normal bölümleri (250 adet)') >= 0, 'baslik yorumu');
  });
  // ilk 100 bolumun cozulmus hali (renkler dahil) 1.1.3'teki dosyayla ayni
  dene('1-100 degismedi (sha256)', () => {
    const ozet = crypto.createHash('sha256').update(JSON.stringify(B.slice(0, 100))).digest('hex');
    assert.strictEqual(ozet, '3ffa3b391d9290e278c67da7e4a0f6597551e220f54945e3ae0af584b0241d47');
  });
  dene('kural fonksiyonlari kacis.js\'ten kesildi (deriveDir, simulateExit)', () => {
    assert.strictEqual(typeof KURAL.deriveDir, 'function');
    assert.strictEqual(typeof KURAL.simulateExit, 'function');
    assert.ok(/function findBlocker\(snake, occ\)\{ return simulateExit\(snake, occ, false\);/.test(kacisKaynak), 'findBlocker = simulateExit(false)');
  });
  dene('kural ornegi: yolu kesilen yilan engellenir, yol acilinca cikar', () => {
    const b = { cols: 5, rows: 3, snakes: [
      { id: 'green', isHero: true, cells: [[1, 0], [1, 1]] },           // saga bakar
      { id: 's0', cells: [[0, 3], [1, 3]] }, ] };                        // asagi bakar, yolu keser
    const o = analiz(b);
    assert.deepStrictEqual([o.M, o.D, o.tuzak], [1, 1, 0]);
    assert.deepStrictEqual(o.hamle, ['s0', 'green']);
    assert.deepStrictEqual(oynat(b, ['green', 'green', 'green']), { kalp: 0, bitti: false });
  });
  dene('tum bolumler gecerli (tahta ici, cakisma yok, komsu hucre, renk PALET\'ten)', () => {
    const hata = [];
    B.forEach((b, i) => gecerlilik(b, palet).forEach(m => hata.push((i + 1) + ': ' + m)));
    assert.deepStrictEqual(hata.slice(0, 5), []);
  });
  dene('kendi govdesine carpan yilan yok', () => {
    const k = []; A.forEach((o, i) => { if (o.kendiniKeser.length) k.push((i + 1) + ':' + o.kendiniKeser); });
    assert.deepStrictEqual(k, []);
  });
  dene('her bolum 3 kalpte kalp kaybetmeden cozuluyor', () => {
    const k = [];
    B.forEach((b, i) => {
      const o = A[i], r = oynat(b, o.hamle);
      if (!(r.bitti && r.kalp === 3 && o.hamle.length === o.M + 1)) k.push(i + 1);
    });
    assert.deepStrictEqual(k, []);
  });
  dene('notlar (M, D, tuzak, tahta) cozucuyle birebir', () => {
    const k = [];
    B.forEach((b, i) => {
      const n = N[i], o = A[i];
      if (!n || n.M !== o.M || n.D !== o.D || n.tuzak !== o.tuzak || n.cols !== b.cols || n.rows !== b.rows)
        k.push((i + 1) + ' not=' + JSON.stringify(n) + ' olcu=' + [o.M, o.D, o.tuzak, b.cols + 'x' + b.rows]);
    });
    assert.deepStrictEqual(k.slice(0, 5), []);
  });

  console.log('Kacis? 101-250 tasarim');
  const TURLER = ['siki', 'uzun', 'zincir', 'nefes'];
  const yeni = []; for (let i = 100; i < 250; i++) yeni.push(i);
  const cesit = yeni.filter(i => N[i] && N[i].tur);
  dene('1-100 notlarinda tur etiketi yok', () => assert.ok(N.slice(0, 100).every(n => n && !n.tur)));
  dene('cesitlilik ~%20 (25-35 bolum), 4 turun her biri en az 6', () => {
    assert.ok(cesit.length >= 25 && cesit.length <= 35, 'sayi ' + cesit.length);
    TURLER.forEach(t => assert.ok(cesit.filter(i => N[i].tur === t).length >= 6, t));
    assert.ok(cesit.every(i => TURLER.indexOf(N[i].tur) >= 0));
  });
  dene('cesitlilik serpistirilmis: arka arkaya yok, aralik <= 7', () => {
    for (let k = 1; k < cesit.length; k++) assert.ok(cesit[k] - cesit[k - 1] >= 2 && cesit[k] - cesit[k - 1] <= 7, (cesit[k - 1] + 1) + '-' + (cesit[k] + 1));
    assert.ok(cesit[0] - 99 <= 7 && 249 - cesit[cesit.length - 1] <= 7);
  });
  dene('tahta mobil siniri: <= 30x35', () => {
    yeni.forEach(i => assert.ok(B[i].cols <= 30 && B[i].rows <= 35, (i + 1) + ': ' + B[i].cols + 'x' + B[i].rows));
  });
  // Egri: temel bolumler (100 dahil) ardisik farki sinirli; cesitlilik
  // bolumleri bilincli sapma -> yalnizca komsu temel bolume gore bant icinde.
  const temel = [99].concat(yeni.filter(i => B[i] && !(N[i] && N[i].tur)));
  dene('temel egri yumusak: ardisik |dM|<=2 |dD|<=1 |dtuzak|<=2 |dZ|<=3, tahta adimi <=1', () => {
    for (let k = 1; k < temel.length; k++) {
      const a = A[temel[k - 1]], b = A[temel[k]], ba = B[temel[k - 1]], bb = B[temel[k]], ad = (temel[k] + 1) + '. bolum';
      assert.ok(Math.abs(b.M - a.M) <= 2, ad + ' dM');
      assert.ok(Math.abs(b.D - a.D) <= 1, ad + ' dD');
      assert.ok(Math.abs(b.tuzak - a.tuzak) <= 2, ad + ' dtuzak');
      assert.ok(Math.abs(zorluk(b) - zorluk(a)) <= 3, ad + ' dZ');
      assert.ok(Math.abs(bb.cols - ba.cols) <= 1 && Math.abs(bb.rows - ba.rows) <= 1, ad + ' tahta');
    }
  });
  dene('temel egri azalmiyor ve 250\'de 100\'den zor', () => {
    for (let k = 1; k < temel.length; k++) assert.ok(zorluk(A[temel[k]]) >= zorluk(A[temel[k - 1]]), (temel[k] + 1) + '. bolum');
    assert.ok(zorluk(A[249]) > zorluk(A[99]));
  });
  dene('cesitlilik bandi: Z, onceki temel bolumun %40-%125 araliginda', () => {
    cesit.forEach(i => {
      let j = i - 1; while (N[j] && N[j].tur) j--;
      const z = zorluk(A[i]), zt = zorluk(A[j]);
      assert.ok(z >= 0.4 * zt && z <= 1.25 * zt, (i + 1) + ' ' + N[i].tur + ': Z=' + z + ' temel=' + zt);
    });
  });
  dene('uretici deterministik ve dosya guncel (kacisUret.js --kontrol)', () => {
    const uret = require('./kacisUret.js');
    assert.strictEqual(uret.dosyaMetni(), metin);
  });
  const sure = ((Date.now() - bas) / 1000).toFixed(1);
  dene('sure < 120 sn (' + sure + ' sn)', () => assert.ok(Date.now() - bas < 120000));

  console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
}
