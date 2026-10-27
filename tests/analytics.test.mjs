import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {recordOpen,getReport,canViewAnalytics,shanghaiDay} from '../lib/analytics.mjs';
function setup(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../drizzle/0001_tough_wolfsbane.sql',import.meta.url),'utf8'));return {sqlite,db:{prepare(sql){const stmt=sqlite.prepare(sql);return {bind(...args){return {run:async()=>stmt.run(...args),all:async()=>({results:stmt.all(...args)})}}}}}}}
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
