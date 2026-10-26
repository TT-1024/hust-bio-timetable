import {semesterSessions} from '../web/core.mjs';
const MAX_TEXT=8000;
const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const toNote=row=>row?{content:row.content,important:row.important,revision:row.revision,updatedAt:row.updated_at}:{content:'',important:'',revision:0,updatedAt:null};
export function createNotesHandler(schedule){
  const validIds=new Set([1,2,3,4].flatMap(c=>semesterSessions(schedule,c).map(s=>s.noteId)));
  return async function handle(request,db){
    if(!db)return response({error:'记录服务暂时不可用，请稍后重试。'},503);
    const url=new URL(request.url),id=url.searchParams.get('id');
    if(!validIds.has(id))return response({error:'未找到这节课程。'},404);
    if(request.method==='GET'){
      const row=await db.prepare('SELECT * FROM lesson_notes WHERE id = ?').bind(id).first();
      if(url.searchParams.get('history')==='1'){
        const history=await db.prepare('SELECT content, important, revision, updated_at FROM note_revisions WHERE note_id = ? ORDER BY revision DESC LIMIT 10').bind(id).all();
        return response({note:toNote(row),history:history.results.map(toNote)});
      }
      return response({note:toNote(row)});
    }
    if(request.method!=='PUT')return response({error:'不支持的操作。'},405);
    if(Number(request.headers.get('content-length'))>100000)return response({error:'记录太长，请精简后保存。'},413);
    const text=await request.text();if(text.length>50000)return response({error:'记录太长，请精简后保存。'},413);
    let body;try{body=JSON.parse(text)}catch{return response({error:'记录格式不正确。'},400)}
    if(!body||typeof body.content!=='string'||typeof body.important!=='string'||body.content.length>MAX_TEXT||body.important.length>MAX_TEXT||!Number.isInteger(body.revision)||body.revision<0)return response({error:'每个文本框最多8000字，请检查记录后重试。'},400);
    const ip=request.headers.get('cf-connecting-ip')||'local-preview';
    const day=new Date().toISOString().slice(0,10);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`lesson-note/${day}/${ip}`));
    const writerHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const recent=await db.prepare('SELECT COUNT(*) AS count FROM note_revisions WHERE writer_hash = ? AND updated_at > ?').bind(writerHash,new Date(Date.now()-600000).toISOString()).first();
    if(recent.count>=60)return response({error:'保存过于频繁，请稍后再试。你的输入仍保留在此设备。'},429);
    const now=new Date().toISOString(),changeId=crypto.randomUUID();
    await db.batch([
      db.prepare('INSERT INTO lesson_notes (id) VALUES (?) ON CONFLICT (id) DO NOTHING').bind(id),
      db.prepare('UPDATE lesson_notes SET content = ?, important = ?, revision = revision + 1, updated_at = ?, change_id = ? WHERE id = ? AND revision = ?').bind(body.content,body.important,now,changeId,id,body.revision),
      db.prepare('INSERT INTO note_revisions (id, note_id, content, important, revision, updated_at, writer_hash) SELECT change_id, id, content, important, revision, updated_at, ? FROM lesson_notes WHERE id = ? AND change_id = ?').bind(writerHash,id,changeId)
    ]);
    const saved=await db.prepare('SELECT * FROM lesson_notes WHERE id = ?').bind(id).first();
    // The history row establishes whether this save won, even if another edit followed immediately.
    const accepted=await db.prepare('SELECT content, important, revision, updated_at FROM note_revisions WHERE id = ?').bind(changeId).first();
    if(!accepted)return response({error:'有同学刚刚更新了这节课，请先查看最新记录再合并保存。',note:toNote(saved)},409);
    return response({note:toNote(accepted)});
  };
}
