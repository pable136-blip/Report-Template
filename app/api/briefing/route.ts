import {SAMPLE_WORKSPACE} from '../../../lib/sample-workspace';
import {projectBrief} from '../../../lib/project-overview';
import {database} from '../../../db/raw';
import {ApiError,apiError,digest,noStore,normalizeCode,randomToken,requireOrigin,sessionCookie} from '../../../lib/workspace-auth';
// Recipient access is intentionally public, including password-protected authoring workspaces.
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams;const offset=Math.max(0,Math.floor(Number(params.get('offset'))||0));const q=(params.get('q')||'').trim().slice(0,100);const pattern='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';
 const result=await database().prepare("SELECT p.id,p.data,w.id AS workspace,w.title AS reportTitle FROM projects p JOIN report_workspaces w ON w.id=p.workspace_id WHERE w.deleted_at IS NULL AND w.id!=? AND (json_extract(p.data,'$.title') LIKE ? ESCAPE '\\' OR json_extract(p.data,'$.department') LIKE ? ESCAPE '\\' OR w.title LIKE ? ESCAPE '\\') ORDER BY w.created DESC,w.id,p.sort_order,p.id LIMIT 201 OFFSET ?").bind(SAMPLE_WORKSPACE,pattern,pattern,pattern,offset).all<{id:string;data:string;workspace:string;reportTitle:string}>();
 const items=result.results.slice(0,200).map(row=>{const p=JSON.parse(row.data);return {id:row.id,workspace:row.workspace,reportTitle:row.reportTitle,department:p.department,title:p.title,field:p.field,status:p.status,progress:p.progress,budget:Number(p.budget)||0,summary:projectBrief(p)};});
 return Response.json({items,hasMore:result.results.length>200},{headers:noStore});
 }catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 requireOrigin(request);const code=normalizeCode(new URL(request.url).searchParams.get('workspace')||'');if(!/^[A-Z0-9]{12}$/.test(code))throw new ApiError(400,'보고서를 선택해 주세요.');
 const row=await database().prepare('SELECT id,title,department,pin_length AS pinLength FROM report_workspaces WHERE id=? AND deleted_at IS NULL').bind(code).first();if(!row)throw new ApiError(404,'삭제되었거나 없는 보고서입니다.');
 const token=randomToken();await database().prepare("INSERT INTO report_sessions(token_hash,workspace_id,expires,role,department) VALUES(?,?,?,'viewer','')").bind(await digest(token),code,Date.now()+43200000).run();
 return Response.json({...row,role:'viewer',sessionDepartment:'',sessionToken:token},{headers:{...noStore,'Set-Cookie':sessionCookie(code,token)}});
 }catch(e){return apiError(e);}}
