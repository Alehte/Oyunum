// core.js — ekran gecisleri, ayarlar, ortak altin cuzdani, kalici kayit
// ============ NAVIGATION ============
  const screens = {
    home: document.getElementById('screen-home'),
    game2048: document.getElementById('screen-game-2048'),
    kacisMode: document.getElementById('screen-kacis-mode'),
    kacisOzel: document.getElementById('screen-kacis-ozel'),
    kacisLevels: document.getElementById('screen-kacis-levels'),
    kacisLevel1: document.getElementById('screen-kacis-level1'),
    boards2048: document.getElementById('screen-2048-boards'),
    tempo: document.getElementById('screen-tempo'),
    ssMod: document.getElementById('screen-susirala-mode'),
    ssHarita: document.getElementById('screen-susirala-harita'),
    ssOyun: document.getElementById('screen-susirala-oyun'),
    ssoHarita: document.getElementById('screen-susirala-ozelharita'),
    ssoOyun: document.getElementById('screen-susirala-ozeloyun'),
    market: document.getElementById('screen-market'),
  };
  let navBusy = false, pendingPop = null, settleTimer = null, settleDone = null;
  let aktifEkran = 'home';   // sahnedeki (ya da su an sahneye giren) ekranin anahtari
  // baslangicta home disindaki her ekran sahne disi: DevTools'ta Elements
  // panelinden herhangi bir ekranin ".offstage" class'i var mi diye bakip
  // gorunur/tiklanabilir mi anlayabilirsin.
  Object.keys(screens).forEach(function(k){ if(k !== 'home') screens[k].classList.add('offstage'); });
  function armScreenSettle(from, to){
    navBusy = true;
    from.style.willChange = 'transform'; to.style.willChange = 'transform';
    if(settleTimer) clearTimeout(settleTimer);
    const done = () => {
      if(settleDone !== done) return;          // bu gecis zaten bitirildi
      settleDone = null;
      from.removeEventListener('transitionend', done);
      clearTimeout(settleTimer);
      from.classList.add('offstage');
      from.style.willChange = ''; to.style.willChange = '';
      navBusy = false;
      if(pendingPop){ const p = pendingPop; pendingPop = null; p(); }
    };
    settleDone = done;
    from.addEventListener('transitionend', done, { once:true });
    settleTimer = setTimeout(done, settings.reducedMotion ? 20 : 380);
  }
  // Bir ekrana GERI donulurken o ekranin icerigi tazelenir (acilan bolum,
  // sayaclar, kilitler). Ekrandaki geri dugmesi de telefonun geri tusu da
  // buradan gecer.
  const EKRAN_YENILE = {
    boards2048:  () => { if(window.Boards2048) window.Boards2048.open(); },
    kacisMode:   () => { if(window.KacisMod) window.KacisMod.yenile(); },
    kacisLevels: () => { if(window.Kacis && window.Kacis.haritaYenile) window.Kacis.haritaYenile(); },
    kacisOzel:   () => { if(window.Kacis && window.Kacis.haritaYenile) window.Kacis.haritaYenile(); },
    ssMod:       () => { if(window.SuSiralaOyun) window.SuSiralaOyun.modYenile(); },
    ssHarita:    () => { if(window.SuSiralaOyun) window.SuSiralaOyun.haritaCiz(); },
    ssoHarita:   () => { if(window.SuSiralaOzelOyun) window.SuSiralaOzelOyun.haritaCiz(); }
  };
  function slideForward(fromKey, toKey){
    const from = screens[fromKey], to = screens[toKey];
    aktifEkran = toKey;
    to.classList.remove('offstage');
    to.style.transition = 'none'; to.style.transform = 'translateX(100%)'; void to.offsetWidth; to.style.transition = '';
    requestAnimationFrame(() => { from.style.transform = 'translateX(-100%)'; to.style.transform = 'translateX(0)'; });
    armScreenSettle(from, to);
  }
  function slideBack(fromKey, toKey){
    const from = screens[fromKey], to = screens[toKey];
    aktifEkran = toKey;
    if(EKRAN_YENILE[toKey]){ try{ EKRAN_YENILE[toKey](); }catch(e){ console.error(e); } }
    to.classList.remove('offstage');
    to.style.transition = 'none'; to.style.transform = 'translateX(-100%)'; void to.offsetWidth; to.style.transition = '';
    requestAnimationFrame(() => { from.style.transform = 'translateX(100%)'; to.style.transform = 'translateX(0)'; });
    armScreenSettle(from, to);
  }
  // ============ OYUN DOSYALARINI TEMBEL YUKLEME ============
  // Acilista yalnizca core + market yuklenir. Her oyunun JS dosyalari (ve
  // bolum verileri) o oyuna ILK girildiginde indirilir:
  //   - dosyalar PARALEL indirilir, asagidaki dizinin SIRASIYLA calistirilir
  //     (sira = bagimlilik sirasi),
  //   - hepsi inmeden hicbiri calistirilmaz: yarim yuklenmis oyun olmaz,
  //   - ayni dosya iki kez indirilmez / calistirilmaz; inemeyen dosya bir
  //     sonraki denemede yeniden istenir.
  const OYUN_DOSYALARI = {
    h2048:    ['js/hedef2048.js'],
    kacis:    ['js/bolumler.js', 'js/ozel_bolumler.js', 'js/kacis.js'],
    susirala: ['js/suSirala.js', 'js/suSiralaBolumler.js', 'js/suSiralaOzel.js', 'js/suSiralaJoker.js',
               'js/suSiralaOyun.js', 'js/suSiralaOzelOyun.js'],
    tempo:    ['js/tempoCekirdek.js', 'js/tempoKup.js']
  };
  const metinSozu = {};     // src -> Promise<kaynak metni>
  const calisti = {};       // src -> true
  const etiketSozu = {};    // src -> Promise (yalnizca file:// yedek yolu)
  const oyunSozu = {};      // oyun -> suren yukleme
  const oyunHazir = {};     // oyun -> true (tum dosyalari calisti)
  const KOK = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');

  function metinGetir(src){
    if(!metinSozu[src]){
      metinSozu[src] = fetch(src).then(r => {
        if(!r.ok) throw new Error(src + ' -> ' + r.status);
        return r.text();
      }).catch(e => { delete metinSozu[src]; throw e; });
    }
    return metinSozu[src];
  }
  function calistir(src, kod){
    if(calisti[src]) return;
    calisti[src] = true;
    const el = document.createElement('script');
    // sourceURL: hata ayiklayicida ve hata izlerinde gercek dosya adi gorunsun
    el.textContent = kod + '\n//# sourceURL=' + KOK + src;
    document.body.appendChild(el);          // eklenir eklenmez, eszamanli calisir
  }
  // Sayfa dosya olarak (file://) acildiginda fetch calismaz: <script src> ile sirayla yukle.
  function etiketleYukle(src){
    if(!etiketSozu[src]){
      etiketSozu[src] = new Promise((tamam, hata) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = () => { calisti[src] = true; tamam(); };
        el.onerror = () => { delete etiketSozu[src]; el.remove(); hata(new Error('yuklenemedi: ' + src)); };
        document.body.appendChild(el);
      });
    }
    return etiketSozu[src];
  }
  function oyunYukle(ad){
    if(oyunHazir[ad]) return Promise.resolve();
    if(oyunSozu[ad]) return oyunSozu[ad];
    const dosyalar = OYUN_DOSYALARI[ad];
    let soz;
    if(location.protocol === 'file:' || !window.fetch){
      soz = dosyalar.reduce((zincir, d) => zincir.then(() => etiketleYukle(d)), Promise.resolve());
    } else {
      soz = Promise.all(dosyalar.map(metinGetir)).then(metinler => {
        dosyalar.forEach((d, i) => calistir(d, metinler[i]));
      });
    }
    oyunSozu[ad] = soz.then(() => { oyunHazir[ad] = true; delete oyunSozu[ad]; },
                            e => { delete oyunSozu[ad]; throw e; });
    return oyunSozu[ad];
  }
  const yukleOrtu = document.getElementById('yukleOrtu');
  const anaToast = document.getElementById('anaToast');
  let yukleniyor = false, anaToastId = null;
  function anaMesaj(metin){
    anaToast.textContent = metin;
    anaToast.classList.add('gorunur');
    clearTimeout(anaToastId);
    anaToastId = setTimeout(() => anaToast.classList.remove('gorunur'), 3200);
  }
  // Oyunu (gerekirse yukleyip) ac. `devam` yalnizca dosyalar hazir olunca calisir.
  function oyunAc(ad, devam){
    if(oyunHazir[ad]){ devam(); return; }
    if(yukleniyor) return;
    yukleniyor = true;
    // hizli baglantida gosterge hic gorunmesin diye kisa bir gecikmeyle acilir
    const gosterge = setTimeout(() => yukleOrtu.classList.add('show'), 160);
    oyunYukle(ad).then(devam, () => {
      anaMesaj('Oyun yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    }).then(() => {
      clearTimeout(gosterge);
      yukleOrtu.classList.remove('show');
      yukleniyor = false;
    });
  }
  window.AppYukle = { oyun: oyunYukle, dosyalar: OYUN_DOSYALARI };

  document.getElementById('cardHedef2048').addEventListener('click', () => oyunAc('h2048', () => { slideForward('home','boards2048'); window.Boards2048.open(); }));
  document.getElementById('boardsBackBtn').addEventListener('click', () => slideBack('boards2048','home'));
  document.getElementById('backBtn2048').addEventListener('click', () => slideBack('game2048','boards2048'));
  document.getElementById('cardTempo').addEventListener('click', () => oyunAc('tempo', () => { slideForward('home','tempo'); window.TempoKup.start(); if(window.AppGold) window.AppGold.render(); }));
  document.getElementById('tempoBackBtn').addEventListener('click', () => slideBack('tempo','home'));
  document.getElementById('cardKacis').addEventListener('click', () => oyunAc('kacis', () => { window.KacisMod.yenile(); slideForward('home','kacisMode'); }));
  document.getElementById('kacisModeBackBtn').addEventListener('click', () => slideBack('kacisMode','home'));
  document.getElementById('kacisLevelsBackBtn').addEventListener('click', () => slideBack('kacisLevels','kacisMode'));
  document.getElementById('kc1BackBtn').addEventListener('click', () => slideBack('kacisLevel1', window.Kacis ? window.Kacis.haritaAnahtari() : 'kacisLevels'));
  document.getElementById('kacisOzelBackBtn').addEventListener('click', () => slideBack('kacisOzel','kacisMode'));
  document.getElementById('cardSuSirala').addEventListener('click', () => oyunAc('susirala', () => {
    window.SuSiralaOyun.modYenile();
    slideForward('home','ssMod');
  }));
  document.getElementById('ssModeBackBtn').addEventListener('click', () => slideBack('ssMod','home'));
  // ekran tazeleme EKRAN_YENILE tablosunda: geri donuste slideBack kendisi cagirir
  document.getElementById('ssHaritaBackBtn').addEventListener('click', () => slideBack('ssHarita','ssMod'));
  document.getElementById('ssOyunBackBtn').addEventListener('click', () => slideBack('ssOyun','ssHarita'));
  document.getElementById('ssoHaritaBackBtn').addEventListener('click', () => slideBack('ssoHarita','ssMod'));
  document.getElementById('ssoOyunBackBtn').addEventListener('click', () => slideBack('ssoOyun','ssoHarita'));
  // --- telefonun kendi geri tusu ile senkron ---
  // Her ileri gecis tarayici gecmisine bir kayit ekler. Ekrandaki geri dugmesi
  // de bu kaydi geri sarar (history.go); boylece gecmiste olu kayit birikmez
  // ve telefonun geri tusu her basista bir ekran geri gider.
  let navStack = [];
  let gecmisSariliyor = false;   // kendi history.go cagrimizin dogurdugu popstate yok sayilir
  const _fwd = slideForward, _back = slideBack;
  // Gecis istegi gecerli mi? Kaynak ekran sahnedeki ekran degilse (cift dokunma,
  // eski istek) yok sayilir. Onceki gecis hala suruyorsa hemen bitirilir; boylece
  // cagiranin hazirladigi oyun durumu ile ekran birbirinden kopmaz.
  function gecisHazirla(fromKey){
    if(fromKey !== aktifEkran) return false;
    if(navBusy && settleDone) settleDone();
    return fromKey === aktifEkran && !navBusy;
  }
  slideForward = function(from, to){
    if(!gecisHazirla(from)) return false;
    navStack.push([from, to]); _fwd(from, to); history.pushState({s:to}, '');
    return true;
  };
  slideBack = function(from, to){
    if(!gecisHazirla(from)) return false;
    let i = navStack.length - 1;
    while(i >= 0 && navStack[i][1] !== from) i--;
    if(i >= 0){
      const adim = navStack.length - i;
      navStack.length = i;
      gecmisSariliyor = true;
      history.go(-adim);
    }
    _back(from, to);
    return true;
  };
  history.replaceState({s:'home'}, '');
  function handlePopstate(){
    // once ekran ici bir secim aciksa onu kapat
    if(window.Boards2048 && aktifEkran === 'boards2048' && window.Boards2048.handleBack()){
      history.pushState({s:'boards2048'}, '');
      return;
    }
    const last = navStack.pop();
    if(last){ _back(last[1], last[0]); }
  }
  window.addEventListener('popstate', () => {
    if(gecmisSariliyor){ gecmisSariliyor = false; return; }
    if(navBusy){ pendingPop = handlePopstate; return; }
    handlePopstate();
  });

  // ============ HOME SCREEN LOGIC ============
  const settingsRow = document.getElementById('settingsRow');
  const sheet = document.getElementById('sheet');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const sheetClose = document.getElementById('sheetClose');
  const gamesScroll = document.getElementById('gamesScroll');
  const gameCards = Array.from(document.querySelectorAll('.game-card'));
  function updateActiveCard(){
    const scrollRect = gamesScroll.getBoundingClientRect();
    const center = scrollRect.left + scrollRect.width / 2;
    let closest = null, closestDist = Infinity;
    gameCards.forEach(card => {
      const r = card.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - center);
      if(dist < closestDist){ closestDist = dist; closest = card; }
    });
    gameCards.forEach(card => card.classList.toggle('active', card === closest));
  }
  gamesScroll.addEventListener('scroll', () => window.requestAnimationFrame(updateActiveCard), {passive:true});
  updateActiveCard();
  function openSheet(){ sheet.classList.add('show'); sheetBackdrop.classList.add('show'); }
  function closeSheet(){ sheet.classList.remove('show'); sheetBackdrop.classList.remove('show'); }
  settingsRow.addEventListener('click', openSheet);
  settingsRow.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') openSheet(); });
  sheetClose.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  // ---- kalici depo: dosya olarak acildiginda saklar, saklanamiyorsa oturum boyu bellekte tutar ----
  const Store = (function(){
    let mem = {}, ok = true;
    try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); } catch(e){ ok = false; }
    // Yazma hata verirse (or. kota doldu) deger bellekte tutulur ve OKUMA da
    // once bellege bakar; yoksa diskteki eski deger geri donerdi.
    return {
      persistent: ok,
      get(k, d){ if(k in mem) return mem[k];
                 try{ if(ok){ const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } }catch(e){}
                 return d; },
      set(k, v){ try{ if(ok){ localStorage.setItem(k, JSON.stringify(v)); delete mem[k]; return; } }catch(e){}
                 mem[k] = v; },
      del(k){ delete mem[k];
              try{ if(ok) localStorage.removeItem(k); }catch(e){} }
    };
  })();
  window.AppStore = Store;   // market.js NO ADS kaydini burada tutar

  // GELISTIRME AYARI: varsayilan KAPALI. Acikken taslak reklam her zaman odul
  // verir (market.js AppReklam). Acmak:  adrese ?gelistirme=1 ekle  (kalici kaydedilir)
  // Kapatmak:                            adrese ?gelistirme=0 ekle
  (function(){
    const m = /[?&]gelistirme=([01])\b/.exec(location.search);
    if(m){ if(m[1] === '1') Store.set('ait_gelistirme', true); else Store.del('ait_gelistirme'); }
    window.AppGelistirme = Store.get('ait_gelistirme', false) === true;
  })();

  const DEFAULTS = { sfx:70, music:45, haptics:true, reducedMotion:false, lang:'tr' };
  let settings = Object.assign({}, DEFAULTS, Store.get('ait_settings', {}));
  function saveSettings(){ Store.set('ait_settings', settings); }
  // "Animasyonlari azalt" anahtarina HIC dokunulmadiysa telefonun kendi
  // "hareketi azalt" tercihi gecerlidir; oyuncu anahtari bir kez cevirince
  // (rmElle) artik onun secimi kalici olur. Eski kayitta acik birakilmissa
  // o da oyuncunun secimi sayilir.
  const sistemHareket = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if(settings.reducedMotion === true && settings.rmElle === undefined) settings.rmElle = true;
  if(!settings.rmElle) settings.reducedMotion = !!(sistemHareket && sistemHareket.matches);

  // Oyun scriptlerinin kullandigi ortak yardimcilar
  window.AppFX = {
    vol(){ return settings.sfx / 100; },
    vibrate(pattern){
      if(!settings.haptics) return;
      if(navigator.vibrate){ try{ navigator.vibrate(pattern); }catch(e){} }
    },
    // ortak ton uretici — efekt seviyesine bagli
    tone(f0, f1, dur, type, peak){
      const v = settings.sfx / 100;
      if(v <= 0) return;
      const ctx = ensureUiAudio();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(f0, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), ctx.currentTime + dur);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(peak * v, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur + 0.03);
    },
    seq(notes, type){   // [[freq, dur, peak, delayMs], ...]
      notes.forEach(n => setTimeout(() => window.AppFX.tone(n[0], n[0], n[1], type, n[2]), n[3]));
    }
  };
  window.AppReset = [];   // her oyun kendi sifirlama islevini buraya ekler

  const phoneEl = document.querySelector('.phone');
  function applyMotion(){ phoneEl.classList.toggle('reduced-motion', !!settings.reducedMotion); }

  let uiAudioCtx = null;
  function ensureUiAudio(){ if(!uiAudioCtx){ uiAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); } if(uiAudioCtx.state === 'suspended'){ uiAudioCtx.resume(); } return uiAudioCtx; }
  function playPreviewTone(volumePercent){
    if(volumePercent <= 0) return;
    const ctx = ensureUiAudio();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    const peak = (volumePercent / 100) * 0.22;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.24);
  }

  // --- ses ---
  const sfxSlider = document.getElementById('sfxSlider'), sfxVal = document.getElementById('sfxVal');
  const musicSlider = document.getElementById('musicSlider'), musicVal = document.getElementById('musicVal');
  sfxSlider.value = settings.sfx; sfxVal.textContent = settings.sfx + '%';
  musicSlider.value = settings.music; musicVal.textContent = settings.music + '%';
  sfxSlider.addEventListener('input', () => { settings.sfx = Number(sfxSlider.value); sfxVal.textContent = settings.sfx + '%'; });
  sfxSlider.addEventListener('change', () => { saveSettings(); playPreviewTone(settings.sfx); });
  musicSlider.addEventListener('input', () => { settings.music = Number(musicSlider.value); musicVal.textContent = settings.music + '%'; });
  musicSlider.addEventListener('change', saveSettings);

  // --- anahtarlar ---
  function bindSwitch(el, key, onChange){
    el.setAttribute('aria-checked', settings[key] ? 'true' : 'false');
    el.addEventListener('click', () => {
      settings[key] = !settings[key];
      el.setAttribute('aria-checked', settings[key] ? 'true' : 'false');
      saveSettings();
      if(onChange) onChange();
    });
  }
  bindSwitch(document.getElementById('hapticsSwitch'), 'haptics', () => window.AppFX.vibrate(28));
  bindSwitch(document.getElementById('motionSwitch'), 'reducedMotion', () => { settings.rmElle = true; saveSettings(); applyMotion(); });
  applyMotion();
  if(sistemHareket){
    const sistemDegisti = () => {
      if(settings.rmElle) return;
      settings.reducedMotion = sistemHareket.matches;
      document.getElementById('motionSwitch').setAttribute('aria-checked', settings.reducedMotion ? 'true' : 'false');
      applyMotion();
    };
    if(sistemHareket.addEventListener) sistemHareket.addEventListener('change', sistemDegisti);
    else if(sistemHareket.addListener) sistemHareket.addListener(sistemDegisti);
  }

  // --- ilerlemeyi sifirla (iki adimli onay) ---
  const resetBtn = document.getElementById('resetBtn');
  let resetArmed = false, resetTimer = null;
  resetBtn.addEventListener('click', () => {
    if(!resetArmed){
      resetArmed = true;
      resetBtn.classList.add('confirm');
      resetBtn.textContent = 'Emin misin? Dokun ve sıfırla';
      resetTimer = setTimeout(() => {
        resetArmed = false; resetBtn.classList.remove('confirm'); resetBtn.textContent = 'İlerlemeyi Sıfırla';
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    Store.del('ait_progress');
    window.AppProgress = varsayilanIlerleme();
    if(window.AppGold) window.AppGold.render();
    window.AppReset.forEach(fn => { try{ fn(); }catch(e){} });
    resetBtn.classList.remove('confirm');
    resetBtn.textContent = 'Sıfırlandı ✓';
    setTimeout(() => { resetBtn.textContent = 'İlerlemeyi Sıfırla'; }, 1600);
  });

  // --- ilerleme kaydi (oyun scriptleri bunu okur) ---
  // Acilista ve "Ilerlemeyi Sifirla"da AYNI baslangic nesnesi kullanilir.
  function varsayilanIlerleme(){
    return { unlocked: 1, best: 0, gold: 0, kacisHearts: {}, ssAcik: 1, ssYildiz: {}, ssJoker: null, ssoAcik: 1, ssoYildiz: {} };
  }
  window.AppProgress = Store.get('ait_progress', varsayilanIlerleme());
  if(typeof window.AppProgress.gold !== 'number') window.AppProgress.gold = 0;
  if(!window.AppProgress.kacisHearts) window.AppProgress.kacisHearts = {};

  // --- ortak altin cuzdani (tum oyunlar ayni keseyi kullanir) ---
  window.CoinSVG = function(filled){
    return '<img src="img/jeton.webp" alt="" class="app-coin" style="opacity:' + (filled ? 1 : .28) + '">';
};
  // Jeton kutulari. Miktar degisince sayi akarak guncellenir ve GORUNEN ekranin
  // kutusunun altinda yuzen bir +N / -N yazisi cikar (yalnizca transform/opacity).
  const GOLD_PILLS = ['goldPillHome','goldPillMap','goldPillMode','goldPillOzel','goldPillBoards','goldPill2048','goldPillTempo',
    'goldPillLevel','goldPillSsMode','goldPillSsHarita','goldPillSsOyun','goldPillSsoHarita','goldPillSsoOyun','goldPillMarket'];
  let goldGorunen = null, goldRaf = 0, goldHedef = 0;
  function goldYaz(deger){
    GOLD_PILLS.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      let sp = el.querySelector('span');
      if(!sp){ el.innerHTML = window.CoinSVG(true) + '<span></span>'; sp = el.querySelector('span'); }
      sp.textContent = deger;
    });
  }
  function goldUcan(fark){
    if(settings.reducedMotion || !fark) return;
    // sahnedeki (gorunen) ekranin jeton kutusu
    const kutu = GOLD_PILLS.map(id => document.getElementById(id)).find(el => {
      const ekran = el && el.closest('.app-screen');
      return ekran && !ekran.classList.contains('offstage') && ekran.style.transform !== 'translateX(100%)' && ekran.style.transform !== 'translateX(-100%)';
    });
    if(!kutu) return;
    const ekran = kutu.closest('.app-screen');
    const k = kutu.getBoundingClientRect(), e = ekran.getBoundingClientRect();
    const y = document.createElement('div');
    y.className = 'jeton-ucan ' + (fark > 0 ? 'arti' : 'eksi');
    y.textContent = (fark > 0 ? '+' : '−') + Math.abs(fark);
    y.style.right = Math.max(8, e.right - k.right + 6) + 'px';
    y.style.top = (k.bottom - e.top + 2) + 'px';
    ekran.appendChild(y);
    setTimeout(() => y.remove(), 1100);
    kutu.classList.remove('zipla'); void kutu.offsetWidth; kutu.classList.add('zipla');
  }
  window.AppGold = {
    get(){ return window.AppProgress.gold || 0; },
    add(n){
      window.AppProgress.gold = (window.AppProgress.gold || 0) + n;
      window.AppSaveProgress({ gold: window.AppProgress.gold });
      window.AppGold.render();
      return window.AppProgress.gold;
    },
    harca(n){
      if(n < 0) return false;
      if((window.AppProgress.gold || 0) < n) return false;
      window.AppProgress.gold -= n;
      window.AppSaveProgress({ gold: window.AppProgress.gold });
      window.AppGold.render();
      return true;
    },
    render(){
      const hedef = window.AppGold.get();
      if(goldGorunen === null || settings.reducedMotion){ goldGorunen = hedef; goldYaz(hedef); return; }
      if(hedef === goldGorunen && !goldRaf){ goldYaz(hedef); return; }
      const bas = goldGorunen, fark = hedef - (goldRaf ? goldHedef : goldGorunen);
      goldHedef = hedef;
      goldUcan(fark);
      cancelAnimationFrame(goldRaf);
      const t0 = performance.now(), sure = Math.min(700, 260 + Math.abs(hedef - bas) * 0.6);
      (function adim(simdi){
        const t = Math.min(1, (simdi - t0) / sure);
        goldGorunen = Math.round(bas + (hedef - bas) * (1 - Math.pow(1 - t, 3)));
        goldYaz(goldGorunen);
        goldRaf = t < 1 ? requestAnimationFrame(adim) : 0;
      })(t0);
    }
  };
  window.AppSaveProgress = function(patch){
    Object.assign(window.AppProgress, patch);
    Store.set('ait_progress', window.AppProgress);
  };
  setTimeout(function(){ if(window.AppGold) window.AppGold.render(); }, 0);

  // --- hakkinda ---
  document.getElementById('privacyBtn').addEventListener('click', () => {
    const n = document.getElementById('privacyNote');
    n.style.display = n.style.display === 'none' ? 'block' : 'none';
  });
// --- GEÇİCİ: masaüstü kaydırma yardımcısı ---
(() => {
  const kaydir = document.querySelector('.games-scroll');
  if (!kaydir) { console.warn('.games-scroll bulunamadi'); return; }

  // Bir kart + aradaki boşluk kadar kaydır
  const adim = () => {
    const kart = kaydir.firstElementChild;
    if (!kart) return 200;
    const bosluk = parseFloat(getComputedStyle(kaydir).gap) || 0;
    return kart.getBoundingClientRect().width + bosluk;
  };

  // Fare tekerleği -> yatay kaydırma
  kaydir.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      kaydir.scrollBy({ left: Math.sign(e.deltaY) * adim(), behavior: 'smooth' });
    }
  }, { passive: false });

  // Sağ / sol ok tuşları — yalnızca ana ekran sahnedeyken ve ayarlar kapalıyken
  document.addEventListener('keydown', (e) => {
    if (aktifEkran !== 'home' || sheet.classList.contains('show')) return;
    if (e.key === 'ArrowRight') kaydir.scrollBy({ left:  adim(), behavior: 'smooth' });
    if (e.key === 'ArrowLeft')  kaydir.scrollBy({ left: -adim(), behavior: 'smooth' });
  });
})();
