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
  let response;
  try{response=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});}
  catch(cause){console.debug('Request failed',cause);throw new Error('网络连接异常，请稍后重试');}
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const raw=body.error_description||body.msg||body.error||body.message||'';console.debug('Request rejected',response.status,raw);const error=new Error(playerError(raw,response.status));error.status=response.status;throw error;}
  return body;
}
export function playerError(raw,status){
  if(/invalid login credentials/i.test(raw))return '邮箱或密码不正确';
  if(/email not confirmed/i.test(raw))return '请先通过邮件确认账号';
  if(status===401||status===403)return '登录已失效，请重新登录后重试';
  if(status===429)return '操作过于频繁，请稍后重试';
  if(status>=500)return '服务暂时不可用，请稍后重试同步';
  if(status===409)return /规则|rule|balance/i.test(raw)?'规则已更新，请刷新网页后重试':'档案已更新，请刷新后重新操作';
  if(typeof raw==='string'&&/[\u4e00-\u9fff]/.test(raw)&&!/Supabase|postgres|SQL|JWT|token|stack/i.test(raw))return raw;
  return '操作未完成，请检查输入后重试';
}
function saveSession(data){session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in};localStorage.setItem(AUTH,JSON.stringify(session));}
export async function login(email,password,signup=false){
  if(!cloudReady)throw new Error('暂时无法登录，请使用本机试玩');
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
  get presentation(){return read(this.key+':presentation');}
  savePresentation(receipt){localStorage.setItem(this.key+':presentation',JSON.stringify(receipt));}
  acknowledgePresentation(){localStorage.removeItem(this.key+':presentation');}
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
    if(this.pending)throw new Error('保存未确认，请重试同步');
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
      // Persist the display receipt before clearing the operation. A refresh can
      // resume a reveal without issuing a new paid action or granting rewards.
      if(data.result?.recruits||data.result?.outcome){
        const prior=this.presentation;
        if(prior?.opId!==body.opId)this.savePresentation({opId:body.opId,result:data.result,index:0});
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
