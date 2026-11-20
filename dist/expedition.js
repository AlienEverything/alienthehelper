(function orbitExpeditions(){
  "use strict";

  const items = [
    {id:"pip",type:"companion",name:"Pip",price:0,image:"pip.png",color:"sage",detail:"A curious little moon sprout.",perk:"+1 survey point for a session of 10+ minutes with a note."},
    {id:"wisp",type:"companion",name:"Wisp",price:25,image:"wisp.png",color:"lilac",detail:"A soft-spoken drifter from the outer rings.",perk:"+1 survey point for a session of 25+ minutes."},
    {id:"sol",type:"companion",name:"Sol",price:75,image:"sol.png",color:"peach",detail:"A sun-warmed friend from the dunes.",perk:"+1 survey point for a task-linked session of 10+ minutes."},
    {id:"nyx",type:"companion",name:"Nyx",price:60,image:"nyx.png",color:"blue",detail:"A midnight moth that scouts unfamiliar skies.",perk:"+1 survey point for the first 10+ minute session in each habitat each day."},
    {id:"fenn",type:"companion",name:"Fenn",price:115,image:"fenn.png",color:"peach",detail:"A patient, coral-frilled reef dweller.",perk:"+2 survey points for a session of 45+ minutes."},
    {id:"lunar",type:"habitat",name:"Lunar Hollow",price:0,image:"lunar-hollow.webp",color:"lilac",detail:"Violet peaks under a quiet ringed moon."},
    {id:"aurora",type:"habitat",name:"Aurora Basin",price:50,image:"aurora-basin.webp",color:"aqua",detail:"A still lagoon beneath ribbons of green light."},
    {id:"ember",type:"habitat",name:"Ember Dunes",price:100,image:"ember-dunes.webp",color:"peach",detail:"Copper mesas at the edge of dusk."},
    {id:"grotto",type:"habitat",name:"Glowcap Grotto",price:85,image:"glowcap-grotto.webp",color:"lilac",detail:"Luminous mushrooms shelter a quiet cave outpost."},
    {id:"reef",type:"habitat",name:"Tideglass Reef",price:140,image:"tideglass-reef.webp",color:"aqua",detail:"Glass-blue tide pools catch the first pink light."},
    {id:"scanner",type:"gear",name:"Survey scanner",price:45,image:"scanner.png",color:"sage",detail:"A handheld reader for mapping new terrain.",perk:"+1 survey point for a session of 15+ minutes."},
    {id:"relay",type:"gear",name:"Signal relay",price:70,image:"relay.png",color:"peach",detail:"A field radio for checking in on assignments.",perk:"+3 credits for a task-linked session of 15+ minutes."},
    {id:"antenna",type:"gear",name:"Deep-space antenna",price:120,image:"antenna.png",color:"lilac",detail:"A deep-range dish for long observations.",perk:"+2 survey points and +4 credits for a session of 45+ minutes."}
  ];
  const item = id => items.find(product=>product.id===id);
  const perk = product => product.type==="habitat" ? "Chart a separate constellation and build an outpost here." : product.perk;
  const categoryNames = {companion:"Companions",habitat:"Habitats",gear:"Field gear"};
  const stages = [
    {at:0,name:"Landing site",image:null},
    {at:3,name:"Landing beacon",image:"beacon.png"},
    {at:9,name:"Field lab",image:"field-lab.png"},
    {at:18,name:"Observatory",image:"observatory.png"}
  ];
  const archive = {id:"origin",name:"Origin archive",color:"blue",image:"lunar-hollow.webp"};
  const patchCredits=10;
  const slots = [
    [
      {id:"notes",name:"Field notes",description:"Finish a focus session of at least 10 minutes with a session note.",target:1,unit:"session",icon:"note"},
      {id:"linked",name:"On assignment",description:"Finish a task-linked focus session of at least 10 minutes.",target:1,unit:"session",icon:"tasks"},
      {id:"subject",name:"Subject specialist",description:"Focus for at least 10 minutes with a subject tag other than the default General tag.",target:1,unit:"session",icon:"tag"}
    ],
    [
      {id:"time25",name:"Steady signal",description:"Log 25 focus minutes across completed sessions today.",target:25,unit:"min",icon:"clock"},
      {id:"time35",name:"Orbital window",description:"Log 35 focus minutes across completed sessions today.",target:35,unit:"min",icon:"clock"},
      {id:"time45",name:"Deep transmission",description:"Log 45 focus minutes across completed sessions today.",target:45,unit:"min",icon:"clock"}
    ],
    [
      {id:"repeat",name:"Return landing",description:"Finish two sessions of at least 10 minutes in the same habitat.",target:2,unit:"sessions",icon:"planet"},
      {id:"variety",name:"Cross-training",description:"Study two different subject tags for at least 10 minutes each, in separate sessions.",target:2,unit:"subjects",icon:"layers"},
      {id:"deep",name:"Long-range survey",description:"Finish one focus session of at least 25 minutes.",target:1,unit:"session",icon:"station"},
      {id:"two",name:"Double orbit",description:"Finish two focus sessions of at least 10 minutes each.",target:2,unit:"sessions",icon:"flag"}
    ]
  ];
  const slotRewards=[4,6,8];
  const rewards = new Map(slots.flatMap((group,i)=>group.map(challenge=>[challenge.id,slotRewards[i]])));

  function dayKey(time=Date.now()){
    const d=new Date(time);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  }
  function assignments(day){
    const [year,month,date]=day.split("-").map(Number);
    const ordinal=Math.floor(Date.UTC(year,month-1,date)/86400000);
    const choices=[ordinal,ordinal+Math.floor(ordinal/3),ordinal+Math.floor(ordinal/7)];
    return slots.map((group,i)=>{
      const index=((choices[i]%group.length)+group.length)%group.length;
      return {...group[index],reward:slotRewards[i]};
    });
  }
  function boardFromRows(day,rows){
    const visits=new Map(),subjects=new Set(),paid=new Set();
    const counts={notes:0,linked:0,subject:0,deep:0,two:0,repeat:0,variety:0};
    let minutes=0,patch=false;
    for(const record of rows){
      const flight=record.flight;
      minutes+=record.minutes;
      flight.missions.forEach(id=>paid.add(id));
      if(flight.patch)patch=true;
      if(record.minutes<10)continue;
      counts.two++;
      if(flight.noted)counts.notes++;
      if(flight.linked)counts.linked++;
      if(flight.subject!=="general")counts.subject++;
      if(record.minutes>=25)counts.deep++;
      subjects.add(flight.subject);
      const visitsHere=(visits.get(flight.habitat)||0)+1;
      visits.set(flight.habitat,visitsHere);
      counts.repeat=Math.max(counts.repeat,visitsHere);
    }
    counts.variety=subjects.size;
    const cards=assignments(day).map(card=>({...card,
      progress:Math.min(card.target,card.unit==="min"?minutes:counts[card.id]),
      paid:paid.has(card.id)
    }));
    return {day,cards,patch,completed:cards.filter(c=>c.paid).length};
  }
  function daily(s,day=dayKey()){
    return boardFromRows(day,s.sessions.filter(r=>r.flight?.day===day));
  }
  function loadout(s){
    return {habitat:s.equipped.habitat,companion:s.equipped.companion,gear:s.equipped.gear??null};
  }
  function crewBonus(record,flight,previous){
    if(record.minutes<10)return 0;
    switch(flight.companion){
      case "pip":return Number(flight.noted);
      case "wisp":return Number(record.minutes>=25);
      case "sol":return Number(flight.linked);
      case "nyx":return Number(!previous.some(r=>r.minutes>=10 && r.flight.habitat===flight.habitat));
      case "fenn":return record.minutes>=45?2:0;
      default:return 0;
    }
  }
  function chart(s,record,equipment){
    const day=dayKey(record.endedAt);
    const previous=s.sessions.filter(r=>r.flight?.day===day);
    const flight={...equipment,day,noted:!!record.note.trim(),linked:!!record.taskId,subject:record.tagId,
      crewSurvey:0,gearSurvey:0,gearCredits:0,survey:0,missions:[],patch:false};
    flight.crewSurvey=crewBonus(record,flight,previous);
    if(flight.gear==="scanner" && record.minutes>=15)flight.gearSurvey=1;
    if(flight.gear==="relay" && flight.linked && record.minutes>=15)flight.gearCredits=3;
    if(flight.gear==="antenna" && record.minutes>=45){flight.gearSurvey=2;flight.gearCredits=4;}
    flight.survey=Math.floor(record.minutes/10)+flight.crewSurvey+flight.gearSurvey;
    record.flight=flight;
    const board=boardFromRows(day,[...previous,record]);
    flight.missions=board.cards.filter(c=>!c.paid && c.progress===c.target).map(c=>c.id);
    flight.patch=!board.patch && board.cards.every(c=>c.paid || c.progress===c.target);
  }
  const missionCredits=flight=>flight?flight.missions.reduce((n,id)=>n+(rewards.get(id)||0),0):0;
  const totalCredits=record=>record.earned+(record.flight?.gearCredits||0)+missionCredits(record.flight)+(record.flight?.patch?patchCredits:0);
  const worldId=record=>record.flight?.habitat||archive.id;
  function survey(s,habitat){
    const records=s.sessions.filter(r=>worldId(r)===habitat).sort((a,b)=>a.endedAt-b.endedAt || a.id.localeCompare(b.id));
    const points=records.reduce((n,r)=>n+(r.flight?.survey||0),0);
    const index=stages.findLastIndex(stage=>points>=stage.at);
    return {records,points,stage:stages[index],next:stages[index+1]||null};
  }
  function validFlight(f,minute){
    if(f==null)return true; // Earlier versions did not record a habitat.
    const small=(n,max)=>Number.isSafeInteger(n) && n>=0 && n<=max;
    if(typeof f!=="object" || item(f.habitat)?.type!=="habitat" || item(f.companion)?.type!=="companion" ||
      !(f.gear===null || item(f.gear)?.type==="gear") || typeof f.day!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(f.day) ||
      typeof f.subject!=="string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(f.subject) || typeof f.noted!=="boolean" ||
      typeof f.linked!=="boolean" || typeof f.patch!=="boolean" || !small(f.crewSurvey,2) || !small(f.gearSurvey,2) ||
      !small(f.gearCredits,4) || f.survey!==Math.floor(minute/10)+f.crewSurvey+f.gearSurvey || !Array.isArray(f.missions))return false;
    const stamp=new Date(f.day+"T12:00:00");
    if(!Number.isFinite(stamp.getTime()) || dayKey(stamp)!==f.day)return false;
    const valid=assignments(f.day).map(card=>card.id);
    return f.missions.length<=3 && new Set(f.missions).size===f.missions.length && f.missions.every(id=>valid.includes(id));
  }
  globalThis.OrbitExpedition={items,item,perk,categoryNames,archive,stages,patchCredits,dayKey,daily,loadout,chart,missionCredits,totalCredits,worldId,survey,validFlight};
})();
