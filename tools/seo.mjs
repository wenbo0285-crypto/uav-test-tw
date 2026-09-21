import {load} from 'cheerio';
const origin='https://uav-test.tw';
const siteName='全國無人機測驗中心';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

// Build-time enrichment: crawlers receive ordinary HTML without executing JS.
export function enrichSeo(html,file){
  if(!file.endsWith('.html')||file==='404.html'||file.startsWith('google'))return html;
  const $=load(html),canonical=$('link[rel=canonical]').attr('href');
  if(!canonical)throw Error('SEO requires canonical: '+file);
  const title=$('title').text(),description=$('meta[name=description]').attr('content'),headline=$('h1').first().text().trim();
  const isArticle=file.startsWith('guide/')&&file!=='guide/index.html';
  const crumbs=[{name:'首頁',item:origin+'/'}];
  if(file!=='index.html'){
    if(isArticle)crumbs.push({name:'教學文章',item:origin+'/guide/'});
    crumbs.push({name:headline,item:canonical});
  }
  const graph=[{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:siteName,alternateName:'無人機學科題庫',inLanguage:'zh-TW'}];
  const page={'@type':isArticle?'Article':'WebPage','@id':canonical+'#content',url:canonical,name:title,headline,description,inLanguage:'zh-TW',isPartOf:{'@id':origin+'/#website'}};
  if(isArticle){
    page.author={'@type':'Organization',name:siteName,url:origin+'/about.html'};
    page.mainEntityOfPage=canonical;
    const modified=$('.content-meta time[datetime]').attr('datetime');
    if(modified)page.dateModified=modified;
    page.citation=$('.editorial-source a[href^="https://"]').map((_,el)=>$(el).attr('href')).get();
  }
  graph.push(page);
  if(crumbs.length>1)graph.push({'@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,...c}))});
  const meta=[['property','og:type',isArticle?'article':'website'],['property','og:title',title],['property','og:description',description],['property','og:url',canonical],['property','og:site_name',siteName],['property','og:locale','zh_TW'],['property','og:image',origin+'/assets/social-card.png'],['property','og:image:width','1200'],['property','og:image:height','630'],['property','og:image:alt','無人機考照題庫：普通、專業、屆期換證；民間學習工具'],['name','twitter:card','summary_large_image'],['name','twitter:title',title],['name','twitter:description',description],['name','twitter:image',origin+'/assets/social-card.png']].map(([attr,key,value])=>`    <meta ${attr}="${key}" content="${escape(value)}">`).join('\n');
  const json=JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c');
  html=html.replace('</head>',`${meta}\n    <script type="application/ld+json">${json}</script>\n</head>`);
  if(crumbs.length>1){
    const nav=`<nav class="breadcrumbs" aria-label="麵包屑導覽">${crumbs.map((c,i)=>i===crumbs.length-1?`<span aria-current="page">${escape(c.name)}</span>`:`<a href="${new URL(c.item).pathname}">${escape(c.name)}</a>`).join('<span aria-hidden="true"> / </span>')}</nav>\n`;
    html=html.replace(/<h1\b/,nav+'<h1');
  }
  return html;
}
