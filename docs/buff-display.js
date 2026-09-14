import { chosenBuffs } from './catalog.js';

// Use the same parameter resolution as combat, including a selected enhancement.
export function buffDisplay(id, enhanced = false) {
  const b = chosenBuffs({buffs:[id],enhancedBuff:enhanced?id:null})[0];
  if (!b) throw new Error('未知强化');
  const p=b.parameters, pct=v=>`${Math.round(v*10000)/100}%`;
  let summary, detail='';
  const damageScope='只影响特工自身普攻和技能；追击、复制与耗盾造成的伤害除外。';
  switch(b.effect_type) {
    case 'repeat_basic': summary=`每${p.every_basic}次普攻，追加${pct(p.ratio)}伤害。`;detail='追击不暴击，目标已死亡时取消；追击不会再次计数。';break;
    case 'repeat_active': summary=`每${p.every_active}次主动技能，额外复制${pct(p.ratio)}直接伤害、治疗或护盾。`;detail='不复制持续效果、回响、耗盾伤害、生命支付、冷却重置或被动；复制效果不暴击，也不会再次计数。';break;
    case 'focus_basic': summary=`连续普攻同一目标，第二次起每次伤害+${pct(p.per_stack)}，最多+${pct(p.per_stack*p.max_stacks)}。`;detail='换目标或目标死亡时重置。';break;
    case 'stat': summary='全队'+Object.entries(p).map(([k,v])=>`${{atk_pct:'攻击',hp_pct:'最大生命',def_pct:'防御'}[k]}+${pct(v)}`).join('、')+'。';break;
    case 'periodic_shield': summary=`开战及每${p.interval_s}秒获得${pct(p.max_hp_ratio)}最大生命护盾，持续${p.duration_s}秒。`;detail='覆盖全队存活特工；同一强化的护盾保留较大剩余量，不累加。换波不重复触发开场效果。';break;
    case 'overheal_shield': summary=`受敌伤后，过量治疗的${pct(p.overflow_ratio)}转为${p.duration_s}秒护盾，单次最多${pct(p.per_proc_max_hp_cap)}最大生命。`;detail=`治疗前须仍有敌伤缺口，且最近${p.recent_enemy_damage_s}秒受到过敌方生命伤害。与角色自身转盾的总转化比例最多${pct(p.combined_overflow_conversion_cap)}，只缩减本强化新增部分，不削弱角色自己的护盾。`;break;
    case 'support': summary=`全队治疗+${pct(p.healing_pct)}、护盾+${pct(p.shield_pct)}。`;detail='不会再次放大回响、吸血或过量治疗转成的护盾。';break;
    case 'haste': summary=`全队行动间隔缩短${pct(p.interval_reduction)}。`;break;
    case 'cooldown': summary=`全队主动技能冷却缩短${pct(p.cdr)}。`;break;
    case 'tempo': summary=`全队行动间隔缩短${pct(p.interval_reduction)}、主动冷却缩短${pct(p.cdr)}。`;break;
    case 'opening_reduction': summary=`开战前${p.duration_s}秒，前排减伤+${pct(p.reduction)}。`;detail='按开场站位确定；换波不重置时长。';break;
    case 'low_hp_shield': summary=`首次被敌伤打至生命低于${pct(p.threshold)}，获得${pct(p.max_hp_ratio)}最大生命护盾，持续${p.duration_s}秒。`;detail=`每名特工每场${p.max_per_unit_battle}次，须仍存活；友方生命支付不触发。`;break;
    case 'on_enemy_hit_shield': summary=`承受${p.hits}次敌方直接生命伤害，获得${pct(p.max_hp_ratio)}最大生命护盾，持续${p.duration_s}秒。`;detail=`每人冷却${p.icd_s}秒。护盾完全吸收、持续伤害和环境伤害不计次数。`;break;
    case 'opening_shield': summary=`全队开战获得${pct(p.max_hp_ratio)}最大生命护盾，持续${p.duration_s}秒。`;detail=`每场${p.max_per_unit_battle}次，换波不重复。`;break;
    case 'emergency_heal': summary=`首次被敌伤打至生命低于${pct(p.threshold)}，恢复${pct(p.max_hp_ratio)}最大生命。`;detail=`每人每场${p.max_per_unit_battle}次，仅补回敌伤造成的缺口；须仍存活，不会复活。`;break;
    case 'conditional_reduction': summary=`生命低于${pct(p.threshold)}时，减伤+${pct(p.reduction)}。`;break;
    case 'lifesteal': summary=`普攻和主动直接伤害的${pct(p.ratio)}回复自身生命，每秒最多${pct(p.max_hp_per_second_cap)}最大生命；仅补敌伤损失。`;detail='按实际扣除的敌方生命计算，仅补敌伤缺口。持续伤害、追击和耗盾伤害不触发。';break;
    case 'conditional_damage': summary=`生命低于${pct(p.threshold)}时，普攻和主动伤害+${pct(p.damage_pct)}（不含追击与耗盾伤害）。`;detail=damageScope;break;
    case 'delayed_heal': summary=`主动治疗后${p.delay_s}秒，追加${pct(p.ratio)}治疗，单次最多${pct(p.max_hp_ratio_cap)}目标最大生命；仅补敌伤损失。`;detail='按本次补回的敌伤缺口计算，追加时也只补敌伤缺口；目标阵亡时取消。';break;
    case 'action_ramp': summary=`每次行动后，普攻和主动伤害+${pct(p.per_stack)}，最多${p.max_stacks}层（${pct(p.per_stack*p.max_stacks)}）。`;detail='下次行动起生效，换波保留。'+damageScope;break;
    case 'next_basic': summary=`主动技能后，下一次普攻伤害+${pct(p.bonus)}，${p.duration_s}秒内有效。`;detail=`最多保留${p.max_stacks}层，追击不消耗也不触发。`;break;
    case 'post_active_shield': summary=`主动技能后获得${pct(p.max_hp_ratio)}最大生命护盾，持续${p.duration_s}秒。`;detail=`每人冷却${p.icd_s}秒。`;break;
    case 'damage': summary='全队'+Object.entries(p).map(([k,v])=>`${k==='basic_pct'?'普攻':'主动技能'}伤害+${pct(v)}`).join('、')+'。';detail=damageScope;break;
    case 'position_reduction': summary=`前排减伤+${pct(p.reduction)}。`;detail='按开场站位确定。';break;
    case 'position_damage': summary=`后排普攻和主动伤害+${pct(p.damage_pct)}。`;detail='按开场站位确定。'+damageScope;break;
    case 'position_support': summary=`前排受到的治疗+${pct(p.healing_pct)}、护盾+${pct(p.shield_pct)}。`;detail='按开场站位确定，与其他同类增幅相加。';break;
    case 'interference_basic': summary=`普攻伤害+${pct(p.normal_bonus)}；受技能干扰时改为+${pct(p.interfered_bonus)}。`;detail='两项不叠加；技能正常冷却不算干扰。';break;
    case 'basic_cooldown': summary=`每${p.every_basic}次普攻，主动剩余冷却减少${p.reduce_s}秒。`;detail=`每轮冷却最多减少${p.max_per_cycle_s}秒，不能早于基础冷却的${pct(p.ready_floor_base_cd_ratio)}就绪；不额外插入行动。`;break;
    case 'enhance_owned': summary=`选择一项可精修强化，将其指定效果提高${pct(p.magnitude_bonus)}。`;detail='可选目标和提升后的效果在确认前显示；触发次数、时长、上限及间隔保持原值。';break;
    default: throw new Error(`未提供强化文案：${b.effect_type}`);
  }
  return {name:b.name,summary,detail,parameters:p};
}
