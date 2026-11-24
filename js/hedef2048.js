// hedef2048.js — tahta secim ekrani + 2048 oyun mantigi
  // ==== H2048 ACMA SAF BASLANGIC ====
  // Tahta acma zinciri (TEK tablo). DOM'a dokunmaz; tools/h2048AcmaTest.js bu iki
  // isaret arasini da kesip node'da dener.
  //   - 5x5 bastan acik. Bir tahtada hedef karo (birlesme sonucu >= hedef) olusunca
  //     sonraki tahta acilir. 10x10'da hedef yok (sonsuz).
  //   - Sahiplik: AppProgress.boards (eski surumde altinla alinanlar da burada; acik kalir).
  window.H2048Acma = (function(){
    const ZINCIR = [
      {size:5,  hedef:2048,  sonraki:6},
      {size:6,  hedef:4096,  sonraki:7},
      {size:7,  hedef:8192,  sonraki:8},
      {size:8,  hedef:16384, sonraki:9},
      {size:9,  hedef:32768, sonraki:10},
      {size:10, hedef:0,     sonraki:0}      // hedef yok
    ];
    function bul(size){ return ZINCIR.find(z => z.size === size) || null; }
    function hedef(size){ const z = bul(size); return z ? z.hedef : 0; }
    function sonraki(size){ const z = bul(size); return z ? z.sonraki : 0; }
    // Acik tahtalar: kayit yoksa / bozuksa [5]; 5 her zaman acik.
    function sahipler(p){
      const o = (p && Array.isArray(p.boards)) ? p.boards.filter(n => typeof n === 'number') : [];
      if(o.indexOf(5) < 0) o.unshift(5);
      return o;
    }
    // Bu birlesme degeri bir tahta aciyor mu? Aciyorsa acilacak boyut, yoksa 0.
    // Sonraki tahta zaten acik (or. eskiden altinla alinmis) ise 0: kutlama da yok.
    function acilacak(p, size, deger){
      const h = hedef(size), s = sonraki(size);
      if(!h || !s || !(deger >= h)) return 0;
      return sahipler(p).indexOf(s) < 0 ? s : 0;
    }
    // Kilitli tahta etiketi: onceki tahtanin hedefi
    function kilitMetni(size){
      const onceki = ZINCIR.find(z => z.sonraki === size);
      return onceki ? 'Önceki tahtada ' + onceki.hedef + ' karosuna ulaş' : '';
    }
    // Belirtme hali eki (okunusa gore): bes-i, alti-yi, yedi-yi, sekiz-i, dokuz-u, on-u
    const EK = {5:"'i", 6:"'yı", 7:"'yi", 8:"'i", 9:"'u", 10:"'u"};
    function boyutEkli(size){ return size + 'x' + size + (EK[size] || "'i"); }
    return { ZINCIR: ZINCIR, hedef: hedef, sonraki: sonraki, sahipler: sahipler,
             acilacak: acilacak, kilitMetni: kilitMetni, boyutEkli: boyutEkli };
  })();
  // ==== H2048 ACMA SAF SON ====
// ============ HEDEF 2048 — TAHTA SECIM EKRANI ============
  (function(){
    // 5x5 bastan acik; digerleri bir onceki tahtada hedef karoya ulasinca acilir (H2048Acma)
    const BOARDS = window.H2048Acma.ZINCIR;
    const stage = document.getElementById('bdStage');
    const hintEl = document.getElementById('bdHint');
    const backCenter = document.getElementById('bdBackCenter');
    let centered = null;      // o an ortadaki tahta boyutu
    let tilesEl = {};

    function owned(){
      return new Set(window.H2048Acma.sahipler(window.AppProgress));
    }

    function hexPositions(){
      // merkez + cevresinde 6 nokta (fotoğraftaki altigen dizilim)
      const w = stage.clientWidth || 340, hgt = stage.clientHeight || 420;
      const cx = w/2, cy = hgt/2;
      const rx = Math.min(w*0.34, 128), ry = Math.min(hgt*0.30, 150);
      return [
        {x:cx,        y:cy},              // merkez (secili)
        {x:cx-rx,     y:cy-ry},
        {x:cx+rx,     y:cy-ry},
        {x:cx-rx*1.18,y:cy},
        {x:cx+rx*1.18,y:cy},
        {x:cx-rx,     y:cy+ry},
        {x:cx+rx,     y:cy+ry}
      ];
    }

    function render(){
      const pos = hexPositions();
      const own = owned();
      stage.querySelectorAll('.bd-tile').forEach(el => el.remove());
      tilesEl = {};

      const small = Math.min(stage.clientWidth*0.24, 92);
      const big   = Math.min(stage.clientWidth*0.42, 165);

      let slotIdx = 0;
      BOARDS.forEach((b) => {
        const isCenter = centered === b.size;
        const slot = isCenter ? pos[0] : pos[++slotIdx];
        const el = document.createElement('div');
        el.className = 'bd-tile' + (own.has(b.size) ? '' : ' locked') + (isCenter ? ' center' : '');
        el.style.width = (isCenter ? big : small) + 'px';
        el.style.left = slot.x + 'px';
        el.style.top  = slot.y + 'px';
        el.dataset.size = b.size;

        let cells = '';
        for(let k=0;k<b.size*b.size;k++) cells += '<i></i>';
        const gridStyle = 'grid-template-columns:repeat(' + b.size + ',1fr);grid-template-rows:repeat(' + b.size + ',1fr);';
        let lock = '';
        if(!own.has(b.size)){
          lock = '<div class="bd-lock">' +
                 '<svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
                 '<span class="bd-kosul">' + window.H2048Acma.kilitMetni(b.size) + '</span></div>';
        }
        el.innerHTML = '<div class="face"><div class="grid" style="' + gridStyle + '">' + cells + '</div>' + lock + '</div>' +
                       '<div class="label">' + b.size + 'x' + b.size + '</div>';
        stage.appendChild(el);
        tilesEl[b.size] = el;
      });

      stage.classList.toggle('focused', centered !== null);
      document.getElementById('screen-2048-boards').classList.toggle('focused', centered !== null);
      backCenter.classList.toggle('show', centered !== null);

      if(centered === null){
        hintEl.textContent = 'Bir tahta seç';
      } else if(own.has(centered)){
        hintEl.textContent = centered + 'x' + centered + ' — oynamak için tekrar dokun';
      } else {
        hintEl.textContent = window.H2048Acma.kilitMetni(centered);
      }
    }

    stage.addEventListener('click', (e) => {
      const t = e.target.closest('.bd-tile');
      if(!t) return;
      const size = Number(t.dataset.size);
      // Bir kare ortadayken sadece o kare tiklanabilir; digerlerine dokunmak bir sey yapmaz.
      // Secimden cikis yalnizca geri tusu (ekrandaki veya telefonun) ile olur.
      if(centered !== null && centered !== size) return;
      if(centered !== size){ centered = size; render(); return; }   // once ortaya getir
      const own = owned();
      if(own.has(size)){
        if(window.Game2048) window.Game2048.start(size);
        slideForward('boards2048','game2048');
        if(window.AppGold) window.AppGold.render();
      } else {
        // kilitli: altinla acma yok, yalnizca kosul hatirlatilir
        hintEl.textContent = window.H2048Acma.kilitMetni(size);
        if(window.AppFX) window.AppFX.tone(220, 150, 0.18, 'sine', 0.1);
      }
    });

    backCenter.addEventListener('click', () => { centered = null; render(); });
    window.addEventListener('resize', () => { if(screens.boards2048) render(); });

    window.Boards2048 = {
      open(){ centered = null; render(); if(window.AppGold) window.AppGold.render(); },
      // telefonun geri tusu: once ortadaki secimi birak, sonra ekrandan cik
      handleBack(){
        if(centered !== null){ centered = null; render(); return true; }
        return false;
      }
    };
  })();
  // ==== H2048 IKINCI SANS SAF BASLANGIC ====
  // Ikinci sans (reklam izle ve devam et): silinecek karolari secen SAF kod. DOM'a
  // dokunmaz; tools/h2048IkinciSansTest.js bu iki isaret arasini kesip node'da dener.
  // Karo: {r, c, value, lock, wild, wall} (oyunun kendi karo nesneleri).
  //   - Aday: duvar degil, joker degil, degeri > 0. Duvar ve jokere hic dokunulmaz.
  //   - En kucuk degerden baslanir (2, sonra 4, sonra 8 ...), en fazla `adet` (6) karo.
  //   - Bir degerin hepsi sigmiyorsa DAGINIK secilir: her adimda o ana kadar secilenlere
  //     en kucuk Manhattan uzakligi EN BUYUK olan aday alinir; esitlikte rastgele.
  //   - Silme sonrasi hamle yoksa bir karo daha silinir (once tek basina hamle acan en
  //     kucuk aday; yoksa en kucuk dagik aday) ve yeniden denenir.
  window.H2048IkinciSans = (function(){
    function eslesir(a, b){                      // oyundaki canPair ile ayni kural
      if(a.wall || b.wall) return false;
      if(a.lock > 0 || b.lock > 0) return false;
      if(a.wild && b.wild) return false;
      if(a.wild || b.wild) return true;
      return a.value === b.value;
    }
    // Gercek hamle denetimi: hareket edebilen (duvar/kilitli olmayan) bir karonun
    // yaninda bos hucre ya da birlesebilecegi bir karo var mi.
    function hamleVarMi(karolar, boyut){
      const iz = {}; karolar.forEach(t => { iz[t.r + '_' + t.c] = t; });
      const yon = [[0,1],[1,0],[0,-1],[-1,0]];
      for(const a of karolar){
        if(a.wall || a.lock > 0) continue;
        for(const [dr, dc] of yon){
          const r = a.r + dr, c = a.c + dc;
          if(r < 0 || c < 0 || r >= boyut || c >= boyut) continue;
          const b = iz[r + '_' + c];
          if(!b || eslesir(a, b)) return true;
        }
      }
      return false;
    }
    function sec(karolar, boyut, o){
      o = o || {};
      const adet = (typeof o.adet === 'number') ? o.adet : 6;
      const rnd = o.rastgele || Math.random;
      const adaylar = karolar.filter(t => !t.wall && !t.wild && t.value > 0);
      const secilen = [];
      const uzak = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
      const rastgeleBirini = liste => liste[Math.min(liste.length - 1, Math.floor(rnd() * liste.length))];
      function enDagik(grup){                    // secilenlere en uzak aday(lar)dan biri
        let iyi = [], iyiU = -1;
        grup.forEach(t => {
          let u = Infinity;
          secilen.forEach(s => { const d = uzak(s, t); if(d < u) u = d; });
          if(!secilen.length) u = 0;
          if(u > iyiU){ iyiU = u; iyi = [t]; } else if(u === iyiU) iyi.push(t);
        });
        return rastgeleBirini(iyi);
      }
      const degerler = Array.from(new Set(adaylar.map(t => t.value))).sort((a, b) => a - b);
      for(const v of degerler){
        const yer = adet - secilen.length;
        if(yer <= 0) break;
        const grup = adaylar.filter(t => t.value === v);
        if(grup.length <= yer){ grup.forEach(t => secilen.push(t)); continue; }
        for(let k = 0; k < yer; k++){ const t = enDagik(grup); secilen.push(t); grup.splice(grup.indexOf(t), 1); }
      }
      const kalanlar = () => karolar.filter(t => secilen.indexOf(t) < 0);
      while(!hamleVarMi(kalanlar(), boyut)){
        const geri = adaylar.filter(t => secilen.indexOf(t) < 0);
        if(!geri.length) break;
        const sirali = Array.from(new Set(geri.map(t => t.value))).sort((a, b) => a - b);
        let ek = null;
        for(const v of sirali){                  // tek basina hamle acan en kucuk aday
          const acan = geri.filter(t => t.value === v &&
            hamleVarMi(karolar.filter(x => x !== t && secilen.indexOf(x) < 0), boyut));
          if(acan.length){ ek = enDagik(acan); break; }
        }
        if(!ek) ek = enDagik(geri.filter(t => t.value === sirali[0]));
        secilen.push(ek);
      }
      return { sil: secilen, hamleVar: hamleVarMi(kalanlar(), boyut) };
    }
    return { sec: sec, hamleVarMi: hamleVarMi };
  })();
  // ==== H2048 IKINCI SANS SAF SON ====
  // ============ HEDEF 2048 GAME LOGIC ============
  (function(){
    let SIZE = 5;
    const boardEl = document.getElementById('board');
    const tileLayer = document.getElementById('tileLayer');
    const scoreValEl = document.getElementById('scoreVal');
    const bestValEl = document.getElementById('bestVal');
    const scoreBoxEl = document.getElementById('scoreBox');
    const overlayEl = document.getElementById('overlay');
    const overlayMsg = document.getElementById('overlayMsg');
    const overlaySub = document.getElementById('overlaySub');
    const overlayBtn = document.getElementById('overlayBtn');
    const restartBtn = document.getElementById('restartBtn');
    let tiles = [], nextId = 1, score = 0, recordBroken = false, animating = false, cellStep = 0, gamesStarted = 0;
    let milestonesHit = new Set();   // sadece o oyundaki ILK 32/64/128... icin ses
    // IKINCI SANS: kosu basina 1 kez. kosuNo her yeni oyunda / geri yuklemede artar;
    // reklam sonucu geldiginde hala ayni kosuda miyiz diye bakilir.
    let ikinciSansKullanildi = false, kosuNo = 0;
    // TAHTA ACILDI KUTLAMASI: acikken hamle yapilmaz (klavye, kaydirma, kuyruk).
    let kutlamaAcik = false, kutlamaTimer = 0;
    function bestKey(){ return 'b' + SIZE; }
    function loadBest(){
      const rec = (window.AppProgress && window.AppProgress.bests) || {};
      return rec[bestKey()] || 0;
    }
    let best = 0;
    const domTiles = new Map();
    let audioCtx = null;
    function ensureAudio(){ if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } if(audioCtx.state === 'suspended'){ audioCtx.resume(); } return audioCtx; }
    function playTone(freqStart, freqEnd, duration, type, gainPeak){
      const ctx = ensureAudio(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,1), ctx.currentTime + duration);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      const v = window.AppFX ? window.AppFX.vol() : 1;
      if(v <= 0) return;
      gain.gain.linearRampToValueAtTime(gainPeak * v, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration + 0.03);
    }
    function playLoseSound(){ playTone(300, 90, 0.5, 'sine', 0.16); }
    function showTileReward(amount){
      const host = document.getElementById('screen-game-2048');
      const b = document.createElement('div');
      b.className = 'tile-reward';
      b.innerHTML = window.CoinSVG(true) + '<span>+' + amount + '</span>';
      host.appendChild(b);
      setTimeout(() => b.remove(), 1500);
    }
    // "dın-dı-rı-dın" — her yeni kilometre tasi icin bir kez, degeri yukseldikce tizlesir
    // Ulasilan her yeni kutu icin altin — sadece o oyunda ILK kez ulasildiginda
    const TILE_GOLD = {
      256:10, 512:25, 1024:60, 2048:150, 4096:300, 8192:600, 16384:1100,
      32768:2000, 65536:3500, 131072:6000, 262144:10000, 524288:17000, 1048576:30000
    };
    // --- kilitli karo / joker ---
    const LOCK_TURNS = 3;                  // kac hamlede cozulur
    function lockChance(){
      if(score < 500) return 0;            // ogrenme suresi
      return Math.min((SIZE*SIZE) / 500, 0.20);         // 5x5 %5 -> 10x10 %20
    }
    function wildChance(){
      return score < 1500 ? 0 : 0.015;
    }
    function canPair(a, b){
      if(a.wall || b.wall) return false;           // duvar hicbir seyle birlesmez
      if(a.lock > 0 || b.lock > 0) return false;   // kilitli karo birlesmez
      if(a.wild && b.wild) return false;           // joker + joker birlesmez
      if(a.wild || b.wild) return true;
      return a.value === b.value;
    }
    function pairValue(a, b){
      if(a.wild) return b.value * 2;
      return a.value * 2;                          // b.wild olsa da survivor'in degeri esas
    }
    function wallCount(){ return Math.floor(SIZE*SIZE / 20); }   // 5x5:1 ... 10x10:5
    function placeWalls(){
      const n = wallCount(); if(n <= 0) return;
      const banned = new Set(['0_0', '0_'+(SIZE-1), (SIZE-1)+'_0', (SIZE-1)+'_'+(SIZE-1)]);
      const used = new Set(); let tries = 0;
      while(used.size < n && tries++ < 300){
        const r = Math.floor(Math.random()*SIZE), c = Math.floor(Math.random()*SIZE);
        const key = r+'_'+c;
        if(banned.has(key) || used.has(key)) continue;              // kose ve tekrar yok
        if(used.has((r-1)+'_'+c) || used.has((r+1)+'_'+c) ||
           used.has(r+'_'+(c-1)) || used.has(r+'_'+(c+1))) continue; // yan yana duvar yok
        used.add(key);
        tiles.push({id:nextId++, value:0, r, c, lock:0, wild:false, wall:true});
      }
    }
    function playMilestoneSound(value){
      const step = Math.log2(value) - 5;                 // 32 -> 0
      const base = 523.25 * Math.pow(1.055, Math.min(step, 8));
      [[base,0],[base*1.26,65],[base*1.5,130],[base*2,200]].forEach(([f,d],i) => {
        setTimeout(() => playTone(f, f, i === 3 ? 0.2 : 0.11, 'triangle', 0.13), d);
      });
    }
    function playWinSound(){ const notes=[523.25,659.25,783.99]; notes.forEach((f,i)=>setTimeout(()=>playTone(f,f,0.18,'triangle',0.14), i*90)); }
    // KONUM: tahtanin merkezi, ust cubugun altindaki oyun alaninin tepesinden
    // %55'te durur. Kenar; genislikten, skor satirina carpmama ve alttan
    // tasmama kosullarindan hesaplanir. offset* degerleri kullanilir ki ekran
    // kayarken (transform) de dogru olculsun.
    const KONUM = { merkez: 0.55, yanBosluk: 20, altBosluk: 14, ustBosluk: 10 };
    const ekran2048 = document.getElementById('screen-game-2048');
    const topbarEl = ekran2048.querySelector('.topbar');
    const controlsEl = ekran2048.querySelector('.controls-row');
    const wrapEl = ekran2048.querySelector('.board-wrap');
    function yerles(){
      const ekran = ekran2048;
      const alanUst = topbarEl.offsetTop + topbarEl.offsetHeight;
      const alanH = ekran.clientHeight - alanUst;
      if(alanH <= 0) return;
      const merkezY = alanUst + alanH * KONUM.merkez;
      const skorAlt = controlsEl.offsetTop + controlsEl.offsetHeight;
      const kenar = Math.floor(Math.max(120, Math.min(
        ekran.clientWidth - KONUM.yanBosluk * 2,
        2 * (ekran.clientHeight - KONUM.altBosluk - merkezY),
        2 * (merkezY - skorAlt - KONUM.ustBosluk))));
      boardEl.style.width = kenar + 'px';
      boardEl.style.height = kenar + 'px';
      boardEl.style.left = Math.round((ekran.clientWidth - kenar) / 2) + 'px';
      boardEl.style.top = Math.round(merkezY - kenar / 2 - wrapEl.offsetTop) + 'px';
    }
    function buildBoardCells(){
      boardEl.querySelectorAll('.cell-bg').forEach(el => el.remove());
      boardEl.style.setProperty('--grid-size', SIZE);
      yerles();
      if(window.AppMarket) window.AppMarket.karoTemasiUygula(boardEl);
      const frag = document.createDocumentFragment();
      for(let i=0;i<SIZE*SIZE;i++){ const d=document.createElement('div'); d.className='cell-bg'; frag.appendChild(d); }
      boardEl.insertBefore(frag, tileLayer);
    }
    function measure(){
      const cells = boardEl.querySelectorAll('.cell-bg');
      const rect1 = cells[0].getBoundingClientRect(); const rect2 = cells[1].getBoundingClientRect();
      cellStep = rect2.left - rect1.left; return rect1.width;
    }
    function emptyCells(){
      const occ = new Set(tiles.map(t => t.r + '_' + t.c)); const out = [];
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!occ.has(r+'_'+c)) out.push([r,c]);
      return out;
    }
    function spawnTile(){
      const empties = emptyCells(); if(empties.length === 0) return null;
      const [r,c] = empties[Math.floor(Math.random()*empties.length)];
      const tile = {id:nextId++, value:2, r, c, lock:0, wild:false};
      const roll = Math.random(), wc = wildChance();
      if(roll < wc){
        tile.wild = true; tile.value = 0;
      } else {
        tile.value = Math.random() < 0.9 ? 2 : 4;
        if(roll < wc + lockChance()) tile.lock = LOCK_TURNS;
      }
      tiles.push(tile); return tile;
    }
    // --- oyun durumu: AYNI ANDA TEK aktif oyun tutulur ---
    // Tahta basina ayri kayit tutmak hem bellegi sisirir hem de "hangi oyun aktif"
    // sorusunu bulaniklastirir. Tek slot: baska tahtaya gecmek eskisini siler (onay sorarak).
    let liveSession = null;                  // bu oturumda bellekteki aktif oyun
    function snapshot(){
      const snap = { size: SIZE, score: score,
               tiles: tiles.map(t => [t.r, t.c, t.value, t.lock || 0, t.wild ? 1 : 0, t.wall ? 1 : 0]),
               milestones: Array.from(milestonesHit) };
      // opsiyonel alan: yalnizca ikinci sans kullanildiysa yazilir (eski kayitlarda yok = kullanilmadi)
      if(ikinciSansKullanildi) snap.ikinciSans = 1;
      return snap;
    }
    function savedActive(){
      const st = window.AppProgress && window.AppProgress.g2048active;
      return (st && st.tiles && st.tiles.length && st.score > 0) ? st : null;
    }
    function saveState(){
      const snap = snapshot();
      liveSession = snap;
      if(window.AppSaveProgress) window.AppSaveProgress({g2048active: snap});
    }
    function clearActive(){
      liveSession = null;
      if(window.AppSaveProgress) window.AppSaveProgress({g2048active: null});
    }
    function restoreState(st){
      kutlamaKapat();
      SIZE = st.size;
      buildBoardCells();
      tiles = []; domTiles.forEach(el => el.remove()); domTiles.clear(); parcaTemizle();
      nextId = 1;
      st.tiles.forEach(a => tiles.push({id: nextId++, value: a[2], r: a[0], c: a[1],
                                        lock: a[3] || 0, wild: !!a[4], wall: !!a[5]}));
      score = st.score;
      best = loadBest();
      milestonesHit = new Set(st.milestones || []);
      ikinciSansKullanildi = !!st.ikinciSans; kosuNo++;
      gamesStarted = Math.max(gamesStarted, 2);   // rekor isigi calissin
      recordBroken = score > 0 && score >= best;
      scoreBoxEl.classList.toggle('record', recordBroken);
      scoreBoxEl.classList.toggle('normal', !recordBroken);
      overlayEl.classList.remove('show');
      render();
      liveSession = snapshot();
      onMesajKontrol();
      // Hamlesiz kayit (eski surum / kutlama acikken kapanma): oyuncu sikismasin;
      // kilit cozme, ikinci sans ve kayip mevcut sirayla calisir.
      if(!canMove()) evaluateAfterMove();
    }

    // Yeni oyun DISKE YAZILMAZ: kayit yalnizca ilk hamleyle olusur. Eskiden dosya
    // her yuklendiginde bos bir oyun kaydedilip yarim kalan oyunun ustune
    // yaziliyordu; "kaldigin yerden devam" hic cikmiyordu.
    function newGame(){
      kutlamaKapat();
      gamesStarted++; tiles = []; milestonesHit = new Set(); domTiles.forEach(el => el.remove()); domTiles.clear(); parcaTemizle();
      score = 0; recordBroken = false; ikinciSansKullanildi = false; kosuNo++;
      scoreBoxEl.classList.remove('record'); scoreBoxEl.classList.add('normal');
      rozetGizle();
      overlayEl.classList.remove('show'); placeWalls(); spawnTile(); spawnTile(); render();
      liveSession = null;
    }
    // Oyuncu kendi istegiyle bastan baslarsa diskteki yarim oyun da silinir
    function yenidenBasla(){ clearActive(); newGame(); }
    let lastCw = 0;
    function render(){
      const cw = measure();
      if(!cw || !cellStep) return;   // ekran gizliyken olculer 0 gelir, cizme
      const sizeChanged = (cw !== lastCw); lastCw = cw;
      tiles.forEach(t => {
        let el = domTiles.get(t.id); const isNewEl = !el;
        if(isNewEl){ el = document.createElement('div'); el.className = 'tile pop'; tileLayer.appendChild(el); domTiles.set(t.id, el); el.addEventListener('animationend', () => el.classList.remove('pop','merged'), {once:true}); }
        el.style.width = cw + 'px'; el.style.height = cw + 'px';
        const key = t.wall ? 'X' : (t.wild ? 'w' : (t.value + '|' + t.lock));
        if(sizeChanged || el.dataset.k !== key){
          el.dataset.k = key;
          el.dataset.v = t.wall ? 'wall' : (t.wild ? 'wild' : t.value);
          el.classList.toggle('locked', t.lock > 0);
          if(t.lock > 0) el.dataset.lock = t.lock; else el.removeAttribute('data-lock');
          el.textContent = t.wall ? '' : (t.wild ? '★' : t.value);
          const d = t.wall ? 2 : (t.wild ? 2 : String(t.value).length);
          const ratio = d <= 2 ? 0.42 : d === 3 ? 0.34 : d === 4 ? 0.27 : d === 5 ? 0.22 : 0.19;
          el.style.fontSize = Math.round(cw * ratio) + 'px';
        }
        el.style.translate = (t.c * cellStep) + 'px ' + (t.r * cellStep) + 'px';
        if(t.justMerged && !isNewEl){ el.classList.add('merged'); } t.justMerged = false;
      });
      const liveIds = new Set(tiles.map(t => t.id));
      domTiles.forEach((el, id) => { if(!liveIds.has(id)){ el.remove(); domTiles.delete(id); } });
      scoreValEl.textContent = score; bestValEl.textContent = best;
    }
    function lineOrder(dir){
      const lines = [];
      if(dir === 'left'){ for(let r=0;r<SIZE;r++){ const line=[]; for(let c=0;c<SIZE;c++) line.push([r,c]); lines.push(line); } }
      else if(dir === 'right'){ for(let r=0;r<SIZE;r++){ const line=[]; for(let c=SIZE-1;c>=0;c--) line.push([r,c]); lines.push(line); } }
      else if(dir === 'up'){ for(let c=0;c<SIZE;c++){ const line=[]; for(let r=0;r<SIZE;r++) line.push([r,c]); lines.push(line); } }
      else if(dir === 'down'){ for(let c=0;c<SIZE;c++){ const line=[]; for(let r=SIZE-1;r>=0;r--) line.push([r,c]); lines.push(line); } }
      return lines;
    }
    let queuedDir = null;
    function move(dir){
      if(kutlamaAcik) return;                    // tahta acildi kutlamasi: girdi oyunu oynatmaz
      if(animating){ queuedDir = dir; return; }
      const grid = {}; tiles.forEach(t => { grid[t.r+'_'+t.c] = t; });
      const lines = lineOrder(dir); let movedAny = false, scoreGain = 0; const removeIds = new Set();

      lines.forEach(line => {
        const cellTiles = line.map(([r,c]) => grid[r+'_'+c] || null);
        let segCells = [], segTiles = [];          // kilitli karolar satiri parcalara boler
        const flush = () => {
          if(segCells.length){
            const result = []; const riders = new Map(); let i = 0;
            while(i < segTiles.length){
              if(i+1 < segTiles.length && canPair(segTiles[i], segTiles[i+1])){
                const survivor = segTiles[i], removed = segTiles[i+1];
                const newVal = pairValue(survivor, removed);
                survivor.pendingValue = newVal;
                riders.set(survivor.id, removed);
                if(newVal >= 32 && !milestonesHit.has(newVal)){
                  milestonesHit.add(newVal);
                  playMilestoneSound(newVal);
                  const reward = TILE_GOLD[newVal];
                  if(reward && window.AppGold){ window.AppGold.add(reward); showTileReward(reward); }
                }
                scoreGain += newVal; removeIds.add(removed.id); result.push(survivor); i += 2;
              } else { result.push(segTiles[i]); i += 1; }
            }
            for(let idx=0; idx<segCells.length; idx++){
              const [r,c] = segCells[idx]; const tile = result[idx];
              if(tile){
                if(tile.r !== r || tile.c !== c) movedAny = true;
                tile.r = r; tile.c = c;
                const rider = riders.get(tile.id);
                if(rider){ rider.r = r; rider.c = c; }
              }
            }
          }
          segCells = []; segTiles = [];
        };
        for(let k=0;k<line.length;k++){
          const [r,c] = line[k]; const t = cellTiles[k];
          if(t && (t.lock > 0 || t.wall)){ flush(); }   // kilit veya duvar: segmenti kapat
          else { segCells.push(line[k]); if(t) segTiles.push(t); }
        }
        flush();
      });
      if(removeIds.size > 0) movedAny = true;

      if(!movedAny){ tiles.forEach(t => { t.pendingValue = null; }); return; }
      score += scoreGain; animating = true;
      render();
      setTimeout(() => {
        const buyukler = [];
        let acilan = 0, hedefKaro = null;          // bu hamle yeni bir tahta acti mi
        tiles.forEach(t => {
          if(t.pendingValue){ t.value = t.pendingValue; t.pendingValue = null; t.wild = false; t.justMerged = true;
            if(t.value >= BUYUK_BIRLESME) buyukler.push(t);
            if(!acilan){ acilan = window.H2048Acma.acilacak(window.AppProgress, SIZE, t.value); if(acilan) hedefKaro = t; } }
        });
        tiles = tiles.filter(t => !removeIds.has(t.id));
        tiles.forEach(t => { if(t.lock > 0) t.lock--; });   // kilitler sadece basarili hamlede erir
        spawnTile(); render(); animating = false;
        buyukler.forEach(buyukBirlesme);
        if(acilan){
          // Hedefte oyun BITMEZ. Tahta acilisi hemen kaydedilir; hamle sonu (rekor disinda)
          // "devam et"e kadar bekler. Hamle tahtayi tikadiysa durum YAZILMAZ, kayit silinir
          // (kayip akisindaki gibi): pencere acikken kapanirsa kosu kaybedilmis sayilir.
          tahtaAc(acilan);
          if(canMove()) saveState(); else clearActive();
          rekorGuncelle(true); queuedDir = null; kutlamaGoster(acilan, hedefKaro); return;
        }
        saveState();
        evaluateAfterMove();
        if(queuedDir){ const d = queuedDir; queuedDir = null; move(d); }
      }, 140);
    }
    // 128 ve ustu birlesmeler: daha guclu ziplama + karonun renginde parcaciklar
    // + kisa titresim. Yalnizca transform/opacity canlanir.
    const BUYUK_BIRLESME = 128;
    function buyukBirlesme(t){
      const el = domTiles.get(t.id);
      if(!el) return;
      el.classList.remove('merged'); void el.offsetWidth; el.classList.add('buyuk');
      el.addEventListener('animationend', () => el.classList.remove('buyuk'), {once:true});
      if(window.AppFX) window.AppFX.vibrate(t.value >= 1024 ? [16, 30, 22] : 14);
      if(document.querySelector('.phone.reduced-motion')) return;
      const cw = parseFloat(el.style.width) || 40;
      const renk = getComputedStyle(el).backgroundColor;
      const adet = Math.min(16, 6 + 2 * (Math.log2(t.value) - 7));
      for(let i = 0; i < adet; i++){
        const p = document.createElement('i');
        p.className = 'tile-parca';
        const aci = (i / adet) * Math.PI * 2 + Math.random() * 0.5, uzak = cw * (0.7 + Math.random() * 0.6);
        p.style.left = (t.c * cellStep + cw / 2) + 'px';
        p.style.top  = (t.r * cellStep + cw / 2) + 'px';
        p.style.backgroundColor = renk;
        p.style.setProperty('--dx', (Math.cos(aci) * uzak).toFixed(0) + 'px');
        p.style.setProperty('--dy', (Math.sin(aci) * uzak).toFixed(0) + 'px');
        tileLayer.appendChild(p);
        setTimeout(() => p.remove(), 620);
      }
    }
    // "Yeni rekor" rozeti: skor kutusunun altinda kisa sure gorunur
    let rozetEl = null, rozetTimer = null;
    function rozetGoster(){
      if(!rozetEl){
        rozetEl = document.createElement('div');
        rozetEl.className = 'rekor-rozet';
        rozetEl.textContent = 'Yeni rekor';
        scoreBoxEl.parentNode.appendChild(rozetEl);
      }
      rozetEl.classList.remove('show'); void rozetEl.offsetWidth; rozetEl.classList.add('show');
      clearTimeout(rozetTimer);
      rozetTimer = setTimeout(rozetGizle, 2600);
    }
    function rozetGizle(){ clearTimeout(rozetTimer); if(rozetEl) rozetEl.classList.remove('show'); }
    function canMove(){
      if(emptyCells().length > 0) return true;
      const grid = {}; tiles.forEach(t => grid[t.r+'_'+t.c] = t);
      for(let r=0;r<SIZE;r++){ for(let c=0;c<SIZE;c++){
        const a = grid[r+'_'+c]; if(!a) continue;
        const right = grid[r+'_'+(c+1)], down = grid[(r+1)+'_'+c];
        if(c+1<SIZE && right && canPair(a, right)) return true;
        if(r+1<SIZE && down  && canPair(a, down))  return true;
      } }
      return false;
    }
    // Yeni rekorda yazi cikmaz; kenarlarda guclu, merkezde daha soluk bir isik parlar.
    const recordFxEl = document.getElementById('recordFx');
    function flashRecord(){
      recordFxEl.classList.remove('show'); void recordFxEl.offsetWidth; recordFxEl.classList.add('show');
      setTimeout(() => recordFxEl.classList.remove('show'), 1600);
    }
    function showLoseOverlay(){ overlayMsg.textContent='Hamle kalmadı'; overlaySub.textContent='Skorun: '+score; overlayBtn.style.display='inline-block'; overlayBtn.textContent='Yeniden Başla'; overlayEl.classList.add('show'); }
    function evaluateAfterMove(){
      rekorGuncelle();
      if(!canMove()){
        if(tiles.some(t => t.lock > 0)){        // sadece kilitler yuzunden tikandiysa hepsini coz
          tiles.forEach(t => t.lock = 0); render();
          if(canMove()){ if(window.AppFX) window.AppFX.tone(660, 200, 0.14, 'triangle', 0.12); return; }
        }
        kayip();
      }
    }
    // sessiz: ayni hamlede tahta da acildiysa rekor sesi calmaz (kutlama sesi tek calar)
    function rekorGuncelle(sessiz){
      if(score > best){
        best = score; bestValEl.textContent = best;
        if(window.AppSaveProgress){
          window.AppProgress.bests = window.AppProgress.bests || {};
          window.AppProgress.bests[bestKey()] = best;
          window.AppSaveProgress({bests: window.AppProgress.bests});
        }
        if(!recordBroken && gamesStarted > 1){ recordBroken = true; scoreBoxEl.classList.remove('normal'); scoreBoxEl.classList.add('record'); if(!sessiz) playWinSound(); flashRecord();
          rozetGoster(); if(window.AppFX) window.AppFX.vibrate([18, 40, 18, 40, 26]); }
      }
    }
    // Hamle kalmadi. Reklam destekleniyorsa ve bu kosuda kullanilmadiysa once ikinci
    // sans sorulur; yoksa (tarayici) eski kayip akisi AYNEN calisir.
    function kayip(){
      const R = window.Reklam;
      const secim = (!ikinciSansKullanildi && R && R.destekleniyor() && window.H2048IkinciSans)
        ? window.H2048IkinciSans.sec(tiles, SIZE) : null;
      if(!secim || !secim.sil.length || !secim.hamleVar){ playLoseSound(); showLoseOverlay(); clearActive(); return; }
      ikinciSansKullanildi = true;
      // Pencere/reklam acikken sayfa kapanirsa kosu kaybedilmis sayilir (eski akistaki gibi
      // kayit hemen silinir). Reklam izlenirse kayit ikinciSans:1 ile yeniden yazilir.
      clearActive();
      const kosu = kosuNo, silIds = new Set(secim.sil.map(t => t.id));
      R.ikinciSans({ baslik: 'Hamle kalmadı',
                     metin: 'Reklam izlersen en küçük ' + silIds.size + ' karo silinir, oyun sürer. Skorun: ' + score,
                     evet: 'Reklam izle ve devam et' })
        .then(ok => {
          if(kosu !== kosuNo) return;            // bu arada yeni oyun basladi: sonucu yok say
          if(ok) ikinciSansUygula(silIds, kosu);
          else { playLoseSound(); showLoseOverlay(); }
        });
    }
    // Secilen karolar kuculup kaybolur (azaltilmis hareket: hemen silinir), puan dusmez.
    function ikinciSansUygula(silIds, kosu){
      const azalt = !!document.querySelector('.phone.reduced-motion');
      animating = true;
      silIds.forEach(id => {
        const el = domTiles.get(id);
        if(el){ el.classList.remove('pop', 'merged', 'buyuk'); el.classList.add('ikinci-sil'); }
      });
      if(window.AppFX) window.AppFX.tone(660, 200, 0.14, 'triangle', 0.12);
      setTimeout(() => {
        animating = false;
        if(kosu !== kosuNo) return;
        tiles = tiles.filter(t => !silIds.has(t.id));
        render();
        saveState(); evaluateAfterMove();
        if(queuedDir){ const d = queuedDir; queuedDir = null; move(d); }
      }, azalt ? 0 : 260);
    }
    const gameScreenEl = document.getElementById('screen-game-2048');
    function gameVisible(){
      const cs = getComputedStyle(gameScreenEl);
      if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < .5) return false;
      const r = gameScreenEl.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 1 && r.left < window.innerWidth - 1;
    } 
    window.addEventListener('keydown', (e) => {
      if(!gameVisible()) return;
      if(resumeAsk.classList.contains('show')) return;   // pencere acikken (soru/kutlama) klavye oynatmaz
      const map = {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
                   a:'left', d:'right', w:'up', s:'down', A:'left', D:'right', W:'up', S:'down'};
      if(map[e.key]){ e.preventDefault(); move(map[e.key]); }
 });
    // KAYDIRMA: yalnizca tahtanin ustunde degil, ust cubugun altindaki butun
    // oyun alaninda algilanir (kenarlardan 10 px, ust cubuktan 12 px iceride).
    // Ust cubuktan ya da bir dugmeden baslayan kaydirma hamle sayilmaz.
    const KAYDIRMA = { kenar: 10, ust: 12 };
    let touchStartX = 0, touchStartY = 0, touchGecerli = false;
    gameScreenEl.addEventListener('touchstart', (e) => {
      touchGecerli = false;
      if(e.touches.length !== 1) return;
      if(resumeAsk.classList.contains('show') || overlayEl.classList.contains('show')) return;
      if(e.target.closest('button')) return;
      const t = e.touches[0], r = gameScreenEl.getBoundingClientRect();
      const ustSinir = r.top + topbarEl.offsetTop + topbarEl.offsetHeight + KAYDIRMA.ust;
      if(t.clientY < ustSinir || t.clientX < r.left + KAYDIRMA.kenar || t.clientX > r.right - KAYDIRMA.kenar) return;
      touchStartX = t.clientX; touchStartY = t.clientY; touchGecerli = true;
    }, {passive:true});
    gameScreenEl.addEventListener('touchend', (e) => {
      if(!touchGecerli) return;
      touchGecerli = false;
      const dx = e.changedTouches[0].clientX - touchStartX; const dy = e.changedTouches[0].clientY - touchStartY;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      const big = Math.max(absX, absY), small = Math.min(absX, absY);
      const th = Math.max(18, Math.min(cellStep * 0.35, 40));   // tahta buyudukce esik kuculur
      if(big < th) return;
      if(big < small * 1.1) return;                             // cok capraz -> hamle sayma
      if(absX > absY){ move(dx > 0 ? 'right' : 'left'); } else { move(dy > 0 ? 'down' : 'up'); }
    }, {passive:true});
    gameScreenEl.addEventListener('touchcancel', () => { touchGecerli = false; }, {passive:true});
    restartBtn.addEventListener('click', yenidenBasla);
    overlayBtn.addEventListener('click', yenidenBasla);
    window.addEventListener('resize', () => { yerles(); render(); });
    if(window.AppReset){
      window.AppReset.push(function(){ SIZE = 5; best = 0; liveSession = null; bestValEl.textContent = '0'; gamesStarted = 0; buildBoardCells(); newGame(); });
    }
    // Tahta secim ekrani buradan baslatir
    const resumeAsk = document.getElementById('resumeAsk');
    const raTitleEl = document.getElementById('raTitle');
    const raSub = document.getElementById('raSub');
    const raYesBtn = document.getElementById('raYes');
    const raNoBtn  = document.getElementById('raNo');
    let onYes = null, onNo = null;

    // noLabel null: tek dugmeli pencere. sinif: ek gorunum ('kutlama').
    function askDialog(title, sub, yesLabel, noLabel, yesFn, noFn, sinif){
      raTitleEl.textContent = title;
      raSub.textContent = sub;
      raYesBtn.textContent = yesLabel;
      raNoBtn.textContent  = noLabel || '';
      raNoBtn.style.display = noLabel ? '' : 'none';
      resumeAsk.classList.toggle('kutlama', sinif === 'kutlama');
      onYes = yesFn; onNo = noFn;
      resumeAsk.classList.add('show');
    }
    raYesBtn.addEventListener('click', () => {
      resumeAsk.classList.remove('show');
      const f = onYes; onYes = onNo = null; if(f) f();
    });
    raNoBtn.addEventListener('click', () => {
      resumeAsk.classList.remove('show');
      const f = onNo; onYes = onNo = null; if(f) f();
    });

    function beginNew(size){
      SIZE = size; best = loadBest(); buildBoardCells(); newGame(); onMesajKontrol();
    }

    // --- tahta acma (zincir: H2048Acma) ---
    function tahtaAc(size){
      const list = window.H2048Acma.sahipler(window.AppProgress);
      if(list.indexOf(size) < 0) list.push(size);
      window.AppProgress.boards = list;
      if(window.AppSaveProgress) window.AppSaveProgress({boards: list});
    }
    function kutlamaKapat(){
      clearTimeout(kutlamaTimer); kutlamaTimer = 0; kutlamaAcik = false;
      resumeAsk.classList.remove('kutlama');
    }
    // Hedef karo parlar + konfeti (1.5-2 sn); pencere 1500 ms sonra, animasyon
    // bitmek uzereyken acilir (azaltilmis harekette hemen). Sonraki tahta zaten
    // kaydedildi; pencere yalnizca secim icin.
    const KUTLAMA_GECIKME = 1500;
    function parcaTemizle(){ tileLayer.querySelectorAll('.tile-parca').forEach(p => p.remove()); }
    const KONFETI_RENK = ['#2FE07A', '#FBE7AE', '#7FE6DC', '#F0C25C', '#CFFFE2', '#8FF7B8'];
    function hedefParla(karo){
      const el = karo && domTiles.get(karo.id);
      if(!el) return;
      el.classList.remove('buyuk', 'merged', 'pop'); void el.offsetWidth; el.classList.add('hedef-parla');
      setTimeout(() => el.classList.remove('hedef-parla'), 1900);
      const cw = parseFloat(el.style.width) || 40;
      for(let i = 0; i < 26; i++){
        const p = document.createElement('i');
        p.className = 'tile-parca konfeti';
        const aci = Math.random() * Math.PI * 2, uzak = cw * (1.2 + Math.random() * 2.2);
        p.style.left = (karo.c * cellStep + cw / 2) + 'px';
        p.style.top  = (karo.r * cellStep + cw / 2) + 'px';
        p.style.backgroundColor = KONFETI_RENK[i % KONFETI_RENK.length];
        p.style.animationDelay = Math.round(Math.random() * 250) + 'ms';
        p.style.setProperty('--dx', (Math.cos(aci) * uzak).toFixed(0) + 'px');
        p.style.setProperty('--dy', (Math.sin(aci) * uzak).toFixed(0) + 'px');
        tileLayer.appendChild(p);
        setTimeout(() => p.remove(), 2000);
      }
    }
    function kutlamaGoster(acilan, karo){
      kutlamaAcik = true;
      const eski = SIZE, A = window.H2048Acma;
      const azalt = !!document.querySelector('.phone.reduced-motion');
      if(!azalt) hedefParla(karo);
      playWinSound();
      if(window.AppFX) window.AppFX.vibrate([20, 40, 20, 40, 30]);
      clearTimeout(kutlamaTimer);
      kutlamaTimer = setTimeout(() => {
        kutlamaTimer = 0;
        askDialog('Başardın! ' + acilan + 'x' + acilan + ' tahta açıldı',
          A.hedef(eski) + ' karosuna ulaştın.',
          eski + 'x' + eski + ' ile devam et',
          A.boyutEkli(acilan) + ' dene',
          // ayni oyun surer; tikali hamlede silinen kayit, oyun surebiliyorsa (kilit cozuldu) geri yazilir
          () => { kutlamaKapat(); evaluateAfterMove(); if(canMove()) saveState(); },
          // tek slot: mevcut oyun silinir (rekor kalir), yeni tahtada yeni oyun. Ek onay yok.
          () => { kutlamaKapat(); clearActive(); beginNew(acilan); },
          'kutlama');
      }, azalt ? 0 : KUTLAMA_GECIKME);
    }
    // 10x10: ilk baslatmada tek seferlik bilgi (kalici bayrak AppProgress.h2048OnMesaj;
    // eski kayitta alan yok = gorulmedi).
    function onMesajKontrol(){
      if(SIZE !== 10 || !window.AppProgress || window.AppProgress.h2048OnMesaj) return;
      if(window.AppSaveProgress) window.AppSaveProgress({h2048OnMesaj: 1});
      askDialog('Bu tahtada hedef yok.', 'Kaybedene kadar oynayacaksın.', 'Anladım', null, null, null);
    }

    window.Game2048 = {
      start(size){
        kutlamaKapat();
        resumeAsk.classList.remove('show');
        onYes = onNo = null;
        // bu oturumda hamle yapilmis oyun varsa o, yoksa diskteki yarim oyun
        const active = (liveSession && liveSession.score > 0) ? liveSession : savedActive();

        // Aktif oyun yok -> dogrudan yeni oyun
        if(!active || !active.tiles.length || active.score <= 0){ beginNew(size); return; }

        // Aktif oyun AYNI tahtada
        if(active.size === size){
          if(liveSession && liveSession.score > 0){ restoreState(liveSession); return; }   // ayni oturum -> sessiz devam
          SIZE = size; best = loadBest(); buildBoardCells();       // uygulama kapanmisti -> sor
          askDialog('Kaldığın yerden devam edelim mi?',
            size + 'x' + size + ' tahtada ' + active.score + ' puanlık oyunun duruyor.',
            'Evet', 'Hayır',
            () => restoreState(active),
            () => { clearActive(); beginNew(size); });
          return;
        }

        // Aktif oyun BASKA tahtada -> tek slot oldugu icin silinecek, once onay al
        SIZE = size; best = loadBest(); buildBoardCells();
        askDialog('Aktif ' + active.size + 'x' + active.size + ' oyunun silinsin mi?',
          active.score + ' puanlık oyunun kaybolacak. Aynı anda tek oyun tutuluyor.',
          'Sil ve Başla', 'Vazgeç',
          () => { clearActive(); beginNew(size); },
          () => {
            slideBack('game2048','boards2048');
            if(window.Boards2048) window.Boards2048.open();
          });
      },
      // TEST KANCASI (tools/h2048AcmaTest.js): yapay karo koymak icin. Oyun akisi kullanmaz.
      _test: {
        temizle(){ tiles = []; domTiles.forEach(el => el.remove()); domTiles.clear(); render(); },
        karoKoy(r, c, deger, kilit){
          tiles = tiles.filter(t => !(t.r === r && t.c === c));
          tiles.push({id: nextId++, value: deger, r: r, c: c, lock: kilit || 0, wild: false});
          render();
        },
        hamle(dir){ move(dir); },
        durum(){ return { size: SIZE, score: score, best: best, kutlamaAcik: kutlamaAcik,
                          karolar: tiles.map(t => [t.r, t.c, t.value, t.wall ? 1 : 0]) }; }
      }
    };
    SIZE = 5; best = loadBest(); buildBoardCells(); newGame();
  })();
