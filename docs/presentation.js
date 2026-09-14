import { DATA, HERO_BY_ID, AFFIX_NAMES, TEMPLATE_BY_ID, baseItemStats } from './core.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num = value => Number(value).toLocaleString('zh-CN', {maximumFractionDigits:1});
export const percent = value => num(value * 100) + '%';
export const art = (id, small = false) => `./art/${id}${small ? '-battle' : ''}.webp`;
export const series = tier => DATA.equipment.tiers[tier - 1]?.name || '旧藏';
export const itemName = item => item.legacyName || TEMPLATE_BY_ID[item.templateId].name;
export const itemStatsText = item => Object.entries(baseItemStats(item)).filter(([,v]) => v).map(([key,value]) => `${AFFIX_NAMES[key]} ${num(value)}`).join(' · ');
export const slotIcons = ['⚔','◈','♙','⌑','♜','Ⅱ','═','♧','⌞','○','○','♢','✧','✦','◩'];

export function skillText(hero) {
  const a = hero.active;
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
    case 'all_enemy_direct_damage': return `对施放时全部存活敌人各造成${damage}伤害，可暴击，多格敌人只计算一次。`;
    case 'direct_and_dot': return `先造成${damage}的单体伤害，可暴击；再每${a.dot.tickIntervalSeconds}秒造成${percent(a.dot.tickAtkCoefficient)}攻击的持续伤害，共${a.dot.ticks}次，不暴击。自身只保留一个持续伤害目标，再次施放会刷新。`;
    case 'multi_dot': return `诅咒最多${a.maxTargets}名敌人，每${a.dot.tickIntervalSeconds}秒造成${percent(a.dot.tickAtkCoefficient)}攻击伤害，共${a.dot.ticks}次，不暴击。同一目标的自身诅咒刷新而不叠加。`;
    default: return a.name;
  }
}

export function passiveText(hero) {
  return {
    yan:'在前排时，受到的普通攻击伤害降低12%。',
    ling:'治疗前目标生命低于35%，本次主动治疗提高35%。',
    jin:'每完成三次普攻，向另一目标追加45%攻击伤害，不暴击，也不会触发新的追击。',
    shuo:'连续普攻同一目标，第二次起每次多6%伤害，最多18%；换目标或目标死亡时清空。主动技能不改变记录。',
    lan:'身上有任意来源护盾时，普攻伤害提高20%。',
    wudi:'每次自身行动结束，从生命比例最高的其他存活队友支付最多3%最大生命，将实付的160%转为持续8秒的护盾。队友至少保留1生命；护盾满时不再支付，无队友时不触发。',
    echoz:'每次持续伤害实际命中生命或护盾，积累一层暗影交织，最多三层；下次心灵震爆每层追加30%攻击倍率，施放时消耗全部层数。',
    kukalon:'队友生命低于35%、自身高于25%时，为其承受一次敌方单体攻击，按自身防御结算；8秒冷却。不拦截群伤、持续或环境伤害。',
    asuna:'灰烬觉醒结束后的两次自身行动，普攻及主动直接伤害提高30%；刷新但不叠加。',
    xiaocheng:'星辰坠落开始时有至少三名存活敌人，该次伤害提高25%；按敌人个数计数，不按占格计数。',
    suxiaoyao:'自身主动过量治疗的60%转为6秒护盾，上限为目标12%最大生命；护盾增幅不会再次放大。',
    sacred_druid:'普攻自己的标记目标且目标仍存活时，追加35%攻击伤害，不暴击、不触发新的追击。',
    bandebeidiwang:'诅咒目标死亡时，剩余诅咒转移到尚未被自己诅咒的敌人，优先前排。保留伤害、剩余次数与下次生效时间，不延长持续时间。',
    lancelot:'队友阵亡后两次自身行动伤害提高35%；最后独存时获得6秒无敌、审判立即就绪，后三次行动伤害提高150%。独存效果每场一次，单人开局和自己同时阵亡时不触发。',
    qinglian:'受到的敌方直接伤害经防御与减伤后，30%延期到接下来三次自身行动末支付。延期伤害可由护盾吸收、可致死，不再重复减伤；持续和环境伤害不延期。',
    makelong:'自身主动有效治疗的35%，在下一次自身行动结束时回补原目标，不再重复增幅或产生回响；施法者或目标阵亡时取消。',
  }[hero.id];
}

export function mechanicText(task) {
  const m = task.mechanic;
  if (!m) return '前排优先寻敌，击败全部敌人即可完成任务。';
  return {
    printer:'12、24、36秒各召唤一个纸片人；场上存在纸片人时，首领减伤15%。',
    rain:'每8秒降雨攻击全队，每16秒首领获得持续4秒的6%生命护盾。',
    clock:'每15秒为一轮，前10秒行动较慢，后5秒快速行动。',
    mirror:'12、27、42秒各召唤两个镜像，同时最多存在四个。',
    elevator:'生命首次降至一半时，获得12%最大生命护盾，攻击提高20%。',
    vending:'每12秒汲取全队1.8%最大生命，最多五次；实际汲取的一半用于自疗，每次不超过首领1.5%最大生命。60–75秒攻击提高25%。',
    theatre:'每18秒发动全体攻击；提前4秒蓄势，期间削减首领7%最大生命可使本次群伤减半。',
    cabinet:'每10秒切换相位：轻相行动更快、承伤提高20%；重相行动较慢、减伤提高20%。',
    phone:'每18秒干扰4秒，期间己方技能冷却流逝减半。',
    terminal:'15、35、55秒各召唤两个候车影，同时最多四个；每20秒攻击全队。',
  }[m.id];
}
