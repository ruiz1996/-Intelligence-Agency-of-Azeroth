import { HERO_BY_ID, talentBonus, chosenBuffs } from './catalog.js';
import { baseItemStats } from './equipment.js';
import { requireRule } from './primitives.js';
export function heroStats(s,id) {
  const h=HERO_BY_ID[id],record=s.heroes[id];
  const flat={hp:0,atk:0,def:0},bonus={hp:0,atk:0,def:0,crit:0,critDamage:0};
  const byId=new Map(s.items.map(i=>[i.id,i]));
  for(const itemId of s.equipment[id]) {
    const item=byId.get(itemId); if(!item)continue;
    const stats=baseItemStats(item); for(const key of ['hp','atk','def'])flat[key]+=stats[key]||0;
    for(const a of item.affixes)if(a.stat in bonus)bonus[a.stat]+=a.value;
  }
  const buffs=chosenBuffs(s);
  for(const b of buffs.filter(b=>b.effect_type==='stat')) for(const key of ['hp','atk','def'])bonus[key]+=b.parameters[key+'_pct']||0;
  const result={};
  for(const key of ['hp','atk','def'])result[key]=Math.round((h.base[key]*(1+.16*(record.star-1))+flat[key])*(1+bonus[key]+talentBonus(s,key+'_pct')));
  requireRule(Object.values(result).every(Number.isFinite),'战斗属性超出可计算范围，请保留档案并反馈');
  result.crit=Math.min(.75,.05+bonus.crit); result.critDamage=Math.min(3,1.5+bonus.critDamage);
  result.haste=Math.min(.5,buffs.reduce((n,b)=>n+(b.parameters.interval_reduction||0),0));
  result.cdr=Math.min(.25,buffs.reduce((n,b)=>n+(b.parameters.cdr||0),0));
  result.interval=h.base.intervalSeconds*(1-result.haste);
  result.cd=h.active.cooldownSeconds*(1-result.cdr);
  return result;
}
export function teamPower(s) { return s.formation.filter(Boolean).reduce((n,id)=>{const h=heroStats(s,id);return n+h.hp/5+h.atk*3+h.def*2;},0); }
