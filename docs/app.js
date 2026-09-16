import {
  DATA,HEROES,HERO_BY_ID,TEMPLATES,TEMPLATE_BY_ID,CATALOG,TASKS,BUFF_BY_ID,TALENTS,
  SLOT_NAMES,QUALITY,AFFIX_NAMES,RULE_VERSION,SCHEMA,SCALE,formatMoney,formatInteger,
  heroStats,heroDefinition,upgradeCost,salvageValue,canEquip,templateSlots,idleRates,idlePreview,
  rebirthPreview,allocationPreview,pointCost,act,equipmentType,templateAvailable,idleGearPreview,WEAPON_REVISION,
} from './core.js';
import {battleReport} from './battle-report.js';
import {archiveClues,idleGearCard,idleGearTime,reportContent,revealStyle,revealSound,soundEnabled,toggleSound,unlockSound} from './feature-v5.js';
import {GameClient,cloudReady,selectedMode,setLocal,signOut,login} from './api.js';
import {esc,num,percent,art,series,itemName,itemStatsText,slotIcons,skillText,passiveText,mechanicText,roleText,skillCopy} from './presentation.js';
import {buffDisplay} from './buff-display.js';
import {enemyAppearance,battleScene,preloadEnemies} from './enemy-art.js';
import {BattleEffects,motionPreference,reducedMotion} from './battle-effects.js';

const root=document.querySelector('#app'),modal=document.querySelector('#modal'),toastNode=document.querySelector('#toast');
const titles={home:'情报局总部',tasks:'任务中心',heroes:'特工',formation:'出战阵容',gear:'装备',recruit:'招募',rogue:'收容强化',rebirth:'时间回溯',battle:'行动中'};
const nav=[['home','总部','⌂'],['tasks','任务','◇'],['heroes','特工','▣'],['gear','装备','⚒'],['recruit','招募','＋']];
const defaults={view:'home',kind:'idle',taskId:'R001',selectedHero:'yan',gearTab:'wear',gearFilterSlot:null,selectedSlot:0,quality:'all',query:'',page:0,recruitTab:'draw',rebirthTab:'plan',selectedBuff:null};
let ui={...defaults},sheet=null,state,client,busy=false,battle=null,worker=null,battleTimer,toastTimer,afterBack=null;
let formationDraft=null,allocation=null,focus='main_hand',restoreFocus=null;
let battleEffects=null;
let preferredBattleSpeed=2;
try {
  const savedSpeed=Number(localStorage.getItem('ax-battle-speed'));
  if([1,2,4].includes(savedSpeed))preferredBattleSpeed=savedSpeed;
} catch {}
const marked=new Set(),scrollPositions=new Map();
try { ui={...defaults,...JSON.parse(sessionStorage.getItem('ax-ui-v2')||'{}')}; } catch {}
const initialRoute=location.hash.slice(1);if(titles[initialRoute])ui.view=initialRoute;
if(['battle','formation'].includes(ui.view))ui.view='tasks';

const button=(label,action,attrs='',disabled=false,cls='')=>`<button class="${cls}" data-action="${action}" ${attrs}${disabled||busy?' disabled':''}>${label}</button>`;
const money=value=>formatMoney(value);
const own=id=>state.heroes[id]?.owned;
const ownedHeroes=()=>HEROES.filter(h=>own(h.id));
const equipped=id=>Object.entries(state.equipment).find(([,slots])=>slots.includes(id))?.[0];
const item=id=>state.items.find(i=>i.id===id);
const currentTask=()=>TASKS[ui.taskId]||TASKS.R001;
const unlocked=t=>t.unlock==='initial'||state.runClears.includes(t.unlock);
const stars=id=>'★'.repeat(state.heroes[id].star);
const draftDirty=()=>formationDraft&&JSON.stringify(formationDraft)!==JSON.stringify(state.formation);
const sheetKey=()=>sheet?JSON.stringify(sheet):null;
const screenKey=()=>`${ui.view}:${ui.gearTab}:${ui.gearFilterSlot}:${ui.recruitTab}:${ui.rebirthTab}`;

function saveUI(){sessionStorage.setItem('ax-ui-v2',JSON.stringify(ui));}
function routeState(){return {ax:true,ui:{...ui},sheet:sheet?structuredClone(sheet):null};}
function rememberScroll(){const page=document.querySelector('.page-body');if(page)scrollPositions.set(screenKey(),page.scrollTop);const body=modal.querySelector('.sheet-body');if(body&&sheet)scrollPositions.set(sheetKey(),body.scrollTop);}
function stamp(){saveUI();history.replaceState(routeState(),'','#'+ui.view);}
function toast(text){
  toastNode.textContent=text;toastNode.classList.add('visible');clearTimeout(toastTimer);
  let feedback;
  if(modal.open&&!modal.querySelector('.sheet-error:not([hidden])')){feedback=modal.querySelector('.sheet-feedback')||document.createElement('p');feedback.className='sheet-feedback';feedback.setAttribute('role','status');feedback.textContent=text;modal.querySelector('.sheet-footer')?.prepend(feedback);}
  toastTimer=setTimeout(()=>{toastNode.classList.remove('visible');feedback?.remove();},4500);
}
function transition(next,patch={},replace=false){
  rememberScroll();ui={...ui,...patch,view:titles[next]?next:'home'};sheet=null;
  if(ui.view==='formation'&&!formationDraft)formationDraft=[...state.formation];
  saveUI();history[replace?'replaceState':'pushState'](routeState(),'','#'+ui.view);render();
}
function navigate(next,patch={}){
  if(battle&&next!=='battle'){openSheet('retreat',{next,patch});return;}
  if(ui.view==='formation'&&next!=='formation'&&draftDirty()){openSheet('discardFormation',{next,patch});return;}
  transition(next,patch);
}
function openSheet(type,data={},replace=false){
  rememberScroll();restoreFocus=document.activeElement;sheet={type,data};
  history[replace?'replaceState':'pushState'](routeState(),'','#'+ui.view);renderSheet();
}
function closeSheet(after){
  if(!sheet){after?.();return;}
  if(busy){toast('正在保存，请稍候');return;}
  if(sheet.type==='reveal'){advanceReveal(true);return;}
  if(['result','recruits'].includes(sheet.type))client.acknowledgePresentation();
  afterBack=after||null;history.back();
}
function updateUI(patch){rememberScroll();Object.assign(ui,patch);stamp();render();}
window.addEventListener('popstate',event=>{
  const target=event.state?.ax?event.state:{ui:{...defaults},sheet:null};
  if(busy){history.pushState(routeState(),'','#'+ui.view);toast('正在保存，请稍候');return;}
  if(sheet?.type==='reveal'){advanceReveal(true);return;}
  if(['result','recruits'].includes(sheet?.type)&&target.sheet?.data?.receiptId!==sheet.data.receiptId)client.acknowledgePresentation();
  if(target.sheet?.data?.receiptId&&target.sheet.data.receiptId!==client.presentation?.opId)target.sheet=null;
  if(!target.sheet&&target.ui.view!==ui.view&&(battle||ui.view==='formation'&&draftDirty())){
    history.pushState(routeState(),'','#'+ui.view);
    openSheet(battle?'retreat':'discardFormation',{next:target.ui.view,patch:target.ui});return;
  }
  rememberScroll();ui={...defaults,...target.ui};sheet=target.sheet;
  if(ui.view==='battle'&&!battle){ui.view='tasks';sheet=null;stamp();}
  if(battle&&ui.view==='battle')renderSheet();else render();saveUI();const callback=afterBack;afterBack=null;callback?.();
  if(!sheet&&restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});
});
window.addEventListener('beforeunload',event=>{if(battle||draftDirty()||busy){event.preventDefault();event.returnValue='';}});
modal.addEventListener('cancel',event=>{event.preventDefault();closeSheet();});
function download(value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`ax-archive-cycle-${state.cycle||0}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function welcome(){
  if(modal.open)modal.close();sheet=null;
  root.innerHTML=`<main class="welcome"><div class="welcome-brand"><span class="brand-mark">AX</span><h1>艾星情报局</h1><p>集结伙伴，继续行动。</p><div class="welcome-art">${['wudi','echoz','asuna'].map(id=>`<img src="${art(id)}" alt="${HERO_BY_ID[id].name}">`).join('')}</div></div><section class="panel login-panel"><h2>返回工作台</h2><form id="login"><label>邮箱<input name="email" type="email" autocomplete="username" required></label><label>密码<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><div class="actions"><button class="primary" type="submit"${cloudReady?'':' disabled'}>登录</button><button type="button" id="signup"${cloudReady?'':' disabled'}>注册</button></div></form><button class="wide" id="local">本机试玩</button><p class="muted">本机存档仅限此浏览器；登录可跨设备继续。</p></section></main>`;
  const auth=async signup=>{const form=document.querySelector('#login');if(!form.reportValidity())return;const data=new FormData(form);root.querySelectorAll('button').forEach(b=>b.disabled=true);try{if(await login(data.get('email'),data.get('password'),signup))await connect('cloud');else toast('请查收确认邮件，完成确认后登录');}catch(e){toast(e.message);}finally{if(!state)welcome();}};
  document.querySelector('#login').onsubmit=e=>{e.preventDefault();auth(false);};document.querySelector('#signup').onclick=()=>auth(true);
  document.querySelector('#local').onclick=()=>{setLocal();connect('local');};
}
async function connect(mode){
  if(modal.open)modal.close();
  client=new GameClient(mode);root.innerHTML='<p class="loading">正在读取档案…</p>';
  const pendingAction=client.pending?.action;
  try{const envelope=await client.load();state=envelope.state;focus=state.focus||'main_hand';
    if(state.schema===SCHEMA){if(!own(ui.selectedHero))ui.selectedHero=ownedHeroes()[0]?.id||'yan';if(!sessionStorage.getItem('ax-ui-v2'))selectProgress(ui.kind,false);}
    stamp();render();if(envelope.result)success(pendingAction||{},envelope.result);else if(client.presentation)showReceipt();
  }catch(e){root.innerHTML=`<main class="welcome"><section class="panel"><h1>暂时无法读取档案</h1><p>${esc(e.message)}</p><div class="actions">${button('重试读取','reload')}${button('返回登录','logout')}</div></section></main>`;toast(e.message);}
}
async function mutate(action,retry=false){
  if(busy)return;if(client.pending&&!retry){toast('请先重试同步');return;}
  rememberScroll();busy=true;render();
  try{const envelope=retry?await client.retry():await client.action(action);state=envelope.state;busy=false;success(action,envelope.result||{});}
  catch(e){busy=false;render();const error=modal.querySelector('.sheet-error');if(error){error.textContent=e.message;error.hidden=false;}toast(e.message);}
}
function success(action,result){
  if(action.type==='start'&&result.challenge){beginBattle(result.challenge);return;}
  if(action.type==='formation'){formationDraft=null;transition('heroes',{},true);toast('阵容已保存');return;}
  if(action.type==='rebirth'){allocation=null;marked.clear();ui.taskId='R001';transition('home',{},true);toast('新的行动开始，加点已生效');return;}
  if(action.type==='buff'){ui.selectedBuff=null;transition('rogue',{},true);toast('强化已生效');return;}
  if(action.type==='abandon'){const target=sheet?.type==='retreat'?sheet.data:{next:'tasks'},recent=client.recentBattle,show=battle||recent?.challengeId===action.challengeId;stopBattle();transition(target.next||'tasks',target.patch||{},true);if(show&&recent)openSheet('result',{taskId:recent.taskId,outcome:'retreat',report:recent.report,tab:'stats'});else toast('已撤回行动');return;}
  if(result.outcome||result.recruits){showReceipt();return;}
  if(action.type==='salvage'){marked.clear();transition('gear',{gearTab:'bag'},true);toast(`分解完成，获得${formatInteger(result.coins)}金币`);return;}
  if(action.type==='selectEquipment'){sheet=null;stamp();render();toast('获得'+itemName(result.item));return;}
  if(action.type==='exchange'||action.type==='recycleShards'){sheet=null;stamp();render();toast('碎片兑换完成');return;}
  if(action.type==='equipBest'){sheet=null;stamp();render();toast(result.equipped?`已更新${result.equipped}个部位`:'当前装备已是本次推荐组合');return;}
  if(action.type==='claimGear'){render();toast(result.gearCount?`领取${result.gearCount}件，暂存剩余${result.gearRemaining}件`:result.gearRemaining?'背包已满，装备继续暂存':'暂无待领装备');return;}
  if(action.type==='equip'||action.type==='unequip'){sheet=null;stamp();render();toast(action.type==='equip'?'装备已替换':'装备已卸下');return;}
  render();
  if(result.levels)toast(`强化${result.levels}级，消耗${formatInteger(result.paid)}金币`);
  else if(action.type==='claim')toast('后勤补给已领取');
  else if(action.type==='star')toast('升星成功');
  else if(result.migrated)toast('档案已升级，原档已保留');
}

function revealHeroes(result){return [...new Set([...(result.recruits||[]),...(result.character?[result.character]:[])].filter(x=>x.new).map(x=>x.hero))];}
function showReceipt(){
  const receipt=client.presentation;if(!receipt)return;
  const result=receipt.result,heroes=revealHeroes(result);
  if(result.outcome&&ui.view!=='tasks'){transition('tasks',{taskId:result.taskId,kind:TASKS[result.taskId].kind},true);}
  else {if(result.outcome){ui.taskId=result.taskId;ui.kind=TASKS[result.taskId].kind;}render();}
  openSheet(receipt.index<heroes.length?'reveal':result.outcome?'result':'recruits',{...result,receiptId:receipt.opId,hero:heroes[receipt.index],index:receipt.index,total:heroes.length},!!sheet);
}
function advanceReveal(skipAll=false){
  const receipt=client.presentation;if(!receipt){sheet=null;stamp();renderSheet();return;}
  receipt.index=skipAll?revealHeroes(receipt.result).length:receipt.index+1;
  client.savePresentation(receipt);showReceipt();
}

function notice(){
  if(client.pending)return `<span>保存尚未确认</span>${button('重试同步','retry')}`;
  if(state.pendingBuff&&ui.view!=='rogue')return `<span>收容强化待选择</span>${button('查看强化','nav','data-view="rogue"')}`;
  if(state.pendingEquipment.length)return `<span>${state.pendingEquipment.length}份自选装备待领取</span>${button('领取装备','pendingGear')}`;
  const migration=state.migrations?.[WEAPON_REVISION];if(migration?.report.length&&client.weaponNoticeAt!==migration.at)return `<span>武器许可已更新，旧装备均已保留</span>${button('查看记录','weaponChanges')}`;
  if(state.challenge&&!battle)return `<span>上次行动未结算</span>${button('撤回行动','abandon')}`;
  return '';
}
function render(){
  if(!state)return;
  finishWave();battleEffects?.dispose();battleEffects=null;
  const active=document.activeElement,focused=active?.id?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
  if(state.schema!==SCHEMA){root.innerHTML=`<main class="welcome"><section class="panel"><h1>旧档案升级</h1><p>保留特工、装备收藏与完整原档。任务重新开始，原重生奖励转换为回溯点。</p><div class="actions">${button('导出原档','export')}${button('保留快照并升级','migrate','',false,'primary')}</div>${client.pending?button('重试同步','retry'):''}</section></main>`;return;}
  if(ui.view==='battle'&&!battle)ui.view='tasks';
  const content=pages[ui.view](),message=battle?'':notice();
  root.innerHTML=`<div class="shell ${battle?'battle-mode':''}"><aside class="sidebar"><div class="brand"><span class="brand-mark">AX</span><strong>艾星情报局</strong></div><nav>${nav.map(([id,name,icon])=>button(`<span>${icon}</span>${name}`,'nav',`data-view="${id}"`,false,id===ui.view?'active':'')).join('')}</nav><span class="cycle">第${state.cycle}轮行动</span></aside><main class="main"><header class="topbar">${battle?battleHeader():`${button(ui.view==='home'?'AX':'‹','back','aria-label="返回"',false,'icon-button')}<h1>${esc(titles[ui.view])}</h1>${button('⋯','more','aria-label="更多"',false,'icon-button')}`}</header>${battle?'':`<div class="resources"><span>金币 <strong id="gold">${money(state.wallet.gold)}</strong></span><span>招募点 <strong id="recruit-points">${money(state.wallet.recruit)}</strong></span><span>回溯点 <strong>${formatInteger(state.points)}</strong></span></div>`}${message?`<div class="notice" role="status">${message}</div>`:''}<section class="page-body" tabindex="-1">${content.body}</section><div class="action-bar">${content.actions}</div><nav class="mobile-nav" aria-label="主要导航">${nav.map(([id,name,icon])=>button(`<span aria-hidden="true">${icon}</span>${name}`,'nav',`data-view="${id}"`,false,id===ui.view||id==='heroes'&&ui.view==='formation'?'active':'')).join('')}</nav></main></div>`;
  const body=document.querySelector('.page-body');body.scrollTop=scrollPositions.get(screenKey())||0;
  bindInputs();if(battle)drawBattle();renderSheet();
  if(focused){const target=document.getElementById(focused.id);if(target){target.focus({preventScroll:true});try{target.setSelectionRange(focused.start,focused.end);}catch{}}}
}

function taskStatus(task){if(!unlocked(task))return '未解锁';if(state.pendingBuff?.taskId===task.id)return '强化待选';if(state.runClears.includes(task.id))return TASKS[task.id].kind==='rogue'?'本轮强化已领取':'已完成';return '可挑战';}
function selectProgress(kind=ui.kind,renderNow=true){const task=CATALOG[kind][Math.min(CATALOG[kind].length-1,state.progress[kind])];Object.assign(ui,{kind,taskId:task.id});if(renderNow){stamp();render();}}
function rewardTags(task){const r=task.rewards;return `<div class="reward-tags">${r.winGold?`<span>金币 +${num(r.winGold)}</span>`:''}${r.winRecruitPoints?`<span>招募点 +${num(r.winRecruitPoints)}</span>`:''}${task.kind==='gear'?'<span>装备 ×1</span>':''}${task.kind==='rogue'?`<span>${state.runClears.includes(task.id)?'本轮奖励已领取':'胜利选择强化'}</span>`:''}${!state.firsts.includes(task.id)&&task.kind!=='idle'?'<span>首通招募点 +100</span>':''}</div>`;}
function missionSummary(task){return `<section class="panel mission-summary"><div class="section-head"><span class="muted">${esc(task.kind==='idle'?task.planet:{gear:'装备任务',rogue:'异常收容'}[task.kind])}</span><span class="tag">${taskStatus(task)}</span></div><h2>${esc(task.name)}</h2><p>${task.kind==='idle'?`${esc(task.resource)} · ${task.step}/5　`:''}三波 · 共90秒 · ${task.environmentKind?'环境单位':'敌人'}${task.waves.reduce((n,w)=>n+w.enemies.length,0)}名</p>${rewardTags(task)}${!unlocked(task)?`<p class="lock-reason">先完成「${esc(TASKS[task.unlock].name)}」</p>`:''}<div class="actions split">${button('详情','taskDetails')}${button('当前进度','nextTask','',false,'quiet')}</div></section>`;}
function missionAction(task){return state.pendingBuff?button('先选择强化','nav','data-view="rogue"',false,'primary'):button(unlocked(task)?'出战':'尚未解锁','start',`data-task="${task.id}"`,!unlocked(task),'primary');}
function homePage(){const reward=idlePreview(state,client.now()),rate=idleRates(state),task=currentTask();return {
  body:`<div class="home-layout"><section class="panel income-panel"><div><small>待领取金币</small><strong id="idle-gold">${money(reward.gold)}</strong><span id="idle-recruit">招募点 ${money(reward.recruit)}</span></div>${button('领取','claim','',false,'primary')}<small class="income-rate">每分钟 ${num(rate.gold)}金币 · ${num(rate.recruit)}招募点</small></section>${idleGearCard(state,client.now(),button)}<section class="panel squad-panel"><div class="section-head"><h2>出战小队</h2>${button('布阵','nav','data-view="formation"',false,'quiet')}</div><div class="squad-grid">${state.formation.filter(Boolean).map(id=>button(`<img src="${art(id,true)}" alt="${HERO_BY_ID[id].name}"><span>${HERO_BY_ID[id].name}</span>`,'hero',`data-hero="${id}"`)).join('')}</div></section><section class="panel continue-card"><small>继续行动</small><h2>${esc(task.name)}</h2>${rewardTags(task)}</section><div class="home-shortcuts">${button('◇ 异常收容','category','data-kind="rogue"')}${button('↶ 时间回溯','nav','data-view="rebirth"')}</div></div>`,
  actions:button('选择任务','nav','data-view="tasks"')+missionAction(task),
};}
function tasksPage(){const task=currentTask(),planet=task.kind==='idle'?task.planet:CATALOG.idle[0].planet;return {
  body:`<div class="task-layout"><div class="tabs">${[['idle','资源'],['gear','装备'],['rogue','收容']].map(([id,name])=>button(name,'category',`data-kind="${id}"`,false,ui.kind===id?'selected':'')).join('')}</div>${ui.kind==='idle'?`<div class="task-selectors"><label class="sr-only" for="planet">星球</label><select id="planet">${[...new Set(CATALOG.idle.map(t=>t.planet))].map(name=>`<option${name===planet?' selected':''}>${esc(name)}</option>`).join('')}</select><label class="sr-only" for="resource">资源</label><select id="resource">${CATALOG.idle.filter(t=>t.planet===planet&&t.step===1).map(t=>`<option value="${t.unit}"${t.unit===task.unit?' selected':''}>${esc(t.resource)}</option>`).join('')}</select></div><div class="stage-strip">${CATALOG.idle.filter(t=>t.unit===task.unit).map(t=>button(`${state.runClears.includes(t.id)?'✓ ':!unlocked(t)?'锁 ':''}${t.step}`,'task',`data-task="${t.id}" aria-label="第${t.step}关，${taskStatus(t)}"`,false,t.id===task.id?'selected':'')).join('')}</div>`:`<div class="directory-control">${button('‹','adjacentTask','data-delta="-1" aria-label="上一个任务"',task.index===1)}${button(esc(task.name)+' ▾','taskCatalog','',false,'directory-open')}${button('›','adjacentTask','data-delta="1" aria-label="下一个任务"',task.index===CATALOG[ui.kind].length)}</div>`}${missionSummary(task)}</div>`,
  actions:button('调整小队','nav','data-view="formation"')+missionAction(task),
};}
function heroesPage(){return {body:`<div class="section-head"><span>已拥有 ${ownedHeroes().length}/${HEROES.length}</span>${button('情报档案','agentArchive','',false,'quiet')}</div><div class="agent-roster">${ownedHeroes().map(h=>button(`<img src="${art(h.id,true)}" alt="${h.name}" loading="lazy"><strong>${h.name}</strong><small>${stars(h.id)}</small>`,'hero',`data-hero="${h.id}"`,false,'agent-tile')).join('')}</div>`,actions:button('出战阵容','nav','data-view="formation"',false,'primary')};}
function formationPage(){if(!formationDraft)formationDraft=[...state.formation];return {body:`<div class="formation-head"><span>出战位置</span><span>${formationDraft.filter(Boolean).length}/5人</span></div><div class="formation-grid">${formationDraft.map((id,index)=>button(`<span class="position-name">${index<3?'前排':'后排'} ${index%3+1}</span>${id?`<img src="${art(id,true)}" alt="${HERO_BY_ID[id].name}"><strong>${HERO_BY_ID[id].name}</strong>`:'<span class="empty-position">＋<small>空位</small></span>'}`,'formationSlot',`data-slot="${index}"`,false,'formation-slot')).join('')}</div>`,actions:button('返回名录','nav','data-view="heroes"')+button('保存阵容','formation','',!draftDirty(),'primary')};}
function heroBanner(){const hero=HERO_BY_ID[ui.selectedHero],stats=heroStats(state,hero.id);return `<div class="hero-banner"><img src="${art(hero.id,true)}" alt="${hero.name}"><div><strong>${hero.name}</strong><small>攻击 ${num(stats.atk)} · 生命 ${num(stats.hp)}</small></div>${button('更换','heroPicker')}</div>`;}
function filteredItems(){return state.items.filter(i=>(ui.quality==='all'||i.quality===Number(ui.quality))&&(!ui.query||itemName(i).toLowerCase().includes(ui.query.toLowerCase()))&&(ui.gearFilterSlot===null||canEquip(state,ui.selectedHero,i,ui.gearFilterSlot))).sort((a,b)=>b.quality-a.quality||Number(b.level)-Number(a.level));}
function salvageTotal(){return [...marked].reduce((sum,id)=>{const i=item(id);return sum+(i&&!i.locked&&!equipped(id)?salvageValue(i,state):0n);},0n);}
function gearPage(){
  if(!own(ui.selectedHero))ui.selectedHero=ownedHeroes()[0].id;
  const slots=state.equipment[ui.selectedHero],main=item(slots[0]),blocked=main&&TEMPLATE_BY_ID[main.templateId].twoHand;
  let body=heroBanner()+`<div class="tabs">${button('穿戴','gearTab','data-tab="wear"',false,ui.gearTab==='wear'?'selected':'')}${button('背包','gearTab','data-tab="bag"',false,ui.gearTab==='bag'?'selected':'')}</div>`,actions;
  if(ui.gearTab==='wear'){
    body+=`<div class="slot-grid">${slots.map((id,index)=>{const i=item(id);return button(`<span class="slot-icon" aria-hidden="true">${slotIcons[index]}</span><strong>${SLOT_NAMES[index]}</strong><small class="q${i?.quality||0}">${i?`${equipmentType(i)} · ${QUALITY[i.quality]} · ${i.level}级`:index===1&&blocked?'双手占用':'空位'}</small>`,'slot',`data-slot="${index}"`,false,'slot');}).join('')}</div><p class="muted">已穿戴 ${slots.filter(Boolean).length}/15</p>`;
    actions=button('角色属性','hero',`data-hero="${ui.selectedHero}"`)+button('强化','chooseUpgrade')+button('一键穿戴','equipBest','',false,'primary');
  }else{
    const list=filteredItems();ui.page=Math.max(0,Math.min(ui.page,Math.ceil(list.length/12)-1));
    body+=`${ui.gearFilterSlot!==null?`<div class="filter-notice"><span>${SLOT_NAMES[ui.gearFilterSlot]} · 可用</span>${button('全部背包','clearSlotFilter')}</div>`:''}<div class="inventory-filters"><label class="sr-only" for="quality">品质</label><select id="quality"><option value="all">全部品质</option>${QUALITY.map((name,index)=>`<option value="${index}"${ui.quality===String(index)?' selected':''}>${name}</option>`).join('')}</select><label class="sr-only" for="item-search">搜索装备</label><input id="item-search" type="search" placeholder="搜索装备" value="${esc(ui.query)}"></div><div class="inventory-list">${list.slice(ui.page*12,(ui.page+1)*12).map(i=>{const owner=equipped(i.id);return `<article class="inventory-item">${button(`<strong class="q${i.quality}">${esc(itemName(i))}</strong><small>${equipmentType(i)} · ${series(TEMPLATE_BY_ID[i.templateId].tier)} · ${QUALITY[i.quality]} · ${i.level}级${i.locked?' · 已锁定':''}${owner?' · '+HERO_BY_ID[owner].name:''}</small>`,'item',`data-item="${i.id}"`)}</article>`;}).join('')||'<p class="empty">没有符合条件的装备</p>'}</div><div class="pagination">${button('上一页','page','data-delta="-1"',ui.page===0)}<span>${ui.page+1}/${Math.max(1,Math.ceil(list.length/12))}</span>${button('下一页','page','data-delta="1"',(ui.page+1)*12>=list.length)}</div>`;
    actions=`<span class="bar-note">背包 ${state.items.length}/600</span>${button("按稀有度分解","salvageQuality","",false,"danger")}`;
  }
  return {body,actions};
}
function recruitPage(){let body=`<div class="tabs">${button('招募','recruitTab','data-tab="draw"',false,ui.recruitTab==='draw'?'selected':'')}${button('碎片兑换','recruitTab','data-tab="exchange"',false,ui.recruitTab==='exchange'?'selected':'')}</div>`,actions;
  if(ui.recruitTab==='draw'){
    body+=`<section class="recruit-banner panel"><div class="section-head"><h2>公会特别招募</h2>${button('概率详情','probabilities','',false,'quiet')}</div><div class="banner-portraits">${['lancelot','suxiaoyao','wudi'].map(id=>own(id)?`<img src="${art(id)}" alt="${HERO_BY_ID[id].name}">`:'<div class="sealed-file" aria-label="封存档案"><span>AX</span><strong>封存档案</strong></div>').join('')}</div></section>`;
    actions=button('单次 · 100点','recruit','data-count="1"',BigInt(state.wallet.recruit)<100n*SCALE)+button('十次 · 1000点','recruit','data-count="10"',BigInt(state.wallet.recruit)<1000n*SCALE,'primary');
  }else{body+=`<div class="exchange-list">${ownedHeroes().map(h=>button(`<img src="${art(h.id,true)}" alt="${h.name}"><span><strong>${h.name}</strong><small>${state.heroes[h.id].shards}枚碎片 · ${state.heroes[h.id].star}星</small></span><span>›</span>`,'exchangeDetails',`data-hero="${h.id}"`)).join('')}</div>`;actions=`<span class="bar-note">招募点 ${money(state.wallet.recruit)}</span>${button('兑换说明','exchangeHelp')}`;}
  return {body,actions};
}
function roguePage(){const pending=state.pendingBuff;if(pending&&!pending.options.includes(ui.selectedBuff))ui.selectedBuff=null;return {
  body:pending?`<h2 class="compact-title">${esc(TASKS[pending.taskId].name)}</h2><p class="muted">选择一份本轮强化</p><div class="choice-grid">${pending.options.map(id=>{const buff=BUFF_BY_ID[id];return button(`<strong>${buff.name}</strong><p>${esc(buffDisplay(id).summary)}</p>`,'selectBuff',`data-buff="${id}"`,false,`choice-card ${ui.selectedBuff===id?'selected':''}`);}).join('')}</div>${ui.selectedBuff?`<section class="panel selected-effect">${ownedBuffText(ui.selectedBuff)}</section>`:''}`:'<section class="panel empty"><h2>暂无待选强化</h2></section>',
  actions:button(`已有强化 ${state.buffs.length}`,'buffArchive')+(pending?button('确认选择','confirmBuff','',!ui.selectedBuff,'primary'):button('前往收容','category','data-kind="rogue"',false,'primary')),
};}
const resetDetails=()=>'<ul class="consequences"><li>保留特工、星级、碎片、招募点、装备收藏及挂机装备暂存；挂机来源保留历史最高通关。</li><li>全部装备回到1级，本轮强化投入清零，之后分解不再返还这些投入。</li><li>任务进度与本轮收容强化清空。</li><li>当前金币重置为1600；下一轮加点和搜集倾向立即生效。</li></ul>';
function rebirthPlan(){if(allocation===null)allocation=Object.fromEntries(Object.entries(state.talents).map(([id,t])=>[id,t.level]));try{return {plan:allocationPreview(state,allocation)};}catch(e){return {error:e.message};}}
function qualification(){if(!state.runClears.includes('AX-05'))return `先完成「${TASKS['AX-05'].name}」`;if(state.challenge)return '请先结算或撤回当前行动';if(state.pendingBuff)return '请先选择收容强化';if(state.pendingEquipment.length)return '请先领取自选装备';return '已取得回溯资格';}
function rebirthPage(){const preview=rebirthPreview(state),{plan,error}=rebirthPlan();let body=`<section class="panel rebirth-summary"><strong>预计获得 ${formatInteger(preview.points)} 回溯点</strong><small>${qualification()}</small></section><div class="tabs">${button('下一轮加点','rebirthTab','data-tab="plan"',false,ui.rebirthTab==='plan'?'selected':'')}${button('保留与重置','rebirthTab','data-tab="rules"',false,ui.rebirthTab==='rules'?'selected':'')}</div>`;
  if(ui.rebirthTab==='plan'){body+=`<div class="plan-budget"><span class="${error?'error':''}">${error||`可用 ${formatInteger(plan.budget)} · 已分配 ${formatInteger(plan.spent)}`}</span>${button('重分配','resetPlan','',false,'quiet')}</div><div class="talents">${TALENTS.map(t=>{const level=BigInt(allocation[t.id]||0),full=t.max_level!==null&&level>=BigInt(t.max_level),cost=full?'已满':`${formatInteger(pointCost(t.id,level+1n))}点`;return `<article><div><strong>${t.name}</strong><small>每级 +${percent(t.per_level)}${t.max_level===null?'':` · 上限${t.max_level}级`}</small><small>当前 ${state.talents[t.id]?.level||0} → 下轮 ${level}</small></div><div class="stepper">${button('−','talent',`data-id="${t.id}" data-delta="-1" aria-label="减少${t.name}"`,level===0n)}<span>${level}</span>${button('＋','talent',`data-id="${t.id}" data-delta="1" aria-label="增加${t.name}"`,full)}<small>下一级 ${cost}</small></div></article>`;}).join('')}</div><label class="focus-select">下一轮搜集倾向<select id="focus"${BigInt(allocation.P11||0)<1n?' disabled':''}><option value="main_hand"${focus==='main_hand'?' selected':''}>主手武器</option><option value="armor_and_offhand"${focus==='armor_and_offhand'?' selected':''}>防具与副手</option><option value="jewelry"${focus==='jewelry'?' selected':''}>首饰</option></select></label><p class="muted">${BigInt(allocation.P11||0)<1n?'未加点目标搜集，倾向不生效':'本轮保持此倾向'}</p>`;}else body+=`<section class="panel">${resetDetails()}</section>`;
  return {body,actions:`<span class="bar-note">${error?'调整加点后继续':`下轮剩余 ${formatInteger(plan.remaining)}点`}</span>${button('确认回溯','rebirth','',!preview.eligible||!!error,'primary')}`};
}
function battleHeader(){return button(esc(currentTask().name),'taskDetails','title="'+esc(currentTask().name)+'"',false,'battle-title')+'<span id="battle-wave">第'+battle.wave+' / 3波</span>'+button(battle.speed+'×','cycleSpeed','aria-label="切换倍速"')+button('撤退','retreat');}
function battlePage(){return {body:`<div class="battle-progress"><div class="wave-pips" aria-label="战斗波次">${[1,2,3].map(n=>'<i data-wave="'+n+'" class="'+(n<=battle.wave?'reached':'')+'"></i>').join('')}</div><span id="battle-time">${battle.elapsed.toFixed(1)} / 90秒</span></div><div class="battlefield scene-${battleScene(currentTask())}" data-motion="${reducedMotion()?'reduced':'full'}"><div class="scene-far" aria-hidden="true"></div><div class="scene-floor" aria-hidden="true"></div><div class="scene-haze" aria-hidden="true"></div><div class="enemy-grid" id="enemy-grid" aria-label="敌方阵容"></div><div id="battle-announcement" class="battle-announcement" aria-live="off"></div><div class="ally-grid" id="ally-grid" aria-label="我方阵容">${Array.from({length:6},(_,index)=>'<div class="empty-battle-slot" aria-hidden="true" style="grid-column:'+(index%3+1)+';grid-row:'+(Math.floor(index/3)+1)+'"></div>').join('')}</div><div class="battle-effects" aria-hidden="true"></div></div>`,actions:button('记录','battleLog')+button('强化','buffArchive')+button('显示','battleDisplay')};}
const pages={home:homePage,tasks:tasksPage,heroes:heroesPage,formation:formationPage,gear:gearPage,recruit:recruitPage,rogue:roguePage,rebirth:rebirthPage,battle:battlePage};

function statsList(stats){return `<dl class="stats-list">${Object.entries(stats).filter(([k,v])=>AFFIX_NAMES[k]&&typeof v==='number').map(([k,v])=>`<div><dt>${AFFIX_NAMES[k]}</dt><dd>${k.endsWith('Pct')||['crit','haste','dodge','critDamage','lifesteal','reduction'].includes(k)?percent(v):num(v)}</dd></div>`).join('')}</dl>`;}
const statValue=(key,value)=>['crit','critDamage'].includes(key)?percent(value):num(value);
function ownedBuffText(id,enhanced=state.enhancedBuff===id){const b=buffDisplay(id,enhanced);return esc(b.summary)+(b.detail?`<details class="effect-details"><summary>效果详情</summary><p>${esc(b.detail)}</p></details>`:'');}
function itemDetails(i){return `<div class="item-detail"><strong class="q${i.quality}">${esc(itemName(i))}</strong><p>${equipmentType(i)} · ${series(TEMPLATE_BY_ID[i.templateId].tier)} · ${QUALITY[i.quality]} · ${i.level}级</p><p>${itemStatsText(i)}</p>${i.affixes.map(a=>`<p>${AFFIX_NAMES[a.stat]||AFFIX_NAMES[a.key]||esc(a.stat||a.key)} +${percent(a.value)}</p>`).join('')}</div>`;}
function upgradePlan(i,count){let paid=0n,levels=0,total=0n;const draft={...i};for(let n=0;n<count;n++){const cost=upgradeCost(draft,state);total+=cost;if(paid+cost<=BigInt(state.wallet.gold)/SCALE){paid+=cost;levels++;}draft.level=(BigInt(draft.level)+1n).toString();}return {paid,levels,total};}
function taskDetails(task){const r=task.rewards;return `${rewardTags(task)}<h3>敌方情报</h3><p>三波 · 共90秒 · ${task.environmentKind?'总余势 '+num(task.totalEnvironmentEnergy):'总生命 '+num(task.totalBaseHp)}</p>${task.environmentKind?'<p>不可攻击；每次攻击完成后余势减少100，全部耗尽且仍有队员存活即通过。</p>':''}${task.waves.map(w=>`<h3>第${w.index}波</h3><div class="enemy-preview">${w.enemies.map(e=>`<span><strong>${esc(e.name)}</strong><small>${e.type==='environment'?'环境 · 余势'+num(e.hp):e.type==='boss'?'首领 · 2×2':e.type==='elite'?'精英 · 2×1':'普通 · 1×1'}</small><small>攻击 ${num(e.atk)}</small></span>`).join('')}</div>`).join('')}${task.kind==='rogue'?`<h3>收容机制</h3><p>${mechanicText(task)}</p><p>本轮限领一次。</p>`:''}${task.kind==='gear'?`<h3>装备掉落</h3><p>${series(r.tier)}系列${r.nextTierChanceBp?`，有${r.nextTierChanceBp/100}%概率提升为${series(r.tier+1)}系列`:''}</p><p>${r.qualityChanceBp.map((p,i)=>QUALITY[i]+' '+p/100+'%').join(' · ')}</p>`:''}${!state.firsts.includes(task.id)?`<h3>首次完成奖励</h3><p>${task.kind==='idle'?`金币 ${num(r.historicalUnitBonusGold||0)} · 招募点 ${num(r.historicalUnitBonusRecruitPoints||0)}`:'招募点 100'}${r.historicalGuaranteedCharacter?` · ${esc(r.historicalGuaranteedCharacter)}`:''}${r.historicalSelectableEquipment?' · 行旅绿色装备自选':''}</p>`:''}<p class="muted">本轮回溯贡献：${state.runClears.includes(task.id)?'已计入':num(task.rebirthContributionSubunits/240)+'点'}。</p>`;}
function modalContent(){
  const {type,data:d}=sheet;let title='',body='',actions=button('完成','close');
  switch(type){
    case 'more': title='更多';body=`<p class="account-status">${client.mode==='cloud'?'云档案已连接':'本机档案'} · 第${state.cycle}轮行动</p><div class="menu-list">${button('刷新档案','reload','',!!battle)}${button('导出存档','export')}${button('玩法帮助','help')}${button('版本信息','about')}${button('退出账号','logout','',!!battle)}</div>`;body+=button('最近战报','recentBattle','','', 'wide')+button(soundEnabled()?'音效：开':'音效：关','toggleSound','','','wide');break;
    case 'help': title='玩法帮助';body='<p>离线收益无时长上限。每场三波共用90秒，队伍状态持续保留。</p><p>环境单位不可攻击，完成一次攻击后余势减少100。三波完成且仍有队员存活才获胜。</p><p>未结算的战斗需要重新挑战。保存未确认时，重试同步可继续原操作。</p>';break;
    case 'about': title='版本信息';body=`<p>三波行动 v0.3</p><dl class="stats-list"><div><dt>规则版本</dt><dd>${RULE_VERSION}</dd></div><div><dt>档案版本</dt><dd>${SCHEMA}</dd></div><div><dt>数值版本</dt><dd>${DATA.balanceRevision}</dd></div></dl>`;break;
    case 'taskDetails': title=currentTask().name;body=taskDetails(currentTask());break;
    case 'taskCatalog': title=ui.kind==='gear'?'装备任务目录':'收容任务目录';body=`<div class="task-catalog">${CATALOG[ui.kind].map(t=>button(`<span><strong>${esc(t.name)}</strong><small>${taskStatus(t)}${!unlocked(t)?' · 先完成'+esc(TASKS[t.unlock].name):''}</small></span>${t.id===ui.taskId?'✓':'›'}`,'catalogTask',`data-task="${t.id}"`,false,t.id===ui.taskId?'selected':'')).join('')}</div>`;break;
    case 'agent': {const h=heroDefinition(state,d.hero),record=state.heroes[h.id],cost=[20,40,80,120][record.star-1];title=h.name;body=`<img class="portrait-large" src="${art(h.id)}" alt="${h.name}"><p class="stars">${record.owned?stars(h.id):'未招募'} · ${record.shards}枚碎片</p>${statsList(heroStats(state,h.id))}${h.formName?`<p class="form-info">当前：${esc(h.formName)} · 战前换装切换，三波内锁定</p>`:""}<h3>${h.active.name}<small>主动 · ${h.active.cooldownSeconds}秒</small></h3>${skillCopy(h)}<h3>${h.passive.name}<small>被动</small></h3>${skillCopy(h,true)}<p class="muted">主手：${h.weapons.main.join(' / ')}<br>副手：${h.weapons.off.join(' / ')||'不可装备'}。${h.forms?"合法主手决定技能形态；空主手采用防御形态。":"技能不要求持有指定武器。"}</p>`;actions=button(record.star===5?'已满五星':`升星 · ${cost}碎片`,'star',`data-hero="${h.id}"`,!record.owned||record.star===5||record.shards<cost)+button('装备整备','heroGear',`data-hero="${h.id}"`,!record.owned,'primary');break;}
    case 'heroPicker': title='选择整备特工';body=`<div class="picker-list">${ownedHeroes().map(h=>button(`<img src="${art(h.id,true)}" alt=""><span>${h.name}<small>${stars(h.id)}</small></span>${ui.selectedHero===h.id?'✓':'›'}`,'pickHero',`data-hero="${h.id}"`)).join('')}</div>`;break;
    case 'formationSlot': title=`${d.slot<3?'前排':'后排'} ${d.slot%3+1} · 选择特工`;body=`<div class="picker-list">${ownedHeroes().map(h=>{const position=formationDraft.indexOf(h.id);return button(`<img src="${art(h.id,true)}" alt=""><span>${h.name}<small>${position<0?'未上阵':`${position<3?'前排':'后排'} ${position%3+1} · ${position===d.slot?'当前位置':'交换'}`}</small></span>${position===d.slot?'✓':'›'}`,'placeHero',`data-hero="${h.id}" data-slot="${d.slot}"`);}).join('')}</div>`;actions=button('取消','close')+button('移除','placeHero',`data-hero="" data-slot="${d.slot}"`,!formationDraft[d.slot],'danger');break;
    case 'discardFormation': title='阵容尚未保存';body='<p>离开将放弃未保存的调整。</p>';actions=button('继续编辑','close')+button('放弃并离开','discardFormation','',false,'danger');break;
    case 'item': {const i=item(d.item);if(!i)return {title:'装备已不存在',body:'<p>这件装备已被分解或移除。</p>',actions};const owner=equipped(i.id),slots=templateSlots(TEMPLATE_BY_ID[i.templateId]).filter(slot=>canEquip(state,ui.selectedHero,i,slot)),target=slots.includes(ui.gearFilterSlot)?ui.gearFilterSlot:slots.find(slot=>!state.equipment[ui.selectedHero][slot])??slots[0];title='装备详情';body=itemDetails(i)+`<p>${owner?'穿戴者：'+HERO_BY_ID[owner].name:''}${i.locked?' · 已锁定':''}</p><div class="actions">${button(i.locked?'解除锁定':'锁定装备','lock',`data-item="${i.id}"`)}${button('分解','salvage',`data-item="${i.id}"`,!!owner||i.locked,'danger')}</div>`;actions=button('强化','upgradeSheet',`data-item="${i.id}"`)+(d.fromSlot?button('更换装备','changeSlot',`data-slot="${d.slot}"`,false,'primary'):button(state.equipment[ui.selectedHero][target]?'比较穿戴':'穿戴','tryEquip',`data-item="${i.id}" data-slot="${target}"`,!slots.length||state.equipment[ui.selectedHero][target]===i.id,'primary'));if(d.fromSlot)body+=button('卸下装备','unequip',`data-slot="${d.slot}"`,false,'wide');break;}
    case 'compare': {const i=item(d.item);if(!i)return {title:'装备已不存在',body:'<p>请重新选择装备。</p>',actions};const slot=d.slot,old=item(state.equipment[ui.selectedHero][slot]),before=heroStats(state,ui.selectedHero);let after;try{after=heroStats(act(state,{type:'equip',hero:ui.selectedHero,item:i.id,slot},state.idleGear?.at??client.now()).state,ui.selectedHero);}catch(e){return {title:'无法穿戴',body:`<p>${esc(e.message)}</p>`,actions};}const main=item(state.equipment[ui.selectedHero][0]),owner=equipped(i.id);title=old?'比较并替换':'确认关联变更';body=`<p>${HERO_BY_ID[ui.selectedHero].name} · ${SLOT_NAMES[slot]}</p><div class="comparison"><section><h3>当前</h3>${old?itemDetails(old):'<p>空位</p>'}</section><section><h3>替换为</h3>${itemDetails(i)}</section></div>${before.form&&before.form!==after.form?`<p class="form-change">形态：${HERO_BY_ID.yuliang.forms[before.form].name} → ${HERO_BY_ID.yuliang.forms[after.form].name}（下场生效）</p>`:""}<h3>属性变化</h3><dl class="stats-list">${Object.keys(before).filter(k=>AFFIX_NAMES[k]&&typeof before[k]==='number'&&Math.abs(after[k]-before[k])>.000001).map(k=>`<div><dt>${AFFIX_NAMES[k]}</dt><dd class="${after[k]>before[k]?'positive':'negative'}">${statValue(k,before[k])} → ${statValue(k,after[k])}</dd></div>`).join('')||'<p>角色属性不变</p>'}</dl>${slot===0&&TEMPLATE_BY_ID[i.templateId].twoHand?`<p class="warning-text">双手${state.equipment[ui.selectedHero][1]?' · 卸下'+esc(itemName(item(state.equipment[ui.selectedHero][1]))):''}</p>`:''}${slot===1&&main&&TEMPLATE_BY_ID[main.templateId].twoHand?`<p class="warning-text">卸下${esc(itemName(main))}</p>`:''}${owner&&owner!==ui.selectedHero?`<p class="warning-text">从${HERO_BY_ID[owner].name}转移</p>`:''}`;actions=button('取消','close')+button('确认替换','equip',`data-item="${i.id}" data-slot="${slot}"`,false,'primary');break;}
    case 'upgrade': {const i=item(d.item);if(!i)return {title:'装备已不存在',body:'<p>请重新选择装备。</p>',actions};const count=d.count||1,p=upgradePlan(i,count);title='强化装备';body=itemDetails(i)+`<div class="stage-strip upgrade-counts">${[1,5,10,100].map(n=>button(`+${n}`,'upgradeCount',`data-count="${n}"`,false,count===n?'selected':'')).join('')}</div><p>当前金币 ${money(state.wallet.gold)}</p><p>计划 +${count}级 · ${formatInteger(p.total)}金币</p><p class="${p.levels<count?'warning-text':''}">实际 ${i.level} → ${BigInt(i.level)+BigInt(p.levels)}级（+${p.levels}）${p.levels<count?' · 金币不足，部分强化':''}</p>`;actions=button('返回','close')+button(`强化 · ${formatInteger(p.paid)}金币`,'upgrade',`data-item="${i.id}" data-count="${count}"`,p.levels===0,'primary');break;}
    case 'chooseUpgrade': title='选择要强化的装备';body=`<div class="menu-list">${state.equipment[ui.selectedHero].filter(Boolean).map(id=>{const i=item(id);return button(`<span class="q${i.quality}">${esc(itemName(i))}</span><small>${i.level}级</small>`,'upgradeSheet',`data-item="${id}"`);}).join('')||'<p>暂无已穿戴装备</p>'}</div>`;break;
    case 'salvage': {const candidates=d.items.map(item).filter(Boolean),total=candidates.reduce((n,i)=>n+salvageValue(i,state),0n);title=d.quality===undefined?'确认分解':QUALITY[d.quality]+' · 全部分解';body=`<p>分解${candidates.length}件装备，返还 <strong>${formatInteger(total)}金币</strong>。</p><p>分解后不可恢复。</p><ul>${candidates.map(i=>`<li class="q${i.quality}">${esc(itemName(i))} · ${i.level}级</li>`).join('')}</ul>`;actions=button('取消','close')+button(d.quality===undefined?'确认分解':'全部分解','confirmSalvage','',!candidates.length,'danger');break;}
    case 'probabilities': title='招募概率';body=`<p>每次消耗100招募点；十次消耗1000点。</p><p>${HEROES.length}名特工各占${percent(1/HEROES.length)}，每次独立抽取，无保底。首次获得一星特工，重复获得10枚对应碎片。</p><div class="probability-list">${HEROES.map(h=>`${button(`<span>${h.name}</span><strong>${percent(1/HEROES.length)}</strong>`,'hero',`data-hero="${h.id}"`)}`).join('')}</div>`;break;
    case 'exchangeHelp': title='碎片兑换说明';body='<p>已拥有且未满星的特工：300招募点兑换10枚对应碎片。</p><p>满五星特工：多余碎片每枚兑换5招募点。点击特工查看本次费用或返还数量。</p>';break;
    case 'exchangeDetails': {const h=HERO_BY_ID[d.hero],record=state.heroes[h.id],max=record.star===5;title=h.name+' · 碎片兑换';body=`<img class="exchange-portrait" src="${art(h.id,true)}" alt="${h.name}"><p>当前${record.star}星 · ${record.shards}枚碎片</p><p>${max?`全部${record.shards}枚碎片 → ${record.shards*5}招募点`:'300招募点 → 10枚碎片'}</p>`;actions=button('取消','close')+button(max?'确认回收':'确认兑换',max?'recycleShards':'exchange',`data-hero="${h.id}"`,max?!record.shards:BigInt(state.wallet.recruit)<300n*SCALE,'primary');break;}
    case 'agentArchive': title='情报档案';body=`<div class="archive-grid">${HEROES.filter(h=>!own(h.id)).map(h=>`<article class="sealed-file"><small>档案 ${String(HEROES.indexOf(h)+1).padStart(2,'0')}</small><span aria-hidden="true">AX</span><strong>封存档案</strong>${archiveClues(h,state)}</article>`).join('')||'<p>全部特工已归档。</p>'}</div>`;actions=button('概率详情','probabilities')+button('完成','close');break;
    case 'reveal': {const h=HERO_BY_ID[d.hero];if(!h||client.presentation?.opId!==d.receiptId)return {title:'招募结果',body:'<p>结果已查看。</p>',actions};title='新特工情报';body=`<div class="reveal-stage reveal-${revealStyle(h).kind}" style="--reveal-color:${revealStyle(h).color}" data-reveal="${d.receiptId}-${d.index}"><div class="reveal-seal" aria-hidden="true"><span>AX</span><strong>封存档案</strong></div><article class="reveal-card"><img src="${art(h.id)}" alt="${h.name}"><div><small>${revealStyle(h).label} · ${d.index+1}/${d.total}</small><h3>${h.name}</h3><p>${roleText(h)}</p></div></article><i class="reveal-scan" aria-hidden="true"></i></div>`;actions=button('跳过','skipReveal')+button('继续','advanceReveal','',false,'primary');break;}
    case 'recruits': title='特工报到';body=`<div class="recruit-results">${d.recruits.map(x=>`<article><img src="${art(x.hero,true)}" alt="${HERO_BY_ID[x.hero].name}"><strong>${HERO_BY_ID[x.hero].name}</strong><span>${x.new?'新特工 · 一星':'+10碎片'}</span></article>`).join('')}</div>`;break;
    case 'result': {
      const task=TASKS[d.taskId],next=task&&CATALOG[task.kind][task.index];title=d.history?'最近战报':d.outcome==='win'?'胜利':d.outcome==='retreat'?'已撤退':'失败';
      const tab=d.tab||(d.outcome==='win'?'rewards':'stats');body=(task?'<h3>'+esc(task.name)+'</h3>':'')+'<div class="tabs">'+button('奖励','resultTab','data-tab="rewards"',false,tab==='rewards'?'selected':'')+button('统计','resultTab','data-tab="stats"',false,tab==='stats'?'selected':'')+'</div>';
      body+=tab==='stats'?reportContent(d,button):d.history?'<p>最近战报仅保留统计。</p>':d.outcome==='win'?'<div class="reward-tags"><span>金币 +'+esc(d.gold)+'</span><span>招募点 +'+esc(d.recruit)+'</span></div>'+(d.item?itemDetails(d.item):'')+(d.character?'<p>'+HERO_BY_ID[d.character.hero].name+' · '+(d.character.new?'新特工':'+10碎片')+'</p>':''):'<p>本次未获得奖励</p>';
      actions=button('返回','close');if(task)actions+=(d.buff?button('选择强化','resultBuff','','','primary'):next&&d.outcome==='win'&&!d.history?button('下一任务','resultNext','data-task="'+next.id+'"',false,'primary'):button('再次挑战','start','data-task="'+task.id+'"',false,'primary'));break;
    }
    case 'weaponChanges': {const migration=state.migrations?.[WEAPON_REVISION];title='武器调整记录';body='<p>不符合新许可的装备已卸回背包。物品、等级、词条、锁定和强化投入均保留。</p><ul>'+(migration?.report||[]).map(r=>'<li>'+esc(r.hero?HERO_BY_ID[r.hero].name+' · '+SLOT_NAMES[r.slot]+(item(r.item)?' · '+itemName(item(r.item)):''):r.reason)+'</li>').join('')+'</ul>';actions=button('导出完整档案','export')+button('我知道了','ackWeaponNotice','','','primary');break;}
    case 'salvageQuality': title='按稀有度全部分解';body='<p>包含全背包所有分页，排除已穿戴和锁定装备。</p><div class="menu-list">'+QUALITY.map((q,index)=>{const list=state.items.filter(i=>i.quality===index&&!i.locked&&!equipped(i.id)),coins=list.reduce((n,i)=>n+salvageValue(i,state),0n);return button(q+' · '+list.length+'件 <small>返还 '+formatInteger(coins)+'金币</small>','chooseSalvageQuality','data-quality="'+index+'"',!list.length,'q'+index);}).join('')+'</div>';break;
    case 'buffArchive': title='本轮强化';body=`<div class="buff-archive">${state.buffs.map(id=>`<article><h3>${BUFF_BY_ID[id].name}${state.enhancedBuff===id?' · 已精修':''}</h3><div class="effect-copy">${ownedBuffText(id)}</div></article>`).join('')||'<p>还没有获得本轮强化。</p>'}</div>`;break;
    case 'enhance': title='选择精修目标';body=`<div class="menu-list">${DATA.rogueEnhanceWhitelist.filter(w=>state.buffs.includes(w.choice_id)).map(w=>button(`<strong>${BUFF_BY_ID[w.choice_id].name}</strong><small>${esc(buffDisplay(w.choice_id).summary)} → ${esc(buffDisplay(w.choice_id,true).summary)}</small>`,'enhanceTarget',`data-target="${w.choice_id}"`,false,d.target===w.choice_id?'selected':'')).join('')}</div>`;actions=button('返回','close')+button('确认精修','confirmEnhance','',!d.target,'primary');break;
    case 'rebirthConfirm': {const {plan}=rebirthPlan();title='确认时间回溯';body=`<p>本轮获得${formatInteger(rebirthPreview(state).points)}回溯点；下轮分配${formatInteger(plan.spent)}点，剩余${formatInteger(plan.remaining)}点。</p>${resetDetails()}<h3>下一轮加点</h3><ul>${TALENTS.filter(t=>BigInt(allocation[t.id]||0)>0n).map(t=>`<li>${t.name} · ${allocation[t.id]}级</li>`).join('')||'<li>暂不加点，保留全部回溯点。</li>'}</ul>`;actions=button('继续调整','close')+button('开始下一轮','confirmRebirth','',false,'primary');break;}
    case 'pendingGear': title='领取自选装备';body=state.pendingEquipment.map(p=>`<h3>${esc(TASKS[p.taskId].name)} · ${p.group}</h3><div class="menu-list">${TEMPLATES.filter(t=>templateAvailable(t)&&t.tier===p.tier&&t.group===({武器:'weapon',防具:'armor',首饰:'jewelry'}[p.group])).map(t=>button(`${esc(t.name)} · 绿色`,'selectEquipment',`data-task="${p.taskId}" data-template="${t.id}"`)).join('')}</div>`).join('')||'<p>奖励已领取完毕。</p>';break;
    case 'battleUnit': {const meta=battle?.units[d.unit],unit=battle?.currentFrame?.find(u=>u.id===d.unit);title=meta?.name||'单位详情';body=meta?`<p>${meta.kind==='environment'?'余势':'生命'} ${num(unit?.hp??meta.maxHp)} / ${num(meta.maxHp)}${meta.kind==='environment'?' · 剩余'+Math.ceil((unit?.hp??meta.maxHp)/100)+'次攻击':' · 护盾 '+num(unit?.shield||0)}</p>${meta.kind==='environment'?`<p>不可攻击 · 每次攻击后余势 −100</p><p>每${meta.environment.interval}秒攻击${{front:'前排目标',rotate2:'轮换两名队员',all:'全队'}[meta.environment.targetMode]}；护盾完全吸收或无敌时也会衰减。</p>`:''}${statsList(meta)}${unit?battleStateText(meta,unit):""}<p>${unit?.immune?'无敌中 · ':''}${unit?.interfered?'技能受到干扰 · ':''}${unit?.debt?'剩余醉伤 '+num(unit.debt):''}</p>${battleAbilities(meta)}`:'<p>战斗已结束。</p>';break;}
    case 'battleDisplay': title='战斗显示';body='<div class="menu-list">'+[['system','跟随系统'],['full','完整动效'],['reduced','减少动态效果']].map(([value,label])=>button(label,'battleMotion','data-motion="'+value+'" aria-pressed="'+(motionPreference()===value)+'"',false,motionPreference()===value?'selected':'')).join('')+'</div>';break;
    case 'battleLog': title='战斗记录';body=`<ol class="combat-log">${(battle?.log||[]).map(e=>`<li><time>${e.time.toFixed(1)}秒</time> ${esc(e.text)}</li>`).join('')||'<li>行动刚刚开始。</li>'}</ol>`;break;
    case 'retreat': title='撤回本次行动';body='<p>撤退不会获得本次奖励，也不消耗门票。之后可重新挑战。</p>';actions=button('继续战斗','close')+button('确认撤退','confirmRetreat','',false,'danger');break;
    default: title='提示';body='<p>请返回后重新选择。</p>';
  }
  return {title,body,actions};
}
function renderSheet(){
  if(!sheet){if(modal.open)modal.close();modal.innerHTML='';syncBattleView();return;}
  pauseBattleView();
  const {title,body,actions}=modalContent(),position=scrollPositions.get(sheetKey())||0;
  modal.setAttribute('aria-labelledby','sheet-title');modal.innerHTML=`<header class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2>${button('×','close','aria-label="关闭"',false,'icon-button')}</header><div class="sheet-body">${body}<p class="sheet-error" role="alert" hidden></p></div><footer class="sheet-footer">${client.pending?`<div class="retry-row"><span>保存未确认</span>${button('重试同步','retry')}</div>`:''}<div class="actions">${actions}</div></footer>`;
  if(sheet.type==='reveal'&&HERO_BY_ID[sheet.data.hero])revealSound(HERO_BY_ID[sheet.data.hero],sheet.data.receiptId+':'+sheet.data.index);
  modal.classList.toggle('reveal-dialog',sheet.type==='reveal');if(!modal.open)modal.showModal();modal.querySelector('.sheet-body').scrollTop=position;
}

function battleWeapon(id){
  if(battle?.units[id]?.side==='enemy')return ['spitter','worm','strafer','caster','elemental'].includes(enemyAppearance(currentTask(),battle.units[id]).family)?'法杖':'单手剑';
  const slots=state.equipment[id]||[];
  return slots.map(key=>TEMPLATE_BY_ID[item(key)?.templateId]).find(t=>t?.group==='weapon')?.slot||HERO_BY_ID[id]?.weapons?.main?.[0]||'单手剑';
}
function battleStateText(meta,unit){
  const entries=[];
  if(meta.id==='echoz')entries.push('暗影层数：'+(unit.dotStacks||0)+' / 3');
  if(meta.id==='asuna')entries.push('觉醒增伤：剩余'+(unit.actionBuffCount||0)+'次行动');
  if(meta.id==='shuo')entries.push('连续命中：'+(unit.focusCount||0)+'次 · 增伤层数 '+Math.min(3,unit.focusCount||0));
  if(meta.form)entries.push('形态：'+HERO_BY_ID[meta.id].forms[meta.form].name+'（本场锁定）');
  if(meta.form==='offense')entries.push('战意：'+(unit.warIntent||0)+' / 3');
  if(meta.id==='hasika')entries.push('野兽顺劈：剩余'+(unit.cleaveCharges||0)+'次');
  if(meta.id==='xifeng')entries.push('灵魂链接：'+(unit.linkUsed?'本场已使用':'本场可用1次'));
  if(unit.kkt)entries.push('KKT：攻击属性 +15%');
  if(unit.keyUntil>battle.elapsed)entries.push('非常棒的钥匙：伤害 / 治疗 / 护盾 +25%，剩余'+num(unit.keyUntil-battle.elapsed)+'秒');
  return entries.length?'<p class="battle-status-details">'+entries.map(esc).join('<br>')+'</p>':'';
}
function battleAbilities(meta){
  const original=HERO_BY_ID[meta.id],hero=original?.forms?{...original,...original.forms[meta.form||'defense'],id:original.id,form:meta.form||'defense'}:original;
  if(hero)return '<h3>'+esc(hero.active.name)+'</h3>'+skillCopy(hero)+'<h3>被动</h3>'+skillCopy(hero,true);
  if(meta.kind==='environment')return '';
  const task=currentTask(),spec=task.waves.flatMap(w=>w.enemies).find(u=>u.id===meta.id)||task.summonTemplate;
  const skill=spec?.skill;if(!skill)return '<p>普通攻击 · 每'+num(spec?.interval||3)+'秒</p>';
  if(skill.id==='ward')return '<p>护盾 · 每'+num(skill.cd)+'秒获得'+percent(skill.shieldHpFraction||.06)+'最大生命护盾，持续'+num(skill.duration||5)+'秒。</p>';
  return '<p>普通攻击 · 每'+num(spec.interval)+'秒</p><p>'+(skill.id==='sweep'?'横扫':'强击')+' · 每'+num(skill.cd)+'秒，造成'+percent(skill.multiplier)+'攻击伤害，命中'+(skill.id==='sweep'?'全体':'1个目标')+'。</p>';
}
function battleCard(u){
  const hero=u.side==='hero',appearance=hero?null:enemyAppearance(currentTask(),u);
  return '<button data-action="battleUnit" data-unit="'+esc(u.id)+'" id="unit-'+esc(u.id)+'" class="battle-card '+(hero?'ally':u.kind)+'" data-family="'+(appearance?.family||'hero')+'" style="grid-column:'+(hero?u.slot%3+1:u.x+1)+' / span '+u.w+';grid-row:'+(hero?Math.floor(u.slot/3)+1:u.y+1)+' / span '+u.h+'" aria-label="查看'+esc(u.name)+'状态"><span class="unit-art"><img src="'+(hero?art(u.id,true):appearance.src)+'" alt="" draggable="false"></span><span class="unit-status" aria-hidden="true"></span><span class="fallen-mark" aria-hidden="true">☠</span><span class="unit-vitals" aria-hidden="true"><span class="hp-bar"><i></i></span><span class="shield-bar"><i></i></span></span>'+(u.kind==='environment'?'<span class="environment-tag">余势 · 不可攻击</span>':'')+'</button>';
}
function appendUnit(u){const grid=document.querySelector(u.side==='hero'?'#ally-grid':'#enemy-grid');if(grid&&!document.getElementById('unit-'+u.id)){grid.insertAdjacentHTML('beforeend',battleCard(u));battle.units[u.id]=u;}}
function drawBattle(){
  if(!battle?.simulation||ui.view!=='battle')return;
  if(!battleEffects){battleEffects=new BattleEffects(document.querySelector('.battlefield'),{unit:id=>battle?.units[id],speed:()=>battle?.speed||1,weapon:battleWeapon});setSceneOffset();}
  for(const u of Object.values(battle.units))appendUnit(u);
  applyFrame(battle.currentFrame||battle.simulation.events.find(e=>e.type==='frame')?.units||[]);
}
function setSceneOffset(){const field=document.querySelector('.battlefield');field?.style.setProperty('--advance',((battle?.wave||1)-1)*64+'px');field?.style.setProperty('--far-advance',((battle?.wave||1)-1)*16+'px');}
function finishWave(){
  const pending=battle?.waveTransition;if(!pending)return;
  if(!pending.inserted)pending.insert();battle.waveTransition=null;
}
function pauseBattleView(){if(!battle)return;const now=performance.now();battle.pausedAt??=now;battle.last=now;battleEffects?.pause();}
function syncBattleView(){
  if(!battle)return;if(sheet||busy||document.hidden){pauseBattleView();return;}
  const now=performance.now();if(battle.pausedAt!=null){battle.holdUntil+=now-battle.pausedAt;battle.pausedAt=null;}
  battle.last=now;battleEffects?.resume();
}
document.addEventListener('visibilitychange',syncBattleView);
window.addEventListener('resize',()=>battleEffects?.repositionLabels());
function updateBattleMotion(){finishWave();battleEffects?.clear();if(battle)battle.holdUntil=0;document.querySelector('.battlefield')?.setAttribute('data-motion',reducedMotion()?'reduced':'full');syncBattleView();}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',updateBattleMotion);
function showWave(event){
  finishWave();battleEffects?.clear();
  const heroes=Object.values(battle.units).filter(u=>u.side==='hero'),oldWave=battle.wave;
  battle.units=Object.fromEntries([...heroes,...event.units].map(u=>[u.id,u]));battle.wave=event.index;
  const previous=new Map((battle.currentFrame||[]).map(u=>[u.id,u]));
  battle.currentFrame=[...event.heroes.map(u=>({...previous.get(u.id),id:u.id,hp:u.hp,shield:u.shield})),...event.units.map(u=>({id:u.id,hp:u.maxHp,shield:0}))];
  const grid=document.querySelector('#enemy-grid');
  const pending={inserted:false,insert(){if(this.inserted)return;this.inserted=true;grid.replaceChildren();drawBattle();}};
  document.querySelector('#battle-wave').textContent='第'+event.index+' / '+event.total+'波';
  document.querySelectorAll('[data-wave]').forEach(el=>el.classList.toggle('reached',Number(el.dataset.wave)<=event.index));
  setSceneOffset();
  if(event.index===1||reducedMotion()){pending.insert();return;}
  battle.waveTransition=pending;
  battleEffects.animate(grid,[{opacity:1},{opacity:0}],80);
  const field=document.querySelector('.battlefield'),offset=(event.index-oldWave)*64;
  battleEffects.animate(field.querySelector('.scene-floor'),[{transform:'translateY(calc(var(--advance) - '+offset+'px))'},{transform:'translateY(var(--advance))'}],240,{delay:60});
  battleEffects.animate(field.querySelector('.scene-far'),[{transform:'translateY(calc(var(--far-advance) - 16px))'},{transform:'translateY(var(--far-advance))'}],260,{delay:60});
  battleEffects.animate(field.querySelector('.scene-haze'),[{opacity:.7},{opacity:.3,offset:.5},{opacity:1}],240,{delay:60});
  for(const u of battle.currentFrame.filter(u=>battle.units[u.id]?.side==='hero'&&u.hp>0)){
    const card=document.getElementById('unit-'+u.id),row=battle.units[u.id].row||0;
    if(card)battleEffects.animate(card.querySelector('.unit-art'),[{transform:'translateY(0)'},{transform:'translateY(-3px)',offset:.5},{transform:'translateY(0)'}],220,{delay:80+row*20});
  }
  battleEffects.later(()=>{
    if(battle?.waveTransition!==pending)return;pending.insert();
    battleEffects.animate(grid,[{opacity:0,'--enemy-enter':'-20px'},{opacity:1,'--enemy-enter':'0px'}],240);
  },160);
  battleEffects.later(()=>{if(battle?.waveTransition===pending)finishWave();},400);
}
function applyFrame(units){
  for(const u of units){
    const card=document.getElementById('unit-'+u.id),meta=battle.units[u.id];if(!card||!meta)continue;
    card.classList.toggle('dead',u.hp<=0);card.classList.toggle('low-hp',u.hp>0&&u.hp/meta.maxHp<.25);
    card.querySelector('.hp-bar i').style.width=Math.max(0,u.hp/meta.maxHp*100)+'%';
    card.querySelector('.shield-bar i').style.width=Math.min(100,Math.max(0,u.shield/meta.maxHp*100))+'%';
    const statuses=[];if(u.hp>0){if(u.immune)statuses.push(['⬡','无敌']);if(u.interfered)statuses.push(['◌','技能干扰']);if(u.debt>0)statuses.push(['⌛','醉伤']);}
    if(u.hp>0){if(u.keyUntil>battle.elapsed)statuses.push(['⚿','非常棒的钥匙']);if(u.kkt)statuses.push(['↑','KKT攻击光环']);if(u.warIntent)statuses.push([String(u.warIntent),'战意']);if(u.cleaveCharges)statuses.push([String(u.cleaveCharges),'野兽顺劈剩余次数']);}
    if(u.hp>0){if(u.dotStacks)statuses.push([String(u.dotStacks),'暗影层数']);if(u.id==='asuna'&&u.actionBuffCount)statuses.push([String(u.actionBuffCount),'觉醒剩余行动']);if(u.id==='shuo'&&u.focusCount)statuses.push([String(Math.min(3,u.focusCount)),'连续命中层数']);}
    if(Number.isFinite(u.atk))meta.atk=u.atk;
    card.querySelector('.unit-status').innerHTML=statuses.slice(0,3).map(([icon,name])=>'<i title="'+name+'">'+icon+'</i>').join('')+(statuses.length>3?'<i>+'+(statuses.length-3)+'</i>':'');
  }
}
function saveBattleReport(outcome){if(!battle?.simulation)return;const report=battleReport({...battle.simulation,events:outcome==='retreat'?battle.simulation.events.slice(0,battle.index):battle.simulation.events},outcome==='retreat'?battle.elapsed:Infinity);try{client.saveBattle({challengeId:battle.challenge.id,taskId:battle.challenge.taskId,outcome,report});}catch{toast('本机空间不足，战报暂未保存');}}
function stopBattle(){finishWave();battleEffects?.dispose();battleEffects=null;clearInterval(battleTimer);battleTimer=null;worker?.terminate();worker=null;battle=null;}
function beginBattle(challenge){
  stopBattle();toastNode.classList.remove('visible');toastNode.textContent='';battle={challenge,speed:preferredBattleSpeed,elapsed:0,index:0,wave:1,holdUntil:0,last:performance.now(),units:{},simulation:null,currentFrame:null,log:[]};
  transition('battle',{taskId:challenge.taskId,kind:TASKS[challenge.taskId].kind},true);preloadEnemies(currentTask());
  worker=new Worker(new URL('./battle-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(data.error){toast(data.error);stopBattle();transition('tasks',{},true);return;}battle.simulation=data;battle.units=Object.fromEntries(data.initial.map(u=>[u.id,u]));battle.last=performance.now();drawBattle();battleTimer=setInterval(playback,50);};
  worker.onerror=()=>{toast('战斗暂时无法开始，请返回后重试');stopBattle();transition('tasks',{},true);};worker.postMessage(challenge);
}
function playback(){
  if(!battle?.simulation)return;const now=performance.now();if(busy||sheet||document.hidden){pauseBattleView();return;}if(now<battle.holdUntil){battle.last=now;return;}
  battle.elapsed+=(now-battle.last)/1000*battle.speed;battle.last=now;const sim=battle.simulation,visual=[];
  const clock=document.querySelector('#battle-time');if(clock)clock.textContent=Math.min(battle.elapsed,sim.duration).toFixed(1)+' / 90秒';
  while(battle.index<sim.events.length&&sim.events[battle.index].time<=battle.elapsed){const e=sim.events[battle.index++];let text;
    if(e.type==='wave'){
      battleEffects?.group(visual.splice(0));showWave(e);text='第'+e.index+'波';battleEffects?.announce(text,600);battle.log.push({time:e.time,text});
      if(e.index>1){battle.elapsed=e.time;battle.holdUntil=now+(reducedMotion()?0:400);if(clock)clock.textContent=e.time.toFixed(1)+' / 90秒';break;}
      continue;
    }
    if(e.type==='summon'){appendUnit(e.unit);const card=document.getElementById('unit-'+e.unit.id);if(card)battleEffects?.animate(card.querySelector('.unit-art'),[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],battleEffects.duration(150));}
    if(e.type==='frame'){battle.currentFrame=e.units;applyFrame(e.units);}
    else visual.push(e);
    if(e.type==='skill')text=(HERO_BY_ID[e.source]?.name||battle.units[e.source]?.name||'敌方')+' · '+e.name;
    if(e.type==='buff')text=HERO_BY_ID[e.source].name+' → '+HERO_BY_ID[e.target].name+' · '+e.name;
    if(e.type==='redistribute')text=HERO_BY_ID[e.source].name+' · '+e.name+'：存活队员按生命点数均分（本场已使用）';
    if(e.type==='mechanic'||e.type==='clutch')text=e.text;
    if(text)battle.log.push({time:e.time,text});
  }
  battleEffects?.group(visual);
  if(battle.elapsed>=sim.duration){const challengeId=battle.challenge.id,outcome=sim.outcome;saveBattleReport(outcome);stopBattle();transition('tasks',{},true);mutate({type:'settle',challengeId,outcome});}
}
function bindInputs(){
  const bind=(id,event,fn)=>document.getElementById(id)?.addEventListener(event,fn);
  bind('planet','change',e=>updateUI({taskId:CATALOG.idle.find(t=>t.planet===e.target.value).id}));
  bind('resource','change',e=>updateUI({taskId:CATALOG.idle.find(t=>t.unit===Number(e.target.value)&&t.step===1).id}));
  bind('quality','change',e=>updateUI({quality:e.target.value,page:0}));bind('item-search','input',e=>updateUI({query:e.target.value,page:0}));
  bind('focus','change',e=>{focus=e.target.value;});
  root.querySelectorAll('[data-mark]').forEach(el=>el.addEventListener('change',()=>{el.checked?marked.add(el.dataset.mark):marked.delete(el.dataset.mark);rememberScroll();render();}));
}
async function handle(action,el){
  const d=el.dataset;if(busy)return;unlockSound();
  if(action==='close'){closeSheet();return;}
  if(action==='retry'){const pending=client.pending;if(pending)await mutate(pending.action,true);else await connect(client.mode);return;}
  if(action==='nav'){navigate(d.view);return;}
  if(action==='back'){if(sheet)closeSheet();else if(ui.view==='home')return;else if(battle)openSheet('retreat',{next:'tasks'});else navigate(ui.view==='formation'?'heroes':'home');return;}
  if(action==='export'){download(state);toast('存档已导出');return;}
  if(action==='reload'){if(client?.pending){await handle('retry',el);return;}if(battle||draftDirty()){toast('请先结束战斗或保存阵容');return;}sheet=null;stamp();await connect(client?.mode||selectedMode());return;}
  if(action==='logout'){if(battle||draftDirty()){toast('请先结束战斗或保存阵容');return;}await signOut();state=null;ui={...defaults};formationDraft=null;allocation=null;marked.clear();saveUI();history.replaceState(null,'','#home');welcome();return;}
  if(['more','help','about','taskDetails','taskCatalog','heroPicker','chooseUpgrade','probabilities','exchangeHelp','buffArchive','pendingGear','battleLog','agentArchive','battleDisplay','weaponChanges'].includes(action)){openSheet(action);return;}
  if(action==='hero'){if(own(d.hero)||sheet?.type==='probabilities')openSheet('agent',{hero:d.hero});else openSheet('agentArchive');return;}
  if(action==='advanceReveal'){advanceReveal();return;}
  if(action==='skipReveal'){advanceReveal(true);return;}
  if(action==='heroGear'){closeSheet(()=>navigate('gear',{selectedHero:d.hero,gearTab:'wear',gearFilterSlot:null}));return;}
  if(action==='pickHero'){closeSheet(()=>updateUI({selectedHero:d.hero,page:0}));return;}
  if(action==='category'){const task=ui.kind===d.kind?currentTask():CATALOG[d.kind][Math.min(CATALOG[d.kind].length-1,state.progress[d.kind])];navigate('tasks',{kind:d.kind,taskId:task.id});return;}
  if(action==='nextTask'){selectProgress();return;}
  if(action==='adjacentTask'){const list=CATALOG[ui.kind],index=list.findIndex(t=>t.id===ui.taskId)+Number(d.delta);if(list[index])updateUI({taskId:list[index].id});return;}
  if(action==='task'){updateUI({taskId:d.task});return;}
  if(action==='catalogTask'){closeSheet(()=>updateUI({taskId:d.task}));return;}
  if(action==='formationSlot'){openSheet('formationSlot',{slot:Number(d.slot)});return;}
  if(action==='placeHero'){
    const next=[...formationDraft],slot=Number(d.slot),old=d.hero?next.indexOf(d.hero):-1;
    if(old>=0)next[old]=next[slot];next[slot]=d.hero||null;
    const count=next.filter(Boolean).length;if(count<1||count>5){toast('阵容需要一至五名特工');return;}
    formationDraft=next;closeSheet(()=>render());return;
  }
  if(action==='discardFormation'){const target=sheet.data;formationDraft=null;transition(target.next,target.patch||{},true);return;}
  if(action==='gearTab'){updateUI({gearTab:d.tab});return;}
  if(action==='clearSlotFilter'){updateUI({gearFilterSlot:null,page:0});return;}
  if(action==='gearBagAction'){if(ui.gearFilterSlot!==null)updateUI({gearTab:'wear'});else {const first=root.querySelector('[data-mark]:not(:disabled)');if(first){first.focus();toast('勾选装备后，底部会显示返还金币');}else toast('没有可分解的未穿戴装备');}return;}
  if(action==='page'){updateUI({page:ui.page+Number(d.delta)});return;}
  if(action==='slot'){const slot=Number(d.slot),id=state.equipment[ui.selectedHero][slot];ui.selectedSlot=slot;stamp();if(id)openSheet('item',{item:id,fromSlot:true,slot});else updateUI({gearTab:'bag',gearFilterSlot:slot,quality:'all',query:'',page:0});return;}
  if(action==='changeSlot'){transition('gear',{gearTab:'bag',gearFilterSlot:Number(d.slot),quality:'all',query:'',page:0},true);return;}
  if(action==='item'){openSheet('item',{item:d.item});return;}
  if(action==='tryEquip'){
    const i=item(d.item),slot=Number(d.slot),old=state.equipment[ui.selectedHero][slot],main=item(state.equipment[ui.selectedHero][0]),owner=equipped(i.id);
    const conflicts=slot===0&&TEMPLATE_BY_ID[i.templateId].twoHand&&state.equipment[ui.selectedHero][1]||slot===1&&main&&TEMPLATE_BY_ID[main.templateId].twoHand||owner&&owner!==ui.selectedHero;
    const formChange=ui.selectedHero==='yuliang'&&heroStats(state,ui.selectedHero).form!==(slot===0&&TEMPLATE_BY_ID[i.templateId].twoHand?'offense':slot===0||slot===1?'defense':heroStats(state,ui.selectedHero).form);
    if(!old&&!conflicts&&!formChange){await mutate({type:'equip',hero:ui.selectedHero,item:i.id,slot});return;}
    openSheet('compare',{item:i.id,slot});return;
  }
  if(action==='compare'){openSheet('compare',{item:d.item,slot:Number(d.slot)});return;}
  if(action==='upgradeSheet'){openSheet('upgrade',{item:d.item,count:1});return;}
  if(action==='upgradeCount'){rememberScroll();sheet.data.count=Number(d.count);stamp();renderSheet();return;}
  if(action==='salvage'||action==='bulkSalvage'){const ids=action==='salvage'?[d.item]:[...marked];openSheet('salvage',{items:ids,expectedCoins:ids.reduce((n,id)=>n+salvageValue(item(id),state),0n).toString()});return;}
  if(action==='salvageQuality'){openSheet('salvageQuality');return;}
  if(action==='chooseSalvageQuality'){const quality=Number(d.quality),items=state.items.filter(i=>i.quality===quality&&!i.locked&&!equipped(i.id));openSheet('salvage',{quality,items:items.map(i=>i.id),expectedCoins:items.reduce((n,i)=>n+salvageValue(i,state),0n).toString()});return;}
  if(action==='reportMetric'||action==='reportWave'||action==='resultTab'){if(action==='reportMetric')sheet.data.metric=d.metric;else if(action==='reportWave')sheet.data.wave=Number(d.wave);else sheet.data.tab=d.tab;stamp();renderSheet();return;}
  if(action==='recentBattle'){const r=client.recentBattle;openSheet('result',r?{taskId:r.taskId,outcome:r.outcome,report:r.report,tab:'stats',history:true}:{history:true,tab:'stats'});return;}
  if(action==='ackWeaponNotice'){client.acknowledgeWeaponNotice(state.migrations[WEAPON_REVISION].at);sheet=null;stamp();render();return;}
  if(action==='toggleSound'){toggleSound();render();return;}
  if(action==='recruitTab'){updateUI({recruitTab:d.tab});return;}
  if(action==='exchangeDetails'){openSheet('exchangeDetails',{hero:d.hero});return;}
  if(action==='resultBuff'){closeSheet(()=>navigate('rogue'));return;}
  if(action==='resultNext'){closeSheet(()=>updateUI({taskId:d.task,kind:TASKS[d.task].kind}));return;}
  if(action==='selectBuff'){updateUI({selectedBuff:d.buff});return;}
  if(action==='enhanceTarget'){rememberScroll();sheet.data.target=d.target;stamp();renderSheet();return;}
  if(action==='rebirthTab'){updateUI({rebirthTab:d.tab});return;}
  if(action==='talent'){allocation[d.id]=(BigInt(allocation[d.id]||0)+BigInt(d.delta)).toString();rememberScroll();render();return;}
  if(action==='resetPlan'){allocation={};rememberScroll();render();return;}
  if(action==='rebirth'){openSheet('rebirthConfirm');return;}
  if(action==='battleMotion'){localStorage.setItem('ax-battle-motion',d.motion);updateBattleMotion();renderSheet();return;}
  if(action==='cycleSpeed'){
    preferredBattleSpeed=battle.speed=battle.speed===4?1:battle.speed*2;
    try { localStorage.setItem('ax-battle-speed',String(preferredBattleSpeed)); } catch {}
    el.textContent=battle.speed+'×';return;
  }
  if(action==='retreat'){openSheet('retreat',{next:'tasks'});return;}
  if(action==='battleUnit'){openSheet('battleUnit',{unit:d.unit});return;}
  if(client.pending){toast('请先重试同步');return;}
  const payload={type:action};
  if(action==='start'){client.acknowledgePresentation();payload.taskId=d.task;}
  if(action==='formation')payload.formation=[...formationDraft];
  if(action==='confirmBuff'){if(BUFF_BY_ID[ui.selectedBuff].effect_type==='enhance_owned'){openSheet('enhance');return;}Object.assign(payload,{type:'buff',buff:ui.selectedBuff});}
  if(action==='confirmEnhance')Object.assign(payload,{type:'buff',buff:ui.selectedBuff,target:sheet.data.target});
  if(action==='confirmRebirth')Object.assign(payload,{type:'rebirth',allocation,focus});
  if(action==='confirmSalvage')Object.assign(payload,{type:'salvage',items:sheet.data.items,quality:sheet.data.quality,expectedCoins:sheet.data.expectedCoins});
  if(action==='confirmRetreat'){saveBattleReport('retreat');Object.assign(payload,{type:'abandon',challengeId:battle?.challenge.id});}
  if(action==='equipBest')payload.hero=ui.selectedHero;
  if(['star','exchange','recycleShards'].includes(action))payload.hero=d.hero;
  if(action==='recycleShards')payload.count=state.heroes[d.hero].shards;
  if(['equip','unequip'].includes(action))Object.assign(payload,{hero:ui.selectedHero,slot:Number(d.slot)});
  if(['equip','lock','upgrade'].includes(action))payload.item=d.item;
  if(['recruit','upgrade'].includes(action))payload.count=Number(d.count);
  if(action==='selectEquipment')Object.assign(payload,{taskId:d.task,templateId:d.template});
  await mutate(payload);
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el&&!el.disabled)handle(el.dataset.action,el).catch(error=>toast(error.message));});
setInterval(()=>{if(!state||state.schema!==SCHEMA||ui.view!=='home')return;const r=idlePreview(state,client.now());const gold=document.querySelector('#idle-gold'),recruit=document.querySelector('#idle-recruit');if(gold)gold.textContent=money(r.gold);if(recruit)recruit.textContent='招募点 '+money(r.recruit);const g=idleGearPreview(state,client.now()),count=document.querySelector('#idle-gear-count'),time=document.querySelector('#idle-gear-time');if(count)count.textContent=g.count+'/48';if(time)time.textContent=idleGearTime(g);const claim=root.querySelector('[data-action=claimGear]');if(claim)claim.disabled=busy||!g.count;},1000);
// Match the visible viewport when a phone keyboard reduces the available space.
function fitViewport(){if(!visualViewport||visualViewport.scale!==1){document.documentElement.style.removeProperty('--visible-height');return;}document.documentElement.style.setProperty('--visible-height',visualViewport.height+'px');}
window.visualViewport?.addEventListener('resize',fitViewport);fitViewport();
window.addEventListener('resize',fitViewport);
if(selectedMode())connect(selectedMode());else welcome();
