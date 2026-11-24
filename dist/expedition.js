(function orbitExpeditions(){
  "use strict";

  const items = [
    {id:"pip",type:"companion",name:"Pip",price:0,image:"pip.png",color:"sage",detail:"A curious little moon sprout.",perk:"+1 survey point for a session of 10+ minutes with a note."},
    {id:"wisp",type:"companion",name:"Wisp",price:25,image:"wisp.png",color:"lilac",detail:"A soft-spoken drifter from the outer rings.",perk:"Earn +2 survey points when you start a 10+ minute session 5–30 minutes after finishing another focus session of at least 10 minutes."},
    {id:"sol",type:"companion",name:"Sol",price:60,image:"sol.png",color:"peach",detail:"A sun-warmed friend from the dunes.",perk:"Earn +1 survey point for each 10+ minute session advancing a linked task, or +2 for the session that completes it."},
    {id:"nyx",type:"companion",name:"Nyx",price:75,image:"nyx.png",color:"blue",detail:"A midnight moth that scouts unfamiliar skies.",perk:"Bank minutes from 10+ minute sessions with Nyx. Every 30 minutes earns +2 survey points, up to +4 per day."},
    {id:"fenn",type:"companion",name:"Fenn",price:115,image:"fenn.png",color:"peach",detail:"A patient, coral-frilled reef dweller.",perk:"Earn 1 survey point for every 8 full minutes in a completed focus session."},
    {id:"lunar",type:"habitat",name:"Lunar Hollow",price:0,image:"lunar-hollow.webp",color:"lilac",detail:"Violet peaks under a quiet ringed moon."},
    {id:"aurora",type:"habitat",name:"Aurora Basin",price:50,image:"aurora-basin.webp",color:"aqua",detail:"A still lagoon beneath ribbons of green light."},
    {id:"ember",type:"habitat",name:"Ember Dunes",price:85,image:"ember-dunes.webp",color:"peach",detail:"Copper mesas at the edge of dusk."},
    {id:"grotto",type:"habitat",name:"Glowcap Grotto",price:100,image:"glowcap-grotto.webp",color:"lilac",detail:"Luminous mushrooms shelter a quiet cave outpost."},
    {id:"reef",type:"habitat",name:"Tideglass Reef",price:140,image:"tideglass-reef.webp",color:"aqua",detail:"Glass-blue tide pools catch the first pink light."},
    {id:"scanner",type:"gear",name:"Survey scanner",price:45,image:"scanner.png",color:"sage",detail:"A handheld reader for mapping new terrain.",perk:"+1 survey point for a session of 15+ minutes."},
    {id:"relay",type:"gear",name:"Signal relay",price:70,image:"relay.png",color:"peach",detail:"A field radio for checking in on assignments.",perk:"+3 credits for a task-linked session of 15+ minutes."},
    {id:"antenna",type:"gear",name:"Deep-space antenna",price:120,image:"antenna.png",color:"lilac",detail:"A deep-range dish for long observations.",perk:"+2 survey points and +4 credits for a session of 45+ minutes."}
  ];
  const item = id => items.find(product=>product.id===id);
  const perk = product => product.type==="habitat" ? "Chart a separate constellation and build an outpost here." : product.perk;
  const categoryNames = {companion:"Companions",habitat:"Habitats",gear:"Field gear"};
  const sharedStages = [
    {at:0,name:"Landing site",image:null},
    {at:3,name:"Landing beacon",image:"beacon.png"},
    {at:9,name:"Field lab",image:"field-lab.png"},
    {at:18,name:"Observatory",image:"observatory.png"}
  ];
  const advancedThresholds=[30,45,60];
  const habitatLandmarks={
    lunar:["Moonstone Orrery","Crescent Gate","Palace of the Twin Moons"],
    aurora:["Prism Harp","Ribbonfall Bridge","Crown of the Aurora"],
    ember:["Cinder Kiln","Sunforge Colossus","Citadel of the Last Sun"],
    grotto:["Lanterncap Nursery","Mycelium Organ","Cathedral of Spores"],
    reef:["Tideglass Lens","Nautilus Pavilion","Palace of the Living Reef"]
  };
  const habitatStages=Object.fromEntries(Object.entries(habitatLandmarks).map(([world,names])=>[
    world,[...sharedStages,...names.map((name,i)=>({
      at:advancedThresholds[i],name,image:`${world}-${advancedThresholds[i]}.png`,tier:i+4
    }))]
  ]));
  const archive = {id:"origin",name:"Origin archive",color:"blue",image:"lunar-hollow.webp"};
  const patchCredits=10;
  // Old mission IDs remain readable so previously earned credits and patches survive updates.
  const legacyGroups=[
    [["notes","Field notes"],["linked","On assignment"],["subject","Archived challenge"]],
    [["time25","Steady signal"],["time35","Orbital window"],["time45","Deep transmission"]],
    [["repeat","Return landing"],["variety","Archived challenge"],["deep","Long-range survey"],["two","Double orbit"]]
  ];
  const slotRewards=[4,6,8];
  function legacyBoard(day){
    const ordinal=Date.parse(day+"T00:00:00Z")/86400000;
    const choices=[ordinal,ordinal+Math.floor(ordinal/3),ordinal+Math.floor(ordinal/7)];
    return legacyGroups.map((group,i)=>{
      const [id,name]=group[((choices[i]%group.length)+group.length)%group.length];
      return {id,name,reward:slotRewards[i],target:1,unit:"session",icon:"flag",description:"Completed before the daily challenge pool changed."};
    });
  }

  const catalog=[];
  const all=()=>true, noted=r=>r.flight.noted, linked=r=>r.flight.linked, brief=r=>r.minutes>=10 && r.minutes<=19;
  const standard=r=>r.minutes>=20 && r.minutes<=29, long=r=>r.minutes>=30, both=r=>noted(r)&&linked(r);
  const ten=r=>r.minutes>=10;
  const total=(rows,value)=>rows.reduce((sum,row)=>sum+value(row),0);
  function add(id,name,description,target,unit,icon,effort,measure){
    catalog.push({id:"v2-"+id,name,description,target,unit,icon,effort,measure});
  }
  function minutes(id,name,where,target,description,icon="clock"){
    add(id,name,description,target,"min",icon,target,rows=>total(rows.filter(where),r=>r.minutes));
  }
  function sessions(id,name,where,target,effort,description,icon="station"){
    add(id,name,description,target,target===1?"session":"sessions",icon,effort,rows=>rows.filter(where).length);
  }
  function pair(id,name,description,effort,matches){
    add(id,name,description,1,"pair","layers",effort,rows=>Number(rows.some((r,i)=>i>0 && matches(rows[i-1],r))));
  }
  function consecutive(id,name,description,target,effort,where){
    add(id,name,description,target,"sessions","flag",effort,rows=>{
      let run=0,best=0;
      for(const r of rows){run=where(r)?run+1:0;best=Math.max(best,run);}
      return best;
    });
  }

  minutes("warmup","Systems online",all,15,"Accumulate 15 minutes of focus.");
  minutes("half-hour","Half-hour orbit",all,30,"Accumulate 30 minutes of focus.");
  minutes("hour","The hourglass",all,60,"Accumulate one hour of focus.");
  minutes("notebook","Notebook margin",noted,20,"Log 20 focus minutes in sessions with notes.","note");
  minutes("journal","Field journal",noted,45,"Log 45 focus minutes in sessions with notes.","note");
  minutes("workbench","Workbench",linked,25,"Spend 25 focus minutes on linked tasks.","tasks");
  minutes("shift","Mission shift",linked,50,"Spend 50 focus minutes on linked tasks.","tasks");
  minutes("briefs","Lab book",both,30,"Log 30 minutes in sessions that have both a task and a note.","note");
  minutes("sprints","Signal bursts",brief,25,"Collect 25 minutes from sessions lasting 10–19 minutes.");
  minutes("cruise","Cruise control",standard,40,"Collect 40 minutes from sessions lasting 20–29 minutes.");
  minutes("deepwater","Deep current",long,55,"Collect 55 minutes from sessions lasting at least 30 minutes.");
  minutes("freestyle","Open sky",r=>!linked(r),25,"Spend 25 minutes in sessions with no linked task.");
  sessions("ten","Ignition",ten,1,10,"Finish a focus session of at least 10 minutes.");
  sessions("twenty-five","Clear signal",r=>r.minutes>=25,1,25,"Finish a focus session of at least 25 minutes.");
  sessions("forty","Deep space",r=>r.minutes>=40,1,40,"Finish a focus session of at least 40 minutes.");
  sessions("double","Double orbit",ten,2,22,"Finish two focus sessions of at least 10 minutes each.");
  sessions("triple","Three landings",ten,3,35,"Finish three focus sessions of at least 10 minutes each.");
  sessions("short-pair","Twin sparks",brief,2,22,"Finish two sessions lasting 10–19 minutes each.");
  sessions("standard-pair","Twin moons",standard,2,43,"Finish two sessions lasting 20–29 minutes each.");
  sessions("long-pair","Binary stars",long,2,65,"Finish two sessions of 30 minutes or more.");
  sessions("caption","First entry",r=>ten(r)&&noted(r),1,12,"Finish a 10+ minute session with a note.","note");
  sessions("captions","Logbook pages",r=>ten(r)&&noted(r),3,38,"Add a note to three completed sessions of 10+ minutes.","note");
  sessions("assignment","On the manifest",r=>ten(r)&&linked(r),1,12,"Complete a 10+ minute session on a linked task.","tasks");
  sessions("dispatch","Dispatch desk",r=>ten(r)&&linked(r),3,38,"Complete three task-linked sessions of 10+ minutes.","tasks");
  sessions("blueprint","Blueprint",r=>ten(r)&&both(r),1,14,"Add a note to a task-linked session of 10+ minutes.","note");
  sessions("blueprints","Design review",r=>ten(r)&&both(r),2,29,"Complete two task-linked sessions of 10+ minutes with notes.","note");
  sessions("postcard","Postcard",r=>brief(r)&&noted(r),1,12,"Leave a note on a 10–19 minute session.","note");
  sessions("fieldreport","Field report",r=>standard(r)&&noted(r),1,23,"Leave a note on a 20–29 minute session.","note");
  sessions("debrief","Long-form log",r=>long(r)&&noted(r),1,33,"Leave a note on a session of at least 30 minutes.","note");
  sessions("errand","Supply run",r=>brief(r)&&linked(r),1,12,"Link a task to a 10–19 minute session.","tasks");
  sessions("duty","Flight duty",r=>standard(r)&&linked(r),1,23,"Link a task to a 20–29 minute session.","tasks");
  sessions("project","Project window",r=>long(r)&&linked(r),1,33,"Link a task to a session of at least 30 minutes.","tasks");
  sessions("open","Independent study",r=>ten(r)&&!linked(r),2,24,"Complete two 10+ minute sessions without linking a task.");
  sessions("manifest","Detailed manifest",r=>long(r)&&both(r),1,36,"Finish a 30+ minute session with both a task and a note.");
  pair("climb","Climb to orbit","Complete two consecutive 10+ minute sessions. Make the second at least 5 minutes longer.",27,(a,b)=>ten(a)&&b.minutes>=a.minutes+5);
  pair("descent","Gentle descent","Complete two consecutive 10+ minute sessions. Make the second at least 5 minutes shorter.",27,(a,b)=>ten(b)&&a.minutes>=b.minutes+5);
  pair("echo","Echo pulse","Complete two consecutive sessions of the same length, at least 10 minutes each.",22,(a,b)=>ten(a)&&a.minutes===b.minutes);
  pair("launchpad","Launchpad","Follow a 10–19 minute session immediately in your log with one of at least 20 minutes.",33,(a,b)=>brief(a)&&b.minutes>=20);
  pair("cooldown","Cool-down pass","Follow a 20+ minute session with a 10–19 minute session.",33,(a,b)=>a.minutes>=20&&brief(b));
  pair("longhaul","Transfer orbit","Follow a 20–29 minute session with one of at least 30 minutes.",52,(a,b)=>standard(a)&&long(b));
  pair("handoff","Task handoff","Link two consecutive 10+ minute sessions to different tasks.",28,(a,b)=>ten(a)&&ten(b)&&linked(a)&&linked(b)&&a.taskId!==b.taskId);
  pair("followup","Follow-up","Return to the same linked task in two consecutive 10+ minute sessions.",25,(a,b)=>ten(a)&&ten(b)&&linked(a)&&linked(b)&&a.taskId===b.taskId);
  pair("recon","Recon and report","Follow a 10+ minute session without a note with a 10+ minute session that has one.",24,(a,b)=>ten(a)&&ten(b)&&!noted(a)&&noted(b));
  pair("plan","From idea to action","Follow a 10+ minute unlinked session with a 10+ minute task-linked session.",24,(a,b)=>ten(a)&&ten(b)&&!linked(a)&&linked(b));
  pair("explore","Open-ended follow-up","Follow a 10+ minute task-linked session with a 10+ minute unlinked session.",24,(a,b)=>ten(a)&&ten(b)&&linked(a)&&!linked(b));
  consecutive("note-run","Continuous log","Finish two consecutive sessions of at least 15 minutes with a note on each.",2,34,r=>r.minutes>=15&&noted(r));
  consecutive("task-run","On rotation","Finish two consecutive task-linked sessions of at least 15 minutes.",2,34,r=>r.minutes>=15&&linked(r));
  consecutive("cruise-run","Stable orbit","Finish three consecutive sessions of at least 15 minutes.",3,50,r=>r.minutes>=15);
  consecutive("sprint-run","Pulse train","Finish three consecutive sessions lasting 10–19 minutes each.",3,35,brief);
  consecutive("deep-run","High orbit","Finish two consecutive sessions of at least 25 minutes each.",2,54,r=>r.minutes>=25);
  function mix(id,name,description,effort,...types){
    add(id,name,description,types.length,"types","layers",effort,rows=>types.filter(where=>rows.some(where)).length);
  }
  mix("spectrum","Full spectrum","Finish a 10–19 minute session, a 20–29 minute session, and a 30+ minute session.",65,brief,standard,long);
  mix("bookends","Bookends","Finish both a 10–19 minute session and a 30+ minute session, in either order.",43,brief,long);
  mix("two-notes","Notes at two speeds","Leave notes on both a 10–19 minute session and a 20+ minute session.",33,r=>brief(r)&&noted(r),r=>r.minutes>=20&&noted(r));
  mix("task-sizes","Two-speed workbench","Link tasks to both a 10–19 minute session and a 20+ minute session.",33,r=>brief(r)&&linked(r),r=>r.minutes>=20&&linked(r));
  mix("logstyles","Two perspectives","Leave a note on a linked session and an unlinked session, each at least 10 minutes.",26,r=>ten(r)&&both(r),r=>ten(r)&&noted(r)&&!linked(r));
  function distinct(id,name,description,target,effort,where,key,unit){
    add(id,name,description,target,unit,"layers",effort,rows=>new Set(rows.filter(where).map(key)).size);
  }
  distinct("lengths","Tuning dial","Complete 10+ minute sessions at two different timer lengths.",2,24,ten,r=>r.minutes,"lengths");
  distinct("lengths-three","Frequency sweep","Complete 10+ minute sessions at three different timer lengths.",3,39,ten,r=>r.minutes,"lengths");
  distinct("tasks","Two assignments","Spend at least one 10+ minute session on each of two different tasks.",2,26,r=>ten(r)&&linked(r),r=>r.taskId,"tasks");
  distinct("tasks-noted","Annotated roster","Complete a noted 10+ minute session on each of two different tasks.",2,29,r=>ten(r)&&both(r),r=>r.taskId,"tasks");
  add("single-task","Project anchor","Accumulate 35 focus minutes on a single linked task.",35,"min","tasks",38,rows=>{
    const totals=new Map();
    for(const r of rows.filter(linked))totals.set(r.taskId,(totals.get(r.taskId)||0)+r.minutes);
    return Math.max(0,...totals.values());
  });
  add("charts","Survey ledger","Collect 4 survey points across today's focus sessions.",4,"points","planet",40,rows=>total(rows,r=>r.flight.survey));

  const draws=new Map();
  function assignments(day){
    if(draws.has(day))return draws.get(day);
    let seed=2166136261;
    for(const ch of "orbit-daily-v2/"+day)seed=Math.imul(seed^ch.charCodeAt(0),16777619);
    function random(){
      seed=(seed+0x6d2b79f5)|0;
      let t=Math.imul(seed^(seed>>>15),1|seed);
      t^=t+Math.imul(t^(t>>>7),61|t);
      return ((t^(t>>>14))>>>0)/4294967296;
    }
    const pool=catalog.slice();
    for(let i=0;i<3;i++){
      const j=i+Math.floor(random()*(pool.length-i));
      [pool[i],pool[j]]=[pool[j],pool[i]];
    }
    const cards=pool.slice(0,3).sort((a,b)=>a.effort-b.effort).map((c,i)=>({...c,reward:slotRewards[i]}));
    if(draws.size>=400)draws.clear();
    draws.set(day,cards);
    return cards;
  }
  function earnedMissions(flight){
    if(!flight?.missions.length)return [];
    const board=flight.missionSet===2?assignments(flight.day):legacyBoard(flight.day);
    return board.filter(c=>flight.missions.includes(c.id));
  }
  function boardFromRows(day,rows){
    const ordered=rows.slice().sort((a,b)=>a.endedAt-b.endedAt || a.id.localeCompare(b.id));
    const paid=new Set(ordered.flatMap(r=>r.flight.missions));
    const pending=new Set(ordered.flatMap(r=>r.flight.pendingMissions||[]));
    const old=legacyBoard(day);
    const cards=assignments(day).map((card,i)=>{
      if(paid.has(old[i].id))return {...old[i],paid:true,progress:1};
      const done=paid.has(card.id);
      const ready=!done && pending.has(card.id);
      return {...card,paid:done,ready,progress:done||ready?card.target:Math.min(card.target,card.measure(ordered))};
    });
    return {day,cards,patch:ordered.some(r=>r.flight.patch),pendingPatch:ordered.some(r=>r.flight.pendingPatch),completed:cards.filter(c=>c.paid || c.ready).length};
  }

  function dayKey(time=Date.now()){
    const d=new Date(time);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  }
  function daily(s,day=dayKey()){
    return boardFromRows(day,s.sessions.filter(r=>r.flight?.day===day));
  }
  function earlierRewards(s,today){
    const days=new Set(s.sessions.filter(r=>r.flight?.pendingMissions?.length || r.flight?.pendingPatch).map(r=>r.flight.day));
    days.delete(today);
    if(!days.size)return [];
    const rows=new Map([...days].map(day=>[day,[]]));
    for(const r of s.sessions)rows.get(r.flight?.day)?.push(r);
    return [...days].sort().reverse().map(day=>boardFromRows(day,rows.get(day)));
  }
  function claimReward(s,day,id){
    const rows=s.sessions.filter(r=>r.flight?.day===day);
    if(!rows.length)return 0;
    const board=boardFromRows(day,rows);
    let amount;
    if(id==="patch"){
      if(board.patch || !board.pendingPatch || !board.cards.every(c=>c.paid))return 0;
      const flight=rows.find(r=>r.flight.pendingPatch).flight;
      delete flight.pendingPatch;
      flight.patch=true;
      amount=patchCredits;
    }else{
      const card=board.cards.find(c=>c.id===id && c.ready);
      if(!card)return 0;
      const flight=rows.find(r=>r.flight.pendingMissions?.includes(id)).flight;
      flight.pendingMissions=flight.pendingMissions.filter(key=>key!==id);
      if(!flight.pendingMissions.length)delete flight.pendingMissions;
      flight.missions.push(id);
      amount=card.reward;
    }
    s.credits+=amount;
    return amount;
  }
  function loadout(s){
    return {habitat:s.equipped.habitat,companion:s.equipped.companion,gear:s.equipped.gear??null};
  }
  // Store the extra points above the standard rate as Fenn’s contribution to the star.
  const fennBonus=minutes=>Math.floor(minutes/8)-Math.floor(minutes/10);
  function crewBonus(s,record,flight,previous,startedAt){
    if(flight.companion==="fenn")return fennBonus(record.minutes);
    if(record.minutes<10)return 0;
    switch(flight.companion){
      case "pip":return Number(flight.noted);
      case "nyx":{
        const bank=total(previous.filter(r=>r.flight.crewRules===2 && r.flight.companion==="nyx" && r.minutes>=10),r=>r.minutes);
        const payout=n=>2*Math.min(2,Math.floor(n/30));
        return payout(bank+record.minutes)-payout(bank);
      }
      case "sol":{
        const task=s.tasks.find(t=>t.id===record.taskId && !t.done);
        return task?(task.count+1>=task.target?2:1):0;
      }
      case "wisp":{
        const last=s.sessions.reduce((latest,r)=>r.endedAt<=startedAt && (!latest || r.endedAt>latest.endedAt)?r:latest,null);
        if(!last || last.minutes<10)return 0;
        const gap=startedAt-last.endedAt;
        return gap>=5*60000 && gap<=30*60000?2:0;
      }
      default:return 0;
    }
  }
  function chart(s,record,equipment,startedAt){
    const day=dayKey(record.endedAt);
    const previous=s.sessions.filter(r=>r.flight?.day===day);
    const flight={...equipment,day,noted:!!record.note.trim(),linked:!!record.taskId,subject:record.tagId,
      crewRules:2,crewSurvey:0,gearSurvey:0,gearCredits:0,survey:0,missionSet:2,missions:[],patch:false};
    flight.crewSurvey=crewBonus(s,record,flight,previous,startedAt);
    if(flight.gear==="scanner" && record.minutes>=15)flight.gearSurvey=1;
    if(flight.gear==="relay" && flight.linked && record.minutes>=15)flight.gearCredits=3;
    if(flight.gear==="antenna" && record.minutes>=45){flight.gearSurvey=2;flight.gearCredits=4;}
    flight.survey=Math.floor(record.minutes/10)+flight.crewSurvey+flight.gearSurvey;
    record.flight=flight;
    const board=boardFromRows(day,[...previous,record]);
    const unlocked=board.cards.filter(c=>!c.paid && !c.ready && c.progress===c.target).map(c=>c.id);
    if(unlocked.length)flight.pendingMissions=unlocked;
    if(!board.patch && !board.pendingPatch && board.cards.every(c=>c.progress===c.target))flight.pendingPatch=true;
  }
  const missionCredits=flight=>total(earnedMissions(flight),c=>c.reward);
  const totalCredits=record=>record.earned+(record.flight?.gearCredits||0)+missionCredits(record.flight)+(record.flight?.patch?patchCredits:0);
  const worldId=record=>record.flight?.habitat||archive.id;
  function survey(s,habitat){
    const records=s.sessions.filter(r=>worldId(r)===habitat).sort((a,b)=>a.endedAt-b.endedAt || a.id.localeCompare(b.id));
    const points=records.reduce((n,r)=>n+(r.flight?.survey||0),0);
    const stages=habitatStages[habitat]||sharedStages;
    const index=stages.findLastIndex(stage=>points>=stage.at);
    return {records,points,stages,stage:stages[index],next:stages[index+1]||null};
  }
  function validFlight(f,minute){
    if(f==null)return true; // Earlier versions did not record a habitat.
    const small=(n,max)=>Number.isSafeInteger(n) && n>=0 && n<=max;
    if(typeof f!=="object" || (f.crewRules!==undefined && f.crewRules!==2))return false;
    const bankingCrew=f.crewRules===2?"nyx":"wisp";
    const validCrew=f.crewRules===2 && f.companion==="fenn"
      ? f.crewSurvey===fennBonus(minute)
      : small(f.crewSurvey,f.missionSet===2 && f.companion===bankingCrew?4:2);
    if(item(f.habitat)?.type!=="habitat" || item(f.companion)?.type!=="companion" ||
      !(f.gear===null || item(f.gear)?.type==="gear") || typeof f.day!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(f.day) ||
      typeof f.subject!=="string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(f.subject) || typeof f.noted!=="boolean" ||
      typeof f.linked!=="boolean" || typeof f.patch!=="boolean" || !validCrew || !small(f.gearSurvey,2) ||
      !small(f.gearCredits,4) || f.survey!==Math.floor(minute/10)+f.crewSurvey+f.gearSurvey || !Array.isArray(f.missions))return false;
    const stamp=new Date(f.day+"T12:00:00");
    if(!Number.isFinite(stamp.getTime()) || dayKey(stamp)!==f.day)return false;
    if(f.missionSet!==undefined && f.missionSet!==2)return false;
    const valid=(f.missionSet===2?assignments(f.day):legacyBoard(f.day)).map(card=>card.id);
    if(f.pendingPatch!==undefined && (f.pendingPatch!==true || f.patch))return false;
    if(f.pendingMissions!==undefined && !Array.isArray(f.pendingMissions))return false;
    const all=[...f.missions,...(f.pendingMissions||[])];
    return all.length<=3 && new Set(all).size===all.length && all.every(id=>valid.includes(id));
  }
  globalThis.OrbitExpedition={items,item,perk,categoryNames,archive,stages:sharedStages,patchCredits,dayKey,daily,earlierRewards,claimReward,loadout,chart,missionCredits,totalCredits,worldId,survey,validFlight};
})();
