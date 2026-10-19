import {database} from '../../../db/raw';
import {resetAdminPassword,adminConfig,adminCookie,checkAdminPassword,issueAdmin,limitAdminLogin,requireAdmin,validateAdminPassword,verifySetup} from '../../../lib/admin-auth';
import {ApiError,apiError,digest,noStore,normalizeCode,passwordHash,randomToken,requireOrigin,sessionCookie} from '../../../lib/workspace-auth';
function codeOf(value:unknown){const code=normalizeCode(typeof value==='string'?value:'');if(!/^[A-Z0-9]{12}$/.test(code))throw new ApiError(400,'보고서를 선택해 주세요.');return code;}
export async function GET(request:Request){try{
 if(new URL(request.url).searchParams.get('state')==='1'){const configured=!!await adminConfig();try{await requireAdmin(request);return Response.json({configured,authenticated:true},{headers:noStore});}catch{return Response.json({configured,authenticated:false},{headers:noStore});}}
 await requireAdmin(request);const params=new URL(request.url).searchParams;const q=(params.get('q')||'').trim().slice(0,100);const pattern='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';const offset=Math.max(0,Math.min(1000000,Number(params.get('offset'))||0));
 const deleted=params.get('deleted')==='1';const where="deleted_at IS "+(deleted?"NOT NULL":"NULL")+" AND (title LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')";
 const total=await database().prepare('SELECT COUNT(*) AS count FROM report_workspaces WHERE '+where).bind(pattern,pattern).first<{count:number}>();
 const result=await database().prepare('SELECT id,title,department,created,deleted_at AS deletedAt,pin_length AS pinLength,(SELECT COUNT(*) FROM projects p WHERE p.workspace_id=report_workspaces.id) AS projectCount FROM report_workspaces WHERE '+where+' ORDER BY created DESC,id LIMIT 50 OFFSET ?').bind(pattern,pattern,offset).all();
 return Response.json({items:result.results,total:total?.count||0},{headers:noStore});
 }catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 requireOrigin(request);const b=await request.json() as Record<string,unknown>;
 if(b.action==='reset'){await limitAdminLogin(request);await resetAdminPassword(b.resetKey,b.password);return Response.json({ok:true},await issueAdmin());}
 if(b.action==='setup'){
  await limitAdminLogin(request);await verifySetup(b.setupKey);validateAdminPassword(b.password);const salt=randomToken();const hash=await passwordHash(b.password,salt);
  const result=await database().prepare('INSERT OR IGNORE INTO report_admin_config(id,password_hash,salt) VALUES(1,?,?)').bind(hash,salt).run();if(!result.meta.changes)throw new ApiError(409,'이미 관리자 비밀번호가 설정되었습니다. 로그인해 주세요.');
  return Response.json({ok:true},await issueAdmin());
 }
 if(b.action==='login'){await limitAdminLogin(request);await checkAdminPassword(b.password);return Response.json({ok:true},await issueAdmin());}
 const admin=await requireAdmin(request);
 if(b.action==='logout'){await database().batch([database().prepare('DELETE FROM report_sessions WHERE admin_session_hash=?').bind(admin.token_hash),database().prepare('DELETE FROM report_admin_sessions WHERE token_hash=?').bind(admin.token_hash)]);return Response.json({ok:true},{headers:{...noStore,'Set-Cookie':adminCookie('',0)}});}
 if(b.action==='password'){
  await checkAdminPassword(b.currentPassword);validateAdminPassword(b.password);const salt=randomToken();const hash=await passwordHash(b.password,salt);
  await database().batch([database().prepare('UPDATE report_admin_config SET password_hash=?,salt=? WHERE id=1').bind(hash,salt),database().prepare('DELETE FROM report_sessions WHERE admin_session_hash IS NOT NULL'),database().prepare('DELETE FROM report_admin_sessions')]);
  return Response.json({ok:true},await issueAdmin());
 }
 if(b.action==='restore'){
  const code=codeOf(b.code);if(typeof b.deletedAt!=='string'||!b.deletedAt)throw new ApiError(400,'복구할 보고서를 선택해 주세요.');
  const result=await database().prepare('UPDATE report_workspaces SET deleted_at=NULL WHERE id=? AND deleted_at=?').bind(code,b.deletedAt).run();if(!result.meta.changes)throw new ApiError(409,'이미 복구되었거나 상태가 변경되었습니다. 목록을 다시 불러와 주세요.');
  return Response.json({ok:true},{headers:noStore});
 }
 if(b.action==='open'){
  const code=codeOf(b.code);const row=await database().prepare('SELECT id,title,department,pin_length AS pinLength FROM report_workspaces WHERE id=? AND deleted_at IS NULL').bind(code).first<{id:string;title:string;department:string;pinLength:number}>();if(!row)throw new ApiError(404,'삭제되었거나 없는 보고서입니다.');
  const token=randomToken();await database().prepare("INSERT INTO report_sessions(token_hash,workspace_id,expires,role,department,admin_session_hash) VALUES(?,?,?,'coordinator',?,?)").bind(await digest(token),code,admin.expires,row.department,admin.token_hash).run();
  return Response.json({...row,role:'coordinator',administrator:true,sessionDepartment:row.department,sessionToken:token},{headers:{...noStore,'Set-Cookie':sessionCookie(code,token,Math.max(0,Math.floor((admin.expires-Date.now())/1000)))}});
 }
 throw new ApiError(400,'올바른 작업을 선택해 주세요.');
 }catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{
 await requireAdmin(request);const b=await request.json() as Record<string,unknown>;const code=codeOf(b.code);
 if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>40||typeof b.department!=='string'||!b.department.trim()||b.department.trim().length>80||typeof b.previousTitle!=='string'||typeof b.previousDepartment!=='string')throw new ApiError(400,'보고서명과 총괄부서명을 확인해 주세요.');
 const result=await database().prepare('UPDATE report_workspaces SET title=?,department=? WHERE id=? AND title=? AND department=? AND deleted_at IS NULL').bind(b.title.trim(),b.department.trim(),code,b.previousTitle,b.previousDepartment).run();if(!result.meta.changes)throw new ApiError(409,'다른 화면에서 변경되었거나 삭제된 보고서입니다. 목록을 다시 불러와 주세요.');
 await database().batch([database().prepare("UPDATE report_sessions SET department=? WHERE workspace_id=? AND role='coordinator'").bind(b.department.trim(),code),database().prepare("UPDATE report_settings SET value=? WHERE workspace_id=? AND key='workName'").bind(b.title.trim(),code)]);
 return Response.json({ok:true},{headers:noStore});
 }catch(e){return apiError(e);}}
export async function DELETE(request:Request){try{
 await requireAdmin(request);const b=await request.json() as Record<string,unknown>;const code=codeOf(b.code);if(b.confirm!==true||typeof b.title!=='string')throw new ApiError(400,'삭제할 보고서명을 확인해 주세요.');
 const result=await database().prepare('UPDATE report_workspaces SET deleted_at=? WHERE id=? AND title=? AND deleted_at IS NULL').bind(new Date().toISOString(),code,b.title).run();if(!result.meta.changes)throw new ApiError(409,'보고서명이 변경되었거나 이미 삭제되었습니다. 목록을 다시 불러와 주세요.');
 await database().prepare('DELETE FROM report_sessions WHERE workspace_id=?').bind(code).run();return Response.json({ok:true},{headers:noStore});
 }catch(e){return apiError(e);}}
