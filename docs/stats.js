import { HERO_BY_ID, TEMPLATE_BY_ID, talentBonus, chosenBuffs } from './catalog.js';
import { baseItemStats, canEquip } from './equipment.js';
import { requireRule } from './primitives.js';
import {breakthroughDefinition,breakthroughMultiplier,breakthroughRecord} from './hero-breakthrough.js';
export function heroForm(s,id) {
  const hero=HERO_BY_ID[id];if(!hero.forms)return null;
  const slots=s.equipment[id]||[],main=s.items.find(i=>i.id===slots[0]),t=main&&TEMPLATE_BY_ID[main.templateId];
  requireRule(!slots[0]||main,'主手装备不存在，请重新整备');
  if(main)requireRule(canEquip(s,id,main,0),'主手不适用于该特工，请卸下后再挑战');
  if(slots[1]){const off=s.items.find(i=>i.id===slots[1]);requireRule(off&&canEquip(s,id,off,1),'副手不适用于该特工，请卸下后再挑战');}
  if(t?.twoHand)requireRule(!slots[1],'双手武器不能同时装备副手');
  return t?.twoHand?'offense':'defense';
}
export function heroDefinition(s,id) {
  const h=breakthroughDefinition(s,id),form=heroForm(s,id);return form?{...h,active:h.forms[form].active,passive:h.forms[form].passive,form,formName:h.forms[form].name}:h;
}
export function heroStats(s,id) {
  const h=heroDefinition(s,id),record=s.heroes[id]||{star:1};
  const flat={hp:0,atk:0,def:0},bonus={hp:0,atk:0,def:0,crit:0,critDamage:0};
  const byId=new Map(s.items.map(i=>[i.id,i]));
  for(const itemId of s.equipment[id]||[]) {
    const item=byId.get(itemId); if(!item)continue;
    const stats=baseItemStats(item); for(const key of ['hp','atk','def'])flat[key]+=stats[key]||0;
    for(const a of item.affixes)if(a.stat in bonus)bonus[a.stat]+=a.value;
  }
  const buffs=chosenBuffs(s);
  for(const b of buffs.filter(b=>b.effect_type==='stat')) for(const key of ['hp','atk','def'])bonus[key]+=b.parameters[key+'_pct']||0;
  const result={},multiplier=breakthroughMultiplier(s,id);
  for(const key of ['hp','atk','def'])result[key]=Math.round((h.base[key]+flat[key])*(1+bonus[key]+talentBonus(s,key+'_pct'))*multiplier);
  requireRule(Object.values(result).every(Number.isFinite),'战斗属性超出可计算范围，请保留档案并反馈');
  result.crit=Math.min(.75,.05+bonus.crit+talentBonus(s,'crit_pct')); result.critDamage=Math.min(3,1.5+bonus.critDamage+talentBonus(s,'crit_damage_pct'));
  result.haste=Math.min(.5,buffs.reduce((n,b)=>n+(b.parameters.interval_reduction||0),0));
  result.cdr=Math.min(.25,buffs.reduce((n,b)=>n+(b.parameters.cdr||0),0));
  result.interval=h.base.intervalSeconds*(1-result.haste);
  result.cd=h.active.cooldownSeconds*(1-result.cdr);
  // Preserve the pre-rounding attack inputs so a live KKT aura joins the same bucket.
  result.attackBase=h.base.atk+flat.atk;
  result.attackBonus=bonus.atk+talentBonus(s,'atk_pct');
  result.breakthroughStatMultiplier=multiplier;
  result.star=record.star;result.breakthrough=breakthroughRecord(s,id);
  const full=breakthroughDefinition(s,id);
  result.skillSnapshot=full.forms?{forms:structuredClone(full.forms)}:{active:structuredClone(h.active),passive:structuredClone(h.passive)};
  if(h.form)result.form=h.form;
  return result;
}
export function teamPower(s) { return s.formation.filter(Boolean).reduce((n,id)=>{const h=heroStats(s,id);return n+h.hp/5+h.atk*3+h.def*2;},0); }
