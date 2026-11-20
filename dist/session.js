(function orbitSession(){
  "use strict";
  const M=globalThis.OrbitModel,C=globalThis.OrbitCloud,A=globalThis.OrbitAccounts;
  const claimKey=M.key+".claimed";
  const signalKey=M.key+".account-event";
  const defaultStorage={
    get(key){try{return globalThis.localStorage.getItem(key);}catch{return null;}},
    set(key,value){try{globalThis.localStorage.setItem(key,value);return true;}catch{return false;}},
    remove(key){try{globalThis.localStorage.removeItem(key);}catch{}}
  };
  function create({notify=()=>{},loadSdk=A.sdk,storage=defaultStorage}={}){
    const account={phase:"connecting",message:"",signup:false,who:null,legacy:null,state:null,warning:"",revision:0};
    let api=null,store=null,epoch=0,authToken=null,draft=null,noteTimer,pulling=false,pendingWrites=0;
    const noteKey=()=>M.key+".account."+account.who.uuid+".note";
    const current=g=>g===epoch;
    const stillSigned=()=>!!api?.auth.isSignedIn() && (!authToken || api.authToken===authToken);
    function reset(phase,message=""){
      epoch++;clearTimeout(noteTimer);store=null;draft=null;authToken=null;pulling=false;pendingWrites=0;
      Object.assign(account,{phase,message,who:null,legacy:null,state:null,warning:"",revision:0});
      notify(true);
    }
    function phase(name,message=""){account.phase=name;account.message=message;notify(true);}
    function signal(kind){storage.set(signalKey,JSON.stringify({id:M.id(),kind}));}
    function readDraft(){
      try{
        const data=JSON.parse(storage.get(noteKey())||"null");
        return data && typeof data.id==="string" && typeof data.note==="string" && data.note.length<=500 &&
          (data.after===null || typeof data.after==="string")?data:null;
      }catch{return null;}
    }
    function canApply(d,s){return d && !s.active && !s.result && (s.sessions[0]?.id||null)===d.after;}
    function accept(remote,redraw=true){
      if(remote.revision<account.revision)return;
      account.revision=remote.revision;
      account.state=remote.state;
      if(canApply(draft,account.state))account.state.draft.note=draft.note;
      account.warning="";notify(redraw);
    }
    function loadLegacy(){
      if(storage.get(claimKey))return null;
      try{
        const raw=storage.get(M.key);
        if(!raw)return null;
        const local=M.validateLive(JSON.parse(raw)),note=storage.get(M.key+".draft-note");
        if(note!==null && !local.active && !local.result)local.draft.note=note.slice(0,500);
        return local;
      }catch{return null;}
    }
    function opened(remote){
      account.phase="ready";account.message="";account.legacy=null;
      draft=readDraft();accept(remote);
      if(draft)scheduleDraft(150);
    }
    async function identify(g){
      phase("loading-save");
      try{
        const who=await api.auth.getUser();
        if(!current(g))return;
        if(!A.permanent(who)){
          await api.auth.signOut();if(current(g))reset("signed-out","Create a permanent Puter account to save your outpost across devices.");
          return;
        }
        account.who={uuid:who.uuid,username:who.username};authToken=api.authToken||null;
        store=C.createStore(api.fs,who.uuid,()=>current(g) && stillSigned());
        const remote=await store.pull();
        if(!current(g))return;
        if(remote){opened(remote);return;}
        account.legacy=loadLegacy();
        if(account.legacy){phase("claim");return;}
        const created=await store.initialize(M.fresh());
        if(current(g))opened(created);
      }catch(error){
        if(current(g))phase("cloud-error",A.errorText(error,"Your account storage could not be reached."));
      }
    }
    async function boot(){
      reset("connecting");
      const g=epoch;
      if(globalThis.location?.protocol==="file:"){phase("file");return;}
      try{
        api=await loadSdk();
        if(!current(g))return;
        if(api.auth.isSignedIn()){await identify(g);return;}
        phase("signed-out");
      }catch(error){
        if(current(g))phase("sdk-error",A.errorText(error,"Check your connection to Puter and try again."));
      }
    }
    async function login(){
      if(account.phase!=="signed-out" || !api)return;
      const g=++epoch;
      phase("opening");
      try{
        await api.auth.signIn({attempt_temp_user_creation:false,request_auth:true});
        if(!current(g))return;
        signal("login");
        await identify(g);
      }catch(error){
        if(current(g))phase("signed-out",A.errorText(error,"Puter couldn’t complete the sign-in. Please try again."));
      }
    }
    async function chooseLegacy(importIt){
      if(account.phase!=="claim" || !store)return;
      const g=epoch,owner=account.who.uuid;
      phase("loading-save");
      async function seed(){
        if(!current(g))return;
        const legacy=importIt?loadLegacy():null;
        if(importIt && !legacy)throw Error("This browser’s progress was already claimed. Reconnect to open your own save.");
        const remote=await store.initialize(legacy||M.fresh());
        if(!current(g))return;
        if(importIt && remote.value)storage.set(claimKey,owner);
        opened(remote);
      }
      try{
        if(globalThis.navigator?.locks?.request)await navigator.locks.request(claimKey,seed);
        else await seed();
      }catch(error){
        if(current(g))phase("cloud-error",A.errorText(error,"Your progress could not be saved. Please reconnect."));
      }
    }
    function forgetDraft(saved){
      if(!saved || draft?.id!==saved.id)return;
      draft=null;
      if(readDraft()?.id===saved.id)storage.remove(noteKey());
    }
    function showFailure(){
      account.warning="Cloud sync paused. Check your connection and retry.";
      notify(false);
    }
    async function commit(action=()=>{},redraw=true){
      if(account.phase!=="ready" || !store)throw Error("Log in to open your outpost.");
      const g=epoch, saved=draft,previous=account.state;
      const context=(previous.active||previous.result)?.id||null;
      const layout=s=>s.active?"active":s.result?"result":"station";
      const previousLayout=layout(previous);
      let businessError;
      pendingWrites++;
      try{
        const remote=await store.transact(s=>{
          if(canApply(saved,s))s.draft.note=saved.note;
          M.settle(s);
          if(layout(s)!==previousLayout || ((s.active||s.result)?.id||null)!==context)return;
          try{return action(s);}catch(error){businessError=error;throw error;}
        });
        if(!current(g))throw Error("Your account changed.");
        forgetDraft(saved);
        const changedLayout=previousLayout!==layout(remote.state);
        accept(remote,redraw||changedLayout||remote.revision!==account.revision);
        return remote.value;
      }catch(error){
        if(current(g) && !businessError){
          if(!stillSigned())reset("signed-out","Log in again to reconnect your account.");
          else showFailure();
        }
        throw businessError||Error(A.errorText(error,"The change could not be confirmed. Reconnect and try again."));
      }finally{if(current(g))pendingWrites--;}
    }
    function scheduleDraft(delay=800){
      clearTimeout(noteTimer);
      noteTimer=setTimeout(()=>{if(draft && account.phase==="ready")commit(undefined,false).catch(()=>{});},delay);
    }
    function note(value){
      if(account.phase!=="ready" || account.state.active || account.state.result)return;
      draft={id:M.id(),note:value.slice(0,500),after:account.state.sessions[0]?.id||null};
      storage.set(noteKey(),JSON.stringify(draft));account.state.draft.note=draft.note;
      scheduleDraft();
    }
    async function refresh(verify=false){
      if(account.phase!=="ready" || pulling)return;
      const g=epoch;
      pulling=true;
      try{
        if(!stillSigned()){reset("signed-out","Log in again to reconnect your account.");return;}
        if(verify){
          const who=await api.auth.getUser();if(!current(g))return;
          if(!A.permanent(who) || who.uuid!==account.who.uuid){await boot();return;}
        }
        if(draft){await commit(undefined,false);return;}
        const remote=await store.pull();
        if(!current(g))return;
        if(!remote)throw Error("Your save is unavailable.");
        const changed=remote.revision!==account.revision;
        if(changed || account.warning)accept(remote,changed);
      }catch{if(current(g))showFailure();}
      finally{if(current(g))pulling=false;}
    }
    async function logout(){
      const g=epoch;
      if(account.phase==="signing-out")return;
      if(account.phase==="ready" && (draft || pendingWrites)){
        const flush=commit(undefined,false).catch(()=>{});
        phase("signing-out");
        let timeout;
        try{await Promise.race([flush,new Promise(resolve=>{timeout=setTimeout(resolve,2500);})]);}
        finally{clearTimeout(timeout);}
        if(!current(g))return;
      }
      reset("signing-out");
      const done=epoch;
      try{await api?.auth.signOut();}finally{
        if(current(done)){signal("logout");account.signup=false;reset("signed-out");}
      }
    }
    return Object.assign(account,{boot,login,logout,chooseLegacy,commit,note,refresh,signalKey});
  }
  globalThis.OrbitSession={create};
})();
