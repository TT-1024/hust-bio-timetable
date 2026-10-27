export const ELECTIVES=Object.freeze([
  {id:'6',name:'生物材料学'},
  {id:'9',name:'生态学'},
  {id:'8',name:'表观遗传学'}
]);
export const ELECTIVE_STORAGE_KEY='bio-electives:2026-2027-1';
const electiveIds=new Set(ELECTIVES.map(c=>c.id));
export function readElectives(raw){
  try{
    const values=JSON.parse(raw);
    if(!Array.isArray(values)||values.some(id=>!electiveIds.has(id)))return ELECTIVES.map(c=>c.id);
    return [...new Set(values)];
  }catch{return ELECTIVES.map(c=>c.id)}
}
export function filterElectives(sessions,selected){
  const shown=new Set(selected);
  return sessions.filter(s=>!electiveIds.has(s.courseId)||shown.has(s.courseId));
}
