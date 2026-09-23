import { DATA, HERO_BY_ID, AFFIX_NAMES, TEMPLATE_BY_ID, baseItemStats } from './core.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num = value => Number(value).toLocaleString('zh-CN', {maximumFractionDigits:1});
export const percent = value => Number(value*100).toLocaleString('zh-CN',{maximumFractionDigits:4}) + '%';
export const art = (id, small = false) => `./art/${id}${['jinnailuo','dunjigaoshou'].includes(id)?'.svg':(small?'-battle':'')+'.webp'}?v=${id==='juwoyaer'?'20260922-corrected':'20260922'}`;
export const series = tier => DATA.equipment.tiers[tier - 1]?.name || '旧藏';
export const itemName = item => item.legacyName || TEMPLATE_BY_ID[item.templateId].name;
export const itemStatsText = item => Object.entries(baseItemStats(item)).filter(([,v]) => v).map(([key,value]) => `${AFFIX_NAMES[key]} ${num(value)}`).join(' · ');
export const slotIcons = ['⚔','◈','♙','⌑','♜','Ⅱ','═','♧','⌞','○','○','♢','✧','✦','◩'];

export function star5Summary(hero){return {
  wudi:'这样中！有盾攻击后全队伤害提高10%，持续5秒；无盾施放后再给全队各提供5%最大生命护盾。',
  echoz:'普攻施加吸血鬼之触，优先攻击未被标记的敌人；直伤向带有本人持续伤害的其他目标溅射20%。',
  kukalon:'盾墙期间本人伤害提高20%。',asuna:'灰烬觉醒后的下次普攻附加主目标160%攻击伤害，并对其他敌人各造成40%攻击伤害。',
  xiaocheng:'施放艾露恩之怒前获得4秒20%伤害加成。',suxiaoyao:'每场一次，致死时恢复至20%生命并无敌3秒；可触发兰斯洛普通惩戒光环。',
  sacred_druid:'施放自然之力后，接下来两次普攻伤害提高35%。',bandebeidiwang:'实际扣血的15%转为8秒自身护盾，本来源最多50%最大生命。',
  lancelot:'每次原生审判独立有8%概率触发6秒无敌与三次行动150%增伤。',qinglian:'施放活血酒时对所有敌人造成80%攻击伤害，并降低其伤害10%持续5秒。',
  makelong:'梦境吐息额外治疗每名目标施法前已损失生命的10%。',kuodaya:'本人常驻额外减伤10%。',
  yuliang:'一次主动同时获得无视苦痛护盾并释放致死打击；防御形态额外减伤增加3个百分点。',
  xifeng:'每2秒为所有存活队友恢复12%攻击的生命；灵魂链接触发后立即补一次治疗雨。',hasika:'有10%概率闪避敌方普通或主动直接伤害。',
  ailianna:'队友每次原生主动有20%概率触发爱莲娜一次额外普攻。',mozhate:'原生普攻有20%概率向全敌施加4秒烈火符咒持续伤害。',
  jinnailuo:'原生普攻命中后附加6秒寒冷。',juwoyaer:'生命低于20%或遭致死伤害时，每场一次获得3秒无敌。',
  zhangdanaodai:'多目标时向不同主目标额外释放飞盾，每发均可弹射至多3名敌人；额外飞盾伤害为原倍率30%。',
  dunjigaoshou:'光铸祝福距离越近治疗越强：自身172.5%、相邻165%、两格157.5%、三格150%攻击。',
}[hero.id]||'';}
export function skillSummary(hero) {
  const a=hero.active,damage=percent(a.atkCoefficient)+'攻击';
  switch(a.kind){
    case 'ailianna': return `对全部敌人各造成${percent(a.coefficient)}攻击伤害；施法时仅有一名敌人则乘${a.singleMultiplier}。可暴击。`;
    case 'mozhate': return `受伤时先消耗全部灵魂，自疗${percent(a.baseHealMaxHp)}最大生命＋每魂${percent(a.healPerSoulMaxHp)}最大生命；再对最多3敌各造成${percent(a.coefficient)}攻击伤害。满血保留灵魂。`;
    case 'jinnailuo': return `对最多2敌各攻击两次，合计${percent(a.coefficient)}攻击伤害，可独立暴击；施加${hero.passive.star5?.chillDuration||a.chillDuration}秒冰冷，普通行动频率降低15%。`;
    case 'juwoyaer': return `对当前生命点数最多的敌人造成${percent(a.coefficient)}攻击伤害；累计本人接下来3次普攻及风暴对全体敌人的实际扣血，结束时将${percent(hero.passive.star5?.settlementRatio||a.settlementRatio)}追加给宣判目标。窗口最多12秒，目标死亡不转移。`;
    case 'zhangdanaodai': return `飞盾攻击主目标并弹射其他敌人，最多3个不同目标，各造成${percent(a.coefficient)}攻击伤害，可暴击。`;
    case 'dunjigaoshou': return `对全体敌人各造成${percent(a.coefficient)}攻击伤害，可暴击；无敌人但队友受伤时仍可施放。`;

    case 'form_dispatch': return '单手或空主手：无视苦痛与防御姿态；双手：致死打击与战斗姿态。战前换装切换，整场三波锁定。';
    case 'random_other_ally_effect_bonus': return `随机另一名存活队友获得「${a.buffName}」：伤害、治疗和护盾效果各+${percent(a.damageBonus)}，持续${a.durationSeconds}秒。`;
    case 'self_shield': return `获得自身${percent(a.shieldMaxHpFraction)}最大生命的护盾，持续${a.shieldDurationSeconds}秒。`;
    case 'execute_direct_damage_with_war_intent': return `对当前目标造成${damage}伤害，每层战意再提高${percent(hero.passive.damageBonusPerStack)}；命中前目标生命≤${percent(a.executeThresholdLessThanOrEqual)}时再提高${percent(a.executeMultiplier-1)}。消耗全部战意。`;
    case 'distinct_injured_ally_chain_heal': return `依次治疗最多3名不同的受伤队友，回复${a.jumpCoefficients.map(percent).join(' / ')}攻击的生命，优先生命比例低者。`;
    case 'direct_damage_then_basic_followup_window': return `对当前目标造成${damage}伤害，刷新后续2次有效普攻的野兽顺劈。`;
    case 'single_direct_damage': return `对目标造成${damage}伤害。`;
    case 'multi_direct_damage': return `对最多${a.maxTargets}名敌人各造成${damage}伤害。`;
    case 'primary_and_splash_damage': return `对主目标造成${percent(a.primaryAtkCoefficient)}攻击伤害，对所有其他敌人各造成${percent(a.secondaryAtkCoefficient)}攻击伤害。`;
    case 'all_enemy_direct_damage': return `对全体敌人各造成${damage}伤害。`;
    case 'execute_direct_damage': return `攻击生命比例最低的敌人，造成${damage}伤害；目标生命低于${percent(a.thresholdStrictLessThan)}时，本次伤害+${percent(a.executeMultiplier-1)}。`;
    case 'self_heal_shield': return `恢复${percent(a.healMaxHpFraction)}自身最大生命，获得${percent(a.shieldMaxHpFraction)}最大生命护盾，持续${a.shieldDurationSeconds}秒。`;
    case 'lowest_hp_heal': return `治疗生命比例最低的己方特工，恢复${damage}的生命。${hero.id==='suxiaoyao'?'满血时可按庇护条件补盾。':''}`;
    case 'all_ally_heal': return `全队各恢复${damage}的生命。`;
    case 'self_and_ally_shield': return `为自己及生命比例最低的另一名队友各提供${damage}护盾，持续${a.durationSeconds}秒。`;
    case 'shield_branch': return `有盾：造成当前护盾${percent(a.shieldPresent.damageCoefficient)}的伤害，消耗${percent(a.shieldPresent.spendFraction)}护盾（不暴击、不受攻击加成）。无盾：获得${percent(a.shieldAbsent.maxHpFraction)}最大生命护盾，持续${a.shieldAbsent.durationSeconds}秒。`;
    case 'self_damage_reduction': return `${a.durationSeconds}秒内减伤+${percent(a.reduction)}；不减少友方生命支付或已计算的醉伤。`;
    case 'direct_and_dot': return `造成${damage}伤害，再每${a.dot.tickIntervalSeconds}秒造成${percent(a.dot.tickAtkCoefficient)}攻击伤害，共${a.dot.ticks}次；持续伤害不暴击。`;
    case 'multi_dot': return `对最多${a.maxTargets}名敌人各造成${percent(a.directAtkCoefficient)}攻击伤害并施加诅咒，每${a.dot.tickIntervalSeconds}秒造成${percent(a.dot.tickAtkCoefficient)}攻击伤害，共${a.dot.ticks}次。仅一个敌人时施加两层；各层独立叠加。`;
    default:return skillText(hero);
  }
}
export function passiveSummary(hero){if(hero.star3Fields)return passiveText(hero);if(['kuodaya','yuliang','xifeng','hasika'].includes(hero.id))return passiveText(hero);return {
  yan:'前排受到的普攻伤害降低12%。',ling:'目标生命低于35%时，主动治疗+35%。',jin:'每三次普攻，向另一目标追加45%攻击伤害，不暴击。',
  shuo:'连续普攻同一目标，第二次起每次伤害+6%，最多+18%；换目标或目标死亡时清空。',lan:'有护盾时，普攻伤害+20%。',
  wudi:'每次自身行动结束，所有其他存活队友各支付最多5%最大生命，至少留1生命；实际总支付的40%转为自身8秒护盾。容量不足按比例减少支付，满盾不扣血。',
  echoz:'持续伤害每次命中生命或护盾，下次心灵震爆多30%攻击倍率，最多三层；施放时消耗。',
  kukalon:'队友生命低于35%、自身高于25%时，替其承受一次敌方单体攻击，冷却8秒；不拦截群伤、持续或环境伤害。',
  asuna:'灰烬觉醒结束后两次行动，普攻和主动直接伤害+30%。',xiaocheng:'普攻有效命中主目标时，对所有其他敌人各造成25%攻击的溅射伤害，不暴击。',
  suxiaoyao:'主动过量治疗的60%转为6秒护盾，最多目标12%最大生命。',sacred_druid:'普攻自己的标记目标，追加35%攻击伤害，不暴击。',
  bandebeidiwang:'诅咒目标死亡时，剩余各层转移给其他敌人，可以叠加已有诅咒；保留次数和生效时间。',
  lancelot:'队友阵亡后两次行动伤害+35%；最后独存时触发6秒无敌、审判就绪，后三次行动伤害+150%。独存每场一次；单人开局或同时阵亡不触发。',
  qinglian:'敌方直接伤害的30%分摊至接下来三次自身行动结束时支付，可被护盾吸收、可致死；持续和环境伤害不分摊。',
  makelong:'主动有效治疗的35%，在下次自身行动后回补原目标；双方任一阵亡时取消。',
}[hero.id];}

export function skillCopy(hero, passive=false){
  const summary=passive?passiveSummary(hero):skillSummary(hero),detail=passive?passiveText(hero):skillText(hero);
  const fifth=passive&&hero.passive.star5?`<p>五星 · ${esc(hero.passive.star5.name)}：${esc(star5Summary(hero))}</p>`:'';
  return `<p>${esc(summary)}</p>${summary!==detail?`<details class="effect-details"><summary>效果详情</summary><p>${esc(detail)}</p></details>`:''}${fifth}`;
}

export function skillText(hero) {
  const a = hero.active;
  if(hero.star3Fields)return skillSummary(hero);
  if(['kuodaya','yuliang','xifeng','hasika'].includes(hero.id))return skillSummary(hero)+(hero.id==='kuodaya'?'本人不在随机目标中；没有其他存活队友时保留技能。增益不增加攻击属性或行动速度，复制与转换效果不重复放大。':hero.id==='yuliang'?'战前装备决定形态，整场三波锁定；单手缺盾或空主手仍可使用防御技能。':hero.id==='xifeng'?'全队满血时保留技能，不会重复治疗同一目标。':'追击窗口不叠加，换波保留剩余次数；灵兽不占据战场格。');
  const damage = `${num(a.atkCoefficient * 100)}%攻击`;
  switch (a.kind) {
    case 'self_heal_shield': return `恢复自身${percent(a.healMaxHpFraction)}最大生命，并获得${percent(a.shieldMaxHpFraction)}最大生命护盾，持续${a.shieldDurationSeconds}秒。满血也可施放。`;
    case 'lowest_hp_heal': return `治疗生命比例最低的己方特工（含自己），恢复${damage}的生命。${hero.id === 'suxiaoyao' ? '全队满血时，可为庇护最少的队友补盾；已有庇护达到理论新盾一半时保留技能。' : '全队满血时普攻并保留技能。'}`;
    case 'all_ally_heal': return `治疗全部存活队友（含自己），每人恢复${damage}的生命。全队满血时普攻并保留技能。`;
    case 'self_and_ally_shield': return `为自己与生命比例最低的另一位队友各提供${damage}的护盾，持续${a.durationSeconds}秒。独自出战时只保护自己。`;
    case 'shield_branch': return `有盾时：按当前护盾的${percent(a.shieldPresent.damageCoefficient)}造成单体伤害，并消耗${percent(a.shieldPresent.spendFraction)}护盾；不暴击、不受攻击增幅。无盾时：获得${percent(a.shieldAbsent.maxHpFraction)}最大生命护盾，持续${a.shieldAbsent.durationSeconds}秒。每次只执行一种效果。`;
    case 'self_damage_reduction': return `${a.durationSeconds}秒内受到的敌方伤害额外降低${percent(a.reduction)}，不影响友方生命支付或已计算的延期伤害。`;
    case 'random_purify_or_shield': return '65%概率清除60%剩余醉伤，无醉伤时获得4%最大生命护盾；35%概率获得12%最大生命护盾。护盾持续5秒，先清除醉伤再支付本次分期。';
    case 'execute_direct_damage': return `攻击生命比例最低的敌人，造成${damage}伤害；目标生命低于${percent(a.thresholdStrictLessThan)}时，本次伤害再提高${percent(a.executeMultiplier - 1)}。`;
    case 'single_direct_damage': return `对当前目标造成${damage}的单体伤害，可暴击。`;
    case 'multi_direct_damage': return `对最多${a.maxTargets}名敌人分别造成${damage}伤害，可暴击，优先前排。`;
    case 'primary_and_splash_damage': return skillSummary(hero)+'主副目标分别判定暴击；多格敌人只命中一次，主目标不重复承受溅射。主动不会触发星火术，技能复写只复制本次直接伤害。';
    case 'all_enemy_direct_damage': return `对施放时全部存活敌人各造成${damage}伤害，可暴击，多格敌人只计算一次。`;
    case 'direct_and_dot': return `先造成${damage}的单体伤害，可暴击；再每${a.dot.tickIntervalSeconds}秒造成${percent(a.dot.tickAtkCoefficient)}攻击的持续伤害，共${a.dot.ticks}次，不暴击。自身只保留一个持续伤害目标，再次施放会刷新。`;
    case 'multi_dot': return skillSummary(hero)+'即时伤害每个目标仅一次，可暴击和复写；持续伤害不暴击、不复制，每层保留施法时攻击快照。新旧诅咒互不覆盖、不刷新；即时伤害击杀目标后不追加施加层数。';
    default: return a.name;
  }
}

export function passiveText(hero) {
  const p=hero.passive;
  if(hero.star3Fields)return ({ailianna:'其他存活队友每次成功施放原生主动，当前剩余冷却减少0.5秒；复制与被动不触发，就绪后等下一次自身行动。',mozhate:'每累计承受10%最大生命的敌方实际扣血，获得1枚灵魂，最多5枚。护盾吸收、友方支付不计；跨波保留。',jinnailuo:'普攻命中自身冰冷目标时，主目标造成125%攻击伤害，并向另一名敌人追加40%攻击伤害（不暴击），优先自身冰冷目标。',juwoyaer:'宣判后3次原生普攻变为范围攻击：主目标100%攻击，其他敌人各35%攻击，可暴击；派生伤害不再次累计。',zhangdanaodai:'飞盾实际扣血的200%转为自身8秒护盾，本来源上限30%最大生命。全来源上限60%；护盾吸收和过量伤害不产盾。',dunjigaoshou:'每次成功施放正义盾击，所有存活队友（含自己）各恢复'+percent(p.star5?.healPerAllyAtk||p.healPerAllyAtk)+'攻击的生命。独立于伤害、敌人数和免疫，不暴击。'})[hero.id]+(p.star5?' 五星被动已生效：'+p.star5.name+'。':'');
  if(hero.id==='yuliang')return hero.form==='offense'?'原生普攻实际命中生命或护盾后获得1层战意，最多3层，每层使下次致死打击的内部倍率+10%。主动消耗全部层数；复制、追击不叠层，换波保留。':'敌方伤害额外减伤12个百分点，与其他适用减伤相加后封顶60%。不要求持盾或前排，不减少生命支付或已计算的醉伤。';
  return {
    kuodaya:'KKT：本人存活时，其他存活队友攻击属性+15个百分点，与其他攻击属性加成相加。本人不受益；阵亡时光环消失，已发出的钥匙保留到原到期。',
    xifeng:'任一存活队友生命≤25%时，所有存活队友的实际生命点数均分；达到个人上限的余量继续分给其他人。整场三波仅1次，不复活、不拦截致死伤害，不作为治疗或伤害。希风阵亡或仅剩1人时不触发。',
    hasika:'有顺劈次数时，原生普攻实际命中生命或护盾后消耗1次：主目标追加50%攻击伤害，另最多2名存活敌人各承受25%攻击伤害。追击不暴击、不递归；主目标被普攻击杀时仍可顺劈其他目标。',
    yan:'在前排时，受到的普通攻击伤害降低12%。',
    ling:'治疗前目标生命低于35%，本次主动治疗提高35%。',
    jin:'每完成三次普攻，向另一目标追加45%攻击伤害，不暴击，也不会触发新的追击。',
    shuo:'连续普攻同一目标，第二次起每次多6%伤害，最多18%；换目标或目标死亡时清空。主动技能不改变记录。',
    lan:'身上有任意来源护盾时，普攻伤害提高20%。',
    wudi:'每次自身行动结束，所有其他存活队友各支付最多5%最大生命，至少留1生命；实际总支付的40%转为自身8秒护盾。容量不足按比例减少支付，满盾不扣血。',
    echoz:'每次持续伤害实际命中生命或护盾，积累一层暗影交织，最多三层；下次心灵震爆每层追加30%攻击倍率，施放时消耗全部层数。',
    kukalon:'队友生命低于35%、自身高于25%时，为其承受一次敌方单体攻击，按自身防御结算；8秒冷却。不拦截群伤、持续或环境伤害。',
    asuna:'灰烬觉醒结束后的两次自身行动，普攻及主动直接伤害提高30%；刷新但不叠加。',
    xiaocheng:'原生普攻击中生命或护盾后，向出手时所有其他可攻击敌人各溅射25%攻击伤害，继承本次普攻增伤；各目标独立计算防御，溅射不暴击。主目标被击杀仍会溅射；复写弹和主动不触发，不跨波、不计为额外普攻。',
    suxiaoyao:'自身主动过量治疗的60%转为6秒护盾，上限为目标12%最大生命；护盾增幅不会再次放大。',
    sacred_druid:'普攻自己的标记目标且目标仍存活时，追加35%攻击伤害，不暴击、不触发新的追击。',
    bandebeidiwang:'诅咒目标死亡时，剩余各层转移到同波其他可攻击敌人，优先前排、离死者最近者，可转入已有自身诅咒的目标。每层移动而不复制，保留攻击快照、剩余跳数与原下次时刻；不延长、不重放即时伤害、不跨波。',
    lancelot:'队友阵亡后两次自身行动伤害提高35%；最后独存时获得6秒无敌、审判立即就绪，后三次行动伤害提高150%。独存效果每场一次，单人开局和自己同时阵亡时不触发。',
    qinglian:'受到的敌方直接伤害经防御与减伤后，30%延期到接下来三次自身行动末支付。延期伤害可由护盾吸收、可致死，不再重复减伤；持续和环境伤害不延期。',
    makelong:'自身主动有效治疗的35%，在下一次自身行动结束时回补原目标，不再重复增幅或产生回响；施法者或目标阵亡时取消。',
  }[hero.id];
}

export const roleText = h => ({output:'输出',backline_support:'后排辅助',weapon_form_hybrid:'双形态战士',chain_healer:'链式治疗',single_cleave:'单体与顺劈',tank:'守卫',offtank:'战士',healer:'治疗',single:'单体输出',aoe:'群体输出',aoe_burst:'爆发输出',aoe_all:'群体输出',aoe_splash:'全场溅射',aoe_dot:'持续伤害',single_clutch:'单体输出',group_healer:'群体治疗'}[h.role] || '特工');
export function mechanicText(task) {
  const m=task.waves?.at(-1)?.mechanic;
  if(!m)return '连续完成三波；队伍生命、护盾和技能冷却保留。';
  const times=m.summonTimes?.join('、');
  const text={
    printer:`第${times}秒各召唤${m.summonCountEach}个纸片人；仍有纸片人时首领减伤${percent(m.protectionWhileAdds)}。`,
    rain:`每${m.period}秒降雨攻击全队，每${m.shieldPeriod}秒获得${percent(m.shieldHpFraction)}生命护盾，持续${m.shieldDuration}秒。`,
    clock:`每${m.period}秒一轮：前${m.fastStartsAt}秒每${m.slowInterval}秒行动，后${m.fastDuration}秒每${m.fastInterval}秒行动。`,
    mirror:`第${times}秒各召唤${m.summonCountEach}个镜像，同时最多${m.maxAliveAdds}个。`,
    elevator:`生命首次降至${percent(m.threshold)}时，获得${percent(m.shieldHpFraction)}最大生命护盾，攻击提高${percent(m.attackBonus)}。`,
    vending:`每${m.period}秒汲取全队${percent(m.drainTargetMaxHpFraction)}最大生命，最多${m.maxTriggers}次。实付的${percent(m.healFromActualDrain)}用于自疗，每次不超过首领${percent(m.healPerTriggerBossHpCap)}最大生命；${m.overloadStart}–${m.overloadEnd}秒攻击提高${percent(m.overloadAttackBonus)}。`,
    theatre:`每${m.period}秒攻击全队，提前${m.warningSeconds}秒蓄势；蓄势期间削减首领${percent(m.checkBossHpFraction)}最大生命，本次群伤降至${percent(m.passedDamageFactor)}。`,
    cabinet:`每${m.phaseSeconds}秒切换相位：轻相每${m.lightInterval}秒行动、承伤+${percent(m.lightDamageTakenBonus)}；重相每${m.heavyInterval}秒行动、减伤${percent(m.heavyReduction)}。`,
    phone:`每${m.period}秒干扰${m.duration}秒，期间己方技能冷却流逝速度降至${percent(m.skillCooldownProgressSpeed)}。`,
    terminal:`第${times}秒各召唤${m.summonCountEach}个候车影，同时最多${m.maxAliveAdds}个；每${m.sweepPeriod}秒攻击全队。`,
  }[m.id];
  return '以下时间从第三波入场起计算。'+text;
}
