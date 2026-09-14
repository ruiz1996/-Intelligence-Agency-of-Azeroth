import {createState,act,uid,RULE_VERSION,DATA} from './core.js';
const config=window.GAME_CONFIG||{};
export const cloudReady=Boolean(config.supabaseUrl&&config.supabaseKey);
const base=(config.supabaseUrl||'').replace(/\/$/,'');
const STORE='guild-echo-local-v1';
const AUTH='guild-echo-auth:'+base;
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
let session=read(AUTH);
export const authSession=()=>session;
export const selectedMode=()=>session&&cloudReady?'cloud':localStorage.getItem('guild-echo-mode')==='local'?'local':null;
export function setLocal(){localStorage.setItem('guild-echo-mode','local');}
export async function signOut(){
  if(session&&cloudReady){try{await request(base+'/auth/v1/logout',{method:'POST',headers:authHeaders(session.access_token)});}catch{ /* Local logout always remains possible. */ }}
  session=null;localStorage.removeItem(AUTH);localStorage.removeItem('guild-echo-mode');
}
function authHeaders(token){return {'Content-Type':'application/json',apikey:config.supabaseKey,Authorization:`Bearer ${token}`};}
async function request(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body.error_description||body.msg||body.error||body.message||`请求失败（${response.status}）`);error.status=response.status;throw error;}
  return body;
}
function saveSession(data){session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in};localStorage.setItem(AUTH,JSON.stringify(session));}
export async function login(email,password,signup=false){
  if(!cloudReady)throw new Error('尚未配置 Supabase，请先使用本机试玩');
  const path=signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
  const data=await request(base+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabaseKey},body:JSON.stringify({email,password})});
  if(data.access_token){saveSession(data);localStorage.setItem('guild-echo-mode','cloud');return true;}
  return false;
}
async function accessToken(){
  session=read(AUTH);if(!session)throw new Error('请重新登录');
  if(session.expires_at<Date.now()/1000+90){
    const data=await request(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabaseKey},body:JSON.stringify({refresh_token:session.refresh_token})});saveSession(data);
  }
  return session.access_token;
}
export class GameClient{
  constructor(mode){this.mode=mode;this.version=null;this.offset=0;this.key=`guild-echo-pending:${mode}:${mode==='cloud'?session?.user?.id:'device'}`;}
  get pending(){return read(this.key);}
  now(){return Date.now()+this.offset;}
  async cloud(body){const token=await accessToken();return request(base+'/functions/v1/game',{method:'POST',headers:authHeaders(token),body:JSON.stringify(body)});}
  accept(envelope){this.version=envelope.version;this.offset=(envelope.serverTime||Date.now())-Date.now();return envelope;}
  async load(){
    if(this.pending)return this.retry();
    if(this.mode==='cloud')return this.accept(await this.cloud({type:'load'}));
    let value=read(STORE);if(!value){value={state:createState(),version:0,receipts:{}};localStorage.setItem(STORE,JSON.stringify(value));}
    return this.accept({...value,serverTime:Date.now()});
  }
  async action(action){
    if(this.pending)throw new Error('上一次操作尚未确认，请先点击“重试同步”');
    const request={type:'action',opId:uid(),version:this.version,ruleVersion:RULE_VERSION,balanceRevision:DATA.balanceRevision,action};
    localStorage.setItem(this.key,JSON.stringify(request));return this.retry();
  }
  async retry(){
    const body=this.pending;if(!body)return this.load();
    try{
      let data;
      if(this.mode==='cloud')data=await this.cloud(body);
      else{
        const run=()=>{
          const value=read(STORE);if(!value)throw new Error('本机存档不存在');
          if(value.receipts[body.opId])return {...value,serverTime:Date.now(),result:value.receipts[body.opId]};
          if(body.ruleVersion!==RULE_VERSION||body.balanceRevision!==DATA.balanceRevision){const e=new Error('待重试操作属于旧规则，请刷新档案后重试');e.status=409;throw e;}
          if(value.version!==body.version){const e=new Error('其他页面已修改存档，请刷新后重新操作');e.status=409;throw e;}
          const updated=act(value.state,body.action);data={...updated,version:value.version+1,serverTime:Date.now()};
          const receipts={...value.receipts,[body.opId]:updated.result};const keys=Object.keys(receipts);for(const key of keys.slice(0,Math.max(0,keys.length-100)))delete receipts[key];
          localStorage.setItem(STORE,JSON.stringify({state:data.state,version:data.version,receipts}));return data;
        };
        data=navigator.locks?await navigator.locks.request(STORE,run):run();
      }
      localStorage.removeItem(this.key);return this.accept(data);
    }catch(error){
      // Network/5xx failures can have committed; retain the exact operation ID.
      // Auth may expire while retrying an operation whose response was lost.
      // Keep that ID through re-login so an earlier commit cannot be repeated.
      if((error.status&&error.status<500&&![401,403].includes(error.status))||error.name==='GameError')localStorage.removeItem(this.key);
      throw error;
    }
  }
}
