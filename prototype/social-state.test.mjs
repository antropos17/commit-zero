import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,advance,stages,before,after} from './social-state.mjs';
test('A full cycle keeps ownership, review, memory and reuse connected',()=>{
  const state=createState(), orbit=state.repos.find(r=>r.id==='orbit'), pr=state.prs.find(p=>p.id===12);
  for(let i=0;i<stages.length;i++){
    assert.equal(advance(state),true); assert.equal(state.step,i+1);
    assert.equal(orbit.files['orbit.js'],i<6?before:after);
    if(i===2)assert.equal(pr.checks,'failed');
    if(i===4)assert.equal(pr.checks,'passed');
    if(i===5)assert.equal(pr.approved,true);
    if(i===6){assert.equal(pr.status,'merged');assert.equal(state.issues[0].status,'closed');}
    for(const r of state.repos){
      assert.ok(state.agents.some(a=>a.id===r.owner));
      assert.equal(new Set(r.stars).size,r.stars.length);
      assert.ok(r.stars.every(id=>state.agents.some(a=>a.id===id)));
      assert.ok(r.parents.every(id=>state.repos.some(parent=>parent.id===id)));
    }
  }
  assert.equal(advance(state),false); assert.equal(state.repos.length,7);
  assert.equal(state.repos.find(r=>r.id==='orbit-lab').forkOf,'orbit');
  assert.deepEqual(state.repos.find(r=>r.id==='orbital-garden').parents,['orbit','safe-timer']);
  assert.deepEqual(state.repos.find(r=>r.id==='orbital-garden').stars,['claude']);
  const memory=state.agents.find(a=>a.id==='gemini').memory[0];
  assert.equal(memory.from,'orbit');assert.equal(memory.pr,12);
  assert.equal(createState().repos.length,5);
  assert.equal(createState().agents.find(a=>a.id==='gemini').memory.length,0);
});
test('Merge is refused if review or checks are missing',()=>{
  for(const invalid of ['review','checks']){
    const state=createState();for(let i=0;i<6;i++)advance(state);
    const pr=state.prs.find(p=>p.id===12);
    if(invalid==='review')pr.approved=false;else pr.checks='failed';
    assert.throws(()=>advance(state),/Merge requires/);
    assert.equal(pr.status,'open');
    assert.equal(state.repos.find(r=>r.id==='orbit').files['orbit.js'],before);
  }
});
test('The displayed fix handles the three demonstrated frame cases',async()=>{
  const oldModule=await import('data:text/javascript,'+encodeURIComponent(before));
  const fixedModule=await import('data:text/javascript,'+encodeURIComponent(after));
  assert.equal(fixedModule.tick(116,100),0.016);
  assert.equal(fixedModule.tick(5100,100),0.04);
  assert.equal(fixedModule.tick(90,100),0);
  assert.ok(oldModule.tick(5100,100)>fixedModule.tick(5100,100));
  assert.ok(oldModule.tick(90,100)<0);
});
