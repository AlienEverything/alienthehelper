(function orbitViews(){
  "use strict";
  const M = globalThis.OrbitModel, E = globalThis.OrbitExpedition;
  const icon = globalThis.orbitIcon;
  const coin = globalThis.orbitCoin;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num = v => new Intl.NumberFormat().format(v);
  const titles = {station:"Focus station",tasks:"Tasks",log:"Study log",challenges:"Challenges",atlas:"Star atlas",shop:"Shop",collection:"Collection"};
  const art = product => "./assets/"+product.image;
  const tag = (s,id) => s.tags.find(t=>t.id===id) || s.tags[0];
  const time = minutes => minutes < 60 ? `${minutes}m` : `${Math.floor(minutes/60)}h${minutes%60 ? " "+minutes%60+"m" : ""}`;
  const clock = ms => {const n=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;};
  const date = (ts,opts) => new Intl.DateTimeFormat(undefined,opts).format(new Date(ts));
  const dayRows = s => s.sessions.filter(r=>M.dayKey(r.endedAt)===M.dayKey());
  const brand = () => `<span class="brand"><img src="./assets/orbit.svg" alt="" width="37" height="33"><span class="brand-words"><strong>Orbit</strong><span>OUTPOST</span></span></span>`;
  const miniTag = t => `<span class="mini-tag" style="--tag-color:${M.colors[t.color]}"><i></i>${escape(t.name)}</span>`;
  const sectionHead = (title,ico,color,action="") => `<div class="panel-head"><div class="panel-title"><span class="panel-symbol ${color}">${icon(ico,19)}</span><h2>${title}</h2></div>${action}</div>`;
  const smallButton = (action,label,ico,value="") => `<button type="button" class="icon-btn" data-act="${action}" data-value="${escape(value)}" aria-label="${escape(label)}" title="${escape(label)}">${icon(ico,17)}</button>`;
  const textBtn = (act,label,ico,value="") => `<button type="button" class="text-btn" data-act="${act}" data-value="${escape(value)}">${ico?icon(ico,16):""}${escape(label)}</button>`;
  const options = (s, selected) => s.tags.map(t=>`<option value="${escape(t.id)}"${t.id===selected?" selected":""}>${escape(t.name)}</option>`).join("");
  const empty = (ico,title,description) => `<div class="empty"><span class="empty-symbol">${icon(ico,27)}</span><h3>${escape(title)}</h3><p>${escape(description)}</p></div>`;
  function nav(key, current, mobile=false) {
    const mobilePage=current==="log"?"atlas":current==="collection"?"shop":current;
    const active=key===(mobile?mobilePage:current);
    const labels={station:"Focus",tasks:"Tasks",atlas:"Atlas",challenges:"Challenges",shop:"Shop"};
    return `<a href="#${key}" class="nav-link${active?" active":""}" ${active?'aria-current="page"':""}>${icon(key,20)}<span>${mobile?labels[key]:titles[key]}</span></a>`;
  }
  function sidebar(s,page) {
    const count=dayRows(s).length, goal=s.settings.goal;
    const pips=Array.from({length:Math.min(goal,8)},(_,i)=>`<i class="${i<Math.floor(Math.min(count/goal,1)*Math.min(goal,8))?"filled":""}"></i>`).join("");
    return `<aside class="sidebar"><a class="brand-link" href="#station" aria-label="Orbit Outpost home">${brand()}</a>
      <nav class="side-nav" aria-label="Main navigation"><div class="nav-group"><p>Workspace</p>${["station","tasks","log"].map(k=>nav(k,page)).join("")}</div>
      <div class="nav-group"><p>Outpost</p>${["challenges","atlas","shop","collection"].map(k=>nav(k,page)).join("")}</div></nav>
      <div class="side-bottom"><button class="goal" data-act="settings" aria-label="Daily goal, ${count} of ${goal} focus sessions. Edit goal"><span class="goal-top"><span>${icon("target",16)} Daily goal</span><b>${count}<small> / ${goal}</small></b></span><span class="goal-pips" aria-hidden="true">${pips}</span><span class="goal-caption">Focus sessions today</span></button>
      <button class="settings-link" data-act="settings">${icon("settings",19)}Settings</button></div></aside>`;
  }
  function header(s,page) {
    const buddy=M.item(s.equipped.companion);
    return `<header class="page-head"><div class="head-titles"><p class="dateline">${icon("calendar",14)}${escape(date(Date.now(),{weekday:"long",month:"long",day:"numeric"}))}</p><h1>${titles[page]}</h1></div>
      <div class="head-tools"><a class="wallet" href="#shop" aria-label="Shop, balance ${num(s.credits)} credits">${coin}<b>${num(s.credits)}</b><span>credits</span></a>
      <button class="avatar" data-act="settings" title="Settings" aria-label="Open settings"><img src="${art(buddy)}" alt=""></button></div></header>`;
  }
  function hero(s) {
    const habitat=M.item(s.equipped.habitat), buddy=M.item(s.equipped.companion), mode=s.draft.mode;
    const modes=Object.entries(M.modes).map(([k,label])=>`<button class="${mode===k?"selected":""}" aria-pressed="${mode===k}" data-act="mode" data-value="${k}">${escape(label)}</button>`).join("");
    return `<section class="timer-hero" aria-label="Session timer" data-habitat="${habitat.id}">
      <img class="terrain" src="${art(habitat)}" alt="" fetchpriority="high"><div class="scene-shade"></div>
      ${OrbitFlightViews.landmark(E.survey(s,habitat.id).stage,"station-landmark")}<div class="hero-actor"><span></span><img src="${art(buddy)}" alt="${escape(buddy.name)}, your alien companion"></div>
      <div class="hero-controls"><div class="mode-pick" role="group" aria-label="Timer mode">${modes}</div>
      <div class="hero-time" aria-label="${s.settings[mode]} minutes">${clock(s.settings[mode]*60000)}</div>
      <p class="hero-caption">${mode==="focus"?`${coin}<span><strong>${s.settings.focus} base credits</strong> on completion</span>`:`${icon("cup",17)}<span>Time to recharge</span>`}</p>
      <div class="hero-actions"><button type="button" class="primary" data-act="launch">${icon("play",17)}${mode==="focus"?"Start focus":"Start break"}</button>
      <button type="button" class="timer-adjust" data-act="settings" aria-label="Timer settings" title="Timer settings">${icon("sliders",19)}</button></div></div>
      <a href="#collection" class="location" aria-label="Change habitat, currently ${habitat.name}">${icon("pin",13)}${habitat.name}</a></section>`;
  }
  function setup(s) {
    const linked=s.tasks.find(t=>t.id===s.draft.taskId && !t.done);
    const chips=s.tags.map(t=>`<button class="tag-chip ${t.id===s.draft.tagId?"chosen":""}" type="button" aria-pressed="${t.id===s.draft.tagId}" style="--tag-color:${M.colors[t.color]}" data-act="choose-tag" data-value="${escape(t.id)}"><i></i>${escape(t.name)}</button>`).join("");
    return `<section class="panel setup">${sectionHead("Session setup","sliders","lilac")}<div class="panel-body">
      <div class="field-label" id="subject-label">Subject tag</div><div class="tag-row" role="group" aria-labelledby="subject-label">${chips}<button class="tag-add" data-act="new-tag" title="Create a subject tag" aria-label="Create a subject tag">${icon("plus",15)}</button></div>
      <label class="field-label note-label" for="session-note">Session note <span>Optional</span></label><textarea id="session-note" maxlength="500" rows="2" placeholder="What are you working on?">${escape(s.draft.note)}</textarea>
      ${linked?`<div class="linked-task">${icon("link",14)}<span>${escape(linked.name)}</span>${smallButton("unlink","Unlink task","close")}</div>`:""}</div></section>`;
  }
  function taskRow(s,t,compact=false) {
    const linked=s.draft.taskId===t.id && !t.done;
    return `<div class="task-row ${t.done?"completed":""} ${linked?"is-linked":""}"><button type="button" role="checkbox" aria-checked="${t.done}" aria-label="${escape(t.done?"Reopen ":"Complete ")+escape(t.name)}" class="task-check" data-act="toggle-task" data-value="${escape(t.id)}">${t.done?icon("check",13):""}</button>
      <div class="task-info"><button class="task-name" data-act="edit-task" data-value="${escape(t.id)}">${escape(t.name)}</button><div class="task-meta">${miniTag(tag(s,t.tagId))}<span class="task-count">${icon("station",13)}${t.count} / ${t.target}</span>${linked?'<span class="linked-flag">Linked</span>':""}</div></div>
      ${t.done?"":smallButton(linked?"unlink":"link-task",linked?"Unlink task":`Link ${t.name} to a session`,"link",t.id)}${compact?"":smallButton("edit-task",`Edit ${t.name}`,"edit",t.id)}</div>`;
  }
  function suggestions() {
    return `<p class="queue-hint">Add a task of your own or start with one below.</p><div class="suggestions">
      <button data-act="quick-task" data-value="review"><span class="suggest-icon blue">${icon("book",17)}</span><span>Review lecture notes</span>${icon("plus",15)}</button>
      <button data-act="quick-task" data-value="practice"><span class="suggest-icon lilac">${icon("layers",17)}</span><span>Practice a problem set</span>${icon("plus",15)}</button></div>`;
  }
  function queue(s) {
    const tasks=s.tasks.filter(t=>!t.done).sort((a,b)=>Number(b.id===s.draft.taskId)-Number(a.id===s.draft.taskId));
    return `<section class="panel queue">${sectionHead("Task queue","tasks","blue",textBtn("new-task","Add task","plus"))}<div class="panel-body">
      ${tasks.length?`<div class="task-list">${tasks.slice(0,3).map(t=>taskRow(s,t,true)).join("")}</div>${tasks.length>3?`<a class="inline-link" href="#tasks">View all ${tasks.length} open tasks</a>`:""}`:suggestions()}</div></section>`;
  }
  function stats(s) {
    const today=dayRows(s), streak=M.streak(s.sessions);
    const data=[["clock","blue","Focus today",time(today.reduce((n,t)=>n+t.minutes,0))],["station","sage","Sessions today",num(today.length)],["fire","peach","Study streak",`${streak} ${streak===1?"day":"days"}`]];
    return `<section class="stats" aria-label="Study activity">${data.map(([ico,col,label,val])=>`<div class="stat"><span class="stat-symbol ${col}">${icon(ico,20)}</span><div><span>${label}</span><strong>${val}</strong></div></div>`).join("")}</section>`;
  }
  function station(s) { return `${hero(s)}<div class="station-grid">${setup(s)}${queue(s)}</div>${stats(s)}${OrbitFlightViews.stationLinks(s)}`;}
  function tasksPage(s,ui) {
    const open=s.tasks.filter(t=>!t.done), complete=s.tasks.filter(t=>t.done), list=ui.taskFilter==="done"?complete:open;
    return `<section class="panel full-panel"><div class="content-head"><div class="filter-pills" role="group" aria-label="Task status"><button data-act="task-filter" data-value="open" aria-pressed="${ui.taskFilter==="open"}">Open <span>${open.length}</span></button><button data-act="task-filter" data-value="done" aria-pressed="${ui.taskFilter==="done"}">Completed <span>${complete.length}</span></button></div><button class="primary small" data-act="new-task">${icon("plus",16)}Add task</button></div>
      ${list.length?`<div class="full-task-list">${list.map(t=>taskRow(s,t)).join("")}</div>`:ui.taskFilter==="open"?`<div class="empty-queue">${suggestions()}</div>`:empty("tasks","No completed tasks yet","Finished tasks will appear here.")}</section>`;
  }
  function weekChart(s) {
    const days=Array.from({length:7},(_,index)=>{const d=new Date();d.setDate(d.getDate()-6+index);return {key:M.dayKey(d),date:d,total:0};});
    const byDay=new Map(days.map(d=>[d.key,d]));
    for (const r of s.sessions) {const d=byDay.get(M.dayKey(r.endedAt));if(d)d.total+=r.minutes;}
    const max=Math.max(1,...days.map(d=>d.total));
    return `<section class="panel chart-panel">${sectionHead("This week","log","sage")}<div class="chart-summary"><strong>${time(days.reduce((n,d)=>n+d.total,0))}</strong><span>focused in the last 7 days</span></div><div class="chart" aria-label="Minutes focused on each of the past seven days">${days.map((d,i)=>`<div class="chart-col" title="${escape(date(d.date,{weekday:"long",month:"short",day:"numeric"}))}: ${d.total} minutes"><span>${d.total?time(d.total):"0"}</span><div class="bar-track"><i style="height:${d.total?Math.max(3,d.total/max*100):0}%"></i></div><b>${i===6?"Today":escape(date(d.date,{weekday:"short"}))}</b></div>`).join("")}</div></section>`;
  }
  function logPage(s,ui) {
    const known=new Map(s.tags.map(t=>[t.id,t.name]));for(const r of s.sessions)if(!known.has(r.tagId))known.set(r.tagId,r.tagName);
    const records=s.sessions.filter(r=>!ui.logTag || r.tagId===ui.logTag).slice().sort((a,b)=>b.endedAt-a.endedAt);
    const subjectOptions=[...known].map(([id,name])=>`<option value="${escape(id)}"${ui.logTag===id?" selected":""}>${escape(name)}</option>`).join("");
    const limit=ui.logLimit;
    return `${weekChart(s)}<section class="panel history">${sectionHead("Session history","book","lilac",`<select aria-label="Filter history by subject" id="log-filter"><option value="">All subjects</option>${subjectOptions}</select>`)}
      ${records.length?`<div class="history-rows">${records.slice(0,limit).map(r=>`<div class="history-row"><span class="history-symbol">${icon("station",19)}</span><div class="history-info"><div class="history-line"><strong>${r.minutes} min</strong>${miniTag({name:r.tagName,color:r.tagColor})}</div>
      <p>${escape(date(r.endedAt,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}))}</p>${r.taskName?`<div class="log-task">${icon("link",13)}${escape(r.taskName)}</div>`:""}${r.note?`<div class="history-note">${escape(r.note)}</div>`:""}</div><span class="history-earned">${coin}+${E.totalCredits(r)}</span>${smallButton("edit-session","Edit session tag and note","edit",r.id)}</div>`).join("")}</div>${records.length>limit?textBtn("more-history","Show more sessions","plus"):""}`:empty("book",s.sessions.length?"No sessions for this subject":"Your study log starts here",s.sessions.length?"Choose another subject to see its sessions.":"Completed focus sessions appear here with their tags, notes, and credits.")}</section>`;
  }
  function catalogPage(s,ui,ownedOnly) {
    const filter=ownedOnly?ui.collectionFilter:ui.shopFilter;
    const available=M.items.filter(p=>!ownedOnly || s.owned.includes(p.id));
    const filters=[["all","All"],...Object.entries(E.categoryNames)];
    const groups=Object.entries(E.categoryNames).filter(([type])=>filter==="all" || filter===type).map(([type,label])=>{
      const products=available.filter(p=>p.type===type);
      if(!products.length)return filter==="all"?"":empty("gear","Your gear slot is empty","Visit the shop to choose field gear for your sessions.");
      return `<section class="catalog-group"><h2>${label}</h2><div class="product-grid">${products.map(p=>productCard(s,p)).join("")}</div></section>`;
    }).join("");
    return `<div class="catalog-intro"><p>${ownedOnly?"Equip a companion, a habitat, and one field instrument.":"Equip a study companion, explore new habitats, and outfit your next session."}</p>
      <a class="secondary small" href="#${ownedOnly?"shop":"collection"}">${icon(ownedOnly?"shop":"collection",16)}${ownedOnly?"Visit shop":"My collection"}</a></div>
      <div class="filter-pills catalog-filters" role="group" aria-label="Item type">${filters.map(([k,label])=>`<button data-act="${ownedOnly?"collection-filter":"shop-filter"}" data-value="${k}" aria-pressed="${filter===k}">${label}</button>`).join("")}</div>${groups}`;
  }
  function productCard(s,p) {
    const owned=s.owned.includes(p.id), equipped=s.equipped[p.type]===p.id, afford=s.credits>=p.price;
    let control;
    if(equipped)control=`<span class="equipped">${icon("check",15)}Equipped</span>${owned && p.type==="gear"?'<button class="text-btn unequip" data-act="unequip-gear">Unequip</button>':""}`;
    else if(owned)control=`<button class="secondary small" data-act="equip" data-value="${p.id}">Equip</button>`;
    else control=`<button class="buy-btn ${afford?"can-buy":""}" data-act="buy-item" data-value="${p.id}" aria-label="View ${p.name}, ${p.price} credits">${coin}${p.price} credits</button>`;
    return `<article class="product"><div class="product-art ${p.type} ${p.color}" data-product="${p.id}"><img src="${art(p)}" alt="${escape(p.name)}"></div><div class="product-info"><h3>${p.name}</h3><p>${p.detail}</p><div class="product-perk">${icon(p.type==="habitat"?"atlas":"spark",14)}<span>${escape(E.perk(p))}</span></div>${control}</div></article>`;
  }
  function frame(s,page,ui) {
    const content=page==="station"?station(s):page==="tasks"?tasksPage(s,ui):page==="log"?logPage(s,ui):page==="challenges"?OrbitFlightViews.challenges(s):page==="atlas"?OrbitFlightViews.atlas(s,ui):catalogPage(s,ui,page==="collection");
    return `<div class="shell">${sidebar(s,page)}<main id="main-content" tabindex="-1" class="workspace"><div class="workspace-inner">${header(s,page)}${content}</div></main><nav class="mobile-nav" aria-label="Mobile navigation">${["station","tasks","atlas","challenges","shop"].map(k=>nav(k,page,true)).join("")}</nav></div>`;
  }
  globalThis.OrbitViews={escape,icon,coin,titles,art,tag,time,clock,date,miniTag,options,smallButton,textBtn,sectionHead,brand,frame};
})();
