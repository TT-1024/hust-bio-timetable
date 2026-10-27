import {env} from 'cloudflare:workers';
import {recordOpen,parseOpen} from '../../../lib/analytics.mjs';
const allowed=new Set(['https://tt-1024.github.io','https://hust-bio-2024-timetable.dragon-air.chatgpt.site']);
export async function POST(request:Request){
  const origin=request.headers.get('Origin');
  if(!origin||!allowed.has(origin))return new Response(null,{status:403});
  const headers={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'};
  if(Number(request.headers.get('content-length')||0)>256)return new Response(null,{status:413,headers});
  try{
    const body=await request.text();
    if(body.length>256)return new Response(null,{status:413,headers});
    const data=parseOpen(body);
    if(!data)return new Response(null,{status:400,headers});
    if(!env.DB)throw Error('Database unavailable');
    await recordOpen(env.DB,data.id,new Date(),data.event);
    return new Response(null,{status:204,headers});
  }catch(error){console.error('Analytics error',error);return new Response(null,{status:503,headers})}
}
