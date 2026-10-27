export const shanghaiDay = (date = new Date()) => new Date(date.getTime() + 8 * 3600000).toISOString().slice(0,10);
export async function dailyId(day,id){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${day}:${id}`));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function parseOpen(body){
  if(validId(body))return {id:body}; // Compatibility with pages cached before event IDs.
  try { const data=JSON.parse(body);return data && validId(data.id) && validId(data.event) ? {id:data.id,event:data.event} : null; }
  catch { return null; }
}
export async function recordOpen(db, id, date = new Date(), event){
  if(!validId(id) || (event !== undefined && !validId(event)))return false;
  const day=shanghaiDay(date), visitor=await dailyId(day,id);
  if(event === undefined){
    await db.prepare('INSERT INTO analytics_daily_visitors (day, visitor, opens) VALUES (?, ?, 1) ON CONFLICT(day, visitor) DO UPDATE SET opens = opens + 1').bind(day,visitor).run();
  } else {
    const eventHash=await dailyId('open',event);
    // D1 batch is one transaction: check, count and remember the event atomically.
    await db.batch([
      db.prepare('INSERT INTO analytics_daily_visitors (day, visitor, opens) SELECT ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM analytics_open_events WHERE id = ?) ON CONFLICT(day, visitor) DO UPDATE SET opens = opens + 1').bind(day,visitor,eventHash),
      db.prepare('INSERT INTO analytics_open_events (id) VALUES (?) ON CONFLICT(id) DO NOTHING').bind(eventHash)
    ]);
  }
  return true;
}
export async function getReport(db, date = new Date()){
  const today=shanghaiDay(date), start=new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate()-29);
  const from=start.toISOString().slice(0,10);
  const result=await db.prepare('SELECT day, COUNT(*) AS visitors, SUM(opens) AS opens FROM analytics_daily_visitors WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day').bind(from,today).all();
  const byDay=new Map(result.results.map(row=>[row.day,row]));
  const days=Array.from({length:30},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);const day=d.toISOString().slice(0,10);return byDay.get(day)||{day,visitors:0,opens:0}});
  return {days,average:days.reduce((sum,row)=>sum+Number(row.opens),0)/30};
}
export function canViewAnalytics(request, owner, viewers = ''){
  if(!request.headers.get('oai-authenticated-user-id'))return false;
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if(!email)return false;
  const allowed=[owner||'',...viewers.split(',')].map(value=>value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email);
}
