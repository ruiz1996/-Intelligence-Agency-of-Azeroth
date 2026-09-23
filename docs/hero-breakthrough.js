import {SIX_HEROES} from './six-heroes.js';
import {HERO_BY_ID} from './catalog.js';
import {BREAKTHROUGH_PHASES} from './growth-rules.js';
import {clone,natural,requireRule} from './primitives.js';
export {BREAKTHROUGH_PHASES} from './growth-rules.js';
const fields={attribute_2:'attribute2Level',skill_3:'skill3Level',attribute_4:'attribute4Level'};
// Only explicitly designed coefficients can be purchased. Other active stages
// remain unavailable until their effects are defined; six new passives unlock at 15 ranks.
export const BREAKTHROUGH_SKILLS={
  ...Object.fromEntries(SIX_HEROES.map(h=>[h.id,h.star3Fields])),
  xiaocheng:['active.primaryAtkCoefficient','active.secondaryAtkCoefficient'],
  sacred_druid:['active.atkCoefficient','active.dot.tickAtkCoefficient'],
  yuliang:['forms.offense.active.atkCoefficient','forms.defense.active.shieldMaxHpFraction'],
  wudi:['active.shieldPresent.damageCoefficient','active.shieldAbsent.maxHpFraction'],
  echoz:['active.atkCoefficient','active.dot.tickAtkCoefficient'],
  kukalon:['active.durationSeconds'],
  asuna:[],
  suxiaoyao:['active.atkCoefficient'],
  bandebeidiwang:['active.directAtkCoefficient','active.dot.tickAtkCoefficient'],
  lancelot:['active.atkCoefficient'],
  qinglian:['passive.delayFraction'],
  makelong:['active.atkCoefficient'],
  kuodaya:['passive.atkPct'],
  xifeng:[],
  hasika:['active.atkCoefficient'],
};
export function breakthroughRecord(s,id){return {attribute2Level:0,skill3Level:0,attribute4Level:0,permanentSpent:'0',...s.heroes[id]?.breakthrough};}
export function breakthroughMultiplier(s,id){const b=breakthroughRecord(s,id);return 1+.01*(b.attribute2Level+b.attribute4Level);}
export function breakthroughDefinition(s,id){
  const h=HERO_BY_ID[id],level=breakthroughRecord(s,id).skill3Level;if(!BREAKTHROUGH_SKILLS[id])return h;
  const next=clone(h),multiplier=1+.02*level;
  for(const path of BREAKTHROUGH_SKILLS[id]){const keys=path.split('.'),key=keys.pop(),parent=keys.reduce((v,k)=>v[k],next);parent[key]*=multiplier;}
  if(id==='asuna'){next.active.cooldownSeconds-=.2*level;next.passive.followingOwnActions=level===5?3:2;}
  if(id==='xifeng'){next.active.atkCoefficient*=multiplier;next.active.jumpCoefficients=next.active.jumpCoefficients.map(value=>value*multiplier);}
  const b=breakthroughRecord(s,id);if(h.star5&&s.heroes[id].star>=5&&b.attribute2Level===5&&b.skill3Level===5&&b.attribute4Level===5){
    if(next.forms)for(const form of Object.values(next.forms))form.passive.star5=h.star5;
    else next.passive.star5=h.star5;
  }
  return next;
}
export function breakthroughPreview(s,id,phaseId,count=1){
  const h=s.heroes[id],phase=BREAKTHROUGH_PHASES.find(p=>p.id===phaseId);requireRule(HERO_BY_ID[id]&&h?.owned,'未拥有该特工');requireRule(phase,'突破阶段不存在');
  const record=breakthroughRecord(s,id),level=record[fields[phaseId]],steps=level===5?0:count==='max'?5-level:count;
  requireRule(Number.isInteger(steps)&&steps>=0&&steps<=5-level,'突破等级无效');
  const cost=phase.costs.slice(level,level+steps).reduce((a,b)=>a+BigInt(b),0n),available=phaseId!=='skill_3'||!!BREAKTHROUGH_SKILLS[id];
  const reason=!available?'暂未开放':h.star<phase.starRequired?`需${phase.starRequired}星`:level===5?'本阶段已满级':s.challenge?'请先结束当前战斗':BigInt(s.points)<cost?`还差${cost-BigInt(s.points)}点`:null;
  return {phase:phaseId,field:fields[phaseId],level,nextLevel:level+steps,count:steps,cost:cost.toString(),available,reason,canBuy:!reason&&steps>0};
}
export function purchaseBreakthrough(s,action){
  const p=breakthroughPreview(s,action.hero,action.phase,action.count??1);requireRule(p.canBuy,p.reason||'突破等级无效');
  requireRule(natural(action.expectedLevel)===BigInt(p.level),'突破等级已变化，请重新确认');
  requireRule(String(action.expectedCost)===p.cost,'突破费用已变化，请重新确认');
  const b=breakthroughRecord(s,action.hero);b[p.field]=p.nextLevel;b.permanentSpent=(BigInt(b.permanentSpent)+BigInt(p.cost)).toString();
  s.points=(BigInt(s.points)-BigInt(p.cost)).toString();s.heroes[action.hero].breakthrough=b;
  return {hero:action.hero,phase:p.phase,from:p.level,to:p.nextLevel,paid:p.cost};
}
