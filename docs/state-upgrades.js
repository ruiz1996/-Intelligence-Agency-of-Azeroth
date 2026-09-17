import {SCHEMA,HEROES,TEMPLATE_BY_ID,RULE_VERSION,DATA} from './catalog.js';
import {canEquip} from './equipment.js';
import {WEAPON_REVISION} from './equipment-expansion.js';
import {clone,random,natural} from './primitives.js';
import {initIdleGear,settleIdleGear} from './idle-equipment.js';
import {GROWTH_REVISION,RETIRED_TALENTS} from './growth-rules.js';
import {initGrowthIncome} from './rewind-growth.js';
import {breakthroughRecord} from './hero-breakthrough.js';
export function needsStateUpgrade(s){return s.schema===SCHEMA&&(s.rule!==RULE_VERSION||!s.migrations?.[WEAPON_REVISION]||!s.migrations?.[GROWTH_REVISION]||!s.idleGear||HEROES.some(h=>!s.heroes[h.id]||!s.equipment[h.id]||!s.heroes[h.id].breakthrough));}
export function upgradeState(old,now=Date.now(),rng=random){
  const s=clone(old);if(s.schema!==SCHEMA)return s;
  for(const h of HEROES){s.heroes[h.id]??={owned:false,star:1,shards:0};s.equipment[h.id]??=Array(15).fill(null);}
  s.migrations??={};
  if(!s.migrations[WEAPON_REVISION]){
    const report=[],snapshot=clone(old),seen=new Set(),byId=new Map(s.items.map(i=>[i.id,i]));
    for(const h of HEROES)for(let slot=0;slot<15;slot++){
      const id=s.equipment[h.id][slot],item=byId.get(id);if(!id)continue;
      const main=byId.get(s.equipment[h.id][0]);
      if(!item||!canEquip(s,h.id,item,slot)||seen.has(id)||slot===1&&main&&TEMPLATE_BY_ID[main.templateId]?.twoHand){
        s.equipment[h.id][slot]=null;report.push({hero:h.id,slot,item:id,reason:'旧穿戴与当前许可不符，物品保留'});
      }else seen.add(id);
    }
    if(s.challenge&&(s.challenge.rule!==RULE_VERSION||s.challenge.balanceRevision!==DATA.balanceRevision)){report.push({challenge:s.challenge.id,reason:'旧规则挑战已封存，请重新挑战'});s.challenge=null;}
    s.migrations[WEAPON_REVISION]={at:now,snapshot,report};
  }
  initIdleGear(s,now);
  if(!s.migrations[GROWTH_REVISION]){
    // Finish pre-cutover idle equipment with its former P11 preference before
    // retiring it. The caller persists this together with refunds under CAS.
    settleIdleGear(s,now,rng,{legacyFocus:true});
    const refunded={};let total=0n;
    for(const id of RETIRED_TALENTS){if(s.talents[id]){const paid=natural(s.talents[id].paid);refunded[id]=clone(s.talents[id]);total+=paid;delete s.talents[id];}}
    s.points=(natural(s.points)+total).toString();
    const oldFocus=s.focus;delete s.focus;
    initGrowthIncome(s,{legacy:true,sourceRule:old.rule});s.rebirthPlan=null;
    s.migrations[GROWTH_REVISION]={at:now,sourceRule:old.rule,refunded,refundedPoints:total.toString(),...(oldFocus?{oldFocus}:{}),incomeMode:s.rebirthIncome.mode};
  }
  for(const h of HEROES)s.heroes[h.id].breakthrough=breakthroughRecord(s,h.id);
  s.rule=RULE_VERSION;return s;
}
