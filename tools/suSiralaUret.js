// suSiralaUret.js — Su Sirala normal mod tablosunun 101-250 kayitlarini uretir.
// Calistirma:  node tools/suSiralaUret.js            (uret + js/suSiralaBolumler.js yaz)
//              node tools/suSiralaUret.js --kuru     (uret, dosyaya yazma)
// Ara sonuclar isletim sisteminin gecici klasorune yazilir (suSiralaUret-onbellek.json);
// kesilirse kaldigi yerden surer. Proje klasorune gecici dosya birakmaz.
// 1-100 kayitlari OLDUGU GIBI korunur. Tablo bicimi: [tohum, tuzakOrani, cozumHamle].
//
// Bir aday tohum su sartlarin hepsini saglarsa tabloya girer (ilk saglayan alinir):
//   1) Baslangicta hazir renk yok (SuSirala.bedavaMi).
//   2) Tahta profildeki ture uyar: karisik turlerde en az iki farkli sise boyu,
//      perdeli turlerde perdeli sise sayisi = profil.gizliTup.
//   3) Tam bilgiyle A* (kabul edilebilir alt sinir) EN KISA cozumu bulur;
//      uzunluk hedef penceresinde (cozumPencere).
//      cozumHamle = butce(en kisa) = ceil(1.3 x en kisa): 1-100'deki kayitli/en kisa
//      orani (~1.32) korunur, yildiz butcesi ve coin kazanci eski duzeyde kalir.
//   4) Yol boyu tuzak orani profil bandinda (tuzakAlt..tuzakUst).
//   5) Perdeli bolumde bilgisiz oyuncu olcutu gecer (bilgisizBot, asagida).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');

const KOK = path.join(__dirname, '..');
const TABLO = path.join(KOK, 'js', 'suSiralaBolumler.js');

/* ---------- ayarlar (test de bunlari kullanir) ---------- */
const AYAR = {
  ILK: 101, SON: 250,
  ADAY_SINIRI: 3000,          // bolum basina denenecek en fazla tohum
  ASTAR_SINIRI: 300000,       // A* dugum siniri (asilirsa aday elenir)
  TUZAK_SINIRI: 1000000,      // tuzak olcumunde cozucu dugum siniri
  // uretimde eleme: bot 1-48 tohumlarinin her biriyle ayri ayri gecmeli
  BOT_TOHUMLARI: Array.from({ length: 48 }, (_, i) => i + 1),
  // Test icin AYRI kume: uretimde hic kullanilmaz (asiri uyumu olcer)
  TEST_BOT_TOHUMLARI: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
  BOT_BASTAN: 3,              // en fazla kac kez "Bastan basla" (deneme = BOT_BASTAN + 1)
  BOT_SON_DENEME: 6,          // uretimde: 48 tohumdan en fazla 6'si son denemeye kalabilir
  BOT_DFS: 20000,             // botun her plan aramasindaki dugum siniri
  BOT_HAMLE: 250,             // bir denemede en fazla hamle
  BOT_PLAN: 40,               // bir denemede en fazla yeniden planlama
  BOT_ORNEK: 200              // bir hipotez icin en fazla ornek
};

/* Yildiz butcesi: en kisa cozumun 1.3 kati, yukari yuvarlanir (tamsayi aritmetigi) */
function butce(enKisa) { return Math.ceil(enKisa * 13 / 10); }

/* En kisa cozum hedefi: 101'de 28, 250'de 33; pencere [hedef-2, hedef+3].
   Duz (dinlenme) bolumde hedef 2 hamle asagi. */
function cozumPencere(p) {
  const hedef = 28 + Math.round((p.bolumNo - 101) * 5 / 149) - (p.tur === 'duz' ? 2 : 0);
  return [hedef - 2, hedef + 3];
}

/* ---------- cekirdegi yukle ---------- */
function yukle() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(KOK, 'js', 'suSirala.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(TABLO, 'utf8'), ctx);
  return { S: ctx.window.SuSirala, T: ctx.window.SuSiralaBolumler };
}
const { S } = yukle();

function anahtar(d) {
  const p = [];
  for (let i = 0; i < d.tupler.length; i++) p.push(d.kaplar[i] + ':' + d.tupler[i].join(','));
  return p.sort().join('|');
}
function acik(d) { return { tupler: d.tupler.map(t => t.slice()), kaplar: d.kaplar, gizli: null }; }
function kl(d) { return { tupler: d.tupler.map(t => t.slice()), kaplar: d.kaplar, gizli: d.gizli ? d.gizli.slice() : null }; }

/* Alt sinir: bir hamle en fazla BIR "henuz kipirdamamis" blogun ilk hamlesidir.
   Kipirdamasi sart olanlar: dipte olmayan her blok + her rengin dip bloklarindan
   (o rengi alabilecek kaptakilerden biri haric) geri kalanlar. */
function altSinir(d) {
  let h = 0;
  const say = {}, dip = {};
  for (const t of d.tupler) for (const c of t) say[c] = (say[c] || 0) + 1;
  for (let i = 0; i < d.tupler.length; i++) {
    const t = d.tupler[i];
    if (!t.length) continue;
    for (let k = 1; k < t.length; k++) if (t[k] !== t[k - 1]) h++;
    const c = t[0];
    const x = dip[c] || (dip[c] = [0, 0]);
    x[0]++;
    if (d.kaplar[i] >= say[c]) x[1]++;
  }
  for (const c in dip) h += dip[c][0] - (dip[c][1] > 0 ? 1 : 0);
  return h;
}

/* Tam bilgiyle A*: alt sinir kabul edilebilir oldugundan bulunan yol EN KISADIR.
   Donus: { yol: [[a,b],...] | null, tam: arama sinira takilmadan bitti mi } */
function enKisaCozum(d0, sinir) {
  sinir = sinir || AYAR.ASTAR_SINIRI;
  const bas = acik(d0), yigin = [];
  function it(x) {
    yigin.push(x);
    let i = yigin.length - 1;
    while (i > 0) { const u = (i - 1) >> 1; if (yigin[u].f <= x.f) break; yigin[i] = yigin[u]; i = u; }
    yigin[i] = x;
  }
  function al() {
    const ust = yigin[0], x = yigin.pop();
    if (yigin.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= yigin.length) break;
        if (c + 1 < yigin.length && yigin[c + 1].f < yigin[c].f) c++;
        if (yigin[c].f >= x.f) break;
        yigin[i] = yigin[c]; i = c;
      }
      yigin[i] = x;
    }
    return ust;
  }
  const enIyi = new Map();
  enIyi.set(anahtar(bas), 0);
  it({ d: bas, g: 0, f: altSinir(bas), iz: null });
  let n = 0;
  while (yigin.length) {
    const u = al();
    if (S.kazanildiMi(u.d)) {
      const yol = [];
      for (let p = u.iz; p; p = p.on) yol.push(p.m);
      return { yol: yol.reverse(), tam: true };
    }
    if (enIyi.get(anahtar(u.d)) < u.g) continue;
    if (++n > sinir) return { yol: null, tam: false };
    for (const m of S.gecerliHamleler(u.d)) {
      const y = kl(u.d);
      S.hamleUygula(y, m[0], m[1]);
      const k = anahtar(y), g = u.g + 1, eski = enIyi.get(k);
      if (eski !== undefined && eski <= g) continue;
      enIyi.set(k, g);
      it({ d: y, g: g, f: g + altSinir(y), iz: { m: m, on: u.iz } });
    }
  }
  return { yol: null, tam: true };
}

/* Yolu oyundaki tahtada (perdeli haliyle) oynatip dogrula */
function yoluDogrula(d0, yol) {
  const d = kl(d0);
  for (const m of yol) {
    if (!S.hamleGecerliMi(d, m[0], m[1])) return false;
    S.hamleUygula(d, m[0], m[1]);
  }
  return S.kazanildiMi(d);
}

/* Hizli DFS + hafiza; bir cozum yolu dondurur (en kisa degil). Botun planlayicisi. */
function puan(d, a, b) {
  const k = d.tupler[a], h = d.tupler[b];
  let blok = 1;
  for (let i = k.length - 2; i >= 0 && k[i] === k[k.length - 1]; i--) blok++;
  let p = 0;
  if (h.length > 0) p += 10;
  if (blok === k.length) p += 8;
  if (h.length + blok === d.kaplar[b]) p += 12;
  return p - Math.abs(d.kaplar[b] - (h.length + blok));
}
function dfsCozum(d0, sinir) {
  const gorulen = new Set(), yol = [];
  let n = 0, tasti = false;
  function ara(d) {
    if (S.kazanildiMi(d)) return true;
    const k = anahtar(d);
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    if (++n > sinir) { tasti = true; return false; }
    const h = S.gecerliHamleler(d);
    h.sort((x, y) => puan(d, y[0], y[1]) - puan(d, x[0], x[1]));
    for (const m of h) {
      const y = kl(d);
      S.hamleUygula(y, m[0], m[1]);
      yol.push(m);
      if (ara(y)) return true;
      yol.pop();
      if (tasti) return false;
    }
    return false;
  }
  return ara(acik(d0)) ? yol : null;
}

/* Yol boyu tuzak orani (profil yorumundaki tanim): en kisa cozum yolundaki
   her durumda gecerli hamlelerin kaci tahtayi cozulemez yapiyor; tum yol
   boyunca toplam tuzak / toplam gecerli hamle, yuzde. Tam bilgiyle olculur.
   Cozucu sinira takilirsa -1. */
function yolTuzakOrani(d0, yol) {
  const c = S.CozucuOlustur(AYAR.TUZAK_SINIRI);
  const d = acik(d0);
  let tuzak = 0, toplam = 0;
  for (const adim of yol) {
    const h = S.gecerliHamleler(d);
    for (const m of h) {
      const y = kl(d);
      S.hamleUygula(y, m[0], m[1]);
      if (!c.cozulurMu(y)) tuzak++;
      if (c.tastiMi()) return -1;
    }
    toplam += h.length;
    S.hamleUygula(d, adim[0], adim[1]);
  }
  return toplam ? Math.round(100 * tuzak / toplam) : 0;
}

/* ---------- BILGISIZ OYUNCU BOTU ----------
   Bot yalniz oyuncunun gorebildigini kullanir:
   - perdesiz katmanlar, sise kapasiteleri, baslangicta dolu siselerin
     kapasiteleri (her rengin birim sayisi bunlardan birine esittir),
   - perde acildikca gordugu renkler (dokulen gizli birimler hedefte gorunur,
     kalan ust katman acilir) — bunlari "Bastan basla"dan sonra da hatirlar,
   - oyunun reddettigi hamleler ve "bitmedi" bilgisi.
   Her planlamada perdeli hucreleri bu bilgilerle CELISMEYEN rastgele bir
   hipotezle doldurur (kendi tohumuyla, gercek tahtaya bakmadan), hipotez
   tahtasini cozer, cozumu oynar. Acilan bir renk hipotezle celisirse ya da
   oyun hamleyi reddederse yeniden planlar. Hicbir hipotez cozulmuyorsa veya
   sinirlar dolarsa bastan baslar. Joker kullanmaz.
   Donus: { ok, deneme } — deneme = kacinci denemede bitti (1 = hic bastan baslamadan). */
function bilgisizBot(B, tohum) {
  const renk = B.profil.renk, g0 = B.gizli.slice(), n = B.tupler.length;
  const kaplar = [];
  for (let i = 0; i < n; i++) if (B.tupler[i].length > 0) kaplar.push(B.kaplar[i]);
  const bilinen = g0.map(g => new Array(g).fill(-1));
  const gozlem = [];
  const rng = S.rngOlustur(tohum);
  function karistir(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const g = a[i]; a[i] = a[j]; a[j] = g; }
    return a;
  }
  /* Bir durumun perdeli hucrelerini hipotez tahtasindan doldur */
  function doldur(d, Hb) {
    const y = { tupler: d.tupler.map(t => t.slice()), kaplar: d.kaplar, gizli: d.gizli.slice() };
    for (let i = 0; i < n; i++) for (let k = 0; k < d.gizli[i]; k++) y.tupler[i][k] = Hb[i][k];
    return y;
  }
  function hipotez() {
    const v = new Array(renk).fill(0), bos = [];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < B.tupler[i].length; k++) {
        if (k >= g0[i]) v[B.tupler[i][k]]++;
        else if (bilinen[i][k] >= 0) v[bilinen[i][k]]++;
        else bos.push([i, k]);
      }
    }
    for (let r = 0; r < AYAR.BOT_ORNEK; r++) {
      /* Renk -> toplam birim: kapasitelerden, gorulen sayiyi karsilayan rastgele eslesme */
      const kalan = kaplar.slice(), havuz = [];
      const sira = karistir([...Array(renk).keys()]).sort((a, b) => v[b] - v[a]);
      let uygun = true;
      for (const c of sira) {
        const adaylar = [];
        kalan.forEach((x, j) => { if (x >= v[c]) adaylar.push(j); });
        if (!adaylar.length) { uygun = false; break; }
        const j = adaylar[Math.floor(rng() * adaylar.length)];
        for (let q = v[c]; q < kalan[j]; q++) havuz.push(c);
        kalan.splice(j, 1);
      }
      if (!uygun || havuz.length !== bos.length) continue;
      karistir(havuz);
      const Hb = B.tupler.map(t => t.slice());
      bos.forEach((s, j) => { Hb[s[0]][s[1]] = havuz[j]; });
      for (let i = 0; i < n; i++) for (let k = 0; k < g0[i]; k++) if (bilinen[i][k] >= 0) Hb[i][k] = bilinen[i][k];
      let celismez = true;
      for (const g of gozlem) {
        const y = doldur(g.d, Hb);
        if (g.m ? S.hamleGecerliMi(y, g.m[0], g.m[1]) : S.kazanildiMi(y)) { celismez = false; break; }
      }
      if (celismez) return Hb;
    }
    return null;
  }
  for (let deneme = 1; deneme <= AYAR.BOT_BASTAN + 1; deneme++) {
    const d = kl(B);   /* Bastan basla: tahta deterministik */
    let hamle = 0, plan = 0;
    planla: while (plan++ < AYAR.BOT_PLAN) {
      if (S.kazanildiMi(d)) return { ok: true, deneme: deneme };
      const Hb = hipotez();
      if (!Hb) break;
      const H = doldur(d, Hb);
      const yol = dfsCozum(H, AYAR.BOT_DFS);
      if (!yol) continue;
      for (const m of yol) {
        if (!S.hamleGecerliMi(d, m[0], m[1])) { gozlem.push({ d: kl(d), m: m }); continue planla; }
        const a = m[0], once = d.tupler[a].slice(), gOnce = d.gizli[a];
        S.hamleUygula(d, a, m[1]);
        hamle++;
        /* Perdesi kalkan ya da dokulen gizli birimler artik biliniyor */
        let celiski = false;
        for (let k = d.gizli[a]; k < Math.min(gOnce, once.length); k++) {
          if (bilinen[a][k] < 0) bilinen[a][k] = once[k];
          if (Hb[a][k] !== once[k]) celiski = true;
        }
        if (S.kazanildiMi(d)) return { ok: true, deneme: deneme };
        if (hamle > AYAR.BOT_HAMLE) break planla;
        if (celiski) continue planla;
      }
      gozlem.push({ d: kl(d), m: null });   /* plan bitti ama oyun bitmedi */
    }
  }
  return { ok: false, deneme: AYAR.BOT_BASTAN + 1 };
}

function perdeliMi(B) { return B.gizli.some(x => x > 0); }

/* Uretimdeki eleme: BOT_TOHUMLARI'nin HEPSIYLE en fazla BOT_BASTAN kez bastan baslayarak bitir */
function bilgisizOlcut(B) {
  let enKotu = 0, sonDeneme = 0;
  for (const t of AYAR.BOT_TOHUMLARI) {
    const r = bilgisizBot(B, t);
    if (!r.ok) return { ok: false, deneme: -1 };
    enKotu = Math.max(enKotu, r.deneme);
    /* Pay: son denemeye kalan tohum cok ise bolum sinirda demektir (yeni tohumlarda
       basarisizlik buradan gelir), elenir */
    if (r.deneme === AYAR.BOT_BASTAN + 1 && ++sonDeneme > AYAR.BOT_SON_DENEME) return { ok: false, deneme: -1 };
  }
  return { ok: true, deneme: enKotu };
}

/* Verilen bot tohumlarindan kacinda bot BOT_BASTAN sinirinda bitiremedi */
function bilgisizBasarisiz(B, tohumlar) {
  let basarisiz = 0;
  for (const t of tohumlar) if (!bilgisizBot(B, t).ok) basarisiz++;
  return basarisiz;
}

/* ---------- aday tohum ---------- */
function adayTohum(n, k) {
  return (Math.imul(n, 2654435761) ^ Math.imul(k + 1, 0x85EBCA6B)) >>> 0;
}

/* Oyundaki bolumUret ile ayni kurulum (tablo yerine verilen tohumla) */
function tahta(n, tohum) {
  const d = S.tahtaKur(n, tohum);
  d.gizli = S.perdeKur(d.tupler, d.profil, tohum);
  return d;
}

function farkliBoy(d) {
  const s = {};
  d.tupler.forEach((t, i) => { if (t.length) s[d.kaplar[i]] = 1; });
  return Object.keys(s).length;
}

function adayDegerlendir(n, tohum) {
  const d = tahta(n, tohum), p = d.profil;
  if (S.bedavaMi(d)) return null;
  const karisik = p.tur === 'temel' || p.tur === 'boyut';
  if (karisik && farkliBoy(d) < 2) return null;
  if (d.gizli.filter(x => x > 0).length !== p.gizliTup) return null;
  const c = enKisaCozum(d);
  if (!c.yol) return null;
  const [alt, ust] = cozumPencere(p);
  if (c.yol.length < alt || c.yol.length > ust) return null;
  if (!yoluDogrula(d, c.yol)) return null;
  const tz = yolTuzakOrani(d, c.yol);
  if (tz < p.tuzakAlt || tz > p.tuzakUst) return null;
  if (perdeliMi(d) && !bilgisizOlcut(d).ok) return null;
  return [tohum, tz, butce(c.yol.length)];
}

/* ---------- tablo yazimi ---------- */
function tabloYaz(kayitlar) {
  const satir = [];
  for (let i = 0; i < kayitlar.length; i += 5) {
    satir.push('  ' + kayitlar.slice(i, i + 5).map(k => '[' + k.join(',') + ']').join(','));
  }
  const metin =
    '/* ============================================================\n' +
    '   SU SIRALAMA - BOLUM TABLOSU (1-250)\n' +
    '   Her kayit: [tohum, tuzakOrani, cozumHamle]\n' +
    '   Tahta bu tohumdan yeniden uretilir; bolum verisi saklanmaz.\n' +
    '   1-100: ilk surumdeki kayitlar (degistirilmedi). tuzakOrani -1 ise\n' +
    '   o bolumde olculmedi (perdeli bolum).\n' +
    '   101-250: tools/suSiralaUret.js ile uretildi. cozumHamle =\n' +
    '   ceil(1.3 x tam bilgiyle EN KISA cozum), 1-100 ile ayni oran;\n' +
    '   tuzakOrani = cozum yolu boyunca tuzak\n' +
    '   hamle yuzdesi. Dogrulama: node tools/suSiralaCozTest.js\n' +
    '   ============================================================ */\n\n' +
    'window.SuSiralaBolumler = [\n' + satir.join(',\n') + '\n];\n';
  fs.writeFileSync(TABLO, metin);
}

function main() {
  const kuru = process.argv.includes('--kuru');
  const onbellekYolu = path.join(os.tmpdir(), 'suSiralaUret-onbellek.json');
  /* Profil ve ayar degisirse onbellek gecersiz */
  const imza = JSON.stringify([AYAR, cozumPencere.toString(),
    Array.from({ length: AYAR.SON - AYAR.ILK + 1 }, (_, i) => S.bolumProfili(AYAR.ILK + i)),
    fs.readFileSync(__filename, 'utf8').length]);
  let onbellek = { imza: imza, kayit: {} };
  if (fs.existsSync(onbellekYolu)) {
    const o = JSON.parse(fs.readFileSync(onbellekYolu, 'utf8'));
    if (o.imza === imza) onbellek = o;
  }
  const { T } = yukle();
  const kayitlar = T.slice(0, AYAR.ILK - 1).map(k => k.slice());
  const bas = Date.now();
  for (let n = AYAR.ILK; n <= AYAR.SON; n++) {
    let k = onbellek.kayit[n];
    if (!k) {
      for (let a = 0; a < AYAR.ADAY_SINIRI && !k; a++) {
        const r = adayDegerlendir(n, adayTohum(n, a));
        if (r) k = r.concat([a]);
      }
      if (!k) { console.log('HATA bolum ' + n + ': uygun tohum bulunamadi'); process.exit(1); }
      onbellek.kayit[n] = k;
      fs.writeFileSync(onbellekYolu, JSON.stringify(onbellek));
    }
    const p = S.bolumProfili(n);
    console.log(n + ' ' + p.tur + ' tohum ' + k[0] + ' (aday ' + k[3] + ') tuzak ' + k[1] + ' cozum ' + k[2] +
      ' perde ' + p.gizliTup + '  ' + Math.round((Date.now() - bas) / 1000) + 's');
    kayitlar.push([k[0], k[1], k[2]]);
  }
  if (!kuru) { tabloYaz(kayitlar); console.log('yazildi: ' + TABLO); }
}

module.exports = {
  AYAR, butce, cozumPencere, yukle, altSinir, enKisaCozum, yoluDogrula, dfsCozum,
  yolTuzakOrani, bilgisizBot, bilgisizOlcut, bilgisizBasarisiz, perdeliMi, farkliBoy, tahta, adayTohum
};

if (require.main === module) main();
