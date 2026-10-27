import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ELECTIVES,readElectives,filterElectives} from '../web/preferences.mjs';
import {semesterSessions} from '../web/core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../web/schedule.json',import.meta.url)));
test('new or malformed preferences show all; an intentionally empty choice stays empty',()=>{
  const all=ELECTIVES.map(c=>c.id);
  for(const value of [null,'bad JSON','{}','[6]','["unknown"]'])assert.deepEqual(readElectives(value),all);
  assert.deepEqual(readElectives('[]'),[]);assert.deepEqual(readElectives('["9","9"]'),['9']);
  assert.deepEqual(readElectives(null,'["9"]'),['9','7']);
  assert.deepEqual(readElectives(null,'[]'),['7']);
  assert.deepEqual(readElectives('[]','["9"]'),[]);
  for(const course of ELECTIVES)assert.equal(data.courses.find(c=>c.id===course.id).name,course.name);
});
test('every elective combination hides only unselected electives while preserving lesson ordinals and shared record keys',()=>{
  for(let cls=1;cls<=4;cls++){
    const sessions=semesterSessions(data,cls),required=sessions.filter(s=>!ELECTIVES.some(c=>c.id===s.courseId));
    for(let mask=0;mask<(1<<ELECTIVES.length);mask++){
      const selected=ELECTIVES.filter((_,i)=>mask&(1<<i)).map(c=>c.id),visible=filterElectives(sessions,selected);
      for(const lesson of required)assert.ok(visible.includes(lesson));
      for(const lesson of sessions){const elective=ELECTIVES.some(c=>c.id===lesson.courseId);assert.equal(visible.includes(lesson),!elective||selected.includes(lesson.courseId));}
      for(const lesson of visible){const original=sessions.find(s=>s.noteId===lesson.noteId);assert.equal(lesson.ordinal,original.ordinal);assert.equal(lesson.noteId,original.noteId);}
    }
    assert.deepEqual(filterElectives(sessions,[]),required);
    assert.equal(filterElectives(sessions,['9']).filter(s=>ELECTIVES.some(c=>c.id===s.courseId)).every(s=>s.name==='生态学'),true);
  }
});
