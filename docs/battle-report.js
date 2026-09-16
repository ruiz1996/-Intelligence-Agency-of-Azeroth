// Read-only reduction of the replay; never touches simulation state or random draws.
const empty=id=>({id,damage:0,taken:0,healing:0,shield:0,shieldCreated:0,shieldSpent:0,shieldExpired:0,shieldRemaining:0,selfPaid:0});
export function createBattleReport(sim){
  const heroes=sim.initial.filter(u=>u.side==='hero').map(u=>({id:u.id,name:u.name,slot:u.slot}));
  const make=()=>Object.fromEntries([...heroes.map(h=>h.id),'other'].map(id=>[id,empty(id)]));
  const total=make(),waves=Array.from({length:sim.waveCount||3},make);
  function append(e){
    const targets=[total,waves[(e.wave||1)-1]].filter(Boolean);
    const add=(id,key,n)=>{if(!(n>0))return;for(const rows of targets)(rows[id]||rows.other)[key]+=n;};
    if(e.type==='damage'){
      if(e.targetSide==='enemy'&&e.sourceSide==='hero')add(e.source,'damage',e.amount+e.absorbed);
      if(e.targetSide==='hero'&&e.sourceSide==='enemy')add(e.target,'taken',e.amount+e.absorbed);
    }
    if(e.type==='heal'&&e.targetSide==='hero')add(e.source,'healing',e.amount);
    if(e.targetSide==='hero'){
      const key={shield:'shieldCreated',shield_absorbed:'shield',shield_spent:'shieldSpent',shield_expired:'shieldExpired'}[e.type];
      if(key)add(e.provider,key,e.amount);
    }
    if(e.type==='payment')add(e.target,'selfPaid',e.amount);
  }
  function finish(duration,partial=false){
  const {total:totals,waves:waveRows}=structuredClone({total,waves});
  for(const rows of [totals,...waveRows])for(const r of Object.values(rows))r.shieldRemaining=Math.max(0,r.shieldCreated-r.shield-r.shieldSpent-r.shieldExpired);
  // Per-wave remaining includes shields carried in, rather than a negative creation balance.
  const balances=Object.fromEntries(Object.keys(totals).map(id=>[id,0]));
  for(const rows of waveRows)for(const [id,r] of Object.entries(rows)){r.shieldCarried=balances[id];r.shieldRemaining=Math.max(0,balances[id]+r.shieldCreated-r.shield-r.shieldSpent-r.shieldExpired);balances[id]=r.shieldRemaining;}
  return {version:1,heroes,total:totals,waves:waveRows,duration,partial};
  }
  return {append,finish};
}
export function battleReport(sim,through=Infinity){
  const report=createBattleReport(sim);
  for(const e of sim.events){if(e.time>through)break;report.append(e);}
  return report.finish(Math.min(sim.duration,through),through<sim.duration);
}
