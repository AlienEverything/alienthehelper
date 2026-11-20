"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
require("../dist/expedition.js");
require("../dist/model.js");
const E=globalThis.OrbitExpedition,M=globalThis.OrbitModel;
const noon=new Date(2026,10,20,12).getTime();
function study(s,start,minutes=25){
  s.result=null;s.draft.mode="focus";s.settings.focus=minutes;M.start(s,start);
  assert.equal(M.settle(s,start+minutes*60000),true);
  return s.result;
}
function prepare(){
  const s=M.fresh();
  s.tasks.push({id:"work",name:"Worksheet",tagId:"biology",count:0,target:30,done:false});
  s.draft.taskId="work";s.draft.tagId="biology";
  return s;
}
test("three rotating missions, one payout per mission and one daily patch",()=>{
  const s=prepare();
  for(let i=0;i<3;i++){
    s.draft.note="Write the derivation.";s.draft.tagId=i%2?"math":"biology";
    study(s,noon+i*3600000);
    assert.equal(M.settle(s,noon+4*3600000),false);
  }
  const board=E.daily(s,E.dayKey(noon));
  assert.equal(board.cards.length,3);assert.equal(board.completed,3);assert.equal(board.patch,true);
  const paid=s.sessions.flatMap(r=>r.flight.missions);
  assert.equal(paid.length,3);assert.equal(new Set(paid).size,3);
  assert.equal(s.sessions.filter(r=>r.flight.patch).length,1);
  assert.equal(s.credits,75+4+6+8+10);
  const next=E.daily(s,E.dayKey(new Date(2026,10,21,12)));
  assert.equal(next.completed,0);assert.equal(next.patch,false);assert.notDeepEqual(next.cards.map(c=>c.id),board.cards.map(c=>c.id));
  for(const r of s.sessions){r.tagId="general";r.note="";}
  assert.equal(E.daily(s,E.dayKey(noon)).completed,3);
  assert.deepEqual(M.validateBackup(JSON.parse(JSON.stringify(s))),{...s,result:null});
});
test("a resumed or overdue session is attributed to its actual finish date",()=>{
  const s=M.fresh(),start=new Date(2026,10,20,23,45).getTime(),end=start+25*60000;
  M.start(s,start);M.togglePause(s,start+60000);M.togglePause(s,start+120000);
  const realEnd=end+60000;
  assert.equal(M.settle(s,realEnd-1),false);assert.equal(M.settle(s,realEnd+3*86400000),true);
  assert.equal(s.result.endedAt,realEnd);assert.equal(s.result.flight.day,E.dayKey(realEnd));
  assert.equal(E.daily(s,E.dayKey(start)).cards.every(c=>c.progress===0),true);
  s.draft.mode="short";s.result=null;M.start(s,realEnd);const before=s.credits;M.settle(s,realEnd+600000);
  assert.equal(s.credits,before);assert.equal(s.sessions.length,1);assert.equal(s.result.flight,undefined);
});
test("session loadout is frozen and gear stacks with companion research",()=>{
  const s=prepare();s.credits=200;
  assert.equal(M.buy(s,"scanner"),true);M.equip(s,"scanner");s.draft.note="Read the field report.";
  M.start(s,noon);s.equipped.gear=null;M.settle(s,noon+25*60000);
  assert.equal(s.result.flight.gear,"scanner");assert.equal(s.result.flight.crewSurvey,1);assert.equal(s.result.flight.gearSurvey,1);
  assert.equal(E.survey(s,"lunar").points,4);assert.equal(E.survey(s,"lunar").stage.name,"Landing beacon");
  M.buy(s,"relay");M.equip(s,"relay");const record=study(s,noon+3600000,15);
  assert.equal(record.flight.gearCredits,3);assert.equal(M.buy(s,"relay"),false);
  assert.ok(E.totalCredits(record)>=18);assert.equal(E.survey(s,"aurora").points,0);
  const copy=JSON.parse(JSON.stringify(s));copy.sessions[0].flight.gear="not-a-product";assert.throws(()=>M.validateBackup(copy));
});
test("short timers earn a star without qualifying for crew, gear or gated challenges",()=>{
  const s=prepare();s.equipped.companion="fenn";s.equipped.gear="antenna";
  const short=study(s,noon,1);
  assert.equal(short.flight.survey,0);assert.equal(short.flight.gearCredits,0);assert.equal(E.totalCredits(short),1);
  const long=study(s,noon+3600000,45);
  assert.equal(long.flight.survey,8);assert.equal(long.flight.gearCredits,4);assert.equal(E.survey(s,"lunar").records.length,2);
});
test("old backups and in-flight timers retain balances, notes, purchases and task progress",()=>{
  const old=M.fresh();old.version=1;delete old.settings.motion;delete old.equipped.gear;
  old.equipped.habitat="aurora";old.owned.push("aurora");old.credits=27;
  const historical={id:"old-star",mode:"focus",minutes:25,earned:25,endedAt:noon,tagId:"general",tagName:"General",tagColor:"sage",taskId:null,taskName:"",note:"Before habitat tracking"};
  old.sessions.push(historical);old.active={id:"old-timer",mode:"focus",minutes:1,startedAt:noon,endsAt:noon+60000,remainingMs:60000,tagId:"general",tagName:"General",tagColor:"sage",taskId:null,taskName:"",note:"In progress"};
  const upgraded=M.upgrade(old);assert.equal(upgraded.active.loadout.habitat,"aurora");assert.equal(upgraded.credits,27);
  assert.equal(E.survey(upgraded,"origin").records[0].note,historical.note);
  const restore=M.validateBackup(old);assert.equal(restore.active,null);assert.equal(restore.version,2);assert.equal(restore.credits,27);
  M.settle(upgraded,noon+60000);assert.equal(upgraded.result.flight.habitat,"aurora");assert.equal(upgraded.credits,28);
});
