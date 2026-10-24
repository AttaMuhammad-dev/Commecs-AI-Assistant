import {createHash,randomUUID} from 'node:crypto';
import {MongoClient,type Collection} from 'mongodb';

type State={_id:string;blockedUntil:Date;leaseUntil:Date;lease?:string;reason?:string};
// Outlast the entire 35-second request deadline, including model/tool retries.
// A crashed instance still releases its reservation automatically after this bound.
export const MODEL_LEASE_MS=45000;
export interface QuotaStore {
  acquire(key:string,lease:string,now:Date):Promise<boolean>;
  block(key:string,until:Date,reason:string):Promise<void>;
  release(key:string,lease:string,until:Date):Promise<void>;
}
let connection:MongoClient|undefined,collection:Collection<State>|undefined,override:QuotaStore|undefined;
let quotaIssue:string|undefined;
export function sharedQuotaIssue(){return quotaIssue;}
const pacificDay=(now:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(now);
export function nextQuotaReset(now=new Date()) {
  const day=pacificDay(now);let time=Math.ceil((now.getTime()+1)/3600000)*3600000;
  while(pacificDay(new Date(time))===day)time+=3600000;
  return new Date(time);
}
export function sharedQuotaMode(){return process.env.QUOTA_MONGO_URI?.trim()?'shared-mongodb':'per-process';}
export async function sharedQuotaHealth():Promise<'not-configured'|'ready'|'unavailable'>{
  if(sharedQuotaMode()==='per-process')return 'not-configured';
  try{
    store();
    // An opt-in readiness probe reads quota metadata only. Never return connection details.
    if(!collection)return 'unavailable';
    await collection.findOne({_id:'health-probe'},{projection:{_id:1},maxTimeMS:1000});
    quotaIssue=undefined;
    return 'ready';
  }catch(error){
    const failure=error as {code?:number|string;name?:string};
    quotaIssue=failure.code===18?'authentication':failure.code===13?'database-permission':/Parse|Invalid/.test(failure.name||'')?'connection-format':/Timeout|ServerSelection/.test(failure.name||'')?'connection-timeout':'connection-unavailable';
    return 'unavailable';
  }
}
function store():QuotaStore|undefined{
  if(override)return override;
  const uri=process.env.QUOTA_MONGO_URI?.trim();if(!uri)return;
  const database=process.env.QUOTA_DB_NAME?.trim()||'commecs_demo';
  if(!/^commecs_[a-z0-9_]{1,45}$/.test(database)&&database!=='shape_up_demo')throw Error('Invalid quota database');
  if(!collection){connection=new MongoClient(uri,{maxPoolSize:2,minPoolSize:0,maxIdleTimeMS:60000,serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,timeoutMS:5000});collection=connection.db(database).collection<State>('provider_quota');}
  const records=collection;
  return {
    async acquire(key,lease,now){
      try{await records.updateOne({_id:key},{$setOnInsert:{blockedUntil:new Date(0),leaseUntil:new Date(0)}},{upsert:true});}catch(e){if((e as {code?:number}).code!==11000)throw e;}
      const record=await records.findOneAndUpdate({_id:key,blockedUntil:{$lte:now},leaseUntil:{$lte:now}},{$set:{lease,leaseUntil:new Date(now.getTime()+MODEL_LEASE_MS)}},{returnDocument:'after'});
      return !!record;
    },
    async block(key,until,reason){await records.updateOne({_id:key},{$max:{blockedUntil:until},$set:{reason}},{upsert:true});},
    async release(key,lease,until){await records.updateOne({_id:key,lease},{$set:{leaseUntil:until},$unset:{lease:''}});}
  };
}
export async function acquireModelQuota(model:string,now=new Date()){
  const backing=store();if(!backing)return {allowed:true,block:async(_kind:string,_ms?:number)=>{},release:async()=>{}};
  // Store model/cooldown metadata only; no questions, responses, keys or IP addresses.
  const key=createHash('sha256').update((process.env.GEMINI_API_KEY||'')+'|'+model).digest('hex'),lease=randomUUID();
  if(!await backing.acquire(key,lease,now))return {allowed:false,block:async(_kind:string,_ms?:number)=>{},release:async()=>{}};
  let released=false;
  return {allowed:true,
    block:async(kind:string,ms=60000)=>backing.block(key,kind==='daily'?nextQuotaReset():new Date(Date.now()+ms),kind),
    release:async()=>{if(released)return;released=true;await backing.release(key,lease,new Date(Date.now()+4000));}
  };
}
export function setQuotaStoreForTests(value?:QuotaStore){override=value;}
