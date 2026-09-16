import {TASKS,MAX_INVENTORY} from './catalog.js';
import {rollEquipment} from './equipment.js';
export const IDLE_GEAR_INTERVAL=30*60*1000,IDLE_GEAR_CAPACITY=48;
export function historicalGear(s){return [...(s.firsts||[]),...(s.historyContribution||[])].map(id=>TASKS[id]).filter(t=>t?.kind==='gear').sort((a,b)=>b.index-a.index)[0]||null;}
export function initIdleGear(s,now){
  if(!s.idleGear)s.idleGear={source:historicalGear(s)?.id||null,at:now,carry:0,items:[]};
}
export function idleGearPreview(s,now=Date.now()){
  const g=s.idleGear;if(!g)return {count:0,pending:0,source:null,remaining:null};
  const elapsed=g.source?Math.max(0,Math.trunc(now)-g.at)+g.carry:0;
  const pending=Math.min(IDLE_GEAR_CAPACITY-g.items.length,Math.floor(elapsed/IDLE_GEAR_INTERVAL));
  const count=g.items.length+pending;
  return {count,pending,source:g.source,remaining:!g.source||count>=IDLE_GEAR_CAPACITY?null:IDLE_GEAR_INTERVAL-elapsed%IDLE_GEAR_INTERVAL};
}
// Always settle with the OLD source/talents before any action changes them.
// At capacity, discard both excess time and fractional carry: no hidden backlog.
export function settleIdleGear(s,now,rng){
  initIdleGear(s,now);const g=s.idleGear,preview=idleGearPreview(s,now),at=Math.max(g.at,Math.trunc(now));
  if(g.source)for(let i=0;i<preview.pending;i++)g.items.push(rollEquipment(TASKS[g.source],s,rng));
  g.carry=!g.source||g.items.length>=IDLE_GEAR_CAPACITY?0:(Math.max(0,at-g.at)+g.carry)%IDLE_GEAR_INTERVAL;g.at=at;
}
export function updateIdleGearSource(s,now){const task=historicalGear(s),g=s.idleGear;if(task&&(!g.source||task.index>TASKS[g.source].index)){g.source=task.id;if(!g.unlockedAt)g.unlockedAt=now;}}
export function claimIdleGear(s){const g=s.idleGear,count=Math.max(0,Math.min(g.items.length,MAX_INVENTORY-s.items.length-s.pendingEquipment.length)),gearItems=g.items.splice(0,count);s.items.push(...gearItems);return {gearCount:count,gearRemaining:g.items.length,gearItems};}
