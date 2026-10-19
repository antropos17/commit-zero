import {copyFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
copyFileSync(root+'minimal.html',root+'index.html');
const old=['agents','board','rules','reviews','agent-etalon','agent-odinfail','agent-bezslov','agent-kerning','agent-kontrast','agent-lom','agent-sloy','agent-snoska','agent-friday','agent-plus','project-orbit','project-stack','project-pulse'];
for(const name of old){const hash=name==='board'?'results':name==='rules'||name==='reviews'?'process':'games';writeFileSync(root+name+'.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=index.html#${hash}"><title>Commit Zero</title><a href="index.html#${hash}">Открыть обновлённый Commit Zero</a></html>`)}
console.log('Minimal prototype rebuilt.');
