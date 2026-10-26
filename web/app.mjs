import {dateAt,shanghaiToday,currentWeek,clampWeek,weekBlocks,semesterSessions,kindLabel,label} from './core.mjs?v=3';
const $=s=>document.querySelector(s);
const palette={'1':'#697acb','2':'#79cf69','3':'#ee84c9','4':'#ef7eb5','5':'#35b59a','6':'#9381ca','7':'#58bf53','8':'#7586d5','9':'#06bfd5','10':'#05c0d0','11':'#fa9676','12':'#f19c89','13':'#65a4df','14':'#55c2bd'};
const weekdays=['一','二','三','四','五','六','日'];
let data,week,cls,blocks,agenda=false,touchStart=null,suppressClickUntil=0,toastTimer;
let activeLesson=null,noteRevision=0,noteLoaded=false,noteDirty=false,noteLoading=0,noteSaving=false;
const stored={get(key,fallback){try{return localStorage.getItem(key)??fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(key,value)}catch{}}};
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
const button=(text,fn,className='')=>{const b=el('button',className,text);b.addEventListener('click',fn);return b};
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2600)}
function syncURL(){const u=new URL(location.href);u.searchParams.set('class',cls);u.searchParams.set('week',week);u.searchParams.delete('lesson');history.replaceState({view:'timetable'},'',u)}
function leaveLesson(){noteLoading++;activeLesson=null;$('#lesson-page').hidden=true;noteLoaded=false;noteDirty=false}
function showHome(updateURL=true){
  leaveLesson();
  $('#sheet').close();$('#home').hidden=false;$('#timetable').hidden=true;
  if(updateURL){const u=new URL(location.href);u.searchParams.delete('class');u.searchParams.delete('week');u.searchParams.delete('lesson');history.pushState({view:'home'},'',u)}
  document.title='选择班级 · 生科课表';$('#announcement').textContent='请选择要查看的班级';
  $('#home-title').focus({preventScroll:true});
}
function enterClass(value,push=true){
  leaveLesson();
  cls=value;$('#home').hidden=true;$('#timetable').hidden=false;setAgenda(false);
  if(push)history.pushState({view:'timetable'},'',location.href);
  refresh();$('#main').focus({preventScroll:true});
}
function refresh(){
  blocks=weekBlocks(data,week,cls);syncURL();
  $('#today').textContent=shanghaiToday().replaceAll('-','/');
  $('#week-button').replaceChildren(document.createTextNode(`第 ${week} 周 `),el('span','tiny-chevron','⌄'));
  $('#class-button').replaceChildren(document.createTextNode(`${cls} 班 `),el('span','', '⌄'));
  $('#back-current').hidden=week===currentWeek(data)||currentWeek(data)<1||currentWeek(data)>data.weekCount;
  $('#previous').disabled=week===1;$('#next').disabled=week===data.weekCount;
  $('#day-header').replaceChildren(el('div','month',`${Number(dateAt(data,week).slice(5,7))}月`));
  for(let day=0;day<7;day++){
    const date=dateAt(data,week,day),n=el('div',`day${date===shanghaiToday()?' today':''}`);
    n.append(el('span','',weekdays[day]),el('b','',date.slice(8)==='01'?`${Number(date.slice(5,7))}/1`:String(Number(date.slice(8)))));
    $('#day-header').append(n);
  }
  $('#grid').replaceChildren();
  data.periods.forEach((times,i)=>{
    const line=el('div',`grid-line${[4,8].includes(i)?' break':''}`);line.style.gridRow=i+1;$('#grid').append(line);
    const t=el('div','time');t.style.gridArea=`${i+1} / 1`;t.append(el('div','',times[0]),el('div','',times[1]));$('#grid').append(t);
  });
  for(const b of blocks){
    const n=button('',()=>{if(Date.now()>suppressClickUntil)showCourse(b)},'course');
    n.style.gridColumn=b.day+2;n.style.gridRow=`${b.start} / ${b.end+1}`;n.style.setProperty('--color',palette[b.courseId]);
    n.setAttribute('aria-label',`星期${weekdays[b.day]} 第${b.start}至${b.end}节 ${label(b)} ${b.teachers.join('、')} ${b.building}${b.room}`);
    const name=el('div','course-name',b.name);name.append(el('span','kind',`（${kindLabel(b)}）`));
    const bottom=el('div','course-bottom'),teacher=el('span','teacher',b.teachers.join('、'));
    teacher.title=b.teachers.join('、');
    const loc=el('span','location',b.building);if(b.room)loc.append(el('span','room',b.room));bottom.append(teacher,loc);n.append(name,bottom);$('#grid').append(n);
  }
  if(!blocks.length){const empty=el('div','empty-note','本周没有排课');empty.append(el('p','',data.exams.some(e=>e.week===week)?'考试安排可在「工具箱」查看':'左右滑动，查看其他周次'));$('#grid').append(empty)}
  renderAgenda();
  $('#announcement').textContent=`${cls}班，第${week}周，${blocks.length}个课程时段`;
  document.title=`${cls}班 · 第${week}周 · 生科课表`;
}
function renderAgenda(){
  const view=$('#agenda-view');view.replaceChildren();
  for(let day=0;day<7;day++){
    view.append(el('h3','agenda-day',`星期${weekdays[day]} · ${dateAt(data,week,day).slice(5).replace('-','月')}日`));
    const courses=blocks.filter(b=>b.day===day);
    if(!courses.length)view.append(el('p','muted','今天没有排课'));
    for(const b of courses){
      const card=button('',()=>showCourse(b),'agenda-card');card.style.setProperty('--color',palette[b.courseId]);
      const time=el('div','agenda-time',data.periods[b.start-1][0]);time.append(el('div','',data.periods[b.end-1][1]));
      const info=el('div','agenda-info');info.append(el('strong','',label(b)),el('small','',b.teachers.join('、')),el('small','',b.building+' '+b.room));card.append(time,info);view.append(card);
    }
  }
}
function changeWeek(value){week=clampWeek(data,value);refresh();$('#main').scrollTop=0}
function openSheet(title){$('#sheet-title').textContent=title;$('#sheet-body').replaceChildren();if(!$('#sheet').open)$('#sheet').showModal();return $('#sheet-body')}
function showCourse(b){
  openLesson(b);
}
function lessonDetails(b){
  const dl=el('dl','detail-list');
  for(const [name,value] of [['日期',`${dateAt(data,b.week,b.day)} 星期${weekdays[b.day]}`],['节次',`第 ${b.start}–${b.end} 节 · ${data.periods[b.start-1][0]}–${data.periods[b.end-1][1]}`],['教师',b.teachers.join('、')],['教学楼',b.building],['教室',b.room||'室外场地']]){
    const row=el('div');row.append(el('dt','',name),el('dd','',value));dl.append(row);
  }
  return dl;
}
const notesOrigin=location.hostname.endsWith('.github.io')?'https://hust-bio-2024-timetable.dragon-air.chatgpt.site':location.origin;
function noteURL(id,history=false){const u=new URL('/api/notes',notesOrigin);u.searchParams.set('id',id);if(history)u.searchParams.set('history','1');return u}
function noteValues(){return {content:$('#note-content').value,important:$('#note-important').value}}
function keepDraft(){if(activeLesson&&noteLoaded)stored.set(`note-draft:${activeLesson.noteId}`,JSON.stringify({...noteValues(),revision:noteRevision}))}
function clearDraft(id){try{localStorage.removeItem(`note-draft:${id}`)}catch{}}
function noteStatus(text){$('#note-status').textContent=text}
function noteControls(){for(const id of ['#note-content','#note-important'])$(id).disabled=!noteLoaded||noteSaving;$('#note-save').disabled=!noteLoaded||!noteDirty||noteSaving;$('#note-reload').disabled=noteSaving;$('#note-history').disabled=!noteLoaded||noteSaving;$('#note-save').textContent=noteSaving?'正在保存…':'保存记录'}
function applyNote(note){noteRevision=note.revision;$('#note-content').value=note.content;$('#note-important').value=note.important;noteLoaded=true;noteDirty=false;$('#note-conflict').hidden=true;noteStatus(note.updatedAt?`最近更新 ${new Date(note.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})} · 第${note.revision}版`:'本节课还没有记录，欢迎写下第一条。');noteControls()}
function conflict(note){
  noteLoaded=true;noteDirty=true;$('#note-conflict').hidden=false;const panel=$('#note-conflict');panel.replaceChildren(el('strong','','有同学更新了记录，你的输入已保留。'),el('p','','请对照下面的最新内容，在上方合并后再保存。'));
  const latest=el('details');latest.append(el('summary','','查看云端最新内容'),el('h4','','上课内容'),el('pre','',note.content||'暂无记录'),el('h4','','重要信息'),el('pre','',note.important||'暂无记录'));panel.append(latest);
  panel.append(button('保留输入，继续合并',()=>{noteRevision=note.revision;panel.hidden=true;keepDraft();noteStatus('请在上方合并双方的信息，完成后点击保存。');noteControls()},'primary'),button('改用云端最新记录',()=>{clearDraft(activeLesson.noteId);applyNote(note)},'tool-action'));
  noteControls();$('#note-save').disabled=true;noteStatus('请先处理更新冲突，再保存。');
}
async function loadNote(){
  const b=activeLesson,requestId=++noteLoading;noteLoaded=false;noteDirty=false;$('#note-content').value='';$('#note-important').value='';$('#note-conflict').hidden=true;noteControls();noteStatus('正在读取共享记录…');
  try{const res=await fetch(noteURL(b.noteId),{cache:'no-store'});const result=await res.json();if(!res.ok)throw Error(result.error||'读取失败');if(requestId!==noteLoading)return;applyNote(result.note);
    let draft;try{draft=JSON.parse(stored.get(`note-draft:${b.noteId}`,'null'))}catch{}
    if(draft&&typeof draft.content==='string'&&typeof draft.important==='string'&&(draft.content!==result.note.content||draft.important!==result.note.important)){
      $('#note-content').value=draft.content;$('#note-important').value=draft.important;noteDirty=true;
      if(draft.revision!==result.note.revision)conflict(result.note);else{noteStatus('已恢复这台设备上未保存的草稿。');noteControls()}
    }
  }catch(error){if(requestId!==noteLoading)return;noteStatus(`暂时无法读取记录。${error.message||'请检查网络。'} 点击“重新读取”重试。`);noteControls()}
}
function openLesson(b,push=true){
  if(noteSaving){notify('正在保存，请稍等');return}
  activeLesson=b;$('#sheet').close();$('#home').hidden=true;$('#timetable').hidden=true;$('#lesson-page').hidden=false;
  $('#lesson-title').textContent=label(b);$('#lesson-group').textContent=b.kind==='大课'?'1–4班共同记录':`${b.cls}班课堂记录`;
  $('#lesson-meta').textContent=`第${b.week}周 · ${dateAt(data,b.week,b.day)} 星期${weekdays[b.day]} · 第${b.start}–${b.end}节`;
  $('#lesson-details-body').replaceChildren(lessonDetails(b),el('p','detail-footnote',data.teacherNote));
  const others=$('#other-classes');others.replaceChildren();
  if(b.kind==='小课'){
    others.append(el('span','','其他班的同序号小课'));
    const links=el('div');for(let c=1;c<=4;c++){const other=semesterSessions(data,c).find(s=>s.courseId===b.courseId&&s.kind===b.kind&&s.ordinal===b.ordinal);if(other){const btn=button(`${c}班`,()=>{cls=c;week=other.week;openLesson(other)},c===b.cls?'selected':'');btn.disabled=c===b.cls;links.append(btn)}}others.append(links,el('small','','同序号课程的实际授课进度可能不同。'));
  }
  const u=new URL(location.href);u.searchParams.set('class',b.cls);u.searchParams.set('week',b.week);u.searchParams.set('lesson',b.noteId);history[push?'pushState':'replaceState']({view:'lesson'},'',u);
  document.title=`${b.cls}班 · ${label(b)} · 课堂记录`;$('#lesson-title').focus({preventScroll:true});$('.lesson-main').scrollTop=0;loadNote();
}
async function saveNote(){
  if(!activeLesson||!noteLoaded||!noteDirty||noteSaving)return;
  const id=activeLesson.noteId;keepDraft();noteSaving=true;noteControls();noteStatus('正在保存到云端…');
  try{const res=await fetch(noteURL(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...noteValues(),revision:noteRevision})});const result=await res.json();noteSaving=false;
    if(!activeLesson||activeLesson.noteId!==id)return;
    if(res.status===409){conflict(result.note);return}if(!res.ok)throw Error(result.error||'保存失败');clearDraft(id);applyNote(result.note);noteStatus('已保存到云端，其他同学现在可以查看。');notify('记录已保存');
  }catch(error){noteSaving=false;noteStatus(`未能保存：${error.message}。输入已保留，请重试。`);noteControls()}
}
async function showNoteHistory(){
  const b=activeLesson,body=openSheet('历史版本');body.append(el('p','muted','正在读取…'));
  try{const res=await fetch(noteURL(b.noteId,true),{cache:'no-store'});const result=await res.json();if(!res.ok)throw Error(result.error);if(activeLesson?.noteId!==b.noteId||!$('#sheet').open)return;body.replaceChildren();
    if(!result.history.length)body.append(el('p','muted','还没有已保存的记录。'));
    for(const item of result.history){const details=el('details','history-item');details.append(el('summary','',`第${item.revision}版 · ${new Date(item.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`),el('h4','','上课内容'),el('pre','',item.content||'暂无记录'),el('h4','','重要信息'),el('pre','',item.important||'暂无记录'));body.append(details)}
    body.append(el('p','muted','显示最近10个版本，可复制历史内容后重新编辑。'));
  }catch(error){body.replaceChildren(el('p','muted',`历史记录读取失败：${error.message}`))}
}
function routeFromURL(){const p=new URL(location.href).searchParams,c=Number(p.get('class'));week=clampWeek(data,p.get('week')||currentWeek(data));$('#sheet').close();if(![1,2,3,4].includes(c)){showHome(false);return}cls=c;const b=semesterSessions(data,c).find(b=>b.noteId===p.get('lesson'));if(b)openLesson(b,false);else enterClass(c,false)}
function showClasses(){
  const body=openSheet('切换班级');body.append(el('p','muted','生物科学（中外合作办学）· 2024级'));
  const grid=el('div','class-options');
  for(let c=1;c<=4;c++){const b=button(`${c} 班${cls===c?' ✓':''}`,()=>{cls=c;refresh();$('#sheet').close()},`class-option${cls===c?' selected':''}`);b.setAttribute('aria-pressed',String(cls===c));b.append(el('small','',`20240${c} · 大课 + 本班小课`));grid.append(b)}
  body.append(grid,el('p','muted','也可以点击底部「班级」返回首页重新选择。'));
}
function showWeeks(){
  const body=openSheet('选择周次'),grid=el('div','week-options');
  for(let w=1;w<=data.weekCount;w++){const b=button(`第 ${w} 周`,()=>{changeWeek(w);$('#sheet').close()},`week-option${week===w?' selected':''}`);b.setAttribute('aria-pressed',String(week===w));b.append(el('small','',dateAt(data,w).slice(5).replace('-','/')));grid.append(b)}
  body.append(grid,el('p','muted','第1周从2026年8月31日开始。'));
}
function toolAction(body,title,subtitle,fn){const b=button(title,fn,'tool-action');b.append(el('span','','›'));if(subtitle)b.append(el('small','',subtitle));body.append(b)}
function showTools(){const body=openSheet('工具箱');toolAction(body,'跳转周次','查看第1–19周',showWeeks);toolAction(body,'分享当前课表',`${cls}班 · 第${week}周`,share);toolAction(body,'考试安排','原课表中的9门考试',showExams);toolAction(body,'课表说明','课程类型、教师与时间来源',showInfo)}
function showExams(){const body=openSheet('考试安排');for(const e of [...data.exams].sort((a,b)=>a.date.localeCompare(b.date))){const n=el('div','exam-item');n.append(el('strong','',e.name),el('small','',`第${e.week}周 · ${e.date} ${e.time}`));body.append(n)}body.append(el('p','detail-footnote','原课表未提供考试教室和精确起止时间，请以正式考试通知为准。其他课程考核方式为考查。'))}
function showInfo(){const body=openSheet('课表说明');for(const p of ['华中科技大学 · 生物科学（中外合作办学）202401–202404班，2026–2027学年第一学期。','数据来自你提供的《01课表.xlsx》，按照原表周次展示，不自动跳过节假日。','“合”标为（大课），含指定班号的课程标为（小课）；F/C不参与班级筛选。两个班一起上的小课会同时显示在对应班级。',data.teacherNote,'周次起点为2026年8月31日，与原表考试日期及参考截图一致。'+data.timeSource,'课程块显示课程名称、大小课、教师及地点。过长的教师名单会省略显示，点按课程查看完整内容。'])body.append(el('p','',p))}
function showMine(){const body=openSheet('我的课表');body.append(el('p','muted',`已选择 20240${cls} 班`));toolAction(body,'切换班级','设置只保存在这台设备',showClasses);const row=el('label','settings-row','放大课程文字');const check=el('input');check.type='checkbox';check.checked=document.documentElement.classList.contains('large-text');check.addEventListener('change',()=>{document.documentElement.classList.toggle('large-text',check.checked);stored.set('bio-large',check.checked?'1':'0')});row.append(check);body.append(row);toolAction(body,'添加到手机主屏幕','iPhone：分享 → 添加到主屏幕',()=>{const b=openSheet('添加到主屏幕');b.append(el('p','','iPhone：在 Safari 打开此网站，点击分享按钮，选择“添加到主屏幕”。'),el('p','','Android：在浏览器菜单中选择“添加到主屏幕”或“安装应用”。'))});toolAction(body,'关于课表','2026–2027学年第一学期',showInfo)}
async function share(){
  const url=location.href;
  try{if(navigator.share){await navigator.share({title:`生科${cls}班 第${week}周课表`,url});return}if(navigator.clipboard){await navigator.clipboard.writeText(url);notify('链接已复制，可以发给同学');return}}catch(e){if(e.name==='AbortError')return}
  const body=openSheet('分享课表');body.append(el('p','muted','复制下方链接发送给同学，会保留班级和周次。'));const input=el('input','share-link');input.readOnly=true;input.value=url;input.setAttribute('aria-label','课表分享链接');body.append(input);input.addEventListener('focus',()=>input.select());
}
function setAgenda(value){agenda=value;$('#schedule-view').hidden=agenda;$('#agenda-view').hidden=!agenda;$('#agenda-button').textContent=agenda?'周表':'日程';$('#main').scrollTop=0}
async function init(){
  try{const res=await fetch('./schedule.json');if(!res.ok)throw Error();data=await res.json()}catch{$('#home-status').replaceChildren(document.createTextNode('课表加载失败，请检查网络后重试。'),button('重新加载',()=>location.reload(),'primary'));return}
  const params=new URL(location.href).searchParams;
  cls=Number(params.get('class'));if(![1,2,3,4].includes(cls))cls=null;
  week=clampWeek(data,params.get('week')||currentWeek(data));
  document.querySelectorAll('.home-class').forEach(b=>{b.disabled=false;b.onclick=()=>enterClass(Number(b.dataset.class))});
  $('#home-status').textContent='四个班均可查看 · 进入课表后可左右翻周';
  if(stored.get('bio-large','0')==='1')document.documentElement.classList.add('large-text');
  $('#previous').onclick=()=>changeWeek(week-1);$('#next').onclick=()=>changeWeek(week+1);$('#back-current').onclick=()=>changeWeek(currentWeek(data));
  $('#week-button').onclick=showWeeks;$('#class-button').onclick=showClasses;$('#agenda-button').onclick=()=>setAgenda(!agenda);
  $('#nav-schedule').onclick=()=>{setAgenda(false);$('#sheet').close()};$('#nav-class').onclick=()=>showHome();$('#nav-tools').onclick=showTools;$('#nav-mine').onclick=showMine;
  $('#close-sheet').onclick=()=>$('#sheet').close();$('#sheet').onclick=e=>{const r=$('#sheet').getBoundingClientRect();if(e.target===$('#sheet')&&(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right))$('#sheet').close()};
  $('#schedule-view').addEventListener('touchstart',e=>{touchStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
  $('#schedule-view').addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){suppressClickUntil=Date.now()+500;changeWeek(week+(dx<0?1:-1))}},{passive:true});
  $('#schedule-view').addEventListener('touchcancel',()=>{touchStart=null},{passive:true});
  $('#lesson-back').onclick=()=>{if(noteSaving){notify('正在保存，请稍等');return}const b=activeLesson;const u=new URL(location.href);u.searchParams.delete('lesson');history.pushState({view:'timetable'},'',u);week=b.week;enterClass(b.cls,false)};
  $('#note-save').onclick=saveNote;$('#note-reload').onclick=loadNote;$('#note-history').onclick=showNoteHistory;
  for(const field of ['#note-content','#note-important'])$(field).addEventListener('input',()=>{noteDirty=true;keepDraft();noteStatus('有未保存的修改，请点击“保存记录”同步给同学。');noteControls();if(!$('#note-conflict').hidden)$('#note-save').disabled=true});
  window.addEventListener('beforeunload',e=>{if(noteDirty||noteSaving){e.preventDefault();e.returnValue=''}});
  document.addEventListener('keydown',e=>{if(!$('#home').hidden||!$('#lesson-page').hidden||$('#sheet').open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();changeWeek(week-1)}if(e.key==='ArrowRight'){e.preventDefault();changeWeek(week+1)}});
  window.addEventListener('popstate',routeFromURL);
  routeFromURL();
}
init();
