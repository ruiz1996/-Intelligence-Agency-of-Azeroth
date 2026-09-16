const profiles={
  wudi:['#9ecce7','shard'],echoz:['#ba91e1','shadow'],kukalon:['#9ebbd0','guard'],asuna:['#efcf85','fan'],
  xiaocheng:['#bdc7ff','star'],suxiaoyao:['#e8d39d','halo'],sacred_druid:['#accb83','leaf'],
  bandebeidiwang:['#b996d4','curse'],lancelot:['#f0d595','judgement'],qinglian:['#e0b675','purify'],
  makelong:['#83cabe','ripple'],yan:['#ccab80','guard'],ling:['#a6d59a','leaf'],jin:['#e7ac79','burst'],
  shuo:['#d0ccaa','bullet'],lan:['#9cc2dc','guard'],
  kuodaya:['#8ebcce','guard'],yuliang:['#d9ba75','slash'],xifeng:['#8bc9da','ripple'],hasika:['#b5cb87','fan'],
};
export function motionPreference(){return localStorage.getItem('ax-battle-motion')||'system';}
export function reducedMotion(){const pref=motionPreference();return pref==='reduced'||pref==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}

// A disposable view of recorded combat events. No timers generate combat actions.
export class BattleEffects {
  constructor(field,{unit,speed,weapon}) {
    this.field=field;this.unit=unit;this.speed=speed;this.weapon=weapon;
    this.layer=field.querySelector('.battle-effects');this.active=new Set();this.floats=[];this.labels=new Map();this.seen=new Set();this.timers=new Set();this.paused=false;
    this.resizeObserver=new ResizeObserver(()=>this.repositionLabels());this.resizeObserver.observe(field);
    this.unitsObserver=new MutationObserver(()=>this.repositionLabels());
    for(const grid of field.querySelectorAll('.ally-grid,.enemy-grid')){this.resizeObserver.observe(grid);this.unitsObserver.observe(grid,{childList:true});}
  }
  duration(ms){return Math.max(75,ms/this.speed());}
  card(id){return document.getElementById('unit-'+id);}
  point(id){const card=this.card(id);if(!card)return null;const r=card.getBoundingClientRect(),f=this.field.getBoundingClientRect();return {x:r.x-f.x+r.width/2,y:r.y-f.y+r.height/2,top:r.top-f.top,bottom:r.bottom-f.top,width:r.width,height:r.height};}
  schedule(timer){timer.started=performance.now();timer.id=setTimeout(()=>{this.timers.delete(timer);timer.fn();},timer.remaining);}
  later(fn,ms){const timer={fn,remaining:ms};this.timers.add(timer);if(!this.paused)this.schedule(timer);return timer;}
  pause(){
    if(this.paused)return;this.paused=true;
    for(const timer of this.timers){clearTimeout(timer.id);timer.remaining=Math.max(0,timer.remaining-(performance.now()-timer.started));}
    for(const item of this.active)item.animation.pause();
  }
  resume(){
    if(!this.paused)return;this.paused=false;this.repositionLabels();
    for(const timer of this.timers)this.schedule(timer);
    for(const item of this.active)item.animation.play();
  }
  clear(){for(const timer of this.timers)clearTimeout(timer.id);this.timers.clear();for(const item of [...this.active])item.cancel();this.floats=[];this.labels.clear();this.seen.clear();this.layer.replaceChildren();const banner=this.field.querySelector('#battle-announcement');if(banner)banner.textContent='';}
  dispose(){this.clear();this.resizeObserver.disconnect();this.unitsObserver.disconnect();}
  once(key){if(this.seen.has(key))return false;this.seen.add(key);if(this.seen.size>256)this.seen.delete(this.seen.values().next().value);return true;}
  animate(node,frames,duration,{remove=false,priority=0,delay=0,allowReduced=false,onRemove}={}){
    if(reducedMotion()&&!allowReduced) {if(remove)node.remove();return null;}
    if(this.active.size>=12){const drop=[...this.active].find(e=>e.priority===0)||[...this.active].find(e=>e.priority<priority);if(drop)drop.cancel();else {if(remove)node.remove();return null;}}
    const animation=node.animate(frames,{duration,delay,easing:'ease-out',fill:'backwards'});
    const item={priority,animation,cancel:()=>{animation.cancel();if(remove)node.remove();this.active.delete(item);this.floats=this.floats.filter(f=>f.item!==item);onRemove?.();}};
    this.active.add(item);animation.onfinish=item.cancel;if(this.paused)animation.pause();return item;
  }
  element(kind,point,color){const node=document.createElement('i');node.className='combat-fx fx-'+kind;node.style.setProperty('--fx-color',color);node.style.left=point.x+'px';node.style.top=point.y+'px';this.layer.append(node);return node;}
  pulse(id,kind='ring',color='#cdb886',duration=300){const p=this.point(id);if(!p)return;const node=this.element(kind,p,color);this.animate(node,[{opacity:0,transform:kind==='star'?'translate(-50%,calc(-50% - 22px)) scale(.6)':'translate(-50%,-50%) scale(.45)'},{opacity:.85,offset:.25},{opacity:0,transform:'translate(-50%,-50%) scale(1.3)'}],this.duration(duration),{remove:true});}
  projectile(from,to,color,kind='bolt'){
    const a=this.point(from),b=this.point(to);if(!a||!b)return;const node=this.element(kind,a,color);node.dataset.from=from;node.dataset.to=to;
    this.animate(node,[{opacity:.9,transform:'translate(-50%,-50%)'},{opacity:0,transform:`translate(calc(-50% + ${b.x-a.x}px),calc(-50% + ${b.y-a.y}px))`}],this.duration(260),{remove:true});
  }
  source(id,time,cast=false){
    const card=this.card(id);if(!card||card.classList.contains('dead')||!this.once(`source:${time}:${id}`))return;
    const ranged=['法杖','魔杖','弓','火枪'].includes(this.weapon(id)),direction=this.unit(id)?.side==='hero'?-1:1;
    this.animate(card.querySelector('.unit-art'),[{transform:'translateY(0)'},{transform:`translateY(${direction*(cast?4:ranged?-2:7)}px)`,offset:.4},{transform:'translateY(0)'}],this.duration(cast?380:ranged?280:250));
    if(cast)this.pulse(id,'ring',profiles[id]?.[0],380);
  }
  announce(text,ms=450){const node=this.field.querySelector('#battle-announcement');node.textContent=text;const token={};this.announcement=token;this.later(()=>{if(this.announcement===token)node.textContent='';},ms);}
  removeSkill(id){this.labels.get(id)?.item.cancel();}
  positionLabel(id,node){
    const point=this.point(id);if(!point)return false;
    node.style.left=point.x+'px';node.style.top=Math.max(0,point.top-26)+'px';node.style.maxWidth=point.width+'px';return true;
  }
  repositionLabels(){for(const [id,label] of this.labels)if(!this.positionLabel(id,label.node))this.removeSkill(id);}
  skillLabel(event){
    const {source,name,time}=event,card=this.card(source);
    if(!card||card.classList.contains('dead')||!name||!this.once(`skill:${time}:${source}:${name}`))return;
    this.removeSkill(source);
    const node=document.createElement('span');node.className='skill-label';node.dataset.source=source;node.textContent=name;node.title=name;
    this.positionLabel(source,node);this.layer.append(node);
    const reduced=reducedMotion(),duration=reduced?450:Math.max(300,650/this.speed());
    const frames=reduced?[{opacity:1},{opacity:1,offset:.84},{opacity:0}]:[
      {opacity:0,transform:'translate(-50%,3px)'},{opacity:1,transform:'translate(-50%,0)',offset:100/650},
      {opacity:1,transform:'translate(-50%,0)',offset:490/650},{opacity:0,transform:'translate(-50%,0)'},
    ];
    const item=this.animate(node,frames,duration,{remove:true,priority:2,allowReduced:true,onRemove:()=>{if(this.labels.get(source)?.node===node)this.labels.delete(source);}});
    if(item)this.labels.set(source,{node,item});
  }
  number(event,kind,amount){
    if(!(amount>0)||!this.point(event.target))return;
    const now=performance.now(),key=`${event.source}:${event.target}:${kind}`;
    const existing=this.floats.find(f=>f.key===key&&now-f.last<=120);
    const label=value=>({damage:'−',absorbed:'盾 −',heal:'+',shield:'盾 +',payment:'代价 −',debt:'醉伤 −',purify:'净化 '}[kind])+Math.round(value).toLocaleString('zh-CN');
    if(existing){existing.amount+=amount;existing.last=now;existing.node.textContent=label(existing.amount);if(event.critical)existing.node.classList.add('critical');return;}
    const same=this.floats.filter(f=>f.target===event.target);if(same.length>=2)same[0].item.cancel();
    if(this.floats.length>=8)this.floats[0].item.cancel();
    const lane=this.floats.some(f=>f.target===event.target&&f.lane===0)?1:0;
    const p=this.point(event.target),node=document.createElement('span');node.className=`combat-number number-${kind}${event.critical?' critical':''}`;
    node.textContent=label(amount);node.dataset.target=event.target;node.dataset.kind=kind;
    // Keep both lanes in the lower portrait area, away from the caster's name.
    const vitals=this.card(event.target).querySelector('.unit-vitals').getBoundingClientRect(),field=this.field.getBoundingClientRect();
    const compact=vitals.top-field.top-p.top<80;
    node.style.left=(p.x+(compact?(lane?1:-1)*p.width/4:0))+'px';node.style.maxWidth=(compact?p.width/2:p.width)+'px';
    node.style.top=Math.max(p.top+2,vitals.top-field.top-22-(compact?0:lane*20))+'px';this.layer.append(node);
    const item=this.animate(node,[{opacity:1,transform:'translate(-50%,0)'},{opacity:0,transform:'translate(-50%,0)'}],this.duration(event.critical?560:480),{remove:true,priority:1});
    if(item)this.floats.push({key,target:event.target,node,item,amount,last:now,lane});
  }
  event(e){
    if(e.type==='buff'){if(!reducedMotion()){this.projectile(e.source,e.target,'#a5cddd','bolt');this.pulse(e.target,'guard','#a5cddd');}return;}
    if(e.type==='redistribute'){this.skillLabel({...e,type:'skill'});if(!reducedMotion())for(const u of e.changes)this.pulse(u.id,'ripple','#8bc9da');return;}
    if(e.type==='skill'){this.skillLabel(e);if(!reducedMotion())this.source(e.source,e.time,true);return;}
    if(e.type==='death'){this.removeSkill(e.target);return;}
    if(reducedMotion())return;
    const [color,shape]=profiles[e.source]||['#b7c5b2','slash'];
    if(e.type==='damage'){
      if(e.amount>0)this.number(e,e.tag==='debt'?'debt':'damage',e.amount);
      if(e.absorbed>0)this.number(e,'absorbed',e.absorbed);
      if(!(e.amount>0||e.absorbed>0))return;
      const direct=['basic','active','shield_to_damage'].includes(e.tag);
      if(direct)this.source(e.source,e.time,e.tag!=='basic');
      const ranged=['法杖','魔杖','弓','火枪'].includes(this.weapon(e.source));
      if(e.tag==='basic'&&ranged)this.projectile(e.source,e.target,color);
      else if(e.tag==='passive'&&e.source==='jin')this.projectile(e.source,e.target,color,'bullet');
      else if(['active','shield_to_damage'].includes(e.tag)&&['wudi','echoz','sacred_druid','shuo'].includes(e.source))this.projectile(e.source,e.target,color,e.source==='wudi'?'shard':e.source==='shuo'?'bullet':'bolt');
      const kind=e.tag==='periodic'?'pulse':e.tag==='debt'?'purify':e.tag==='environment'?(this.card(e.source)?.dataset.family==='frost'?'frost':'lightning'):e.tag==='basic'?(ranged?'pulse':'slash'):shape;
      this.pulse(e.target,kind,e.tag==='debt'?'#deb57c':color,e.tag==='periodic'?180:300);
      if(direct){const art=this.card(e.target)?.querySelector('.unit-art');if(art)this.animate(art,[{transform:'translateX(0)'},{transform:'translateX(2px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],this.duration(180));}
      if(e.critical)this.pulse(e.target,'burst',color,400);
      return;
    }
    if(e.type==='heal'||e.type==='shield'){
      this.number(e,e.type,e.amount);
      if(e.amount>0)this.pulse(e.target,e.type==='shield'?'guard':profiles[e.source]?.[1]||'halo',e.type==='shield'?'#9fc6e7':color,400);
      return;
    }
    if(e.type==='payment'){this.number(e,'payment',e.amount);if(e.amount>0)this.projectile(e.target,e.source,'#b4777b','payment');return;}
    if(e.type==='purify'){this.number(e,'purify',e.amount);this.pulse(e.target,'purify','#ddb674');return;}
    if(e.type==='transfer'){this.projectile(e.oldTarget,e.target,profiles.bandebeidiwang[0],'bolt');this.pulse(e.target,'curse',profiles.bandebeidiwang[0]);return;}
    if(e.type==='redirect'){this.projectile(e.source,e.target,profiles.kukalon[0],'shard');this.pulse(e.source,'guard',profiles.kukalon[0]);return;}
    if(e.type==='clutch'){this.pulse(e.target,'ring',profiles.lancelot[0],400);return;}
    if(e.type==='environment_attack'&&this.once(`area:${e.time}:${e.source}`))this.area(e.targets,'#a5c7d6','weather');
  }
  area(targets,color,kind='area'){
    const points=[...new Set(targets)].map(id=>this.point(id)).filter(Boolean);if(points.length<2)return;
    const p={x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};
    const node=this.element(kind,p,color);node.style.width=Math.min(this.field.clientWidth-24,Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))+64)+'px';
    this.animate(node,[{opacity:0,transform:'translate(-50%,-50%) scale(.75)'},{opacity:.45,offset:.3},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}],this.duration(400),{remove:true});
  }
  group(events){
    // A multi-target cast is one source motion and one area graphic, never one per grid cell.
    const groups=new Map();for(const e of events)if(e.type==='damage'&&e.tag==='active'||e.type==='heal'&&e.amount>0){
      const key=e.time+':'+e.source+':'+e.type;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
    }
    if(!reducedMotion())for(const [key,list] of groups)if(list.length>1&&this.once('area:'+key))this.area(list.map(e=>e.target),profiles[list[0].source]?.[0]||'#d6c296');
    for(const e of events)this.event(e);
  }
}
