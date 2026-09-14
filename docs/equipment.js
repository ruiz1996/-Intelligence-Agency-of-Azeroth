import { DATA, TEMPLATE_BY_ID, TEMPLATES, HERO_BY_ID, templateSlots, talentBonus } from './catalog.js';
import { uid, random, weighted, natural, ceilDiv, requireRule } from './primitives.js';
export function makeItem(templateId, quality=0, rng=random) {
  const t=TEMPLATE_BY_ID[templateId]; requireRule(t,'装备模板不存在'); requireRule(Number.isInteger(quality)&&quality>=0&&quality<=4,'品质无效');
  const tier=DATA.equipment.tiers[t.tier-1], weights=[...t.weights], keys=['atk','hp','def','crit','critDamage']; const affixes=[];
  for(let i=0;i<quality;i++) {
    const a=weighted(weights,rng); weights[a]=0;
    const range=tier.range[a===3?'crit':a===4?'critDamage':'normal'];
    const draw=()=>Math.round(range[0]*10)+Math.floor(rng()*(Math.round((range[1]-range[0])*10)+1));
    affixes.push({stat:keys[a],value:(draw()+(t.twoHand?draw():0))/1000});
  }
  return {id:uid(),templateId,quality,level:'1',affixes,invested:'0',locked:false};
}
export function canEquip(s,heroId,item,slot) {
  const h=HERO_BY_ID[heroId],t=TEMPLATE_BY_ID[item.templateId];
  if(!h||!t||!s.heroes[heroId]?.owned||!templateSlots(t).includes(slot)) return false;
  if(slot===0) return h.weapons.main.includes(t.slot);
  if(slot===1) return h.weapons.off.includes(t.slot.split('·')[1]);
  return true;
}
export function baseItemStats(item) {
  if(item.legacyFlat) { const ratio=(1+(Number(item.level)-1)/5)/(1+(Number(item.legacyLevel)-1)/5); return Object.fromEntries(Object.entries(item.legacyFlat).map(([k,v])=>[k,v*ratio])); }
  const t=TEMPLATE_BY_ID[item.templateId];
  // Expanded templates already contain the tier multiplier.
  const scale=1+(Number(item.level)-1)/5;
  return {hp:t.hp*scale,atk:t.atk*scale,def:t.def*scale};
}
export function upgradeCost(item,s) {
  const t=TEMPLATE_BY_ID[item.templateId],l=natural(item.level,1n),g=BigInt(t.tier-1),u=BigInt(t.budget);
  const discount=BigInt(Math.round(talentBonus(s||{},'upgrade_discount')*100));
  return ceilDiv((60n+15n*l+3n*l*l)*13n**g*u*(100n-discount),20n*10n**g*100n);
}
export function salvageValue(item,s) {
  const t=TEMPLATE_BY_ID[item.templateId];
  const base=BigInt(DATA.equipment.qualitySalvageBase[item.quality]);
  const bonus=BigInt(Math.round(talentBonus(s,'base_salvage_pct')*100));
  const g=BigInt(t.tier-1);
  return BigInt(item.invested)+base*13n**g*(100n+bonus)/(10n**g*100n);
}
export function rollEquipment(task,s,rng=random) {
  const r=task.rewards; const tier=r.tier+(rng()<r.nextTierChanceBp/10000?1:0);
  let quality=weighted(r.qualityChanceBp,rng);
  if(quality<4 && r.qualityChanceBp[quality+1]>0 && rng()<talentBonus(s,'one_step_quality_promotion_chance')) quality++;
  const weights=r.groupChanceBp.map(n=>n/10000),focus={main_hand:0,armor_and_offhand:1,jewelry:2}[s.focus];
  const extra=talentBonus(s,'target_equipment_group_add_pp_fraction');
  if(focus!==undefined&&extra>0) { const old=weights[focus],added=Math.min(extra,1-old); for(let i=0;i<3;i++)weights[i]=i===focus?old+added:weights[i]*(1-old-added)/(1-old); }
  const group=['weapon','armor','jewelry'][weighted(weights,rng)];
  const pool=TEMPLATES.filter(t=>t.tier===tier&&t.group===group);
  return makeItem(pool[Math.floor(rng()*pool.length)].id,quality,rng);
}
