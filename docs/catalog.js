import { DATA as BASE_DATA } from './data.js';
import {SIX_HEROES,RETIRED_HERO_IDS} from './six-heroes.js';
import { NEW_HEROES } from './new-heroes.js';
import { WEAPON_PERMISSIONS, expandEquipment } from './equipment-expansion.js';
import {applyBattleRules} from './battle-rules.js';
import {applyHeroRework} from './hero-reworks.js';
import {applyFiveStar} from './five-star.js';
import {GROWTH_TALENTS} from './growth-rules.js';
export {BATTLE_LIMITS,gearRewardBand} from './battle-rules.js';
export const RULE_VERSION = 'agency-five-star-11';
const characters=[...BASE_DATA.characters,...NEW_HEROES,...SIX_HEROES].filter(h=>!RETIRED_HERO_IDS.includes(h.id)).map(applyHeroRework).map(applyFiveStar).map(h=>({...h,weapons:WEAPON_PERMISSIONS[h.id]||h.weapons}));
const wudi=characters.find(h=>h.id==='wudi');Object.assign(wudi.passive,{paymentMaxHpFraction:.05,conversionMultiplier:.4,donorCount:4,donor:"全部其他存活队友",paymentFormula:"potential_i=min(0.05*maxHP_i,HP_i-1); scale=min(1,availableShieldCap/(sum(potential_i)*0.4*(1+shieldBonus))); payment_i=potential_i*scale",shieldFormula:"sum(actualHpPaid)*0.4*(1+shieldBonus)"});
export const DATA = {...applyBattleRules(BASE_DATA),characters,permanentTalents:GROWTH_TALENTS,permanentGroupFocus:null,equipment:{...expandEquipment(BASE_DATA.equipment),sameTypeAffixWithinItemAllowed:true,affixSampling:'weighted_with_replacement'},balanceRevision:'five-star-v0.28',requiresBattleEngineVersion:RULE_VERSION,
  recruitment:{...BASE_DATA.recruitment,weights:characters.map(h=>({name:h.name,weight:1,chanceBp:10000/characters.length}))}};
DATA.initial={...DATA.initial,characters:['Kukalon','苏小瑶','哈斯卡'],equipment:DATA.initial.equipment.map(e=>({...e,character:({'门卫':'Kukalon','医务员':'苏小瑶','爆破工':'哈斯卡'})[e.character]||e.character}))};
DATA.resourceStages=DATA.resourceStages.map(t=>{const r=t.rewards;if(!r.historicalGuaranteedCharacter||characters.some(h=>h.name===r.historicalGuaranteedCharacter))return t;return {...t,rewards:{...r,historicalGuaranteedCharacter:null,historicalUnitBonusRecruitPoints:(r.historicalUnitBonusRecruitPoints||0)+100}};});
export const SCHEMA = 2;
export const MAX_INVENTORY = 600;
export const SLOT_NAMES = ['主手','副手','头盔','肩部','衣服','裤子','腰带','护手','鞋子','戒指1','戒指2','项链','饰品1','饰品2','披风'];
export const QUALITY = ['普通','优秀','稀有','史诗','传说'];
export const AFFIX_NAMES = {atk:'攻击',hp:'生命',def:'防御',crit:'暴击率',critDamage:'暴击伤害'};
export const HEROES = DATA.characters;
export const HERO_BY_ID = Object.fromEntries(HEROES.map(h=>[h.id,h]));
export const TEMPLATES = DATA.equipment.templates115;
export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map(t=>[t.id,t]));
export const DUNGEONS = {idle:{name:'资源行动',description:'推进星球资源任务，提高无限离线收益。'},gear:{name:'装备行动',description:'收集五系列装备，强化长期收藏。'},rogue:{name:'异常收容',description:'每节点每轮选择一次强化，第五任务解锁回溯。'}};
export const CATALOG = {idle:DATA.resourceStages,gear:DATA.equipmentTasks,rogue:DATA.containmentTasks};
export const TASKS = Object.fromEntries(Object.entries(CATALOG).flatMap(([kind,entries])=>entries.map(t=>[t.id,{...t,kind}])));
// Access survives rebirth; runClears remains the separate per-cycle reward ledger.
export function taskUnlocked(state,task){
  if(!task)return false;
  return task.unlock==='initial'||[state.firsts,state.historyContribution,state.runClears].some(ids=>ids?.includes(task.id)||ids?.includes(task.unlock));
}
export function latestUnlockedTask(state,kind){
  const list=CATALOG[kind],task=list.findLast(t=>taskUnlocked(state,t))||list[0];return TASKS[task.id];
}
export const BUFFS = DATA.containmentTasks.flatMap(t=>t.rewards.choices);
export const BUFF_BY_ID = Object.fromEntries(BUFFS.map(b=>[b.id,b]));
export const TALENTS = DATA.permanentTalents;
export const TALENT_BY_ID = Object.fromEntries(TALENTS.map(t=>[t.id,t]));
export function templateSlots(t) {
  if(t.group==='weapon') return [0];
  if(t.slot.startsWith('副手')) return [1];
  if(t.slot.startsWith('戒指')) return [9,10];
  if(t.slot.startsWith('饰品')) return [12,13];
  return [SLOT_NAMES.indexOf(t.slot)];
}
export function talentBonus(s,effect) { return TALENTS.filter(t=>t.effect===effect).reduce((v,t)=>v+Number(s.talents?.[t.id]?.level||0)*t.per_level,0); }
export function chosenBuffs(s) {
  return (s.buffs||[]).map(id=>{
    const b=BUFF_BY_ID[id]; if(!b) return null;
    const parameters={...b.parameters};
    if(s.enhancedBuff===id) for(const rule of DATA.rogueEnhanceWhitelist.filter(w=>w.choice_id===id)) parameters[rule.field]=rule.to;
    return {...b,parameters};
  }).filter(Boolean);
}
