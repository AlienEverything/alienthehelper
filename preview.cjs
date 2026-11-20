"use strict";
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"dist");
const port=Number(process.argv[2]||4186);
if(!Number.isInteger(port)||port<1||port>65535)throw Error("Choose a port from 1 to 65535.");
const types={html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",
  svg:"image/svg+xml",png:"image/png",webp:"image/webp",ttf:"font/ttf",txt:"text/plain; charset=utf-8"};
const files=new Map();
function index(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())index(file);
    if(entry.isFile())files.set("/"+path.relative(root,file).split(path.sep).join("/"),file);
  }
}
index(root);
files.set("/",files.get("/index.html"));
const server=http.createServer((req,res)=>{
  if(req.method!=="GET" && req.method!=="HEAD"){res.writeHead(405,{Allow:"GET, HEAD"}).end();return;}
  let file;
  try{file=files.get(decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname));}catch{}
  if(!file){res.writeHead(404).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    res.writeHead(200,{"Content-Type":types[path.extname(file).slice(1)]||"application/octet-stream","Content-Length":data.length,"Cache-Control":"no-cache"});
    res.end(req.method==="HEAD"?undefined:data);
  });
});
server.on("error",error=>{
  console.error(error.code==="EADDRINUSE"?`Port ${port} is in use. Open the running preview or choose another port.`:error.message);
  process.exitCode=1;
});
server.listen(port,"127.0.0.1",()=>console.log(`Orbit Outpost is open at http://127.0.0.1:${port}/`));
