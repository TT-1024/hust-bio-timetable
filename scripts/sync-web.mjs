import {cp,mkdir,readdir} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of await readdir('web'))if(file!=='index.html')await cp(`web/${file}`,`public/${file}`);
