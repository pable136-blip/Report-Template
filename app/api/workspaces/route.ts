import {SAMPLE_WORKSPACE} from '../../../lib/sample-workspace';
import {legacyWorkspace} from '../../../lib/legacy-workspace';
import {database} from '../../../db/raw';
import {ApiError,apiError,currentSessionHash,digest,endSession,noStore,normalizeCode,passwordHash,randomToken,requireOrigin,requireWorkspace,requireCoordinator,workspaceAccess,sameHash,sessionCookie} from '../../../lib/workspace-auth';
const defaults=['행정 업무 혁신','시민 서비스','교육·인재 양성','도시·산업 혁신','기타'];
type Workspace={id:string;department:string;title:string;password_hash:string;salt:string;failures:number;locked_until:number;pin_length:number;coordinator_hash:string|null};
export async function GET(request:Request){try{
 const url=new URL(request.url);
 if(url.searchParams.get('list')==='1'){
  const q=(url.searchParams.get('q')||'').trim().slice(0,100);const pattern='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';
  const result=await database().prepare("SELECT id,department,title,created,pin_length AS pinLength,coordinator_hash IS NULL AS needsCoordinatorSetup FROM report_workspaces WHERE deleted_at IS NULL AND id!=? AND (department LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' ) ORDER BY created DESC LIMIT 101").bind(SAMPLE_WORKSPACE,pattern,pattern).all();
  const rows=result.results.slice(0,100);const legacy=await database().prepare('SELECT id FROM report_workspaces WHERE id=?').bind(legacyWorkspace.id).first();
  if(!legacy&&(legacyWorkspace.department+' '+legacyWorkspace.title).includes(q)){const hasOld=await database().prepare('SELECT id FROM projects WHERE workspace_id IS NULL LIMIT 1').first();if(hasOld)rows.unshift({id:legacyWorkspace.id,department:legacyWorkspace.department,title:legacyWorkspace.title,created:'',pinLength:4,needsCoordinatorSetup:1});}
  const selected=normalizeCode(url.searchParams.get('selected')||'');
  if(selected&&!rows.some(row=>row.id===selected)){
   const row=await database().prepare('SELECT id,department,title,created,pin_length AS pinLength,coordinator_hash IS NULL AS needsCoordinatorSetup FROM report_workspaces WHERE id=? AND deleted_at IS NULL').bind(selected).first();if(row)rows.unshift(row);
  }
  return Response.json({items:rows,hasMore:result.results.length>100},{headers:noStore});
 }
 const access=await workspaceAccess(request);const row=await database().prepare('SELECT id,department,title,pin_length AS pinLength FROM report_workspaces WHERE id=?').bind(access.code).first();if(!row)throw new ApiError(404,'보고서가 없습니다.');const coordinatorKey=access.role==='coordinator'&&!access.administrator?await initializeCoordinatorKey(access.code):undefined;return Response.json({...row,administrator:access.administrator,role:access.role,sessionDepartment:access.department,sessionToken:access.token,...(coordinatorKey?{coordinatorKey}:{})},{headers:{...noStore,'Set-Cookie':sessionCookie(access.code,access.token)}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 requireOrigin(request);const b=await request.json() as Record<string,unknown>;const db=database();
 if(b.action!=='create'&&b.action!=='open')throw new ApiError(400,'올바른 작업을 선택해 주세요.');
 if(typeof b.password!=='string'||b.password.length>128)throw new ApiError(400,'수정 비밀번호를 확인해 주세요.');
 let code:string;let role:'coordinator'|'department'|'viewer'='coordinator';let sessionDepartment='';let coordinatorKey:string|undefined;
 if(b.action==='create'){
  if(b.password!==''&&!/^[0-9]{4}$/.test(b.password))throw new ApiError(400,'수정 비밀번호는 숫자 4자리로 입력해 주세요.');
  if(typeof b.department!=='string'||!b.department.trim()||b.department.length>80||typeof b.title!=='string'||!b.title.trim()||b.title.length>40)throw new ApiError(400,'부서명(80자 이내)과 보고서명(40자 이내)을 입력해 주세요.');
  sessionDepartment=b.department.trim();coordinatorKey=randomToken();
  code=crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase();const salt=b.password?randomToken():'';const hash=b.password?await passwordHash(b.password,salt):'';const now=new Date().toISOString();
  await db.batch([
   db.prepare('INSERT INTO report_workspaces (id,department,title,password_hash,salt,created,pin_length,coordinator_hash) VALUES (?,?,?,?,?,?,?,?)').bind(code,b.department.trim(),b.title.trim(),hash,salt,now,b.password?4:-1,await digest(coordinatorKey)),
   db.prepare('INSERT INTO report_settings (id,workspace_id,key,value) VALUES (?,?,?,?)').bind(code+':workName',code,'workName',b.title.trim()),
   db.prepare('INSERT INTO report_settings (id,workspace_id,key,value) VALUES (?,?,?,?)').bind(code+':fields',code,'fields',JSON.stringify(defaults))
  ]);
 }else{
  code=normalizeCode(typeof b.code==='string'?b.code:'');if(!/^[A-Z0-9]{12}$/.test(code))throw new ApiError(400,'보고서를 선택해 주세요.');
  let row=await db.prepare('SELECT * FROM report_workspaces WHERE id=? AND deleted_at IS NULL').bind(code).first<Workspace>();
  if(!row&&code===legacyWorkspace.id){
   await db.prepare('INSERT OR IGNORE INTO report_workspaces (id,department,title,password_hash,salt,created,pin_length) VALUES (?,?,?,?,?,?,4)').bind(code,legacyWorkspace.department,legacyWorkspace.title,legacyWorkspace.passwordHash,legacyWorkspace.salt,new Date().toISOString()).run();
   row=await db.prepare('SELECT * FROM report_workspaces WHERE id=? AND deleted_at IS NULL').bind(code).first<Workspace>();
  }
  if(!row)throw new ApiError(401,'보고서 또는 수정 비밀번호가 맞지 않습니다.');
  if(row.pin_length!==-1){
  if(row.pin_length===4&&!/^[0-9]{4}$/.test(b.password))throw new ApiError(400,'수정 비밀번호는 숫자 4자리로 입력해 주세요.');
  if(row.locked_until>Date.now())throw new ApiError(429,'비밀번호 확인을 여러 번 실패했습니다. 15분 후 다시 시도해 주세요.');
  const hash=await passwordHash(b.password,row.salt);
  if(!sameHash(hash,row.password_hash)){
   await db.prepare('UPDATE report_workspaces SET failures=CASE WHEN failures>=9 THEN 0 ELSE failures+1 END, locked_until=CASE WHEN failures>=9 THEN ? ELSE 0 END WHERE id=?').bind(Date.now()+900000,code).run();
   throw new ApiError(401,'보고서 또는 수정 비밀번호가 맞지 않습니다.');
  }
  }
  if(code===SAMPLE_WORKSPACE&&(b.entryRole==='coordinator'||b.entryRole==='department')){b.department=row.department;b.coordinatorKey='';}
  if(b.entryRole!==undefined&&!['coordinator','department','viewer'].includes(String(b.entryRole)))throw new ApiError(400,'접속 권한을 선택해 주세요.');
  if(b.entryRole==='viewer'){role='viewer';sessionDepartment='';}
  else if(b.entryRole!=='department'&&typeof b.coordinatorKey==='string'&&b.coordinatorKey){
   if(!row.coordinator_hash||!sameHash(await digest(b.coordinatorKey),row.coordinator_hash))throw new ApiError(403,'총괄부서 관리 링크가 맞지 않습니다.');
   coordinatorKey=b.coordinatorKey;sessionDepartment=row.department;
  }else if(b.entryRole==='coordinator'&&typeof b.department==='string'&&b.department.trim()===row.department.trim()){
   sessionDepartment=row.department;if(!row.coordinator_hash)coordinatorKey=await initializeCoordinatorKey(code);
  }else if(b.entryRole!=='department'&&!row.coordinator_hash&&typeof b.department==='string'&&b.department.trim()===row.department.trim()){
   coordinatorKey=await initializeCoordinatorKey(code);if(!coordinatorKey)throw new ApiError(409,'다른 화면에서 관리 권한이 설정되었습니다. 총괄부서 관리 링크로 다시 열어 주세요.');sessionDepartment=row.department;
  }else{
   if(b.entryRole==='coordinator')throw new ApiError(403,'보고서를 만들 때 등록한 총괄부서명과 일치해야 합니다. 다른 부서는 개별부서 입력을 선택해 주세요.');
   role='department';if(typeof b.department!=='string'||!b.department.trim()||b.department.trim().length>80)throw new ApiError(400,'참여하는 부서명을 입력해 주세요.');
   sessionDepartment=b.department.trim();if(b.entryRole!=='department'&&sessionDepartment===row.department.trim())throw new ApiError(403,'총괄부서는 보고서를 만든 브라우저나 총괄부서 관리 링크로 열어 주세요.');
  }
  if(code===legacyWorkspace.id){
   await db.batch([
    db.prepare('INSERT OR IGNORE INTO report_settings (id,workspace_id,key,value) SELECT ?||key,?,key,value FROM settings').bind(code+':',code),
    db.prepare('INSERT OR IGNORE INTO report_settings (id,workspace_id,key,value) VALUES (?,?,?,?)').bind(code+':workName',code,'workName',legacyWorkspace.title),
    db.prepare('INSERT OR IGNORE INTO report_settings (id,workspace_id,key,value) VALUES (?,?,?,?)').bind(code+':fields',code,'fields',JSON.stringify(defaults)),
    db.prepare('UPDATE projects SET workspace_id=? WHERE workspace_id IS NULL').bind(code),
    db.prepare('UPDATE attachments SET workspace_id=? WHERE workspace_id IS NULL AND project_id IN (SELECT id FROM projects WHERE workspace_id=?)').bind(code,code)
   ]);
  }
  await db.prepare('UPDATE report_workspaces SET failures=0,locked_until=0 WHERE id=?').bind(code).run();
 }
 const token=randomToken();await db.batch([db.prepare('DELETE FROM report_sessions WHERE expires<?').bind(Date.now()),db.prepare('INSERT INTO report_sessions (token_hash,workspace_id,expires,role,department) VALUES (?,?,?,?,?)').bind(await digest(token),code,Date.now()+43200000,role,sessionDepartment)]);
 const row=await db.prepare('SELECT id,department,title,pin_length AS pinLength FROM report_workspaces WHERE id=?').bind(code).first();
 return Response.json({...row,role,sessionDepartment,sessionToken:token,...(coordinatorKey?{coordinatorKey}:{})},{status:b.action==='create'?201:200,headers:{...noStore,'Set-Cookie':sessionCookie(code,token)}});
 }catch(e){return apiError(e);}}
export async function DELETE(request:Request){try{
 const code=await requireWorkspace(request);
 if(new URL(request.url).searchParams.get('remove')==='1'){
  await requireCoordinator(request);
  const b=await request.json() as {confirm?:unknown;title?:unknown};
  const row=await database().prepare('SELECT title FROM report_workspaces WHERE id=? AND deleted_at IS NULL').bind(code).first<{title:string}>();
  if(!row)throw new ApiError(404,'보고서가 없습니다.');
  if(b.confirm!==true||b.title!==row.title)throw new ApiError(400,'삭제할 보고서 이름을 다시 확인해 주세요.');
  await database().batch([database().prepare('UPDATE report_workspaces SET deleted_at=? WHERE id=? AND deleted_at IS NULL').bind(new Date().toISOString(),code),database().prepare('DELETE FROM report_sessions WHERE workspace_id=?').bind(code)]);
 }else await endSession(request,code);
 return Response.json({ok:true},{headers:{...noStore,'Set-Cookie':sessionCookie(code,'',0)}});
}catch(e){return apiError(e);}}

export async function PATCH(request:Request){try{
 const code=await requireCoordinator(request);const b=await request.json() as {password?:unknown;action?:unknown;title?:unknown;previousTitle?:unknown};
 if(b.action==='rename'){
  if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>40||typeof b.previousTitle!=='string')throw new ApiError(400,'보고서명을 1~40자로 입력해 주세요.');
  const title=b.title.trim();const db=database();
  const result=await db.batch([
   db.prepare("INSERT INTO report_settings (id,workspace_id,key,value) SELECT ?,?,'workName',? WHERE EXISTS (SELECT 1 FROM report_workspaces WHERE id=? AND title=? AND deleted_at IS NULL) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(code+':workName',code,title,code,b.previousTitle),
   db.prepare('UPDATE report_workspaces SET title=? WHERE id=? AND title=? AND deleted_at IS NULL').bind(title,code,b.previousTitle)
  ]);
  if(!result[1].meta.changes)throw new ApiError(409,'다른 화면에서 보고서명이 변경되었습니다. 창을 닫고 다시 열어 주세요.');
  return Response.json({id:code,title},{headers:noStore});
 }
 if(typeof b.password!=='string'||b.password!==''&&!/^[0-9]{4}$/.test(b.password))throw new ApiError(400,'비밀번호를 비워 두거나 숫자 4자리로 입력해 주세요.');
 const salt=b.password?randomToken():'';const hash=b.password?await passwordHash(b.password,salt):'';
 await database().batch([
  database().prepare('UPDATE report_workspaces SET password_hash=?,salt=?,pin_length=?,failures=0,locked_until=0 WHERE id=? AND deleted_at IS NULL').bind(hash,salt,b.password?4:-1,code),
  database().prepare('DELETE FROM report_sessions WHERE workspace_id=? AND token_hash!=?').bind(code,await currentSessionHash(request,code))
 ]);
 const row=await database().prepare('SELECT id,department,title,pin_length AS pinLength FROM report_workspaces WHERE id=?').bind(code).first();
 const access=await workspaceAccess(request);return Response.json({...row,administrator:access.administrator,role:access.role,sessionDepartment:access.department,sessionToken:access.token},{headers:{...noStore,'Set-Cookie':sessionCookie(code,access.token)}});
}catch(e){return apiError(e);}}

async function initializeCoordinatorKey(code:string){const key=randomToken();const result=await database().prepare('UPDATE report_workspaces SET coordinator_hash=? WHERE id=? AND coordinator_hash IS NULL').bind(await digest(key),code).run();return result.meta.changes?key:undefined;}
export async function PUT(request:Request){try{const code=await requireCoordinator(request);const key=randomToken();await database().prepare('UPDATE report_workspaces SET coordinator_hash=? WHERE id=?').bind(await digest(key),code).run();return Response.json({coordinatorKey:key},{headers:noStore});}catch(e){return apiError(e);}}
