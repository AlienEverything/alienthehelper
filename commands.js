(function orbitCommands(){
  "use strict";
  const M=globalThis.OrbitModel;
  const context=s=>s.active?"active/"+s.active.id:s.result?"result/"+s.result.id:"station";
  function apply(s,op){
    const {type,data:d,at,id}=op;
    if(context(s)!==op.context){
      if(type==="settle")return;
      throw Error("Your timer changed on another device.");
    }
    if(M.settle(s,at) || type==="settle")return;
    switch(type){
      case "mode":if(Object.hasOwn(M.modes,d.mode))s.draft.mode=d.mode;break;
      case "launch":
        if(d.note!==undefined)s.draft.note=d.note;
        M.start(s,at,id);break;
      case "pause":
        if(s.active && (s.active.endsAt===null)!==d.paused)M.togglePause(s,at);
        break;
      case "motion":s.settings.motion=d.enabled;break;
      case "end":s.active=null;s.draft.mode="focus";break;
      case "back":s.result=null;s.draft.mode="focus";break;
      case "break":
        if(s.result?.mode!=="focus")return;
        s.result=null;s.draft.mode=s.sessions.length%4===0?"long":"short";M.start(s,at,id);break;
      case "choose-tag":if(s.tags.some(t=>t.id===d.id))s.draft.tagId=d.id;break;
      case "tag":{
        const tag=s.tags.find(t=>t.id===d.id);
        if(d.edit && !tag)throw Error("This tag was removed on another device.");
        if(s.tags.some(t=>t.id!==d.id && t.name.toLocaleLowerCase()===d.name.toLocaleLowerCase()))throw Error("A tag with that name already exists.");
        if(tag)Object.assign(tag,{name:d.name,color:d.color});
        else s.tags.push({id:d.id,name:d.name,color:d.color});
        if(d.select)s.draft.tagId=d.id;
        break;
      }
      case "delete-tag":
        if(d.id==="general")return;
        s.tags=s.tags.filter(t=>t.id!==d.id);
        for(const t of s.tasks)if(t.tagId===d.id)t.tagId="general";
        if(s.draft.tagId===d.id)s.draft.tagId="general";
        break;
      case "task":{
        const existing=s.tasks.find(t=>t.id===d.id);
        if(d.edit && !existing)throw Error("This task was removed on another device.");
        const t=existing||{id:d.id,count:0,done:false};
        Object.assign(t,{name:d.name,tagId:s.tags.some(tag=>tag.id===d.tagId)?d.tagId:"general",target:d.target});
        if(t.count>=t.target)t.done=true;
        if(!existing)s.tasks.unshift(t);
        if(s.draft.taskId===t.id){if(t.done)s.draft.taskId=null;else s.draft.tagId=t.tagId;}
        break;
      }
      case "toggle-task":{
        const t=s.tasks.find(t=>t.id===d.id);
        if(t)t.done=d.done;
        if(d.done && s.draft.taskId===d.id)s.draft.taskId=null;
        break;
      }
      case "link-task":{
        const t=s.tasks.find(t=>t.id===d.id && !t.done);
        if(!t)throw Error("That task is no longer open.");
        s.draft.taskId=t.id;s.draft.tagId=t.tagId;s.draft.mode="focus";break;
      }
      case "unlink":s.draft.taskId=null;break;
      case "delete-task":
        s.tasks=s.tasks.filter(t=>t.id!==d.id);
        if(s.draft.taskId===d.id)s.draft.taskId=null;
        break;
      case "buy":
        if(!s.owned.includes(d.id) && !M.buy(s,d.id))throw Error("Your balance is too low for this purchase.");
        M.equip(s,d.id);break;
      case "equip":M.equip(s,d.id);break;
      case "unequip":s.equipped.gear=null;break;
      case "settings":Object.assign(s.settings,d);break;
      case "edit-session":{
        const record=s.sessions.find(r=>r.id===d.id);if(!record)return;
        const tag=s.tags.find(t=>t.id===d.tagId);
        if(tag)Object.assign(record,{tagId:tag.id,tagName:tag.name,tagColor:tag.color});
        record.note=d.note;break;
      }
      case "restore":{
        const cursors=s.syncCursors;
        Object.assign(s,M.validateBackup(d.backup));
        s.syncCursors=cursors||{};break;
      }
      default:throw Error("The pending change is unreadable.");
    }
  }
  globalThis.OrbitCommands={apply,context};
})();
