(function orbitScreenAwake(){
  "use strict";
  function create(api,onStatus=()=>{}){
    const supported=typeof api?.request==="function";
    let wanted=false, pending=false, generation=0, held=null;
    let status=supported?"off":"unavailable";

    function report(next){
      if(next===status)return;
      status=next;
      onStatus(next);
    }

    async function request(){
      if(!supported || !wanted || pending || held)return;
      const started=generation;
      pending=true;
      try{
        const lock=await api.request("screen");
        // A request can finish after the tab was hidden or the setting changed.
        if(started!==generation){
          await lock.release();
          return;
        }
        if(lock.released){report("paused");return;}
        held=lock;
        lock.addEventListener("release",()=>{
          if(held!==lock)return;
          held=null;
          report("paused");
        },{once:true});
        report("active");
      }catch{
        if(started===generation)report("paused");
      }finally{
        pending=false;
        if(wanted && started!==generation)request();
      }
    }

    function setWanted(next){
      if(wanted===next || !supported)return;
      wanted=next;
      generation++;
      if(wanted){
        report("waiting");
        request();
      }else{
        const previous=held;
        held=null;
        report("off");
        if(previous)previous.release().catch(()=>{});
      }
    }

    return {setWanted,retry:request,get status(){return status;}};
  }
  globalThis.OrbitScreenAwake={create};
})();
