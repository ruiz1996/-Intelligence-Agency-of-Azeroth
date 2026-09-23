// September 23 roster design. These replace the six previously released effects.
export const FIVE_STAR = {
  wudi:{name:'不赖',design:'not_bad',damageBonus:.10,duration:5,teamShield:.05,shieldDuration:6},
  echoz:{name:'吸血鬼之触',design:'vampiric_touch',tickCoefficient:.20,splashRatio:.20},
  kukalon:{name:'天神下凡',design:'avatar',damageBonus:.20},
  asuna:{name:'圣光之锤',design:'holy_hammer',primary:1.6,splash:.40,duration:8},
  xiaocheng:{name:'月蚀',design:'eclipse',damageBonus:.20,duration:4},
  suxiaoyao:{name:'救赎之魂',design:'redemption',restoreFraction:.20,invulnerableSeconds:3},
  sacred_druid:{name:'化身：艾露恩之眷',design:'elune_avatar',basics:2,basicBonus:.35},
  bandebeidiwang:{name:'吸取灵魂',design:'soul_siphon',ratio:.15,cap:.50,duration:8},
  lancelot:{name:'审判惩戒',design:'judgment_clutch',chance:.08},
  qinglian:{name:'火焰吐息',design:'fire_breath',coefficient:.80,damageDown:.10,duration:5},
  makelong:{name:'回溯',design:'rewind',missingFraction:.10},
  kuodaya:{name:'DK保护协会',design:'dk_guard',reduction:.10},
  yuliang:{name:'双修',design:'dual_cultivation',defenseReductionBonus:.03},
  xifeng:{name:'治疗之雨',design:'healing_rain',ratio:.12},
  hasika:{name:'后跳',design:'backstep',dodgeChance:.10},
  ailianna:{name:'出列',design:'step_out',chance:.20},
  mozhate:{name:'烈火符咒',design:'fire_rune',chance:.20,tickCoefficient:.25},
  jinnailuo:{name:'冰霜精通',design:'frost_mastery',duration:6},
  juwoyaer:{name:'圣盾术',design:'divine_shield',invulnerableSeconds:3},
  zhangdanaodai:{name:'圣洁鸣钟',design:'holy_bell',extraRatio:.30},
  dunjigaoshou:{name:'光明使者',design:'proximity_heal',selfMultiplier:1.15,step:.05},
};

export function applyFiveStar(hero){
  const star5=FIVE_STAR[hero.id];
  if(!star5)return hero;
  if(hero.id==='suxiaoyao')return {...hero,active:{...hero.active,atkCoefficient:4.4},star5};
  return {...hero,star5};
}
