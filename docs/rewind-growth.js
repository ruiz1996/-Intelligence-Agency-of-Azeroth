import {TASKS,talentBonus} from './catalog.js';
import {SCALE,natural,requireRule} from './primitives.js';
export const POINT_DENOMINATOR=240000000000000000n,BASE_MICRO=240000n;
export const goldPointCost=n=>n<=50n?20000n:400n*n;
export const goldPointTotal=n=>n<=50n?20000n*n:490000n+200n*n*(n+1n);
export function goldPointMicro(units){
  const g=natural(units);let low=0n,high=51n;
  while(goldPointTotal(high)*SCALE<=g)high*=2n;
  while(low+1n<high){const mid=(low+high)/2n;if(goldPointTotal(mid)*SCALE<=g)low=mid;else high=mid;}
  return low*BASE_MICRO+(g-goldPointTotal(low)*SCALE)*BASE_MICRO/(goldPointCost(low+1n)*SCALE);
}
export function recordGoldIncome(s,units){
  const n=natural(units);if(s.rebirthIncome?.mode==='gold')s.runEarnedGoldUnits=(natural(s.runEarnedGoldUnits||'0')+n).toString();
}
export function initGrowthIncome(s,{legacy=false,sourceRule=null}={}){
  s.rebirthIncome??={mode:legacy?'legacy':'gold',...(legacy?{legacyRule:sourceRule}:{})};
  s.runEarnedGoldUnits??='0';s.lifetimeSettledEligibleGoldUnits??='0';
  const old=natural(s.pointRemainder||0),denom=natural(s.pointRemainderDenominator||240);
  requireRule([240n,19200n,POINT_DENOMINATOR].includes(denom),'回溯小数版本不受支持，原档已保留');
  s.pointRemainder=(old*(POINT_DENOMINATOR/denom)).toString();s.pointRemainderDenominator=POINT_DENOMINATOR.toString();
}
export function growthPayout(s,pendingIdleGold='0'){
  const raw=ids=>ids.reduce((n,id)=>n+BigInt(TASKS[id]?.rebirthContributionSubunits||0),0n),history=raw(s.pendingHistoryContribution),legacy=s.rebirthIncome?.mode==='legacy';
  const prior=natural(s.lifetimeSettledEligibleGoldUnits||'0'),earned=natural(s.runEarnedGoldUnits||'0')+natural(pendingIdleGold),oldRemainder=natural(s.pointRemainder||0);
  const baseMicro=legacy?0n:goldPointMicro(prior+earned)-goldPointMicro(prior),base=legacy?raw(s.runClears)*POINT_DENOMINATOR/240n:baseMicro*POINT_DENOMINATOR/BASE_MICRO;
  const extra=history*POINT_DENOMINATOR/960n,level=legacy?0:Math.round(talentBonus(s,'rebirth_income_pct')*20),bonus=(base+extra)*BigInt(level)/20n;
  const total=base+extra+bonus+oldRemainder;
  return {eligible:s.runClears.includes('AX-05')&&!s.pendingBuff&&!s.challenge&&s.pendingEquipment.length===0,mode:legacy?'legacy':'gold',base:base.toString(),extra:extra.toString(),bonus:bonus.toString(),oldRemainder:oldRemainder.toString(),denominator:POINT_DENOMINATOR.toString(),p17Level:level,earnedGoldUnits:earned.toString(),lifetimeGoldUnits:prior.toString(),points:(total/POINT_DENOMINATOR).toString(),remainder:(total%POINT_DENOMINATOR).toString()};
}
