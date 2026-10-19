const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const sql=new DatabaseSync(':memory:');
for(const filename of fs.readdirSync(path.join(__dirname,'../drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(__dirname,'../drizzle',filename),'utf8'));
class Statement{
 constructor(query,args=[]){this.query=query;this.args=args;}
 bind(...args){return new Statement(this.query,args);}
 async first(){return sql.prepare(this.query).get(...this.args)||null;}
 async all(){return {results:sql.prepare(this.query).all(...this.args)};}
 async run(){return {meta:{changes:Number(sql.prepare(this.query).run(...this.args).changes)}};}
}
const DB={prepare:q=>new Statement(q),async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();
const UPLOADS={async put(key,value,options={}){objects.set(key,{bytes:new Uint8Array(value),...options});},async get(key){const value=objects.get(key);return value?{body:value.bytes,customMetadata:value.customMetadata,arrayBuffer:async()=>value.bytes.buffer}:null;},async delete(key){objects.delete(key);}};
const recoveryEnv={DB,UPLOADS,REPORT_ADMIN_SETUP_KEY:'test-owner-setup-key',REPORT_ADMIN_RESET_KEY:'test-reset-secret',REPORT_ADMIN_RESET_EXPIRES:String(Date.now()+60000)};
const originalLoad=Module._load;
Module._load=function(id,parent,isMain){if(id==='cloudflare:workers')return {env:recoveryEnv};return originalLoad.call(this,id,parent,isMain);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
const workspaces=require('../app/api/workspaces/route.ts');
const projects=require('../app/api/projects/route.ts');
const settings=require('../app/api/settings/route.ts');
const attachments=require('../app/api/attachments/route.ts');
const exportsApi=require('../app/api/exports/route.ts');
const base='https://reports.test';
const request=(url,workspace,method='GET',body)=>{const headers={};if(workspace)headers.cookie=workspace.cookie;if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}return new Request(base+url+(workspace?(url.includes('?')?'&':'?')+'workspace='+workspace.id:''),{method,headers,body});};
async function create(title){const r=await workspaces.POST(request('/api/workspaces',null,'POST',{action:'create',department:title+' 부서',title,password:'0042'}));assert.equal(r.status,201);return {...await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
async function json(response,status){assert.equal(response.status,status);return response.json();}

const admin=require('../app/api/admin/route.ts');
const adminRequest=(method='GET',body,cookie='',suffix='')=>new Request(base+'/api/admin'+suffix,{method,headers:{'Content-Type':'application/json',cookie,'cf-connecting-ip':'192.0.2.1',origin:base},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
 const a=await create('관리 A'),b=await create('관리 B');
 await json(await admin.GET(adminRequest()),401);
 await json(await admin.GET(adminRequest('GET',null,a.cookie)),401);
 await json(await admin.POST(adminRequest('POST',{action:'setup',setupKey:'wrong',password:'strong-password-123'})),403);
 await json(await admin.POST(adminRequest('POST',{action:'setup',setupKey:'test-owner-setup-key',password:'1234'})),400);
 let response=await admin.POST(adminRequest('POST',{action:'setup',setupKey:'test-owner-setup-key',password:'strong-password-123'}));await json(response,200);let cookie=response.headers.get('set-cookie').split(';')[0];
 assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 await json(await admin.POST(adminRequest('POST',{action:'setup',setupKey:'test-owner-setup-key',password:'another-password-123'})),409);
 await json(await admin.POST(adminRequest('POST',{action:'login',password:'wrong'})),401);
 let listing=await json(await admin.GET(adminRequest('GET',null,cookie)),200);assert.equal(listing.total,2);assert.equal(listing.items.length,2);assert.ok(!JSON.stringify(listing).includes('password_hash'));
 const granted=await json(await admin.POST(adminRequest('POST',{action:'open',code:a.id},cookie)),200);assert.equal(granted.administrator,true);assert.equal(granted.role,'coordinator');
 const scoped={...granted,cookie:'report_'+granted.id+'='+granted.sessionToken};
 const info=await json(await workspaces.GET(request('/api/workspaces',scoped)),200);assert.equal(info.administrator,true);assert.equal(info.coordinatorKey,undefined);
 const row=await json(await projects.POST(request('/api/projects',scoped,'POST',{id:crypto.randomUUID(),title:'타 부서 사업',department:'다른 부서',field:'교육',status:'진행',progress:20,budget:100,purpose:'내용',results:'실적',plan:'계획'})),200);
 await json(await projects.POST(request('/api/projects',scoped,'POST',{...row,purpose:'관리자 수정'})),200);
 const briefing=require('../app/api/briefing/route.ts');
 const anonymous=await json(await briefing.GET(request('/api/briefing',null)),200);assert.equal(anonymous.items.length,1);assert.equal(anonymous.items[0].title,row.title);
 const permitted=await json(await briefing.GET(request('/api/briefing',a)),200);assert.equal(permitted.items.length,1);assert.equal(permitted.items[0].title,row.title);assert.equal(permitted.items[0].summary,'관리자 수정');assert.equal(permitted.items[0].budget,100);assert.equal(permitted.items[0].purpose,undefined);
 await json(await briefing.POST(request('/api/briefing',null,'POST')),400);
 const viewResponse=await briefing.POST(request('/api/briefing?workspace='+a.id,null,'POST'));const view=await json(viewResponse,200);assert.equal(view.role,'viewer');const readOnly={...view,cookie:viewResponse.headers.get('set-cookie').split(';')[0]};await json(await projects.POST(request('/api/projects',readOnly,'POST',{...row,title:'불가'})),403);
 const freeResponse=await workspaces.POST(request('/api/workspaces',null,'POST',{action:'create',department:'공개 부서',title:'공개 보고서',password:''}));const free={...await json(freeResponse,201),cookie:freeResponse.headers.get('set-cookie').split(';')[0]};await json(await projects.POST(request('/api/projects',free,'POST',{...row,id:crypto.randomUUID(),revision:undefined,title:'공개 사업'})),200);
 assert.ok((await json(await briefing.GET(request('/api/briefing',null)),200)).items.some(p=>p.title==='공개 사업'));
 const sampleCode='6979E2190EBC';const sampleWorkspace={...sql.prepare('SELECT * FROM report_workspaces WHERE id=?').get(a.id),id:sampleCode,title:'샘플 보고서',created:'2099-01-01T00:00:00.000Z'};
 const insertRow=(table,value)=>sql.prepare('INSERT INTO '+table+' ('+Object.keys(value).join(',')+') VALUES ('+Object.keys(value).map(()=>'?').join(',')+')').run(...Object.values(value));insertRow('report_workspaces',sampleWorkspace);const sampleBusiness={...sql.prepare('SELECT * FROM projects WHERE id=?').get(row.id),id:crypto.randomUUID(),workspace_id:sampleCode};insertRow('projects',sampleBusiness);
 const actualCatalog=await json(await briefing.GET(request('/api/briefing',null)),200);assert.equal(actualCatalog.items.length,2);assert.ok(actualCatalog.items.every(item=>item.workspace!==sampleCode));assert.equal(actualCatalog.hasMore,false);assert.equal((await json(await briefing.GET(request('/api/briefing?q='+encodeURIComponent('샘플 보고서'),null)),200)).items.length,0);assert.equal((await json(await briefing.GET(request('/api/briefing?offset=1',null)),200)).items.length,1);assert.ok(sql.prepare('SELECT id FROM projects WHERE id=?').get(sampleBusiness.id));
 const reportList=await json(await workspaces.GET(request('/api/workspaces?list=1',null)),200);assert.ok(reportList.items.some(item=>item.id===a.id));assert.ok(reportList.items.every(item=>item.id!==sampleCode));assert.equal((await json(await workspaces.GET(request('/api/workspaces?list=1&q='+encodeURIComponent('샘플 보고서'),null)),200)).items.length,0);const directSample=await json(await workspaces.GET(request('/api/workspaces?list=1&selected='+sampleCode,null)),200);assert.ok(directSample.items.some(item=>item.id===sampleCode),'direct sample link still receives its password/role metadata');
 console.log('PASS: normal report list and search exclude the sample while its direct shortcut still opens');
 sql.prepare('UPDATE report_workspaces SET pin_length=-1 WHERE id=?').run(sampleCode);
 for(const entryRole of ['department','coordinator']){const demo=await json(await workspaces.POST(request('/api/workspaces',null,'POST',{action:'open',code:sampleCode,entryRole,password:''})),200);assert.equal(demo.role,entryRole);assert.equal(demo.sessionDepartment,sampleWorkspace.department);}
 const staleDemo=await json(await workspaces.POST(request('/api/workspaces',null,'POST',{action:'open',code:sampleCode,entryRole:'coordinator',department:'',coordinatorKey:'stale-browser-key',password:''})),200);assert.equal(staleDemo.role,'coordinator');
 await json(await workspaces.POST(request('/api/workspaces',null,'POST',{action:'open',code:a.id,entryRole:'department',department:'',password:'0042'})),400);await json(await workspaces.POST(request('/api/workspaces',null,'POST',{action:'open',code:a.id,entryRole:'coordinator',department:'',password:'0042'})),403);
 sql.prepare('UPDATE report_workspaces SET pin_length=4 WHERE id=?').run(sampleCode);await json(await workspaces.POST(request('/api/workspaces',null,'POST',{action:'open',code:sampleCode,entryRole:'department',password:''})),400);sql.prepare('UPDATE report_workspaces SET pin_length=-1 WHERE id=?').run(sampleCode);
 console.log('PASS: department and coordinator open the training report without a department name, remembered keys cannot block the demo, real report role/name checks and configured passwords remain enforced');
 console.log('PASS: Moa excludes training report before search and pagination while actual reports and preserved training data remain available');
 console.log('PASS: recipient catalog includes password-protected reports without a password, issues read-only sessions and still denies editing');

 await json(await admin.PATCH(adminRequest('PATCH',{code:b.id,title:'변경 보고서',department:'스마트도시추진과',previousTitle:b.title,previousDepartment:b.department},a.cookie)),401);
 await json(await admin.PATCH(adminRequest('PATCH',{code:b.id,title:'변경 보고서',department:'스마트도시추진과',previousTitle:b.title,previousDepartment:b.department},cookie)),200);
 await json(await admin.PATCH(adminRequest('PATCH',{code:b.id,title:'중복 수정',department:'부서',previousTitle:b.title,previousDepartment:b.department},cookie)),409);
 await json(await admin.DELETE(adminRequest('DELETE',{code:b.id,title:'다른 이름',confirm:true},cookie)),409);
 assert.equal((await json(await workspaces.GET(request('/api/workspaces',b)),200)).department,'스마트도시추진과');
 const preserved=await json(await projects.POST(request('/api/projects',b,'POST',{...row,id:crypto.randomUUID(),revision:undefined,title:'복구할 사업'})),200);
 await json(await admin.DELETE(adminRequest('DELETE',{code:b.id,title:'변경 보고서',confirm:true},cookie)),200);
 await json(await projects.GET(request('/api/projects',b)),401);
 const trash=await json(await admin.GET(adminRequest('GET',null,cookie,'?deleted=1')),200);assert.equal(trash.items.length,1);assert.equal(trash.items[0].id,b.id);assert.equal(trash.items[0].projectCount,1);const deletedAt=trash.items[0].deletedAt;
 assert.ok(!(await json(await admin.GET(adminRequest('GET',null,cookie)),200)).items.some(r=>r.id===b.id));
 await json(await admin.POST(adminRequest('POST',{action:'restore',code:b.id,deletedAt},a.cookie)),401);
 await json(await admin.POST(adminRequest('POST',{action:'restore',code:b.id,deletedAt:'stale'},cookie)),409);
 await json(await admin.POST(adminRequest('POST',{action:'restore',code:b.id,deletedAt},cookie)),200);
 assert.equal((await json(await admin.GET(adminRequest('GET',null,cookie,'?deleted=1')),200)).items.length,0);
 const restored=await json(await admin.POST(adminRequest('POST',{action:'open',code:b.id},cookie)),200);const restoredRows=await json(await projects.GET(request('/api/projects',{...restored,cookie:'report_'+restored.id+'='+restored.sessionToken})),200);assert.equal(restoredRows[0].id,preserved.id);assert.equal(restoredRows[0].title,'복구할 사업');
 await json(await admin.POST(adminRequest('POST',{action:'restore',code:b.id,deletedAt},cookie)),409);
 console.log('PASS: deleted reports are listed only in admin trash, only admin can restore, original projects survive, stale/repeated restore is rejected');

 assert.equal((await json(await projects.GET(request('/api/projects',scoped)),200)).length,1);
 await json(await admin.POST(adminRequest('POST',{action:'logout'},cookie)),200);
 await json(await admin.GET(adminRequest('GET',null,cookie)),401);
 await json(await projects.GET(request('/api/projects',scoped)),401);
 response=await admin.POST(adminRequest('POST',{action:'login',password:'strong-password-123'}));await json(response,200);cookie=response.headers.get('set-cookie').split(';')[0];
 const before=await json(await admin.POST(adminRequest('POST',{action:'open',code:a.id},cookie)),200);
 const beforeScope={...before,cookie:'report_'+before.id+'='+before.sessionToken};
 response=await admin.POST(adminRequest('POST',{action:'password',currentPassword:'strong-password-123',password:'changed-password-456'},cookie));await json(response,200);
 await json(await admin.GET(adminRequest('GET',null,cookie)),401);await json(await projects.GET(request('/api/projects',beforeScope)),401);
 await json(await admin.POST(adminRequest('POST',{action:'login',password:'strong-password-123'})),401);
 response=await admin.POST(adminRequest('POST',{action:'login',password:'changed-password-456'}));await json(response,200);cookie=response.headers.get('set-cookie').split(';')[0];
 const cross=new Request(base+'/api/admin',{method:'POST',headers:{cookie,origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({action:'open',code:a.id})});await json(await admin.POST(cross),403);

 sql.prepare('DELETE FROM report_admin_attempts').run();
 const snapshot=()=>JSON.stringify(['report_workspaces','projects','report_settings','attachments'].map(t=>sql.prepare('SELECT * FROM '+t).all()));
 const preservedData=snapshot();
 const oldAdminCookie=cookie;
 await json(await admin.POST(adminRequest('POST',{action:'reset',resetKey:'invalid',password:'recovered-password-789'})),403);
 recoveryEnv.REPORT_ADMIN_RESET_EXPIRES='1';
 await json(await admin.POST(adminRequest('POST',{action:'reset',resetKey:'test-reset-secret',password:'recovered-password-789'})),403);
 recoveryEnv.REPORT_ADMIN_RESET_EXPIRES=String(Date.now()+60000);
 response=await admin.POST(adminRequest('POST',{action:'reset',resetKey:'test-reset-secret',password:'recovered-password-789'}));await json(response,200);cookie=response.headers.get('set-cookie').split(';')[0];
 assert.equal(snapshot(),preservedData);
 await json(await admin.GET(adminRequest('GET',null,oldAdminCookie)),401);
 await json(await admin.POST(adminRequest('POST',{action:'reset',resetKey:'test-reset-secret',password:'attacker-password-123'})),409);
 await json(await admin.GET(adminRequest('GET',null,cookie)),200);
 await json(await admin.POST(adminRequest('POST',{action:'login',password:'recovered-password-789'})),200);
 console.log('PASS: recovery expiry, invalid token, one-time use, data preservation and old session revocation');
 sql.prepare('UPDATE report_admin_sessions SET expires=0').run();await json(await admin.GET(adminRequest('GET',null,cookie)),401);
 for(let i=0;i<10;i++)await admin.POST(adminRequest('POST',{action:'login',password:'wrong'}));await json(await admin.POST(adminRequest('POST',{action:'login',password:'changed-password-456'})),429);
 // A normal coordinating department still cannot reach global management after admin logout.
 await json(await admin.DELETE(adminRequest('DELETE',{code:a.id,title:a.title,confirm:true},a.cookie)),401);
 await json(await projects.GET(request('/api/projects',a)),200);

 const own=await json(await projects.POST(request('/api/projects',a,'POST',{id:crypto.randomUUID(),title:'부서 보고 편집',department:a.department,field:'교육',status:'진행',progress:20,budget:100,purpose:'원문',results:'실적',plan:'계획'})),200);
 const deptResponse=await workspaces.POST(request('/api/workspaces',null,'POST',{action:'open',code:a.id,entryRole:'department',department:a.department,password:'0042'}));
 const dept={...await json(deptResponse,200),cookie:deptResponse.headers.get('set-cookie').split(';')[0]};
 const other=(await json(await projects.GET(request('/api/projects',a)),200)).find(p=>p.id===row.id);
 const design={theme:'navy',font:'modern',bodyFont:'modern',titleSize:48,bodySize:32,titleBold:true,bodyBold:false,titleColor:'',bodyColor:'',sections:['purpose','results'],textStyles:{'cover:coverTitle':{bold:true},[row.id+'사업개요0:purpose']:{color:'#ff0000'}}};
 await json(await settings.PATCH(request('/api/settings',a,'PATCH',{design})),200);
 const scopedDesign={...design,theme:'sky',sections:['plan'],textStyles:{[own.id+'사업개요0:purpose']:{size:40}},slideTexts:{[own.id+'사업개요0:section']:'부서 작성'},textPositions:{[own.id+'사업개요0']:{x:20,y:30}},textRuns:{}};
 await json(await settings.PATCH(request('/api/settings',dept,'PATCH',{design:scopedDesign})),200);
 let stored=(await json(await settings.GET(request('/api/settings',a)),200)).design;
 assert.equal(stored.theme,'navy');assert.deepEqual(stored.sections,['purpose','results']);assert.equal(stored.textStyles['cover:coverTitle'].bold,true);assert.equal(stored.textStyles[row.id+'사업개요0:purpose'].color,'#ff0000');assert.equal(stored.textStyles[own.id+'사업개요0:purpose'].size,40);
 await json(await settings.PATCH(request('/api/settings',dept,'PATCH',{design:{...scopedDesign,textStyles:{[row.id+'사업개요0:purpose']:{size:50}}}})),403);
 await json(await settings.PATCH(request('/api/settings',readOnly,'PATCH',{design:scopedDesign})),403);
 await json(await settings.PATCH(request('/api/settings',dept,'PATCH',{design:{...scopedDesign,textStyles:{},slideTexts:{},textPositions:{}}})),200);
 stored=(await json(await settings.GET(request('/api/settings',a)),200)).design;assert.equal(stored.textStyles[own.id+'사업개요0:purpose'],undefined);assert.equal(stored.textStyles['cover:coverTitle'].bold,true);
 const form=new FormData();form.append('projectId',own.id);form.append('origin','report');form.append('file',new File(['image'],'dept.png',{type:'image/png'}));
 const uploaded=await json(await attachments.POST(request('/api/attachments',dept,'POST',form)),201);
 const placed=await json(await projects.POST(request('/api/projects',dept,'POST',{...own,purpose:'편집 저장',purposeImages:[{id:uploaded.id,name:uploaded.name,origin:'report',layout:'inline'}]})),200);assert.equal(placed.purpose,'편집 저장');
 const moved=await json(await projects.POST(request('/api/projects',dept,'POST',{...placed,purposeImages:placed.purposeImages.map(img=>({...img,bounds:{x:10,y:20,width:40,height:30}}))})),200);assert.equal(moved.purposeImages[0].bounds.x,10);
 await json(await projects.POST(request('/api/projects',dept,'POST',{...other,department:dept.sessionDepartment,purpose:'타부서 침범'})),403);
 await json(await projects.PATCH(request('/api/projects',dept,'PATCH',{id:own.id,targetId:row.id})),403);
 await json(await attachments.DELETE(request('/api/attachments?id='+uploaded.id,dept,'DELETE')),200);
 assert.equal((await json(await projects.GET(request('/api/projects',a)),200)).find(p=>p.id===own.id).purposeImages.length,0);
 console.log('PASS: department report text/image editing and scoped design saving; other departments, viewer, cover, global theme and project ordering remain protected');
 console.log('PASS: protected one-time admin setup, separate login, global listing/edit/delete, all-department editing, scoped normal roles, stale checks, CSRF, expiry, logout/password revocation and rate limit');
})().catch(e=>{console.error(e);process.exitCode=1;});
