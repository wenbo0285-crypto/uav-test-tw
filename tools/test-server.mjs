import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.env.PREVIEW_ROOT || 'dist');
if (!fs.existsSync(path.join(root,'index.html'))) throw Error('Run npm run build before preview');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end(); }
  if(pathname==='/favicon.ico')pathname='/assets/favicon.svg';
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file!==root) { res.writeHead(404); return res.end(); }
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory()){
    if(!pathname.endsWith('/')){res.writeHead(301,{Location:pathname+'/'+new URL(req.url,'http://localhost').search});return res.end();}
    file=path.join(file,'index.html');
  }else if(!path.extname(file)&&fs.existsSync(file+'.html'))file+='.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(fs.readFileSync(path.join(root,'404.html')));
  }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT||4174), '127.0.0.1', () => console.log(`Local dist preview: http://127.0.0.1:${process.env.PORT||4174}`));
