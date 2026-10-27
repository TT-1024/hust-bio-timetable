import {env} from 'cloudflare:workers';
import {getReport,canViewAnalytics} from '../../../../lib/analytics.mjs';
export async function GET(request:Request){
  if(!canViewAnalytics(request,env.ANALYTICS_OWNER_EMAIL,env.ANALYTICS_VIEWER_EMAILS))return Response.json({error:'无权查看统计数据'},{status:403,headers:{'Cache-Control':'no-store'}});
  try {if(!env.DB)throw Error('Database unavailable');return Response.json(await getReport(env.DB),{headers:{'Cache-Control':'no-store'}})}
  catch(error){console.error('Analytics report error',error);return Response.json({error:'统计服务暂时不可用'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
