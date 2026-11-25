/* GROOVE project page: page chrome (design.paper.md, DETOX reference), stat-band
   mosaic, and the paired raw / GROOVE trial walls. Every number on the page comes from the manuscript. */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = t => 1 - Math.pow(1 - t, 4);              // ease-out (brand: precise start, soft landing)

  /* ---------- page chrome ---------- */
  (function () {
    const bar = document.getElementById('progress');
    if (bar) {
      const upd = () => { const h = document.documentElement; bar.style.transform = 'scaleX(' + (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) + ')'; };
      addEventListener('scroll', upd, { passive: true }); upd();
    }
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || RM) { els.forEach(e => e.classList.add('in')); }
    else {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      els.forEach((e, i) => { e.style.transitionDelay = (i % 2 ? 120 : 0) + 'ms'; io.observe(e); });
    }
    // count-up numbers in the stat band
    const nums = document.querySelectorAll('[data-count]');
    const cio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      const n = e.target, to = parseFloat(n.dataset.count), dec = +(n.dataset.dec || 0);
      if (RM) return;
      const t0 = performance.now(), D = 1200;
      (function step(now) { const k = ease(clamp((now - t0) / D, 0, 1)); n.textContent = (to * k).toFixed(dec); if (k < 1) requestAnimationFrame(step); })(t0);
    }), { threshold: 0.4 });
    nums.forEach(n => cio.observe(n));
    const cb = document.getElementById('copy-bib');
    if (cb) cb.addEventListener('click', () => navigator.clipboard.writeText(document.getElementById('bibtex-text').innerText).then(() => { cb.textContent = 'Copied!'; setTimeout(() => cb.textContent = 'Copy', 1600); }));
  })();

  /* ---------- stat band: mosaic of recorded UR5e trials (ST-06) ---------- */
  (function () {
    const box = document.getElementById('mosaic'); if (!box) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting && !document.hidden) { if (!v.src) v.src = v.dataset.src; if (!RM) v.play().catch(() => {}); }
      else v.pause();
    }), { rootMargin: '250px' });
    for (let i = 0; i < 60; i++) {
      const f = 'u' + String((i + 50) % 100).padStart(3, '0') + '.mp4';
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      v.dataset.src = (window.VIDEO_DATA && window.VIDEO_DATA['mosaic_ur5e/' + f]) || ('static/videos/mosaic_ur5e/' + f);
      box.appendChild(v); io.observe(v);
    }
  })();

  /* ---------- toggle groups: mirror .on into aria-pressed (AX-05) ---------- */
  (function () {
    document.querySelectorAll('.seg').forEach(g => {
      const sync = () => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'));
      sync(); g.addEventListener('click', () => setTimeout(sync, 0));
    });
  })();
})();

/* ---------- Video wall: 50 paired side-by-side trials ---------- */
(function(){
  const M = window.VIDEO_WALL;
  const wall = document.getElementById('wall');
  if (!M || !wall) return;
  let taskFilter='all';
  const tiles=[];
  M.forEach(item=>{
    const t=document.createElement('div');
    t.className='tile';
    const v=document.createElement('video');
    v.muted=true; v.loop=true; v.playsInline=true; v.preload='none';
    v.setAttribute('aria-label', 'UR5e '+(item.task==='stack'?'stacking':'trash disposal')+' '+item.pair+': raw π0.5 on the left and + GROOVE on the right');
    t.appendChild(v);
    const mid=document.createElement('span'); mid.className='mid'; t.appendChild(mid);
    const tl=document.createElement('span'); tl.className='half-tag l';
    tl.textContent='raw · '+item.pair.replace('pair-','#')+' '+(item.task==='stack'?'stacking':'trash');
    const tr=document.createElement('span'); tr.className='half-tag r'; tr.textContent='+ groove';
    t.appendChild(tl); t.appendChild(tr);
    const okl=document.createElement('span');
    okl.className='okmark l '+(item.success.raw?'success':'fail');
    okl.textContent=item.success.raw?'Success':'Fail';
    const okr=document.createElement('span');
    okr.className='okmark r '+(item.success.groove?'success':'fail');
    okr.textContent=item.success.groove?'Success':'Fail';
    t.appendChild(okl); t.appendChild(okr);
    wall.appendChild(t);
    tiles.push({el:t, v, item, loaded:false});
  });
  function srcFor(item){
    const f = item.pair+'_'+item.task+'.mp4';
    return (window.VIDEO_DATA && window.VIDEO_DATA[f]) || ('static/videos/'+f);
  }
  function refreshTile(t, visible){
    const show = taskFilter==='all' || t.item.task===taskFilter;
    t.el.style.display = show ? '' : 'none';
    if (!show){ t.v.pause(); return; }
    if (visible){
      if (!t.loaded){ t.v.src=srcFor(t.item); t.loaded=true; }
      t.v.play().catch(()=>{});
    } else t.v.pause();
  }
  const visSet=new Set();
  const io=new IntersectionObserver(entries=>{
    for (const e of entries){
      const t=tiles.find(x=>x.el===e.target);
      if (!t) continue;
      if (e.isIntersecting) visSet.add(t); else visSet.delete(t);
      refreshTile(t, e.isIntersecting);
    }
  }, {rootMargin:'200px'});
  tiles.forEach(t=>io.observe(t.el));
  document.querySelectorAll('#wall-task button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#wall-task button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      taskFilter=b.dataset.task;
      tiles.forEach(t=>refreshTile(t, visSet.has(t)));
    });
  });
  tiles.forEach(t=>refreshTile(t,false));

  // Lightbox
  const lb=document.getElementById('lightbox');
  const lbv=document.getElementById('lb-video');
  const lbt=document.getElementById('lb-title');
  let lbFrom=null;
  function openLb(t){
    lbFrom=t;
    lbv.src = t.v.src || srcFor(t.item);
    try{ lbv.currentTime = t.v.currentTime || 0; }catch(e){}
    lbt.textContent = t.item.pair.replace('pair-','pair #')+' · '+(t.item.task==='stack'?'stacking':'trash disposal')
      +(t.item.success.raw?' · raw: success':' · raw: fail')
      +(t.item.success.groove?' · groove: success':' · groove: fail');
    lb.classList.add('open');
    document.body.style.overflow='hidden';
    lbv.play().catch(()=>{});
  }
  function closeLb(){
    lb.classList.remove('open');
    document.body.style.overflow='';
    lbv.pause(); lbv.removeAttribute('src'); lbv.load();
  }
  tiles.forEach(t=>t.el.addEventListener('click', ()=>openLb(t)));
  document.getElementById('lb-close').addEventListener('click', closeLb);
  lb.addEventListener('click', e=>{ if(e.target===lb) closeLb(); });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape' && lb.classList.contains('open')) closeLb(); });
})();

/* ---------- Simulation wall: replayed LIBERO pairs ---------- */
(function(){
  const M = window.SIM_WALL;
  const wall = document.getElementById('sim-wall');
  if (!wall) return;
  if (!M || !M.length){
    const sec = wall.closest('section');
    if (sec) sec.style.display='none';
    return;
  }
  const polName = p => p==='pi05' ? 'π0.5' : 'GR00T';
  const stName = s => s.replace('libero_','').replace('10','long');
  const tiles=[];
  M.forEach(it=>{
    const t=document.createElement('div');
    t.className='tile';
    t.title = it.label;
    const v=document.createElement('video');
    v.muted=true; v.loop=true; v.playsInline=true; v.preload='none';
    v.setAttribute('aria-label', 'LIBERO '+stName(it.suite)+' task '+it.task+', '+polName(it.policy)+': raw on the left and + GROOVE on the right');
    t.appendChild(v);
    const mid=document.createElement('span'); mid.className='mid'; t.appendChild(mid);
    const tl=document.createElement('span'); tl.className='half-tag l';
    tl.textContent='raw · '+polName(it.policy)+' '+stName(it.suite)+' #'+it.task;
    const tr=document.createElement('span'); tr.className='half-tag r'; tr.textContent='+ groove';
    t.appendChild(tl); t.appendChild(tr);
    const okl=document.createElement('span');
    okl.className='okmark l '+(it.success.raw?'success':'fail');
    okl.textContent=it.success.raw?'Success':'Fail';
    const okr=document.createElement('span');
    okr.className='okmark r '+(it.success.groove?'success':'fail');
    okr.textContent=it.success.groove?'Success':'Fail';
    t.appendChild(okl); t.appendChild(okr);
    wall.appendChild(t);
    tiles.push({el:t, v, it, loaded:false});
  });
  function fileFor(it){
    return it.policy+'_'+it.suite+'_task'+String(it.task).padStart(2,'0')+'.mp4';
  }
  function srcFor(it){
    const f=fileFor(it);
    return (window.VIDEO_DATA && window.VIDEO_DATA['sim/'+f]) || ('static/videos/sim/'+f);
  }
  let pol='all', suite='all';
  const vis=new Set();
  function refresh(t, visible){
    const show = (pol==='all' || t.it.policy===pol) && (suite==='all' || t.it.suite===suite);
    t.el.style.display = show ? '' : 'none';
    if (!show){ t.v.pause(); return; }
    if (visible){
      if (!t.loaded){ t.v.src=srcFor(t.it); t.loaded=true; }
      t.v.play().catch(()=>{});
    } else t.v.pause();
  }
  const io=new IntersectionObserver(es=>{
    for (const e of es){
      const t=tiles.find(x=>x.el===e.target);
      if (!t) continue;
      if (e.isIntersecting) vis.add(t); else vis.delete(t);
      refresh(t, e.isIntersecting);
    }
  }, {rootMargin:'200px'});
  tiles.forEach(t=>io.observe(t.el));
  function wire(segId, set){
    document.querySelectorAll('#'+segId+' button').forEach(b=>{
      b.addEventListener('click',()=>{
        document.querySelectorAll('#'+segId+' button').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        set(b.dataset);
        tiles.forEach(t=>refresh(t, vis.has(t)));
      });
    });
  }
  wire('sim-policy', d=>{ pol=d.pol; });
  wire('sim-suite', d=>{ suite=d.suite; });
  const lb=document.getElementById('lightbox'), lbv=document.getElementById('lb-video'),
        lbt=document.getElementById('lb-title');
  tiles.forEach(t=>t.el.addEventListener('click', ()=>{
    lbv.src = t.v.src || srcFor(t.it);
    try{ lbv.currentTime = t.v.currentTime || 0; }catch(e){}
    lbt.textContent = polName(t.it.policy)+' · '+stName(t.it.suite)+' #'+t.it.task+' · '+t.it.label;
    lb.classList.add('open');
    document.body.style.overflow='hidden';
    lbv.play().catch(()=>{});
  }));
})();

/* ---------- Show-all toggles for the collapsed video walls ---------- */
(function(){
  document.querySelectorAll('.wall-more button[data-target]').forEach(btn=>{
    const wall = document.getElementById(btn.dataset.target);
    if (!wall) return;
    const more = btn.textContent;
    btn.addEventListener('click',()=>{
      const open = wall.classList.toggle('collapsed') === false;
      btn.textContent = open ? 'Show fewer' : more;
      if (!open) wall.scrollIntoView({block:'start', behavior:'smooth'});
    });
  });
})();
