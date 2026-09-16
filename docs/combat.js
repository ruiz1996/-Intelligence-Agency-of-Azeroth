import { HERO_BY_ID, TASKS, BATTLE_LIMIT, RULE_VERSION, DATA } from './catalog.js';
import { clone, seededRandom, requireRule } from './primitives.js';
import { redistributeLife } from './hero-mechanics.js';

const alive=units=>units.filter(u=>u.hp>0);
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export function chooseTarget(attacker,targets) {
  return alive(targets).filter(u=>u.targetable!==false&&u.attackable!==false).sort((a,b)=>a.row-b.row||distance(attacker,a)-distance(attacker,b)||a.order-b.order)[0];
}
const lowest=units=>alive(units).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.order-b.order)[0];
const EPS=1e-8;

// Pure deterministic simulation. The server controls rewards, never accepts
// client-supplied stats/rewards, and deliberately does not attest combat wins.
export function simulate(challenge,{trace=true}={}) {
  requireRule(challenge.rule===RULE_VERSION&&challenge.balanceRevision===DATA.balanceRevision,'战斗规则已更新，请重新打开网页并重新挑战');
  const task=TASKS[challenge.taskId];requireRule(task,'战斗任务不存在');
  const rng=seededRandom(challenge.seed),buffs=challenge.buffs||[],bonus=challenge.bonuses||{},events=[],queue=[];
  const effect=type=>buffs.filter(b=>b.effect_type===type);
  const param=(type,key)=>effect(type).reduce((n,b)=>n+(b.parameters[key]||0),0);
  const has=type=>effect(type).length>0;
  let time=0,previousTime=0,sequence=0,shieldSequence=0,interferenceUntil=0,interferenceSpeed=1,ended=false;
  const counters={damage:0,healing:0,shieldCreated:0,shieldAbsorbed:0,shieldSpent:0,shieldExpired:0,selfPaid:0,debtCreated:0,debtPaid:0,debtPurified:0};
  const schedule=(at,priority,fn)=>{if(at<=90+EPS)queue.push({at:Math.round(at*1e6)/1e6,priority,sequence:sequence++,fn});};
  const emit=(type,fields={})=>{if(trace)events.push({time,wave:waveIndex+1,type,...fields});};
  const stateUnit=u=>Object.assign(u,{shields:[],dots:[],debt:[],echoes:[],hp:u.maxHp,actions:0,basics:0,casts:0,focusCount:0,focusTarget:null,dotStacks:0,flags:{},icd:{},enemyDeficit:0,selfDeficit:0,lastEnemyHpHit:-Infinity,actionBuff:0,actionBuffCount:0,immuneUntil:0,reductionUntil:0,reduction:0,castAt:0,cdReduction:0,deadCommitted:false});
  const heroes=challenge.heroes.map(h=>stateUnit({...h,side:'hero',name:HERO_BY_ID[h.id].name,maxHp:h.hp,row:Math.floor(h.slot/3),x:h.slot%3,y:Math.floor(h.slot/3),w:1,h:1,order:h.slot,cdRemaining:h.cd}));
  for(const h of heroes){
    const definition=HERO_BY_ID[h.id];
    if(definition.forms){h.form??='defense';requireRule(definition.forms[h.form],'战士形态无效');}
    h.baseAttack=h.atk;h.warIntent=0;h.cleaveCharges=0;h.key=null;h.kkt=0;
  }
  const skills=u=>{const h=HERO_BY_ID[u.id];return h.forms?h.forms[u.form]:h;};
  const waves=task.waves;requireRule(Array.isArray(waves)&&waves.length>0,'副本波次数据不可用');
  let enemies=[],boss=null,mechanic=null,waveIndex=-1,waveStartedAt=0,waveToken=0,completedWaves=0;
  const units=()=>[...heroes,...enemies],localTime=()=>time-waveStartedAt;
  const attackTargets=()=>alive(enemies).filter(e=>e.targetable!==false&&e.attackable!==false);
  const scheduleWave=(at,priority,fn)=>{const token=waveToken;schedule(at,priority,()=>{if(token===waveToken)fn();});};
  const totalShield=u=>u.shields.reduce((n,s)=>n+s.amount,0);
  const snapshot=()=>units().map(u=>({id:u.id,hp:Math.max(0,u.hp),shield:totalShield(u),immune:u.immuneUntil>time,interfered:u.side==='hero'&&interferenceUntil>time,debt:u.debt.reduce((n,b)=>n+b.amount,0),ready:u.cdRemaining<=EPS,...(u.side==='hero'?{atk:u.atk,dotStacks:u.dotStacks,actionBuffCount:u.actionBuffCount,focusCount:u.focusCount,focusTarget:u.focusTarget,form:u.form,warIntent:u.warIntent,cleaveCharges:u.cleaveCharges,linkUsed:!!u.flags.soulLink,keyUntil:u.key?.until||0,kkt:u.kkt}:{} )}));
  const primarySupport=(kind,target)=>1+(bonus[kind+'_pct']||0)+param('support',kind+'_pct')+(target.row===0?param('position_support',kind+'_pct'):0);
  const keyBonus=(caster,kind)=>caster?.hp>0&&caster.key?.until>time?caster.key[kind+'Bonus']||0:0;
  const nativeSupport=(kind,target,caster)=>primarySupport(kind,target)+keyBonus(caster,kind);
  function refreshAuras(){
    for(const h of heroes){
      const value=h.hp>0?Math.max(0,...heroes.filter(other=>other!==h&&other.hp>0&&HERO_BY_ID[other.id].passive.kind==='living_source_other_ally_atk_aura').map(other=>HERO_BY_ID[other.id].passive.atkPct)):0;
      if(h.kkt===value)continue;h.kkt=value;
      const base=h.attackBase??h.baseAttack,percent=h.attackBonus||0;
      h.atk=value?Math.round(base*(1+percent+value)):h.baseAttack;
      requireRule(Number.isFinite(h.atk),'战斗属性超出可计算范围，请保留档案并反馈');
      emit('aura',{source:'kuodaya',target:h.id,name:'KKT',bonus:value,atk:h.atk});
    }
  }
  function finishLifeEvent(){
    commitDeaths();refreshAuras();
    const caster=heroes.find(h=>h.id==='xifeng'&&h.hp>0&&!h.flags.soulLink),team=alive(heroes);
    if(!caster)return;const p=HERO_BY_ID.xifeng.passive;
    if(team.length<p.minAliveParticipants||!team.some(h=>h.hp/h.maxHp<=p.thresholdInclusive))return;
    caster.flags.soulLink=true;
    emit('redistribute',{source:caster.id,name:p.name,tag:p.eventTag,changes:redistributeLife(team)});
  }
  function addShield(target,amount,source,duration,{derived=false,stack=false,caster=null}={}) {
    if(target.hp<=0||amount<=0)return 0;
    if(target.side==='hero'&&!derived)amount*=nativeSupport('shield',target,caster);
    const existing=!stack&&target.shields.find(s=>s.source===source),old=existing?.amount||0;
    const accepted=Math.min(Math.max(0,amount-old),Math.max(0,target.maxHp*.6-totalShield(target)));
    if(existing){existing.amount+=accepted;existing.until=time+duration;}
    else if(accepted>0)target.shields.push({source,provider:caster?.id||(HERO_BY_ID[source.split(':')[0]]?source.split(':')[0]:source.startsWith('repeat:')?source.slice(7):'other'),amount:accepted,until:time+duration,sequence:shieldSequence++});
    // An expiry event also updates the replay when no unit acts at that moment.
    if(Number.isFinite(duration)&&(existing||accepted>0))schedule(time+duration,0,()=>{});
    counters.shieldCreated+=accepted;emit('shield',{target:target.id,targetSide:target.side,source,provider:caster?.id||(HERO_BY_ID[source.split(':')[0]]?source.split(':')[0]:source.startsWith('repeat:')?source.slice(7):'other'),amount:accepted});return accepted;
  }
  function consumeShield(target,amount,spend=false) {
    target.shields.sort((a,b)=>a.until-b.until||a.source.localeCompare(b.source)||a.sequence-b.sequence);
    let left=amount;for(const s of target.shields){const n=Math.min(left,s.amount);s.amount-=n;left-=n;if(n>0)emit(spend?'shield_spent':'shield_absorbed',{target:target.id,targetSide:target.side,provider:s.provider||'other',source:s.source,amount:n});if(left<=0)break;}
    target.shields=target.shields.filter(s=>s.amount>EPS);const consumed=amount-left;
    counters[spend?'shieldSpent':'shieldAbsorbed']+=consumed;return left;
  }
  function heal(caster,target,amount,{original=false,enemyOnly=false,nativeOverflow=false,source='heal',callbacks=null}={}) {
    if(!target||target.hp<=0)return {effective:0,enemyEffective:0};
    if(original)amount*=nativeSupport('healing',target,caster);
    const deficitBefore=target.enemyDeficit;
    const effective=Math.min(amount,target.maxHp-target.hp,enemyOnly?target.enemyDeficit:Infinity);
    const selfRestored=enemyOnly?0:Math.min(target.selfDeficit,effective);target.selfDeficit-=selfRestored;
    const enemyEffective=Math.min(target.enemyDeficit,effective-selfRestored);target.enemyDeficit-=enemyEffective;target.hp+=effective;
    counters.healing+=effective;emit('heal',{source:effect('emergency_heal').some(b=>b.name===source)?'other':caster?.id,target:target.id,targetSide:target.side,amount:effective,tag:source});
    const derivedCallbacks=()=>{if(original){
      const native=HERO_BY_ID[caster?.id]?.passive,overflow=Math.max(0,amount-effective),nativeRatio=nativeOverflow?native.overhealConversion:0;
      if(nativeOverflow)addShield(target,Math.min(overflow*nativeRatio,target.maxHp*native.targetMaxHpCap),caster.id+':aegis',native.shieldDurationSeconds,{derived:true});
      for(const b of effect('overheal_shield')){const p=b.parameters;if(deficitBefore>0&&time-target.lastEnemyHpHit<=p.recent_enemy_damage_s+EPS)addShield(target,Math.min(overflow*Math.min(p.overflow_ratio,Math.max(0,p.combined_overflow_conversion_cap-nativeRatio)),target.maxHp*p.per_proc_max_hp_cap),'rogue:overflow',p.duration_s,{derived:true});}
      if(has('delayed_heal')&&enemyEffective>0){const p=effect('delayed_heal')[0].parameters,n=Math.min(enemyEffective*p.ratio,target.maxHp*p.max_hp_ratio_cap);schedule(time+p.delay_s,1,()=>heal(caster,target,n,{enemyOnly:true,source:'延迟补货'}));}
    }};
    if(callbacks)callbacks.push(derivedCallbacks);else derivedCallbacks();
    return {effective,enemyEffective};
  }
  function outgoing(u,tag,target) {
    if(u.side!=='hero'||tag==='shield_to_damage'||tag==='derived')return 1;
    const basic=tag==='basic',active=tag==='active'||tag==='periodic';let n=keyBonus(u,'damage');
    if(basic)n+=(bonus.basic_damage_pct||0)+param('damage','basic_pct');
    if(active)n+=(bonus.active_damage_pct||0)+param('damage','active_pct');
    const general=basic||active||tag==='passive'&&u.id==='hasika';
    if(general)for(const b of effect('conditional_damage'))if(u.hp/u.maxHp<b.parameters.threshold)n+=b.parameters.damage_pct;
    if(general){n+=Math.min(u.actions,param('action_ramp','max_stacks'))*param('action_ramp','per_stack');if(u.row===1)n+=param('position_damage','damage_pct');}
    if((basic||tag==='active')&&u.actionBuffCount>0)n+=u.actionBuff;
    if(basic){
      if(u.id==='shuo'){const p=HERO_BY_ID[u.id].passive;n+=Math.min(p.maxStacks,u.focusCount)*p.bonusPerStack;}
      if(u.id==='lan'&&totalShield(u)>0)n+=HERO_BY_ID[u.id].passive.bonus;
      n+=Math.min(u.focusCount,param('focus_basic','max_stacks'))*param('focus_basic','per_stack');
      if(has('interference_basic'))n+=param('interference_basic',interferenceUntil>time?'interfered_bonus':'normal_bonus');
      if(u.nextBasicUntil>time)n+=param('next_basic','bonus');
    }
    if(tag==='active'&&u.id==='xiaocheng'&&alive(enemies).length>=HERO_BY_ID[u.id].passive.minimumAliveEnemies)n+=HERO_BY_ID[u.id].passive.damageBonus;
    return 1+n;
  }
  function extraReduction(target,tag) {
    let red=0;
    if(target.side==='hero') {
      red+=bonus.extra_damage_reduction||0;
      if(target.id==='yuliang'&&target.form==='defense')red+=skills(target).passive.reduction;
      if(target.id==='yan'&&target.row===0&&tag==='basic')red+=HERO_BY_ID[target.id].passive.reduction;
      if(target.reductionUntil>time)red+=target.reduction;
      if(target.row===0){red+=param('position_reduction','reduction');for(const b of effect('opening_reduction'))if(time<b.parameters.duration_s)red+=b.parameters.reduction;}
      for(const b of effect('conditional_reduction'))if(target.hp/target.maxHp<b.parameters.threshold)red+=b.parameters.reduction;
    } else if(target===boss) {
      if(mechanic?.id==='printer'&&alive(enemies).some(e=>e!==boss))red+=mechanic.protectionWhileAdds;
      if(mechanic?.id==='cabinet'&&Math.floor(localTime()/mechanic.phaseSeconds)%2===1)red+=mechanic.heavyReduction;
    }
    return Math.min(.6,red);
  }
  function receive(caster,target,amount,{tag='basic',bypass=false,debt=false,critical=false,rawAmount=amount}={}) {
    if(!target||target.hp<=0||target.attackable===false||amount<=0)return {hp:0,absorbed:0};
    if(!debt&&target.immuneUntil>time)return {hp:0,absorbed:0};
    if(!bypass&&!debt) {
      amount*=100/(100+Math.max(0,target.def))*(1-extraReduction(target,tag));
      if(target===boss&&mechanic?.id==='cabinet'&&Math.floor(localTime()/mechanic.phaseSeconds)%2===0)amount*=1+mechanic.lightDamageTakenBonus;
    }
    if(target.id==='qinglian'&&caster?.side==='enemy'&&['basic','active'].includes(tag)&&!debt&&!bypass){const p=HERO_BY_ID[target.id].passive,delayed=amount*p.delayFraction;amount-=delayed;target.debt.push({source:caster.id,amount:delayed,left:p.repayOverFollowingOwnActionEnds});counters.debtCreated+=delayed;}
    const beforeShield=amount;if(!bypass)amount=consumeShield(target,amount);const absorbed=beforeShield-amount;
    const actual=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-actual);counters.damage+=actual;
    if(target.side==='hero'&&caster?.side==='enemy'&&actual>0){target.enemyDeficit+=actual;target.lastEnemyHpHit=time;}
    if(target===boss&&target.theatreStart!==undefined&&time>=target.theatreStart)target.theatreDamage+=actual;
    emit('damage',{source:caster?.id,sourceSide:caster?.side,target:target.id,targetSide:target.side,amount:actual,absorbed,tag,critical});
    if(target===boss&&mechanic?.id==='elevator'&&target.hp>0&&!target.flags.phase&&target.hp<=target.maxHp*mechanic.threshold){target.flags.phase=true;addShield(target,target.maxHp*mechanic.shieldHpFraction,'elevator',Infinity);target.atk*=1+mechanic.attackBonus;emit('mechanic',{text:`返程：阶段护盾，攻击提高${Math.round(mechanic.attackBonus*100)}%`});}
    if(target.side==='hero'&&caster?.side==='enemy'&&actual>0&&target.hp>0) {
      for(const b of effect('low_hp_shield'))if(!target.flags[b.id]&&target.hp/target.maxHp<b.parameters.threshold){target.flags[b.id]=true;addShield(target,target.maxHp*b.parameters.max_hp_ratio,b.id,b.parameters.duration_s);}
      for(const b of effect('emergency_heal'))if(!target.flags[b.id]&&target.hp/target.maxHp<b.parameters.threshold){target.flags[b.id]=true;heal(target,target,target.maxHp*b.parameters.max_hp_ratio,{enemyOnly:true,source:b.name});}
      if(['basic','active'].includes(tag)&&!debt){target.enemyHits=(target.enemyHits||0)+1;for(const b of effect('on_enemy_hit_shield'))if(target.enemyHits>=b.parameters.hits&&time>=(target.icd[b.id]||0)){target.enemyHits=0;target.icd[b.id]=time+b.parameters.icd_s;addShield(target,target.maxHp*b.parameters.max_hp_ratio,b.id,b.parameters.duration_s);}}
    }
    if(caster?.side==='hero'&&target.side==='enemy'&&actual>0&&['basic','active'].includes(tag)&&has('lifesteal')) {
      const p=effect('lifesteal')[0].parameters,second=Math.floor(time);if(caster.leechSecond!==second){caster.leechSecond=second;caster.leechUsed=0;}
      const n=Math.min(actual*p.ratio,Math.max(0,caster.maxHp*p.max_hp_per_second_cap-caster.leechUsed));const healed=heal(caster,caster,n,{enemyOnly:true,source:'生命找零'});caster.leechUsed+=healed.effective;
    }
    return {hp:actual,absorbed,raw:rawAmount};
  }
  function damage(caster,target,raw,tag='basic',canCrit=false,multiplier=null) {
    const boosted=raw*(multiplier??outgoing(caster,tag,target)),critical=canCrit&&rng()<(caster.crit||0),value=boosted*(critical?caster.critDamage:1);
    return receive(caster,target,value,{tag,critical,rawAmount:boosted});
  }
  function commitDeaths() {
    const deaths=units().filter(u=>u.hp<=0&&!u.deadCommitted&&u.kind!=='environment');
    if(!deaths.length)return;
    for(const u of deaths){u.deadCommitted=true;u.key=null;u.cleaveCharges=0;emit('death',{target:u.id});}
    for(const dead of deaths.filter(u=>u.side==='enemy')) {
      for(const d of dead.dots.filter(d=>d.caster.id==='bandebeidiwang'&&d.remaining>0)) {
        const target=alive(enemies).filter(e=>!e.dots.some(x=>x.caster.id===d.caster.id)).sort((a,b)=>a.row-b.row||distance(dead,a)-distance(dead,b)||a.order-b.order)[0];
        if(target){dead.dots=dead.dots.filter(x=>x!==d);target.dots.push(d);d.target=target;emit('transfer',{source:d.caster.id,oldTarget:dead.id,target:target.id});}
      }
    }
    if(deaths.some(u=>u.side==='hero')) {
      const lance=heroes.find(u=>u.id==='lancelot'&&u.hp>0);
      if(lance){
        const p=HERO_BY_ID[lance.id].passive;
        if(alive(heroes).length===1&&heroes.length>p.lastSurvivor.requiresStartingAlliesAtLeast&&!lance.flags.clutch){lance.flags.clutch=true;lance.immuneUntil=time+p.lastSurvivor.invulnerableSeconds;lance.cdRemaining=0;lance.actionBuff=p.lastSurvivor.damageBonus;lance.actionBuffCount=p.lastSurvivor.followingOwnActions;emit('clutch',{target:lance.id,text:`惩戒光环：独存，无敌${p.lastSurvivor.invulnerableSeconds}秒，审判就绪`});}
        else if(lance.actionBuff!==p.lastSurvivor.damageBonus||lance.actionBuffCount<=0){lance.actionBuff=p.ordinary.damageBonus;lance.actionBuffCount=p.ordinary.followingOwnActions;}
      }
    }
    for(const h of heroes)if(deaths.some(d=>d.id===h.focusTarget)){h.focusTarget=null;h.focusCount=0;}
  }
  function addDot(caster,target,spec,multiplier) {
    if(!target||target.hp<=0)return;
    if(spec.maxOwnTargets===1)for(const e of enemies)e.dots=e.dots.filter(d=>d.caster!==caster);
    target.dots=target.dots.filter(d=>d.caster!==caster);
    const d={caster,target,remaining:spec.ticks,raw:caster.atk*spec.tickAtkCoefficient*multiplier,interval:spec.tickIntervalSeconds,next:time+spec.firstTickOffsetSeconds};target.dots.push(d);
    const tick=()=>{
      const target=d.target;if(target.hp<=0||!target.dots.includes(d)||d.remaining<=0)return;
      const dealt=damage(caster,target,d.raw,'periodic',false,1);if(caster.id==='echoz'&&dealt.hp+dealt.absorbed>0)caster.dotStacks=Math.min(HERO_BY_ID[caster.id].passive.maxStacks,caster.dotStacks+1);
      d.remaining--;d.next=time+d.interval;if(d.remaining>0)schedule(d.next,1,tick);else target.dots=target.dots.filter(x=>x!==d);
    };
    schedule(d.next,1,tick);
  }
  function targetsFor(caster,max,around=null) { return attackTargets().sort((a,b)=>a.row-b.row||distance(around||caster,a)-distance(around||caster,b)||a.order-b.order).slice(0,max); }
  function active(u) {
    const h=skills(u),a=h.active,p=h.passive;let target=chooseTarget(u,enemies);
    const support=['self_heal_shield','lowest_hp_heal','all_ally_heal','self_and_ally_shield','self_damage_reduction','random_purify_or_shield','random_other_ally_effect_bonus','self_shield','distinct_injured_ally_chain_heal'].includes(a.kind)||(a.kind==='shield_branch'&&totalShield(u)===0);
    if(!target&&!support)return false;
    const direct=[]; // Captured primary effects for non-recursive AX01-B copies.
    const hit=(t,raw,canCrit=true,mult=null)=>{const value=raw*(mult??outgoing(u,'active',t));damage(u,t,value,'active',canCrit,1);direct.push({type:'damage',target:t,amount:value});};
    const healing=(t,raw,native=false,callbacks=null)=>{const outcome=heal(u,t,raw,{original:true,nativeOverflow:native,callbacks});direct.push({type:'heal',target:t,amount:raw*nativeSupport('healing',t,u)});return outcome;};
    const shield=(t,raw,duration)=>{addShield(t,raw,u.id+':active',duration,{caster:u});direct.push({type:'shield',target:t,amount:raw*nativeSupport('shield',t,u),duration});};
    const allies=alive(heroes).filter(h=>h!==u);
    if(a.kind==='random_other_ally_effect_bonus'&&!allies.length)return false;
    const injured=alive(heroes).filter(h=>h.hp<h.maxHp-EPS).sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp||x.order-y.order);
    if(a.kind==='distinct_injured_ally_chain_heal'&&!injured.length)return false;
    if(a.kind==='lowest_hp_heal'||a.kind==='all_ally_heal') {
      target=lowest(heroes);
      if(target.hp>=target.maxHp-EPS) {
        if(u.id!=='suxiaoyao')return false;
        const amount=t=>t.shields.find(s=>s.source===u.id+':aegis')?.amount||0;
        target=alive(heroes).sort((x,y)=>amount(x)/x.maxHp-amount(y)/y.maxHp||x.order-y.order)[0];
        if(amount(target)>=Math.min(u.atk*a.atkCoefficient*nativeSupport('healing',target,u)*p.overhealConversion,target.maxHp*p.targetMaxHpCap)*a.fullHealthRecastFraction)return false;
      }
    }
    emit('skill',{source:u.id,name:a.name});
    switch(a.kind) {
      case 'random_other_ally_effect_bonus': {
        const t=allies[Math.floor(rng()*allies.length)],old=t.key;
        t.key={damageBonus:Math.max(old?.damageBonus||0,a.damageBonus),healingBonus:Math.max(old?.healingBonus||0,a.healingBonus),shieldBonus:Math.max(old?.shieldBonus||0,a.shieldBonus),until:time+a.durationSeconds};
        schedule(t.key.until,0,()=>{});emit('buff',{source:u.id,target:t.id,name:a.buffName,until:t.key.until});break;
      }
      case 'self_shield':shield(u,u.maxHp*a.shieldMaxHpFraction,a.shieldDurationSeconds);break;
      case 'execute_direct_damage_with_war_intent': {
        const stacks=u.warIntent,execute=target.hp/target.maxHp<=a.executeThresholdLessThanOrEqual;u.warIntent=0;
        hit(target,u.atk*a.atkCoefficient*(1+p.damageBonusPerStack*stacks)*(execute?a.executeMultiplier:1));break;
      }
      case 'distinct_injured_ally_chain_heal': {
        const callbacks=[],attack=u.atk;
        for(const [i,t] of injured.slice(0,a.maxTargets).entries())healing(t,attack*a.jumpCoefficients[i],false,callbacks);
        for(const callback of callbacks)callback();break;
      }
      case 'direct_damage_then_basic_followup_window':hit(target,u.atk*a.atkCoefficient);u.cleaveCharges=a.validCastSetsCharges;break;
      case 'self_heal_shield': healing(u,u.maxHp*a.healMaxHpFraction);shield(u,u.maxHp*a.shieldMaxHpFraction,a.shieldDurationSeconds);break;
      case 'lowest_hp_heal': healing(target,u.atk*a.atkCoefficient*(u.id==='ling'&&target.hp/target.maxHp<p.thresholdStrictLessThan?p.multiplier:1),u.id==='suxiaoyao');break;
      case 'all_ally_heal': for(const t of alive(heroes)){const out=healing(t,u.atk*a.atkCoefficient);if(out.effective>0)u.echoes.push({target:t,amount:out.effective*p.effectiveHealFraction,due:u.actions+1});}break;
      case 'self_and_ally_shield': {const other=lowest(heroes.filter(h=>h!==u));for(const t of [u,other].filter(Boolean))shield(t,u.atk*a.atkCoefficient,a.durationSeconds);break;}
      case 'self_damage_reduction':u.reduction=a.reduction;u.reductionUntil=time+a.durationSeconds;break;
      case 'shield_branch': {
        const snapshot=totalShield(u);
        if(snapshot>0){consumeShield(u,snapshot*a.shieldPresent.spendFraction,true);damage(u,target,snapshot*a.shieldPresent.damageCoefficient,'shield_to_damage');}
        else shield(u,u.maxHp*a.shieldAbsent.maxHpFraction,a.shieldAbsent.durationSeconds);break;
      }
      case 'random_purify_or_shield': {
        if(rng()<a.outcomes[0].probability){const o=a.outcomes[0],debt=u.debt.reduce((n,b)=>n+b.amount,0);if(debt>0){for(const b of u.debt)b.amount*=1-o.purifyOutstandingDebtFraction;counters.debtPurified+=debt*o.purifyOutstandingDebtFraction;emit('purify',{target:u.id,amount:debt*o.purifyOutstandingDebtFraction});}else shield(u,u.maxHp*o.zeroDebtShieldMaxHpFraction,o.durationSeconds);}
        else {const o=a.outcomes[1];shield(u,u.maxHp*o.shieldMaxHpFraction,o.durationSeconds);}break;
      }
      case 'execute_direct_damage':target=lowest(enemies);hit(target,u.atk*a.atkCoefficient*(target.hp/target.maxHp<a.thresholdStrictLessThan?a.executeMultiplier:1));break;
      case 'single_direct_damage':hit(target,u.atk*a.atkCoefficient);break;
      case 'multi_direct_damage': {const targets=targetsFor(u,a.maxTargets,u.id==='jin'?target:null),mult=outgoing(u,'active',target);for(const t of targets)hit(t,u.atk*a.atkCoefficient,true,mult);break;}
      case 'all_enemy_direct_damage': {const targets=attackTargets(),mult=outgoing(u,'active',target);for(const t of targets)hit(t,u.atk*a.atkCoefficient,true,mult);break;}
      case 'direct_and_dot': {
        const mult=outgoing(u,'active',target),stacks=u.id==='echoz'?u.dotStacks:0;u.dotStacks=0;hit(target,u.atk*(a.atkCoefficient+stacks*(p.directAtkCoefficientPerStack||0)),true,mult);addDot(u,target,a.dot,mult);break;
      }
      case 'multi_dot':for(const t of targetsFor(u,a.maxTargets))addDot(u,t,a.dot,outgoing(u,'periodic',t));break;
      default:throw new Error('Unhandled active '+a.kind);
    }
    u.casts++;u.cdRemaining=u.cd;u.castAt=time;u.cdReduction=0;
    for(const b of effect('repeat_active'))if(u.casts%b.parameters.every_active===0)for(const e of direct){
      if(e.type==='damage')damage(u,e.target,e.amount*b.parameters.ratio,'derived');
      if(e.type==='heal')heal(u,e.target,e.amount*b.parameters.ratio,{source:'技能复写'});
      if(e.type==='shield')addShield(e.target,e.amount*b.parameters.ratio,'repeat:'+u.id,e.duration,{derived:true});
    }
    if(u.id==='asuna'){u.actionBuff=p.damageBonus;u.actionBuffCount=p.followingOwnActions;u.newBuffThisAction=true;}
    if(has('next_basic'))u.nextBasicUntil=time+param('next_basic','duration_s');
    for(const b of effect('post_active_shield'))if(time>=(u.icd[b.id]||0)){u.icd[b.id]=time+b.parameters.icd_s;addShield(u,u.maxHp*b.parameters.max_hp_ratio,b.id,b.parameters.duration_s);}
    return true;
  }
  function basic(u) {
    const target=chooseTarget(u,enemies);if(!target)return;
    if(u.focusTarget!==target.id){u.focusTarget=target.id;u.focusCount=0;}
    const attack=u.atk,followupMultiplier=outgoing(u,'passive',target),startTargets=attackTargets().sort((a,b)=>a.order-b.order);
    const raw=attack*outgoing(u,'basic',target),dealt=damage(u,target,raw,'basic',true,1);u.basics++;u.focusCount++;
    const p=skills(u).passive;
    if(u.id==='yuliang'&&u.form==='offense'&&dealt.hp+dealt.absorbed>0)u.warIntent=Math.min(p.maxStacks,u.warIntent+p.stackPerEvent);
    if(u.id==='hasika'&&u.cleaveCharges>0&&dealt.hp+dealt.absorbed>0){
      u.cleaveCharges--;
      if(target.hp>0)damage(u,target,attack*p.mainAtkCoefficient*followupMultiplier,'passive',false,1);
      for(const t of startTargets.filter(t=>t!==target&&t.hp>0).slice(0,p.maxSecondaryTargets))damage(u,t,attack*p.secondaryAtkCoefficient*followupMultiplier,'passive',false,1);
    }
    if(u.id==='jin'&&u.basics%p.basicCount===0){const other=targetsFor(u,16,target).find(t=>t!==target);if(other)damage(u,other,u.atk*p.atkCoefficient,'passive');}
    if(u.id==='sacred_druid'&&target.hp>0&&target.dots.some(d=>d.caster===u))damage(u,target,u.atk*p.atkCoefficient,'passive');
    for(const b of effect('repeat_basic'))if(u.basics%b.parameters.every_basic===0&&target.hp>0)damage(u,target,raw*b.parameters.ratio,'derived');
    for(const b of effect('basic_cooldown'))if(u.basics%b.parameters.every_basic===0&&u.cdRemaining>0){
      const p=b.parameters,n=Math.min(p.reduce_s,Math.max(0,p.max_per_cycle_s-u.cdReduction),Math.max(0,u.cdRemaining-Math.max(0,skills(u).active.cooldownSeconds*p.ready_floor_base_cd_ratio-(time-u.castAt))));u.cdRemaining-=n;u.cdReduction+=n;
    }
    u.nextBasicUntil=0;
  }
  function heroAction(u) {
    if(u.hp<=0)return;
    u.newBuffThisAction=false;
    const cast=u.cdRemaining<=EPS&&active(u);if(!cast)basic(u);
    finishLifeEvent();
    if(u.id==='wudi') {
      const donor=alive(heroes).filter(h=>h!==u&&h.hp>1).sort((a,b)=>b.hp/b.maxHp-a.hp/a.maxHp||a.order-b.order)[0];
      if(donor){const p=HERO_BY_ID[u.id].passive,multiplier=p.conversionMultiplier*nativeSupport('shield',u,u),paid=Math.max(0,Math.min(donor.maxHp*p.paymentMaxHpFraction,donor.hp-p.minimumDonorHp,(u.maxHp*.6-totalShield(u))/multiplier));donor.hp-=paid;donor.selfDeficit+=paid;counters.selfPaid+=paid;addShield(u,paid*multiplier,'wudi:payment',p.batchDurationSeconds,{derived:true,stack:true});emit('payment',{source:u.id,target:donor.id,amount:paid});finishLifeEvent();}
    }
    for(const echo of u.echoes.filter(e=>e.due<=u.actions)){heal(u,echo.target,echo.amount,{source:'回响'});finishLifeEvent();}u.echoes=u.echoes.filter(e=>e.due>u.actions);
    for(const debt of u.debt){const due=debt.amount/debt.left;debt.amount-=due;debt.left--;counters.debtPaid+=due;receive({id:debt.source||'debt',side:'enemy'},u,due,{tag:'debt',debt:true});finishLifeEvent();}
    u.debt=u.debt.filter(b=>b.left>0&&b.amount>EPS);
    if(u.actionBuffCount>0&&!u.newBuffThisAction)u.actionBuffCount--;u.actions++;
    u.nextActionAt=time+u.interval;schedule(u.nextActionAt,2+u.order/100,()=>heroAction(u));
  }
  function enemyAction(u) {
    if(u.hp<=0)return;
    if(u.environment){
      const env=u.environment,team=alive(heroes).sort((a,b)=>a.slot-b.slot);if(!team.length)return;
      const targets=env.targetMode==='all'?team:env.targetMode==='rotate2'?Array.from({length:Math.min(2,team.length)},(_,i)=>team[(u.actions+i)%team.length]):[chooseTarget(u,team)];
      emit('environment_attack',{source:u.id,targets:targets.map(t=>t.id),action:u.actions+1});
      for(const target of targets)damage(u,target,u.atk*(env.damageMultiplier??1),'environment');
      finishLifeEvent();
      // All target damage resolves before one decay, including blocked attacks.
      u.actions++;u.hp=Math.max(0,u.hp-env.decayPerAction);emit('environment_decay',{target:u.id,remaining:u.hp,amount:env.decayPerAction});
      if(u.hp>0)scheduleWave(time+env.interval,3+u.order/100,()=>enemyAction(u));return;
    }
    let target=chooseTarget(u,heroes);if(!target)return;
    const skill=u.skill&&u.cdRemaining<=EPS?u.skill:null;
    const aoe=skill?.id==='sweep';
    if(!aoe&&skill?.id!=='ward'){
      const p=HERO_BY_ID.kukalon.passive,guard=heroes.find(h=>h.id==='kukalon'&&h.hp/h.maxHp>p.requiredOwnHpStrictGreaterThan&&h!==target&&h.hp>0&&time>=(h.icd.redirect||0));
      if(guard&&target.hp/target.maxHp<p.allyThresholdStrictLessThan){guard.icd.redirect=time+p.internalCooldownSeconds;const protectedTarget=target.id;target=guard;emit('redirect',{source:guard.id,target:protectedTarget});}
    }
    let attack=u.atk;
    if(u===boss&&mechanic?.id==='vending'&&localTime()>=mechanic.overloadStart&&localTime()<mechanic.overloadEnd)attack*=1+mechanic.overloadAttackBonus;
    if(skill){u.cdRemaining=skill.cd;if(skill.id==='ward')addShield(u,u.maxHp*(skill.shieldHpFraction||.06),'enemy:shield',skill.duration||5);else for(const t of aoe?alive(heroes):[target])damage(u,t,attack*skill.multiplier,'active');}
    else damage(u,target,attack,'basic');
    let interval=u.interval;
    if(u===boss&&mechanic?.id==='clock')interval=localTime()%mechanic.period<mechanic.fastStartsAt?mechanic.slowInterval:mechanic.fastInterval;
    if(u===boss&&mechanic?.id==='cabinet')interval=Math.floor(localTime()/mechanic.phaseSeconds)%2===0?mechanic.lightInterval:mechanic.heavyInterval;
    scheduleWave(time+interval,3+u.order/100,()=>enemyAction(u));
  }
  function summon() {
    if(!boss||boss.hp<=0)return;
    for(let i=0;i<mechanic.summonCountEach;i++) {
      if(alive(enemies).filter(e=>e!==boss).length>=mechanic.maxAliveAdds)break;
      const cells=task.summonTemplate?.allowedSpawnCellsInOrder||[];if(!cells.length)for(let y=0;y<4;y++)for(const x of [0,3,1,2])cells.push({x,y});
      const cell=cells.find(p=>!alive(enemies).some(e=>p.x>=e.gridX&&p.x<e.gridX+e.w&&p.y>=e.gridY&&p.y<e.gridY+e.h));if(!cell)break;
      const order=enemies.length,u=stateUnit({id:`${task.id}-W${waveIndex+1}-S${order}`,side:'enemy',name:task.summonTemplate?.name||(mechanic.id==='printer'?'纸片人':mechanic.id==='mirror'?'镜像':'候车影'),maxHp:mechanic.summonHp,atk:mechanic.summonAtk,def:task.summonTemplate?.def||0,interval:task.summonTemplate?.interval||3,cdRemaining:Infinity,kind:'normal',row:cell.y,x:cell.x,y:-1-cell.y,gridX:cell.x,gridY:cell.y,w:1,h:1,order});enemies.push(u);emit('summon',{unit:publicUnit(u)});scheduleWave(time+(task.summonTemplate?.firstActionDelaySeconds??1),3+order/100,()=>enemyAction(u));
    }
  }
  function periodic(period,fn,start=period,end=90) {for(let at=start;at<=Math.min(end,BATTLE_LIMIT-waveStartedAt);at+=period)scheduleWave(waveStartedAt+at,1,()=>{if(boss?.hp>0)fn();});}
  function installMechanics() {
    if(!mechanic)return;
    for(const at of mechanic.summonTimes||[])scheduleWave(waveStartedAt+at,1,summon);
    if(mechanic.id==='rain'){
      periodic(mechanic.period,()=>{emit('mechanic',{text:'室内降雨'});for(const h of alive(heroes))damage(boss,h,boss.atk*mechanic.rainAtkMultiplier,'environment');});
      periodic(mechanic.shieldPeriod,()=>addShield(boss,boss.maxHp*mechanic.shieldHpFraction,'rain',mechanic.shieldDuration));
    }
    if(mechanic.id==='vending')periodic(mechanic.period,()=>{let drained=0;for(const h of alive(heroes))drained+=receive(boss,h,h.maxHp*mechanic.drainTargetMaxHpFraction,{tag:'drain',bypass:true}).hp;heal(boss,boss,Math.min(drained*mechanic.healFromActualDrain,boss.maxHp*mechanic.healPerTriggerBossHpCap));emit('mechanic',{text:'体温汲取'});},mechanic.period,mechanic.period*mechanic.maxTriggers);
    if(mechanic.id==='theatre')for(let at=mechanic.period;at<=BATTLE_LIMIT-waveStartedAt;at+=mechanic.period){scheduleWave(waveStartedAt+at-mechanic.warningSeconds,1,()=>{if(boss.hp>0){boss.theatreStart=time;boss.theatreDamage=0;emit('mechanic',{text:`谢幕蓄势：${mechanic.warningSeconds}秒内削减${mechanic.checkBossHpFraction*100}%生命可降低群伤`});}});scheduleWave(waveStartedAt+at,1,()=>{if(boss.hp>0){const mult=mechanic.aoeAttackMultiplier*(boss.theatreDamage>=boss.maxHp*mechanic.checkBossHpFraction?mechanic.passedDamageFactor:1);for(const h of alive(heroes))damage(boss,h,boss.atk*mult,'environment');boss.theatreStart=Infinity;}});}
    if(mechanic.id==='phone')periodic(mechanic.period,()=>{interferenceUntil=time+mechanic.duration;interferenceSpeed=mechanic.skillCooldownProgressSpeed;emit('mechanic',{text:`技能干扰：${mechanic.duration}秒内冷却流逝减慢`});schedule(time+mechanic.duration,1,()=>{});});
    if(mechanic.id==='terminal')periodic(mechanic.sweepPeriod,()=>{for(const h of alive(heroes))damage(boss,h,boss.atk*mechanic.sweepAttackMultiplier,'environment');});
    if(mechanic.id==='clock')periodic(mechanic.period,()=>emit('mechanic',{text:'报时：快速行动即将开始'}),Math.max(0,mechanic.fastStartsAt-2));
    if(mechanic.id==='cabinet')periodic(mechanic.phaseSeconds,()=>emit('mechanic',{text:Math.floor(localTime()/mechanic.phaseSeconds)%2?'重相：减伤提高':'轻相：速度提高，承伤增加'}));
  }
  function publicUnit(u){return {id:u.id,name:u.name,side:u.side,maxHp:u.maxHp,atk:u.atk,def:u.def,row:u.row,slot:u.slot,x:u.gridX??u.x,y:u.gridY??u.row,w:u.w,h:u.h,kind:u.kind,form:u.form,attackable:u.attackable!==false,environment:u.environment?clone(u.environment):null};}
  function enterWave(index){
    for(const u of enemies)for(const s of u.shields){counters.shieldExpired+=s.amount;emit('shield_expired',{target:u.id,targetSide:u.side,provider:s.provider||'other',source:s.source,amount:s.amount});}
    waveIndex=index;waveStartedAt=time;waveToken++;const wave=waves[index];mechanic=wave.mechanic||null;
    enemies=wave.enemies.map((e,i)=>stateUnit({id:e.id,side:'enemy',name:e.name,maxHp:e.hp,atk:e.atk,def:e.def,interval:e.interval,skill:e.skill,environment:e.environment,attackable:e.attackable,targetable:e.targetable,mustDefeat:e.mustDefeat,kind:e.type,row:e.y,x:e.x+(e.width-1)/2,y:-1-e.y-(e.height-1)/2,gridX:e.x,gridY:e.y,w:e.width,h:e.height,order:i,cdRemaining:e.firstSkillDelay??e.skill?.cd??Infinity}));
    boss=enemies.find(e=>e.kind==='boss');
    for(let i=0;i<enemies.length;i++){const e=enemies[i],spec=wave.enemies[i];scheduleWave(time+(spec.environment?.firstActionDelay??spec.firstActionDelay??1+.19*i),3+e.order/100,()=>enemyAction(e));}
    installMechanics();
    emit('wave',{index:index+1,total:waves.length,units:enemies.map(publicUnit),heroes:heroes.map(h=>({id:h.id,hp:h.hp,shield:totalShield(h),cooldown:h.cdRemaining,nextActionAt:h.nextActionAt,actions:h.actions,basics:h.basics,casts:h.casts,clutch:!!h.flags.clutch,form:h.form,warIntent:h.warIntent,cleaveCharges:h.cleaveCharges,linkUsed:!!h.flags.soulLink,key:h.key?clone(h.key):null,shields:clone(h.shields)}))});
  }
  refreshAuras();enterWave(0);finishLifeEvent();
  const initial=units().map(publicUnit);
  for(const h of heroes){
    for(const b of effect('opening_shield'))addShield(h,h.maxHp*b.parameters.max_hp_ratio,b.id,b.parameters.duration_s);
    for(const b of effect('periodic_shield'))for(let at=0;at<=90;at+=b.parameters.interval_s)schedule(at,1,()=>addShield(h,h.maxHp*b.parameters.max_hp_ratio,b.id,b.parameters.duration_s));
    h.nextActionAt=.7+.17*h.order;schedule(h.nextActionAt,2+h.order/100,()=>heroAction(h));
  }
  emit('frame',{units:snapshot()});
  while(queue.length&&!ended) {
    queue.sort((a,b)=>a.at-b.at||a.priority-b.priority||a.sequence-b.sequence);const event=queue.shift();time=event.at;if(time>90+EPS)break;
    const delta=time-previousTime,slowed=Math.min(delta,Math.max(0,interferenceUntil-previousTime));
    for(const u of units()){
      if(u.key&&u.key.until<=time+EPS){u.key=null;emit('buff_expired',{target:u.id,name:'非常棒的钥匙'});}
      for(const s of u.shields)if(s.until<=time+EPS){counters.shieldExpired+=s.amount;emit('shield_expired',{target:u.id,targetSide:u.side,provider:s.provider||'other',source:s.source,amount:s.amount});}
      u.shields=u.shields.filter(s=>s.until>time+EPS&&s.amount>EPS);
      u.cdRemaining=Math.max(0,u.cdRemaining-delta+(u.side==='hero'?slowed*(1-interferenceSpeed):0));
    }
    previousTime=time;event.fn();finishLifeEvent();emit('frame',{units:snapshot()});
    if(!alive(heroes).length)ended=true;
    else if(!alive(enemies).some(e=>e.mustDefeat!==false)){
      completedWaves++;
      if(completedWaves===waves.length)ended=true;
      else {enterWave(waveIndex+1);emit('frame',{units:snapshot()});}
    }
  }
  const outcome=alive(heroes).length&&completedWaves===waves.length?'win':'loss';
  return {outcome,duration:ended?time:BATTLE_LIMIT,waveCount:waves.length,completedWaves,initial,events,final:snapshot(),counters};
}
