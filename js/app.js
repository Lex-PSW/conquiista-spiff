// CONFIG
const MAX_M       = 100;
const STORAGE_KEY = 'conquiista_v3';

const GROUPS = [
  { id:0, key:'comercial',   label:'EQUIPO COMERCIAL',
    color:'#0D1B5E', colorB:'#1e4fc2',
    prizes:[{place:'1er Lugar',medal:'🥇',amount:'$4,000 MXN'},{place:'2do Lugar',medal:'🥈',amount:'$3,000 MXN'}],
    defaultMembers:['Erika','Mesta','Michelle','Gerardo','Monica','Edgar','Memo','Adan','Maria','Fernando','Ivonne'] },
  { id:1, key:'servicio',    label:'SERVICIO',
    color:'#00695c', colorB:'#00897b',
    prizes:[{place:'1er Lugar',medal:'🥇',amount:'$4,000 MXN'}],
    defaultMembers:['Mario','Gaby','Albino','Yuliana'] },
  { id:2, key:'consultoria', label:'CONSULTORÍA',
    color:'#6a1b9a', colorB:'#8e24aa',
    prizes:[{place:'1er Lugar',medal:'🥇',amount:'$4,000 MXN'}],
    defaultMembers:['Brenda','Grecia','Lorena','Misael','Rosario','Rocio'] },
];

function defaultMembers() {
  return GROUPS.flatMap(group =>
    group.defaultMembers.map(name => ({
      name,
      groupId: group.id
    }))
  );
}

const ACCIONES = [
  {key:'encuesta',    label:'Encuesta de Satisfacción',                        pts:1},
  {key:'review',      label:'Caso de Éxito — Review en G2',                    pts:2},
  {key:'video_pres',  label:'Caso de Éxito — Video Entrevista Presencial',      pts:3},
  {key:'video_linea', label:'Caso de Éxito — Video Entrevista en Línea',        pts:2},
  {key:'escrita',     label:'Caso de Éxito — Entrevista Escrita/Encuesta',      pts:1},
  {key:'webinar',     label:'Participar en Webinar, Presencial o Podcast',      pts:4},
  {key:'embajador',   label:'Embajadores de Mkt en LN (1er/2do/3er lugar)',     pts:null},
  {key:'referencia',  label:'Recomendaciones / Referencias de Clientes Nuevos', pts:2},
];

const MEMBER_COLORS=['#0D1B5E','#1e4fc2','#00C2CB','#7DC243','#e05c2a','#805ad5','#d69e2e','#e53e3e','#319795','#dd6b20','#553c9a','#2b6cb0'];

// STATE
let isAdmin=false, viewerName='', selectedRole='admin';
let members=[], scores={}, historial=[], solicitudes=[], startDate=new Date();
let bandejaStatusFilter='';

// FIRESTORE STORAGE
async function saveData(){
  if(!isAdmin) return; // Sellers can only create their own requests.
  try{
    await dbSaveState({members, scores, historial, startDate});
    flashSave();
  }catch(e){ console.error(e); showToast('⚠ No se pudo guardar en Firebase'); }
}

async function loadData(){
  try{
    const d=await dbLoadState();
    if(!d) return false;
    members   = d.members || defaultMembers();
    scores    = d.scores || {};
    historial = (d.historial||[]).map(h=>({...h, date:new Date(h.date)}));
    startDate = d.startDate ? new Date(d.startDate) : new Date();
    solicitudes = await dbLoadRequests();
    return true;
  }catch(e){ console.error(e); return false; }
}

// HELPERS
function membersOfGroup(gid){ return members.filter(m=>m.groupId===gid); }
function getScore(name)      { return scores[name]||0; }
function groupOf(name)       { return members.find(m=>m.name===name); }
function groupColor(gid)     { return GROUPS[gid]?.color||'#888'; }
function initials(n)         { return n.substring(0,2).toUpperCase(); }
function memberColor(name)   { const i=members.findIndex(m=>m.name===name); return MEMBER_COLORS[i%MEMBER_COLORS.length]; }

// LOGIN
function selectRole(r){
  selectedRole=r;
  document.getElementById('role-admin').classList.toggle('selected',r==='admin');
  document.getElementById('role-viewer').classList.toggle('selected',r==='viewer');
  document.getElementById('login-err').textContent='';
}

async function doLogin(){
  const err=document.getElementById('login-err');
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-pass').value;
  if(!email||!password){err.textContent='Captura correo y contraseña.';return;}
  try{
    err.textContent='Validando...';
    const profile=await firebaseSignIn(email,password);
    const expected=selectedRole==='admin'?'admin':'seller';
    if(profile.role!==expected){ await firebaseSignOut(); throw new Error('El rol seleccionado no corresponde a este usuario.'); }
    isAdmin=profile.role==='admin';
    viewerName=isAdmin?'':(profile.memberName||profile.name||'');
    if(!isAdmin&&!viewerName){ await firebaseSignOut(); throw new Error('El vendedor no tiene memberName configurado.'); }

    let loaded=await loadData();
    if(!loaded && isAdmin){
      members=defaultMembers(); scores={}; historial=[]; solicitudes=[]; startDate=new Date();
      await dbSeedState({members,scores,historial,startDate});
      loaded=await loadData();
    }
    if(!loaded) throw new Error('La aplicación aún no ha sido inicializada por un administrador.');

    err.textContent='';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='flex';
    document.querySelectorAll('.admin-only-tab').forEach(t=>t.style.display=isAdmin?'inline-block':'none');
    document.querySelectorAll('.viewer-only-tab').forEach(t=>t.style.display=(!isAdmin)?'inline-block':'none');
    document.getElementById('btn-clear-all').style.display=isAdmin?'inline-block':'none';
    document.getElementById('mode-badge').textContent=isAdmin?'🔐 Admin':'👀 Vendedor';
    document.getElementById('mode-badge').className='mode-badge '+(isAdmin?'mode-admin':'mode-viewer');
    document.getElementById('viewer-name-badge').textContent=viewerName?`👤 ${viewerName}`:'';
    const end=new Date(startDate); end.setMonth(end.getMonth()+3);
    const opts={day:'2-digit',month:'short',year:'numeric'};
    document.getElementById('hero-dur').textContent=startDate.toLocaleDateString('es-MX',opts)+' — '+end.toLocaleDateString('es-MX',opts);
    if(!isAdmin&&viewerName){ document.getElementById('filter-quien').value=viewerName; populateSolForm(); }
    renderAll();
  }catch(e){ console.error(e); err.textContent=e.message||'No fue posible iniciar sesión.'; }
}

async function doLogout(){
  await firebaseSignOut();
  isAdmin=false; viewerName='';
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-pass').value='';
  document.getElementById('login-err').textContent='';
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-ranking').classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.tab-btn').classList.add('active');
}

// MOUNTAIN SVG
function drawMountain(){
  const svg=document.getElementById('mountain-svg');
  const allSorted=[...members].sort((a,b)=>getScore(b.name)-getScore(a.name));
  const peak={x:490,y:26}, lBase={x:25,y:285}, lSho={x:255,y:152}, rBase={x:955,y:285}, rSho={x:725,y:162};
  function posOn(t,side){
    const b=side==='l'?lBase:rBase, s=side==='l'?lSho:rSho;
    if(t<=0) return{...b};
    if(t<0.5){const u=t/0.5;return{x:b.x+(s.x-b.x)*u,y:b.y+(s.y-b.y)*u};}
    const u=(t-0.5)/0.5; return{x:s.x+(peak.x-s.x)*u,y:s.y+(peak.y-s.y)*u};
  }
  let h=`<defs>
    <linearGradient id="mG" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0%" stop-color="#0D1B5E"/><stop offset="100%" stop-color="#1a3a8f"/></linearGradient>
    <linearGradient id="sG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#daedf7"/><stop offset="100%" stop-color="#b8d8ea"/></linearGradient>
    <linearGradient id="wG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4dd9e0"/><stop offset="100%" stop-color="#00C2CB"/></linearGradient>
  </defs>
  <ellipse cx="490" cy="340" rx="440" ry="130" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <ellipse cx="490" cy="340" rx="340" ry="100" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  <polygon points="105,195 5,285 265,285" fill="rgba(30,79,194,0.28)"/>
  <polygon points="875,205 715,285 960,285" fill="rgba(30,79,194,0.28)"/>
  <polygon points="165,155 75,285 315,285" fill="rgba(13,27,94,0.32)"/>
  <polygon points="815,165 665,285 945,285" fill="rgba(13,27,94,0.32)"/>
  <polygon points="490,26 ${lBase.x},${lBase.y} ${rBase.x},${rBase.y}" fill="url(#mG)"/>
  <polygon points="490,26 ${lBase.x},${lBase.y} ${lSho.x},${lSho.y}" fill="rgba(0,0,0,0.18)"/>
  <polygon points="490,26 448,105 532,99" fill="url(#sG)"/>
  <polygon points="490,26 470,70 510,66" fill="white" opacity="0.65"/>
  <line x1="${lBase.x+8}" y1="${lBase.y-4}" x2="${peak.x-7}" y2="${peak.y+10}" stroke="rgba(255,255,255,0.09)" stroke-width="1" stroke-dasharray="5,7"/>
  <line x1="${rBase.x-8}" y1="${rBase.y-4}" x2="${peak.x+7}" y2="${peak.y+10}" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="5,7"/>
  <line x1="490" y1="26" x2="490" y2="5" stroke="#7DC243" stroke-width="2"/>
  <polygon points="490,5 508,13 490,19" fill="#7DC243"/>
  <path d="M0,285 Q120,270 240,280 Q370,290 490,274 Q610,258 730,270 Q855,282 980,267 L980,310 L0,310 Z" fill="url(#wG)" opacity="0.22"/>`;
  allSorted.forEach((m,idx)=>{
    const side=idx%2===0?'l':'r';
    const t=Math.min(0.97,getScore(m.name)/MAX_M);
    const pos=posOn(t,side);
    const ox=(Math.floor(idx/2)%2===0?0:(side==='l'?-15:15));
    const cx=pos.x+ox, cy=pos.y;
    const col=groupColor(m.groupId);
    const ini=m.name.substring(0,3);
    if(idx===0&&getScore(m.name)>0) h+=`<circle cx="${cx}" cy="${cy}" r="14" fill="${col}" opacity="0.22"/>`;
    h+=`<circle cx="${cx}" cy="${cy}" r="10" fill="${col}" stroke="white" stroke-width="1.8"/>`;
    h+=`<text x="${cx}" y="${cy+3.5}" text-anchor="middle" font-family="Montserrat,sans-serif" font-size="6.5" font-weight="800" fill="white">${ini}</text>`;
    if(getScore(m.name)>0) h+=`<text x="${cx}" y="${cy-13}" text-anchor="middle" font-family="Montserrat,sans-serif" font-size="7" fill="${col}" font-weight="700">${getScore(m.name)}m</text>`;
  });
  // Leader panels top-right
  const panelW=170, panelH=44, panelX=980-panelW-8;
  GROUPS.forEach((g,i)=>{
    const py=8+i*(panelH+6);
    const leaders=membersOfGroup(g.id).sort((a,b)=>getScore(b.name)-getScore(a.name));
    const ldr=leaders[0], ldrPts=ldr?getScore(ldr.name):0;
    h+=`<rect x="${panelX}" y="${py}" width="${panelW}" height="${panelH}" rx="7" fill="rgba(0,0,0,0.55)" stroke="${g.colorB}" stroke-width="1" opacity="0.95"/>`;
    h+=`<circle cx="${panelX+11}" cy="${py+13}" r="5" fill="${g.colorB}"/>`;
    h+=`<text x="${panelX+21}" y="${py+17}" font-family="Montserrat,sans-serif" font-size="8" font-weight="800" fill="rgba(255,255,255,0.9)">${g.label}</text>`;
    if(ldr&&ldrPts>0){
      h+=`<text x="${panelX+9}" y="${py+33}" font-family="Montserrat,sans-serif" font-size="8.5" font-weight="700" fill="${g.colorB}">🏅 ${ldr.name}</text>`;
      h+=`<text x="${panelX+panelW-8}" y="${py+33}" text-anchor="end" font-family="Montserrat,sans-serif" font-size="9" font-weight="900" fill="#f6c90e">${ldrPts}m</text>`;
    } else {
      h+=`<text x="${panelX+9}" y="${py+33}" font-family="Montserrat,sans-serif" font-size="7.5" fill="rgba(255,255,255,0.4)">Sin puntos aún</text>`;
    }
  });
  svg.innerHTML=h;
}

// RANKING
function renderRanking(){
  const total=members.reduce((s,m)=>s+getScore(m.name),0);
  document.getElementById('stat-total').textContent=total;
  document.getElementById('groups-wrap').innerHTML=GROUPS.map(g=>{
    const mems=membersOfGroup(g.id).sort((a,b)=>getScore(b.name)-getScore(a.name));
    const leader=mems[0];
    const prizeStr=g.prizes.map(p=>`${p.medal}${p.place}: ${p.amount}`).join(' · ');
    const leaderStr=leader&&getScore(leader.name)>0
      ?`🏅 Líder: <strong>${leader.name}</strong> con ${getScore(leader.name)} metros`
      :'Sin puntos registrados aún';
    const cards=mems.map((m,idx)=>{
      const pts=getScore(m.name), pct=Math.min(100,Math.round(pts/MAX_M*100));
      const rk=idx===0?'rank-1':idx===1?'rank-2':idx===2?'rank-3':'rank-other';
      const medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':idx+1;
      const hasPrize=g.prizes[idx];
      return `<div class="climber-card ${rk}">
        <span class="rank-badge" style="background:${idx===0?'#f6c90e':idx===1?'#c0c0c0':idx===2?'#cd7f32':g.color+'22'};color:${idx<3?'#333':'white'}">${medal}</span>
        <div class="climber-avatar" style="background:${g.color}">${initials(m.name)}</div>
        <div class="climber-name">${m.name}</div>
        <div class="climber-pts">${pts}</div>
        <div class="climber-pts-label">metros</div>
        <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${g.color},${g.colorB})"></div></div>
        <div class="meter-label">${pct}% a la cima</div>
        ${hasPrize?`<div class="prize-tag" style="background:${g.color}15;color:${g.color};">${hasPrize.medal} ${hasPrize.amount}</div>`:''}
      </div>`;
    }).join('');
    return `<div class="group-block">
      <div class="group-header" style="background:linear-gradient(135deg,${g.color},${g.colorB});">
        <div><div class="group-title">${g.label}</div><div class="group-count">${mems.length} integrantes</div></div>
        <div class="group-meta"><span class="prize-badge">🏆 ${prizeStr}</span></div>
      </div>
      <div class="group-leader-line" style="background:${g.color}ee;">${leaderStr}</div>
      <div class="group-cards">${cards}</div>
    </div>`;
  }).join('');
}

// PRIZES
function renderPrizes(){
  document.getElementById('prizes-grid').innerHTML=GROUPS.map(g=>`
    <div class="prize-card" style="background:linear-gradient(135deg,${g.color},${g.colorB})">
      <div class="prize-card-title">${g.label}</div>
      ${g.prizes.map(p=>`<div class="prize-place"><span class="prize-place-medal">${p.medal}</span><div><div class="prize-place-text">${p.place}</div><div class="prize-amount">${p.amount}</div></div></div>`).join('')}
      <div class="prize-note">Solo integrantes del grupo califican para este premio.</div>
      <div class="prize-mountain">⛰</div>
    </div>`).join('');
}

// FORM SELECTS (admin add)
function populateFormSelects(){
  const sg=document.getElementById('sel-grupo'); if(!sg)return;
  sg.innerHTML=GROUPS.map(g=>`<option value="${g.id}">${g.label}</option>`).join('');
  onGrupoChange();
  const sa=document.getElementById('sel-accion'),curA=sa.value;
  sa.innerHTML=ACCIONES.map(a=>`<option value="${a.key}">${a.label}</option>`).join('');
  if(curA)sa.value=curA;
  ['filter-grupo','filter-quien','filter-accion'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    const cur=el.value;
    if(id==='filter-grupo') el.innerHTML=`<option value="">Todos los grupos</option>`+GROUPS.map(g=>`<option value="${g.id}">${g.label}</option>`).join('');
    else if(id==='filter-quien') el.innerHTML=`<option value="">Todos los vendedores</option>`+members.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
    else if(id==='filter-accion') el.innerHTML=`<option value="">Todas las acciones</option>`+ACCIONES.map(a=>`<option value="${a.key}">${a.label}</option>`).join('');
    if(cur) el.value=cur;
  });
  const bfg=document.getElementById('band-filter-grupo'); if(bfg){ const c=bfg.value; bfg.innerHTML=`<option value="">Todos los grupos</option>`+GROUPS.map(g=>`<option value="${g.id}">${g.label}</option>`).join(''); if(c)bfg.value=c; }
  const bfq=document.getElementById('band-filter-quien'); if(bfq){ const c=bfq.value; bfq.innerHTML=`<option value="">Todos los vendedores</option>`+members.map(m=>`<option value="${m.name}">${m.name}</option>`).join(''); if(c)bfq.value=c; }
}

function onGrupoChange(){
  const gid=parseInt(document.getElementById('sel-grupo').value);
  const sv=document.getElementById('sel-vendedor'), cur=sv.value;
  const mems=membersOfGroup(gid);
  sv.innerHTML=mems.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  if(cur&&mems.find(m=>m.name===cur)) sv.value=cur;
  ['emb-1','emb-2','emb-3'].forEach(id=>{
    const el=document.getElementById(id),c=el.value;
    el.innerHTML=`<option value="">—</option>`+mems.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
    if(c&&mems.find(m=>m.name===c)) el.value=c;
  });
}

function onActionChange(){
  const key=document.getElementById('sel-accion').value;
  const emb=document.getElementById('emb-section'), prev=document.getElementById('pts-preview'), num=document.getElementById('pts-num');
  if(key==='embajador'){emb.style.display='block';prev.style.display='none';}
  else{emb.style.display='none';const ac=ACCIONES.find(a=>a.key===key);if(ac){num.textContent=`+${ac.pts}`;prev.style.display='flex';}}
}

function onFilterGrupo(silent){
  const gid=document.getElementById('filter-grupo').value;
  const fq=document.getElementById('filter-quien'), cur=fq.value;
  const mems=gid===''?members:members.filter(m=>m.groupId===parseInt(gid));
  fq.innerHTML=`<option value="">Todos los vendedores</option>`+mems.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  if(cur&&mems.find(m=>m.name===cur)) fq.value=cur;
  if(!silent) renderHistorial();
}

// REGISTER POINTS (admin direct)
function registerPoints(){
  const gid=parseInt(document.getElementById('sel-grupo').value);
  const vendedor=document.getElementById('sel-vendedor').value;
  const key=document.getElementById('sel-accion').value;
  const nota=document.getElementById('nota').value.trim();
  const now=new Date();
  if(!vendedor){showToast('Selecciona un vendedor');return;}
  if(key==='embajador'){
    const e1=document.getElementById('emb-1').value, e2=document.getElementById('emb-2').value, e3=document.getElementById('emb-3').value;
    if(!e1&&!e2&&!e3){showToast('Asigna al menos un lugar');return;}
    [[e1,3,'1er lugar'],[e2,2,'2do lugar'],[e3,1,'3er lugar']].forEach(([n,p,lug])=>{
      if(n){ const mg=groupOf(n); scores[n]=(scores[n]||0)+p; historial.unshift({id:Date.now()+Math.random(),name:n,groupId:mg?mg.groupId:gid,key,label:`Embajador Mkt LN — ${lug}`,pts:p,nota,date:now}); }
    });
    showToast('🏅 Puntos de embajador registrados');
  } else {
    const ac=ACCIONES.find(a=>a.key===key); if(!ac)return;
    scores[vendedor]=(scores[vendedor]||0)+ac.pts;
    historial.unshift({id:Date.now(),name:vendedor,groupId:gid,key,label:ac.label,pts:ac.pts,nota,date:now});
    showToast(`⛏ +${ac.pts} metros para ${vendedor}!`);
  }
  document.getElementById('nota').value='';
  saveData(); renderAll();
}

// SOLICITAR ACCIÓN (viewer)
function populateSolForm(){
  const ni=document.getElementById('sol-nombre'); if(ni) ni.value=viewerName;
  const sa=document.getElementById('sol-accion'); if(!sa)return;
  sa.innerHTML=ACCIONES.map(a=>`<option value="${a.key}">${a.label}</option>`).join('');
  onSolActionChange();
  renderMySols();
}

function onSolActionChange(){
  const key=document.getElementById('sol-accion').value;
  const ac=ACCIONES.find(a=>a.key===key);
  const prev=document.getElementById('sol-pts-preview'), num=document.getElementById('sol-pts-num');
  if(ac){ num.textContent=ac.pts===null?'+3/2/1':`+${ac.pts}`; prev.style.display='flex'; }
  else { prev.style.display='none'; }
}

async function enviarSolicitud(){
  const accionKey=document.getElementById('sol-accion').value;
  const cliente  =document.getElementById('sol-cliente').value.trim();
  const consultor=document.getElementById('sol-consultor').value.trim();
  const obs      =document.getElementById('sol-obs').value.trim();
  const ac=ACCIONES.find(a=>a.key===accionKey);
  const mg=groupOf(viewerName);
  if(!cliente)  {showToast('Escribe el nombre del cliente');return;}
  if(!consultor){showToast('Escribe el nombre del consultor');return;}
  if(!ac)       {showToast('Selecciona una acción');return;}

  const sol={
    id: Date.now()+Math.random(),
    name: viewerName,
    groupId: mg?mg.groupId:0,
    accionKey,
    accionLabel: ac.label,
    pts: ac.pts,
    cliente, consultor, obs,
    date: new Date(),
    status: 'pending',
    assignedBy: '',
    resolvedDate: null
  };
  try{
    sol.id=await dbCreateRequest(sol);
    solicitudes.unshift(sol);
  }catch(e){ console.error(e); showToast('⚠ No se pudo enviar la solicitud'); return; }

  document.getElementById('sol-cliente').value='';
  document.getElementById('sol-consultor').value='';
  document.getElementById('sol-obs').value='';

  updateNotifBadge();
  renderMySols();
  showToast('✅ Solicitud enviada — el admin la revisará en la bandeja');
}

function renderMySols(){
  const list=solicitudes.filter(s=>s.name===viewerName);
  const el=document.getElementById('my-sols-list'); if(!el)return;
  if(!list.length){el.innerHTML=`<div class="my-sols-empty">No tienes solicitudes aún.</div>`;return;}
  el.innerHTML=list.map(s=>{
    const ds=s.date.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const ptsShow=s.pts===null?'3/2/1':String(s.pts);
    const statusLabel=s.status==='pending'?'⏳ Pendiente':s.status==='approved'?'✅ Aprobada':'❌ Rechazada';
    const resolvedStr=s.resolvedDate&&s.assignedBy?` · Gestionada por ${s.assignedBy}`:'';
    return `<div class="my-sol-item st-${s.status}">
      <div class="my-sol-main">
        <div class="my-sol-action">${s.accionLabel}</div>
        <div class="my-sol-detail">👤 ${s.cliente} · 🧑‍💼 ${s.consultor}${s.obs?' · '+s.obs:''}</div>
        <div class="my-sol-date">📅 ${ds}${resolvedStr}</div>
      </div>
      <div class="my-sol-right">
        <div class="my-sol-pts">+${ptsShow}</div>
        <span class="my-sol-status">${statusLabel}</span>
      </div>
    </div>`;
  }).join('');
}

// BANDEJA (admin)
function filterBandeja(status){
  bandejaStatusFilter=status;
  document.getElementById('band-filter-status').value=status;
  document.querySelectorAll('.bstat').forEach(b=>b.classList.remove('active-filter'));
  const map={'':'bst-all','pending':'bst-pending','approved':'bst-approved','rejected':'bst-rejected'};
  document.querySelector('.'+map[status])?.classList.add('active-filter');
  renderBandeja();
}

function renderBandeja(){
  const fs=document.getElementById('band-filter-status')?.value||'';
  const fg=document.getElementById('band-filter-grupo')?.value||'';
  const fq=document.getElementById('band-filter-quien')?.value||'';

  // Stats
  document.getElementById('cnt-all').textContent     = solicitudes.length;
  document.getElementById('cnt-pending').textContent  = solicitudes.filter(s=>s.status==='pending').length;
  document.getElementById('cnt-approved').textContent = solicitudes.filter(s=>s.status==='approved').length;
  document.getElementById('cnt-rejected').textContent = solicitudes.filter(s=>s.status==='rejected').length;

  let list=solicitudes.filter(s=>{
    if(fs&&s.status!==fs)return false;
    if(fg&&String(s.groupId)!==fg)return false;
    if(fq&&s.name!==fq)return false;
    return true;
  });

  const el=document.getElementById('bandeja-list'); if(!el)return;
  if(!list.length){el.innerHTML=`<div class="bandeja-empty">📥 No hay solicitudes que mostrar.</div>`;return;}

  el.innerHTML=list.map(sol=>{
    const col=memberColor(sol.name);
    const g=GROUPS[sol.groupId]||GROUPS[0];
    const ini=sol.name.substring(0,2).toUpperCase();
    const ds=sol.date.toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const ptsShow=sol.pts===null?'3/2/1':String(sol.pts);
    const statusLabel=sol.status==='pending'?'⏳ Pendiente':sol.status==='approved'?'✅ Aprobada':'❌ Rechazada';

    const footerHtml = sol.status==='pending'
      ? `<span class="assign-label">Asignado por:</span>
         <input class="assign-input" type="text" id="ai-${sol.id}" placeholder="Tu nombre" value="${sol.assignedBy||''}">
         <button class="btn-approve" onclick="approveSol('${sol.id}')">✅ Aprobar y dar puntos</button>
         <button class="btn-reject"  onclick="rejectSol('${sol.id}')">❌ Rechazar</button>`
      : sol.status==='approved'
        ? `<span class="resolved-info approved">✅ Aprobada por <strong>${sol.assignedBy||'Admin'}</strong>${sol.resolvedDate?' · '+sol.resolvedDate.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):''}</span>`
        : `<span class="resolved-info rejected">❌ Rechazada por <strong>${sol.assignedBy||'Admin'}</strong>${sol.resolvedDate?' · '+sol.resolvedDate.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):''}</span>`;

    return `<div class="sol-card status-${sol.status}">
      <div class="sol-card-head">
        <div class="sol-av" style="background:${col}">${ini}</div>
        <div class="sol-head-main">
          <div class="sol-head-name">${sol.name}
            <span class="sol-group-tag hist-group-tag" style="background:${g.color}18;color:${g.color}">${g.label.split(' ')[0]}</span>
          </div>
          <div class="sol-head-accion">${sol.accionLabel}</div>
          <div class="sol-head-date">📅 ${ds}</div>
        </div>
        <div class="sol-right">
          <div class="sol-pts-badge">${ptsShow}<small>puntos</small></div>
          <span class="sol-status-pill">${statusLabel}</span>
        </div>
      </div>
      <div class="sol-card-fields">
        <div class="sol-field"><label>Cliente</label><span>${sol.cliente||'—'}</span></div>
        <div class="sol-field"><label>Consultor</label><span>${sol.consultor||'—'}</span></div>
      </div>
      ${sol.obs?`<div class="sol-obs-row"><strong>Observación:</strong> ${sol.obs}</div>`:''}
      <div class="sol-card-footer">${footerHtml}</div>
    </div>`;
  }).join('');

  updateNotifBadge();
}

async function approveSol(id){
  const sol=solicitudes.find(s=>String(s.id)===String(id));
  if(!sol||sol.status!=='pending')return;
  const assignedBy=(document.getElementById(`ai-${id}`)?.value||'').trim();
  if(!assignedBy){showToast('Escribe quién está aprobando');return;}
  if(sol.pts===null){showToast('Para Embajadores usa la pestaña ➕ Agregar Puntos y asigna 1er/2do/3er lugar');return;}

  const mg=groupOf(sol.name);
  const gid=mg?mg.groupId:sol.groupId;
  scores[sol.name]=(scores[sol.name]||0)+sol.pts;
  historial.unshift({
    id:Date.now()+Math.random(),
    name:sol.name, groupId:gid,
    key:sol.accionKey, label:`${sol.accionLabel} (cliente: ${sol.cliente||'—'})`,
    pts:sol.pts,
    nota:`Aprobado por ${assignedBy}${sol.obs?' · '+sol.obs:''}`,
    date:new Date()
  });
  sol.status='approved'; sol.assignedBy=assignedBy; sol.resolvedDate=new Date();
  try{ await dbUpdateRequest(sol.id,{status:'approved',assignedBy,resolvedDate:sol.resolvedDate}); await saveData(); }
  catch(e){ console.error(e); showToast('⚠ Error guardando aprobación'); return; }
  renderAll();
  showToast(`✅ +${sol.pts} pts para ${sol.name} — aprobado por ${assignedBy}`);
}

async function rejectSol(id){
  const sol=solicitudes.find(s=>String(s.id)===String(id));
  if(!sol||sol.status!=='pending')return;
  const assignedBy=(document.getElementById(`ai-${id}`)?.value||'').trim();
  if(!confirm(`¿Rechazar la solicitud de ${sol.name}?`))return;
  sol.status='rejected'; sol.assignedBy=assignedBy||'Admin'; sol.resolvedDate=new Date();
  try{ await dbUpdateRequest(sol.id,{status:'rejected',assignedBy:sol.assignedBy,resolvedDate:sol.resolvedDate}); }
  catch(e){ console.error(e); showToast('⚠ Error guardando rechazo'); return; }
  renderBandeja(); renderMySols();
  showToast(`❌ Solicitud de ${sol.name} rechazada`);
}

function updateNotifBadge(){
  const pending=solicitudes.filter(s=>s.status==='pending').length;
  const badge=document.getElementById('notif-badge');
  if(badge){badge.style.display=pending>0?'inline-flex':'none'; badge.textContent=pending;}
}

// HISTORIAL
function renderHistorial(){
  const fgVal=document.getElementById('filter-grupo').value;
  const fq=document.getElementById('filter-quien').value;
  const fa=document.getElementById('filter-accion').value;
  let list=historial.filter(h=>{
    if(fgVal!==''&&String(h.groupId)!==fgVal)return false;
    if(fq&&h.name!==fq)return false;
    if(fa&&h.key!==fa)return false;
    return true;
  });
  if(!isAdmin&&viewerName) list=historial.filter(h=>h.name===viewerName);
  const el=document.getElementById('hist-list');
  if(!list.length){el.innerHTML=`<div class="hist-empty">📋 No hay registros que mostrar.</div>`;return;}
  el.innerHTML=list.map(h=>{
    const col=memberColor(h.name), g=GROUPS[h.groupId]||GROUPS[0], ini=h.name.substring(0,2).toUpperCase();
    const ds=h.date.toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
    const delBtn=isAdmin?`<button class="btn-del" onclick="deleteEntry('${h.id}')">✕</button>`:'';
    return `<div class="hist-item">
      <div class="hist-av" style="background:${col}">${ini}</div>
      <div class="hist-main">
        <div class="hist-name">${h.name}<span class="hist-group-tag" style="background:${g.color}18;color:${g.color}">${g.label.split(' ')[0]}</span></div>
        <div class="hist-action">${h.label}${h.nota?` — <em style="opacity:0.7">${h.nota}</em>`:''}</div>
        <div class="hist-date">📅 ${ds}</div>
      </div>
      <div class="hist-pts">+${h.pts}m</div>
      ${delBtn}
    </div>`;
  }).join('');
}

function deleteEntry(id){
  const entry=historial.find(h=>String(h.id)===String(id)); if(!entry)return;
  if(!confirm(`¿Borrar: "${entry.label}" de ${entry.name} (+${entry.pts} pts)?`))return;
  scores[entry.name]=Math.max(0,(scores[entry.name]||0)-entry.pts);
  historial=historial.filter(h=>String(h.id)!==String(id));
  showToast(`🗑 Eliminado de ${entry.name}`); saveData(); renderAll();
}

function clearAll(){
  if(!confirm('¿Borrar TODO el historial y reiniciar puntos?'))return;
  scores={}; historial=[]; showToast('🗑 Datos reiniciados'); saveData(); renderAll();
}

// ACCIONES TABLE
function renderAcciones(){
  document.getElementById('acc-tbody').innerHTML=ACCIONES.map(a=>{
    const p=a.pts===null?`<span class="pts-pill pts-pill-c">3 / 2 / 1</span>`:`<span class="pts-pill">${a.pts}</span>`;
    return `<tr><td>${a.label}</td><td>${p}</td></tr>`;
  }).join('');
}

// EQUIPO
function renderTeam(){
  document.getElementById('team-groups').innerHTML=GROUPS.map(g=>{
    const mems=membersOfGroup(g.id);
    return `<div class="team-group-block">
      <div class="team-group-hdr" style="background:linear-gradient(135deg,${g.color},${g.colorB});">
        <span class="team-group-name">${g.label}</span>
        <span style="color:rgba(255,255,255,0.6);font-size:0.75rem;font-weight:600;margin-left:auto;">${mems.length} integrantes</span>
      </div>
      <div class="team-list">
        ${mems.map(m=>`<div class="team-item">
          <div class="team-av" style="background:${g.color}">${initials(m.name)}</div>
          <span>${m.name}</span>
          <span class="team-pts">${getScore(m.name)} pts</span>
          <button class="btn-rm" onclick="removeMember('${m.name}')">✕</button>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function addMember(){
  const input=document.getElementById('nuevo-nombre'), gid=parseInt(document.getElementById('nuevo-grupo').value), name=input.value.trim();
  if(!name){showToast('Escribe un nombre');return;}
  if(members.find(m=>m.name===name)){showToast('Ya existe ese integrante');return;}
  members.push({name,groupId:gid}); input.value='';
  saveData(); renderAll(); showToast(`✅ ${name} agregado a ${GROUPS[gid].label}`);
}

function removeMember(name){
  if(!confirm(`¿Eliminar a ${name}? Se eliminarán sus puntos e historial.`))return;
  members=members.filter(m=>m.name!==name); delete scores[name]; historial=historial.filter(h=>h.name!==name);
  saveData(); renderAll(); showToast(`${name} eliminado`);
}

// TABS / TOAST
function switchTab(id,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-'+id).classList.add('active');
  if(btn)btn.classList.add('active');
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._to); t._to=setTimeout(()=>t.classList.remove('show'),2800);
}

// RENDER ALL
function renderAll(){
  drawMountain(); renderRanking(); renderPrizes(); renderHistorial(); renderTeam();
  if(isAdmin){ populateFormSelects(); onActionChange(); renderBandeja(); }
  if(!isAdmin&&viewerName) renderMySols();
  updateNotifBadge();
}

// INIT
(function init(){
  members=defaultMembers(); scores={}; historial=[]; solicitudes=[]; startDate=new Date();
  renderAcciones();
  selectRole('admin');
})();
