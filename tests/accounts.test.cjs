const test=require("node:test"),assert=require("node:assert/strict");
for(const file of ["expedition","model","icons","views","accounts","cloud","commands","session"])require("../dist/"+file+".js");
const M=globalThis.OrbitModel,C=globalThis.OrbitCloud,A=globalThis.OrbitAccounts;
const later=()=>new Promise(resolve=>setImmediate(resolve));
function deviceStorage(){
  const data=new Map();
  return {get:k=>data.get(k)??null,set:(k,v)=>data.set(k,v),remove:k=>data.delete(k),keys:()=>[...data.keys()]};
}
function provider(){
  const folders=new Map();
  function device(owner=null,storage=deviceStorage()){
    const api={authToken:owner,offline:false,lostReply:false,temp:false,next:"pilot-a",popups:0};
    function files(){if(!api.authToken)throw Error("Not signed in");return folders.get(api.authToken)||folders.set(api.authToken,new Map()).get(api.authToken);}
    async function connection(){await later();if(api.offline)throw Error("Cloud unavailable");}
    api.auth={
      isSignedIn:()=>Boolean(api.authToken),
      getUser:async()=>{await connection();return {uuid:api.authToken,username:api.authToken,is_temp:api.temp};},
      signIn:async options=>{
        assert.deepEqual(options,{attempt_temp_user_creation:false,request_auth:true});
        api.popups++;if(api.cancel)throw {error:"auth_window_closed"};api.authToken=api.next;
      },
      signOut:async()=>{api.authToken=null;}
    };
    api.fs={
      readdir:async p=>{assert.equal(p,"./");await connection();return [...files().keys()].map(name=>({name}));},
      read:async p=>{await connection();if(!files().has(p))throw Error("Missing save");return new Blob([files().get(p)]);},
      write:async(p,value,options)=>{
        assert.deepEqual(options,{overwrite:false,dedupeName:false});await connection();
        if(files().has(p))throw {error:"item_with_same_name_exists"};
        files().set(p,value);
        if(api.lostReply){api.lostReply=false;throw Error("Connection interrupted after write");}
      },
      delete:async p=>{await connection();files().delete(p);}
    };
    const screen=()=>OrbitSession.create({loadSdk:async()=>api,storage});
    return {api,storage,screen};
  }
  return {folders,device};
}
test("signed-out and cancelled sign-ups cannot access any study data",async()=>{
  const cloud=provider(),device=cloud.device(),session=device.screen();
  await session.boot();
  assert.equal(session.phase,"signed-out");assert.equal(session.state,null);
  assert.match(A.gate(session),/Create an account/);
  assert.doesNotMatch(A.gate(session),/class="side-nav"|data-act="launch"/);
  session.signup=true;assert.match(A.gate(session),/Sign up with Puter/);
  device.api.cancel=true;await session.login();
  assert.equal(session.phase,"signed-out");assert.match(session.message,/closed/);
  await assert.rejects(session.commit(s=>s.credits++));assert.equal(cloud.folders.size,0);
  device.api.cancel=false;device.api.temp=true;await session.login();
  assert.equal(session.phase,"signed-out");assert.equal(cloud.folders.size,0);assert.equal(device.api.authToken,null);
});
test("two devices recover the same paused timer, shop purchases and exactly one completion",async()=>{
  const cloud=provider(),first=cloud.device(),second=cloud.device("pilot-a");
  const a=first.screen(),b=second.screen();
  await a.boot();await a.login();
  assert.equal(a.phase,"ready");
  await a.commit(s=>{s.credits=80;M.buy(s,"scanner");M.equip(s,"scanner");s.draft.tagId="math";});
  a.note("Review derivatives");await a.commit(s=>{M.start(s,1000);M.togglePause(s,2000);});
  await b.boot();
  assert.equal(b.state.active.endsAt,null);assert.equal(b.state.active.remainingMs,1499000);
  assert.equal(b.state.active.note,"Review derivatives");assert.equal(b.state.equipped.gear,"scanner");
  const restored=second.screen();await restored.boot();
  assert.equal(restored.state.active.id,a.state.active.id);
  await b.commit(s=>M.togglePause(s,3000));
  await Promise.all([a.commit(),restored.commit()]);
  await b.refresh();
  const rec=b.state.sessions[0];
  assert.equal(b.state.sessions.length,1);assert.equal(b.state.result.id,rec.id);
  assert.equal(b.state.credits,35+OrbitExpedition.totalCredits(rec));
  assert.equal(rec.flight.gearSurvey,1);assert.equal(rec.tagId,"math");
  const other=cloud.device("pilot-b").screen();await other.boot();
  assert.equal(other.state.credits,0);assert.equal(other.state.sessions.length,0);assert.equal(other.state.draft.note,"");
  await a.logout();assert.equal(a.phase,"signed-out");assert.equal(a.state,null);
});
test("overlapping revisions merge independent changes, survive a lost reply and keep recent snapshots",async()=>{
  const d=provider().device("pilot-a"),a=C.createStore(d.api.fs,"pilot-a"),b=C.createStore(d.api.fs,"pilot-a");
  const init=await Promise.all([a.initialize(M.fresh()),b.initialize(M.fresh())]);
  assert.equal(init.filter(i=>i.value).length,1);
  await Promise.all([a.transact(s=>{s.credits+=15;}),b.transact(s=>{s.settings.focus=42;})]);
  d.api.lostReply=true;
  await b.transact(s=>{s.credits+=25;});
  const result=await a.pull();
  assert.equal(result.state.credits,40);assert.equal(result.state.settings.focus,42);
  for(let i=0;i<5;i++)await a.transact(s=>{s.credits++;});
  assert.equal((await d.api.fs.readdir("./")).length,4);
  assert.equal((await b.pull()).state.credits,45);
});
test("old local progress needs a claim, belongs to one user, and never overwrites an existing cloud save",async()=>{
  const cloud=provider(),storage=deviceStorage(),d=cloud.device("pilot-a",storage),s=M.fresh();
  s.credits=23;s.draft.note="Original notes";s.version=1;delete s.settings.motion;delete s.equipped.gear;
  storage.set(M.key,JSON.stringify(s));storage.set(M.key+".draft-note","Typed before reload");
  const a=d.screen();await a.boot();
  assert.equal(a.phase,"claim");assert.equal(a.state,null);
  await a.chooseLegacy(true);assert.equal(a.state.credits,23);assert.equal(a.state.draft.note,"Typed before reload");
  await a.logout();d.api.next="pilot-b";await a.login();
  assert.equal(a.phase,"ready");assert.equal(a.state.credits,0);assert.equal(a.state.draft.note,"");
  const existing=cloud.device("pilot-a",deviceStorage());existing.storage.set(M.key,JSON.stringify({...M.fresh(),credits:920}));
  const b=existing.screen();await b.boot();assert.equal(b.phase,"ready");assert.equal(b.state.credits,23);
});
test("failed reads and invalid owner stamps cannot initialize or replace previous progress",async()=>{
  const cloud=provider(),d=cloud.device("pilot-a"),a=d.screen();await a.boot();await a.commit(s=>{s.credits=50;});
  const files=cloud.folders.get("pilot-a"),before=Array.from(files.entries());
  d.api.offline=true;const second=d.screen();await second.boot();assert.equal(second.phase,"cloud-error");assert.equal(second.state,null);
  assert.deepEqual([...files],before);d.api.offline=false;
  const [name,source]=before.at(-1);files.set(name,JSON.stringify({...JSON.parse(source),owner:"pilot-b"}));
  await second.boot();assert.equal(second.phase,"cloud-error");assert.equal(second.state,null);
  files.set(name,source);await second.boot();assert.equal(second.state.credits,50);
  const active=M.fresh();M.start(active);active.active.endsAt="tomorrow";assert.throws(()=>M.validateLive(active));
});
test("offline notes are isolated, retry on return, and cannot reappear over a completed timer",async()=>{
  const cloud=provider(),d=cloud.device("pilot-a"),a=d.screen();await a.boot();
  d.api.offline=true;a.note("Field sketches");await assert.rejects(a.commit());assert.match(a.warning,/sync paused/);
  await a.logout();d.api.offline=false;d.api.next="pilot-b";await a.login();assert.equal(a.state.draft.note,"");
  await a.logout();d.api.next="pilot-a";await a.login();assert.equal(a.state.draft.note,"Field sketches");
  await a.refresh();const other=cloud.device("pilot-a").screen();await other.boot();assert.equal(other.state.draft.note,"Field sketches");
  d.api.offline=true;a.note("Stale draft");
  await other.commit(s=>M.start(s,1000));await other.commit();await other.commit(s=>{s.result=null;});
  d.api.offline=false;await a.refresh();assert.equal(a.state.draft.note,"");assert.equal(a.state.sessions.length,1);
});
test("a previous identity cannot paint or write after sign-out during an in-flight read",async()=>{
  const cloud=provider(),d=cloud.device("pilot-a"),a=d.screen();
  let release;const wait=new Promise(r=>{release=r;});
  const get=d.api.auth.getUser;d.api.auth.getUser=async()=>{const old=await get();await wait;return old;};
  const starting=a.boot();while(a.phase!=="loading-save")await later();await later();await later();
  await a.logout();release();await starting;assert.equal(a.state,null);assert.equal(a.phase,"signed-out");assert.equal(cloud.folders.size,0);
});
test("rapid local choices and dependent edits render before the first cloud request completes",async()=>{
  const d=provider().device("pilot-a"),a=d.screen();await a.boot();
  let resume;const gate=new Promise(r=>{resume=r;});
  const read=d.api.fs.readdir;d.api.fs.readdir=async p=>{await gate;return read(p);};
  a.dispatch("mode",{mode:"short"});assert.equal(a.state.draft.mode,"short");
  const first=a.flush();
  a.dispatch("mode",{mode:"focus"});
  a.dispatch("task",{id:"work",name:"Read chapter",tagId:"math",target:2});
  a.dispatch("link-task",{id:"work"});a.dispatch("launch",{note:"Chapter 3"});
  const timer=a.state.active.id;
  a.dispatch("pause",{paused:true});
  assert.equal(a.state.active.endsAt,null);assert.equal(a.state.active.taskId,"work");
  resume();await first;
  const b=d.screen();await b.boot();
  assert.equal(b.state.active.id,timer);assert.equal(b.state.active.endsAt,null);
  assert.equal(b.state.active.note,"Chapter 3");assert.equal(b.state.tasks.length,1);
});
test("offline changes survive reload, reconcile once, and preserve independent edits from another device",async()=>{
  const cloud=provider(),d=cloud.device("pilot-a"),a=d.screen();await a.boot();
  d.api.offline=true;a.dispatch("task",{id:"homework",name:"Read",tagId:"math",target:1});
  await assert.rejects(a.flush());assert.match(a.warning,/sync paused/);
  const b=cloud.device("pilot-a").screen();await b.boot();b.dispatch("mode",{mode:"long"});await b.flush();
  d.api.offline=false;const c=d.screen();await c.boot();
  assert.equal(c.state.tasks[0].id,"homework");assert.equal(c.state.draft.mode,"long");
  await Promise.all([a.flush(),c.flush()]);await b.refresh();
  assert.equal(b.state.tasks.length,1);assert.equal(b.state.draft.mode,"long");
  assert.equal(d.storage.keys().some(key=>key.includes(".change.")),false);
});
test("competing purchases reconcile to the affordable balance and queued edits stay with their account",async()=>{
  const cloud=provider(),d=cloud.device("pilot-a"),a=d.screen(),b=cloud.device("pilot-a").screen();
  await a.boot();await a.commit(s=>{s.credits=50;});await b.boot();
  a.dispatch("buy",{id:"wisp"});b.dispatch("buy",{id:"scanner"});
  await a.flush();await b.flush();assert.match(b.warning,/balance/);
  assert.deepEqual(b.state.owned,["pip","lunar","wisp"]);assert.equal(b.state.credits,25);
  d.api.offline=true;a.dispatch("mode",{mode:"long"});await a.logout();
  d.api.offline=false;d.api.next="pilot-b";await a.login();
  assert.equal(a.state.draft.mode,"focus");assert.equal(a.state.credits,0);
});
test("two offline completions for the same timer award one session without a conflict warning",async()=>{
  const cloud=provider(),d=cloud.device("pilot-a"),a=d.screen(),b=cloud.device("pilot-a").screen();
  await a.boot();await a.commit(s=>M.start(s,1000));await b.boot();
  a.dispatch("settle");b.dispatch("settle");
  assert.equal(a.state.sessions.length,1);assert.equal(b.state.sessions.length,1);
  await Promise.all([a.flush(),b.flush()]);await a.refresh();await b.refresh();
  assert.equal(a.state.credits,b.state.credits);assert.equal(b.state.sessions.length,1);
  assert.equal(a.warning,"");assert.equal(b.warning,"");
});

test("concurrent claims from two devices pay each daily reward once and survive reload",async()=>{
  const cloud=provider(),a=cloud.device("pilot-a").screen(),b=cloud.device("pilot-a").screen();
  await a.boot();
  const start=new Date(2026,10,20,9).getTime(),day=OrbitExpedition.dayKey(start);
  await a.commit(s=>{
    for(const [i,len] of [25,15,15,25,25].entries()){
      s.result=null;s.settings.focus=len;M.start(s,start+i*3600000);M.settle(s,s.active.endsAt);
    }
    s.result=null;
  });
  await b.boot();
  const before=a.state.credits,cards=OrbitExpedition.daily(a.state,day).cards;
  assert.ok(cards.every(c=>c.ready));
  for(const id of [...cards.map(c=>c.id),"patch"]){
    a.dispatch("claim-reward",{day,id});b.dispatch("claim-reward",{day,id});
    await Promise.all([a.flush(),b.flush()]);
    await Promise.all([a.refresh(),b.refresh()]);
  }
  assert.equal(a.state.credits,before+28);
  assert.equal(b.state.credits,before+28);
  const fresh=cloud.device("pilot-a").screen();await fresh.boot();
  const board=OrbitExpedition.daily(fresh.state,day);
  assert.ok(board.patch && board.cards.every(c=>c.paid && !c.ready));
});
