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
export function weekEntries(data,week,cls) {
  return data.entries.filter(e=>e.weeks.includes(week)&&e.classes.includes(cls)).sort((a,b)=>a.day-b.day||a.start-b.start);
}
export function weekBlocks(data,week,cls) {
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
export function label(entry) { return `${entry.name}（${entry.kind}）`; }
