(() => {
  'use strict';
  const backend='https://richard-writing-desk.playfulnoodle16.chatgpt.site';
  const start=document.getElementById('owner-sign-in');
  const cancel=document.getElementById('owner-cancel');
  const status=document.getElementById('owner-status');
  const fallback=document.getElementById('owner-popup-link');
  const frame=document.getElementById('writing-editor');
  const label=document.getElementById('published-label');
  if(!start||!frame)return;
  let popup=null, generation=0, timer=null, ticket=null, ready=false, handoffSent=false;
  function tell(text){status.textContent=text;}
  function theme(){frame.contentWindow?.postMessage({type:'writing-theme',theme:document.documentElement.dataset.theme||'light'},backend);}
  function handoff(){if(ready && ticket?.code && !handoffSent) {handoffSent=true;theme();frame.contentWindow.postMessage({type:'writing-auth-code',code:ticket.code,nonce:ticket.nonce},backend);}}
  function stop(){clearTimeout(timer);timer=null;cancel.hidden=true;fallback.hidden=true;}
  function reset(){generation++;stop();ticket=null;ready=false;handoffSent=false;frame.hidden=true;frame.src='about:blank';label.hidden=true;start.hidden=false;start.disabled=false;}
  start.addEventListener('click',async()=>{
    // Open synchronously during the click; never depend on OAuth preserving opener.
    popup=window.open('about:blank','writing-github-sign-in','popup,width=600,height=740');
    if(popup)popup.opener=null;
    reset();const run=generation;start.disabled=true;cancel.hidden=false;tell('Opening GitHub sign-in…');
    frame.src=backend+'/embed';
    try {
      const response=await fetch(backend+'/api/embed/ticket',{method:'POST',credentials:'omit'});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not start sign-in.');
      if(run!==generation)return;
      ticket=data;
      fallback.href=data.popupUrl;fallback.hidden=false;
      if(popup) {try {popup.location.replace(data.popupUrl);}catch {fallback.hidden=false;}}
      tell(popup?'Finish GitHub sign-in in the popup.':'Your browser blocked the popup. Use “Continue GitHub sign-in” below.');
      const deadline=Date.now()+600000;
      async function poll(){
        if(run!==generation)return;
        try {
          const result=await fetch(backend+'/api/embed/poll?ticket='+encodeURIComponent(data.ticket),{credentials:'omit',headers:{Authorization:'Bearer '+data.pollToken}});
          const update=await result.json();if(!result.ok)throw new Error(update.error||'Sign-in expired.');
          if(run!==generation)return;
          if(update.state==='ready'){ticket={...data,...update};tell('Opening your private editor…');handoff();return;}
          if(Date.now()>deadline)throw new Error('Sign-in timed out. Please try again.');
          timer=setTimeout(poll,1500);
        }catch(error){if(run===generation){stop();start.disabled=false;tell(error.message);}}
      }
      await poll();
    }catch(error){if(run===generation){stop();start.disabled=false;tell(error.message);try{popup?.close();}catch{}}}
  });
  cancel.addEventListener('click',()=>{reset();try{popup?.close();}catch{}tell('Sign-in cancelled.');});
  window.addEventListener('message',event=>{
    if(event.origin!==backend || event.source!==frame.contentWindow)return;
    const data=event.data;
    if(data?.type==='writing-ready'){ready=true;theme();handoff();}
    if(data?.type==='writing-connected'){stop();start.hidden=true;frame.hidden=false;label.hidden=false;tell('');theme();try{popup?.close();}catch{}}
    if(data?.type==='writing-resize' && Number.isFinite(data.height)) frame.style.height=Math.max(220,Math.min(data.height,4000))+'px';
    if(data?.type==='writing-signed-out'){reset();tell('Signed out. Your saved drafts remain private.');}
    if(data?.type==='writing-error'){stop();start.disabled=false;tell(typeof data.message==='string'?data.message:'Please sign in again.');}
  });
  new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
