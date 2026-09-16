import {HERO_BY_ID,TEMPLATE_BY_ID} from './catalog.js';
import {canEquip} from './equipment.js';
import {heroStats,heroDefinition,heroForm} from './stats.js';
import {requireRule} from './primitives.js';
const tanks=new Set(['yan','lan','wudi','kukalon','qinglian']);
const healers=new Set(['ling','suxiaoyao','makelong','xifeng']);
// Transparent role utility, evaluated on strengthened stats, affixes and current buffs.
// Heals/shields do not crit. HP-based shields therefore cannot be scored as ATK spells.
export function equipmentScore(s,id){
  const h=heroDefinition(s,id),v=heroStats(s,id),base=h.base;
  const survival=(v.hp/base.hp)*(1+v.def/100)/(1+base.def/100);
  const active=h.active,direct=(active.atkCoefficient||0)*Math.min(3,active.maxTargets||1),dot=(active.dot?.tickAtkCoefficient||0)*(active.dot?.ticks||0)*Math.min(3,active.maxTargets||1);
  const baseOutput=1/base.intervalSeconds+direct/active.cooldownSeconds+dot/active.cooldownSeconds;
  const attacks=v.atk/base.atk*((1/v.interval+direct/v.cd)*(1+v.crit*(v.critDamage-1))+dot/v.cd)/baseOutput;
  const support=v.atk/base.atk;
  if(id==='wudi')return .8*survival+.15*v.hp/base.hp+.05*attacks;
  if(tanks.has(id)||id==='yuliang'&&h.form==='defense')return .75*survival+.25*attacks;
  if(healers.has(id))return .7*support+.25*survival+.05*attacks;
  if(id==='sacred_druid')return .65*support+.25*survival+.1*attacks;
  if(id==='kuodaya')return .45*survival+.55*attacks;
  return .85*attacks+.15*survival;
}
export function recommendEquipment(s,id){
  requireRule(HERO_BY_ID[id]&&s.heroes[id]?.owned,'未拥有该特工');
  const original=[...s.equipment[id]],reserved=new Set(Object.entries(s.equipment).filter(([h])=>h!==id).flatMap(([,a])=>a).filter(Boolean));
  const available=s.items.filter(i=>!reserved.has(i.id)).sort((a,b)=>a.id.localeCompare(b.id));
  const byId=new Map(available.map(i=>[i.id,i])),form=heroForm(s,id);
  const pools=Array.from({length:15},(_,slot)=>[null,...available.filter(i=>canEquip(s,id,i,slot)).map(i=>i.id)]);
  const working={...s,items:[],equipment:{...s.equipment,[id]:original}};
  const evaluate=slots=>{working.equipment[id]=slots;working.items=slots.filter(Boolean).map(key=>byId.get(key));return equipmentScore(working,id);};
  const changed=slots=>slots.reduce((n,key,i)=>n+(key!==original[i]),0);
  const better=(a,b,as,bs)=>as>bs+1e-9||Math.abs(as-bs)<=1e-9&&(changed(a)<changed(b)||changed(a)===changed(b)&&a.join('|')<b.join('|'));
  const baseline=evaluate(original);let slots=original,bestScore=baseline;
  // Joint hands and repeated-slot pairs; repeated coordinate sweeps account for
  // percentage/flat-stat interactions. Every accepted sweep improves actual utility.
  const groups=[[0,1],[2],[3],[4],[5],[6],[7],[8],[9,10],[11],[12,13],[14]];
  for(let pass=0;pass<8;pass++){
    let improved=false;
    for(const group of groups){
      let next=slots,nextScore=bestScore;
      const candidates=group.length===2?pools[group[0]].flatMap(a=>pools[group[1]].filter(b=>!a||a!==b).map(b=>[a,b])):pools[group[0]].map(a=>[a]);
      for(const values of candidates){
        if(group[0]===0){const two=byId.get(values[0])&&TEMPLATE_BY_ID[byId.get(values[0]).templateId].twoHand;if(two&&values[1]||form&&(two?'offense':'defense')!==form)continue;}
        const trial=[...slots];group.forEach((slot,i)=>trial[slot]=values[i]);const score=evaluate(trial);
        if(better(trial,next,score,nextScore)){next=trial;nextScore=score;}
      }
      if(next!==slots){improved=true;slots=next;bestScore=nextScore;}
    }
    if(!improved)break;
  }
  // Equal value never causes an unnecessary replacement of the current loadout.
  if(bestScore<=baseline+1e-9)return {slots:original,changed:0,before:baseline,after:baseline};
  return {slots,changed:changed(slots),before:baseline,after:bestScore};
}
