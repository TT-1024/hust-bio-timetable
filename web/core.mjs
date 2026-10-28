export function dateAt(data, week, day=0) {
  const d=new Date(`${data.semesterStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate()+(week-1)*7+day);
  return d.toISOString().slice(0,10);
}
export function shanghaiToday(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function currentWeek(data,today=shanghaiToday()) {
  return Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(data.semesterStart+'T00:00:00Z'))/604800000)+1;
}
export function clampWeek(data,week) { return Math.max(1,Math.min(data.weekCount,Number.isFinite(Number(week))?Math.floor(Number(week)):1)); }
export function normalizeExam(exam) {
  const date = new Date(`${exam.date}T00:00:00Z`);
  const day = (date.getUTCDay()+6)%7;
  const slot = exam.time==='下午'
    ? {startTime:'14:30',endTime:'17:00',gridStart:5,gridEnd:8}
    : exam.time==='晚上'
      ? {startTime:'19:00',endTime:'21:30',gridStart:9,gridEnd:12}
      : null;
  if (!Number.isFinite(day) || !slot) throw new Error('Invalid exam schedule');
  return {...exam,...slot,day};
}
export function weekEntries(data,week,cls) {
  return data.entries.filter(e=>e.weeks.includes(week)&&e.classes.includes(cls)).sort((a,b)=>a.day-b.day||a.start-b.start);
}
function rawWeekBlocks(data,week,cls) {
  const result=[];
  for (const entry of weekEntries(data,week,cls)) {
    const prev=result.at(-1);
    if(prev&&prev.day===entry.day&&prev.end+1===entry.start&&![5,9].includes(entry.start)&&
       prev.courseId===entry.courseId&&prev.building===entry.building&&prev.room===entry.room&&prev.kind===entry.kind) {
      prev.end=entry.end;prev.sourceCells.push(entry.sourceCell);
    } else result.push({...entry,sourceCells:[entry.sourceCell]});
  }
  return result;
}
const sessionCache=new WeakMap();
export function semesterSessions(data,cls){
  if(!sessionCache.has(data))sessionCache.set(data,new Map());
  const cache=sessionCache.get(data);if(cache.has(cls))return cache.get(cls);
  const sessions=[],counts=new Map();
  for(let week=1;week<=data.weekCount;week++)for(const b of rawWeekBlocks(data,week,cls)){
    const counter=`${b.courseId}/${b.kind}`,ordinal=(counts.get(counter)||0)+1;counts.set(counter,ordinal);
    sessions.push({...b,week,cls,ordinal,noteId:`2026a-${b.kind==='大课'?'all':`c${cls}`}-s${b.courseId}-w${week}-d${b.day}-p${b.start}`});
  }
  cache.set(cls,sessions);return sessions;
}
export function weekBlocks(data,week,cls){return semesterSessions(data,cls).filter(b=>b.week===week)}
export function lessonConflicts(candidate,ownSessions,original){
  return ownSessions.filter(s=>s.noteId!==original.noteId&&s.week===candidate.week&&s.day===candidate.day&&s.start<=candidate.end&&candidate.start<=s.end);
}
export function kindLabel(entry){return entry.ordinal?`第${entry.ordinal}节${entry.kind}`:entry.kind}
export function label(entry) { return `${entry.name}（${kindLabel(entry)}）`; }
