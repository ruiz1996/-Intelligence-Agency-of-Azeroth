// Shared, dependency-free rules. Cloud actions run here on the server;
// browser combat deliberately trusts victory reports for this private demo.
export const RULE_VERSION = 1;
export const MAX_STAGE = 12;
export const MAX_INVENTORY = 240;
export const BATTLE_LIMIT = 90;
export const SLOT_NAMES = ['主手','副手','头盔','肩部','衣服','裤子','腰带','护手','鞋子','戒指1','戒指2','项链','饰品1','饰品2','披风'];
export const QUALITY = ['普通','优秀','稀有','史诗','传说'];
export const HEROES = [
  { id:'yan', name:'岩灯', mark:'岩', role:'守护', color:'#d5ab67', hp:620, atk:38, def:30, interval:2.8, cd:10, skill:'不灭壁垒', detail:'为自己恢复 18% 最大生命，并获得护盾。', kind:'guard' },
  { id:'ling', name:'铃弦', mark:'铃', role:'治疗', color:'#73cbb0', hp:380, atk:37, def:15, interval:2.7, cd:8, skill:'回春之歌', detail:'治疗生命比例最低的队友，恢复攻击的 280%。', kind:'heal' },
  { id:'jin', name:'烬羽', mark:'烬', role:'群攻', color:'#ed8b72', hp:370, atk:57, def:12, interval:2.3, cd:9, skill:'余烬风暴', detail:'对所有敌人造成攻击的 125% 伤害。', kind:'aoe' },
  { id:'shuo', name:'朔影', mark:'朔', role:'收割', color:'#ad9bec', hp:390, atk:67, def:13, interval:2.1, cd:8, skill:'月下追猎', detail:'攻击生命比例最低的敌人，造成攻击的 260% 伤害。', kind:'execute' },
  { id:'lan', name:'岚盾', mark:'岚', role:'援护', color:'#80b9df', hp:540, atk:41, def:25, interval:2.6, cd:11, skill:'归途之盾', detail:'为全队提供相当于自身攻击 160% 的护盾。', kind:'shield' },
];
export const BUFFS = [
  {id:'fury',name:'余火',text:'全队攻击 +12%',stat:'atk',value:.12},
  {id:'vigor',name:'长青',text:'全队生命 +15%',stat:'hp',value:.15},
  {id:'stone',name:'磐石',text:'全队防御 +20%',stat:'def',value:.20},
  {id:'focus',name:'洞悉',text:'全队暴击率 +8%',stat:'crit',value:.08},
  {id:'edge',name:'锋芒',text:'全队暴击伤害 +20%',stat:'critDamage',value:.20},
  {id:'tempo',name:'疾行',text:'全队普攻间隔缩短 8%',stat:'haste',value:.08},
];
export const AFFIX_NAMES = {atk:'攻击',hp:'生命',def:'防御',crit:'暴击率',critDamage:'暴击伤害'};
export const DUNGEONS = {
  idle:{name:'余火远征',label:'挂机收益',description:'推进关卡，提高金币和招募点的挂机产速。',symbol:'I'},
  gear:{name:'遗落锻炉',label:'装备副本',description:'寻找更高品质、更合适词条的装备。',symbol:'II'},
  rogue:{name:'回响秘境',label:'肉鸽强化',description:'首次通过本轮节点后，选择一份全队强化。',symbol:'III'},
};
export class GameError extends Error {constructor(message){super(message);this.name='GameError';}}
const requireRule = (test, message) => { if (!test) throw new GameError(message); };
export const clone = value => structuredClone(value);
export function random() { const n = new Uint32Array(1); crypto.getRandomValues(n); return n[0] / 4294967296; }
export const uid = () => crypto.randomUUID();
const pick = (arr,rng) => arr[Math.floor(rng()*arr.length)];
const integer = (n,min,max) => Number.isInteger(n) && n>=min && n<=max;
export function lootOdds(stage) {
  return stage>=9 ? [.05,.15,.35,.35,.10] : stage>=5 ? [.25,.35,.25,.13,.02] : [.55,.30,.12,.03,0];
}
export function makeItem(stage=1,rng=random,slot=null,forcedQuality=null) {
  const odds=lootOdds(stage); let q=forcedQuality;
  if(q===null){let n=rng();q=4;for(let i=0;i<odds.length;i++){n-=odds[i];if(n<0){q=i;break;}}}
  slot=slot??Math.floor(rng()*15);
  const tier=1+Math.floor((stage-1)/4);
  const pool=slot===0 ? ['atk','crit','critDamage','hp'] : slot>=9&&slot<=13 ? ['atk','crit','critDamage','hp','def'] : ['hp','def','atk','critDamage'];
  const affixes=[];
  for(let i=0;i<q;i++){
    const stat=pool.splice(Math.floor(rng()*pool.length),1)[0];
    const base=stat==='crit'?.01:stat==='critDamage'?.04:.02;
    const value=Math.round((base*tier+base*rng()*2)*1000)/1000;
    affixes.push({stat,value});
  }
  const twoHand=slot===0&&rng()<.28;
  return {id:uid(),slot,quality:q,level:1,tier,affixes,twoHand,setId:null,invested:0,name:twoHand?'旅誓·双手刃':`${['旧旅','青纹','星铸','暮辉','永昼'][q]}·${SLOT_NAMES[slot]}`};
}
export function createState(now=Date.now()) {
  const s={schema:1,cycle:1,rebirths:0,gold:1600,recruit:500,lastIdleAt:now,idleCarry:{gold:0,recruit:0},
    heroes:Object.fromEntries(HEROES.map((h,i)=>[h.id,{owned:i<3,star:1,shards:0}])),
    formation:['yan',null,null,'ling','jin',null],items:[],equipment:Object.fromEntries(HEROES.map(h=>[h.id,Array(15).fill(null)])),
    progress:{idle:0,gear:0,rogue:0},firsts:[],buffs:[],claimed:[],pendingBuff:null,challenge:null,history:[]};
  for(const hero of HEROES.slice(0,3))for(const slot of [0,4]){
    const item=makeItem(1,()=>.5,slot,1);s.items.push(item);s.equipment[hero.id][slot]=item.id;
  }
  return s;
}
export function idleRates(s){return {gold:12+s.progress.idle*4,recruit:1+Math.floor(s.progress.idle/3)*.5};}
export function idlePreview(s,now=Date.now()){
  const minutes=Math.max(0,Math.min(8*60,(now-s.lastIdleAt)/60000));const rate=idleRates(s);
  const gold=minutes*rate.gold+(s.idleCarry?.gold||0),recruit=minutes*rate.recruit+(s.idleCarry?.recruit||0);
  return {gold:Math.floor(gold+1e-9),recruit:Math.floor(recruit+1e-9),minutes,goldExact:gold,recruitExact:recruit};
}
function claimIdle(s,now){const reward=idlePreview(s,now);s.gold+=reward.gold;s.recruit+=reward.recruit;s.idleCarry={gold:Math.max(0,reward.goldExact-reward.gold),recruit:Math.max(0,reward.recruitExact-reward.recruit)};s.lastIdleAt=now;return {gold:reward.gold,recruit:reward.recruit};}
export function baseItemStats(item){
  const scale=(1+(item.level-1)*.24)*(1+item.quality*.06);
  const slot=item.slot;
  if(slot===0)return {atk:Math.round((item.twoHand?19:12)*scale)};
  if(slot===1)return {hp:Math.round(24*scale),def:Math.round(4*scale)};
  if(slot>=9&&slot<=13)return {atk:Math.round(4*scale),hp:Math.round(12*scale)};
  return {hp:Math.round(24*scale),def:Math.round(3*scale)};
}
export function heroStats(s,id){
  const hero=HEROES.find(h=>h.id===id);const record=s.heroes[id];
  const mult=1+(record.star-1)*.16;
  const result={hp:hero.hp*mult,atk:hero.atk*mult,def:hero.def*mult,crit:.05,critDamage:1.5,haste:0};
  const bonus={hp:0,atk:0,def:0,crit:0,critDamage:0,haste:0};
  for(const itemId of s.equipment[id]){
    const item=s.items.find(i=>i.id===itemId);if(!item)continue;
    for(const [stat,v]of Object.entries(baseItemStats(item)))result[stat]+=v;
    for(const a of item.affixes)bonus[a.stat]+=a.value;
  }
  for(const id of s.buffs){const b=BUFFS.find(b=>b.id===id);bonus[b.stat]+=b.value;}
  const bond=s.formation.includes('yan')&&s.formation.includes('ling');
  if(bond)bonus.hp+=.08;
  const permanent=s.rebirths*.05;
  for(const key of ['hp','atk','def'])result[key]=Math.round(result[key]*(1+bonus[key]+permanent));
  result.crit=Math.min(.75,result.crit+bonus.crit);result.critDamage=Math.min(3,result.critDamage+bonus.critDamage);result.haste=Math.min(.5,bonus.haste);
  return result;
}
export function teamPower(s){return s.formation.filter(Boolean).reduce((sum,id)=>{const n=heroStats(s,id);return sum+Math.round(n.hp/5+n.atk*3+n.def*2);},0);}
export function upgradeCost(item){return Math.round((16+item.level*7)*(1+item.quality*.2));}
export function starCost(hero){return hero.star*20;}
function log(s,text,now){s.history.unshift({text,at:now});s.history=s.history.slice(0,30);}
function getItem(s,id){const item=s.items.find(i=>i.id===id);requireRule(item,'装备不存在');return item;}
function heroOwned(s,id){requireRule(s.heroes[id]?.owned,'尚未拥有该角色');}
function detach(s,itemId){for(const row of Object.values(s.equipment))for(let i=0;i<row.length;i++)if(row[i]===itemId)row[i]=null;}
export function act(input,action,now=Date.now(),rng=random){
  const s=clone(input);requireRule(s.schema===1,'存档版本不兼容');requireRule(action&&typeof action.type==='string','操作无效');let result={};
  switch(action.type){
    case 'claim': result=claimIdle(s,now);log(s,`领取挂机：${result.gold} 金币、${result.recruit} 招募点`,now);break;
    case 'formation':{
      const f=action.slots;requireRule(Array.isArray(f)&&f.length===6,'阵容需要 6 个位置');
      const ids=f.filter(v=>v!==null);requireRule(ids.length>=1&&ids.length<=5,'上场人数必须为 1–5 人');
      requireRule(new Set(ids).size===ids.length,'同一角色不能重复上场');ids.forEach(id=>heroOwned(s,id));s.formation=f;break;
    }
    case 'recruit':{
      const count=action.count;requireRule(count===1||count===10,'请选择单次或十连招募');requireRule(s.recruit>=count*100,'招募点不足');s.recruit-=count*100;
      result.draws=[];for(let i=0;i<count;i++){const hero=pick(HEROES,rng),entry=s.heroes[hero.id];const isNew=!entry.owned;
        if(isNew)entry.owned=true;else entry.shards+=10;result.draws.push({id:hero.id,isNew});}
      log(s,`招募 ${count} 次：${result.draws.map(d=>HEROES.find(h=>h.id===d.id).name+(d.isNew?'（新）':' +10 碎片')).join('、')}`,now);break;
    }
    case 'star':{
      heroOwned(s,action.hero);const h=s.heroes[action.hero];requireRule(h.star<3,'Demo 星级上限为 3 星');const cost=starCost(h);requireRule(h.shards>=cost,'角色碎片不足');h.shards-=cost;h.star++;break;
    }
    case 'upgrade':{
      const item=getItem(s,action.item);requireRule(action.count===1||action.count===5,'升级次数无效');let spent=0,levels=0;
      for(let i=0;i<action.count&&item.level<30;i++){const cost=upgradeCost(item);if(s.gold<cost)break;s.gold-=cost;spent+=cost;item.invested+=cost;item.level++;levels++;}
      requireRule(levels>0,item.level>=30?'Demo 装备等级上限为 30':'金币不足');result={spent,levels};break;
    }
    case 'equip':{
      heroOwned(s,action.hero);const item=getItem(s,action.item);detach(s,item.id);const row=s.equipment[action.hero];
      if(item.slot===1){const main=s.items.find(i=>i.id===row[0]);if(main?.twoHand)row[0]=null;}
      if(item.twoHand)row[1]=null;row[item.slot]=item.id;break;
    }
    case 'unequip':heroOwned(s,action.hero);requireRule(integer(action.slot,0,14),'槽位无效');s.equipment[action.hero][action.slot]=null;break;
    case 'salvage':{
      const item=getItem(s,action.item);requireRule(!Object.values(s.equipment).some(row=>row.includes(item.id)),'请先卸下这件装备');
      const gold=item.invested+15*(item.quality+1);s.gold+=gold;s.items=s.items.filter(i=>i.id!==item.id);result={gold};break;
    }
    case 'start':{
      requireRule(Object.hasOwn(DUNGEONS,action.dungeon),'副本不存在');requireRule(integer(action.stage,1,MAX_STAGE),'关卡无效');
      requireRule(action.stage<=s.progress[action.dungeon]+1,'请先通过前一关');requireRule(s.formation.some(Boolean),'请先安排上场角色');
      requireRule(!s.pendingBuff,'请先选择待领取的肉鸽强化');
      requireRule(action.dungeon!=='gear'||s.items.length<MAX_INVENTORY,'背包已满，请先分解装备');
      s.challenge={id:uid(),dungeon:action.dungeon,stage:action.stage,cycle:s.cycle,startedAt:now,rule:RULE_VERSION,
        seed:Math.floor(rng()*4294967296),heroes:s.formation.map((id,slot)=>id?{...HEROES.find(h=>h.id===id),...heroStats(s,id),slot}:null).filter(Boolean)};
      result={challenge:s.challenge};break;
    }
    case 'settle':{
      const c=s.challenge;requireRule(c&&c.id===action.challenge,'挑战已失效，请重新进入');requireRule(c.cycle===s.cycle,'挑战不属于当前重生轮次');
      requireRule(action.outcome==='win'||action.outcome==='loss','结算结果无效');
      s.challenge=null;result={outcome:action.outcome,dungeon:c.dungeon,stage:c.stage,gold:0,recruit:0};
      if(action.outcome==='loss'){log(s,`${DUNGEONS[c.dungeon].name} ${c.stage} 层挑战失败`,now);break;}
      const firstKey=`${c.dungeon}:${c.stage}`;
      if(c.dungeon==='idle')claimIdle(s,now); // Settle the old income rate before progression changes it.
      s.progress[c.dungeon]=Math.max(s.progress[c.dungeon],c.stage);
      result.gold=65+c.stage*25;result.recruit=c.dungeon==='gear'?8+c.stage*2:0;
      if(!s.firsts.includes(firstKey)){s.firsts.push(firstKey);result.recruit+=40;result.first=true;}
      s.gold+=result.gold;s.recruit+=result.recruit;
      if(c.dungeon==='gear'){
        requireRule(s.items.length<MAX_INVENTORY,'背包已满，请分解后重试结算');
        const item=makeItem(c.stage,rng);s.items.push(item);result.item=item;
      }
      if(c.dungeon==='rogue'&&!s.claimed.includes(c.stage)){
        const pool=[...BUFFS];const options=[];for(let i=0;i<3;i++)options.push(pool.splice(Math.floor(rng()*pool.length),1)[0].id);
        s.pendingBuff={stage:c.stage,options};result.buff=true;
      }
      log(s,`通关 ${DUNGEONS[c.dungeon].name} ${c.stage} 层 · +${result.gold} 金币${result.item?' · '+result.item.name:''}`,now);break;
    }
    case 'buff':{
      requireRule(s.pendingBuff?.options.includes(action.buff),'强化选项已失效');
      requireRule(!s.claimed.includes(s.pendingBuff.stage),'该节点已领取');s.claimed.push(s.pendingBuff.stage);s.buffs.push(action.buff);s.pendingBuff=null;break;
    }
    case 'rebirth':{
      requireRule(s.progress.idle>=6,'通关远征第 6 层后可重生');requireRule(!s.pendingBuff,'请先选择强化');claimIdle(s,now);
      s.cycle++;s.rebirths++;s.gold=1600;s.idleCarry.gold=0;s.progress={idle:0,gear:0,rogue:0};s.buffs=[];s.claimed=[];s.challenge=null;
      for(const item of s.items){item.level=1;item.invested=0;}result={cycle:s.cycle};log(s,`开启第 ${s.cycle} 轮旅途，永久基础属性 +${s.rebirths*5}%`,now);break;
    }
    default:throw new GameError('未知操作');
  }
  return {state:s,result};
}
export function seededRandom(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function makeEnemies(stage,dungeon='idle'){
  const scale=Math.pow(1.16,stage-1)*(dungeon==='rogue'?1.08:1);
  let layout;
  if(stage%3===0)layout=[{name:'遗迹领主',kind:'boss',x:1,row:1,w:2,h:2},{name:'岩壳卫',kind:'mob',x:0,row:0,w:1,h:1},{name:'岩壳卫',kind:'mob',x:3,row:0,w:1,h:1}];
  else if(stage%2===0)layout=[{name:'重甲督卫',kind:'elite',x:1,row:0,w:2,h:1},{name:'灰烬兽',kind:'mob',x:0,row:1,w:1,h:1},{name:'灰烬兽',kind:'mob',x:3,row:1,w:1,h:1}];
  else layout=[0,1,3].map(x=>({name:'灰烬兽',kind:'mob',x,row:0,w:1,h:1}));
  return layout.map((e,i)=>{const elite=e.kind==='elite',boss=e.kind==='boss';return {...e,id:`enemy-${i}`,hp:Math.round((boss?760:elite?390:200)*scale),atk:Math.round((boss?65:elite?47:30)*scale),def:Math.round((boss?20:elite?14:8)*scale),interval:boss?2.8:2.6,cd:boss?9:elite?12:999};});
}
function distance(a,b){return (a.x-b.x)**2+(a.y-b.y)**2;}
export function chooseTarget(attacker,targets){
  const live=targets.filter(t=>t.hp>0);if(!live.length)return null;
  const front=Math.min(...live.map(t=>t.row));
  return live.filter(t=>t.row===front).sort((a,b)=>distance(attacker,a)-distance(attacker,b)||a.order-b.order)[0];
}
export function simulate(challenge){
  const rng=seededRandom(challenge.seed);
  const heroes=challenge.heroes.map((h,i)=>({...h,side:'hero',maxHp:h.hp,shield:0,x:(h.slot%3)*1.5+.5,y:1+Math.floor(h.slot/3),row:Math.floor(h.slot/3),order:i,next:0.7+i*.17,skillAt:h.cd}));
  const enemies=makeEnemies(challenge.stage,challenge.dungeon).map((e,i)=>({...e,side:'enemy',maxHp:e.hp,shield:0,x:e.x+(e.w-1)/2,y:-1-e.row-(e.h-1)/2,order:i,crit:.03,critDamage:1.5,haste:0,next:1.1+i*.23,skillAt:e.cd}));
  const units=[...heroes,...enemies],events=[];let outcome='loss',elapsed=BATTLE_LIMIT;
  const frame=(time,text,actor=null,targets=[])=>events.push({time:Math.round(time*10)/10,text,actor,targets,units:units.map(u=>({id:u.id,hp:Math.max(0,Math.round(u.hp)),shield:Math.round(u.shield)}))});
  function damage(a,b,mult){
    const crit=rng()<a.crit;let amount=Math.max(1,Math.round(a.atk*mult*100/(100+b.def)*(crit?a.critDamage:1)));
    const absorb=Math.min(b.shield,amount);b.shield-=absorb;amount-=absorb;b.hp=Math.max(0,b.hp-amount);return amount;
  }
  frame(0,'战斗开始');
  for(let tick=1;tick<=BATTLE_LIMIT*10;tick++){
    const time=tick/10;
    for(const a of units){
      if(a.hp<=0)continue;const friends=(a.side==='hero'?heroes:enemies).filter(u=>u.hp>0),foes=(a.side==='hero'?enemies:heroes).filter(u=>u.hp>0);
      if(!foes.length)break;
      if(time>=a.skillAt){
        a.skillAt+=a.cd;let targets=[];
        if(a.kind==='heal'){const t=[...friends].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0];t.hp=Math.min(t.maxHp,t.hp+a.atk*2.8);targets=[t.id];}
        else if(a.kind==='guard'){a.hp=Math.min(a.maxHp,a.hp+a.maxHp*.18);a.shield+=a.atk*2;targets=[a.id];}
        else if(a.kind==='shield'){for(const t of friends){t.shield=Math.min(t.maxHp,t.shield+a.atk*1.6);targets.push(t.id);}}
        else if(a.kind==='aoe'||a.kind==='boss'){for(const t of foes){damage(a,t,a.kind==='boss'?.9:1.25);targets.push(t.id);}}
        else {const t=a.kind==='execute'?[...foes].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0]:chooseTarget(a,foes);damage(a,t,a.kind==='execute'?2.6:1.8);targets=[t.id];}
        frame(time,`${a.name} · ${a.skill||'震击'}`,a.id,targets);
      }else if(time>=a.next){
        a.next=time+a.interval*(1-(a.haste||0));const target=chooseTarget(a,foes);const amount=damage(a,target,1);
        frame(time,`${a.name} → ${target.name} · ${amount}`,a.id,[target.id]);
      }
      if(!enemies.some(u=>u.hp>0)||!heroes.some(u=>u.hp>0))break;
    }
    if(!heroes.some(u=>u.hp>0)){elapsed=time;break;}
    if(!enemies.some(u=>u.hp>0)){outcome='win';elapsed=time;break;}
  }
  frame(elapsed,outcome==='win'?'敌人已全灭':heroes.some(u=>u.hp>0)?'挑战超时':'我方全灭');
  return {heroes,enemies,events,outcome,elapsed};
}
