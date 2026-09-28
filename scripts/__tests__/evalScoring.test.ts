import { it, expect } from 'vitest';
import { scoreAnswer } from '../../eval/scoring';
const answer = {text:'60% available at BIEK',lane:'fast',sources:[],fallback:false,finishReason:'STOP'};
it('requires every include group, supporting alternatives inside a group', () => {
  expect(scoreAnswer({id:'a',q:'a',include:['BIEK|board','60%','40%']},answer)).toEqual(['missing: 40%']);
});
it('checks citations and rejects fallback text as an answer', () => {
  expect(scoreAnswer({id:'a',q:'a',citeAny:['policy']},{...answer,fallback:true})).toEqual(['citation','fallback']);
});
