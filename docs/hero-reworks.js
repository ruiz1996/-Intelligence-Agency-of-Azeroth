// Adopted designs: Xiaocheng v0.10, Band/Asuna v0.14, Druid v0.15, Yuliang v0.18.
// Keep the original catalog as a historical baseline; collection IDs are unchanged.
export function applyHeroRework(hero){
  if(hero.id==='xiaocheng')return {...hero,role:'aoe_splash',
    active:{name:'艾露恩之怒',kind:'primary_and_splash_damage',cooldownSeconds:10,primaryAtkCoefficient:3,secondaryAtkCoefficient:.8,targetSnapshotAtStart:true,canCrit:true},
    passive:{name:'星火术',kind:'basic_all_secondary_splash',secondaryAtkCoefficient:.25,canCrit:false,inheritBasicDamageBonuses:true,canTriggerOtherFollowups:false},
  };
  if(hero.id==='bandebeidiwang')return {...hero,
    active:{...hero.active,directAtkCoefficient:.4,singleTargetLayers:2,
      dot:{...hero.active.dot,tickAtkCoefficient:.35,perTargetOwnInstances:null,sameSourceRefresh:false}},
    passive:{...hero.passive,target:'可攻击存活敌人，可已有本人诅咒；前排优先→离死者最近→固定站位',allowsCursedTarget:true},
  };
  if(hero.id==='asuna')return {...hero,active:{...hero.active,atkCoefficient:1.9,maxTargets:5}};
  if(hero.id==='sacred_druid')return {...hero,active:{...hero.active,dot:{...hero.active.dot,tickAtkCoefficient:.35}}};
  if(hero.id==='yuliang')return {...hero,forms:{...hero.forms,offense:{...hero.forms.offense,
    active:{...hero.forms.offense.active,atkCoefficient:3.2,executeMultiplier:1.8,intrinsicFormula:'3.2*casterATK*(1+0.10*warIntentStacks)*(targetHpRatio<=0.35?1.8:1)'},
  }}};
  return hero;
}
