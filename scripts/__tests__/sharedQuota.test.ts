import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {acquireModelQuota,MODEL_LEASE_MS,nextQuotaReset,setQuotaStoreForTests,type QuotaStore} from '../../server/sharedQuota';
let records:Map<string,{blocked:number;until:number;lease:string}>;
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));records=new Map();
 const store:QuotaStore={
  async acquire(key,lease,now){const state=records.get(key);if(state&&(state.blocked>+now||state.until>+now))return false;records.set(key,{blocked:state?.blocked||0,until:+now+MODEL_LEASE_MS,lease});return true;},
  async block(key,until){const state=records.get(key)!;state.blocked=Math.max(state.blocked,+until);},
  async release(key,lease,until){const state=records.get(key)!;if(state.lease===lease)state.until=+until;}
 };setQuotaStoreForTests(store);
});
afterEach(()=>{setQuotaStoreForTests();vi.useRealTimers();vi.unstubAllEnvs();});
it('a second instance cannot spend quota during an active model request',async()=>{
 const first=await acquireModelQuota('model-a');expect(first.allowed).toBe(true);
 expect((await acquireModelQuota('model-a')).allowed).toBe(false);
 expect((await acquireModelQuota('model-b')).allowed).toBe(true);
 await first.release();expect((await acquireModelQuota('model-a')).allowed).toBe(false);
 await vi.advanceTimersByTimeAsync(4001);expect((await acquireModelQuota('model-a')).allowed).toBe(true);
});
it('daily quota exhaustion persists for subsequent instances until Pacific reset',async()=>{
 const first=await acquireModelQuota('model-a');await first.block('daily');await first.release();
 await vi.advanceTimersByTimeAsync(60000);expect((await acquireModelQuota('model-a')).allowed).toBe(false);
 vi.setSystemTime(new Date('2026-10-25T07:00:01Z'));expect((await acquireModelQuota('model-a')).allowed).toBe(true);
});
it('minute cooldown preserves the provider retry delay and abandoned leases expire',async()=>{
 const first=await acquireModelQuota('model-a');await first.block('minute',30000);
 await vi.advanceTimersByTimeAsync(16000);expect((await acquireModelQuota('model-a')).allowed).toBe(false);
 await vi.advanceTimersByTimeAsync(MODEL_LEASE_MS-16000+1);expect((await acquireModelQuota('model-a')).allowed).toBe(true);
});
it('a stalled request keeps its lease beyond the full provider request deadline',async()=>{
 await acquireModelQuota('model-a');
 await vi.advanceTimersByTimeAsync(35001);
 expect((await acquireModelQuota('model-a')).allowed).toBe(false);
 await vi.advanceTimersByTimeAsync(MODEL_LEASE_MS-35001+1);
 expect((await acquireModelQuota('model-a')).allowed).toBe(true);
});
it('Pacific reset handles daylight saving changes',()=>{
 expect(nextQuotaReset(new Date('2026-10-24T10:00:00Z')).toISOString()).toBe('2026-10-25T07:00:00.000Z');
 expect(nextQuotaReset(new Date('2026-11-01T10:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
});
