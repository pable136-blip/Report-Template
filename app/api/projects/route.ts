import {validInputSections} from '../../../lib/input-sections';
import {storage} from '../../../db/storage';
import {database} from '../../../db/raw';
import {ApiError,apiError,noStore,requireWorkspace,requireCoordinator,requireDepartment,requireProjectAccess} from '../../../lib/workspace-auth';
export async function GET(request:Request){try{const code=await requireWorkspace(request);const r=await database().prepare('SELECT * FROM projects WHERE workspace_id=? ORDER BY sort_order,id').bind(code).all();return Response.json(r.results.map((r:any)=>({...JSON.parse(r.data),id:r.id,revision:r.revision,updated:r.updated})),{headers:noStore});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const code=await requireWorkspace(request);const b:any=await request.json();
 if(!b||typeof b.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id)||typeof b.department!=='string'||!b.department.trim()||typeof b.title!=='string'||!b.title.trim()||JSON.stringify(b).length>50000)throw new ApiError(400,'부서명과 사업명을 확인해 주세요.');
 if(!['예정','진행','완료','지연'].includes(b.status)||!Number.isFinite(Number(b.progress))||Number(b.progress)<0||Number(b.progress)>100||!Number.isFinite(Number(b.budget))||Number(b.budget)<0)throw new ApiError(400,'진행률과 예산을 확인해 주세요.');
 if(b.situation!==undefined&&typeof b.situation!=='string')throw new ApiError(400,'현황은 글자로 입력해 주세요.');
 const access=await requireDepartment(request,b.department);b.department=b.department.trim();const db=database();
 let previous:any=null;if(b.revision){const existing=await db.prepare('SELECT data FROM projects WHERE id=? AND workspace_id=?').bind(b.id,code).first<{data:string}>();if(!existing)throw new ApiError(409,'이 보고서에 없는 사업입니다.');previous=await requireProjectAccess(request,code,b.id);}
 if(b.inputSections===undefined&&previous?.inputSections!==undefined)b.inputSections=previous.inputSections;
 if(b.inputSections!==undefined&&!validInputSections(b.inputSections))throw new ApiError(400,'입력 항목은 현황·사업개요·추진현황·향후계획 중에서 선택해 주세요.');
 for(const key of ['situationImages','purposeImages','resultsImages','planImages']){
  if(b[key]===undefined)continue;
  if(!Array.isArray(b[key])||b[key].length>100)throw new ApiError(400,'이미지 목록을 확인해 주세요.');
  for(const img of b[key]){if(!img||typeof img.id!=='string'||img.page!==undefined&&(!Number.isInteger(img.page)||img.page<0||img.page>1000))throw new ApiError(400,'이미지를 확인해 주세요.');const owned=await db.prepare('SELECT id,origin FROM attachments WHERE id=? AND project_id=? AND workspace_id=?').bind(img.id,b.id,code).first();if(!owned)throw new ApiError(400,'이 사업에 첨부한 이미지만 사용할 수 있습니다.');img.origin=(owned as {origin:string}).origin;}
 }
 const now=new Date().toISOString();const {revision,updated,workspace_id,sort_order,...data}=b;
 if(revision){if(!Number.isInteger(revision)||revision<1)throw new ApiError(400,'저장 버전을 확인해 주세요.');const r=await db.prepare('UPDATE projects SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND workspace_id=?').bind(JSON.stringify(data),now,b.id,revision,code).run();if(!r.meta.changes)throw new ApiError(409,'자료가 변경되었거나 이 보고서에 없는 사업입니다. 최신 자료를 다시 열어 주세요.');}
 else{const existing=await db.prepare('SELECT id FROM projects WHERE id=?').bind(b.id).first();if(existing)throw new ApiError(409,'이미 저장된 사업입니다. 최신 자료를 다시 열어 주세요.');await db.prepare('INSERT INTO projects (id,workspace_id,data,revision,updated,sort_order) VALUES (?,?,?,1,?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM projects WHERE workspace_id=?))').bind(b.id,code,JSON.stringify(data),now,code).run();}
 return Response.json({...data,revision:(revision||0)+1,updated:now},{headers:noStore});
 }catch(e){return apiError(e);}}

export async function PATCH(request:Request){try{
 const code=await requireCoordinator(request),b:any=await request.json(),db=database();
 if(typeof b.id!=='string'||typeof b.targetId!=='string'||b.id===b.targetId)throw new ApiError(400,'이동할 사업을 확인해 주세요.');
 const rows=await db.prepare('SELECT id,sort_order FROM projects WHERE workspace_id=? ORDER BY sort_order,id').bind(code).all<{id:string;sort_order:number}>();
 const ids=rows.results.map(r=>r.id);if(!Array.isArray(b.expectedOrder)||JSON.stringify(b.expectedOrder)!==JSON.stringify(ids))throw new ApiError(409,'사업 순서가 변경되었습니다. 최신 현황에서 다시 이동해 주세요.');
 const source=rows.results.find(r=>r.id===b.id),target=rows.results.find(r=>r.id===b.targetId);if(!source||!target)throw new ApiError(404,'이 보고서에 없는 사업입니다.');
 const from=source.sort_order,to=target.sort_order;
 await db.prepare('UPDATE projects SET sort_order=CASE WHEN id=? THEN ? WHEN ?<? THEN sort_order-1 ELSE sort_order+1 END WHERE workspace_id=? AND sort_order BETWEEN ? AND ?').bind(b.id,to,from,to,code,Math.min(from,to),Math.max(from,to)).run();
 return Response.json({ok:true},{headers:noStore});
 }catch(e){return apiError(e);}}

export async function DELETE(request:Request){try{
 const code=await requireWorkspace(request),db=database();const b=await request.json() as {id?:unknown;revision?:unknown;title?:unknown;confirm?:unknown};
 if(typeof b.id!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(b.id)||!Number.isInteger(b.revision)||Number(b.revision)<1||b.confirm!==true)throw new ApiError(400,'삭제할 사업을 확인해 주세요.');
 const project=await requireProjectAccess(request,code,b.id);
 if(b.title!==project.title)throw new ApiError(409,'사업명이 변경되었습니다. 최신 현황에서 다시 확인해 주세요.');
 const files=await db.prepare('SELECT id FROM attachments WHERE workspace_id=? AND project_id=?').bind(code,b.id).all<{id:string}>();
 const result=await db.batch([
  db.prepare('DELETE FROM projects WHERE id=? AND workspace_id=? AND revision=?').bind(b.id,code,b.revision),
  db.prepare('DELETE FROM attachments WHERE workspace_id=? AND project_id=? AND NOT EXISTS (SELECT 1 FROM projects WHERE id=? AND workspace_id=?)').bind(code,b.id,b.id,code)
 ]);
 if(!result[0].meta.changes)throw new ApiError(409,'사업 내용이 변경되었습니다. 최신 현황에서 다시 삭제해 주세요.');
 for(const file of files.results){try{await storage().delete('workspaces/'+code+'/attachments/'+file.id);}catch(e){console.error('Deleted project attachment cleanup failed',e);}}
 return Response.json({ok:true,id:b.id},{headers:noStore});
 }catch(e){return apiError(e);}}
