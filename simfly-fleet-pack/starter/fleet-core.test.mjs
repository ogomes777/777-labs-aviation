import assert from 'node:assert/strict';
import {fleetIndex,progressForIndex,quoteUrl,selectPart,closeInspector,selectModel,explosionLabel,IDS} from './fleet-core.ts';
for(let i=0;i<5;i++)assert.equal(fleetIndex(progressForIndex(i),i),i);
assert.equal(fleetIndex(.12,0),0);assert.equal(fleetIndex(.2,0),1);assert.equal(fleetIndex(.95,0),4);assert.equal(fleetIndex(.01,4),0);
const s={mode:'exploded',aircraft:IDS[0],part:null,revision:0,target:1};
assert.equal(selectPart(s,'missing',new Set()),s);assert.equal(selectPart(s,'wing',new Set(['wing'])).part,'wing');
assert.equal(closeInspector(s).target,0);assert.equal(selectModel(s,IDS[4]).aircraft,IDS[4]);assert.equal(explosionLabel(.9,1),'Montar aeronave');assert.equal(explosionLabel(0,0),'Abrir em camadas');assert.ok(quoteUrl('5534991386000','Citation CJ2+',2007).includes('CJ2%2B'));
console.log('fleet-core: ok');
