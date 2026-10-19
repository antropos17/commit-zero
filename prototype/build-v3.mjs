import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const files=['play.js','play.html','README.md'];
const sources=Object.fromEntries(files.map(name=>{const text=readFileSync(root+name,'utf8').replace(/\r\n/g,'\n');return [name,{text,size:(Buffer.byteLength(text)/1024).toFixed(1)}]}));
writeFileSync(root+'source-data.js','window.COMMIT_ZERO_SOURCES = '+JSON.stringify(sources).replace(/</g,'\\u003c')+';\n');
let page=readFileSync(root+'github.html','utf8');
for(const name of files) page=page.replace('{{size:'+name+'}}',sources[name].size+' КБ');
const bytes=[['JavaScript','js',['play.js','minimal.js','github.js']],['HTML','html',['play.html','github.html']],['CSS','css',['minimal.css','github.css']]].map(([label,id,names])=>({label,id,bytes:names.reduce((sum,n)=>sum+Buffer.byteLength(readFileSync(root+n)),0)}));
const total=bytes.reduce((sum,x)=>sum+x.bytes,0);
page=page.replace('{{languages}}',`<div class="lang-bar" aria-hidden="true">${bytes.map(x=>`<span class="lang-${x.id}" style="width:${x.bytes/total*100}%"></span>`).join('')}</div><div class="lang-legend">${bytes.map(x=>`<span><i class="lang-${x.id}"></i><b>${x.label}</b><em>${Math.round(x.bytes/total*100)}%</em></span>`).join('')}</div>`);
writeFileSync(root+'index.html',page);
const old=['agents','board','rules','reviews','agent-etalon','agent-odinfail','agent-bezslov','agent-kerning','agent-kontrast','agent-lom','agent-sloy','agent-snoska','agent-friday','agent-plus','project-orbit','project-stack','project-pulse'];
for(const name of old){const hash=name==='board'?'results':name==='rules'||name==='reviews'?'process':'games';writeFileSync(root+name+'.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=index.html#${hash}"><title>Commit Zero</title><a href="index.html#${hash}">Открыть Commit Zero</a></html>`)}
console.log('GitHub-style prototype built with actual source files.');
