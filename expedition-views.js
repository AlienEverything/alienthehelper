(function expeditionViews(){
  "use strict";
  const E=OrbitExpedition, M=OrbitModel;
  const {escape:esc,icon,coin,art,clock,date,miniTag,sectionHead,brand,time}=OrbitViews;
  const textDate=key=>date(new Date(key+"T12:00:00"),{month:"short",day:"numeric",year:"numeric"});
  const plural=(n,one,many=one+"s")=>`${n} ${n===1?one:many}`;
  const img=(file,cls="",alt="")=>`<img class="${cls}" src="./assets/${file}" alt="${esc(alt)}">`;
  const credit=(n,label="")=>`<span class="credit-amount">${coin}${n}${label?" "+label:""}</span>`;
  const meter=(value,max,label)=>`<div class="exp-meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(max,value)}"><i style="width:${Math.min(100,value/max*100)}%"></i></div>`;
  function landmark(stage,cls){
    return stage.image?img(stage.image,stage.tier?`${cls} landmark-tier-${stage.tier}`:cls,stage.name):"";
  }
  function stationLinks(s){
    const board=E.daily(s);
    return `<div class="exp-links"><a href="#challenges">${icon("challenges",18)}<b>Daily challenges</b><span>${board.completed} / 3</span></a>
      <a href="#atlas">${icon("atlas",19)}<b>Star atlas</b><span>${plural(s.sessions.length,"star")}</span></a></div>`;
  }
  function claimButton(day,id,label){
    return `<button type="button" class="primary reward-claim" data-act="claim-reward" data-value="${esc(day)}/${esc(id)}">${coin}${esc(label)}</button>`;
  }
  function challengeCard(card,index,day){
    const colors=["aqua","lilac","peach"];
    return `<article data-reward="${esc(day)}/${esc(card.id)}" class="mission-card ${colors[index]} ${card.paid?"mission-paid":card.ready?"mission-ready":""}"><div class="mission-card-top"><span class="mission-icon">${icon(card.icon,22)}</span>${credit(card.reward,"credits")}</div>
      <h2>${esc(card.name)}</h2><p>${esc(card.description)}</p><div class="mission-progress"><div><span>${card.paid?`${icon("check",14)}Reward claimed`:card.ready?"Ready to claim":"Progress"}</span><b>${card.progress} / ${card.target} ${card.unit}</b></div>
      ${meter(card.progress,card.target,card.name)}${card.ready?claimButton(day,card.id,`Claim ${card.reward} credits`):""}</div></article>`;
  }
  function patchDays(s){
    return [...new Set(s.sessions.filter(r=>r.flight?.patch).map(r=>r.flight.day))].sort().reverse();
  }
  function challenges(s){
    const board=E.daily(s), days=patchDays(s), earlier=E.earlierRewards(s,board.day);
    return `<section class="mission-banner ${board.patch?"awarded":""}"><div class="mission-copy"><span class="exp-eyebrow">${icon("calendar",14)}Daily set bonus</span>
      <h2>Flight patch</h2><p>Claim all three challenge rewards to unlock today’s patch and <strong>${E.patchCredits} extra credits</strong>.</p>
      <div class="mission-bonus-progress"><span class="mission-slots" aria-hidden="true">${board.cards.map(c=>`<i class="${c.paid?"filled":""}"></i>`).join("")}</span><b>${board.patch?"Patch claimed":`${board.cards.filter(c=>c.paid).length} of 3 claimed`}</b></div>${board.pendingPatch && board.cards.every(c=>c.paid)?claimButton(board.day,"patch",`Claim patch + ${E.patchCredits} credits`):""}</div>
      <div class="patch-emblem" data-reward="${esc(board.day)}/patch" aria-hidden="true"><i></i><i></i>${img("mission-patch.png")}</div></section>
      <div class="exp-section-head"><h2>Today’s challenges</h2><span>${icon("clock",14)}Resets at local midnight</span></div><div class="missions">${board.cards.map((c,i)=>challengeCard(c,i,board.day)).join("")}</div>
      ${earlier.length?`<section class="panel unclaimed-rewards"><h2>Unclaimed rewards</h2>${earlier.map(b=>`<div class="earlier-day"><h3>${esc(textDate(b.day))}</h3>${b.cards.filter(c=>c.ready).map(c=>`<div><span>${esc(c.name)}</span>${claimButton(b.day,c.id,`Claim ${c.reward} credits`)}</div>`).join("")}${b.pendingPatch && b.cards.every(c=>c.paid)?`<div><span>Daily flight patch</span>${claimButton(b.day,"patch",`Claim patch + ${E.patchCredits} credits`)}</div>`:""}</div>`).join("")}</section>`:""}
      ${days.length?`<section class="panel patch-shelf">${sectionHead("Patch log","challenges","peach")}<div class="patch-history">${days.slice(0,7).map(key=>`<button data-act="open-patch" data-value="${key}">${img("mission-patch.png")}<span>${esc(textDate(key))}</span></button>`).join("")}</div>${days.length>7?`<p class="field-help">Showing the latest seven of ${days.length} earned patches. Earlier patches are attached to their stars in the atlas.</p>`:""}</section>`:""}`;
  }

  const plotPoints=[[39,49],[55,30],[68,42],[84,26],[78,53],[89,67],[72,74],[59,59],[47,72],[29,69],[13,53],[25,34]];
  function plotPoint(index,world,page){
    const [x,y]=plotPoints[index];
    const flipX=(world==="reef" || world==="ember")!==Boolean(page%2);
    const flipY=world==="aurora" || world==="grotto";
    return [flipX?100-x:x,flipY?94-y:y];
  }
  function starPlot(records,world,page){
    if(!records.length){
      return `<div class="atlas-empty"><div class="first-star">${icon("spark",30)}</div><strong>Your first star goes here</strong><p>Finish a focus session in ${esc(world.name)} to chart it.</p></div>`;
    }
    const points=records.map((_,i)=>plotPoint(i,world.id,page));
    const lines=points.map(p=>p.join(",")).join(" ");
    const nodes=records.map((r,i)=>{
      const [x,y]=points[i], number=page*plotPoints.length+i+1;
      return `<button class="atlas-star ${r.flight?.patch?"patch-star":""}" style="--x:${x}%;--y:${y}%;--star:${M.colors[r.tagColor]};--size:${Math.min(23,12+Math.floor(r.minutes/8))}px" data-act="open-star" data-value="${esc(r.id)}" aria-label="Star ${number}, ${esc(r.tagName)}, ${r.minutes} minutes"><i></i><small>${String(number).padStart(2,"0")}</small></button>`;
    }).join("");
    return `<div class="star-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${lines}" vector-effect="non-scaling-stroke"/></svg>${nodes}</div>`;
  }
  function progressPanel(region,survey){
    if(region.id===E.archive.id){
      return `<section class="panel archive-info">${sectionHead("Earlier sessions","book","blue")}<p>These sessions were recorded before habitat tracking. Each star opens its original study details.</p></section>`;
    }
    const {stage,next,points,stages}=survey;
    const preview=stage.image||stages[1].image;
    const milestones=stages.slice(1).map(t=>{
      const reached=points>=t.at,current=t===stage;
      return `<li><button type="button" data-act="inspect-landmark" data-value="${region.id}/${t.at}" aria-label="View ${esc(t.name)}, ${t.at} survey points, ${current?"current":reached?"unlocked":"locked"}" class="landmark-card ${reached?"reached":"locked"}" ${current?'aria-current="step"':""}>
        <span class="landmark-plate">${img(t.image)}</span><strong>${esc(t.name)}</strong>
        <small>${icon(reached?"check":"flag",13)}${t.at} pts<span class="sr-only"> · ${current?"Current":reached?"Unlocked":"Locked"}</span></small></button></li>`;
    }).join("");
    return `<section class="panel outpost-progress ${region.color}"><div class="outpost-summary"><div class="structure-tile ${region.color}">${img(preview,stage.image?"":"blueprint",stage.image?stage.name:"Landing beacon blueprint")}</div>
      <div><span class="exp-eyebrow">Outpost progress</span><h2>${stage.name}</h2><p>${next?`${plural(next.at-points,"survey point")} until ${next.name}.`:`${plural(points,"survey point")} recorded here.`}</p></div></div>
      <div class="stage-progress"><div class="survey-readout"><span>Survey points</span><b>${points}</b></div>${meter(points,stages.at(-1).at,"Outpost survey progress")}</div>
      <ol class="milestones" aria-label="${esc(region.name)} landmarks">${milestones}</ol>
      <p class="survey-tip">${icon("gear",15)}Completed focus sessions earn 1 survey point per 10 minutes, or per 8 minutes with Fenn. Gear can add more.</p></section>`;
  }
  function landmarkDetail(s,worldId,threshold){
    const region=M.item(worldId);
    if(region?.type!=="habitat" || !s.owned.includes(worldId))return "";
    const area=E.survey(s,worldId),stage=area.stages.find(t=>t.at===threshold && t.image);
    if(!stage)return "";
    const status=area.points>=threshold?"Unlocked":`${plural(threshold-area.points,"survey point")} to unlock`;
    return `${detailHead(stage.name)}<div class="dialog-body landmark-detail ${region.color}">
      <div class="landmark-window"><img class="landmark-backdrop" src="${art(region)}" alt="">${landmark(stage,"landmark-portrait")}</div>
      <div class="landmark-facts"><strong>${esc(region.name)}</strong><span>${threshold} survey points</span></div><p>${status}</p>
      </div><div class="dialog-actions"><button class="primary" data-act="close-dialog">Done</button></div>`;
  }
  function atlas(s,ui){
    const worlds=M.items.filter(p=>p.type==="habitat" && s.owned.includes(p.id));
    if(s.sessions.some(r=>!r.flight))worlds.push(E.archive);
    const current=s.equipped.habitat;
    const lastRecord=s.sessions.reduce((last,r)=>!last || r.endedAt>last.endedAt?r:last,null);
    const defaultId=s.sessions.some(r=>E.worldId(r)===current) || !lastRecord?current:E.worldId(lastRecord);
    const region=worlds.find(p=>p.id===ui.atlasWorld)||worlds.find(p=>p.id===defaultId)||worlds[0];
    const area=E.survey(s,region.id), count=area.records.length;
    const pages=Math.max(1,Math.ceil(count/plotPoints.length));
    const page=Math.max(0,Math.min(pages-1,ui.atlasSheet??pages-1));
    const subset=area.records.slice(page*plotPoints.length,(page+1)*plotPoints.length);
    const sheets=Array.from({length:pages},(_,i)=>`<option value="${i}"${i===page?" selected":""}>Chart ${i+1} of ${pages}</option>`).join("");
    return `<div class="atlas-toolbar"><p>Every completed focus session leaves a star. Select one to revisit it.</p><a class="secondary small" href="#log">${icon("log",15)}Study log</a></div>
      <section class="atlas-frame"><div class="atlas-head"><div class="atlas-world"><span>${icon("planet",17)}Habitat</span><select id="atlas-world" aria-label="Atlas habitat">${worlds.map(w=>`<option value="${w.id}"${region.id===w.id?" selected":""}>${esc(w.name)}</option>`).join("")}</select></div>
      <span class="chart-count">${icon("spark",15)}${plural(count,"star")}</span></div>
      <div class="atlas-sky ${region.color}"><img class="atlas-terrain" src="${art(region)}" alt=""><div class="atlas-gridlines"></div>${starPlot(subset,region,page)}</div>
      <div class="atlas-foot"><span>${icon("tag",14)}Star colors follow your subject tags</span>${pages>1?`<select id="atlas-sheet" aria-label="Constellation chart">${sheets}</select>`:`<span>${region.id===E.archive.id?"Origin archive":esc(region.name)}</span>`}</div></section>
      ${progressPanel(region,area)}`;
  }
  const motes=[[18,18],[31,46],[45,20],[55,48],[62,13],[70,35],[81,59],[88,21],[92,45],[67,64]];
  function focusRoom(s,reduced){
    const a=s.active,focus=a.mode==="focus",paused=a.endsAt===null;
    const equipment=a.loadout||E.loadout(s),world=M.item(equipment.habitat),crew=M.item(equipment.companion),gear=M.item(equipment.gear);
    const stage=E.survey(s,world.id).stage,animated=s.settings.motion && !reduced;
    const motesHtml=motes.map(([x,y],i)=>`<i style="--x:${x}%;--y:${y}%;--delay:-${i*1.7}s;--cycle:${8+i%4}s"></i>`).join("");
    return `<main id="main-content" tabindex="-1" class="focus-room ${world.color} ${animated?"motion-on":""} ${paused?"room-paused":""}" data-habitat="${world.id}">
      <div class="room-shell"><header class="room-header">${brand()}<div class="room-tools"><button class="motion-control" data-act="room-motion" aria-pressed="${animated}" ${reduced?'disabled title="Using your device’s reduced-motion preference"':""}>${icon("motion",17)}${reduced?"Reduced motion":animated?"Motion on":"Motion off"}</button><button type="button" class="icon-btn" data-act="sign-out" aria-label="Log out and keep this timer in your account" title="Log out and keep timer">${icon("logout",17)}</button></div></header>
      <section class="room-window" aria-label="${esc(world.name)} focus habitat"><img class="room-terrain" src="${art(world)}" alt=""><div class="room-veil"></div><div class="habitat-weather" aria-hidden="true"><i></i><i></i></div><div class="sky-motes" aria-hidden="true">${motesHtml}</div>
      ${landmark(stage,"room-landmark")}<div class="room-companion"><i></i>${img(crew.image,"",crew.name)}</div>
      <div class="room-hud"><div class="quiet-status"><i class="${paused?"paused":""}"></i>${paused?"Paused":focus?"Focusing":"On break"}</div>
      <h1>${focus?esc(a.tagName):M.modes[a.mode]}</h1><div id="live-clock" class="quiet-time" role="timer" aria-live="off">${clock(M.left(a))}</div>
      <div id="live-progress" class="quiet-progress" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="100"><i></i></div>
      <div class="room-actions"><button class="primary" data-act="pause">${icon(paused?"play":"pause",16)}${paused?"Resume":"Pause"}</button><button class="secondary" data-act="end-session">End ${focus?"session":"break"}</button></div></div>
      <div class="room-location">${icon("pin",16)}<div><strong>${world.name}</strong><span>${stage.name}</span></div></div></section>
      <div class="room-footer"><div class="crew-id">${img(crew.image)}<div><small>Companion</small><strong>${crew.name}</strong></div></div>
      ${gear?`<div class="room-instrument">${icon("gear",17)}${gear.name}</div>`:""}
      ${focus&&(a.note||a.taskName)?`<div class="room-intention">${a.taskName?`<span>${icon("tasks",15)}${esc(a.taskName)}</span>`:""}${a.note?`<p>${esc(a.note)}</p>`:""}</div>`:""}</div></div></main>`;
  }
  function creditRows(s,r){
    const f=r.flight;
    const row=(label,n)=>`<div><dt>${esc(label)}</dt><dd>+${n}</dd></div>`;
    const earnedMissions=f?.missions.length?E.daily(s,f.day).cards.filter(c=>f.missions.includes(c.id)):[];
    return `<dl class="payout">${row("Base focus credits",r.earned)}${f?.gearCredits?row(M.item(f.gear).name,f.gearCredits):""}${earnedMissions.map(c=>row(c.name,c.reward)).join("")}${f?.patch?row("Daily set bonus",E.patchCredits):""}</dl>`;
  }
  function result(s){
    const r=s.result,focus=r.mode==="focus",f=r.flight,next=s.sessions.length%4===0?"long":"short";
    const crew=M.item(f?.companion||s.equipped.companion),world=M.item(f?.habitat||s.equipped.habitat);
    let milestone="";
    if(f){
      const area=E.survey(s,f.habitat);
      milestone=area.stages.filter(t=>t.at>area.points-f.survey && t.at<=area.points)
        .map(t=>`<p class="report-landmark">${landmark(t,"reward-landmark")}<span>${esc(t.name)} established</span></p>`).join("");
    }
    return `<main id="main-content" tabindex="-1" class="quiet"><section class="result-card flight-report">${img(f?.patch?"mission-patch.png":crew.image,"result-buddy",f?.patch?"Daily flight patch":"")}
      <h1>${focus?"Session complete":"Break complete"}</h1><p>${focus?`${plural(r.minutes,"minute")} of focus · ${esc(r.tagName)}`:`Your ${r.minutes}-minute break is over.`}</p>
      ${focus?`<div class="result-credit">${coin}+${plural(E.totalCredits(r),"credit")}</div>`:""}${focus && f && (f.gearCredits||f.missions.length||f.patch)?creditRows(s,r):""}
      ${f?`<div class="chart-receipt">${icon("atlas",18)}<span>Star charted in <b>${world.name}</b>${f.survey?` · +${plural(f.survey,"survey point")}`:""}</span></div>${milestone}${f.patch?'<p class="patch-earned">Daily flight patch earned</p>':""}`:""}
      ${focus&&r.taskName?`<p class="result-task">${icon("tasks",16)}${esc(r.taskName)}</p>`:""}
      ${f?.pendingMissions?.length?`<button class="secondary" data-act="view-rewards">${icon("challenges",16)}View challenge rewards</button>`:""}
      <div class="result-actions">${focus?`<button class="primary" data-act="take-break">${icon("cup",16)}Take a ${s.settings[next]} min break</button>`:""}<button class="${focus?"secondary":"primary"}" data-act="back-station">Back to station</button></div>
      ${focus?`<button class="text-btn view-star" data-act="view-result-star">${icon("atlas",15)}View this star</button>`:""}</section></main>`;
  }
  function detailHead(title){
    return `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-act="close-dialog" aria-label="Close">${icon("close",18)}</button></div>`;
  }
  function starDetails(r){
    const f=r.flight,world=f?M.item(f.habitat):E.archive;
    const datum=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    return `${detailHead("Star record")}<div class="dialog-body star-detail"><div class="star-record-title"><span style="--tag-color:${M.colors[r.tagColor]}">${icon("spark",27)}</span><div><h3>${esc(r.tagName)}</h3><p>${esc(date(r.endedAt,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}))}</p></div></div>
      <dl class="star-facts">${datum("Habitat",world.name)}${datum("Focus",plural(r.minutes,"minute"))}${f?datum("Companion",M.item(f.companion).name):""}${f?.gear?datum("Field gear",M.item(f.gear).name):""}${f?datum("Survey",plural(f.survey,"point")):""}${datum("Credits earned",E.totalCredits(r))}</dl>
      ${f&&(f.crewSurvey||f.gearSurvey)?`<p class="detail-bonus">Survey bonuses · ${[f.crewSurvey?`${M.item(f.companion).name} +${f.crewSurvey}`:"",f.gearSurvey?`${M.item(f.gear).name} +${f.gearSurvey}`:""].filter(Boolean).join(" · ")}</p>`:""}
      ${r.taskName?`<div class="star-task">${icon("tasks",16)}${esc(r.taskName)}</div>`:""}${r.note?`<h3 class="note-heading">Session note</h3><p class="star-note">${esc(r.note)}</p>`:""}
      ${f?.missions.length?`<p class="detail-bonus">${icon("challenges",15)}${plural(f.missions.length,"daily challenge")} earned · +${E.missionCredits(f)} credits</p>`:""}${f?.patch?`<div class="star-patch">${img("mission-patch.png")}Daily flight patch · +${E.patchCredits} credits</div>`:""}</div>
      <div class="dialog-actions"><button class="secondary" data-act="edit-session" data-value="${esc(r.id)}">${icon("edit",15)}Edit tag and note</button><button class="primary" data-act="close-dialog">Done</button></div>`;
  }
  function patchDetails(s,day){
    const board=E.daily(s,day);
    return `${detailHead("Daily flight patch")}<div class="dialog-body patch-details">${img("mission-patch.png")}<h3>${esc(textDate(day))}</h3>
      <ul>${board.cards.map(c=>`<li>${icon("check",15)}${esc(c.name)}${credit(c.reward)}</li>`).join("")}<li>${icon("challenges",15)}Daily set bonus${credit(E.patchCredits)}</li></ul></div><div class="dialog-actions"><button class="primary" data-act="close-dialog">Done</button></div>`;
  }
  function sheetFor(s,record){
    const records=E.survey(s,E.worldId(record)).records;
    return Math.max(0,Math.floor(records.findIndex(r=>r.id===record.id)/plotPoints.length));
  }
  globalThis.OrbitFlightViews={sheetFor,stationLinks,landmark,landmarkDetail,challenges,atlas,focusRoom,result,starDetails,patchDetails};
})();
