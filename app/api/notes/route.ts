import {env} from 'cloudflare:workers';
import schedule from '../../../web/schedule.json';
import {createNotesHandler} from '../../../lib/notes-api.mjs';
const handle=createNotesHandler(schedule);
const allowed=new Set(['https://tt-1024.github.io','https://hust-bio-2024-timetable.dragon-air.chatgpt.site']);
async function route(request:Request){
  const origin=request.headers.get('Origin');
  const own=new URL(request.url).origin;
  if(origin&&origin!==own&&!allowed.has(origin))return Response.json({error:'请从课表网站保存记录。'},{status:403});
  let res:Response;
  if(request.method==='OPTIONS')res=new Response(null,{status:204});
  else try{res=await handle(request,env.DB)}catch(error){console.error('Notes request failed',error);res=Response.json({error:'记录服务暂时不可用，请稍后重试。'},{status:503})}
  const headers=new Headers(res.headers);headers.set('Cache-Control','no-store');headers.set('Vary','Origin');
  if(origin&&allowed.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET, PUT, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type')}
  return new Response(res.body,{status:res.status,headers});
}
export const GET=route;export const PUT=route;export const OPTIONS=route;
