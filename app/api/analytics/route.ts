import {env} from 'cloudflare:workers';
import {recordOpen} from '../../../lib/analytics.mjs';
const allowed=new Set(['https://tt-1024.github.io','https://hust-bio-2024-timetable.dragon-air.chatgpt.site']);
export async function POST(request:Request){
  const origin=request.headers.get('Origin');
  if(!origin||!allowed.has(origin))return new Response(null,{status:403});
  if(Number(request.headers.get('content-length')||0)>256)return new Response(null,{status:413});
  try{
    const body=await request.text();
    if(body.length>256||!env.DB||!await recordOpen(env.DB,body))return new Response(null,{status:400});
    return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'}});
  }catch(error){console.error('Analytics error',error);return new Response(null,{status:503})}
}
