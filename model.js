(() => {
  "use strict";
  const key = "orbit-outpost.v1";
  const colors = {sage:"#a9e992", lilac:"#b29cf7", blue:"#88b9ff", peach:"#f4ad8b", aqua:"#74d9d3", rose:"#eda4c8", gold:"#e8c775"};
  const modes = {focus:"Focus", short:"Short break", long:"Long break"};
  const E = globalThis.OrbitExpedition;
  const {items,item,dayKey} = E;
  const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  const textField = (value, max) => typeof value === "string" && value.length <= max;
  const goodId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
  const colorOK = value => Object.hasOwn(colors,value);
  const limits = {focus:180, short:60, long:90, goal:24};
  function fresh() {
    return {
      version:2, credits:0, owned:["pip","lunar"], equipped:{companion:"pip",habitat:"lunar",gear:null},
      tags:[{id:"general",name:"General",color:"sage"},{id:"biology",name:"Biology",color:"lilac"},{id:"math",name:"Math",color:"blue"}],
      tasks:[], sessions:[], settings:{focus:25,short:5,long:15,goal:4,motion:true,keepAwake:false},
      draft:{mode:"focus",tagId:"general",note:"",taskId:null}, active:null,result:null
    };
  }
  function upgrade(value) {
    if(value?.version===1){
      const equipped={...value.equipped,gear:null};
      const active=value.active?{...value.active,loadout:E.loadout({equipped})}:null;
      value={...value,version:2,equipped,active,settings:{...value.settings,motion:true}};
    }
    if(value?.version===2 && value.settings && value.settings.keepAwake===undefined)
      return {...value,settings:{...value.settings,keepAwake:false}};
    return value;
  }
  function start(s, now = Date.now(), sessionId = id()) {
    if (s.active || s.result) return;
    const mode = s.draft.mode;
    const tag = s.tags.find(t => t.id === s.draft.tagId) || s.tags[0];
    const task = mode === "focus" && s.tasks.find(t => t.id === s.draft.taskId && !t.done);
    const minutes = s.settings[mode];
    s.active = {id:sessionId,mode,minutes,loadout:E.loadout(s),startedAt:now,endsAt:now+minutes*60000,remainingMs:minutes*60000,
      tagId:tag.id,tagName:tag.name,tagColor:tag.color,note:mode === "focus" ? s.draft.note.trim() : "",
      taskId:task?.id || null,taskName:task?.name || ""};
  }
  function left(a, now = Date.now()) {
    return Math.max(0, a.endsAt === null ? a.remainingMs : a.endsAt-now);
  }
  const focusCredits = minutes => Math.floor(minutes / 3);
  function settle(s, now = Date.now()) {
    const a = s.active;
    if (!a || a.endsAt === null || now < a.endsAt) return false;
    const earned = a.mode === "focus" ? focusCredits(a.minutes) : 0;
    const record = {id:a.id,mode:a.mode,minutes:a.minutes,endedAt:a.endsAt,tagId:a.tagId,tagName:a.tagName,
      tagColor:a.tagColor,note:a.note,taskId:a.taskId,taskName:a.taskName,earned};
    if (a.mode === "focus" && !s.sessions.some(session => session.id === a.id)) {
      E.chart(s,record,a.loadout||E.loadout(s));
      s.sessions.unshift(record);
      s.credits += E.totalCredits(record);
      const task = s.tasks.find(t => t.id === a.taskId);
      if (task) {
        task.count += 1;
        if (task.count >= task.target) task.done = true;
      }
      s.draft.note = "";
      if (task?.done) s.draft.taskId = null;
    }
    s.result = record;
    s.active = null;
    return true;
  }
  function togglePause(s, now = Date.now()) {
    if (settle(s,now) || !s.active) return;
    const a = s.active;
    if (a.endsAt === null) a.endsAt = now+a.remainingMs;
    else {
      a.remainingMs = left(a,now);
      a.endsAt = null;
    }
  }
  function buy(s, itemId) {
    const product = item(itemId);
    if (!product || s.owned.includes(itemId) || s.credits < product.price) return false;
    s.credits -= product.price;
    s.owned.push(itemId);
    return true;
  }
  function equip(s, itemId) {
    const product = item(itemId);
    if (product && s.owned.includes(itemId)) s.equipped[product.type] = itemId;
  }
  function streak(sessions, now = Date.now()) {
    const days = new Set(sessions.map(session => dayKey(session.endedAt)));
    const d = new Date(now);
    if (!days.has(dayKey(d))) d.setDate(d.getDate()-1);
    let count=0;
    while (days.has(dayKey(d))) {count++; d.setDate(d.getDate()-1);}
    return count;
  }
  function validateBackup(input) {
    const s=upgrade(input);
    const unique = list => new Set(list.map(x=>x.id)).size === list.length;
    if (!s || s.version !== 2 || !whole(s.credits,0,Number.MAX_SAFE_INTEGER) ||
      !Array.isArray(s.tags) || !Array.isArray(s.tasks) || !Array.isArray(s.sessions) || !Array.isArray(s.owned) ||
      !s.settings || !s.equipped || !s.draft) throw Error("Choose a valid Orbit Outpost backup.");
    if (!Object.entries(limits).every(([k,max])=>whole(s.settings[k],1,max)) || typeof s.settings.motion!=="boolean" || typeof s.settings.keepAwake!=="boolean" ||
      !(s.equipped.gear===null || (s.owned.includes(s.equipped.gear) && item(s.equipped.gear)?.type==="gear")) ||
      !s.owned.every(value=>!!item(value)) || !["pip","lunar"].every(value=>s.owned.includes(value)) ||
      !["habitat","companion"].every(type=>s.owned.includes(s.equipped[type]) && item(s.equipped[type])?.type === type))
      throw Error("The settings or collection in this backup are invalid.");
    if (!s.tags.every(t=>t && goodId(t.id) && textField(t.name,32) && t.name.trim() && colorOK(t.color)) ||
      !unique(s.tags) || !s.tags.some(t=>t.id==="general")) throw Error("The subject tags in this backup are invalid.");
    const hasTag = tagId => s.tags.some(t=>t.id===tagId);
    if (!s.tasks.every(t=>t && goodId(t.id) && textField(t.name,120) && t.name.trim() && hasTag(t.tagId) &&
      whole(t.target,1,30) && whole(t.count,0,Number.MAX_SAFE_INTEGER) && typeof t.done==="boolean") ||
      !unique(s.tasks)) throw Error("The tasks in this backup are invalid.");
    if (!s.sessions.every(r=>r && goodId(r.id) && r.mode==="focus" && whole(r.minutes,1,180) &&
      (r.earned===focusCredits(r.minutes) || r.earned===r.minutes) && // Previously, each minute earned one credit.
      whole(r.endedAt,0,8640000000000000) && goodId(r.tagId) && textField(r.tagName,32) && colorOK(r.tagColor) &&
      textField(r.note,500) && textField(r.taskName,120) && E.validFlight(r.flight,r.minutes)) || !unique(s.sessions))
      throw Error("The study log in this backup is invalid.");
    if (!Object.hasOwn(modes,s.draft.mode) || !hasTag(s.draft.tagId) || !textField(s.draft.note,500) ||
      !(s.draft.taskId===null || s.tasks.some(t=>t.id===s.draft.taskId))) throw Error("The session setup in this backup is invalid.");
    const backup={...s,active:null,result:null};
    delete backup.syncCursors;
    return backup;
  }
  function validateLive(input){
    const raw=upgrade(input);
    const s=validateBackup(raw);
    if(raw.syncCursors!==undefined){
      const cursors=raw.syncCursors;
      if(!cursors || typeof cursors!=="object" || Array.isArray(cursors) ||
        !Object.entries(cursors).every(([key,value])=>goodId(key) && !Object.hasOwn(Object.prototype,key) && whole(value,1,Number.MAX_SAFE_INTEGER)))
        throw Error("The cloud save’s synchronization history could not be verified.");
      s.syncCursors=cursors;
    }
    const a=raw.active, r=raw.result;
    const stamp=n=>whole(n,0,8640000000000000);
    const fieldsOK=x=>goodId(x.id) && Object.hasOwn(modes,x.mode) && whole(x.minutes,1,limits[x.mode]) &&
      goodId(x.tagId) && textField(x.tagName,32) && colorOK(x.tagColor) && textField(x.note,500) &&
      (x.taskId===null || goodId(x.taskId)) && textField(x.taskName,120);
    if(a!=null){
      if(r!=null || !fieldsOK(a) || !stamp(a.startedAt) || !(a.endsAt===null || stamp(a.endsAt)) ||
        !whole(a.remainingMs,0,a.minutes*60000) || !a.loadout ||
        !["habitat","companion"].every(type=>item(a.loadout[type])?.type===type && s.owned.includes(a.loadout[type])) ||
        !(a.loadout.gear===null || (item(a.loadout.gear)?.type==="gear" && s.owned.includes(a.loadout.gear))))
        throw Error("The saved timer could not be verified.");
      s.active=a;
    }
    if(r!=null){
      if(!fieldsOK(r) || !stamp(r.endedAt))throw Error("The last session result could not be verified.");
      if(r.mode==="focus"){
        s.result=s.sessions.find(session=>session.id===r.id);
        if(!s.result)throw Error("The completed session is missing from the study log.");
      }else{
        if(r.earned!==0)throw Error("The saved break result could not be verified.");
        s.result=r;
      }
    }
    return s;
  }
  globalThis.OrbitModel = {key, colors, modes, items, item, id, limits, fresh, upgrade, dayKey, start, left, focusCredits, settle, togglePause, buy, equip, streak, validateBackup, validateLive};
})();
