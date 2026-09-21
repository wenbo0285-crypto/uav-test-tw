(() => {
  if(window.siteAnalytics)return;
  const production=['uav-test.tw','www.uav-test.tw'].includes(location.hostname)&&!navigator.webdriver;
  const measurementId=production?'G-3WQQS2HF5D':'';
  window.siteAnalyticsConfig={gaMeasurementId:measurementId,debug:false};
  const events=[],seen=new Set();
  const allowed=new Set(['page_view','screen_view','theme_toggle','question_bank_select','quiz_options_view','reading_mode_start','reading_progress','quiz_start','quiz_resume','quiz_answer','quiz_complete','review_start','review_answer','review_complete','friend_link_click','sponsor_click','affiliate_click','outbound_click']);
  const strings=new Set(['screen_name','question_bank','question_bank_label','bank_version','mode','attempt_id','placement','destination_host','campaign','theme','selected_option','correct_option']);
  const numbers=new Set(['requested_question_count','question_count','question_number','question_section','question_index','answered_count','correct_count','wrong_count','score_percent','scroll_percent','active_duration_ms']);
  function track(name,params={}) {
    if(!allowed.has(name))return;
    const context=/^(quiz|review)_/.test(name)?window.siteAnalytics.context?.()||{}:{};
    const clean={page_path:location.pathname};
    for(const [key,value] of Object.entries({...context,...params})){
      if(strings.has(key)&&typeof value==='string'&&value.length<=100)clean[key]=value;
      else if(numbers.has(key)&&Number.isFinite(value)&&value>=0)clean[key]=Math.round(value);
      else if(key==='is_correct'&&typeof value==='boolean')clean[key]=value;
    }
    const once=/^(quiz|review)_(start|answer|complete)$/.test(name)&&clean.attempt_id;
    const key=once?`${clean.attempt_id}:${name}:${name.endsWith('_answer')?clean.question_number:''}`:name==='page_view'?'document':null;
    if(key&&seen.has(key))return;if(key)seen.add(key);
    if(seen.size>2000)seen.delete(seen.values().next().value);
    const event={name,params:clean};events.push(event);if(events.length>200)events.shift();
    if(measurementId&&typeof window.gtag==='function'){
      try{window.gtag('event',name,{...clean,page_location:location.origin+location.pathname,page_referrer:document.referrer?new URL(document.referrer).origin:''});}catch{}
    }
  }
  window.siteAnalytics={events,track,context:null};window.trackEvent=track;
  if(measurementId){
    window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    window.gtag('js',new Date());
    window.gtag('config',measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname,page_referrer:document.referrer?new URL(document.referrer).origin:''});
    const script=document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;document.head.append(script);
  }
  track('page_view');
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    const url=new URL(link.href,location.href);if(!['https:','http:'].includes(url.protocol)||url.origin===location.origin)return;
    const friend=/\/friends(?:\.html)?\/?$/.test(location.pathname)&&link.closest('main');
    const sponsor=link.dataset.track==='sponsor_click'||link.classList.contains('sponsor-link');
    const affiliate=link.dataset.track==='affiliate_click'||link.classList.contains('affiliate-link');
    track(friend?'friend_link_click':sponsor?'sponsor_click':affiliate?'affiliate_click':'outbound_click',{
      destination_host:url.hostname,placement:friend?'friends_content':link.closest('header')?'header':link.closest('footer')?'footer':'content',
      ...(sponsor&&/^[a-z0-9_-]{1,40}$/i.test(link.dataset.campaign||'')?{campaign:link.dataset.campaign}:{})
    });
  });
})();
