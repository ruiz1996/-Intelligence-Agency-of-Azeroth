import {HEROES,DUNGEONS,SLOT_NAMES,QUALITY,BUFFS,AFFIX_NAMES,MAX_STAGE,MAX_INVENTORY,BATTLE_LIMIT,heroStats,teamPower,idleRates,idlePreview,baseItemStats,upgradeCost,starCost,makeEnemies,simulate} from './core.js';
import {GameClient,cloudReady,authSession,selectedMode,setLocal,signOut,login} from './api.js';
const root=document.querySelector('#app');const modal=document.querySelector('#modal');
let client=null,state=null,view='battle',busy=false,dungeon='idle',stage=1,battle=null,battleTimer=null,speed=2,toastTimer;
let selectedHero='yan',slotFilter='all',qualityFilter='all';
const fmt=n=>Math.floor(n).toLocaleString('zh-CN');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const disabled=condition=>condition?' disabled':'';
function toast(text){const t=document.querySelector('#toast');t.textContent=text;t.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.style.display='none',4500);}
function confirmAction(title,text,label,fn){modal.innerHTML=`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button data-close>取消</button><button class="primary" id="confirm-action">${esc(label)}</button></div>`;modal.showModal();modal.querySelector('[data-close]').onclick=()=>modal.close();modal.querySelector('#confirm-action').onclick=()=>{modal.close();fn();};}
function dialogResult(title,html){modal.innerHTML=`<h2 class="result-title">${esc(title)}</h2>${html}<div class="row"><button class="primary" data-close>继续旅途</button></div>`;modal.showModal();modal.querySelector('[data-close]').onclick=()=>modal.close();}
function welcome(){
  root.innerHTML=`<main class="welcome"><section><div class="eyebrow">GUILD ECHO / PLAYTEST 01</div><h1>回响营地</h1><p class="intro">集结你的伙伴，穿过遗迹与余烬。收集装备，在每一次重生中寻找新的可能。</p><div class="welcome-list"><span>五人编队</span><span>随机装备</span><span>肉鸽成长</span></div><p class="footer-note">内部试玩 · 原创占位角色 · 测试数值</p></section><section class="panel"><form class="auth-form" id="auth-form"><h2>回到营地</h2><p class="tip">云端登录后，可在电脑和手机之间继续旅途。</p><label>邮箱<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>密码<input name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="至少 8 位"></label><p class="error-text" id="auth-error"></p><button class="primary" type="submit"${disabled(!cloudReady)}>登录云存档</button><button type="button" id="signup"${disabled(!cloudReady)}>注册试玩账号</button><button type="button" class="quiet" id="local-start">先在本机试玩</button><p class="tip">${cloudReady?'本机试玩与云存档独立，不会相互覆盖。':'云服务尚未配置。本机试玩可体验全部玩法，进度仅保存在当前浏览器。'}</p></form></section></main>`;
  document.querySelector('#local-start').onclick=()=>{setLocal();boot('local');};
  const form=document.querySelector('#auth-form');
  const submit=async signup=>{if(!form.reportValidity())return;const values=new FormData(form);const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{const ok=await login(values.get('email').trim(),values.get('password'),signup);if(ok)await boot('cloud');else document.querySelector('#auth-error').textContent='已提交注册，请查看邮箱完成确认，再返回登录。';}
    catch(e){document.querySelector('#auth-error').textContent=authMessage(e.message);}finally{buttons.forEach(b=>b.disabled=false);}};
  form.onsubmit=e=>{e.preventDefault();submit(false);};document.querySelector('#signup').onclick=()=>submit(true);
}
function authMessage(message){return ({'Invalid login credentials':'邮箱或密码不正确。','Email not confirmed':'请先完成邮箱确认。','User already registered':'该邮箱已注册，请直接登录。','Signup is disabled':'当前仅限受邀账号，请联系管理员。'})[message]||message;}
async function boot(mode){
  clearInterval(battleTimer);battle=null;client=new GameClient(mode);root.innerHTML='<p class="loading">正在读取存档…</p>';
  try{const data=await client.load();state=data.state;render();if(state.pendingBuff)view='rogue',render();}
  catch(e){root.innerHTML=`<main class="welcome"><section class="panel"><h2>暂时无法读取存档</h2><p class="error-text">${esc(e.message)}</p><div class="row section-gap"><button id="boot-retry">重试读取</button><button id="boot-back">返回登录</button></div></section></main>`;document.querySelector('#boot-retry').onclick=()=>boot(mode);document.querySelector('#boot-back').onclick=async()=>{await signOut();welcome();};}
}
async function mutate(action,onDone){
  if(busy)return;busy=true;render();
  try{const data=await client.action(action);state=data.state;if(onDone)onDone(data.result);else toast('已保存');}
  catch(e){toast(e.message);if(e.status===409){try{state=(await client.load()).state;}catch{}}}
  finally{busy=false;render();}
}
function render(){
  if(!state)return;
  const nav=[['battle','远征'],['heroes','伙伴'],['gear','装备'],['rogue','回响'],['rebirth','重生']];
  root.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><strong>回响营地</strong><span>GUILD ECHO · DEMO</span></div><nav class="nav" aria-label="主导航">${nav.map(([id,label],i)=>`<button data-view="${id}" class="${view===id?'active':''}"${disabled(busy)}><span class="num">0${i+1}</span>${label}${id==='rogue'&&state.pendingBuff?' · 待选择':''}</button>`).join('')}</nav><div class="sidebar-foot">第 ${state.cycle} 轮旅途<br>永久基础属性 +${state.rebirths*5}%<br><br>内部试玩 / v0.1<br>角色美术与数值均为占位</div></aside><main class="main"><header class="topbar"><div class="resources"><div class="resource"><span>金币</span><strong>${fmt(state.gold)}</strong></div><div class="resource"><span>招募点</span><strong>${fmt(state.recruit)}</strong></div><div class="resource"><span>队伍战力</span><strong>${fmt(teamPower(state))}</strong></div></div><div class="sync">${busy?'正在保存…':client.pending?'同步待重试':client.mode==='cloud'?'● 云存档已连接':'● 本机试玩'}<br><button class="quiet small" data-action="refresh"${disabled(busy||Boolean(battle))}>刷新存档</button><button class="quiet small" data-action="logout"${disabled(busy||Boolean(battle))}>退出</button></div></header>${client.pending?'<div class="notice">上一次操作尚未确认，请重试同步，避免丢失已提交的奖励。 <button class="small" data-action="retry">重试同步</button></div>':''}${state.pendingBuff&&view!=='rogue'?'<div class="notice">有一份回响强化等待选择。 <button class="small" data-view="rogue">前往选择</button></div>':''}${view==='battle'?battlePage():view==='heroes'?heroesPage():view==='gear'?gearPage():view==='rogue'?roguePage():rebirthPage()}</main></div>`;
  bind();if(battle)drawFrame();
}
function unitHero(h,slot){
  if(!h)return `<div class="hero-slot">${slot<3?'前排':'后排'} · 空位</div>`;
  return `<div class="hero-slot"><div class="hero-unit" style="--hero-color:${h.color}" data-unit="${h.id}" data-max="${h.hp}"><span class="role">${h.role}</span><span class="portrait">${h.mark}</span><strong>${h.name}</strong><div class="hpbar"><i style="width:100%"></i></div><span class="hpnum">${h.hp} / ${h.hp}</span></div></div>`;
}
function board(){
  const c=battle?.challenge||{heroes:state.formation.map((id,slot)=>id?{...HEROES.find(h=>h.id===id),...heroStats(state,id),slot}:null).filter(Boolean),stage,dungeon};
  const enemies=makeEnemies(c.stage,c.dungeon);
  const quick=`<div class="quick-select"><select id="quick-dungeon" aria-label="快捷选择副本"${disabled(Boolean(battle)||busy)}>${Object.entries(DUNGEONS).map(([id,d])=>`<option value="${id}"${dungeon===id?' selected':''}>${d.name}</option>`).join('')}</select><select id="quick-stage" aria-label="快捷选择层数"${disabled(Boolean(battle)||busy)}>${Array.from({length:Math.min(MAX_STAGE,state.progress[dungeon]+1)},(_,i)=>`<option value="${i+1}"${stage===i+1?' selected':''}>第 ${i+1} 层</option>`).join('')}</select></div>`;
  return `${quick}<div class="field"><div class="battle-top"><span>${battle?'交战中':'敌方预览'} · ${DUNGEONS[c.dungeon].name} ${c.stage} 层</span><span id="battle-clock">00:00 / 01:30</span></div><div class="enemy-grid">${enemies.map(e=>`<div class="enemy ${e.kind}" data-unit="${e.id}" data-max="${e.hp}" style="grid-column:${e.x+1}/span ${e.w};grid-row:${5-e.row-e.h}/span ${e.h}"><span class="unit-label">${e.kind==='boss'?'BOSS':e.kind==='elite'?'精英':'普通'}</span><strong>${e.kind==='boss'?'领主':e.kind==='elite'?'督卫':'灰兽'}</strong><div class="hpbar"><i style="width:100%"></i></div><span class="hpnum">${e.hp}</span></div>`).join('')}</div><div class="divide">我方前线</div><div class="hero-grid">${Array.from({length:6},(_,slot)=>unitHero(c.heroes.find(h=>h.slot===slot),slot)).join('')}</div></div>`;
}
function battlePage(){
  const rates=idleRates(state),income=idlePreview(state,client.now());
  return `<div class="page-head"><div><div class="eyebrow">EXPEDITION</div><h1>向余烬深处</h1><p>调整阵容与装备，挑战下一片遗迹。</p></div><span class="tag">第 ${state.cycle} 轮</span></div><div class="content-grid"><section class="panel"><div class="panel-title"><h3>战场</h3><button class="quiet small" data-view="heroes"${disabled(Boolean(battle))}>调整阵容 →</button></div>${board()}<div class="battle-actions"><span class="tip">${battle?'战斗按开场阵容快照进行':'普通攻击优先最近的存活前排'}</span><div class="row"><button class="small" data-action="speed">${speed}× 播放</button>${battle?`<button class="small danger" data-action="abandon"${disabled(busy)}>撤退</button>`:`<button class="primary" data-action="start"${disabled(busy||Boolean(state.pendingBuff))}>开始挑战</button>`}</div></div><div class="combat-log" id="combat-log">${battle?'':'准备就绪。选择右侧副本与层数后开始挑战。'}</div></section><aside class="stack">${Object.entries(DUNGEONS).map(([id,d])=>`<section class="dungeon ${dungeon===id?'selected':''}"><div class="dungeon-title"><span class="roman">${d.symbol}</span><div><h3>${d.name}</h3><span class="tip">${d.label} · 已通关 ${state.progress[id]} / ${MAX_STAGE}</span></div></div><p>${d.description}</p><footer><select aria-label="${d.name}挑战层数" data-stage="${id}"${disabled(Boolean(battle)||busy)}>${Array.from({length:Math.min(MAX_STAGE,state.progress[id]+1)},(_,i)=>`<option value="${i+1}"${(dungeon===id?stage:Math.min(MAX_STAGE,state.progress[id]+1))===i+1?' selected':''}>第 ${i+1} 层${i+1>state.progress[id]?' · 推进':''}</option>`).join('')}</select><button class="small ${dungeon===id?'primary':''}" data-dungeon="${id}"${disabled(Boolean(battle)||busy)}>${dungeon===id?'已选择':'选择副本'}</button></footer></section>`).join('')}<section class="panel income"><div class="panel-title"><h3>营地挂机</h3><span class="tip">最多累积 8 小时</span></div><strong id="idle-gold">${fmt(income.gold)}</strong><span class="tip"> 金币待领取</span><p class="tip"><span id="idle-recruit">${income.recruit}</span> 招募点 · 每分钟 ${rates.gold} 金币 / ${rates.recruit} 招募点</p><div class="row"><button class="small" data-action="claim"${disabled(busy)}>领取收益</button><span class="tip">离线也会积累</span></div></section></aside></div>`;
}
function heroesPage(){
  const bond=state.formation.includes('yan')&&state.formation.includes('ling');
  return `<div class="page-head"><div><div class="eyebrow">COMPANIONS</div><h1>同行的伙伴</h1><p>六个站位，最多五人。前排承伤，后排寻找机会。</p></div><span class="tag">已收集 ${Object.values(state.heroes).filter(h=>h.owned).length} / 5</span></div><section class="panel"><div class="panel-title"><h3>出战阵容</h3><span class="tag">${bond?'羁绊已激活 · 全队生命 +8%':'羁绊：岩灯＋铃弦 → 全队生命 +8%'}</span></div><div class="formation-editor">${state.formation.map((id,slot)=>`<label>${slot<3?'前排':'后排'} · ${slot%3+1}<select data-formation="${slot}"${disabled(busy||Boolean(battle))}><option value="">空位</option>${HEROES.filter(h=>state.heroes[h.id].owned).map(h=>`<option value="${h.id}"${h.id===id?' selected':''}>${h.name} · ${h.role}</option>`).join('')}</select></label>`).join('')}</div><div class="row between"><p class="tip">先调整各位置，再保存阵容。两名前排可能承受更集中的攻击。</p><button class="primary" data-action="formation"${disabled(busy||Boolean(battle))}>保存阵容</button></div></section><section class="panel section-gap"><div class="row between"><div><h3>营地招募</h3><p class="tip">每次 100 招募点 · 重复角色转为 10 枚对应碎片</p></div><div class="row"><button data-action="recruit" data-count="1"${disabled(busy||state.recruit<100)}>招募一次</button><button class="primary" data-action="recruit" data-count="10"${disabled(busy||state.recruit<1000)}>招募十次</button></div></div></section><div class="cards section-gap">${HEROES.map(h=>{
    const entry=state.heroes[h.id],stats=heroStats(state,h.id),cost=starCost(entry);
    return `<article class="panel hero-card ${entry.owned?'':'locked'}" style="--hero-color:${h.color}"><div class="row between"><span class="portrait">${h.mark}</span><span class="tag">${h.role}</span></div><div class="row between"><h3>${h.name}</h3><span class="stars">${entry.owned?'★'.repeat(entry.star):'未获得'}</span></div><div class="stats"><div><small>生命</small><strong>${stats.hp}</strong></div><div><small>攻击</small><strong>${stats.atk}</strong></div><div><small>防御</small><strong>${stats.def}</strong></div></div><p class="skill"><strong>${h.skill}</strong> · ${h.cd}s 冷却<br>${h.detail}</p><p class="tip">碎片 ${entry.shards}${entry.star<3?' / '+cost:' · 已达 Demo 星级上限'}</p><div class="progress"><i style="width:${Math.min(100,entry.shards/cost*100)}%"></i></div><button class="full" data-action="star" data-hero="${h.id}"${disabled(busy||!entry.owned||entry.star>=3||entry.shards<cost)}>${entry.star>=3?'已达 3 星':'升至 '+(entry.star+1)+' 星'}</button></article>`;
  }).join('')}</div>`;
}
function ownerOf(item){const id=Object.keys(state.equipment).find(h=>state.equipment[h].includes(item.id));return id?HEROES.find(h=>h.id===id):null;}
function itemCard(item){
  const basic=baseItemStats(item),owner=ownerOf(item);
  return `<article class="item" style="--quality:var(--q${item.quality})"><div class="row between"><span class="tip">${SLOT_NAMES[item.slot]}${item.twoHand?' · 双手':''}</span><span class="tag">Lv.${item.level}</span></div><h3>${item.name}</h3><p class="tip">${QUALITY[item.quality]} · 词条档位 ${item.tier}</p><p class="tip">${Object.entries(basic).map(([k,v])=>`${AFFIX_NAMES[k]} +${v}`).join(' / ')}</p><div class="affixes">${item.affixes.length?item.affixes.map(a=>`${AFFIX_NAMES[a.stat]} +${(a.value*100).toFixed(1)}%`).join('<br>'):'无随机词条'}</div><p class="tip">${owner?'穿戴：'+owner.name:'背包中'} · 下级 ${upgradeCost(item)} 金币</p><div class="row"><button data-action="equip" data-item="${item.id}"${disabled(busy||owner?.id===selectedHero)}>给 ${HEROES.find(h=>h.id===selectedHero).name}</button><button data-action="upgrade" data-item="${item.id}" data-count="1"${disabled(busy||item.level>=30||state.gold<upgradeCost(item))}>升 1 级</button><button data-action="upgrade" data-item="${item.id}" data-count="5"${disabled(busy||item.level>=30||state.gold<upgradeCost(item))}>升 5 级</button><button class="danger" data-action="salvage" data-item="${item.id}"${disabled(busy||Boolean(owner))}>分解</button></div></article>`;
}
function gearPage(){
  const items=state.items.filter(i=>(slotFilter==='all'||i.slot===Number(slotFilter))&&(qualityFilter==='all'||i.quality===Number(qualityFilter))).sort((a,b)=>b.quality-a.quality||b.level-a.level);
  return `<div class="page-head"><div><div class="eyebrow">ARMORY</div><h1>遗落的装备</h1><p>品质决定词条数量，难度决定掉落潜力，等级提升基础战力。</p></div><span class="tag">${state.items.length} / ${MAX_INVENTORY}</span></div><div class="gear-layout"><aside class="panel"><h3>角色装备</h3><select class="full section-gap" id="gear-hero" aria-label="装备目标角色">${HEROES.filter(h=>state.heroes[h.id].owned).map(h=>`<option value="${h.id}"${selectedHero===h.id?' selected':''}>${h.name} · ${h.role}</option>`).join('')}</select><div class="gear-slots">${state.equipment[selectedHero].map((id,slot)=>{
    const item=state.items.find(i=>i.id===id);const main=state.items.find(i=>i.id===state.equipment[selectedHero][0]);
    return `<div class="gear-slot"><span>${SLOT_NAMES[slot]}</span><span style="color:${item?'var(--q'+item.quality+')':'var(--muted)'}">${item?item.name+' Lv.'+item.level:slot===1&&main?.twoHand?'双手武器占用':'空'}</span>${item?`<button class="quiet small" data-action="unequip" data-slot="${slot}" aria-label="卸下${SLOT_NAMES[slot]}"${disabled(busy)}>卸</button>`:''}</div>`;
  }).join('')}</div><p class="tip section-gap">双手武器不能同时装备副手。卸下的装备留在背包中。</p></aside><section><div class="filters"><select id="slot-filter" aria-label="筛选装备部位"><option value="all">所有部位</option>${SLOT_NAMES.map((name,i)=>`<option value="${i}"${slotFilter===String(i)?' selected':''}>${name}</option>`).join('')}</select><select id="quality-filter" aria-label="筛选装备品质"><option value="all">所有品质</option>${QUALITY.map((name,i)=>`<option value="${i}"${qualityFilter===String(i)?' selected':''}>${name}</option>`).join('')}</select></div><div class="inventory">${items.length?items.map(itemCard).join(''):'<p class="tip">没有符合条件的装备。挑战遗落锻炉可获得新装备。</p>'}</div><p class="footer-note">分解返还该装备本轮全部升级金币，并获得少量基础金币。套装与特殊装备效果后续开放。</p></section></div>`;
}
function roguePage(){
  const counts=Object.fromEntries(BUFFS.map(b=>[b.id,state.buffs.filter(id=>id===b.id).length]));
  return `<div class="page-head"><div><div class="eyebrow">ECHOES</div><h1>旅途中的回响</h1><p>每个节点每轮只奖励一次。不同节点的强化可以叠加。</p></div><span class="tag">本轮 ${state.buffs.length} 份强化</span></div>${state.pendingBuff?`<section class="panel"><div class="panel-title"><h3>第 ${state.pendingBuff.stage} 层 · 选择一份强化</h3><span class="tag">三选一</span></div><div class="buff-grid">${state.pendingBuff.options.map(id=>{const b=BUFFS.find(b=>b.id===id);return `<button class="buff-card" data-action="buff" data-buff="${id}"${disabled(busy)}><span class="eyebrow">ECHO</span><h3>${b.name}</h3><p>${b.text}</p></button>`;}).join('')}</div></section>`:'<section class="panel"><h3>下一份回响，藏在遗迹深处</h3><p class="tip section-gap">推进回响秘境的新节点，可获得一份本轮有效的强化。重复通关不会再次发放。</p><button class="primary section-gap" data-action="goto-rogue">前往回响秘境</button></section>'}<section class="panel section-gap"><h3>当前生效</h3><div class="buff-list">${state.buffs.length?BUFFS.filter(b=>counts[b.id]).map(b=>`<span class="tag">${b.name} ×${counts[b.id]} · ${b.text}</span>`).join(''):'<p class="tip">尚未获得强化。</p>'}</div><p class="tip section-gap">作用于本轮所有副本中的全队角色，重生时清空。暴击率上限 75%，暴击伤害上限 300%，攻速缩减上限 50%。</p></section>`;
}
function rebirthPage(){
  return `<div class="page-head"><div><div class="eyebrow">ANOTHER JOURNEY</div><h1>重燃旅途</h1><p>保留收集的成果，以新的回响重新出发。</p></div><span class="tag">测试规则</span></div><div class="content-grid"><section class="panel"><h3>已完成重生</h3><div class="summary-number">${state.rebirths}<span style="font-size:18px"> 次</span></div><p>全队基础攻击、生命、防御永久 +${state.rebirths*5}%</p><div class="progress"><i style="width:${Math.min(100,state.progress.idle/6*100)}%"></i></div><p class="tip">余火远征第 6 层解锁重生 · 当前 ${state.progress.idle} 层</p><div class="section-gap"><h3>重生后保留</h3><p class="tip">角色、星级、碎片、招募点、装备品质与词条、历史首通记录、阵容和装备穿戴。</p></div><div class="section-gap"><h3>重新开始</h3><p class="tip">装备回到 1 级，三类副本进度和肉鸽强化清空；金币设为 1,600。每次重生增加 5% 永久基础属性。</p></div><button class="primary section-gap" data-action="rebirth"${disabled(busy||Boolean(battle)||Boolean(state.pendingBuff)||state.progress.idle<6)}>开启第 ${state.cycle+1} 轮旅途</button></section><section class="panel"><h3>营地手记</h3><ul class="history section-gap">${state.history.length?state.history.map(h=>`<li><time>${new Date(h.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time>${esc(h.text)}</li>`).join(''):'<li>旅途才刚刚开始。</li>'}</ul></section></div>`;
}
function bind(){
  root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
  root.querySelectorAll('[data-dungeon]').forEach(b=>b.onclick=()=>{dungeon=b.dataset.dungeon;stage=Number(root.querySelector(`[data-stage="${dungeon}"]`).value);render();});
  root.querySelectorAll('[data-stage]').forEach(el=>el.onchange=()=>{dungeon=el.dataset.stage;stage=Number(el.value);render();});
  root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>handle(b.dataset.action,b));
  const heroSelect=root.querySelector('#gear-hero');if(heroSelect)heroSelect.onchange=()=>{selectedHero=heroSelect.value;render();};
  const sf=root.querySelector('#slot-filter');if(sf)sf.onchange=()=>{slotFilter=sf.value;render();};
  const qf=root.querySelector('#quality-filter');if(qf)qf.onchange=()=>{qualityFilter=qf.value;render();};
  const qd=root.querySelector('#quick-dungeon');if(qd)qd.onchange=()=>{dungeon=qd.value;stage=Math.min(MAX_STAGE,state.progress[dungeon]+1);render();};
  const qs=root.querySelector('#quick-stage');if(qs)qs.onchange=()=>{stage=Number(qs.value);render();};
}
async function handle(type,button){
  if(type==='formation'){const slots=[...root.querySelectorAll('[data-formation]')].map(s=>s.value||null);return mutate({type,slots});}
  if(type==='recruit')return mutate({type,count:Number(button.dataset.count)},r=>dialogResult('新伙伴的消息',`<div class="draws">${r.draws.map(d=>`<span>${HEROES.find(h=>h.id===d.id).name}<br><small>${d.isNew?'新角色 · 1 星':'碎片 +10'}</small></span>`).join('')}</div>`));
  if(type==='star')return mutate({type,hero:button.dataset.hero},()=>toast('角色升星成功'));
  if(type==='equip')return mutate({type,hero:selectedHero,item:button.dataset.item});
  if(type==='unequip')return mutate({type,hero:selectedHero,slot:Number(button.dataset.slot)});
  if(type==='upgrade')return mutate({type,item:button.dataset.item,count:Number(button.dataset.count)},r=>toast(`提升 ${r.levels} 级，消耗 ${r.spent} 金币`));
  if(type==='salvage'){const item=state.items.find(i=>i.id===button.dataset.item);return confirmAction('分解 '+item.name,`将返还 ${item.invested} 升级金币，另获得 ${15*(item.quality+1)} 金币。装备会被消耗。`,'确认分解',()=>mutate({type,item:item.id},r=>toast(`分解获得 ${r.gold} 金币`)));}
  if(type==='buff')return mutate({type,buff:button.dataset.buff},()=>toast('回响已生效'));
  if(type==='goto-rogue'){dungeon='rogue';stage=Math.min(MAX_STAGE,state.progress.rogue+1);view='battle';render();return;}
  if(type==='rebirth')return confirmAction('开启新的旅途','装备回到 1 级，副本进度和肉鸽强化清空。角色和装备收藏保留，获得 5% 永久基础属性。','确认重生',()=>mutate({type},()=>{dungeon='idle';stage=1;view='battle';toast('新的旅途开始了');}));
  if(type==='speed'){speed=speed===1?2:speed===2?4:1;render();return;}
  if(type==='start')return mutate({type:'start',dungeon,stage},result=>startPlayback(result.challenge));
  if(type==='claim')return mutate({type:'claim'},r=>toast(`领取 ${r.gold} 金币、${r.recruit} 招募点`));
  if(type==='abandon')return confirmAction('撤退回营地','本场按失败结算，不获得通关奖励。','撤退',()=>{clearInterval(battleTimer);const id=battle.challenge.id;battle=null;mutate({type:'settle',challenge:id,outcome:'loss'});});
  if(type==='logout')return confirmAction('退出营地','已保存的进度会保留。','退出',async()=>{await signOut();state=null;welcome();});
  if(type==='retry'||type==='refresh'){
    if(busy)return;busy=true;render();try{const d=await(type==='retry'?client.retry():client.load());state=d.state;toast('存档已同步');}catch(e){toast(e.message);}finally{busy=false;render();}return;
  }
}
function startPlayback(challenge){
  clearInterval(battleTimer);battle={challenge,simulation:simulate(challenge),elapsed:0,index:0};view='battle';dungeon=challenge.dungeon;stage=challenge.stage;
  battleTimer=setInterval(()=>{
    if(!battle)return;battle.elapsed=Math.min(battle.simulation.elapsed,battle.elapsed+.1*speed);const events=battle.simulation.events;
    while(battle.index+1<events.length&&events[battle.index+1].time<=battle.elapsed)battle.index++;
    drawFrame();if(battle.elapsed>=battle.simulation.elapsed&&!busy&&!client.pending){clearInterval(battleTimer);const finished=battle;battle=null;mutate({type:'settle',challenge:finished.challenge.id,outcome:finished.simulation.outcome},showSettlement);}
  },100);
}
function drawFrame(){
  if(!battle)return;const frame=battle.simulation.events[battle.index];
  for(const u of frame.units){const el=root.querySelector(`[data-unit="${u.id}"]`);if(!el)continue;const max=Number(el.dataset.max);el.classList.toggle('dead',u.hp<=0);el.classList.toggle('attacking',frame.actor===u.id);el.querySelector('.hpbar i').style.width=`${Math.max(0,u.hp)/max*100}%`;el.querySelector('.hpnum').textContent=`${u.hp} / ${max}${u.shield?' +盾'+u.shield:''}`;}
  const clock=root.querySelector('#battle-clock');if(clock)clock.textContent=`${Math.floor(battle.elapsed)}s / ${BATTLE_LIMIT}s`;
  const log=root.querySelector('#combat-log');if(log){log.innerHTML=battle.simulation.events.slice(Math.max(0,battle.index-3),battle.index+1).map((f,i,arr)=>`<div class="${i===arr.length-1?'recent':''}">${f.time.toFixed(1)}s · ${esc(f.text)}</div>`).join('');log.scrollTop=log.scrollHeight;}
}
function showSettlement(r){
  if(r.outcome==='loss'){dialogResult('暂时受挫','<p>尝试升级装备、调整前排，或从回响秘境获得强化后再来。</p>');return;}
  dialogResult('挑战成功',`<p>${DUNGEONS[r.dungeon].name} · 第 ${r.stage} 层</p><div class="row"><span class="tag">金币 +${r.gold}</span><span class="tag">招募点 +${r.recruit}</span>${r.first?'<span class="tag">历史首次通关</span>':''}</div>${r.item?`<p style="color:var(--q${r.item.quality})">获得 ${r.item.name} · ${QUALITY[r.item.quality]}</p>`:''}${r.buff?'<p>一份新的回响正在等待选择。</p>':''}`);
  if(r.buff)view='rogue';else stage=Math.min(MAX_STAGE,state.progress[dungeon]+1);
}
setInterval(()=>{if(!state||!client)return;const income=idlePreview(state,client.now());const gold=document.querySelector('#idle-gold'),points=document.querySelector('#idle-recruit');if(gold)gold.textContent=fmt(income.gold);if(points)points.textContent=income.recruit;},1000);
if(selectedMode())boot(selectedMode());else welcome();
// Optional browser agent integration: uses the same visible navigation, no hidden mutations.
if(document.modelContext?.registerTool){
  const context=document.modelContext;
  Promise.resolve(context.registerTool({name:'read_camp_state',description:'Read current camp resources and progression without changing the save.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>state?{cycle:state.cycle,gold:state.gold,recruit:state.recruit,progress:state.progress,view}:{signedIn:false}})).catch(()=>{});
  Promise.resolve(context.registerTool({name:'navigate_camp',description:'Open an existing camp panel. Does not start battle or spend resources.',inputSchema:{type:'object',properties:{view:{type:'string',enum:['battle','heroes','gear','rogue','rebirth']}},required:['view'],additionalProperties:false},execute:input=>{if(!state||!['battle','heroes','gear','rogue','rebirth'].includes(input.view))throw new Error('Invalid panel or not signed in');view=input.view;render();return {view};}})).catch(()=>{});
}
