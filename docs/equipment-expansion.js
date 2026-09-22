import {SIX_HEROES} from './six-heroes.js';
// Incremental v0.5 data. Existing template IDs and the imported balance source stay stable.
export const WEAPON_REVISION='weapons-v0.9';
const shield=['盾牌'],charm=['护符'],one=['单手剑','单手锤','单手斧'],two=['双手剑','双手斧','双手锤'];
export const WEAPON_PERMISSIONS=Object.fromEntries([
  ['yan',one,shield],['lan',['单手锤','单手斧'],shield],['wudi',one,shield],['kukalon',one,shield],
  ['qinglian',['长柄武器','法杖','拳套'],[]],['asuna',two,[]],['lancelot',two,[]],
  ['shuo',['弓','火枪'],[]],['jin',['弓','火枪'],[]],['echoz',['法杖','匕首','魔杖'],charm],
  ['xiaocheng',['法杖','匕首'],charm],['sacred_druid',['法杖','匕首'],charm],
  ['bandebeidiwang',['法杖','匕首','魔杖'],charm],['ling',['法杖','单手锤','魔杖'],charm],
  ['suxiaoyao',['法杖','单手锤','魔杖'],charm],['makelong',['法杖','匕首','单手锤'],charm],
  ['kuodaya',two,[]],['yuliang',[...one,...two,'长柄武器'],shield],
  ['xifeng',['法杖','单手锤','匕首'],shield],['hasika',['弓','火枪'],[]],
].map(([id,main,off])=>[id,{main,off}]));
Object.assign(WEAPON_PERMISSIONS,Object.fromEntries(SIX_HEROES.map(h=>[h.id,h.weapons])));
export function expandEquipment(base){
  const additions=[
    ['单手斧','战斧',18,20,false,[4,2,0,2,2]],['双手斧','巨斧',28,20,true,[4,1,0,1,4]],
    ['双手锤','重锤',24,60,true,[4,4,0,1,1]],['战刃','战刃',30,0,true,[4,1,0,4,1]],
    ['拳套','拳套',25,50,true,[4,3,0,2,1]],['魔杖','魔杖',18,20,false,[6,2,0,1,1]],
  ].map(([slot,suffix,atk,hp,twoHand,weights],i)=>({id:23+i,slot,suffix,atk,hp,def:0,twoHand,weights,group:'weapon',budget:twoHand?30:20,k:twoHand?1.5:1}));
  const templates=base.tiers.flatMap(tier=>additions.map(t=>({...t,id:`G${tier.id}-T${t.id}`,baseTemplateId:t.id,tier:tier.id,name:tier.name+t.suffix,atk:t.atk*tier.stat,hp:t.hp*tier.stat})));
  return {...base,baseTemplates:[...base.baseTemplates,...additions],templates115:[...base.templates115,...templates]};
}
