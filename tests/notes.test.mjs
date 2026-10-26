import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createNotesHandler} from '../lib/notes-api.mjs';
import {semesterSessions} from '../web/core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../web/schedule.json',import.meta.url)));
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../drizzle/0000_absent_thunderbolts.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const stmt=sqlite.prepare(sql);return{bind(...args){return{first:async()=>stmt.get(...args)??null,all:async()=>({results:stmt.all(...args)}),run:()=>stmt.run(...args)}}}},async batch(items){sqlite.exec('BEGIN');try{const r=items.map(i=>i.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const handler=createNotesHandler(data),id=semesterSessions(data,4).find(s=>s.kind==='小课').noteId;
 const call=(body,query=id)=>handler(new Request(`https://test.invalid/api/notes?id=${query}`,body?{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),db);
 return {call,id,sqlite};
}
test('shared notes persist both boxes and reject stale simultaneous edits without losing history',async()=>{
 const {call,id,sqlite}=setup();assert.equal((await (await call()).json()).note.revision,0);
 const initial={content:'知识点 A\n实验步骤 B',important:'周五前提交报告',revision:0};let r=await call(initial);assert.equal(r.status,200);assert.equal((await r.json()).note.revision,1);
 r=await call({content:'旧页面的新输入',important:'不可覆盖',revision:0});assert.equal(r.status,409);assert.equal((await r.json()).note.content,initial.content);
 r=await call({content:initial.content+'\n另一位同学补充',important:initial.important,revision:1});assert.equal(r.status,200);
 const history=await (await call(null,id+'&history=1')).json();assert.equal(history.history.length,2);assert.equal(history.history[1].content,initial.content);
 sqlite.close();
});
test('notes validate real sessions, input limits and version types',async()=>{
 const {call,sqlite}=setup();assert.equal((await call(null,'made-up-session')).status,404);
 assert.equal((await call({content:'x'.repeat(8001),important:'',revision:0})).status,400);
 assert.equal((await call({content:'',important:'',revision:'0'})).status,400);
 const r=await call({content:'<script>alert(1)</script>',important:'',revision:0});assert.equal(r.status,200);assert.equal((await r.json()).note.content,'<script>alert(1)</script>');sqlite.close();
});
