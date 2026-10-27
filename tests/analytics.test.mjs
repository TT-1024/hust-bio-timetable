import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {recordOpen,getReport,canViewAnalytics,shanghaiDay,parseOpen} from '../lib/analytics.mjs';
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of ['0001_tough_wolfsbane.sql','0002_square_franklin_richards.sql'])sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(sql){const stmt=sqlite.prepare(sql);return {bind(...args){return {run:()=>stmt.run(...args),all:async()=>({results:stmt.all(...args)})}}}},async batch(items){sqlite.exec('BEGIN');try{const result=items.map(item=>item.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 return {sqlite,db};
}
test('counts opens and daily distinct devices across the Beijing day boundary',async()=>{const {db,sqlite}=setup();const a='12345678-1234-4123-8123-123456789012',b='22345678-1234-4123-8123-123456789012';const before=new Date('2026-10-26T15:59:59Z'),after=new Date('2026-10-26T16:00:00Z');assert.equal(shanghaiDay(before),'2026-10-26');assert.equal(shanghaiDay(after),'2026-10-27');await recordOpen(db,a,before);await recordOpen(db,a,after);await recordOpen(db,a,after);await recordOpen(db,b,after);assert.equal(await recordOpen(db,'invalid',after),false);const report=await getReport(db,after);assert.deepEqual({...report.days.at(-1)},{day:'2026-10-27',visitors:2,opens:3});assert.equal(report.average,4/30);assert.equal(report.days.length,30);const rows=sqlite.prepare('SELECT visitor FROM analytics_daily_visitors WHERE opens > 0').all();assert.equal(new Set(rows.map(x=>x.visitor)).size,3);sqlite.close()});
test('report authorization requires both signed-in identity and matching owner',()=>{const req=(headers)=>new Request('https://example.com',{headers});assert.equal(canViewAnalytics(req({'oai-authenticated-user-email':'owner@example.com'}),'owner@example.com'),false);assert.equal(canViewAnalytics(req({'oai-authenticated-user-id':'id','oai-authenticated-user-email':'other@example.com'}),'owner@example.com'),false);assert.equal(canViewAnalytics(req({'oai-authenticated-user-id':'id','oai-authenticated-user-email':'OWNER@example.com'}),'owner@example.com'),true);assert.equal(canViewAnalytics(req({'oai-authenticated-user-id':'id','oai-authenticated-user-email':'owner@example.com'}),undefined),false)});

test('configured viewers can read reports while anonymous and unrelated accounts remain blocked',()=>{
 const req=(email,id='signed-in-id')=>new Request('https://example.com',{headers:{'oai-authenticated-user-email':email,...(id?{'oai-authenticated-user-id':id}:{})}});
 const owner='owner@example.com',viewers=' viewer@example.com, second@example.com ';
 assert.equal(canViewAnalytics(req('VIEWER@example.com'),owner,viewers),true);
 assert.equal(canViewAnalytics(req('second@example.com'),owner,viewers),true);
 assert.equal(canViewAnalytics(req(owner),owner,viewers),true);
 assert.equal(canViewAnalytics(req('viewer@example.com',''),owner,viewers),false);
 assert.equal(canViewAnalytics(req('other@example.com'),owner,viewers),false);
 assert.equal(canViewAnalytics(req('viewer@example.com.attacker.test'),owner,viewers),false);
});

test('retry, beacon and midnight delivery of one event count only once, while new page loads still count',async()=>{
 const {db,sqlite}=setup();
 const device='12345678-1234-4123-8123-123456789012',event='22345678-1234-4123-8123-123456789012';
 const before=new Date('2026-10-26T15:59:59Z'),after=new Date('2026-10-26T16:00:00Z');
 await Promise.all(Array.from({length:5},()=>recordOpen(db,device,before,event)));
 await recordOpen(db,device,after,event);
 await recordOpen(db,device,after,'32345678-1234-4123-8123-123456789012');
 const report=await getReport(db,after);
 assert.equal(report.days.at(-2).opens,1);assert.equal(report.days.at(-1).opens,1);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM analytics_open_events').get().count,2);
 sqlite.close();
});
test('cached clients remain valid, malformed or missing IDs are rejected',()=>{
 const id='12345678-1234-4123-8123-123456789012',event='22345678-1234-4123-8123-123456789012';
 assert.deepEqual(parseOpen(id),{id});assert.deepEqual(parseOpen(JSON.stringify({id,event})),{id,event});
 for(const body of ['null','{}','broken',JSON.stringify({id,event:'invalid'}),JSON.stringify({id})])assert.equal(parseOpen(body),null);
});
