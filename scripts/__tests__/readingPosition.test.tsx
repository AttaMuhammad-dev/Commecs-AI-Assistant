// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useAutoScroll} from '../../src/hooks/useAutoScroll';
let root:Root, host:HTMLDivElement, api:ReturnType<typeof useAutoScroll>;
let height=1100, position=0;
function Reader({length=0,id='reply-1',conversation='chat-1',layout='sending'}:{length?:number;id?:string;conversation?:string;layout?:string}){
  api=useAutoScroll(2,length,conversation,layout,id);
  return <div ref={api.scrollRef} onScroll={api.handleScroll} onWheel={api.handleReaderIntent} className="thread-scroll"><article className="message">{length?'A long reply':'Loading'}</article></div>;
}
beforeEach(()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  height=1100;position=0;host=document.createElement('div');document.body.append(host);root=createRoot(host);
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {top:this.classList.contains('message')?900-position:0,bottom:0,left:0,right:0,width:0,height:0,x:0,y:0,toJSON:()=>({})};});
  Object.defineProperty(HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>500});
  Object.defineProperty(HTMLElement.prototype,'scrollHeight',{configurable:true,get:()=>height});
  Object.defineProperty(HTMLElement.prototype,'scrollTop',{configurable:true,get:()=>position,set:value=>{position=Math.max(0,Math.min(value,height-500));}});
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
it('shows the first line of a long reply instead of jumping to its bottom',()=>{
  act(()=>root.render(<Reader/>));expect(position).toBe(600);
  height=3000;act(()=>root.render(<Reader length={2000} layout="streaming"/>));
  expect(position).toBe(880);expect(position).not.toBe(height-500);
  height=4000;act(()=>root.render(<Reader length={4000} layout="complete:sources-5"/>));expect(position).toBe(880);
});
it('does not steal the reading position when the user scrolls before the answer arrives',()=>{
  act(()=>root.render(<Reader/>));
  act(()=>host.querySelector('div')!.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-100})));
  position=150;height=3000;act(()=>root.render(<Reader length={2000}/>));expect(position).toBe(150);
});
it('jumps to the end only on an explicit Latest reply action',()=>{
  height=3000;act(()=>root.render(<Reader length={2000}/>));expect(position).toBe(880);
  act(()=>api.scrollToBottom());expect(position).toBe(2500);
  height=3500;act(()=>root.render(<Reader length={2200} layout="complete"/>));expect(position).toBe(2500);
});
it('anchors a newly selected conversation even when its message count is unchanged',()=>{
  height=3000;act(()=>root.render(<Reader length={2000}/>));position=120;
  act(()=>root.render(<Reader length={2000} id="reply-2" conversation="chat-2"/>));expect(position).toBe(880);
});
