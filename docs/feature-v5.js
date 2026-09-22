import {HEROES,TASKS,idleGearPreview} from './core.js';
import {esc,num} from './presentation.js';
const clueOrder=['yan','ling','jin','shuo','lan','wudi','echoz','kukalon','asuna','xiaocheng','suxiaoyao','sacred_druid','bandebeidiwang','lancelot','qinglian','makelong','kuodaya','yuliang','xifeng','hasika','ailianna','mozhate','jinnailuo','juwoyaer','zhangdanaodai','dunjigaoshou'];
const clues={
  ailianna:['刃舞斗士','前线突击组','伙伴越忙，刀锋越快。'],mozhate:['灵魂守卫','前线护卫组','将伤痛凝成灵魂，留待下一次裂劈。'],jinnailuo:['冰霜法师','元素研究组','寒风过后，碎冰接踵而至。'],juwoyaer:['惩戒圣骑士','前线突击组','最强的敌人，将承受风暴的终审。'],zhangdanaodai:['防御圣骑士','前线护卫组','飞盾所至，壁垒随行。'],dunjigaoshou:['神圣圣骑士','医疗支援组','挥盾迎敌，也将祝福送给每位伙伴。'],
  yan:['护卫','驻地后勤','总有人守住最后一道门。'],ling:['治疗','驻地后勤','急救箱永远留着一份备用药。'],jin:['群体伤害','工程小组','爆破也需要精确的节拍。'],
  shuo:['远程射手','巡防小组','盯住同一个目标，直到任务结束。'],lan:['护盾战士','工程小组','维修工具也能守护同伴。'],
  wudi:['护盾战士','异常行动组','把伙伴的信任铸成盾，再化作一击。'],echoz:['暗影施法者','异常行动组','每一缕暗影，都在为下一次爆发蓄势。'],
  kukalon:['守护者','前线护卫组','危险袭来时，他会先跨出一步。'],asuna:['爆发战士','前线突击组','灰烬之后，攻势仍未结束。'],xiaocheng:['星界施法者','星界研究组','敌人越密集，星光越耀眼。'],
  suxiaoyao:['庇护治疗','医疗支援组','多余的温暖会留下保护。'],sacred_druid:['自然施法者','自然研究组','月火标记照亮追击的方向。'],
  bandebeidiwang:['诅咒施法者','异常行动组','宿主倒下，诅咒仍寻找下一个影子。'],lancelot:['惩戒战士','前线突击组','最后一位站立的人，也能逆转战局。'],
  qinglian:['醉拳守护者','前线护卫组','伤痛可以缓一缓，再用清醒将它化去。'],makelong:['群体治疗','医疗支援组','一道回响，让全队重新振作。'],
  kuodaya:['增益支援','特别支援组','一把非常棒的钥匙，一份留给伙伴的惊喜。'],yuliang:['双形态战士','前线护卫组','执盾守护，双手迎战。'],
  xifeng:['治疗萨满','元素研究组','治疗沿伙伴传递，灵魂在危急时相连。'],hasika:['猎人','巡防小组','锁定猎物，下一轮追击已经准备就绪。'],
};
export function archiveClues(h,s){
  const known=new Set([...(s.firsts||[]),...(s.historyContribution||[])]),index=clueOrder.indexOf(h.id);
  const gates=['R'+String(5+Math.floor(index/5)*5).padStart(3,'0'),'E'+String(1+Math.floor(index/4)).padStart(2,'0'),'AX-0'+(1+Math.floor(index/5))];
  return clues[h.id].map((text,i)=>known.has(gates[i])?`<p class="revealed-clue">${esc(text)}</p>`:`<small>完成「${esc(TASKS[gates[i]]?.name||gates[i])}」揭示${['职业','小组','人物线索'][i]}</small>`).join('');
}
export function idleGearCard(s,now,button){const p=idleGearPreview(s,now);return `<section class="panel idle-gear-panel"><div class="section-head"><h2>装备补给</h2><strong id="idle-gear-count">${p.count}/48</strong></div><p id="idle-gear-source">${p.source?`来源：${esc(TASKS[p.source].name)} · 每30分钟1件`:'首次完成装备行动后开启'}</p><small id="idle-gear-time">${idleGearTime(p)}</small>${button('领取装备','claimGear','',p.count===0,'wide')}<details><summary>补给规则</summary><p>按历史最高已通关装备行动生成1级装备。暂存48件，满仓停产；背包不足时领取可容纳的部分。来源和暂存装备跨回溯保留。</p></details></section>`;}
export function idleGearTime(p){return !p.source?'未开启':p.remaining===null?'暂存已满，领取后继续生产':`下件约 ${Math.ceil(p.remaining/60000)} 分钟`;}
export function reportContent(d,button){
  const r=d.report;if(!r)return '<p class="empty">暂无统计</p>';
  const metric=d.metric||'damage',wave=d.wave??-1,rows=wave<0?r.total:r.waves[wave];
  const definitions=[['damage','伤害'],['taken','承伤'],['healing','治疗'],['shield','护盾']];
  const list=[...r.heroes,{id:'other',name:'其他来源',slot:99}].map(h=>({...h,...rows[h.id]}));
  const sum=list.reduce((n,h)=>n+(h[metric]||0),0),maximum=Math.max(1,...list.map(h=>h[metric]||0));
  return `<div class="tabs report-waves">${[[-1,'全场'],...r.waves.map((_,i)=>[i,`第${i+1}波`])].map(([v,n])=>button(n,'reportWave',`data-wave="${v}"`,false,v===wave?'selected':'')).join('')}</div><div class="tabs">${definitions.map(([v,n])=>button(n,'reportMetric',`data-metric="${v}"`,false,v===metric?'selected':'')).join('')}</div><p class="muted">${r.partial?'撤退前已播放':'本场'} ${num(r.duration)}秒 · ${definitions.find(x=>x[0]===metric)[1]} ${num(sum)}</p><div class="report-rows">${list.filter(h=>h.id!=='other'||h[metric]>0).sort((a,b)=>b[metric]-a[metric]||a.slot-b.slot).map(h=>`<details class="report-row"><summary><span>${esc(h.name)}</span><strong>${num(h[metric])}</strong><small>${sum?num(h[metric]/sum*100):0}%</small><i style="width:${h[metric]/maximum*100}%"></i></summary><dl class="stats-list">${[...definitions,['shieldCreated','生成护盾'],['shieldSpent','主动耗盾'],['shieldExpired','过期护盾'],['shieldRemaining','剩余护盾'],['selfPaid','生命支付']].map(([key,name])=>`<div><dt>${name}</dt><dd>${num(h[key]||0)}</dd></div>`).join('')}</dl></details>`).join('')}</div><small class="muted">治疗仅计实际恢复；护盾计提供者的实际吸收。生命均分不算治疗，生命支付与耗盾攻击单独列出。</small>`;
}
export function revealStyle(h){const basic=false;return {kind:basic?'standard':'signature',color:basic?'#79bfc0':['#bd9ee6','#e3b36d','#82c7b2','#86b7e2'][HEROES.indexOf(h)%4],label:basic?'基础档案':'专属档案'};}
let audioContext;export function soundEnabled(){try{return localStorage.getItem('ax-sound')!=='off';}catch{return false;}}
export function unlockSound(){if(!soundEnabled())return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
export function toggleSound(){const enabled=!soundEnabled();try{localStorage.setItem('ax-sound',enabled?'on':'off');}catch{}if(enabled)unlockSound();return enabled;}
let playedKey;
export function revealSound(h,key){if(playedKey===key)return;playedKey=key;if(!soundEnabled()||audioContext?.state!=='running')return;const t=audioContext.currentTime,notes=revealStyle(h).kind==='signature'?[392,523.25,659.25,783.99]:[440,554.37,659.25];notes.forEach((frequency,i)=>{const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),at=t+i*.1;oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.07,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.42);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(at);oscillator.stop(at+.45);});}
