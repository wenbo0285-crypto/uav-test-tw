(() => {
  const init=()=>{
    const nav=document.querySelector('.header-actions, .site-nav');if(!nav)return;
    const secondary=[...nav.querySelectorAll('a')].filter(a=>!/(?:^|\/)friends(?:\.html)?\/?$/.test(a.pathname));
    if(!secondary.length)return;
    const panel=document.createElement('div');panel.id='secondary-navigation';panel.className='secondary-navigation';
    const button=document.createElement('button');button.type='button';button.className='menu-toggle';button.textContent='選單';
    button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','更多導覽選單');
    secondary.forEach(a=>{a.classList.remove('secondary-nav');panel.append(a);});
    nav.append(button,panel);
    const media=matchMedia('(max-width:1150px)');
    const setOpen=(open,focus=false)=>{button.setAttribute('aria-expanded',String(open));panel.hidden=media.matches&&!open;if(focus)button.focus();};
    button.onclick=()=>setOpen(button.getAttribute('aria-expanded')!=='true');
    nav.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.preventDefault();setOpen(false,true);}});
    document.addEventListener('click',event=>{if(!nav.contains(event.target))setOpen(false);});
    panel.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
    const resize=()=>{button.hidden=!media.matches;setOpen(false);};media.addEventListener('change',resize);resize();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
