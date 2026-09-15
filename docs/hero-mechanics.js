// Water-fill by absolute life points, preserving fractional HP and total life.
// This is a redistribution, so no healing, damage or shield callbacks run here.
export function redistributeLife(participants) {
  const living=participants.filter(u=>u.hp>0).sort((a,b)=>a.maxHp-b.maxHp||a.order-b.order);
  let remaining=living.reduce((sum,u)=>sum+u.hp,0),count=living.length;
  const changes=[];
  for(const u of living){
    const before=u.hp,after=Math.min(u.maxHp,remaining/count);
    remaining-=after;count--;
    u.hp=after;
    u.enemyDeficit=Math.min(u.maxHp-after,Math.max(0,(u.enemyDeficit||0)-Math.max(0,after-before)));
    u.selfDeficit=Math.min(u.selfDeficit||0,Math.max(0,u.maxHp-after-u.enemyDeficit));
    changes.push({id:u.id,before,hp:after});
  }
  return changes;
}
