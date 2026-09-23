import fs from 'node:fs';
import path from 'node:path';
import {load} from 'cheerio';

export function validatePublic(root,files,exact=false){
  const assert=(value,message)=>{if(!value)throw Error(message);};
  assert(new Set(files).size===files.length,'Duplicate public file');
  for(const file of files)assert(fs.existsSync(path.join(root,file)),`Missing public file: ${file}`);
  if(exact){
    const actual=fs.readdirSync(root,{recursive:true}).filter(f=>fs.statSync(path.join(root,f)).isFile()).map(f=>f.replaceAll('\\','/')).sort();
    assert(JSON.stringify(actual)===JSON.stringify([...files].sort()),'Unexpected or missing dist files');
  }
  const origin='https://uav-test.tw';
  const sitemap=load(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),{xmlMode:true});
  const urls=sitemap('loc').map((_,el)=>sitemap(el).text()).get();
  assert(new Set(urls).size===urls.length,'Duplicate sitemap URL');
  const canonicals=[];
  const resolvePath=url=>decodeURIComponent(url.pathname).replace(/^\//,'').replace(/(^|\/)$/,'$1index.html');
  for(const file of files.filter(f=>f.endsWith('.html')&&!f.startsWith('google'))){
    const $=load(fs.readFileSync(path.join(root,file),'utf8'));
    assert($('title').text().trim()&&$('meta[name=description]').attr('content'),'Missing title or description: '+file);
    if(file==='404.html'){assert($('meta[name=robots]').attr('content')==='noindex','404 must be noindex');}
    else{
      const canonical=$('link[rel=canonical]');
      const expected=origin+'/'+file.replace(/(^|\/)index\.html$/,'$1');
      assert(canonical.length===1&&canonical.attr('href')===expected,'Invalid canonical: '+file);
      canonicals.push(expected);assert(urls.includes(expected),'Missing sitemap URL: '+file);
    }
    assert($('header a[href$="friends.html"]').length===1,'Missing visible friend navigation: '+file);
    for(const el of $('a[href],link[href],script[src],img[src],use[href]').toArray()){
      const href=$(el).attr('href')||$(el).attr('src');
      if(!href||/^(mailto:|tel:|data:|#)/.test(href))continue;
      const url=new URL(href,origin+'/'+file);
      if(url.origin!==origin)continue;
      const target=resolvePath(url);
      assert(files.includes(target),'Unpublished local link: '+file+' -> '+href);
    }
    if(file.startsWith('guide/')){
      assert($('.content-meta time').attr('datetime')==='2026-09-21','Missing editorial date: '+file);
      const links=$('.editorial-source a[data-guide-bank]');assert(links.length===1,'Missing guide bank CTA: '+file);
      const bank=links.attr('data-guide-bank'),url=new URL(links.attr('href'),origin+'/'+file);
      assert(['normal','pro'].includes(bank)&&url.searchParams.get('bank')===bank&&url.searchParams.get('mode')==='reading','Invalid guide CTA: '+file);
    }
  }
  assert(urls.length===canonicals.length&&urls.every(url=>canonicals.includes(url)),'Sitemap contains noncanonical or missing page');
  assert(fs.readFileSync(path.join(root,'robots.txt'),'utf8').includes(origin+'/sitemap.xml'),'Invalid robots sitemap');
  console.log(`Public links, canonical and sitemap verified: ${canonicals.length} pages`);
}
