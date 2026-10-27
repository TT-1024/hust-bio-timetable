export const ELECTIVES=Object.freeze([
  {id:'6',name:'生物材料学'},
  {id:'9',name:'生态学'},
  {id:'8',name:'表观遗传学'},
  {id:'7',name:'生物统计学'}
]);
export const LEGACY_ELECTIVE_STORAGE_KEY='bio-electives:2026-2027-1';
export const ELECTIVE_STORAGE_KEY='bio-electives:2026-2027-1:v2';
const electiveIds=new Set(ELECTIVES.map(c=>c.id));
export function readElectives(raw,legacy=null){
  try{
    const migrating=raw===null&&legacy!==null;
    const values=JSON.parse(migrating?legacy:raw);
    if(!Array.isArray(values)||values.some(id=>!electiveIds.has(id)))return ELECTIVES.map(c=>c.id);
    return [...new Set(migrating?[...values,'7']:values)];
  }catch{return ELECTIVES.map(c=>c.id)}
}
export function filterElectives(sessions,selected){
  const shown=new Set(selected);
  return sessions.filter(s=>!electiveIds.has(s.courseId)||shown.has(s.courseId));
}
