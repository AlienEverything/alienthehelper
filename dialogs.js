(function orbitDialogs(){
  "use strict";
  const {icon,coin,escape:esc,options,miniTag,art,tag}=OrbitViews;
  const M=OrbitModel;
  const head = title=>`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button type="button" class="icon-btn" data-act="close-dialog" aria-label="Close">${icon("close",19)}</button></div>`;
  const close=`<button class="secondary" type="button" data-act="close-dialog">Cancel</button>`;
  const error='<p class="form-error" id="form-error" role="alert" hidden></p>';
  const wrap=(name,title,b,actions)=>`${head(title)}<form data-form="${name}"><div class="dialog-body">${b}${error}</div><div class="dialog-actions">${actions}</div></form>`;
  const save=label=>`<button type="submit" class="primary">${esc(label)}</button>`;
  const attr=v=>esc(v);
  const field=(id,label,control)=>`<div class="form-field"><label for="${id}">${esc(label)}</label>${control}</div>`;
  const awakeHelp={
    off:"Prevents auto-lock while Orbit Outpost is on screen, even between timers.",
    waiting:"Asking your device to keep the screen awake…",
    active:"Active while Orbit Outpost is on screen, even between timers.",
    paused:"Your device paused this setting. Save settings to try again.",
    unavailable:"This browser can’t keep the screen awake. On iPad, open this page in Safari 16.4 or later."
  };
  function settings(s,user,awakeStatus){
    const fields=[["focus","Focus"],["short","Short break"],["long","Long break"]].map(([k,label])=>field("setting-"+k,label,`<div class="num-unit"><input id="setting-${k}" name="${k}" type="number" required min="1" max="${M.limits[k]}" value="${s.settings[k]}"><span>min</span></div>`)).join("");
    return wrap("settings","Settings",`<div class="settings-section account-identity"><div><h3>Your account</h3><p>Signed in as ${esc(user.username)} on Puter</p></div><button type="button" class="secondary small" data-act="sign-out">Log out</button></div><h3 class="form-section">Session lengths</h3><div class="duration-fields">${fields}</div>
      ${field("goal-input","Daily goal",`<div class="num-unit"><input id="goal-input" type="number" name="goal" required min="1" max="${M.limits.goal}" value="${s.settings.goal}"><span>focus sessions</span></div>`)}
      ${field("setting-motion","Focus scenery",`<select name="motion" id="setting-motion"><option value="on" ${s.settings.motion?"selected":""}>Gentle motion</option><option value="off" ${!s.settings.motion?"selected":""}>Still scenery</option></select>`)}
      <label class="awake-setting" for="setting-awake"><span><strong id="awake-label">Keep screen awake</strong><span id="awake-help" aria-live="polite">${awakeHelp[awakeStatus]}</span></span><input id="setting-awake" name="keepAwake" type="checkbox" role="switch" aria-labelledby="awake-label" aria-describedby="awake-help" ${s.settings.keepAwake?"checked":""} ${awakeStatus==="unavailable"?"disabled":""}></label>
      <div class="settings-section"><h3>Subjects</h3><button type="button" class="secondary small" data-act="manage-tags">${icon("tag",15)}Manage tags</button></div>
      <div class="backup"><h3>Progress backup</h3><p>Progress saves to your Puter account. Export a backup to keep a copy or move your outpost to a new website address.</p><div class="backup-actions"><button type="button" class="secondary small" data-act="export">${icon("download",15)}Export</button><button type="button" class="secondary small" data-act="import">${icon("upload",15)}Restore</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></div>`,`${close}${save("Save settings")}`);
  }
  function tagEditor(s,t,back) {
    const selected=t?.color || Object.keys(M.colors).find(c=>!s.tags.some(t=>t.color===c)) || "sage";
    const swatches=Object.entries(M.colors).map(([k,v])=>`<label class="swatch" style="--swatch:${v}"><input type="radio" name="color" value="${k}" aria-label="${k}" ${selected===k?"checked":""}><span>${icon("check",16)}</span></label>`).join("");
    return wrap("tag",t?"Edit subject tag":"New subject tag",`<input type="hidden" name="id" value="${attr(t?.id||"")}"><input type="hidden" name="back" value="${back==="manage"?"manage":""}">
      ${field("tag-name","Subject name",`<input id="tag-name" name="name" type="text" maxlength="32" required autofocus placeholder="e.g. Chemistry" value="${attr(t?.name||"")}">`)}
      <fieldset><legend>Tag color</legend><div class="swatches">${swatches}</div></fieldset>`,`${t && t.id!=="general"?`<button class="danger-link" type="button" data-act="delete-tag" data-value="${attr(t.id)}">${icon("trash",16)}Delete</button>`:""}${close}${save(t?"Save tag":"Create tag")}`);
  }
  function manageTags(s){
    return `${head("Subject tags")}<div class="dialog-body tag-manager">${s.tags.map(t=>`<div>${miniTag(t)}<button type="button" class="icon-btn" aria-label="Edit ${attr(t.name)}" data-act="edit-tag" data-value="${attr(t.id)}">${icon("edit",16)}</button></div>`).join("")}</div><div class="dialog-actions"><button class="secondary" data-act="settings">Settings</button><button class="primary" data-act="new-tag" data-value="manage">${icon("plus",16)}New tag</button></div>`;
  }
  function taskEditor(s,t) {
    return wrap("task",t?"Edit task":"Add a task",`<input type="hidden" name="id" value="${attr(t?.id||"")}">
      ${field("task-name","Task",`<input id="task-name" type="text" name="name" required autofocus maxlength="120" placeholder="e.g. Review chapter 3" value="${attr(t?.name||"")}">`)}
      ${field("task-tag","Subject tag",`<select name="tagId" id="task-tag">${options(s,t?.tagId||s.draft.tagId)}</select>`)}
      ${field("task-target","Focus session target",`<input name="target" id="task-target" required type="number" min="1" max="30" value="${t?.target||1}">`)}
      <p class="field-help">Link this task to your timer. It completes when you reach its session target.</p>`,`${t?`<button type="button" class="danger-link" data-act="delete-task" data-value="${attr(t.id)}">${icon("trash",16)}Delete</button>`:""}${close}${save(t?"Save task":"Add task")}`);
  }
  function sessionEditor(s,r) {
    let choices=options(s,r.tagId);
    if(!s.tags.some(t=>t.id===r.tagId))choices=`<option selected value="${attr(r.tagId)}">${esc(r.tagName)} (archived)</option>${choices}`;
    return wrap("session","Edit session",`<input type="hidden" name="id" value="${attr(r.id)}">${field("record-tag","Subject tag",`<select id="record-tag" name="tagId">${choices}</select>`)}
      ${field("record-note","Session note",`<textarea name="note" id="record-note" rows="4" maxlength="500" placeholder="What did you work on?">${esc(r.note)}</textarea>`)}`,`${close}${save("Save changes")}`);
  }
  function purchase(s,p) {
    const enough=s.credits>=p.price;
    return `${head(p.name)}<div class="dialog-body purchase-dialog"><div class="product-art ${p.type} ${p.color}"><img src="${art(p)}" alt="${esc(p.name)}"></div><p>${esc(p.detail)}</p><div class="purchase-perk">${icon("spark",16)}<span>${esc(OrbitExpedition.perk(p))}</span></div><div class="purchase-line"><span>Price</span><b>${coin}${p.price} credits</b></div><div class="purchase-line"><span>Your balance</span><b>${coin}${s.credits} credits</b></div>${!enough?`<p class="field-help">Earn ${p.price-s.credits} more ${p.price-s.credits===1?"credit":"credits"} to unlock ${esc(p.name)}.</p>`:""}</div><div class="dialog-actions"><button class="secondary" data-act="close-dialog">${enough?"Cancel":"Close"}</button>${enough?`<button class="primary" data-act="confirm-buy" data-value="${p.id}">Buy and equip</button>`:""}</div>`;
  }
  function confirm(title,message,act,label,value="",keep="Cancel") {
    return `${head(title)}<div class="dialog-body"><p class="dialog-copy">${esc(message)}</p></div><div class="dialog-actions"><button class="secondary" data-act="close-dialog" autofocus>${esc(keep)}</button><button class="danger-btn" data-act="${act}" data-value="${attr(value)}">${esc(label)}</button></div>`;
  }
  globalThis.OrbitDialogs={settings,awakeHelp,tagEditor,manageTags,taskEditor,sessionEditor,purchase,confirm};
})();
