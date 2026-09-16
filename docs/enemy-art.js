// Visual metadata only. Resolve catalogue entries to stable unit IDs once;
// combat never guesses a creature from its display name.
import {TASKS} from './core.js';

const families = {
  biter: '小型撕咬虫|中型撕咬虫|大型撕咬虫|巨型撕咬虫|虫群甲虫',
  spitter: '小型喷吐虫|中型喷吐虫|大型喷吐虫|巨型喷吐虫',
  worm: '中型沙虫|大型沙虫|巨型沙虫',
  demolisher: '小型撼地虫|中型撼地虫|大型撼地虫',
  wriggler: '蠕动五足虫', strafer: '飞弹五足虫', stomper: '重踏五足虫',
  storm: '雷暴·第一段|雷暴·第二段|雷暴·第三段', frost: '严寒·第一段|严寒·第二段|极寒风暴',
  caster: '怒焰萨满祭司|迪菲亚招魂师|尖牙德鲁伊|暮光水占师|剃刀沼泽地占师|血色巫师|沙怒暗影法师|阿塔莱高阶祭司|通灵学院通灵师|图萨丁暗影法师|黑翼缚法者|盘牙女祭司|星占师学徒|炎刃秘法师|火妖学徒|高里亚战争法师|赤红秘法师|拜荒塑霜者',
  beast: '变异破坏者|阿鲁高之子|地狱战马|尖刺鞭笞者|上古熔火恶犬|拉扎什蝰蛇|虫群甲虫|赞达拉恐龙统领|晶化幼蝎|狂热的巨兽',
  undead: '枯萎野猪人守卫|阿塔莱食尸者|复活的卫兵|恶疫食尸鬼|势不可挡的憎恶|幻影仆从|鬼灵演员|食尸鬼|食尸鬼苦工|蹒跚的血僵尸|复生的坚骨战士|暗影之魂',
  demon: '腐烂萨特|邪能成瘾的新兵|潜伏恐魔|腐蚀恐魔|安托兰恶魔卫士|安托兰末日守卫|恐惧爪牙|尤格-萨隆的卫士|散疫触须|黑暗幼体|腐化的神经元|虚空守卫',
  elemental: '冰冻之魂|土灵管理者|熔核巨人|涌电毁灭者|燃烧的巨像',
  mechanical: '机械哨兵|黑翼技师|库卡隆机械师|定点防御无人机|暗索破坏者',
  paper: '纸片人|装订卫兵|浮游卷宗|铅封档案', mirror: '碎镜像|无面替身',
  shadow: '积水影|持伞者|发条残影|报时员|滞留影|值梯员|空罐游荡者|收银员|无声观众|提线演员|忙音聚合体|接线员|候车影|检票员',
};
const named = new Map(Object.entries(families).flatMap(([family,names])=>names.split('|').map(name=>[name,family])));
const bossFamilies = ('demon humanoid beast caster beast humanoid mechanical caster undead elemental humanoid elemental beast humanoid humanoid beast caster undead elemental beast beast beast elemental demon undead demon caster caster demon demon demon demon biter undead beast humanoid elemental beast humanoid stomper demon elemental humanoid caster humanoid demon demon caster demon demon demon caster caster demon undead undead mechanical beast beast beast stomper mechanical demon').split(' ');
const containment = ['printer','rain','clock','mirror','elevator','vending','theatre','cabinet','phone','terminal'];
const planetScenes = {'新地星':'forest','祝融星':'lava','雷神星':'ruins','句芒星':'marsh','玄冥星':'ice'};
const gearScenes = {lava:[1,14,16,19,20,22,35,37,38,45,46,49,50,59,60],mine:[2,7,10,43,62,63],forest:[3,6,12,15,21,29,47,61],ice:[9,25,34,58],castle:[4,8,17,18,26,33,55,56],mechanical:[28,32,39,57]};
const byId = new Map(),bossArt = new Map();
for(const task of Object.values(TASKS)) {
  for(const wave of task.waves) for(const enemy of wave.enemies) {
    let family = named.get(enemy.name) || 'humanoid';
    if(enemy.type==='boss'&&task.kind==='gear'){family=bossFamilies[task.index-1]||'humanoid';bossArt.set(enemy.id,`./art/boss-${task.id}-v5.webp`);}
    if(enemy.type==='boss'&&task.kind==='rogue') family=containment[task.index-1];
    byId.set(enemy.id,family);
  }
}
export function enemyAppearance(task,unit) {
  const family=byId.get(unit.id)||(task.summonTemplate?named.get(task.summonTemplate.name):null)||(task.kind==='rogue'?'shadow':'humanoid');
  return {family,src:bossArt.get(unit.id)||(family==='biter'?'./art/enemy-biter.webp':`./art/enemy-${family}-v5.webp`)};
}
export function battleScene(task) {
  if(task.kind==='rogue') return 'corridor';
  if(task.planet) return planetScenes[task.planet]||'forest';
  return Object.entries(gearScenes).find(([,ids])=>ids.includes(task.index))?.[0]||'ruins';
}
export function preloadEnemies(task) {
  const sources=new Set(task.waves.flatMap(w=>w.enemies.map(e=>enemyAppearance(task,e).src)));
  if(task.summonTemplate)sources.add(enemyAppearance(task,task.summonTemplate).src);
  sources.add(`./art/scene-${battleScene(task)}-v5.webp`);
  for(const src of sources){const img=new Image();img.src=src;}
}
