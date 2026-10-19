import {database} from '../db/raw';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export const normalizeCode=(code:string)=>code.replace(/[-\s]/g,'').toUpperCase();
const codePattern=/^[A-Z0-9]{12}$/;
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256)));}
export function sameHash(a:string,b:string){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
export function requireOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ApiError(403,'다른 사이트에서 요청할 수 없습니다.');}
export function sessionCookie(code:string,token:string,maxAge=43200){return `report_${code}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
function tokenFrom(request:Request,code:string){const header=request.headers.get('X-Report-Session');if(header!==null)return header;return (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`report_${code}=`))?.split('=')[1]||'';}
export async function workspaceAccess(request:Request){
 requireOrigin(request);
 const code=normalizeCode(new URL(request.url).searchParams.get('workspace')||'');
 if(!codePattern.test(code))throw new ApiError(401,'보고서 작업공간을 먼저 열어 주세요.');
 const token=tokenFrom(request,code);if(!/^[0-9a-f]{64}$/.test(token))throw new ApiError(401,'보고서를 먼저 열어 주세요.');
 const session=await database().prepare('SELECT s.workspace_id,s.role,s.department,s.admin_session_hash,w.department AS coordinator_department FROM report_sessions s JOIN report_workspaces w ON w.id=s.workspace_id LEFT JOIN report_admin_sessions a ON a.token_hash=s.admin_session_hash WHERE s.token_hash=? AND s.workspace_id=? AND s.expires>? AND w.deleted_at IS NULL AND (s.admin_session_hash IS NULL OR a.expires>?)').bind(await digest(token),code,Date.now(),Date.now()).first();
 if(!session)throw new ApiError(401,'작업시간이 만료되었거나 삭제된 보고서입니다. 보고서를 다시 열어 주세요.');
 return {code,token,administrator:!!session.admin_session_hash,role:session.role as 'coordinator'|'department'|'viewer',department:String(session.department||session.coordinator_department)};
}
export async function endSession(request:Request,code:string){const token=tokenFrom(request,code);if(token)await database().prepare('DELETE FROM report_sessions WHERE token_hash=? AND workspace_id=?').bind(await digest(token),code).run();}
export function apiError(error:unknown){if(error instanceof ApiError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});console.error(error);return Response.json({error:'처리하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.'},{status:503,headers:{'Cache-Control':'no-store'}});}
export const noStore={'Cache-Control':'private, no-store'};

export async function currentSessionHash(request:Request,code:string){return digest(tokenFrom(request,code));}

export async function requireWorkspace(request:Request){return (await workspaceAccess(request)).code;}
export async function requireCoordinator(request:Request){const access=await workspaceAccess(request);if(access.role!=='coordinator')throw new ApiError(403,'총괄부서만 보고서 전체를 관리할 수 있습니다.');return access.code;}
export async function requireDepartment(request:Request,department:string){const access=await workspaceAccess(request);if(access.role==='viewer')throw new ApiError(403,'상급자 화면은 조회만 가능합니다.');if(access.role!=='coordinator'&&access.department!==department.trim())throw new ApiError(403,'본인 부서의 내용만 수정할 수 있습니다.');return access;}
export async function requireProjectAccess(request:Request,code:string,id:string){const row=await database().prepare('SELECT data FROM projects WHERE id=? AND workspace_id=?').bind(id,code).first<{data:string}>();if(!row)throw new ApiError(404,'이 보고서에 없는 사업입니다.');await requireDepartment(request,JSON.parse(row.data).department||'');return JSON.parse(row.data);}
