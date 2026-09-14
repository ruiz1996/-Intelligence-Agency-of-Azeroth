export class GameError extends Error { constructor(message) { super(message); this.name = 'GameError'; } }
export const requireRule = (condition, message) => { if (!condition) throw new GameError(message); };
export const clone = value => structuredClone(value);
export const uid = () => crypto.randomUUID();
export function random() { const n = new Uint32Array(1); crypto.getRandomValues(n); return n[0] / 4294967296; }
export function seededRandom(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function weighted(weights, rng = random) { let x = rng() * weights.reduce((a,b) => a+b,0); for (let i=0;i<weights.length;i++) if ((x-=weights[i])<0) return i; return weights.length-1; }
export function natural(value, minimum=0n) { requireRule(((typeof value==='string'||typeof value==='bigint') && /^\d{1,200}$/.test(String(value))) || (typeof value==='number' && Number.isSafeInteger(value)), '请输入有效的非负整数'); const n=BigInt(value); requireRule(n>=minimum,'数值低于允许范围'); return n; }
// 1 coin = 6e11 units. Exact for elapsed milliseconds, 5-decimal table rates,
// and percentage-point income talents, including sub-cent fractional carry.
export const SCALE = 600000000000n;
export function decimalUnits(value) {
  const text=String(value ?? 0); requireRule(/^\d+(\.\d{1,12})?$/.test(text),'资源格式无效');
  const [a,b='']=text.split('.'); return BigInt(a)*SCALE + BigInt(b||0)*SCALE/(10n**BigInt(b.length));
}
export function walletUnits(s,key) { return BigInt(s.wallet[key] || '0'); }
export function credit(s,key,coins) { s.wallet[key]=(walletUnits(s,key)+BigInt(coins)*SCALE).toString(); }
export function spend(s,key,coins) { const cost=BigInt(coins)*SCALE; requireRule(walletUnits(s,key)>=cost,'资源不足'); s.wallet[key]=(walletUnits(s,key)-cost).toString(); }
export function formatInteger(value) {
  const text=BigInt(value).toString(); if(text.length<=9) return text.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return text[0]+'.'+text.slice(1,4)+'e'+(text.length-1);
}
export function formatMoney(units) { return formatInteger(BigInt(units)/SCALE); }
export function exactMoney(units) { const n=BigInt(units); return `${n/SCALE} + ${n%SCALE}/${SCALE}`; }
export const ceilDiv = (n,d) => (n+d-1n)/d;
