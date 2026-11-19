import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,relative,extname} from 'node:path';
const root=process.cwd(),port=Number(process.env.NGEKOSAJA_PORT||5500);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const path=pathname==='/'?'/index.html':pathname;
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  if(!(/^\/(?:index\.html|config\/runtime\.js)$/.test(path)||/^\/(?:js|css|assets)\/[\w./-]+$/.test(path))||path.includes('..')||!types[extname(path)]){res.writeHead(404).end('Tidak ditemukan');return;}
  const file=resolve(root,'.'+path);if(relative(root,file).startsWith('..')||!statSync(file).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[extname(path)]+'; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
  res.end(req.method==='HEAD'?undefined:readFileSync(file));
 }catch{res.writeHead(404).end('Tidak ditemukan');}
});
server.listen(port,'127.0.0.1',()=>console.log(`NgekosAja: http://127.0.0.1:${port} (Connected + Demo; private project files blocked)`));
