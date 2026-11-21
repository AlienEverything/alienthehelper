(function orbitApp(){
  "use strict";
  const M=OrbitModel, V=OrbitViews, D=OrbitDialogs, E=OrbitExpedition, F=OrbitFlightViews;
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const A=OrbitAccounts;
  const app=document.querySelector("#app"), dialog=document.querySelector("#dialog"), notice=document.querySelector("#notice");
  const defaults=()=>({taskFilter:"open",shopFilter:"all",collectionFilter:"all",logTag:"",logLimit:20,atlasWorld:null,atlasSheet:null});
  let ui=defaults(), state=M.fresh(), noticeId, settling=false, retryAfter=0, pendingRestore=null, focusOrigin=null, renderedDay="";
  const account=OrbitSession.create({notify:accountUpdated});
  let pageShown=true;
  const awakePausedNotice="Your device may still auto-lock. Tap the page to try again.";
  const screenAwake=OrbitScreenAwake.create(navigator.wakeLock,status=>{
    const help=dialog.querySelector("#awake-help");
    if(help)help.textContent=D.awakeHelp[status];
    if(status==="paused" && !dialog.open && !document.hidden)announce(awakePausedNotice);
  });
  function syncScreenAwake(){
    screenAwake.setWanted(pageShown && document.visibilityState==="visible" && account.phase==="ready" && state.settings.keepAwake);
  }
  function accountUpdated(redraw){
    if(account.phase==="ready")state=account.state;
    else{
      state=M.fresh();ui=defaults();pendingRestore=null;focusOrigin=null;retryAfter=0;
      notice.hidden=true;clearTimeout(noticeId);
      if(dialog.open)dialog.close();
      dialog.replaceChildren();
    }
    syncScreenAwake();
    if(redraw)render();else syncWarning();
  }
  function syncWarning(){
    const existing=document.getElementById("cloud-warning");
    if(!account.warning || account.phase!=="ready"){existing?.remove();return;}
    if(existing){existing.querySelector("span").textContent=account.warning;return;}
    const msg=document.createElement("div");
    msg.id="cloud-warning";msg.className="cloud-warning";msg.setAttribute("role","status");
    msg.innerHTML='<span>'+V.escape(account.warning)+'</span><button type="button" data-act="retry-sync">Retry sync</button>';
    const header=app.querySelector(".page-head");
    if(header)header.after(msg);else app.querySelector("main")?.append(msg);
  }
  const page=()=>Object.hasOwn(V.titles,location.hash.slice(1))?location.hash.slice(1):"station";
  function pointTo(view){
    if(page()===view)return;
    history.replaceState(null,"","#"+view);
    window.scrollTo(0,0);
  }
  function announce(msg){
    if(state.active || account.phase!=="ready")return;
    clearTimeout(noticeId);
    notice.textContent=msg;notice.hidden=false;
    noticeId=setTimeout(()=>{notice.hidden=true;},3200);
  }
  function render(){
    if(account.phase!=="ready"){
      app.dataset.layout="account";app.dataset.page="";
      app.innerHTML=A.gate(account);
      document.title=(account.signup?"Create an account":"Log in")+" · Orbit Outpost";
      return;
    }
    const mode=state.active?"quiet":state.result?"result":"station";
    const focused=document.activeElement;
    const draftField=document.getElementById("session-note");
    const keepFocus=app.contains(focused) && app.dataset.layout===mode && app.dataset.page===page();
    if(app.dataset.layout!==mode && dialog.open)dialog.close();
    const changedLayout=app.dataset.layout!==mode;
    app.dataset.layout=mode;
    app.dataset.page=page();
    if(mode==="quiet"){
      notice.hidden=true;app.innerHTML=F.focusRoom(state,reducedMotion.matches);updateClock();
    }else if(mode==="result"){
      app.innerHTML=F.result(state);document.title=(state.result.mode==="focus"?"Session complete":"Break complete")+" · Orbit Outpost";
    }else{
      app.innerHTML=V.frame(state,page(),ui);
      const nextField=document.getElementById("session-note");
      if(draftField && nextField){
        if(draftField.value!==state.draft.note)draftField.value=state.draft.note;
        nextField.replaceWith(draftField);
      }
      document.title=V.titles[page()]+" · Orbit Outpost";
    }
    syncWarning();
    if(keepFocus){
      const replacement=focused.id?document.getElementById(focused.id):[...app.querySelectorAll("[data-act]")].find(el=>el.dataset.act===focused.dataset.act && el.dataset.value===focused.dataset.value);
      replacement?.focus({preventScroll:true});
    }
    if(changedLayout && mode!=="station"){window.scrollTo(0,0);app.querySelector("main")?.focus({preventScroll:true});}
    renderedDay=M.dayKey();
  }
  const change=(type,data)=>account.dispatch(type,data);
  function updateClock(){
    const a=state.active;if(!a)return;
    const ms=M.left(a), value=V.clock(ms);
    const label=document.getElementById("live-clock"), progress=document.getElementById("live-progress");
    if(label && label.textContent!==value)label.textContent=value;
    if(progress){
      const pct=Math.max(0,Math.min(100,(1-ms/(a.minutes*60000))*100));
      progress.firstElementChild.style.width=pct+"%";progress.setAttribute("aria-valuenow",Math.floor(pct));
    }
    const title=`${value} · ${a.endsAt===null?"Paused":M.modes[a.mode]} · Orbit`;
    if(document.title!==title)document.title=title;
  }
  async function tick(){
    if(account.phase!=="ready")return;
    if(state.active){
      if(state.active.endsAt!==null && M.left(state.active)===0){
        updateClock();
        if(settling || Date.now()<retryAfter)return;
        settling=true;
        try{await change("settle");retryAfter=0;}
        catch{retryAfter=Date.now()+15000;}
        finally{settling=false;}
      }else updateClock();
    }else if(renderedDay!==M.dayKey())render();
  }
  function openDialog(html){
    if(account.phase!=="ready")return;
    if(!dialog.open){
      const el=document.activeElement;
      focusOrigin=el?.dataset?.act?{act:el.dataset.act,value:el.dataset.value}:null;
    }
    dialog.innerHTML=html;dialog.scrollTop=0;
    if(!dialog.open)dialog.showModal();
    const auto=dialog.querySelector("[autofocus]");if(auto)auto.focus();
    else dialog.querySelector(".dialog-head button")?.focus();
  }
  function closeDialog(){if(dialog.open)dialog.close();}
  function formError(msg){
    const err=dialog.querySelector("#form-error");
    if(err){err.textContent=msg;err.hidden=false;}else announce(msg);
  }
  function downloadBackup(){
    const current=state, date=M.dayKey();
    const url=URL.createObjectURL(new Blob([JSON.stringify({...current,syncCursors:undefined,active:null,result:null},null,2)],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`orbit-outpost-${date}.json`;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);announce("Backup exported.");
  }
  async function act(action,value){
    if(action==="sign-out"){await account.logout();return;}
    if(account.phase!=="ready"){
      if(action==="auth-continue")await account.login();
      if(action==="auth-retry")await account.boot();
      if(action==="claim-progress" || action==="start-fresh")await account.chooseLegacy(action==="claim-progress");
      if(action==="auth-mode-login" || action==="auth-mode-signup"){
        account.signup=action==="auth-mode-signup";account.message="";render();
        app.querySelector("[data-act='auth-continue']")?.focus();
      }
      return;
    }
    if(action==="retry-sync"){await account.refresh(true);retryAfter=0;await tick();return;}
    if(state.active && !["pause","room-motion","end-session","confirm-end","close-dialog"].includes(action))return;
    switch(action){
      case "close-dialog":closeDialog();return;
      case "settings":openDialog(D.settings(state,account.who,screenAwake.status));return;
      case "mode":await change("mode",{mode:value});return;
      case "launch":await change("launch",{note:state.draft.note});return;
      case "pause":await change("pause",{paused:state.active?.endsAt!==null});return;
      case "room-motion":
        if(!reducedMotion.matches)await change("motion",{enabled:!state.settings.motion});
        return;
      case "inspect-landmark":{
        const [world,points]=value.split("/");
        const html=F.landmarkDetail(state,world,Number(points));
        if(html)openDialog(html);
        return;
      }
      case "open-star":{
        const record=state.sessions.find(r=>r.id===value);
        if(!state.active && record)openDialog(F.starDetails(record));
        return;
      }
      case "open-patch":
        if(!state.active && state.sessions.some(r=>r.flight?.patch && r.flight.day===value))openDialog(F.patchDetails(state,value));
        return;
      case "view-result-star":{
        const record=state.sessions.find(r=>r.id===state.result?.id);
        if(record){
          ui.atlasWorld=E.worldId(record);ui.atlasSheet=F.sheetFor(state,record);
          pointTo("atlas");await change("back");
        }
        if(record)openDialog(F.starDetails(record));
        return;
      }
      case "end-session":{
        if(!state.active)return;
        const focus=state.active.mode==="focus";
        openDialog(D.confirm(focus?"End this session?":"End this break?",focus?"Only completed focus sessions earn credits. Your session setup will be ready if you want to start again.":"Return to your focus station now.", "confirm-end",focus?"End session":"End break",state.active.id,"Keep timer"));return;
      }
      case "confirm-end":
        closeDialog();if(state.active?.id===value){pointTo("station");await change("end");}return;
      case "back-station":if(state.result){pointTo("station");await change("back");}return;
      case "take-break":await change("break");return;
      case "choose-tag":await change("choose-tag",{id:value});return;
      case "new-tag":openDialog(D.tagEditor(state,null,value));return;
      case "manage-tags":openDialog(D.manageTags(state));return;
      case "edit-tag":{const t=state.tags.find(t=>t.id===value);if(t)openDialog(D.tagEditor(state,t,"manage"));return;}
      case "delete-tag":{
        const t=state.tags.find(t=>t.id===value);
        if(!t || t.id==="general")return;
        openDialog(D.confirm("Delete this tag?",`Tasks using “${t.name}” will move to ${V.tag(state,"general").name}. Past sessions keep their original tag.`,"confirm-delete-tag","Delete tag",value));return;
      }
      case "confirm-delete-tag":
        await change("delete-tag",{id:value});
        openDialog(D.manageTags(state));return;
      case "new-task":openDialog(D.taskEditor(state,null));return;
      case "edit-task":{const t=state.tasks.find(t=>t.id===value);if(t)openDialog(D.taskEditor(state,t));return;}
      case "quick-task":{
        const practice=value==="practice";ui.taskFilter="open";
        await change("task",{id:M.id(),name:practice?"Practice a problem set":"Review lecture notes",
          tagId:practice && state.tags.some(t=>t.id==="math")?"math":state.draft.tagId,target:1});
        announce("Task added.");return;
      }
      case "task-filter":ui.taskFilter=value==="done"?"done":"open";render();return;
      case "toggle-task":{
        const desired=!state.tasks.find(t=>t.id===value)?.done;
        await change("toggle-task",{id:value,done:desired});return;
      }
      case "link-task":
        pointTo("station");await change("link-task",{id:value});announce("Task linked to your next session.");return;
      case "unlink":await change("unlink");announce("Task unlinked.");return;
      case "delete-task":{
        const t=state.tasks.find(t=>t.id===value);if(t)openDialog(D.confirm("Delete this task?",`Remove “${t.name}” from your tasks? Completed sessions stay in your study log.`,"confirm-delete-task","Delete task",value));return;
      }
      case "confirm-delete-task":
        closeDialog();await change("delete-task",{id:value});announce("Task deleted.");return;
      case "edit-session":{const r=state.sessions.find(r=>r.id===value);if(r)openDialog(D.sessionEditor(state,r));return;}
      case "more-history":ui.logLimit+=20;render();return;
      case "shop-filter":ui.shopFilter=value;render();return;
      case "collection-filter":ui.collectionFilter=value;render();return;
      case "buy-item":{const p=M.item(value);if(p && !state.owned.includes(value))openDialog(D.purchase(state,p));return;}
      case "confirm-buy":{
        await change("buy",{id:value});closeDialog();announce(`${M.item(value).name} unlocked and equipped.`);return;
      }
      case "unequip-gear":await change("unequip");announce("Field gear unequipped.");return;
      case "equip":await change("equip",{id:value});announce(`${M.item(value).name} equipped.`);return;
      case "export":downloadBackup();return;
      case "import":dialog.querySelector("#import-file")?.click();return;
      case "confirm-restore":{
        if(!pendingRestore)return;
        const backup=pendingRestore;pendingRestore=null;closeDialog();
        ui.logTag="";ui.taskFilter="open";ui.logLimit=20;ui.atlasWorld=null;ui.atlasSheet=null;
        pointTo("station");await change("restore",{backup});announce("Backup restored.");return;
      }
    }
  }
  document.addEventListener("click",event=>{
    if(!dialog.open && screenAwake.status==="paused")screenAwake.retry();
    const el=event.target.closest("[data-act]");
    if(el && !el.disabled){
      if(el.hasAttribute("aria-busy"))return;
      el.setAttribute("aria-busy","true");
      act(el.dataset.act,el.dataset.value||"").catch(error=>formError(error.message)).finally(()=>el.removeAttribute("aria-busy"));
      return;
    }
    if(event.target.closest(".skip-link")){event.preventDefault();app.querySelector("main")?.focus();return;}
    if(event.target===dialog){
      const b=dialog.getBoundingClientRect();if(event.clientX<b.left || event.clientX>b.right || event.clientY<b.top || event.clientY>b.bottom)closeDialog();
    }
  });
  dialog.addEventListener("close",()=>{
    pendingRestore=null;
    if(!focusOrigin || dialog.open)return;
    const origin=[...app.querySelectorAll("[data-act]")].find(el=>el.dataset.act===focusOrigin.act && el.dataset.value===focusOrigin.value);
    if(origin)origin.focus({preventScroll:true});
  });
  document.addEventListener("input",event=>{
    if(event.target.id==="session-note")account.note(event.target.value);
  });
  document.addEventListener("change",async event=>{
    if(account.phase!=="ready")return;
    const owner=account.who;
    if(event.target.id==="atlas-world"){ui.atlasWorld=event.target.value;ui.atlasSheet=null;render();return;}
    if(event.target.id==="atlas-sheet"){ui.atlasSheet=Number(event.target.value);render();return;}
    if(event.target.id==="log-filter"){ui.logTag=event.target.value;ui.logLimit=20;render();return;}
    if(event.target.id!=="import-file")return;
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>16000000)throw Error("Choose an Orbit backup smaller than 16 MB.");
      let json;try{json=JSON.parse(await file.text());}catch{throw Error("Choose a valid Orbit Outpost JSON backup.");}
      if(account.phase!=="ready" || account.who!==owner)return;
      pendingRestore=M.validateBackup(json);
      openDialog(D.confirm("Restore this backup?",`Replace the progress in your account with ${pendingRestore.sessions.length} saved focus sessions and ${pendingRestore.credits} credits?`,"confirm-restore","Restore backup"));
    }catch(e){pendingRestore=null;formError(e.message);event.target.value="";}
  });
  async function saveForm(form){
    if(account.phase!=="ready" || state.active)return;
    const fields=new FormData(form), val=k=>String(fields.get(k)||""), name=val("name").trim();
    if(form.dataset.form==="settings"){
      const settings=Object.fromEntries(Object.keys(M.limits).map(k=>[k,Number(val(k))]));
      if(Object.entries(settings).some(([k,v])=>!Number.isInteger(v)||v<1||v>M.limits[k]))throw Error("Use a whole number within each field’s range.");
      if(!form.elements.keepAwake.disabled){
        settings.keepAwake=form.elements.keepAwake.checked;
        if(settings.keepAwake && screenAwake.status==="paused")screenAwake.retry();
      }
      await change("settings",{...settings,motion:val("motion")==="on"});
      closeDialog();
      announce(screenAwake.status==="paused"?awakePausedNotice:"Settings saved.");
      return;
    }
    if(form.dataset.form==="tag"){
      if(!name)throw Error("Give this subject a name.");
      const selectedColor=val("color"), tagId=val("id"), manage=val("back")==="manage";
      await change("tag",{id:tagId||M.id(),edit:!!tagId,name,color:Object.hasOwn(M.colors,selectedColor)?selectedColor:"sage",select:!manage});
      if(manage)openDialog(D.manageTags(state));else closeDialog();announce(tagId?"Tag updated.":"Subject tag created.");return;
    }
    if(form.dataset.form==="task"){
      if(!name)throw Error("Give this task a name.");
      const taskId=val("id"), target=Number(val("target"));
      if(!Number.isInteger(target)||target<1||target>30)throw Error("Choose a target from 1 to 30 sessions.");
      if(!taskId)ui.taskFilter="open";
      await change("task",{id:taskId||M.id(),edit:!!taskId,name,tagId:val("tagId"),target});
      closeDialog();announce(taskId?"Task updated.":"Task added.");return;
    }
    if(form.dataset.form==="session"){
      await change("edit-session",{id:val("id"),tagId:val("tagId"),note:val("note").slice(0,500).trim()});closeDialog();announce("Session updated.");
    }
  }
  dialog.addEventListener("submit",event=>{
    event.preventDefault();
    const form=event.target,submit=form.querySelector('[type="submit"]');
    if(!submit || submit.disabled)return;
    submit.disabled=true;
    saveForm(form).catch(error=>formError(error.message)).finally(()=>{submit.disabled=false;});
  });
  window.addEventListener("hashchange",()=>{if(dialog.open)closeDialog();render();window.scrollTo(0,0);});
  window.addEventListener("storage",event=>{
    if(event.key===account.signalKey && event.newValue){location.reload();return;}
  });
  function wake(){
    if(account.phase==="ready")account.refresh(true).then(tick);
    else if(account.phase==="sdk-error" || account.phase==="cloud-error")account.boot();
  }
  document.addEventListener("visibilitychange",()=>{syncScreenAwake();if(!document.hidden)wake();});
  window.addEventListener("online",wake);
  window.addEventListener("pageshow",event=>{
    pageShown=true;
    if(event.persisted)account.boot();else tick();
    syncScreenAwake();
  });
  window.addEventListener("pagehide",()=>{
    pageShown=false;syncScreenAwake();
    if(account.phase==="ready" && document.activeElement?.id==="session-note")account.commit(undefined,false).catch(()=>{});
  });
  reducedMotion.addEventListener("change",()=>{if(state.active)render();});
  account.boot();
  setInterval(tick,400);
  setInterval(()=>{if(!document.hidden)account.refresh().then(tick);},20000);
})();
