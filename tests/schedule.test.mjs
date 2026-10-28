import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dateAt,currentWeek,weekEntries,weekBlocks,semesterSessions,lessonConflicts,label,clampWeek,shanghaiToday,normalizeExam} from '../web/core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../web/schedule.json',import.meta.url)));
test('alternative lessons compare overlapping periods on the same date, excluding the original lesson',()=>{
  const original={noteId:'original',week:3,day:1,start:3,end:4};
  const candidate={week:3,day:1,start:4,end:5};
  const sessions=[original,{noteId:'overlap',week:3,day:1,start:5,end:6},{noteId:'adjacent',week:3,day:1,start:6,end:7},{noteId:'other-day',week:3,day:2,start:4,end:5},{noteId:'other-week',week:4,day:1,start:4,end:5}];
  assert.deepEqual(lessonConflicts(candidate,sessions,original).map(s=>s.noteId),['overlap']);
  assert.deepEqual(lessonConflicts(candidate,[original],original),[]);
});
test('semester dates match both reference screenshots and all nine source exams',()=>{
  assert.equal(dateAt(data,9),'2026-10-26');assert.equal(dateAt(data,10),'2026-11-02');
  assert.equal(currentWeek(data,'2026-10-26'),9);assert.equal(currentWeek(data,'2027-01-03'),18);
  assert.equal(shanghaiToday(new Date('2026-10-25T16:01:00Z')),'2026-10-26');
  for(const e of data.exams){
    assert.equal(currentWeek(data,e.date),e.week);
    assert.equal((new Date(`${e.date}T00:00:00Z`).getUTCDay()+6)%7,e.day);
    const expected=e.time==='下午'?['14:30','17:00',5,8]:['19:00','21:30',9,12];
    assert.deepEqual([e.startTime,e.endTime,e.gridStart,e.gridEnd],expected);
  }
});
test('legacy cached exam data still has correct placement and time',()=>{
  for(const {day,startTime,endTime,gridStart,gridEnd,...legacy} of data.exams){
    assert.deepEqual(normalizeExam(legacy),{...legacy,day,startTime,endTime,gridStart,gridEnd});
  }
  assert.throws(()=>normalizeExam({date:'bad',time:'晚上'}));
  assert.throws(()=>normalizeExam({date:'2026-11-09',time:'未知'}));
});
test('combined courses go to all four classes; numbered and paired courses only to named classes',()=>{
  for(let w=1;w<=data.weekCount;w++)for(let c=1;c<=4;c++){
    const got=weekEntries(data,w,c);
    for(const entry of data.entries)assert.equal(got.includes(entry),entry.weeks.includes(w)&&entry.classes.includes(c));
  }
  const paired=data.entries.find(e=>e.id==='C21');assert.deepEqual(paired.classes,[1,2]);assert.equal(label(paired),'病毒学（小课）');
  const large=data.entries.find(e=>e.id==='C19');assert.deepEqual(large.classes,[1,2,3,4]);assert.equal(label(large),'解剖与生理学（大课）');
});
test('all occupied slots survive block merging; no source collisions in any class or week',()=>{
  for(let w=1;w<=data.weekCount;w++)for(let c=1;c<=4;c++){
    const slots=items=>items.flatMap(e=>Array.from({length:e.end-e.start+1},(_,i)=>`${e.day}/${e.start+i}/${e.courseId}/${e.building}/${e.room}`)).sort();
    const original=slots(weekEntries(data,w,c));assert.deepEqual(slots(weekBlocks(data,w,c)),original);
    const positions=original.map(s=>s.split('/').slice(0,2).join('/'));assert.equal(new Set(positions).size,positions.length);
  }
});
test('single-period ecology and alternating labs preserve exact source week/period limits',()=>{
  const eco=weekBlocks(data,10,1).find(e=>e.day===3&&e.name==='生态学');assert.equal(eco.start,9);assert.equal(eco.end,11);
  assert.equal(weekBlocks(data,11,1).find(e=>e.day===3&&e.name==='生态学').end,10);
  assert.ok(!weekBlocks(data,12,1).some(e=>e.name==='生态学'));
  assert.ok(weekEntries(data,17,3).some(e=>e.name==='解剖与生理学实验'));
  assert.ok(!weekEntries(data,17,1).some(e=>e.name==='解剖与生理学实验'));
});
test('rooms with letters and outdoor locations are preserved; source totals and teachers present',()=>{
  assert.equal(data.entries.length,176);assert.equal(data.courses.length,14);assert.equal(data.exams.length,9);
  assert.ok(data.entries.some(e=>e.building==='工程实践创新中心'&&e.room==='A201'));
  assert.ok(data.entries.some(e=>e.room==='F102'));assert.ok(data.entries.some(e=>e.building==='中心操场'&&e.room===''));
  for(const e of data.entries){assert.ok(e.teachers.length);assert.ok(e.sourceCell);assert.ok(e.name);assert.ok(e.building)}
});
test('week limits and empty end-of-semester grids',()=>{
  assert.equal(clampWeek(data,-3),1);assert.equal(clampWeek(data,99),19);assert.equal(clampWeek(data,'bad'),1);
  assert.equal(weekEntries(data,19,1).length,0);assert.equal(data.exams.filter(e=>e.week===19).length,3);
});
test('semester ordinals count merged blocks chronologically and reset for every course, kind and class',()=>{
  for(let cls=1;cls<=4;cls++){
    const counters=new Map();let time=-1;
    for(const b of semesterSessions(data,cls)){
      const moment=b.week*1000+b.day*20+b.start;assert.ok(moment>time);time=moment;
      const key=`${b.courseId}/${b.kind}`;const n=(counters.get(key)||0)+1;counters.set(key,n);
      assert.equal(b.ordinal,n);assert.equal(label(b),`${b.name}（第${n}节${b.kind}）`);
    }
  }
  const lessons=semesterSessions(data,1);
  const lab=lessons.find(b=>b.week===1&&b.name==='解剖与生理学实验');assert.equal(lab.end-lab.start+1,4);assert.equal(lab.ordinal,1);
  const anatomy=weekBlocks(data,9,1).find(b=>b.day===0&&b.name==='解剖与生理学');assert.equal(anatomy.ordinal,17);
  for(let c=2;c<=4;c++){const other=weekBlocks(data,9,c).find(b=>b.day===0&&b.name==='解剖与生理学');assert.equal(other.noteId,anatomy.noteId)}
  assert.notEqual(semesterSessions(data,1).find(b=>b.kind==='小课').noteId,semesterSessions(data,2).find(b=>b.kind==='小课').noteId);
});
