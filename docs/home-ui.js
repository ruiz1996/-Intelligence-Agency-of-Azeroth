import {HERO_BY_ID,TASKS,MAX_INVENTORY,idlePreview,idleRates,idleGearPreview,rebirthPreview,formatMoney,formatInteger} from './core.js';
import {esc,art,num} from './presentation.js';
import {idleGearTime} from './feature-v5.js';
import {qualification} from './growth-ui.js';

export function supplyStatus(s,now){
  const resources=idlePreview(s,now),gear=idleGearPreview(s,now),space=Math.max(0,MAX_INVENTORY-s.items.length-s.pendingEquipment.length);
  return {resources,gear,space,canClaim:resources.gold>0n||resources.recruit>0n,gearText:!space?'背包已满，装备继续暂存':gear.count===48?'暂存已满，领取后继续生产':!gear.source?'完成装备行动后开启':gear.count>space?`可领取 ${space} 件，其余继续暂存`:idleGearTime(gear)};
}
export function headquartersView(s,now,button){
  const {resources,gear,space,canClaim,gearText}=supplyStatus(s,now),payout=rebirthPreview(s,now);
  const slots=Array.from({length:6},(_,index)=>{const id=s.formation[index];return `${index%3===0?`<span class="hq-lane">${index<3?'前排':'后排'}</span>`:''}${id?button(`<span class="hq-portrait"><img src="${art(id,true)}" alt=""></span><span class="hq-agent-name">${esc(HERO_BY_ID[id].name)}</span>`,'hero',`data-hero="${id}" data-slot="${index}" aria-label="${index<3?'前排':'后排'}${index%3+1}，${esc(HERO_BY_ID[id].name)}"`,false,'hq-agent'):button('<span>＋ 空位</span>','nav',`data-view="formation" data-slot="${index}" aria-label="${index<3?'前排':'后排'}${index%3+1}空位，调整阵容"`,false,'hq-agent hq-empty')}`;}).join('');
  return {body:`<div class="hq-layout"><section class="panel hq-supply"><div class="section-head"><h2>后勤补给</h2>${button('补给详情','hqSupply','','','hq-details')}</div><div class="hq-supply-row"><div><div class="hq-amount"><strong id="idle-gold">${formatMoney(resources.gold)}</strong><small>金币</small></div><small id="idle-recruit">招募点 ${formatMoney(resources.recruit)}</small></div>${button(canClaim?'领取资源':'暂无资源','claimResources','',!canClaim)}</div><div class="hq-supply-row"><div><strong>装备 <span id="idle-gear-count">${gear.count}/48</span></strong><small id="idle-gear-time">${esc(gearText)}</small></div>${space?button(gear.count?'领取装备':'暂无装备','claimGear','',!gear.count):button('整理装备','hqBag')}</div></section><section class="panel hq-squad"><div class="section-head"><h2>出战小队 <small>${s.formation.filter(Boolean).length}/5</small></h2>${button('调整阵容','nav','data-view="formation"')}</div><div class="hq-formation">${slots}</div></section><section class="panel hq-growth"><h2>本轮成长</h2><div class="hq-entries">${button(`<span>异常收容<small>${s.pendingBuff?'有待选收容强化':'查看收容任务'}</small></span><span class="hq-arrow" aria-hidden="true">›</span>`,'category','data-kind="rogue"',false,'hq-entry')}${button(`<span>时间回溯<small id="hq-rebirth-status">${payout.eligible?'预计 +'+formatInteger(payout.points)+' 点':esc(qualification(s))}</small></span><span class="hq-arrow" aria-hidden="true">›</span>`,'nav','data-view="rebirth"',false,'hq-entry')}</div></section></div>`,actions:''};
}
export function supplyDetails(s,now){
  const {gear,space}=supplyStatus(s,now),rate=idleRates(s);
  return `<h3>资源产出</h3><p>每分钟 ${num(rate.gold)} 金币 · ${num(rate.recruit)} 招募点</p><h3>装备补给</h3><p>${gear.source?'来源：'+esc(TASKS[gear.source].name):'首次完成装备行动后开启'}</p><p>${idleGearTime(gear)} · 暂存 ${gear.count}/48 件</p><p>背包可容纳 ${space} 件${s.pendingEquipment.length?'（已预留自选装备位置）':''}</p><h3>补给规则</h3><p>每30分钟1件，按历史最高已通关装备行动生成1级装备。暂存48件，满仓停产；背包不足时领取可容纳的部分。来源和暂存装备跨回溯保留。</p><p class="muted">资源与装备分别领取，领取结果以保存回执为准。</p>`;
}
export function refreshHeadquarters(root,s,now,blocked){
  const {resources,gear,space,canClaim,gearText}=supplyStatus(s,now),set=(selector,text)=>{const el=root.querySelector(selector);if(el)el.textContent=text;};
  set('#idle-gold',formatMoney(resources.gold));set('#idle-recruit','招募点 '+formatMoney(resources.recruit));set('#idle-gear-count',gear.count+'/48');set('#idle-gear-time',gearText);
  for(const [action,enabled,label] of [['claimResources',canClaim,canClaim?'领取资源':'暂无资源'],['claimGear',space>0&&gear.count>0,gear.count?'领取装备':'暂无装备']]){const el=root.querySelector(`[data-action="${action}"]`);if(el){el.disabled=blocked||!enabled;el.textContent=blocked?'等待同步':label;}}
  const payout=rebirthPreview(s,now);set('#hq-rebirth-status',payout.eligible?'预计 +'+formatInteger(payout.points)+' 点':qualification(s));
}
