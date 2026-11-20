(function orbitCloud(){
  "use strict";
  const M=globalThis.OrbitModel;
  const prefix="orbit-outpost-save-";
  const revisionOf=name=>/^orbit-outpost-save-(\d{12})\.json$/.exec(name)?.[1];
  const filename=revision=>prefix+String(revision).padStart(12,"0")+".json";
  const missingAccount=()=>Error("Your account changed. Log in again to open your outpost.");
  function createStore(fs,owner,authorized=()=>true){
    if(typeof owner!=="string" || !owner)throw missingAccount();
    let head=null,tail=Promise.resolve();
    function assertAccount(){if(!authorized())throw missingAccount();}
    function series(work){
      const job=tail.then(()=>{assertAccount();return work();});
      tail=job.catch(()=>{});
      return job;
    }
    async function readHead(){
      assertAccount();
      const files=await fs.readdir("./");
      assertAccount();
      if(!Array.isArray(files))throw Error("Your save folder could not be read. Try again.");
      const revisions=files.filter(f=>!f.is_dir).map(f=>Number(revisionOf(f.name)||0)).filter(n=>n>0).sort((a,b)=>b-a);
      const revision=revisions[0]||0;
      if(!revision){
        if(head)throw Error("Your last save could not be found. Reconnect before making changes.");
        return {head:null,revisions};
      }
      if(head?.revision===revision)return {head,revisions};
      if(head && revision<head.revision)throw Error("Your save folder is still updating. Try again.");
      const blob=await fs.read(filename(revision));
      const record=JSON.parse(await blob.text());
      assertAccount();
      if(record?.format!==1 || record.owner!==owner || record.revision!==revision || !Array.isArray(record.recent) ||
        !record.recent.every(id=>typeof id==="string") || !record.recent.length)
        throw Error("This cloud save could not be verified. Your existing files are safe.");
      head={...record,state:M.validateLive(record.state)};
      return {head,revisions};
    }
    const copy=record=>record?{revision:record.revision,state:structuredClone(record.state)}:null;
    function pull(){return series(async()=>copy((await readHead()).head));}
    async function transact(operation,{initial=false}={}){
      return series(async()=>{
        const operationId=M.id();
        let value;
        for(let attempt=0;attempt<8;attempt++){
          const {head:base,revisions}=await readHead();
          if(base?.recent.includes(operationId))return {...copy(base),value};
          if(initial && base)return {...copy(base),value:false};
          if(!initial && !base)throw Error("Open your cloud save before making changes.");
          const next=base?structuredClone(base.state):M.fresh();
          value=operation(next);
          if(base && JSON.stringify(base.state)===JSON.stringify(next))return {...copy(base),value};
          const revision=(base?.revision||0)+1;
          const record={format:1,owner,revision,recent:[...(base?.recent||[]).slice(-31),operationId],state:M.validateLive(next)};
          assertAccount();
          try{
            await fs.write(filename(revision),JSON.stringify(record),{overwrite:false,dedupeName:false});
          }catch(writeError){
            // A connection can drop after the file was created, or another device can win this revision.
            const observed=(await readHead()).head;
            if(observed?.recent.includes(operationId))return {...copy(observed),value};
            if(observed && observed.revision>=revision)continue;
            throw writeError;
          }
          assertAccount();
          head=record;
          // Keep four recoverable versions. Only this app's older revision files are eligible.
          if(revisions.length>=4 && typeof fs.delete==="function"){
            for(const old of revisions.slice(3,7)){
              if(!authorized())break;
              await fs.delete(filename(old),{recursive:false}).catch(()=>{});
            }
          }
          return {...copy(record),value};
        }
        throw Error("Several devices are saving at once. Please try that change again.");
      });
    }
    return {pull,transact,initialize:seed=>transact(s=>{Object.assign(s,structuredClone(seed));return true;},{initial:true})};
  }
  globalThis.OrbitCloud={createStore};
})();
