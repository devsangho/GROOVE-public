/* Shared native-canvas 3D renderer. No WebGL, external assets, or fitted boxes. */
(function () {
  'use strict';
  const D=window.GROOVE_ABC_DATA, root=document.getElementById('groove-abc');
  if(!D||!root)return;
  const names=['cube','x','y','z','xy+','xy−','xz+','xz−','yz+','yz−','xyz+++','xyz++−','xyz+−+','xyz+−−'];
  const colors={background:'#080808',text:'#f5f5f5',muted:'#a0a0a0',grid:'#282828',
    raw:'#ff705c',reference:'#91bbff',solution:'#5298ff',box:'#73a7d2',
    highlight:'#f3c86c',history:'#dbe5f3',eligible:'#8edec0',rejected:'#666666',suffix:'#858585'};
  const stageNames=['A · Construct bounds','B · Generate candidates','C · Select and execute'];
  const starts=[0,28,56], total=70;
  root.innerHTML=`<div class="abc-tabs" role="group" aria-label="Method stage">${stageNames.map((x,i)=>`<button type="button" data-stage="${i}" aria-pressed="${i===0}">${x}</button>`).join('')}</div>
    <div class="abc-main"><div class="abc-scene"><canvas class="abc-canvas" aria-label="Rotatable 3D view of time-indexed action-path bounds" tabindex="0"></canvas><span class="abc-hint">drag to rotate · scroll to zoom · arrows change k</span></div>
    <aside class="abc-sidebar"><div class="abc-kicker"></div><h3 class="abc-title"></h3><p class="abc-description"></p><div class="abc-equation"></div><div class="abc-stats"></div><table class="abc-rank" aria-label="Computed committed-prefix scores for all fourteen candidates"></table></aside></div>
    <div class="abc-controls"><div class="abc-bank" role="group" aria-label="Constraint setting k">${D.candidates.map((c,k)=>`<button type="button" data-k="${k}" title="k=${k}: ${names[k]}" aria-pressed="${k===0}">${k}</button>`).join('')}</div><div class="abc-nav"><button type="button" data-action="prev" aria-label="Previous candidate">←</button><button type="button" data-action="play">Play A → B → C</button><button type="button" data-action="next" aria-label="Next candidate">→</button><button type="button" data-action="reset">Reset view</button></div></div>
    <div class="abc-bottom"><label class="abc-time">Inspect timestamp <input type="range" min="0" max="${D.H-1}" value="3" step="1" aria-label="Highlighted timestamp"><output>t = 3</output></label><span>One k applies to all ${D.H} timestamps.</span></div>
    <p class="abc-caption" aria-live="polite"></p><p class="abc-scope">Synthetic chunk · H = ${D.H}, C = ${D.C} · actual QP outputs · normalized translation coordinates · gripper unchanged</p>`;
  const $=x=>root.querySelector(x), canvas=$('.abc-canvas'), ctx=canvas.getContext('2d');
  const canvasFont=getComputedStyle(root).fontFamily;
  const S={stage:0,k:0,t:3,fraction:1,phase:0,time:0,yaw:-.24,pitch:.76,zoom:1,playing:false,automated:false,visible:false};
  let lastUI='',raf=0,lastNow=0,drag=null,boxCount=0;
  const add=(a,b)=>a.map((v,i)=>v+b[i]), mul=(a,b)=>a.map(v=>v*b);
  const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
  const norm=a=>Math.hypot(...a);
  const corners=(p,c)=>{const v=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])v.push(p.map((v,r)=>v+[x,y,z].reduce((s,sign,j)=>s+sign*c.half_widths[j]*c.basis[r][j],0)));return v;};
  const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
  const faces=[[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]];
  const allVertices=D.candidates.flatMap(c=>D.raw_path.flatMap(p=>corners(p,c))).concat(D.history_path);
  const lo=[0,1,2].map(a=>Math.min(...allVertices.map(p=>p[a]))), hi=[0,1,2].map(a=>Math.max(...allVertices.map(p=>p[a])));
  const center=lo.map((v,i)=>(v+hi[i])/2);
  function camera(W,H){
    const cy=Math.cos(S.yaw),sy=Math.sin(S.yaw),cp=Math.cos(S.pitch),sp=Math.sin(S.pitch);
    function rotate(p){const x=p[0]-center[0],y=p[1]-center[1],z=p[2]-center[2],a=-x*sy+y*cy;return [x*cy+y*sy,-(a*sp+z*cp),a*cp-z*sp];}
    const points=allVertices.map(rotate), bounds=[0,1].map(i=>[Math.min(...points.map(p=>p[i])),Math.max(...points.map(p=>p[i]))]);
    const scale=Math.min((W-(W<440?45:100))/(bounds[0][1]-bounds[0][0]),(H-155)/(bounds[1][1]-bounds[1][0]))*.92*S.zoom;
    const mid=bounds.map(x=>(x[0]+x[1])/2);
    const project=p=>{const r=rotate(p);return [W/2+(r[0]-mid[0])*scale,H/2+6+(r[1]-mid[1])*scale,r[2]];};
    return {project,rotate,scale};
  }
  function text(x,y,t,color=colors.text,size=14,align='left',bold=false){ctx.fillStyle=color;ctx.font=`${bold?'600 ':''}${size}px ${canvasFont}`;ctx.textAlign=align;ctx.fillText(t,x,y);}
  function line(points,color,width=2,dash=[],alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.restore();}
  function arrow(a,b,color,width=2,alpha=1,dash=[]){line([a,b],color,width,dash,alpha);const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),size=6;ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-size*Math.cos(ang-.45),b[1]-size*Math.sin(ang-.45));ctx.lineTo(b[0]-size*Math.cos(ang+.45),b[1]-size*Math.sin(ang+.45));ctx.closePath();ctx.fill();ctx.restore();}
  function dot2(p,color,r=3.4,open=false){ctx.beginPath();ctx.arc(p[0],p[1],r,0,2*Math.PI);ctx.fillStyle=open?colors.background:color;ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle=color;ctx.stroke();}
  function box(p,c,project,active,alpha=1){
    const pts=corners(p,c).map(project),color=active?colors.highlight:(c.k===0?colors.reference:colors.box);
    faces.map(f=>({f,z:f.reduce((v,i)=>v+pts[i][2],0)/4})).sort((a,b)=>b.z-a.z).forEach(({f})=>{
      ctx.save();ctx.fillStyle=color;ctx.globalAlpha=alpha*(active?.08:.025);ctx.beginPath();f.forEach((idx,i)=>i?ctx.lineTo(pts[idx][0],pts[idx][1]):ctx.moveTo(pts[idx][0],pts[idx][1]));ctx.closePath();ctx.fill();ctx.restore();
    });
    edges.forEach(([a,b])=>line([pts[a],pts[b]],color,active?1.8:1.1,[],alpha*(active?1:.63)));
    boxCount++;
  }
  function scene(){
    const rect=canvas.getBoundingClientRect(),W=rect.width,H=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle=colors.background;ctx.fillRect(0,0,W,H);
    const cam=camera(W,H),P=cam.project,c=D.candidates[S.k];boxCount=0;
    // A regular world-space floor, rendered by the same isotropic camera.
    const floor=lo[2]-.08;
    for(let x=-.5;x<=3.4;x+=.4)line([P([x,-.65,floor]),P([x,.65,floor])],colors.grid,1,[],.55);
    for(let y=-.6;y<=.7;y+=.3)line([P([-.6,y,floor]),P([3.4,y,floor])],colors.grid,1,[],.55);
    const showHistory=S.stage===1;
    if(showHistory){for(let i=1;i<D.history_path.length;i++)arrow(P(D.history_path[i-1]),P(D.history_path[i]),colors.history,3,1,[2,4]);const h=P(D.history_path[0]);text(h[0],h[1]-12,'h₋₂, h₋₁',colors.history,13);}
    let visible=D.H;
    if(S.stage===0&&S.automated)visible=Math.min(D.H,1+Math.floor(S.fraction/.42*D.H));
    if(S.stage<2||S.phase>=.57){
      const order=D.raw_path.map((p,t)=>({p,t,z:P(p)[2]})).filter(x=>x.t<visible).sort((a,b)=>b.z-a.z);
      order.forEach(({p,t})=>box(p,c,P,t===S.t,S.stage===2?.5:1));
    }
    if(S.stage===2&&S.phase<.6){
      D.candidates.forEach(cand=>line(cand.path.map(P),cand.eligible?colors.eligible:colors.rejected,cand.eligible?1.7:1,cand.eligible?[]:[2,4],cand.eligible?.58:.3));
    }
    // Arrows encode the original delta commands; their endpoints are cumulative positions.
    const rp=[[0,0,0],...D.raw_path].map(P);
    for(let i=1;i<rp.length;i++)arrow(rp[i-1],rp[i],colors.raw,2,.9,[6,4]);
    D.raw_path.forEach((p,t)=>{const v=P(p);dot2(v,colors.raw,3.1,true);text(v[0]+4,v[1]-9,`t${t}`,t===S.t?colors.highlight:colors.muted,12);});
    if(S.stage===1&&(!S.automated||S.fraction>.18)){
      const pts=c.path.map(P);line([P([0,0,0]),...pts],colors.solution,3.5);
      pts.forEach(p=>dot2(p,colors.solution,4));
      const a=P(D.raw_path[S.t]),b=pts[S.t];line([a,b],colors.highlight,1.6,[2,3]);dot2(b,colors.highlight,5.5,true);
    }
    if(S.stage===0){
      const anchor=D.raw_path[S.t],axisLength=c.k===0?.23:.31;
      for(let j=0;j<3;j++){
        const axis=c.basis.map(row=>row[j]),end=add(anchor,mul(axis,axisLength)),pp=P(end);
        arrow(P(anchor),pp,j===0&&c.k>0?colors.highlight:colors.muted,1.8);
        text(pp[0]+5,pp[1]-4,c.k===0?['x','y','z'][j]:['dₖ','q₂','q₃'][j],j===0?colors.highlight:colors.muted,13);
      }
    }
    if(S.stage===2&&S.phase>=.57){
      const winner=D.candidates[D.selected_k],pts=winner.path.map(P),committing=S.phase>=.8;
      if(committing){
        const delivered=Math.min(D.C,Math.max(1,Math.floor((S.phase-.8)/.2*D.C)+1));
        line(pts,colors.suffix,2,[5,5],.5);
        line([P([0,0,0]),...pts.slice(0,delivered)],colors.solution,4);
        pts.forEach((p,t)=>dot2(p,t<delivered?colors.solution:colors.suffix,4,t>=delivered));
      }else{line([P([0,0,0]),...pts],colors.solution,4);pts.forEach(p=>dot2(p,colors.solution,4));}
    }
    // Camera orientation indicator: identical scale for the three world axes.
    const a=[49,H-57],zero=cam.rotate(center);
    [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]].forEach(([label,v])=>{const r=cam.rotate(add(center,v)),b=[a[0]+(r[0]-zero[0])*26,a[1]+(r[1]-zero[1])*26];arrow(a,b,colors.muted,1.4);text(b[0]+4,b[1]+3,label,colors.muted,12);});
    const narrow=W<440;
    const stageTag=(narrow?['A · Bounds','B · QP','C · Selection']:['A · Per-time boxes','B · Full-chunk solution','C · Compare committed prefixes'])[S.stage];
    text(18,29,stageTag,colors.text,narrow?14:17,'left',true);
    text(W-18,29,`k = ${S.k} / 13`,colors.highlight,narrow?14:17,'right',true);
    text(18,53,S.stage===0?`${visible} of ${D.H} boxes · same setting at every t`:S.stage===1?`${D.H} commands optimized together`:`${D.candidates.filter(c=>c.eligible).length} eligible, including reference`,colors.muted,13);
    const ly=H-18;
    const lx=narrow?18:112;
    line([[lx,ly-4],[lx+20,ly-4]],colors.raw,2,[6,4]);dot2([lx+10,ly-4],colors.raw,2.6,true);text(lx+28,ly,narrow?'raw':'raw path',colors.muted,12);
    if(S.stage>0){const qx=narrow?95:220;line([[qx,ly-4],[qx+20,ly-4]],colors.solution,3);dot2([qx+10,ly-4],colors.solution,3);text(qx+29,ly,narrow?'corrected':'corrected path',colors.muted,12);}
    text(W-18,ly,narrow?`t = ${S.t}`:`time slice t = ${S.t}`,colors.highlight,12,'right');
    canvas.dataset.boxCount=String(boxCount);canvas.dataset.k=String(S.k);canvas.dataset.stage=String(S.stage);
  }
  const scalar=x=>Math.abs(x)<1e-8?'0':x.toFixed(3);
  function updateUI(force=false){
    const c=D.candidates[S.k],key=[S.stage,S.k,S.t,S.stage===2?Math.floor(S.phase*20):0,S.playing].join(',');
    if(key===lastUI&&!force)return;lastUI=key;
    root.querySelectorAll('button[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.stage===S.stage)));
    root.querySelectorAll('button[data-k]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.k===S.k)));
    $('.abc-time output').textContent=`t = ${S.t}`;$('.abc-time input').value=String(S.t);
    $('[data-action="play"]').textContent=S.playing?'Pause':'Play A → B → C';
    $('.abc-kicker').textContent=S.stage===2?'COMMITTED-PREFIX COMPARISON':`SETTING k = ${S.k} · ${names[S.k]}`;
    $('.abc-equation').hidden=S.stage===2;$('.abc-stats').hidden=S.stage===2;$('.abc-rank').hidden=S.stage!==2;
    if(S.stage===0){
      $('.abc-title').textContent=S.k===0?'Eight reference cubes':'Eight oriented boxes';
      $('.abc-description').textContent='One box is centered at each raw cumulative position. This single k defines the bounds for the entire chunk.';
      $('.abc-equation').textContent='pʳₜ = Σᵢ≤ₜ rᵢ\n|Qₖᵀ(pₖ,ₜ − pʳₜ)| ≤ ηₖ,ₜ';
      const d=c.basis.map(row=>row[0]);
      $('.abc-stats').innerHTML=`<strong>${S.k===0?'Equal widths on x, y, z':'Tight direction dₖ'}</strong><br>${S.k===0?'Q₀ = identity':`(${d.map(scalar).join(', ')})`}<br><br><strong>Half-widths in this frame</strong><br>(${c.half_widths.map(scalar).join(', ')})<br><br>${S.k===0?'Cube edge = 0.300 on every axis.':'q₂ and q₃ span the wider plane.'}<br>All 14 settings have equal box volume.<br><br>Fixed codebook: 3 axes + 6 face diagonals + 4 body diagonals.`;
      $('.abc-caption').textContent=`A · One tube = ${D.H} time-indexed boxes. Repeat with k=0…13 to construct 14 full-chunk constraint sets.`;
    }else if(S.stage===1){
      $('.abc-title').textContent=`QP for k = ${S.k}`;
      $('.abc-description').textContent=`The same raw chunk and two delivered commands enter each QP. All ${D.H} corrected commands are solved jointly.`;
      $('.abc-equation').textContent='minᵤ Σₜ (‖δ²ₕuₜ‖² + λ‖uₜ‖²)\nu₋₂ = h₋₂,  u₋₁ = h₋₁\nsubject to every time-indexed box';
      $('.abc-stats').innerHTML=`<strong>Input</strong><br>Raw chunk r + fixed history h<br>Constraint setting k=${S.k}<br><br><strong>Output</strong><br>One complete corrected chunk<br>uₖ,₀ … uₖ,${D.H-1}<br><br>The dotted connector shows deviation at t=${S.t}.<br>Each point stays in its own box.<br><br><strong>Repeat for k=0…13 → 14 chunks.</strong>`;
      $('.abc-caption').textContent=`B · k=${S.k}: solve all ${D.H} corrected commands together, with one bound at every timestamp.`;
    }else{
      $('.abc-title').textContent=S.phase<.57?'Compare 14 chunks':S.phase<.8?`Select k = ${D.selected_k}`:`Execute first ${D.C}`;
      $('.abc-description').style.minHeight='0';
      $('.abc-description').textContent=`First ${D.C} commands: B = prefix deviation, P = command-space jerk score. The cube (k=0) stays eligible.`;
      $('.abc-rank').innerHTML='<thead><tr><th>k</th><th>B/B₀</th><th>P/P₀</th><th>Decision</th></tr></thead><tbody>'+D.candidates.map(c=>{
        const picked=S.phase>=.57&&c.selected;
        const status=c.k===0?'reference':picked?'SELECT':c.B_over_B0>1.5?'× budget':c.P_over_P0>=1?'× jerk':'eligible';
        return `<tr class="${picked?'chosen':c.eligible?'eligible':'rejected'}"><td>${c.k}</td><td>${c.B_over_B0.toFixed(2)}</td><td>${c.P_over_P0.toFixed(2)}</td><td>${status}</td></tr>`;
      }).join('')+'</tbody>';
      $('.abc-caption').textContent=S.phase<.57?'C · Keep candidates within 1.5× cube deviation that improve the jerk score. Always retain the cube.':S.phase<.8?`C · Choose k=${D.selected_k}, the eligible chunk with the lowest jerk score.`:`C · Deliver the first ${D.C} commands. Use delivered history and a new observation at the next replan.`;
    }
  }
  function render(){updateUI();scene();}
  function setFrame(time){
    S.time=Math.max(0,Math.min(total-1e-5,time));S.automated=true;
    if(S.time<56){S.stage=S.time<28?0:1;const local=S.time-starts[S.stage];S.k=Math.min(13,Math.floor(local/2));S.fraction=local/2-S.k;S.phase=0;S.t=S.stage===0?Math.min(D.H-1,Math.floor(S.fraction/.42*D.H)):3;}
    else{S.stage=2;S.k=D.selected_k;S.phase=(S.time-56)/14;S.fraction=1;S.t=3;}
    S.yaw=-.24+.13*Math.sin(S.time*.24);S.pitch=.76+.09*Math.sin(S.time*.13);render();
  }
  function stop(){S.playing=false;cancelAnimationFrame(raf);lastNow=0;updateUI(true);}
  function play(){if(S.time>=total-.01)S.time=0;S.playing=true;lastNow=0;if(S.visible)raf=requestAnimationFrame(tick);updateUI(true);}
  function stage(i){stop();S.stage=i;S.k=i===2?D.selected_k:0;S.phase=i===2?.7:0;S.fraction=1;S.automated=false;S.time=starts[i];render();}
  function candidate(k){stop();if(S.stage===2)S.stage=1;S.k=Math.max(0,Math.min(13,k));S.fraction=1;S.automated=false;S.time=starts[S.stage]+2*S.k;render();}
  function tick(now){if(!S.playing||!S.visible)return;if(lastNow)S.time+=(now-lastNow)/1000;lastNow=now;if(S.time>=total){setFrame(total-.0001);stop();return;}setFrame(S.time);raf=requestAnimationFrame(tick);}
  root.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>stage(+b.dataset.stage)));
  root.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>candidate(+b.dataset.k)));
  $('[data-action="prev"]').addEventListener('click',()=>candidate(S.k-1));$('[data-action="next"]').addEventListener('click',()=>candidate(S.k+1));
  $('[data-action="play"]').addEventListener('click',()=>{if(S.playing)stop();else play();});
  $('[data-action="reset"]').addEventListener('click',()=>{stop();S.yaw=-.24;S.pitch=.76;S.zoom=1;render();});
  $('.abc-time input').addEventListener('input',e=>{const t=+e.target.value;stop();S.t=t;S.fraction=1;S.automated=false;render();});
  canvas.addEventListener('pointerdown',e=>{stop();drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;S.yaw+=(e.clientX-drag[0])*.008;S.pitch=Math.max(-1.4,Math.min(1.4,S.pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];scene();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();stop();S.zoom=Math.max(.6,Math.min(2.1,S.zoom*Math.exp(-e.deltaY*.001)));scene();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();candidate(S.k+1);}if(e.key==='ArrowLeft'){e.preventDefault();candidate(S.k-1);}});
  new ResizeObserver(()=>scene()).observe(canvas);
  new IntersectionObserver(es=>{S.visible=es[0].isIntersecting;lastNow=0;cancelAnimationFrame(raf);if(S.playing&&S.visible)raf=requestAnimationFrame(tick);}).observe(root);
  window.addEventListener('pagehide',stop);
  // Deterministic capture API: video frames and interactive display share this code.
  window.GROOVE_ABC={setFrame,setStage:stage,setCandidate:candidate,render,
    getState:()=>({...S,boxCount,validCandidates:D.candidates.length,selectedK:D.selected_k}),
    getVertices:(k,t)=>corners(D.raw_path[t],D.candidates[k]),duration:total};
  render();
  if(root.dataset.autoplay==='true')play();
})();
