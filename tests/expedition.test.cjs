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
  for(const [i,minutes] of [25,15,15,25,25].entries()){
    s.draft.note="Write the derivation.";s.draft.tagId=i%2?"math":"biology";
    study(s,noon+i*3600000,minutes);
    assert.equal(M.settle(s,noon+4*3600000),false);
  }
  const board=E.daily(s,E.dayKey(noon));
  assert.equal(board.cards.length,3);assert.equal(board.completed,3);assert.equal(board.patch,false);
  const base=3*8+2*5,day=board.day;
  assert.equal(s.credits,base);
  assert.equal(E.claimReward(s,day,"patch"),0);
  assert.equal(E.claimReward(s,day,"invalid"),0);
  assert.equal(s.sessions.flatMap(r=>r.flight.pendingMissions||[]).length,3);
  const restored=M.validateLive(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(E.earlierRewards(restored,"2026-11-21").map(b=>b.day),[day]);
  for(const card of board.cards){
    assert.equal(card.ready,true);assert.equal(card.paid,false);
    assert.equal(E.claimReward(s,day,card.id),card.reward);
    assert.equal(E.claimReward(s,day,card.id),0);
  }
  assert.equal(s.credits,base+18);
  assert.equal(E.earlierRewards(s,"2026-11-21")[0].pendingPatch,true);
  assert.equal(E.claimReward(s,day,"patch"),10);
  assert.equal(E.claimReward(s,day,"patch"),0);
  assert.deepEqual(E.earlierRewards(s,"2026-11-21"),[]);
  const paid=s.sessions.flatMap(r=>r.flight.missions);
  assert.equal(paid.length,3);assert.equal(new Set(paid).size,3);
  assert.equal(s.sessions.filter(r=>r.flight.patch).length,1);
  assert.equal(s.credits,3*8+2*5+4+6+8+10);
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
  assert.equal(record.earned,5);assert.equal(E.totalCredits(record),5+3+E.missionCredits(record.flight)+(record.flight.patch?E.patchCredits:0));assert.equal(E.survey(s,"aurora").points,0);
  const copy=JSON.parse(JSON.stringify(s));copy.sessions[0].flight.gear="not-a-product";assert.throws(()=>M.validateBackup(copy));
});
test("short timers earn a star without qualifying for crew, gear or gated challenges",()=>{
  const s=prepare();s.equipped.companion="fenn";s.equipped.gear="antenna";
  const short=study(s,noon,1);
  assert.equal(short.flight.survey,0);assert.equal(short.flight.gearCredits,0);assert.equal(E.totalCredits(short),0);
  const long=study(s,noon+3600000,45);
  assert.equal(long.flight.survey,7);assert.equal(long.flight.gearCredits,4);assert.equal(E.survey(s,"lunar").records.length,2);
});
test("old backups and in-flight timers retain balances, notes, purchases and task progress",()=>{
  const old=M.fresh();old.version=1;delete old.settings.motion;delete old.equipped.gear;
  old.equipped.habitat="aurora";old.owned.push("aurora");old.credits=27;
  const historical={id:"old-star",mode:"focus",minutes:25,earned:25,endedAt:noon,tagId:"general",tagName:"General",tagColor:"sage",taskId:null,taskName:"",note:"Before habitat tracking"};
  old.sessions.push(historical);old.active={id:"old-timer",mode:"focus",minutes:1,startedAt:noon,endsAt:noon+60000,remainingMs:60000,tagId:"general",tagName:"General",tagColor:"sage",taskId:null,taskName:"",note:"In progress"};
  const upgraded=M.upgrade(old);assert.equal(upgraded.active.loadout.habitat,"aurora");assert.equal(upgraded.credits,27);
  assert.equal(E.survey(upgraded,"origin").records[0].note,historical.note);
  const restore=M.validateBackup(old);assert.equal(restore.active,null);assert.equal(restore.version,2);assert.equal(restore.credits,27);
  M.settle(upgraded,noon+60000);assert.equal(upgraded.result.flight.habitat,"aurora");assert.equal(upgraded.credits,27);
});
test("each complete three-minute block earns one base credit; historical payouts survive restore",()=>{
  const s=M.fresh();
  for(const [minutes,base] of [[1,0],[2,0],[3,1],[4,1],[25,8],[45,15],[180,60]]){
    const before=s.credits;
    const record=study(s,noon,minutes);
    assert.equal(record.earned,base);
    assert.equal(s.credits-before,E.totalCredits(record));
  }
  const older={...s.sessions[0],id:"legacy-payout",minutes:45,earned:45,flight:null};
  s.sessions.push(older);
  const saved=M.validateLive(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.sessions.at(-1).earned,45);
  assert.equal(M.validateBackup(saved).credits,s.credits);
  saved.sessions.at(-1).earned=44;
  assert.throws(()=>M.validateBackup(saved));
});
test("each habitat unlocks its own three advanced landmarks from saved survey points",()=>{
  const worlds=M.items.filter(i=>i.type==="habitat");
  const art=new Set(),names=new Set();
  for(const world of worlds){
    const s=M.fresh();
    s.sessions=[{id:"survey",endedAt:noon,flight:{habitat:world.id,survey:0}}];
    for(const [points,at,next] of [[0,0,3],[17,9,18],[18,18,30],[29,18,30],[30,30,45],[44,30,45],[45,45,60],[59,45,60],[60,60,null],[90,60,null]]){
      s.sessions[0].flight.survey=points;
      const area=E.survey(s,world.id);
      assert.deepEqual(area.stages.slice(1).map(t=>t.at),[3,9,18,30,45,60]);
      assert.equal(area.stage.at,at);assert.equal(area.next?.at??null,next);
      if(points===at && at>=30){art.add(area.stage.image);names.add(area.stage.name);}
    }
    assert.equal(E.survey(s,worlds.find(w=>w!==world).id).stage.at,0);
  }
  assert.equal(names.size,15);assert.equal(art.size,15);
});

test("the daily draw samples 61 distinct, tag-independent challenges and stays stable on reload",()=>{
  const pool=new Map(),sets=new Set(),state=M.fresh();
  state.tags[0].name="Everything";
  for(let n=0;n<730;n++){
    const day=E.dayKey(new Date(2025,0,1+n,12)),cards=E.daily(state,day).cards;
    assert.equal(new Set(cards.map(c=>c.id)).size,3);
    assert.deepEqual(cards.map(c=>c.reward),[4,6,8]);
    const ids=cards.map(c=>c.id);
    assert.deepEqual(E.daily(structuredClone(state),day).cards.map(c=>c.id),ids);
    sets.add(ids.sort().join(","));
    for(const c of cards){
      assert.doesNotMatch(c.description,/\b(tag|subject|general)\b/i);
      assert.equal(c.progress,0);
      pool.set(c.id,c);
    }
  }
  assert.equal(pool.size,61);
  assert.equal(new Set([...pool.values()].map(c=>c.description)).size,61);
  assert.ok(sets.size>650);
  // Every objective must be achievable with the starter habitat, companion and one renamed tag.
  const rows=[];
  for(const [minutes,noted,taskId] of [
    [10,false,null],[15,true,"a"],[15,true,"a"],[15,true,"b"],[35,true,"b"],
    [35,true,"b"],[25,true,"a"],[25,true,"a"],[40,true,null],[25,true,null],
    [35,true,"a"],[10,true,null],[15,true,null],[15,true,null],[15,true,null]
  ])rows.push({minutes,taskId,tagId:"general",flight:{subject:"general",noted,linked:!!taskId,survey:Math.floor(minutes/10),habitat:"lunar"}});
  for(const card of pool.values())assert.ok(card.measure(rows)>=card.target,card.name);
});
test("paid legacy slots and the set bonus survive a mid-day update",()=>{
  const s=M.fresh(),start=new Date(2026,10,17,9).getTime();
  const old=study(s,start,45);
  delete old.flight.pendingMissions;delete old.flight.pendingPatch;
  delete old.flight.crewRules;delete old.flight.missionSet;old.flight.missions=["subject"];old.flight.patch=false;
  s.credits=old.earned+4;
  assert.equal(E.missionCredits(old.flight),4);
  const before=E.daily(s,old.flight.day);
  assert.equal(before.completed,1);assert.equal(before.cards[0].paid,true);
  assert.doesNotMatch(before.cards[0].description,/subject|tag|general/i);
  for(const [i,length] of [15,15,25,35,45].entries())study(s,start+(i+1)*3600000,length);
  assert.ok(s.sessions.flatMap(r=>r.flight.missions).length<=3);
  old.flight.missions=["subject","time45","variety"];old.flight.patch=true;
  s.sessions=[old];s.result=null;s.credits=old.earned+18+10;
  assert.equal(E.daily(s,old.flight.day).completed,3);
  assert.equal(E.totalCredits(old),s.credits);
  assert.deepEqual(M.validateBackup(s),s);
  const next=study(s,start+7*3600000,45);
  assert.deepEqual(next.flight.missions,[]);assert.equal(next.flight.patch,false);
});
test("Nyx banks qualifying minutes across sessions and resets its cap each day",()=>{
  const s=M.fresh();s.owned.push("nyx","aurora");s.equipped.companion="nyx";
  const earn=(time,minutes)=>study(s,time,minutes).flight.crewSurvey;
  assert.equal(earn(noon,9),0);
  assert.equal(earn(noon+3600000,15),0);
  s.equipped.habitat="aurora";
  assert.equal(earn(noon+2*3600000,15),2);
  assert.equal(earn(noon+3*3600000,60),2);
  assert.equal(earn(noon+5*3600000,30),0);
  assert.equal(earn(noon+86400000,60),4);
  assert.doesNotThrow(()=>M.validateLive(s));
});
test("Wisp uses the actual gap before the session, including across midnight",()=>{
  for(const [gap,points] of [[4,0],[5,2],[30,2],[31,0]]){
    const s=M.fresh();s.owned.push("wisp");
    const start=new Date(2026,10,20,23,48).getTime();
    study(s,start,10);s.result=null;s.equipped.companion="wisp";
    const restart=start+(10+gap)*60000;
    M.start(s,restart);M.togglePause(s,restart+60000);M.togglePause(s,restart+40*60000);
    M.settle(s,s.active.endsAt);
    assert.equal(s.result.flight.crewSurvey,points);
  }
});
test("Sol rewards task steps and gives its completion bonus once",()=>{
  const s=prepare();s.owned.push("sol");s.equipped.companion="sol";s.tasks[0].target=2;
  assert.equal(study(s,noon,10).flight.crewSurvey,1);
  assert.equal(study(s,noon+3600000,10).flight.crewSurvey,2);
  assert.equal(s.tasks[0].done,true);
  assert.equal(study(s,noon+2*3600000,25).flight.crewSurvey,0);
});

test("prices change in place and purchases charge the displayed price",()=>{
  const prices=[["pip",0],["wisp",25],["sol",60],["nyx",75],["fenn",115],["lunar",0],["aurora",50],["ember",85],["grotto",100],["reef",140]];
  assert.deepEqual(E.items.filter(p=>p.type!=="gear").map(p=>[p.id,p.price]),prices);
  for(const [id,price] of prices.filter(([,n])=>n>0)){
    const s=M.fresh();s.credits=price-1;
    assert.equal(M.buy(s,id),false);
    s.credits=price;assert.equal(M.buy(s,id),true);
    assert.equal(s.credits,0);assert.equal(s.owned.includes(id),true);
  }
});
test("Fenn earns one survey point per complete eight minutes at every supported duration",()=>{
  for(let minutes=1;minutes<=180;minutes++){
    const s=M.fresh();s.owned.push("fenn");s.equipped.companion="fenn";
    const r=study(s,noon,minutes);
    assert.equal(r.flight.survey,Math.floor(minutes/8));
    assert.equal(r.earned,Math.floor(minutes/3));
    assert.doesNotThrow(()=>M.validateLive(s));
  }
});
test("prior companion payouts survive restore and old Nyx sessions do not fill the new bank",()=>{
  const s=M.fresh();s.owned.push("wisp","nyx","fenn");
  for(const [i,[id,minutes,award]] of [["wisp",60,4],["nyx",30,2],["fenn",45,2]].entries()){
    s.equipped.companion=id;
    const f=study(s,noon+i*3600000,minutes).flight;
    delete f.crewRules;
    f.crewSurvey=award;f.survey=Math.floor(minutes/10)+award;
  }
  const restored=M.validateLive(JSON.parse(JSON.stringify(s)));
  assert.equal(E.survey(restored,"lunar").points,21);
  restored.equipped.companion="nyx";
  assert.equal(study(restored,noon+3*3600000,15).flight.crewSurvey,0);
  assert.equal(study(restored,noon+4*3600000,15).flight.crewSurvey,2);
});
