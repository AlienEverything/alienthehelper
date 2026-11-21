const test=require("node:test");
const assert=require("node:assert/strict");
require("../dist/screen-awake.js");
require("../dist/expedition.js");
require("../dist/model.js");

const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));

function fakeLock(){
  const lock=new EventTarget();
  lock.released=false;
  lock.release=async()=>{
    lock.released=true;
    lock.dispatchEvent(new Event("release"));
  };
  return lock;
}

function setup(){
  const requests=[];
  const control=OrbitScreenAwake.create({request(type){
    assert.equal(type,"screen");
    return new Promise((resolve,reject)=>requests.push({resolve,reject}));
  }});
  return {control,requests};
}

test("only one lock is requested while enabled and disabling releases it",async()=>{
  const {control,requests}=setup();
  control.setWanted(false);
  await control.retry();
  assert.equal(requests.length,0);
  control.setWanted(true);
  control.setWanted(true);
  await control.retry();
  assert.equal(requests.length,1);
  assert.equal(control.status,"waiting");
  const lock=fakeLock();
  requests[0].resolve(lock);
  await nextTurn();
  assert.equal(control.status,"active");
  await control.retry();
  assert.equal(requests.length,1);
  control.setWanted(false);
  assert.equal(control.status,"off");
  assert.equal(lock.released,true);
});

test("leaving and returning during acquisition releases the stale lock before reacquiring",async()=>{
  const {control,requests}=setup();
  control.setWanted(true);
  control.setWanted(false);
  control.setWanted(true);
  const stale=fakeLock();
  requests[0].resolve(stale);
  await nextTurn();
  assert.equal(stale.released,true);
  assert.equal(requests.length,2);
  control.setWanted(false);
  const late=fakeLock();
  requests[1].resolve(late);
  await nextTurn();
  assert.equal(late.released,true);
  assert.equal(control.status,"off");
  assert.equal(requests.length,2);
});

test("denial and a system release wait for a retry without spinning",async()=>{
  const {control,requests}=setup();
  control.setWanted(true);
  requests[0].reject(Error("Power saving"));
  await nextTurn();
  assert.equal(control.status,"paused");
  control.setWanted(true);
  assert.equal(requests.length,1);
  const lock=fakeLock();
  control.retry();
  requests[1].resolve(lock);
  await nextTurn();
  assert.equal(control.status,"active");
  await lock.release();
  assert.equal(control.status,"paused");
  assert.equal(requests.length,2);
  control.retry();
  requests[2].resolve(fakeLock());
  await nextTurn();
  assert.equal(control.status,"active");
});

test("browsers without the API can still use the app",async()=>{
  const control=OrbitScreenAwake.create(undefined);
  control.setWanted(true);
  await control.retry();
  control.setWanted(false);
  assert.equal(control.status,"unavailable");
});

test("old accounts and backups default to off and preserve a saved preference",()=>{
  const model=OrbitModel;
  assert.equal(model.fresh().settings.keepAwake,false);
  for(const version of [1,2]){
    const save=model.fresh();
    save.version=version;
    delete save.settings.keepAwake;
    save.credits=41;
    const restored=model.validateLive(save);
    assert.equal(restored.settings.keepAwake,false);
    assert.equal(restored.credits,41);
    assert.equal(Object.hasOwn(save.settings,"keepAwake"),false);
    restored.settings.keepAwake=true;
    assert.equal(model.validateBackup(restored).settings.keepAwake,true);
    assert.equal(model.validateLive(restored).settings.keepAwake,true);
    restored.settings.keepAwake="false";
    assert.throws(()=>model.validateBackup(restored),/settings/);
  }
});
