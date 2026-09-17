import { DATA, RULE_VERSION, SCHEMA, HEROES, HERO_BY_ID, TASKS, CATALOG, TEMPLATE_BY_ID, MAX_INVENTORY, BUFF_BY_ID, TALENTS, TALENT_BY_ID, templateSlots, talentBonus, chosenBuffs, taskUnlocked } from './catalog.js';
import { GameError, requireRule, clone, uid, random, weighted, natural, SCALE, decimalUnits, walletUnits, credit, spend, ceilDiv } from './primitives.js';
import { makeItem, canEquip, upgradeCost, rollEquipment, salvageValue, templateAvailable } from './equipment.js';
import { heroStats } from './stats.js';
import { recommendEquipment } from './equipment-recommendation.js';
import { upgradeState } from './state-upgrades.js';
import { WEAPON_REVISION } from './equipment-expansion.js';
import {simulate} from './combat.js';
import {gearRewardBand} from './battle-rules.js';
import {GROWTH_REVISION} from './growth-rules.js';
import {initGrowthIncome,recordGoldIncome,growthPayout} from './rewind-growth.js';
import {breakthroughRecord,purchaseBreakthrough} from './hero-breakthrough.js';
export * from './rewind-growth.js';
export * from './hero-breakthrough.js';
export {GROWTH_REVISION} from './growth-rules.js';
export { WEAPON_REVISION } from './equipment-expansion.js';
import { initIdleGear, settleIdleGear, updateIdleGearSource, claimIdleGear } from './idle-equipment.js';
export * from './equipment-recommendation.js';
export * from './idle-equipment.js';
export {needsStateUpgrade} from './state-upgrades.js';
export * from './catalog.js';
export * from './primitives.js';
export * from './equipment.js';
export * from './stats.js';
export { simulate, simulateChunks, chooseTarget } from './combat.js';
const log=(s,text,now)=>{s.history.unshift({at:now,text});s.history=s.history.slice(0,30);};
export function createState(now=Date.now()) {
  const s={schema:SCHEMA,rule:RULE_VERSION,cycle:1,rebirths:0,wallet:{gold:decimalUnits(1600).toString(),recruit:decimalUnits(500).toString()},lastIdleAt:now,
    heroes:Object.fromEntries(HEROES.map((h,i)=>[h.id,{owned:i<3,star:1,shards:0}])),
    formation:['yan',null,null,'ling','jin',null],items:[],equipment:Object.fromEntries(HEROES.map(h=>[h.id,Array(15).fill(null)])),
    progress:{idle:0,gear:0,rogue:0},firsts:[],runClears:[],historyContribution:[],pendingHistoryContribution:[],buffs:[],enhancedBuff:null,
    pendingBuff:null,pendingEquipment:[],challenge:null,history:[],points:'0',pointRemainder:'0',talents:{},rebirthPlan:null,migrations:{}};
  for(const spec of DATA.initial.equipment) {
    const hero=HEROES.find(h=>h.name===spec.character),template=DATA.equipment.templates115.find(t=>t.tier===1&&t.slot===spec.template);
    const item=makeItem(template.id,0);s.items.push(item);s.equipment[hero.id][templateSlots(template)[0]]=item.id;
  }
  s.migrations[WEAPON_REVISION]={at:now,report:[]};s.migrations[GROWTH_REVISION]={at:now,refundedPoints:'0',refunded:{},incomeMode:'gold'};
  for(const h of HEROES)s.heroes[h.id].breakthrough=breakthroughRecord(s,h.id);
  initGrowthIncome(s);initIdleGear(s,now);return s;
}
export function idleRates(s) {
  const r=CATALOG.idle[s.progress.idle-1]?.rewards;
  return {gold:(r?.idleGoldPerMinute??20)*(1+talentBonus(s,'idle_gold_pct')),recruit:(r?.idleRecruitPerMinute??.5)*(1+talentBonus(s,'idle_recruit_pct'))};
}
export function idlePreview(s,now=Date.now()) {
  const elapsed=Math.max(0,Math.trunc(now)-s.lastIdleAt);requireRule(Number.isSafeInteger(elapsed),'时间超出范围');
  const r=CATALOG.idle[s.progress.idle-1]?.rewards;
  const goldRate=BigInt(Math.round((r?.idleGoldPerMinute??20)*100000)),recruitRate=BigInt(Math.round((r?.idleRecruitPerMinute??.5)*100000));
  return {elapsed,gold:(goldRate*BigInt(100+Math.round(talentBonus(s,'idle_gold_pct')*100))*BigInt(elapsed)).toString(),recruit:(recruitRate*BigInt(100+Math.round(talentBonus(s,'idle_recruit_pct')*100))*BigInt(elapsed)).toString()};
}
function claimIdle(s,now) {
  const reward=idlePreview(s,now);for(const key of ['gold','recruit'])s.wallet[key]=(walletUnits(s,key)+BigInt(reward[key])).toString();
  recordGoldIncome(s,reward.gold);
  s.lastIdleAt=Math.max(s.lastIdleAt,Math.trunc(now));return reward;
}
export function pointCost(id,level) {
  const t=TALENT_BY_ID[id];requireRule(t,'加点节点不存在');const l=natural(level,1n);
  if(t.max_level!==null){requireRule(l<=BigInt(t.max_level),'已达该功能上限');return BigInt(t.costs[Number(l)-1]);}
  return ceilDiv(l*l+4n*l+16n,2n);
}
function totalPointCost(id,level) {
  const l=natural(level),t=TALENT_BY_ID[id];requireRule(t,'加点节点不存在');
  if(t.max_level!==null){requireRule(l<=BigInt(t.max_level),'已达该功能上限');return t.costs.slice(0,Number(l)).reduce((n,c)=>n+BigInt(c),0n);}
  return (l*(l+1n)*(2n*l+1n)/6n+2n*l*(l+1n)+16n*l+(l+1n)/2n)/2n;
}
export function rebirthPreview(s,now=s.lastIdleAt) {
  return growthPayout(s,idlePreview(s,now).gold);
}
export function allocationPreview(s,allocation=null,now=s.lastIdleAt) {
  const payout=rebirthPreview(s,now),oldPaid=Object.values(s.talents).reduce((n,t)=>n+BigInt(t.paid),0n),budget=BigInt(s.points)+BigInt(payout.points)+oldPaid;
  if(allocation===null)return {talents:clone(s.talents),budget:budget.toString(),spent:oldPaid.toString(),remaining:(budget-oldPaid).toString(),carry:true};
  const next=allocation;requireRule(next&&typeof next==='object'&&!Array.isArray(next),'加点方案无效');
  let spent=0n;const talents={};
  for(const [id,level]of Object.entries(next)) {
    const l=natural(level);requireRule(TALENT_BY_ID[id],'加点节点不存在');if(!l)continue;
    const previous=s.talents[id],oldLevel=natural(previous?.level||0);
    const paid=previous&&l>=oldLevel?BigInt(previous.paid)+totalPointCost(id,l)-totalPointCost(id,oldLevel):totalPointCost(id,l);
    spent+=paid;talents[id]={level:l.toString(),paid:paid.toString()};
  }
  requireRule(spent<=budget,`下轮方案还差${spent-budget}点`);return {talents,budget:budget.toString(),spent:spent.toString(),remaining:(budget-spent).toString()};
}
function grantHero(s,id) { const h=s.heroes[id];if(h.owned){h.shards+=10;return {hero:id,shards:10};}h.owned=true;h.star=1;return {hero:id,new:true}; }
function space(s,count=1) { requireRule(s.items.length+s.pendingEquipment.length+count<=MAX_INVENTORY,'背包空间不足，请先分解未穿戴且未锁定的装备'); }
function owned(s,id) { requireRule(HERO_BY_ID[id]&&s.heroes[id].owned,'未拥有该特工');return s.heroes[id]; }
function itemById(s,id) { const item=s.items.find(i=>i.id===id);requireRule(item,'装备不存在');return item; }
export function completeRoster(old,now=Date.now(),rng=random) {return upgradeState(old,now,rng);}
export function migrateState(old,now=Date.now()) {
  if(old.schema===SCHEMA)return completeRoster(old,now);requireRule(old.schema===1,'档案版本不受支持，原档已保留');
  const s=createState(now),report=[];s.items=[];for(const id in s.equipment)s.equipment[id].fill(null);
  s.migrations={baseline2:{at:now,snapshot:clone(old),report},rebirth_points_v1:true,[WEAPON_REVISION]:{at:now,report:[]}};s.cycle=old.cycle||1;s.rebirths=Number.isSafeInteger(old.rebirths)&&old.rebirths>=0?old.rebirths:0;
  if(!Number.isSafeInteger(old.rebirths)||old.rebirths<0)report.push('旧重生次数缺失或无效，保留原快照待核对，未推算补点。');
  s.points=(48n*BigInt(s.rebirths)).toString();s.wallet.gold=decimalUnits(old.gold||0).toString();s.wallet.recruit=decimalUnits(old.recruit||0).toString();
  const minutes=Math.max(0,Math.min(480,(now-(old.lastIdleAt??now))/60000));
  for(const [key,rate]of [['gold',12+(old.progress?.idle||0)*4],['recruit',1+Math.floor((old.progress?.idle||0)/3)*.5]]){
    const value=minutes*rate+(old.idleCarry?.[key]||0);s.wallet[key]=(walletUnits(s,key)+decimalUnits(value.toFixed(10))).toString();
  }
  for(const h of HEROES)if(old.heroes?.[h.id])s.heroes[h.id]=clone(old.heroes[h.id]);
  s.formation=Array.from({length:6},(_,i)=>old.formation?.[i]&&s.heroes[old.formation[i]]?.owned?old.formation[i]:null);if(!s.formation.some(Boolean))s.formation[0]='yan';
  const slots=[0,8,10,11,12,13,14,15,16,17,18,19,20,21,22];
  for(const item of old.items||[]) {
    const owner=Object.keys(old.equipment||{}).find(id=>(old.equipment[id]||[]).includes(item.id));let templateIndex=slots[item.slot]??0;
    if(item.slot===0){const type=item.twoHand?'双手剑':(HERO_BY_ID[owner]?.weapons.main[0]||'单手剑');templateIndex=DATA.equipment.baseTemplates.find(t=>t.slot===type)?.id??0;}
    const next=makeItem(`G1-T${String(templateIndex).padStart(2,'0')}`,Math.max(0,Math.min(4,item.quality||0)),()=>.5),scale=(1+(item.level-1)*.24)*(1+item.quality*.06);
    const legacyFlat=item.slot===0?{atk:Math.round((item.twoHand?19:12)*scale)}:item.slot===1?{hp:Math.round(24*scale),def:Math.round(4*scale)}:item.slot>=9&&item.slot<=13?{atk:Math.round(4*scale),hp:Math.round(12*scale)}:{hp:Math.round(24*scale),def:Math.round(3*scale)};
    Object.assign(next,{id:item.id,level:String(item.level||1),legacyLevel:String(item.level||1),legacyFlat,legacyName:item.name,locked:Boolean(item.locked),affixes:clone(item.affixes||[]),invested:String(item.invested||0)});s.items.push(next);
    if(owner&&s.equipment[owner]&&canEquip(s,owner,next,item.slot))s.equipment[owner][item.slot]=next.id;
  }
  for(const id in s.equipment){const main=s.items.find(i=>i.id===s.equipment[id][0]);if(main&&TEMPLATE_BY_ID[main.templateId].twoHand)s.equipment[id][1]=null;}
  report.push('旧五名特工按稳定ID映射岗位，保留星级/碎片；旧装备保留实例、品质、词条、等级与实付台账，固定属性以迁移前快照延续。');
  report.push('旧任务进度、肉鸽和首通封存在快照；新目录从头开始，不发新首通或AX05资格。旧自动5%奖励已由48×有效旧重生次数的回溯点替代，不叠加。');
  report.push('武器按新许可映射；不兼容副手卸回背包。旧未结算挑战封存；原奖励已成功结算的货币与装备保留。');log(s,'档案已升级：旧档快照完整保留，可导出核对。',now);
  s.migrations[GROWTH_REVISION]={at:now,refundedPoints:'0',refunded:{},incomeMode:'gold'};return completeRoster(s,now);
}
export function act(input,action,now=Date.now(),rng=random) {
  requireRule(action&&typeof action==='object','操作无效');if(action.type==='migrate')return {state:migrateState(input,now),result:{migrated:input.schema!==SCHEMA}};
  requireRule(input.schema===SCHEMA,'请先升级档案，旧档将完整保留');const s=completeRoster(input,now,rng);s.rule=RULE_VERSION;let result={};settleIdleGear(s,now,rng);
  switch(action.type) {
    case 'claim': result={...claimIdle(s,now),...claimIdleGear(s)};break;
    case 'claimGear': result=claimIdleGear(s);break;
    case 'equipBest': {const recommendation=recommendEquipment(s,action.hero);s.equipment[action.hero]=recommendation.slots;result={equipped:recommendation.changed};break;}
    case 'formation': {const a=action.formation;requireRule(Array.isArray(a)&&a.length===6,'阵容应为六格');const ids=a.filter(Boolean);requireRule(ids.length>=1&&ids.length<=5&&new Set(ids).size===ids.length,'阵容需要一至五名不同特工');ids.forEach(id=>owned(s,id));s.formation=a.map(id=>id||null);break;}
    case 'recruit': {const count=action.count??1;requireRule([1,10].includes(count),'招募次数无效');spend(s,'recruit',100*count);result.recruits=Array.from({length:count},()=>grantHero(s,HEROES[weighted(HEROES.map(()=>1),rng)].id));break;}
    case 'star': {const h=owned(s,action.hero),cost=[20,40,80,120][h.star-1];requireRule(cost&&h.shards>=cost,'碎片不足或已满星');h.shards-=cost;h.star++;break;}
    case 'breakthrough': result=purchaseBreakthrough(s,action);break;
    case 'saveRebirthPlan': {
      requireRule(!s.challenge,'请先结束当前战斗');
      if(action.allocation===null)s.rebirthPlan=null;
      else {allocationPreview(s,action.allocation,now);s.rebirthPlan={allocation:clone(action.allocation),rule:RULE_VERSION,cycle:s.cycle};}
      result={planSaved:!!s.rebirthPlan};break;
    }
    case 'exchange': {const h=owned(s,action.hero);requireRule(h.star<5,'满星特工无需兑换');spend(s,'recruit',300);h.shards+=10;break;}
    case 'recycleShards': {const h=owned(s,action.hero),n=Number(natural(action.count,1n));requireRule(h.star===5&&Number.isSafeInteger(n)&&n<=h.shards,'仅可回收满星特工已有碎片');h.shards-=n;credit(s,'recruit',BigInt(n)*5n);break;}
    case 'equip': {
      const item=itemById(s,action.item),slot=action.slot;requireRule(Number.isInteger(slot)&&canEquip(s,action.hero,item,slot),'部位或武器类型不适用于该特工');
      for(const slots of Object.values(s.equipment))for(let i=0;i<15;i++)if(slots[i]===item.id)slots[i]=null;
      const slots=s.equipment[action.hero];slots[slot]=item.id;if(slot===0&&TEMPLATE_BY_ID[item.templateId].twoHand)slots[1]=null;
      if(slot===1){const main=s.items.find(i=>i.id===slots[0]);if(main&&TEMPLATE_BY_ID[main.templateId].twoHand)slots[0]=null;}break;
    }
    case 'unequip': owned(s,action.hero);requireRule(Number.isInteger(action.slot)&&action.slot>=0&&action.slot<15,'部位无效');s.equipment[action.hero][action.slot]=null;break;
    case 'lock': {const item=itemById(s,action.item);item.locked=!item.locked;break;}
    case 'upgrade': {
      const item=itemById(s,action.item),count=action.count??1;requireRule([1,5,10,100].includes(count),'强化次数无效');let paid=0n,levels=0;
      for(let i=0;i<count;i++){const cost=upgradeCost(item,s);if(walletUnits(s,'gold')<cost*SCALE)break;spend(s,'gold',cost);paid+=cost;item.level=(natural(item.level)+1n).toString();levels++;}
      requireRule(levels>0,'金币不足');item.invested=(BigInt(item.invested)+paid).toString();result={levels,paid:paid.toString()};break;
    }
    case 'salvage': {
      const ids=action.items??[action.item];requireRule(Array.isArray(ids)&&ids.length>0&&ids.length<=600&&new Set(ids).size===ids.length,'分解列表无效');let coins=0n,principal=0n;
      for(const id of ids){const item=itemById(s,id);requireRule(!item.locked&&!Object.values(s.equipment).some(slots=>slots.includes(id)),'锁定或已穿戴的装备不能分解');if(action.quality!==undefined)requireRule(item.quality===action.quality,'分解预览已变化，请重新选择');coins+=salvageValue(item,s);principal+=BigInt(item.invested);}
      if(action.expectedCoins!==undefined)requireRule(coins.toString()===action.expectedCoins,'分解预览已变化，请重新选择');
      s.items=s.items.filter(i=>!ids.includes(i.id));credit(s,'gold',coins);recordGoldIncome(s,(coins-principal)*SCALE);result={coins:coins.toString(),count:ids.length};break;
    }
    case 'start': {
      requireRule(!s.pendingBuff,'请先完成异常强化选择');const task=TASKS[action.taskId];requireRule(task,'任务不存在');requireRule(taskUnlocked(s,task),'请先完成前置任务');
      if(task.kind==='gear')space(s,2+(!s.firsts.includes(task.id)&&task.rewards.historicalSelectableEquipment?1:0));
      const heroes=s.formation.map((id,slot)=>id?{id,slot,...heroStats(s,id)}:null).filter(Boolean);requireRule(heroes.length,'请先编队');
      s.challenge={id:uid(),taskId:task.id,cycle:s.cycle,startedAt:now,rule:RULE_VERSION,balanceRevision:DATA.balanceRevision,seed:Math.floor(rng()*4294967296),heroes,buffs:chosenBuffs(s),bonuses:Object.fromEntries(TALENTS.map(t=>[t.effect,talentBonus(s,t.effect)]))};result={challenge:s.challenge};break;
    }
    case 'abandon': requireRule(s.challenge,'没有进行中的挑战');s.challenge=null;result={abandoned:true};break;
    case 'settle': {
      const c=s.challenge;requireRule(c&&c.id===action.challengeId&&c.cycle===s.cycle,'挑战已结算或失效');requireRule(c.rule===RULE_VERSION&&c.balanceRevision===DATA.balanceRevision,'规则已更新，请重新挑战');requireRule(['win','loss'].includes(action.outcome),'结算结果无效');
      const task=TASKS[c.taskId],r=task.rewards;
      // Timed loot is determined from the saved server-created challenge. Client
      // outcome, elapsed wall time and supplied duration cannot set its tier.
      const verified=task.kind==='gear'?simulate(c,{trace:false}):null;
      if(verified)requireRule(verified.outcome===action.outcome,'战斗结果与规则校验不一致，请刷新后重新挑战');
      s.challenge=null;result={taskId:task.id,outcome:action.outcome,gold:'0',recruit:'0',...(verified?{duration:verified.duration}:{})};if(action.outcome==='loss'){log(s,`${task.name} · 行动失败`,now);break;}
      if(task.kind==='idle')claimIdle(s,now);const first=!s.firsts.includes(task.id),runFirst=!s.runClears.includes(task.id);
      if(runFirst){s.runClears.push(task.id);s.progress[task.kind]=Math.max(s.progress[task.kind],task.index);}
      if(first){s.firsts.push(task.id);if(!s.historyContribution.includes(task.id)){s.historyContribution.push(task.id);s.pendingHistoryContribution.push(task.id);}}
      let gold=r.winGold||0,recruit=r.winRecruitPoints||0;
      if(task.kind==='idle'&&first){gold+=r.historicalUnitBonusGold;recruit+=r.historicalUnitBonusRecruitPoints;if(r.historicalGuaranteedCharacter)result.character=grantHero(s,HEROES.find(h=>h.name===r.historicalGuaranteedCharacter).id);}
      if(task.kind==='gear'){
        const band=gearRewardBand(verified.duration);requireRule(band,'装备奖励时限无效');
        space(s,band.randomEquipmentCount+(first&&r.historicalSelectableEquipment?1:0));
        const items=Array.from({length:band.randomEquipmentCount},()=>rollEquipment(task,s,rng));s.items.push(...items);Object.assign(result,{items,item:items[0],rewardBand:band.id,goldMultiplier:band.normalWinGoldMultiplier});gold*=band.normalWinGoldMultiplier;
        if(first){recruit+=r.historicalFirstClearRecruitPoints;if(r.historicalSelectableEquipment)s.pendingEquipment.push({taskId:task.id,...r.historicalSelectableEquipment});}
      }
      if(task.kind==='rogue'){
        if(first)recruit+=r.historical_first_clear_rewards.recruit_points;
        if(runFirst){const pool=r.choices.filter(b=>b.sampling!=='guaranteed'&&(b.effect_type!=='enhance_owned'||DATA.rogueEnhanceWhitelist.some(w=>s.buffs.includes(w.choice_id))));const options=[];
          while(options.length<2&&pool.length)options.push(pool.splice(weighted(pool.map(b=>b.weight),rng),1)[0].id);
          options.push(r.choices.find(b=>b.sampling==='guaranteed').id);s.pendingBuff={taskId:task.id,options};result.buff=true;}
      }
      credit(s,'gold',gold);recordGoldIncome(s,BigInt(gold)*SCALE);credit(s,'recruit',recruit);Object.assign(result,{first,runFirst,gold:String(gold),recruit:String(recruit)});log(s,`${task.name} · 完成${first?' / 历史首通':''}`,now);break;
    }
    case 'buff': {
      requireRule(s.pendingBuff?.options.includes(action.buff),'强化选项已过期');if(BUFF_BY_ID[action.buff].effect_type==='enhance_owned'){requireRule(s.buffs.includes(action.target)&&DATA.rogueEnhanceWhitelist.some(w=>w.choice_id===action.target),'请选择已有的可精修强化');s.enhancedBuff=action.target;}s.buffs.push(action.buff);s.pendingBuff=null;break;
    }
    case 'selectEquipment': {
      const index=s.pendingEquipment.findIndex(p=>p.taskId===action.taskId),p=s.pendingEquipment[index],t=TEMPLATE_BY_ID[action.templateId];requireRule(p&&t&&templateAvailable(t)&&t.tier===p.tier&&t.group===({武器:'weapon',防具:'armor',首饰:'jewelry'}[p.group]),'不属于该自选装备池');
      requireRule(s.items.length<MAX_INVENTORY,'背包已满');const item=makeItem(t.id,1,rng);s.items.push(item);s.pendingEquipment.splice(index,1);result={item};break;
    }
    case 'rebirth': {
      claimIdle(s,now);const payout=rebirthPreview(s);requireRule(payout.eligible,'本轮完成第五收容任务，并处理待领奖励及挑战后可回溯');
      const allocation=action.allocation===undefined?s.rebirthPlan?.allocation??null:action.allocation;
      if(s.rebirthPlan&&action.allocation===undefined)requireRule(s.rebirthPlan.rule===RULE_VERSION&&s.rebirthPlan.cycle===s.cycle,'下轮方案已过期，请重新保存');
      const plan=allocationPreview(s,allocation);
      if(action.expectedPoints!==undefined)requireRule(payout.points===String(action.expectedPoints),`回溯收益已变化：${action.expectedPoints} → ${payout.points}点，请重新确认`);
      if(action.expectedSpent!==undefined)requireRule(plan.spent===String(action.expectedSpent),'加点费用已变化，请重新确认');
      if(payout.mode==='gold')s.lifetimeSettledEligibleGoldUnits=(BigInt(s.lifetimeSettledEligibleGoldUnits)+BigInt(s.runEarnedGoldUnits)).toString();
      s.rebirthIncome={mode:'gold'};s.runEarnedGoldUnits='0';s.rebirthPlan=null;
      s.points=plan.remaining;s.talents=plan.talents;s.pointRemainder=payout.remainder;s.pendingHistoryContribution=[];s.rebirths++;s.cycle++;s.wallet.gold=decimalUnits(1600).toString();s.progress={idle:0,gear:0,rogue:0};s.runClears=[];s.buffs=[];s.enhancedBuff=null;s.challenge=null;
      for(const item of s.items){item.level='1';item.invested='0';}result={points:payout.points,cycle:s.cycle};log(s,`时间回溯 · 第${s.cycle}轮行动，加点配置已生效`,now);break;
    }
    default:throw new GameError('未知操作');
  }
  updateIdleGearSource(s,now);return {state:s,result};
}
