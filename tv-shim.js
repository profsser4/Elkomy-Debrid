// tv-shim.js v1.1 — ارفعه جنب index.html على الموقع. التطبيق بيحمّله كل مرة يفتح.
// جسر AndroidPlayer لشاشات سامسونج: httpGet من الشاشة (آيبي الشاشة) + مشغّل AVPlay (واحتياطي <video>)
(function () {
  window.TV_SHIM_VER = '1.1';
  function L(t, m) { try { if (window.__tvlog) window.__tvlog(t, m); } catch (e) {} }
  function mask(u) { return String(u || '').replace(/\/(live|movie|series)\/[^\/]+\/[^\/]+\//, '/$1/***/***/').replace(/(password|pass|username|user)=[^&]*/g, '$1=***'); }
  var RES = {};

  // ---------- طلبات الـIPTV (من الشاشة نفسها) ----------
  function pick(arr, keep) {
    if (!keep || !Array.isArray(arr)) return arr;
    var ks = keep.split(','), out = [];
    for (var i = 0; i < arr.length; i++) { var o = {}, s = arr[i] || {}; for (var j = 0; j < ks.length; j++) if (s[ks[j]] !== undefined) o[ks[j]] = s[ks[j]]; out.push(o); }
    return out;
  }
  function httpGet(id, url, keep, ttl) {
    var tries = 0;
    function done(st, txt) { RES[id] = txt; setTimeout(function () { try { window.__nh(id, st); } catch (e) { L('nh-err', e && e.message); } }, 0); }
    (function go() {
      tries++;
      var x = new XMLHttpRequest();
      try { x.open('GET', url, true); } catch (e) { L('http-open', e && e.message); return done(0, 'bad url'); }
      x.timeout = 100000;
      x.onload = function () {
        if (x.status >= 500 && tries < 2) return setTimeout(go, 1500);
        var t = x.responseText;
        if (keep && x.status >= 200 && x.status < 300) { try { t = JSON.stringify(pick(JSON.parse(t), keep)); } catch (e) { L('pick-err', e && e.message); } }
        if (x.status < 200 || x.status >= 300) L('http', x.status + ' ' + mask(url));
        done(x.status, t);
      };
      x.onerror = function () { if (tries < 2) return setTimeout(go, 1500); L('http-net', mask(url)); done(0, 'network'); };
      x.ontimeout = function () { if (tries < 2) return setTimeout(go, 500); L('http-timeout', mask(url)); done(0, 'timeout'); };
      x.send();
    })();
  }
  function httpTake(id) { var t = RES[id] || ''; delete RES[id]; return t; }

  // ---------- واجهة المشغّل ----------
  var P = null;
  var css = document.createElement('style');
  css.textContent = 'html.avp,body.avp{background:#000!important}body.avp>*:not(#avov){visibility:hidden!important}' +
    '#avov{position:fixed;left:0;top:0;width:100%;height:100%;z-index:99999;background:transparent;color:#fff;font-family:sans-serif;direction:rtl}' +
    '#avov.vid{background:#000}' +
    '#avov .bar{position:absolute;left:0;right:0;bottom:0;padding:30px 60px;background:linear-gradient(transparent,rgba(0,0,0,.85));transition:opacity .3s}' +
    '#avov .tt{font-size:34px;margin-bottom:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#avov .pg{height:8px;background:rgba(255,255,255,.25);border-radius:4px;direction:ltr}#avov .pg i{display:block;height:100%;width:0;background:#3b82f6;border-radius:4px}' +
    '#avov .tm{display:flex;justify-content:space-between;font-size:26px;margin-top:10px;direction:ltr}' +
    '#avov .ms{position:absolute;top:40px;left:0;right:0;text-align:center;font-size:36px;text-shadow:0 2px 8px #000}' +
    '#avov .nx{position:absolute;top:100px;right:60px;font-size:28px;background:rgba(0,0,0,.6);padding:10px 20px;border-radius:12px;display:none}';

  function fmt(s) { s = Math.max(0, Math.floor(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function osd(show) { if (!P) return; P.bar.style.opacity = show ? 1 : 0; clearTimeout(P.ht); if (show && !P.paused) P.ht = setTimeout(function () { if (P) P.bar.style.opacity = 0; }, 4000); }
  function upd() { if (!P) return; var d = P.dur / 1000, c = P.cur / 1000; P.fill.style.width = d > 0 ? Math.min(100, c / d * 100) + '%' : '0'; P.t1.textContent = fmt(c); P.t2.textContent = d > 0 ? fmt(d) : 'LIVE'; }
  function report(ended) { if (!P) return; try { if (window.nativeProgress) window.nativeProgress(Math.floor(P.cur / 1000), Math.floor(P.dur / 1000), !!ended); } catch (e) { L('progress-err', e && e.message); } }
  function msg(t, ms) { if (!P) return; P.ms.textContent = t; clearTimeout(P.mt); if (ms) P.mt = setTimeout(function () { if (P) P.ms.textContent = ''; }, ms); }

  // ---------- محرّكات التشغيل ----------
  function avEngine() {
    var av = webapis.avplay;
    return {
      name: 'avplay',
      open: function (url, h) {
        try { av.close(); } catch (e) {}
        av.open(url);
        av.setDisplayRect(0, 0, 1920, 1080);
        av.setListener({
          onbufferingstart: function () { h.onBuf(true); }, onbufferingcomplete: function () { h.onBuf(false); },
          oncurrentplaytime: function (ms) { h.onTime(ms); }, onstreamcompleted: function () { h.onEnd(); },
          onerror: function (e) { h.onErr(String(e)); }
        });
      },
      prepare: function (ok, no) { av.prepareAsync(ok, no); },
      dur: function () { try { return av.getDuration() || 0; } catch (e) { return 0; } },
      play: function () { av.play(); }, pause: function () { av.pause(); },
      seek: function (ms) { av.seekTo(ms, function () {}, function () {}); },
      stop: function () { try { av.stop(); } catch (e) {} try { av.close(); } catch (e) {} },
      sub: function (u) { try { av.setExternalSubtitlePath(u); } catch (e) { L('sub-err', e && e.message); } },
      tracks: function (type) { try { var a = av.getTotalTrackInfo() || [], o = []; for (var i = 0; i < a.length; i++) if (a[i].type === type) o.push(a[i]); return o; } catch (e) { return []; } },
      sel: function (type, idx) { av.setSelectTrack(type, idx); }
    };
  }
  function vidEngine(ov) {
    var v = document.createElement('video'), H = null;
    v.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;background:#000';
    ov.classList.add('vid'); ov.insertBefore(v, ov.firstChild);
    return {
      name: 'html5',
      open: function (url, h) {
        H = h; v.src = url;
        v.addEventListener('timeupdate', function () { h.onTime(v.currentTime * 1000); });
        v.addEventListener('ended', function () { h.onEnd(); });
        v.addEventListener('error', function () { h.onErr('video ' + (v.error && v.error.code)); });
        v.addEventListener('waiting', function () { h.onBuf(true); }); v.addEventListener('playing', function () { h.onBuf(false); });
      },
      prepare: function (ok, no) {
        var d = false; function go() { if (!d) { d = true; ok(); } }
        v.addEventListener('loadedmetadata', go); v.addEventListener('error', function () { if (!d) { d = true; no('video error'); } });
        v.load();
      },
      dur: function () { return isFinite(v.duration) ? v.duration * 1000 : 0; },
      play: function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); }, pause: function () { v.pause(); },
      seek: function (ms) { v.currentTime = ms / 1000; },
      stop: function () { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} },
      sub: function () {}, tracks: function () { return []; }, sel: function () {}
    };
  }

  function close(ended) {
    if (!P) return;
    document.removeEventListener('keydown', onKey, true);
    clearInterval(P.wd); clearTimeout(P.ht); clearTimeout(P.mt); clearTimeout(P.pt);
    if (!ended) report(false);
    try { P.eng && P.eng.stop(); } catch (e) {}
    var el = document.getElementById('avov'); if (el) el.remove();
    document.body.classList.remove('avp'); document.documentElement.classList.remove('avp');
    P = null;
  }
  function fatal(t) { L('play-fatal', t); msg(t, 0); osd(true); var p = P; setTimeout(function () { if (P === p) close(false); }, 4000); }

  function seek(d) {
    if (!P || !(P.dur > 0) || !P.eng) return;
    var t = Math.max(0, Math.min(P.dur - 1000, P.cur + d));
    try { P.eng.seek(t); P.cur = t; upd(); osd(true); } catch (e) { L('seek-err', e && e.message); }
  }
  function toggle() {
    if (!P || !P.eng) return;
    try { if (P.paused) { P.eng.play(); P.paused = false; msg('', 0); } else { P.eng.pause(); P.paused = true; msg('⏸', 0); } } catch (e) { L('toggle-err', e && e.message); }
    osd(true);
  }
  function cycleTrack(type, label) {
    if (!P || !P.eng) return;
    var t = P.eng.tracks(type);
    if (!t.length) { msg(label + ': مفيش مسارات', 2000); return; }
    P.tk = P.tk || {}; var i = ((P.tk[type] === undefined ? -1 : P.tk[type]) + 1) % (t.length + (type === 'TEXT' ? 1 : 0));
    P.tk[type] = i;
    if (i >= t.length) { try { P.eng.sel(type, -1); } catch (e) {} msg(label + ': إيقاف', 2200); return; }
    var lang = ''; try { lang = JSON.parse(t[i].extra_info || '{}').language || ''; } catch (e) {}
    try { P.eng.sel(type, t[i].index); msg(label + ' ' + (i + 1) + '/' + t.length + (lang ? ' (' + lang + ')' : ''), 2500); } catch (e) { L('track-err', e && e.message); msg('تعذّر تغيير المسار', 2000); }
  }
  function onKey(e) {
    if (!P) return;
    var k = e.keyCode, used = true;
    if (k === 10009 || k === 413 || k === 8 || k === 27) close(false);
    else if (k === 13 || k === 415 || k === 19 || k === 10252) toggle();
    else if (k === 37 || k === 412) seek(-10000);
    else if (k === 39 || k === 417) seek(10000);
    else if (k === 38) seek(60000);
    else if (k === 40) seek(-60000);
    else if (k === 403) cycleTrack('AUDIO', '🔊 الصوت');      // أحمر: تغيير مسار الصوت
    else if (k === 404) cycleTrack('TEXT', '💬 الترجمة');     // أخضر: ترجمة مدمجة
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }

  // ---------- التشغيل مع محاولات بديلة ----------
  function play(url, title, pos) {
    if (P) close(false);
    if (!css.parentNode) (document.head || document.documentElement).appendChild(css);
    var parts = String(title || '').split('\n@@SUB@@'), sub = parts[1] || '';
    title = parts[0];
    var ov = document.createElement('div'); ov.id = 'avov';
    ov.innerHTML = '<object type="application/avplayer" style="position:absolute;left:0;top:0;width:100%;height:100%"></object>' +
      '<div class="ms"></div><div class="nx"></div><div class="bar"><div class="tt"></div><div class="pg"><i></i></div><div class="tm"><span class="t1">0:00</span><span class="t2">--</span></div></div>';
    document.body.appendChild(ov);
    document.body.classList.add('avp'); document.documentElement.classList.add('avp');
    P = {cur: 0, dur: 0, paused: false, lastRep: 0, ok: false, lastT: Date.now(), buf: false, att: 0, ov: ov, bar: ov.querySelector('.bar'), ms: ov.querySelector('.ms'), nx: ov.querySelector('.nx'),
      fill: ov.querySelector('.pg i'), t1: ov.querySelector('.t1'), t2: ov.querySelector('.t2')};
    ov.querySelector('.tt').textContent = title;
    document.addEventListener('keydown', onKey, true);
    L('play', mask(url));

    // قايمة المحاولات: الرابط الأصلي، وبديله (.ts <-> .m3u8)، وبعدين <video> العادي
    var urls = [url];
    if (/\.ts(\?|$)/i.test(url)) urls.push(url.replace(/\.ts(\?|$)/i, '.m3u8$1'));
    else if (/\.m3u8(\?|$)/i.test(url)) urls.push(url.replace(/\.m3u8(\?|$)/i, '.ts$1'));
    var hasAV = false; try { hasAV = !!(window.webapis && webapis.avplay); } catch (e) {}
    var plan = [];
    urls.forEach(function (u) { if (hasAV) plan.push({u: u, e: 'av'}); });
    plan.push({u: urls[0], e: 'vid'});
    var startPos = pos, me = P;

    function attempt() {
      if (P !== me) return;
      if (me.att >= plan.length) return fatal('تعذّر التشغيل. جرّب قناة/ملف تاني (لو الحساب شغّال على جهاز تاني اقفله)');
      var a = plan[me.att++];
      me.ok = false; me.dur = 0; me.buf = false; me.paused = false; me.lastT = Date.now();
      try { me.eng && me.eng.stop(); } catch (e) {}
      var old = ov.querySelector('video'); if (old) old.remove(); ov.classList.remove('vid');
      var fails = false;
      function bad(why) {
        if (P !== me || fails) return; fails = true;
        L('play-fail', a.e + ' ' + why + ' ' + mask(a.u));
        if (me.ok && me.dur === 0) { msg('الاتصال قطع، بيعيد المحاولة...', 0); me.att--; }   // بث مباشر وقع بعد ما اشتغل: نعيد نفس المحاولة
        setTimeout(attempt, 600);
      }
      var h = {
        onBuf: function (b) { me.buf = b; if (b) msg('⏳', 0); else if (!me.paused) msg('', 0); },
        onTime: function (ms) {
          me.cur = ms; me.lastT = Date.now(); upd();
          if (!me.ok) { me.ok = true; L('play-ok', a.e + ' ' + mask(a.u)); }
          var now = Date.now(); if (now - me.lastRep > 5000) { me.lastRep = now; report(false); }
        },
        onEnd: function () { if (P !== me) return; report(true); close(true); },
        onErr: function (er) { bad('err ' + er); }
      };
      try {
        me.eng = a.e === 'av' ? avEngine() : vidEngine(ov);
        me.eng.open(a.u, h);
        if (sub) me.eng.sub(sub);
        clearTimeout(me.pt);
        me.pt = setTimeout(function () { if (!me.ok && !me.prep) { me.eng.stop(); bad('prepare timeout'); } }, 30000);
        msg('⏳', 0);
        me.eng.prepare(function () {
          if (P !== me || fails) return;
          me.prep = true; clearTimeout(me.pt);
          me.dur = me.eng.dur();
          try { me.eng.play(); } catch (e) { return bad('play ' + (e && e.message)); }
          msg('', 0);
          if (startPos > 5 && me.dur > 0) { try { me.eng.seek(startPos * 1000); } catch (e) { L('resume-err', e && e.message); } startPos = 0; }
          osd(true);
        }, function (er) { bad('prepare ' + (er && er.message || er)); });
      } catch (e) { bad('open ' + (e && e.message)); }
    }
    // مراقب التعليق: لو مفيش تقدّم 40 ثانية (مش موقوف) نعيد المحاولة
    P.wd = setInterval(function () {
      if (P !== me || !me.ok || me.paused) return;
      if (Date.now() - me.lastT > 40000) { L('stall', mask(plan[me.att - 1].u)); me.lastT = Date.now(); if (me.att > 0) me.att--; msg('الاتصال واقف، بيعيد المحاولة...', 0); attempt(); }
    }, 5000);
    attempt();
  }
  function showNext(txt, secs) {
    if (!P) return;
    P.nx.style.display = 'block';
    P.nx.textContent = (String(txt).charAt(0) === '!' ? String(txt).slice(1) : 'التالية ' + txt + ' بعد ' + fmt(secs));
  }
  window.AndroidPlayer = {httpGet: httpGet, httpTake: httpTake, play: play, showNext: showNext, setAutoNext: function () {}};
  L('shim', 'v' + window.TV_SHIM_VER + ' loaded');
})();
