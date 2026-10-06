import {afterEach,expect,it,vi} from 'vitest';
import {publicSourceHealth,readPublic,resetPublicSourceHealthForTests} from '../../server/publicRead';
const url='https://commecscollege.edu.pk/faculty/';
afterEach(resetPublicSourceHealthForTests);
it('records bounded HTTP failure without leaking the response body',async()=>{
  await expect(readPublic(url,new AbortController().signal,async()=>new Response('private upstream error',{status:403}))).rejects.toThrow();
  expect(publicSourceHealth().faculty).toMatchObject({state:'unavailable',reason:'http',httpStatus:403});expect(JSON.stringify(publicSourceHealth())).not.toContain('private');
});
it('records certificate failures without weakening TLS or exposing errors',async()=>{
  const fetcher=vi.fn(async()=>{throw new Error('secret provider detail',{cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}});});
  await expect(readPublic(url,new AbortController().signal,fetcher)).rejects.toThrow();expect(publicSourceHealth().faculty).toMatchObject({reason:'certificate'});expect(JSON.stringify(publicSourceHealth())).not.toContain('secret');expect(fetcher.mock.calls).toHaveLength(1);
});
it('overwrites failed status only after a complete successful read',async()=>{
  await expect(readPublic(url,new AbortController().signal,async()=>new Response('oversize'),2)).rejects.toThrow();expect(publicSourceHealth().faculty?.reason).toBe('size');
  await readPublic(url,new AbortController().signal,async()=>new Response('good'));expect(publicSourceHealth().faculty).toMatchObject({state:'ok'});expect(publicSourceHealth().faculty).not.toHaveProperty('reason');
});
it('does not expose target URLs or user supplied unsafe queries',async()=>{
  const fetcher=vi.fn();await expect(readPublic(url+'?name=private',new AbortController().signal,fetcher)).rejects.toThrow();expect(publicSourceHealth()).toEqual({});expect(fetcher).not.toHaveBeenCalled();
});
