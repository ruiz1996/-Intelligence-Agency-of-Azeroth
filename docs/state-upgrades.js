import {SCHEMA,HEROES,TEMPLATE_BY_ID,RULE_VERSION,DATA} from './catalog.js';
import {canEquip} from './equipment.js';
import {WEAPON_REVISION} from './equipment-expansion.js';
import {clone} from './primitives.js';
import {initIdleGear} from './idle-equipment.js';
export function needsStateUpgrade(s){return s.schema===SCHEMA&&(s.rule!==RULE_VERSION||!s.migrations?.[WEAPON_REVISION]||!s.idleGear||HEROES.some(h=>!s.heroes[h.id]||!s.equipment[h.id]));}
export function upgradeState(old,now=Date.now()){
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
  initIdleGear(s,now);s.rule=RULE_VERSION;return s;
}
