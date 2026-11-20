(function orbitAccounts(){
  "use strict";
  const V=globalThis.OrbitViews;
  let sdkRequest;
  function sdk(){
    if(globalThis.puter?.auth && globalThis.puter?.fs)return Promise.resolve(globalThis.puter);
    if(sdkRequest)return sdkRequest;
    sdkRequest=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      const fail=()=>{
        clearTimeout(timeout);script.remove();sdkRequest=null;
        reject(Error("Puter could not be reached. Check your connection and try again."));
      };
      const timeout=setTimeout(fail,16000);
      script.src="https://js.puter.com/v2/";
      script.async=true;script.referrerPolicy="no-referrer";
      script.onload=()=>{
        if(!globalThis.puter?.auth || !globalThis.puter?.fs){fail();return;}
        clearTimeout(timeout);resolve(globalThis.puter);
      };
      script.onerror=fail;document.head.append(script);
    });
    return sdkRequest;
  }
  function errorText(error,fallback){
    const code=error?.code||error?.error?.code||error?.error;
    if(code==="popup_blocked")return "Allow the Puter sign-in window in your browser, then try again.";
    if(code==="auth_window_closed")return "The sign-in window was closed. You can open it again.";
    if(code==="unsupported_origin")return "Open Orbit Outpost from its website or a local web server to sign in.";
    if(error instanceof Error && error.message && !/failed to fetch|networkerror|load failed/i.test(error.message))return error.message;
    return fallback;
  }
  function permanent(user){
    return !!user && typeof user.uuid==="string" && /^[a-zA-Z0-9_-]{1,100}$/.test(user.uuid) &&
      typeof user.username==="string" && user.username.length>0 && !user.is_temp;
  }
  const button=(action,label,primary=false,disabled=false)=>`<button type="button" class="${primary?"primary":"secondary"} account-button" data-act="${action}" ${disabled?"disabled":""}>${V.escape(label)}${primary&&!disabled?'<span class="account-arrow" aria-hidden="true">→</span>':""}</button>`;
  function gate({phase,signup,message,who,legacy}){
    const e=V.escape;
    let title,lead,controls,foot="";
    if(phase==="claim"){
      title="Bring your outpost aboard";
      lead=`This browser has ${legacy.sessions.length} saved focus ${legacy.sessions.length===1?"session":"sessions"} and ${legacy.credits} credits. Import this progress into ${who.username}’s account?`;
      controls=button("claim-progress","Import my progress",true)+button("start-fresh","Start a new outpost");
      foot='<button type="button" class="account-link" data-act="sign-out">Use another account</button>';
    }else if(phase==="cloud-error"){
      title="Reconnect to your outpost";
      lead="We couldn’t open your account save. Reconnect to continue where you left off.";
      controls=button("auth-retry","Try again",true);
      foot='<button type="button" class="account-link" data-act="sign-out">Use another account</button>';
    }else{
      title=signup?"Create your outpost":"Log in to your outpost";
      lead=signup?"Start with Pip on Lunar Hollow. Each focus session adds a star to your atlas.":"Pick up your timer, tasks, and star atlas on any device.";
      const ready=phase==="signed-out",failed=phase==="sdk-error",file=phase==="file";
      const label=failed?"Reconnect to Puter":file?"A web address is required":ready?(signup?"Sign up with Puter":"Log in with Puter"):
        phase==="signing-out"?"Logging out…":phase==="opening"?"Waiting for Puter…":phase==="loading-save"?"Opening your outpost…":"Connecting to Puter…";
      controls=button(failed?"auth-retry":"auth-continue",label,true,!failed&&!ready);
      if(file)foot="Serve this folder on localhost or open your published website.";
      else if(ready || failed)foot=signup?'Already have an account? <button class="account-link" data-act="auth-mode-login">Log in</button>':'New to Orbit Outpost? <button class="account-link" data-act="auth-mode-signup">Create an account</button>';
    }
    const provider=phase==="claim"||phase==="cloud-error"||phase==="file"?"":`<p class="provider-hint">${signup?"Choose “Create Free Account” in Puter’s window.":"Puter opens a secure window for your account."}</p>`;
    return `<main id="main-content" tabindex="-1" class="account-gate">
      <div class="account-shell"><section class="arrival-scene" aria-label="Pip on Lunar Hollow">
        <img class="arrival-terrain" src="./assets/lunar-hollow.webp" alt="" fetchpriority="high">
        <div class="arrival-brand">${V.brand()}</div><div class="arrival-pip"><img src="./assets/pip.png" alt=""></div>
        <span class="arrival-location">${V.icon("pin",15)}Lunar Hollow</span>
      </section><section class="account-panel" aria-labelledby="account-title"><div class="account-copy">
        <span class="account-symbol" aria-hidden="true">${V.icon(phase==="claim"?"upload":"atlas",25)}</span>
        <h1 id="account-title">${e(title)}</h1><p class="account-lead">${e(lead)}</p>
        ${message?`<p class="account-error" role="alert">${e(message)}</p>`:""}
        <div class="account-controls">${controls}</div>${provider}
        ${foot?`<div class="account-foot">${foot}</div>`:""}
      </div></section></div></main>`;
  }
  globalThis.OrbitAccounts={sdk,errorText,permanent,gate};
})();
