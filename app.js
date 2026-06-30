const SUPABASE_URL='https://vjiwvgywiynjoayujucz.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqaXd2Z3l3aXluam9heXVqdWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjczNDcsImV4cCI6MjA5NzEwMzM0N30.ThvxrzTVVV8ZRzovWBDs_3-lHjMJcOLxbzf8HAACVC0';
const CFG={MAX_NOTES:2000,MAX_NAME:50,MAX_COMPANY:100,MAX_PHONE:30,MAX_EMAIL:100};

const U={
  today(){return new Date().toISOString().slice(0,10)},
  fmt(d){if(!d)return'—';const[y,m,j]=d.split('-');return j+'/'+m+'/'+y},
  initials(p){return(((p.prenom||'?')[0])+((p.nom||'?')[0])).toUpperCase()},
  isToday(d){return d===this.today()},
  isLate(d){return d&&d<this.today()},
  esc(str){if(str==null)return'';const div=document.createElement('div');div.textContent=String(str);return div.innerHTML},
  genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,10)},
  validEmail(e){return!e||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)},
  validPhone(t){return!t||/^[\d\s\+\-\(\)\.]{7,30}$/.test(t)},
  clean(str,max){if(!str)return'';let s=String(str).trim().slice(0,max);return s.replace(/<[^>]*>/g,'')},
  toast(msg,ms=2600){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',ms)}
};

const BC={'Intéresse':'badge-interesse','En attente':'badge-attente','A relancer':'badge-relancer','Refus':'badge-refus','Signe':'badge-signe'};
const BI={'Intéresse':'✅','En attente':'⏳','A relancer':'🔄','Refus':'❌','Signe':'🏆'};

const S={prospects:[],editId:null,sb:null,user:null,anon:false,entreprises:[],view:'table',editTags:[]};
const TAG_CLASS={'Urgent':'t-urgent','VIP':'t-vip','Famille':'t-famille','Entreprise':'t-entreprise'};
const TAG_ICON={'Urgent':'🔴','VIP':'🟡','Famille':'🔵','Entreprise':'🟣'};

const Db={
  init(){
    try{S.sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});this.chk()}
    catch(e){console.error(e);U.toast('Erreur connexion base de donnees');S.anon=true;S.prospects=JSON.parse(localStorage.getItem('lhcgp_local')||'[]');S.entreprises=JSON.parse(localStorage.getItem('lhcgp_entreprises')||'[]');UI.showApp();Render.all()}
  },
  async chk(){
    const{data:{session}}=await S.sb.auth.getSession();
    if(session){S.user=session.user;await this.load();UI.showApp()}
  },
  async load(){
    Sync.set('syncing','Chargement...');
    Render.skeleton();
    try{
      if(S.anon){
        S.prospects=JSON.parse(localStorage.getItem('lhcgp_local')||'[]');
        S.entreprises=JSON.parse(localStorage.getItem('lhcgp_entreprises')||'[]');
        Sync.set('ok','Mode local');Render.all();Entreprises.populateSelect();return
      }
      const[pRes,eRes]=await Promise.all([
        S.sb.from('prospects').select('*').eq('user_id',S.user.id).order('created_at',{ascending:false}),
        S.sb.from('entreprises').select('*').eq('user_id',S.user.id).order('created_at',{ascending:false})
      ]);
      if(pRes.error)throw pRes.error;
      if(eRes.error)throw eRes.error;
      S.prospects=pRes.data||[];
      S.entreprises=(eRes.data||[]).map(e=>({id:e.id,nom:e.nom,visitee:e.visitee,dateVisite:e.datevisite,createdAt:e.created_at}));
      Sync.set('ok','Synchronise');Render.all();Entreprises.populateSelect()
    }catch(e){
      console.error(e);Sync.set('error','Erreur chargement');
      S.prospects=JSON.parse(localStorage.getItem('lhcgp_local')||'[]');
      S.entreprises=JSON.parse(localStorage.getItem('lhcgp_entreprises')||'[]');
      Render.all();Entreprises.populateSelect();U.toast('Mode local temporaire')
    }
  },
  async save(p){
    if(S.anon){localStorage.setItem('lhcgp_local',JSON.stringify(S.prospects));Sync.set('ok','Mode local');return}
    Sync.set('syncing','Sauvegarde...');
    try{
      const{error}=await S.sb.from('prospects').upsert({id:p.id,user_id:S.user.id,prenom:p.prenom,nom:p.nom,entreprise:p.entreprise,poste:p.poste,tel:p.tel,email:p.email,rencontre:p.rencontre,relance:p.relance,statut:p.statut,notes:p.notes,tags:p.tags||[],history:p.history||[],updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error;Sync.set('ok','Synchronise')
    }catch(e){
      console.error(e);Sync.set('error','Erreur sauvegarde');
      localStorage.setItem('lhcgp_local',JSON.stringify(S.prospects));
      U.toast('Sauvegarde locale')
    }
  },
  async del(id){
    if(S.anon){localStorage.setItem('lhcgp_local',JSON.stringify(S.prospects));return}
    try{const{error}=await S.sb.from('prospects').delete().eq('id',id).eq('user_id',S.user.id);if(error)throw error}
    catch(e){console.error(e);U.toast('Erreur suppression distante')}
  },
  async saveEntreprise(ent){
    if(S.anon){localStorage.setItem('lhcgp_entreprises',JSON.stringify(S.entreprises));return}
    Sync.set('syncing','Sauvegarde...');
    try{
      const{error}=await S.sb.from('entreprises').upsert({id:ent.id,user_id:S.user.id,nom:ent.nom,visitee:ent.visitee,datevisite:ent.dateVisite,updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error;Sync.set('ok','Synchronise')
    }catch(e){
      console.error(e);Sync.set('error','Erreur sauvegarde');
      localStorage.setItem('lhcgp_entreprises',JSON.stringify(S.entreprises));
      U.toast('Sauvegarde locale (entreprise)')
    }
  },
  async delEntreprise(id){
    if(S.anon){localStorage.setItem('lhcgp_entreprises',JSON.stringify(S.entreprises));return}
    try{const{error}=await S.sb.from('entreprises').delete().eq('id',id).eq('user_id',S.user.id);if(error)throw error}
    catch(e){console.error(e);U.toast('Erreur suppression distante (entreprise)')}
  }
};

const Auth={
  switchTab(t){
    document.querySelectorAll('.auth-tab').forEach(x=>x.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
    document.getElementById('form-login').style.display=t=='login'?'block':'none';
    document.getElementById('form-register').style.display=t=='register'?'block':'none'
  },
  showErr(id,show){
    const g=document.getElementById(id);
    if(show)g.classList.add('has-error');
    else g.classList.remove('has-error')
  },
  async login(){
    const e=document.getElementById('login-email').value.trim();
    const p=document.getElementById('login-password').value;
    this.showErr('grp-login-email',!U.validEmail(e)||!e);
    this.showErr('grp-login-password',!p||p.length<6);
    if(!U.validEmail(e)||!e||!p||p.length<6)return;
    try{
      const{data,error}=await S.sb.auth.signInWithPassword({email:e,password:p});
      if(error)throw error;
      S.user=data.user;S.anon=false;
      await Db.load();UI.showApp();U.toast('Connecte')
    }catch(e){U.toast('Erreur: '+(e.message||'connexion impossible'),'error')}
  },
  async register(){
    const e=document.getElementById('reg-email').value.trim();
    const p=document.getElementById('reg-password').value;
    const p2=document.getElementById('reg-password2').value;
    this.showErr('grp-reg-email',!U.validEmail(e)||!e);
    this.showErr('grp-reg-password',!p||p.length<6);
    this.showErr('grp-reg-password2',p!==p2||!p2);
    if(!U.validEmail(e)||!e||!p||p.length<6||p!==p2)return;
    try{
      const{data,error}=await S.sb.auth.signUp({email:e,password:p});
      if(error)throw error;
      S.user=data.user;S.anon=false;
      await Db.load();UI.showApp();U.toast('Compte cree - verifiez votre email')
    }catch(e){U.toast('Erreur: '+(e.message||'inscription impossible'),'error')}
  },
  anonymous(){
    S.anon=true;
    S.user={id:'local_'+U.genId(),email:'Mode local'};
    S.prospects=JSON.parse(localStorage.getItem('lhcgp_local')||'[]');
    S.entreprises=JSON.parse(localStorage.getItem('lhcgp_entreprises')||'[]');
    UI.showApp();Render.all();U.toast('Mode local - donnees sur cet appareil')
  },
  async logout(){
    if(!S.anon)await S.sb.auth.signOut();
    S.user=null;S.anon=false;S.prospects=[];S.entreprises=[];
    UI.toggleUserMenu();
    document.getElementById('app').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    U.toast('Deconnecte')
  }
};

const Sync={set(st,lb){document.getElementById('sync-dot').className='sync-dot'+(st?' '+st:'');document.getElementById('sync-label').textContent=lb}};

const Entreprises={
  openModal(){
    this.renderList();
    document.getElementById('modal-entreprises').classList.add('open')
  },
  add(){
    const input=document.getElementById('new-entreprise');
    const nom=U.clean(input.value,CFG.MAX_COMPANY);
    if(!nom){U.toast('Veuillez saisir un nom d\'entreprise');return}
    if(S.entreprises.find(e=>e.nom.toLowerCase()===nom.toLowerCase())){U.toast('Cette entreprise existe deja');return}
    const ent={id:U.genId(),nom:nom,visitee:false,dateVisite:null,createdAt:new Date().toISOString()};
    S.entreprises.push(ent);
    input.value='';
    this.renderList();
    this.populateSelect();
    Db.saveEntreprise(ent);
    U.toast('Entreprise ajoutee')
  },
  toggleVisite(id){
    const e=S.entreprises.find(x=>x.id===id);
    if(!e)return;
    e.visitee=!e.visitee;
    e.dateVisite=e.visitee?U.today():null;
    this.renderList();
    Db.saveEntreprise(e);
    U.toast(e.visitee?'Entreprise marquee comme visitee':'Marque visitee retiree')
  },
  remove(id){
    if(!confirm('Supprimer cette entreprise de la liste ?'))return;
    S.entreprises=S.entreprises.filter(x=>x.id!==id);
    this.renderList();
    this.populateSelect();
    Db.delEntreprise(id);
    U.toast('Entreprise supprimee')
  },
  renderList(){
    const container=document.getElementById('entreprise-list');
    if(!S.entreprises.length){
      container.innerHTML='<div class="empty-state" style="padding:30px"><div class="empty-icon" style="font-size:32px">🏢</div><div class="empty-title">Aucune entreprise</div><div class="empty-sub">Ajoutez des entreprises a visiter</div></div>';
      return
    }
    // Trier : non visitees d'abord, puis par date de creation
    const list=[...S.entreprises].sort((a,b)=>{
      if(a.visitee&&!b.visitee)return 1;
      if(!a.visitee&&b.visitee)return -1;
      return new Date(b.createdAt)-new Date(a.createdAt)
    });
    container.innerHTML=list.map(e=>{
      const visiteClass=e.visitee?'visitee':'';
      const visiteIcon=e.visitee?'✅':'⭕';
      const visiteLabel=e.visitee?'Visitee le '+U.fmt(e.dateVisite):'Marquer visitee';
      return `<div class="entreprise-item ${visiteClass}">
        <span style="font-size:16px">🏢</span>
        <div class="entreprise-nom">${U.esc(e.nom)}</div>
        ${e.visitee?`<div class="entreprise-date">${U.fmt(e.dateVisite)}</div>`:''}
        <div class="entreprise-actions">
          <button class="btn-visite" onclick="Entreprises.toggleVisite('${U.esc(e.id)}')" title="${visiteLabel}">${visiteIcon}</button>
          <button class="btn-suppr" onclick="Entreprises.remove('${U.esc(e.id)}')" title="Supprimer">🗑</button>
        </div>
      </div>`
    }).join('')
  },
  populateSelect(){
    const select=document.getElementById('f-entreprise-select');
    if(!select)return;
    const current=select.value;
    let html='<option value="">-- Choisir une entreprise --</option>';
    // Non visitees d'abord
    const nonVisitees=S.entreprises.filter(e=>!e.visitee).sort((a,b)=>a.nom.localeCompare(b.nom));
    const visitees=S.entreprises.filter(e=>e.visitee).sort((a,b)=>a.nom.localeCompare(b.nom));
    if(nonVisitees.length){
      html+='<optgroup label="A visiter">';
      nonVisitees.forEach(e=>{html+=`<option value="${U.esc(e.nom)}">${U.esc(e.nom)}</option>`});
      html+='</optgroup>'
    }
    if(visitees.length){
      html+='<optgroup label="✅ Deja visitees">';
      visitees.forEach(e=>{html+=`<option value="${U.esc(e.nom)}" style="color:var(--red)">${U.esc(e.nom)}</option>`});
      html+='</optgroup>'
    }
    select.innerHTML=html;
    select.value=current
  }
};

function tagChips(p){return(p.tags||[]).map(t=>`<span class="tag-chip ${TAG_CLASS[t]||''}">${TAG_ICON[t]||''} ${U.esc(t)}</span>`).join(' ')}

const Render={
  all(){this.metrics();this.filteredList();if(S.view==='kanban')this.kanban();else this.table()},
  filteredList(){
    const search=(document.getElementById('search').value||'').toLowerCase().trim(),
      fs=document.getElementById('filter-statut').value,fr=document.getElementById('filter-relance').value,
      ft=document.getElementById('filter-tag')?document.getElementById('filter-tag').value:'';
    let list=S.prospects.filter(p=>{
      const txt=((p.prenom||'')+(p.nom||'')+(p.entreprise||'')+(p.poste||'')+(p.tel||'')+(p.email||'')+(p.notes||'')).toLowerCase();
      if(search&&!txt.includes(search))return false;
      if(fs&&p.statut!==fs)return false;
      if(fr==='today'&&!U.isToday(p.relance))return false;
      if(fr==='late'&&!U.isLate(p.relance))return false;
      if(ft&&!(p.tags||[]).includes(ft))return false;
      return true
    });
    this._list=list;return list
  },
  metrics(){
    const t=S.prospects.length,rel=S.prospects.filter(p=>U.isToday(p.relance)).length,
      late=S.prospects.filter(p=>U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus').length,
      sign=S.prospects.filter(p=>p.statut==='Signe').length,inter=S.prospects.filter(p=>p.statut==='Interesse').length;
    document.getElementById('nb-total').textContent=t;
    document.getElementById('nb-today').textContent=rel;document.getElementById('nb-today').style.display=rel>0?'':'none';
    document.getElementById('nb-late').textContent=late;document.getElementById('nb-late').style.display=late>0?'':'none';
    document.getElementById('metrics').innerHTML=`<div class="metric-card"><div class="metric-icon" style="background:#EFF6FF">📁</div><div class="metric-label">Total</div><div class="metric-value">${t}</div></div><div class="metric-card"><div class="metric-icon" style="background:var(--green-bg)">✅</div><div class="metric-label">Interesses</div><div class="metric-value success">${inter}</div></div><div class="metric-card"><div class="metric-icon" style="background:var(--amber-bg)">🔔</div><div class="metric-label">Relances</div><div class="metric-value ${rel>0?'danger':''}">${rel}</div></div><div class="metric-card"><div class="metric-icon" style="background:var(--red-bg)">⚠️</div><div class="metric-label">En retard</div><div class="metric-value ${late>0?'danger':''}">${late}</div></div><div class="metric-card"><div class="metric-icon" style="background:var(--purple-bg)">🏆</div><div class="metric-label">Signes</div><div class="metric-value gold">${sign}</div></div>`;
    Notif.updateFavicon(rel)
  },
  table(){
    const list=this._list||this.filteredList();
    const c=list.length;document.getElementById('result-count').textContent=c+' prospect'+(c!==1?'s':'');
    const tb=document.getElementById('tbody'),cw=document.getElementById('cards-wrap');
    if(!list.length){
      tb.innerHTML=`<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Aucun prospect trouve</div><div class="empty-sub">Modifiez vos filtres ou ajoutez un prospect</div></div></td></tr>`;
      cw.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Aucun prospect trouve</div><div class="empty-sub">Modifiez vos filtres ou ajoutez un prospect</div></div>`;
      return
    }
    const frag=document.createDocumentFragment();
    let cardsHtml='';
    list.forEach(p=>{
      const late=U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus',tod=U.isToday(p.relance);
      let relH;if(!p.relance)relH='<span style="color:var(--text-muted)">—</span>';else if(late)relH=`<span class="date-urgent">⚠ ${U.esc(U.fmt(p.relance))}</span>`;else if(tod)relH=`<span class="date-today">🔔 Aujourd'hui</span>`;else relH=`<span style="color:var(--text-secondary)">${U.esc(U.fmt(p.relance))}</span>`;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><div class="prospect-cell"><div class="avatar">${U.esc(U.initials(p))}</div><div><div class="prospect-name">${U.esc(p.prenom+' '+p.nom)}</div><div class="prospect-sub">${U.esc(p.email||'')}</div>${p.tags&&p.tags.length?`<div style="margin-top:3px">${tagChips(p)}</div>`:''}</div></div></td><td><div class="prospect-name" style="font-weight:500">${U.esc(p.entreprise||'—')}</div><div class="prospect-sub">${U.esc(p.poste||'')}</div></td><td style="color:var(--text-secondary)">${U.esc(p.tel||'—')}</td><td style="color:var(--text-secondary)">${U.esc(U.fmt(p.rencontre))}</td><td>${relH}</td><td><span class="badge ${BC[p.statut]||''}">${BI[p.statut]||''} ${U.esc(p.statut)}</span></td><td><div class="actions-cell"><button class="btn-ghost" onclick="Crud.showDetail('${U.esc(p.id)}')" title="Voir">👁</button><button class="btn-ghost" onclick="Crud.openModal('${U.esc(p.id)}')" title="Modifier">✏️</button><button class="btn-danger-ghost" onclick="Crud.deleteProspect('${U.esc(p.id)}')" title="Supprimer">🗑</button></div></td>`;
      frag.appendChild(tr);
      cardsHtml+=`<div class="p-card"><div class="p-card-top"><div class="avatar">${U.esc(U.initials(p))}</div><div><div class="prospect-name">${U.esc(p.prenom+' '+p.nom)}</div><div class="prospect-sub">${U.esc(p.entreprise||'')}</div></div><div style="margin-left:auto"><span class="badge ${BC[p.statut]||''}">${BI[p.statut]||''} ${U.esc(p.statut)}</span></div></div>${p.tags&&p.tags.length?`<div style="margin-bottom:6px">${tagChips(p)}</div>`:''}<div class="p-card-row"><span>📞 Telephone</span><span>${U.esc(p.tel||'—')}</span></div><div class="p-card-row"><span>🔔 Relance</span><span>${relH}</span></div><div class="p-card-actions"><button class="btn-ghost" onclick="Crud.showDetail('${U.esc(p.id)}')">👁</button><button class="btn-ghost" onclick="Crud.openModal('${U.esc(p.id)}')">✏️</button><button class="btn-danger-ghost" onclick="Crud.deleteProspect('${U.esc(p.id)}')">🗑</button></div></div>`
    });
    tb.innerHTML='';tb.appendChild(frag);
    cw.innerHTML=cardsHtml
  },
  kanban(){
    const list=this._list||this.filteredList();
    document.getElementById('result-count').textContent=list.length+' prospect'+(list.length!==1?'s':'');
    const cols=['Intéresse','En attente','A relancer','Signe','Refus'];
    const board=document.getElementById('kanban-board');
    board.innerHTML=cols.map(st=>{
      const items=list.filter(p=>p.statut===st);
      return `<div class="kanban-col" data-statut="${U.esc(st)}" ondragover="Kanban.dragOver(event,this)" ondragleave="this.classList.remove('dragover')" ondrop="Kanban.drop(event,this)">
        <div class="kanban-col-head"><span>${BI[st]||''} ${U.esc(st)}</span><span class="kanban-count">${items.length}</span></div>
        <div class="kanban-list">
          ${items.map(p=>`<div class="kanban-card" draggable="true" data-id="${U.esc(p.id)}" ondragstart="Kanban.dragStart(event,'${U.esc(p.id)}')" ondragend="Kanban.dragEnd(event)" onclick="Crud.showDetail('${U.esc(p.id)}')">
            <div class="kanban-card-name">${U.esc(p.prenom+' '+p.nom)}</div>
            <div class="kanban-card-sub">${U.esc(p.entreprise||'')}</div>
            <div class="kanban-card-tags">${tagChips(p)}</div>
          </div>`).join('')||'<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:12px">Vide</div>'}
        </div>
      </div>`
    }).join('')
  },
  skeleton(){
    const tb=document.getElementById('tbody');
    tb.innerHTML=Array.from({length:5}).map(()=>`<tr class="skel-row"><td><div class="skeleton skel-bar"></div></td><td><div class="skeleton skel-bar"></div></td><td><div class="skeleton skel-bar"></div></td><td><div class="skeleton skel-bar"></div></td><td><div class="skeleton skel-bar"></div></td><td><div class="skeleton skel-bar"></div></td><td></td></tr>`).join('')
  }
};

const Kanban={
  _dragId:null,
  dragStart(e,id){this._dragId=id;e.target.classList.add('dragging')},
  dragEnd(e){e.target.classList.remove('dragging')},
  dragOver(e,col){e.preventDefault();col.classList.add('dragover')},
  async drop(e,col){
    e.preventDefault();col.classList.remove('dragover');
    const id=this._dragId;if(!id)return;
    const statut=col.dataset.statut;
    const p=S.prospects.find(x=>x.id===id);if(!p||p.statut===statut)return;
    const old=p.statut;p.statut=statut;p.updated_at=new Date().toISOString();
    p.history=p.history||[];p.history.unshift({ts:p.updated_at,action:`Statut change : ${old} → ${statut}`});
    Render.all();await Db.save(p);U.toast('Statut mis a jour : '+statut)
  }
};

const Crud={
  toggleTag(tag){
    const i=S.editTags.indexOf(tag);
    if(i===-1)S.editTags.push(tag);else S.editTags.splice(i,1);
    this.refreshTagPicker()
  },
  refreshTagPicker(){
    document.querySelectorAll('#f-tags-picker .tag-opt').forEach(btn=>{
      btn.classList.toggle('selected',S.editTags.includes(btn.dataset.tag))
    })
  },
  openModal(id=null){
    S.editId=id;
    document.getElementById('modal-form-title').textContent=id?'Modifier le prospect':'Nouveau prospect';
    document.getElementById('modal-form-sub').textContent=id?'Mettez a jour les informations':'Remplissez les informations du contact';
    const fields=['prenom','nom','entreprise','poste','tel','email','rencontre','relance','statut','notes'];
    document.querySelectorAll('.form-group').forEach(g=>g.classList.remove('has-error'));
    Entreprises.populateSelect();
    if(id){
      const p=S.prospects.find(x=>x.id===id);
      if(!p)return;
      fields.forEach(f=>{
        const el=document.getElementById('f-'+f);
        if(el)el.value=p[f]||''
      });
      const sel=document.getElementById('f-entreprise-select');
      if(sel)sel.value=p.entreprise||'';
      S.editTags=[...(p.tags||[])]
    }else{
      fields.forEach(f=>{
        const el=document.getElementById('f-'+f);
        if(!el)return;
        if(f==='rencontre')el.value=U.today();
        else if(f==='statut')el.value='Interesse';
        else el.value=''
      });
      const sel=document.getElementById('f-entreprise-select');
      if(sel)sel.value='';
      S.editTags=[]
    }
    this.refreshTagPicker();
    document.getElementById('modal-form').classList.add('open');
    setTimeout(()=>document.getElementById('f-prenom').focus(),100)
  },
  validate(){
    let valid=true;document.querySelectorAll('.form-group').forEach(g=>g.classList.remove('has-error'));
    const prenom=U.clean(document.getElementById('f-prenom').value,CFG.MAX_NAME),nom=U.clean(document.getElementById('f-nom').value,CFG.MAX_NAME);
    if(!prenom||prenom.length<2){document.getElementById('grp-prenom').classList.add('has-error');valid=false}
    if(!nom||nom.length<2){document.getElementById('grp-nom').classList.add('has-error');valid=false}
    const email=document.getElementById('f-email').value.trim();if(email&&!U.validEmail(email)){document.getElementById('grp-email').classList.add('has-error');valid=false}
    const tel=document.getElementById('f-tel').value.trim();if(tel&&!U.validPhone(tel)){document.getElementById('grp-tel').classList.add('has-error');valid=false}
    return{valid,prenom,nom}
  },
  async save(){
    const v=this.validate();if(!v.valid){U.toast('Veuillez corriger les erreurs');return}
    const isNew=!S.editId;
    const prevP=S.editId?S.prospects.find(x=>x.id===S.editId):null;
    const prevStatut=prevP?prevP.statut:null;
    const history=prevP?[...(prevP.history||[])]:[];
    const p={id:S.editId||U.genId(),prenom:v.prenom,nom:v.nom,entreprise:U.clean(document.getElementById('f-entreprise').value||document.getElementById('f-entreprise-select').value,CFG.MAX_COMPANY),poste:U.clean(document.getElementById('f-poste').value,CFG.MAX_COMPANY),tel:U.clean(document.getElementById('f-tel').value,CFG.MAX_PHONE),email:U.clean(document.getElementById('f-email').value,CFG.MAX_EMAIL).toLowerCase(),rencontre:document.getElementById('f-rencontre').value,relance:document.getElementById('f-relance').value,statut:document.getElementById('f-statut').value,notes:U.clean(document.getElementById('f-notes').value,CFG.MAX_NOTES),tags:[...S.editTags],history,updated_at:new Date().toISOString()};
    if(isNew){p.history.unshift({ts:p.updated_at,action:'Prospect cree'})}
    else if(prevStatut&&prevStatut!==p.statut){p.history.unshift({ts:p.updated_at,action:`Statut change : ${prevStatut} → ${p.statut}`})}
    else{p.history.unshift({ts:p.updated_at,action:'Fiche mise a jour'})}
    if(S.editId){const i=S.prospects.findIndex(x=>x.id===S.editId);if(i!==-1){p.created_at=S.prospects[i].created_at||p.updated_at;S.prospects[i]=p}}
    else{p.created_at=p.updated_at;S.prospects.unshift(p)}
    UI.closeOverlay('modal-form');Render.all();await Db.save(p);U.toast(S.editId?'Prospect mis a jour':'Prospect ajoute');S.editId=null
  },
  async deleteProspect(id){if(!confirm('Supprimer ce prospect definitivement ?'))return;S.prospects=S.prospects.filter(x=>x.id!==id);Render.all();await Db.del(id);U.toast('Prospect supprime')},
  showDetail(id){
    const p=S.prospects.find(x=>x.id===id);if(!p)return;
    const late=U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus',tod=U.isToday(p.relance);
    let relH;if(!p.relance)relH='—';else if(late)relH=`<span class="date-urgent">⚠ ${U.esc(U.fmt(p.relance))} — En retard</span>`;else if(tod)relH=`<span class="date-today">🔔 Aujourd'hui</span>`;else relH=U.esc(U.fmt(p.relance));
    const hist=(p.history||[]).slice(0,15);
    const histHtml=hist.length?`<div style="margin-top:14px"><div class="section-divider">Historique d'activite</div><div class="history-list">${hist.map(h=>`<div class="history-item"><div class="history-dot"></div><div class="history-date">${U.esc((h.ts||'').slice(0,10).split('-').reverse().join('/'))}</div><div class="history-text">${U.esc(h.action)}</div></div>`).join('')}</div></div>`:'';
    document.getElementById('detail-inner').innerHTML=`<div class="detail-hero"><div class="detail-avatar">${U.esc(U.initials(p))}</div><div class="detail-name">${U.esc(p.prenom+' '+p.nom)}</div><div class="detail-sub">${U.esc(p.poste||'')}${p.entreprise?' — '+U.esc(p.entreprise):''}</div></div><div class="detail-body"><div class="detail-row"><span class="detail-key">📞 Telephone</span><span class="detail-val">${U.esc(p.tel||'—')}</span></div><div class="detail-row"><span class="detail-key">✉ Email</span><span class="detail-val">${U.esc(p.email||'—')}</span></div><div class="detail-row"><span class="detail-key">📅 Rencontre</span><span class="detail-val">${U.esc(U.fmt(p.rencontre))}</span></div><div class="detail-row"><span class="detail-key">🔔 Relance</span><span class="detail-val">${relH}</span></div><div class="detail-row"><span class="detail-key">Statut</span><span class="detail-val"><span class="badge ${BC[p.statut]||''}">${BI[p.statut]||''} ${U.esc(p.statut)}</span></span></div>${p.tags&&p.tags.length?`<div class="detail-row"><span class="detail-key">Tags</span><span class="detail-val">${tagChips(p)}</span></div>`:''}${p.notes?`<div style="margin-top:14px"><div class="section-divider">Notes</div><div class="notes-box">${U.esc(p.notes).replace(/\n/g,'<br>')}</div></div>`:''}${histHtml}<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px"><button class="btn" onclick="UI.closeOverlay('modal-detail')">Fermer</button><button class="btn btn-gold" onclick="UI.closeOverlay('modal-detail');Crud.openModal('${U.esc(p.id)}')">✏️ Modifier</button></div></div>`;
    document.getElementById('modal-detail').classList.add('open')
  }
};

const Filters={
  setRelance(v){document.getElementById('filter-relance').value=v;document.getElementById('filter-statut').value='';document.getElementById('filter-tag').value='';Render.all()},
  setStatut(v){document.getElementById('filter-statut').value=v;document.getElementById('filter-relance').value='';document.getElementById('filter-tag').value='';Render.all()},
  setTag(v){document.getElementById('filter-tag').value=v;document.getElementById('filter-statut').value='';document.getElementById('filter-relance').value='';Render.all()}
};

const Export={
  excel(){
    try{
      const wb=XLSX.utils.book_new();
      const headers=['Prenom','Nom','Entreprise','Poste','Telephone','Email','Date rencontre','Date relance','Statut','Tags','Notes'];
      const rows=S.prospects.map(p=>[p.prenom||'',p.nom||'',p.entreprise||'',p.poste||'',p.tel||'',p.email||'',p.rencontre||'',p.relance||'',p.statut||'',(p.tags||[]).join(', '),p.notes||'']);
      const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
      ws['!cols']=[{wch:14},{wch:16},{wch:22},{wch:18},{wch:16},{wch:26},{wch:14},{wch:14},{wch:13},{wch:20},{wch:35}];
      const range=XLSX.utils.decode_range(ws['!ref']);
      for(let C=range.s.c;C<=range.e.c;C++){const cell=ws[XLSX.utils.encode_cell({r:0,c:C})];if(cell)cell.s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'0B2545'}},alignment:{horizontal:'center'}}}
      ws['!autofilter']={ref:ws['!ref']};
      XLSX.utils.book_append_sheet(wb,ws,'Prospects');
      const total=S.prospects.length,interesse=S.prospects.filter(p=>p.statut==='Interesse').length,attente=S.prospects.filter(p=>p.statut==='En attente').length,relancer=S.prospects.filter(p=>p.statut==='A relancer').length,signes=S.prospects.filter(p=>p.statut==='Signe').length,refus=S.prospects.filter(p=>p.statut==='Refus').length,retard=S.prospects.filter(p=>U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus').length,aujourdhui=S.prospects.filter(p=>U.isToday(p.relance)).length;
      const ws2=XLSX.utils.aoa_to_sheet([['Lead Heritage CGP — Resume prospects'],['Genere le',new Date().toLocaleDateString('fr-FR')],[''],['Indicateur','Valeur'],['Total prospects',total],['Interesses',interesse],['En attente',attente],['A relancer',relancer],['Signes',signes],['Refus',refus],['En retard de relance',retard],['Relances aujourd\'hui',aujourdhui]]);
      ws2['!cols']=[{wch:28},{wch:12}];
      XLSX.utils.book_append_sheet(wb,ws2,'Resume');
      XLSX.writeFile(wb,'prospects_lead_heritage_'+U.today()+'.xlsx');
      U.toast('Export Excel telecharge')
    }catch(e){console.error(e);U.toast('Erreur export Excel')}
  },

  async pdf(){
    U.toast('Generation du PDF en cours...',4000);
    try{
      const root=document.getElementById('pdf-export-root');
      const logoB64=localStorage.getItem('lhcgp_logo');
      const logoHtml=logoB64
        ?`<img class="pdf-logo" src="${logoB64}" alt="Logo">`
        :`<div class="pdf-logo-fallback">◆</div>`;
      const date=new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      const total=S.prospects.length;
      const relAuj=S.prospects.filter(p=>U.isToday(p.relance)).length;
      const retard=S.prospects.filter(p=>U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus').length;
      const signes=S.prospects.filter(p=>p.statut==='Signe').length;

      const rows=S.prospects.slice(0,80).map(p=>{
        const late=U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus';
        const relTxt=p.relance?(late?'⚠ '+U.fmt(p.relance):U.fmt(p.relance)):'—';
        const relStyle=late?'color:#DC2626;font-weight:600':'';
        return `<tr>
          <td style="font-weight:600">${U.esc(p.prenom+' '+p.nom)}</td>
          <td>${U.esc(p.entreprise||'—')}</td>
          <td>${U.esc(p.tel||'—')}</td>
          <td>${U.esc(U.fmt(p.rencontre))}</td>
          <td style="${relStyle}">${U.esc(relTxt)}</td>
          <td>${U.esc(p.statut||'—')}</td>
        </tr>`
      }).join('');

      root.innerHTML=`
        <div class="pdf-header">
          ${logoHtml}
          <div>
            <div class="pdf-title">Lead Heritage CGP — CRM Prospects</div>
            <div class="pdf-sub">Genere le ${date} &nbsp;|&nbsp; ${total} prospect${total!==1?'s':''} &nbsp;|&nbsp; ${signes} signe${signes!==1?'s':''} &nbsp;|&nbsp; ${relAuj} relance${relAuj!==1?'s':''} aujourd'hui &nbsp;|&nbsp; ${retard} en retard</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Prospect</th><th>Entreprise</th><th>Telephone</th><th>Rencontre</th><th>Relance</th><th>Statut</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:16px;font-size:10px;color:#9CA3AF;border-top:1px solid #E4E7EE;padding-top:8px">
          Lead Heritage CGP — Outil interne confidentiel — ${date}
        </div>`;

      root.style.left='0';root.style.top='0';root.style.zIndex='-1';
      await new Promise(r=>setTimeout(r,200));

      const canvas=await html2canvas(root,{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'});
      const imgData=canvas.toDataURL('image/png');
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      const pageW=pdf.internal.pageSize.getWidth();
      const pageH=pdf.internal.pageSize.getHeight();
      const ratio=canvas.width/canvas.height;
      const imgW=pageW-20;
      const imgH=imgW/ratio;
      let y=10;
      pdf.addImage(imgData,'PNG',10,y,imgW,Math.min(imgH,pageH-20));

      // Pages supplementaires si beaucoup de prospects
      if(imgH>pageH-20){
        let remaining=imgH-(pageH-20);
        const srcH=canvas.height;
        const srcW=canvas.width;
        let srcY=Math.round((pageH-20)/imgH*srcH);
        while(remaining>0){
          pdf.addPage();
          const sliceH=Math.min(remaining,pageH-20);
          const srcSlice=Math.round(sliceH/imgH*srcH);
          const sliceCanvas=document.createElement('canvas');
          sliceCanvas.width=srcW;sliceCanvas.height=srcSlice;
          sliceCanvas.getContext('2d').drawImage(canvas,0,srcY,srcW,srcSlice,0,0,srcW,srcSlice);
          pdf.addImage(sliceCanvas.toDataURL('image/png'),'PNG',10,10,imgW,sliceH);
          srcY+=srcSlice;remaining-=sliceH;
        }
      }

      pdf.save('prospects_lead_heritage_'+U.today()+'.pdf');
      root.innerHTML='';root.style.left='-9999px';
      U.toast('PDF telecharge avec succes !')
    }catch(err){
      console.error(err);
      document.getElementById('pdf-export-root').innerHTML='';
      document.getElementById('pdf-export-root').style.left='-9999px';
      U.toast('Erreur PDF — ouverture impression navigateur');
      setTimeout(()=>window.print(),400)
    }
  },

  uploadLogo(){
    const input=document.createElement('input');input.type='file';input.accept='image/*';
    input.onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{localStorage.setItem('lhcgp_logo',ev.target.result);U.toast('Logo enregistre et actif pour le PDF')}
      reader.readAsDataURL(file)
    };
    input.click()
  }
};

/* ── NOTIFICATIONS ── */
const Notif={
  _shown:false,
  check(){
    if(this._shown)return;
    const rel=S.prospects.filter(p=>U.isToday(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus').length;
    const late=S.prospects.filter(p=>U.isLate(p.relance)&&p.statut!=='Signe'&&p.statut!=='Refus').length;
    if(rel>0||late>0){
      this._shown=true;
      const msgs=[];
      if(rel>0)msgs.push(`🔔 ${rel} relance${rel>1?'s':''} aujourd'hui`);
      if(late>0)msgs.push(`⚠ ${late} en retard`);
      this.toast(msgs.join(' — '));
    }
    this.updateFavicon(rel+late)
  },
  toast(msg){
    const t=document.createElement('div');
    t.style.cssText=`position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#0B2545;color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(11,37,69,.3);z-index:9999;border-left:4px solid #C9A84C;cursor:pointer;animation:slideDown .3s ease;white-space:nowrap`;
    t.innerHTML=msg+' &nbsp;<span style="opacity:.6;font-size:11px">Cliquer pour voir</span>';
    t.onclick=()=>{Filters.setRelance('today');t.remove()};
    const style=document.createElement('style');
    style.textContent='@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(style);
    document.body.appendChild(t);
    setTimeout(()=>{if(t.parentNode)t.style.animation='slideDown .3s ease reverse';setTimeout(()=>t.remove(),300)},5500)
  },
  updateFavicon(count){
    try{
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#0B2545';ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(32,16);ctx.lineTo(16,32);ctx.lineTo(0,16);ctx.closePath();ctx.fill();
      ctx.fillStyle='#C9A84C';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('LH',16,16);
      if(count>0){
        ctx.fillStyle='#DC2626';ctx.beginPath();ctx.arc(26,6,8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 9px Arial';ctx.fillText(count>9?'9+':count,26,6)
      }
      let link=document.querySelector("link[rel~='icon']");
      if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link)}
      link.href=canvas.toDataURL()
    }catch(e){}
  }
};

/* ── UI ── */
const UI={
  showApp(){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('topbar-date').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    document.getElementById('user-email-text').textContent=S.user?.email||'Utilisateur';
    document.getElementById('user-email-display').textContent=(S.user?.email||'👤').slice(0,2).toUpperCase();
    // Restaurer theme
    const theme=localStorage.getItem('lhcgp_theme')||'light';
    document.body.dataset.theme=theme;
    document.getElementById('theme-toggle').textContent=theme==='dark'?'☀️':'🌙';
    setTimeout(()=>Notif.check(),800)
  },
  closeOverlay(id){document.getElementById(id).classList.remove('open');if(id==='modal-form')S.editId=null},
  bgClose(e,id){if(e.target===document.getElementById(id))this.closeOverlay(id)},
  toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebar-overlay').classList.toggle('open')},
  closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-overlay').classList.remove('open')},
  toggleUserMenu(){document.getElementById('user-dropdown').classList.toggle('open')},
  toggleTheme(){
    const isDark=document.body.dataset.theme==='dark';
    const next=isDark?'light':'dark';
    document.body.dataset.theme=next;
    document.getElementById('theme-toggle').textContent=next==='dark'?'☀️':'🌙';
    localStorage.setItem('lhcgp_theme',next);
    U.toast(next==='dark'?'Mode sombre active':'Mode clair active')
  },
  setView(v){
    S.view=v;
    document.getElementById('table-view').style.display=v==='table'?'':'none';
    document.getElementById('kanban-view').style.display=v==='kanban'?'':'none';
    document.getElementById('view-btn-table').classList.toggle('active',v==='table');
    document.getElementById('view-btn-kanban').classList.toggle('active',v==='kanban');
    Render.all()
  }
};

/* ── BOOT ── */
window.onload=()=>{
  // Appliquer theme avant login pour eviter le flash
  const theme=localStorage.getItem('lhcgp_theme')||'light';
  document.body.dataset.theme=theme;
  Db.init()
};
