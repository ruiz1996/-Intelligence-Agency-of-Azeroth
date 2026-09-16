// Confirmed design increments: battle timing v0.6 and repeated affixes v0.7.
export const BATTLE_LIMITS = Object.freeze({idle:null,gear:180,rogue:120});
export const GEAR_REWARD_BANDS = [
  {id:'within_90',minExclusiveSeconds:null,maxInclusiveSeconds:90,randomEquipmentCount:2,normalWinGoldMultiplier:2},
  {id:'over_90_within_150',minExclusiveSeconds:90,maxInclusiveSeconds:150,randomEquipmentCount:1,normalWinGoldMultiplier:2},
  {id:'over_150_within_180',minExclusiveSeconds:150,maxInclusiveSeconds:180,randomEquipmentCount:1,normalWinGoldMultiplier:1},
];
export const simulationMicros=seconds=>Math.round(seconds*1e6);
export function gearRewardBand(duration,outcome='win'){
  if(outcome!=='win'||!Number.isFinite(duration)||duration<0)return null;
  return GEAR_REWARD_BANDS.find(b=>simulationMicros(duration)<=simulationMicros(b.maxInclusiveSeconds))||null;
}
export function applyBattleRules(base){
  const stages=(list,kind)=>list.map(t=>({...t,limitSeconds:BATTLE_LIMITS[kind],...(kind==='gear'?{rewards:{...t.rewards,timeRewardBands:GEAR_REWARD_BANDS}}:{})}));
  const {battleLimitSeconds,...combat}=base.sharedCombat,{limitSeconds,...encounter}=base.encounterRules;
  return {...base,resourceStages:stages(base.resourceStages,'idle'),equipmentTasks:stages(base.equipmentTasks,'gear'),containmentTasks:stages(base.containmentTasks,'rogue'),
    sharedCombat:{...combat,battleLimitSecondsByKind:BATTLE_LIMITS,action:{...combat.action,timeoutBoundary:'按任务时限处理截止时刻的合法事件后判超时；资源不限时；双方同刻全灭判我方失败。'},waves:combat.waves.replace('90秒为整场总时限。','时限按副本分类，三波共用。')},
    encounterRules:{...encounter,limitSecondsByKind:BATTLE_LIMITS}};
}
