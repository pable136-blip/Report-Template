const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
    }).outputText;
    module._compile(output, filename);
  };
}
const {default: ReportDeck, paginate, includeSection} = require('../app/components/ReportDeck.tsx');
const row = {id:'demo',title:'시민 AI 교육',department:'스마트도시추진과',field:'교육',status:'진행',progress:50,budget:100,purpose:'사업 개요',results:'주요 실적',plan:'향후 계획',target:'100명',current:'50명',contact:'담당팀'};
const props = {rows:[row],workName:'AI 사업',department:'전체 부서',field:'전체 분야',onEdit(){},async onRefresh(){}};
const editing = renderToStaticMarkup(React.createElement(ReportDeck, props));
assert.ok(editing.includes('통합 업무보고')); // Editors are enabled only after saved design loads.
const printing = editing.slice(editing.indexOf('class="deckprint'));
assert.match(editing,/--report-title:48px/);
assert.match(editing,/--report-body:32px/);
assert.match(editing,/PPT 기본 크기 적용/);

assert.ok(printing.includes('사업 개요') && printing.includes('향후 계획'));
assert.doesNotMatch(printing, /contentEditable|role="textbox"|slideeditstatus/);
const longReport=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[{...row,purpose:'핳'.repeat(600)}]}));
const longPrint=longReport.slice(longReport.indexOf('class="deckprint')).replace(/<article class="pptcanvas ppt-overview"[\s\S]*?<\/article>/g,'');
assert.equal((longPrint.match(/핳/g)||[]).length,600);
assert.ok((longPrint.match(/class="pptcanvas/g)||[]).length>(printing.match(/class="pptcanvas/g)||[]).length);
assert.equal((longReport.match(/--report-body:32px/g)||[]).length,2);

const viewing = renderToStaticMarkup(React.createElement(ReportDeck, {...props,readOnly:true}));
assert.doesNotMatch(viewing, /contentEditable|reportimagetools|type="file"|reportdesigns|reporttypography/);
const pages = paginate('가'.repeat(600));
assert.equal(pages.join('').replace(/\n/g,''), '가'.repeat(600));
assert.ok(pages.length > 1);
assert.equal(includeSection('사업개요',['results']),false);
assert.equal(includeSection('주요 추진 실적',['results']),true);
assert.equal(includeSection('추진현황',['results']),true);assert.ok(viewing.includes('추진현황'));assert.ok(!viewing.includes('주요 추진 실적'));
assert.equal(includeSection('향후 추진계획',['results']),false);
console.log('PASS: editable report, clean print output, viewing-only presentation, pagination');

const {resizeText}=require('../lib/text-layout.ts');
assert.deepEqual(resizeText({x:20,y:30},400,260,'se',100,50,100,150),{x:20,y:30,width:500,height:310});
assert.deepEqual(resizeText({x:20,y:30},400,260,'nw',50,20,100,150),{x:70,y:50,width:350,height:240});
const limited=resizeText({x:0,y:0},400,260,'se',3000,3000,100,150);
assert.equal(limited.width,1180);assert.equal(limited.height,570);
console.log('PASS: text resize anchors and slide bounds');
const {default:SlideText}=require('../app/components/SlideText.tsx');
const blank=renderToStaticMarkup(React.createElement(SlideText,{value:'',label:'표지 부제',onSave:async()=>{}}));
assert.match(blank,/contentEditable="true"/);
assert.match(blank,/data-placeholder="표지 부제/);

const {default:MovableText}=require('../app/components/MovableText.tsx');
const contentBox=renderToStaticMarkup(React.createElement(MovableText,{className:'text-content-box',moveLabel:'내용 이동',offset:{x:50,y:70},disabled:false,onSave(){}},'본문'));
assert.match(contentBox,/내용 이동/);assert.match(contentBox,/translate\(50px,70px\)/);
const exportedBox=renderToStaticMarkup(React.createElement(MovableText,{className:'text-content-box',moveLabel:'내용 이동',offset:{x:50,y:70},disabled:true,onSave(){}},'본문'));
assert.doesNotMatch(exportedBox,/text-content-move|text-resize-handle/);
assert.match(exportedBox,/translate\(50px,70px\)/);

assert.match(printing,/사업비/);
assert.match(printing,/class="metric-value"><span class="slidereadtext">50<\/span><small><span class="slidereadtext">%/);
assert.match(printing,/class="metric-value"><span class="slidereadtext">100<\/span><small><span class="slidereadtext">천원/);
const styledText=renderToStaticMarkup(React.createElement(SlideText,{value:'제목',label:'제목',style:{fontFamily:'Jua',fontSize:'64px',fontWeight:700,color:'#ff5500'},onSave:async()=>{}}));
assert.match(styledText,/font-family:Jua;font-size:64px;font-weight:700;color:#ff5500/);

const {formatRange,adjustRuns}=require('../lib/rich-text.ts');
const {RichText}=require('../app/components/SlideText.tsx');
const sentence='대상 시민\n기간 10월\n장소 시청';
let runs=formatRange(sentence,[],0,2,{size:40,bold:true});
runs=formatRange(sentence,runs,6,8,{color:'#ff0000',underline:true});
assert.deepEqual(runs,[{start:0,end:2,style:{size:40,bold:true}},{start:6,end:8,style:{color:'#ff0000',underline:true}}]);
const richOutput=renderToStaticMarkup(React.createElement(RichText,{value:sentence,runs}));
assert.match(richOutput,/font-size:40px;font-weight:700[^>]*>대상<\/span> 시민/);
assert.match(richOutput,/text-decoration:underline;color:#ff0000[^>]*>기간<\/span>/);
assert.ok(richOutput.endsWith(' 10월\n장소 시청'));
const cleared=formatRange(sentence,runs,0,2,{},true);
assert.deepEqual(cleared,[runs[1]]);
assert.deepEqual(adjustRuns(sentence,'새 '+sentence,runs).map(r=>[r.start,r.end]),[[2,4],[8,10]]);
assert.deepEqual(adjustRuns(sentence,sentence.slice(2),runs),[{...runs[1],start:4,end:6}]);
assert.equal(renderToStaticMarkup(React.createElement(RichText,{value:'<script>alert(1)</script>',runs:[{start:0,end:24,style:{bold:true}}]})).includes('<script>'),false);
console.log('PASS: selected text formatting, independent ranges, underline, safe print rendering, edits and clearing');

const {resizeTextScale}=require('../lib/text-layout.ts');
assert.equal(resizeTextScale({x:0,y:0},400,200,{x:0,y:0,width:600,height:300}),1.5);
assert.equal(resizeTextScale({x:0,y:0,textScale:1.5},600,300,{x:0,y:0,width:300,height:150}),0.75);
assert.equal(resizeTextScale({x:0,y:0},400,200,{x:0,y:0,width:600,height:200}),1);
const scaledPrint=renderToStaticMarkup(React.createElement(MovableText,{className:'text-content-box',moveLabel:'내용 이동',offset:{x:0,y:0,width:600,height:300,textScale:1.5},disabled:true,onSave(){}},'본문'));
assert.match(scaledPrint,/--content-text-scale:1.5/);
assert.doesNotMatch(scaledPrint,/text-resize-handle/);
console.log('PASS: proportional text resizing, repeated resize, fit ratio and printed scale');

const {imageGroups,arrangeInlineImages,addReportImages}=require('../lib/report-images.ts');
const pictures=[{id:'image-a',name:'첫째.png',layout:'inline'},{id:'image-b',name:'둘째.png',layout:'inline'}];
const together=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[{...row,purposeImages:pictures}]}));
const togetherPrint=together.slice(together.indexOf('class="deckprint'));
const togetherArticles=togetherPrint.split('<article').slice(1);
assert.equal(togetherArticles.filter(a=>a.includes('첫째.png')&&a.includes('둘째.png')).length,1);
assert.equal(togetherArticles.filter(a=>a.includes('reportdragimage')).length,1);
const apart=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[{...row,purposeImages:pictures.map(img=>({...img,layout:'separate'}))}]}));
const apartPrint=apart.slice(apart.indexOf('class="deckprint'));
const apartArticles=apartPrint.split('<article').slice(1);
assert.equal(apartArticles.filter(a=>a.includes('reportdragimage')).length,2);
assert.equal(apartArticles.filter(a=>a.includes('첫째.png')&&a.includes('둘째.png')).length,0);
assert.equal(imageGroups(Array.from({length:7},(_,i)=>({id:String(i),name:i+'.png',layout:'inline'}))).length,2);
const positioned=arrangeInlineImages(pictures);
assert.ok(positioned[0].bounds.y+positioned[0].bounds.height<positioned[1].bounds.y);
assert.deepEqual(addReportImages(positioned,[{...pictures[0],layout:'separate'}]).map(i=>i.layout),['separate','inline']);
assert.equal(addReportImages(positioned,pictures).length,2);
const onlyResults=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[{...row,purposeImages:pictures,resultsImages:[{id:'result',name:'실적.png',layout:'inline'}]}]}));
assert.ok(onlyResults.includes('실적.png'));
console.log('PASS: multiple images on one slide, separate image slides, distinct bounds, deduplication and six-image grouping');

const {default:ImageLayoutEditor}=require('../app/components/ImageLayoutEditor.tsx');
const directEditor=renderToStaticMarkup(React.createElement(ImageLayoutEditor,{images:positioned,text:'사업 본문',sectionLabel:'사업개요',onApply(){},onTextChange(){}}));
assert.equal((directEditor.match(/class="resizehandle /g)||[]).length,16);
assert.equal((directEditor.match(/role="group"/g)||[]).length,2);
assert.ok(directEditor.includes('첫째.png 이미지: 직접 끌어 이동')&&directEditor.includes('둘째.png 이미지: 직접 끌어 이동'));
assert.doesNotMatch(directEditor,/layoutimage-other/);
const {default:SectionImages}=require('../app/components/SectionImages.tsx');
const directSection=renderToStaticMarkup(React.createElement(SectionImages,{projectId:row.id,ready:true,images:positioned,sectionLabel:'사업개요',bodyText:'사업 본문',onChange(){},onTextChange(){}}));
assert.doesNotMatch(directSection,/bodyimagetabs|본문에서 선택/);
const {dragImageBounds}=require('../lib/image-layout.ts');
const firstMoved=dragImageBounds(positioned[0].bounds,'move',-10,5);
assert.equal(firstMoved.x,45);assert.equal(firstMoved.y,10);
const secondResized=dragImageBounds(positioned[1].bounds,'nw',-5,-5);
assert.equal(secondResized.width,50);assert.equal(secondResized.height,48.5);
assert.equal(positioned[0].bounds.x,55);
assert.equal(positioned[1].bounds.width,45);
console.log('PASS: every image directly movable and resizable, no image selection tabs, independent drag geometry');

const previouslySeparate=pictures.map(img=>({...img,layout:'separate'}));
const reapplied=addReportImages(previouslySeparate,pictures.map(img=>({...img,layout:'inline'})));
assert.equal(reapplied.length,2);
assert.ok(reapplied.every(img=>img.layout==='inline'));
assert.ok(reapplied[0].bounds.y+reapplied[0].bounds.height<reapplied[1].bounds.y);
const reappliedOutput=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[{...row,purposeImages:reapplied}]}));
const reappliedPrint=reappliedOutput.slice(reappliedOutput.indexOf('class="deckprint'));
assert.equal(reappliedPrint.split('<article').filter(a=>a.includes('첫째.png')&&a.includes('둘째.png')).length,1);
assert.ok(addReportImages(reapplied,previouslySeparate).every(img=>img.layout==='separate'));
console.log('PASS: apply changed layout to all existing attachments, same-slide render, no duplicates and separate-mode reversal');

const {createFrameBatch}=require('../lib/frame-batch.ts');
const callbacks=new Map(),commits=[];let frameSequence=0;
const frameBatch=createFrameBatch(value=>commits.push(value),callback=>{const id=++frameSequence;callbacks.set(id,callback);return id;},id=>callbacks.delete(id));
frameBatch.push({x:1,y:2});frameBatch.push({x:5,y:6});frameBatch.push({x:9,y:10});
assert.equal(callbacks.size,1);assert.equal(commits.length,0);
const firstFrame=[...callbacks.values()][0];callbacks.clear();firstFrame();
assert.deepEqual(commits,[{x:9,y:10}]);
frameBatch.push({x:20,y:30});frameBatch.flush();
assert.deepEqual(commits[1],{x:20,y:30});assert.equal(callbacks.size,0);
frameBatch.push({x:40,y:50});frameBatch.cancel();
assert.equal(callbacks.size,0);assert.equal(commits.length,2);
console.log('PASS: pointer updates batched per frame, final drop position flushed, cancellation and cleanup');

const originSection=renderToStaticMarkup(React.createElement(SectionImages,{projectId:row.id,ready:true,images:[{id:'department',name:'부서입력이미지.png',origin:'department',layout:'inline'},{id:'report',name:'보고서전용이미지.png',origin:'report',layout:'inline'}],sectionLabel:'사업개요',bodyText:'본문',onChange(){},onTextChange(){}}));
assert.ok(originSection.includes('부서입력이미지.png'));
assert.ok(!originSection.includes('보고서전용이미지.png'));
console.log('PASS: report-only images excluded from department input image controls');

const {default:Attachments}=require('../app/components/Attachments.tsx');
const attachmentOptions=renderToStaticMarkup(React.createElement(Attachments,{projectId:'demo',editable:true,onAddToReport(){}}));
assert.match(attachmentOptions,/value="inline" selected="">본문과 함께/);
assert.doesNotMatch(attachmentOptions,/value="separate" selected=/);
console.log('PASS: new attachment images default to multiple images with body on one slide');

const {entryRole,openAccessBody,tabSession,rememberTab,tabHeaders,clearTab}=require('../lib/tab-session.ts');
assert.equal(entryRole('department','saved-management-key',{role:'coordinator'}),'department');
assert.equal(entryRole(null,'',null),'department');
assert.deepEqual(openAccessBody('department','참여부서','saved-management-key'),{entryRole:'department',department:'참여부서',coordinatorKey:''});
assert.equal(openAccessBody('coordinator','주관부서','saved-management-key').coordinatorKey,'saved-management-key');
const store=new Map();global.sessionStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
rememberTab('REPORT1','a'.repeat(64),'department','참여부서');
assert.equal(tabSession('REPORT1').role,'department');assert.equal(tabHeaders('REPORT1').get('X-Report-Session'),'a'.repeat(64));
assert.equal(tabHeaders('REPORT2').get('X-Report-Session'),null);clearTab('REPORT1');assert.equal(tabSession('REPORT1'),null);delete global.sessionStorage;
console.log('PASS: explicit role choice and participant payload cannot reuse coordinating credentials; tab context persists and clears independently');

const {paginateSource,applyPageEdits,projectTextValue,clearProjectOverrides,storedProjectChanges}=require('../lib/report-source.ts');
const longBody='첫째 줄\n둘째 줄이 길어집니다\n셋째 줄\n마지막 원문';
const bodyPages=paginateSource(longBody,6,2);assert.deepEqual(bodyPages.map(p=>p.text),paginate(longBody,6,2));
const middle=bodyPages[1];const changedBody=applyPageEdits(longBody,[{...middle,value:'수정한 본문'}]);assert.equal(changedBody,longBody.slice(0,middle.start)+'수정한 본문'+longBody.slice(middle.end));assert.ok(changedBody.endsWith('마지막 원문'));
const unicodePages=paginateSource('😀가나다😀마지막',2,1);assert.equal(applyPageEdits('😀가나다😀마지막',[{...unicodePages[1],value:'바뀜'}]),'😀가바뀜😀마지막');
assert.equal(projectTextValue('status','추진 중'),'진행');assert.match(printing,/>추진 중</);assert.doesNotMatch(printing,/>진행</);
assert.equal(projectTextValue('budget','70,000천원'),70000);assert.equal(projectTextValue('progress','40%'),40);assert.throws(()=>projectTextValue('progress','150%'));
assert.deepEqual(clearProjectOverrides({'project사업개요0:title':'old','project향후 추진계획0:title':'old','toc-0:tocTitle-project':'old','project사업개요0:purpose':'keep','cover:coverTitle':'keep'},'project','title'),{'project사업개요0:purpose':'keep','cover:coverTitle':'keep'});
const migratedText=storedProjectChanges({id:'source',purpose:longBody,progress:1,budget:1},bodyPages.map((p,i)=>({key:'source사업개요'+i,section:'사업개요',bodyRange:p})),{'source사업개요1:purpose':'수정한 본문','source사업개요0:progress':'40','source사업개요0:budget':'70,000','source사업개요0:title':'수정된 사업명'});
assert.equal(migratedText.purpose,changedBody);assert.equal(migratedText.title,'수정된 사업명');assert.equal(migratedText.progress,40);assert.equal(migratedText.budget,70000);
console.log('PASS: source text synchronization, paginated edits preserve other pages and Unicode, numeric values and legacy override cleanup');

const {selectedProjects,readSelection,toggleProject}=require('../lib/report-selection.ts');
const pickRows=[{...row,id:'11111111-1111-4111-8111-111111111111'}, {...row,id:'22222222-2222-4222-8222-222222222222',title:'제외할 사업'}, {...row,id:'33333333-3333-4333-8333-333333333333'}];
assert.deepEqual(selectedProjects(pickRows,[pickRows[2].id,pickRows[0].id]).map(r=>r.id),[pickRows[0].id,pickRows[2].id]);
assert.deepEqual(selectedProjects(pickRows,[]),[]);
assert.deepEqual(toggleProject(pickRows,null,pickRows[1].id),[pickRows[0].id,pickRows[2].id]);
assert.deepEqual(readSelection(pickRows[0].id+',invalid,'+pickRows[0].id),[pickRows[0].id]);
const pickedDeck=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:selectedProjects(pickRows,[pickRows[0].id]),readOnly:true}));
assert.doesNotMatch(pickedDeck,/제외할 사업/);
assert.equal(entryRole('viewer','saved-management-key',{role:'coordinator'}),'viewer');
assert.equal(openAccessBody('viewer','','saved-management-key').coordinatorKey,'');
const {ReportApp}=require('../app/page.tsx');
const executive=renderToStaticMarkup(React.createElement(ReportApp,{workspace:{id:'VIEWERREPORT',department:'주관부서',title:'업무보고',pinLength:-1,role:'viewer'}}));
assert.match(executive,/상급자 조회/);assert.match(executive,/선택한 사업 발표하기/);
assert.doesNotMatch(executive,/부서별 입력|보고서 편집|사업 등록|보고서 관리 · 삭제|업무명·분야 설정/);
console.log('PASS: executive-only menus, selection keeps report order, deselection and final deck filtering, viewer never reuses coordinator key');

assert.equal(includeSection('현황',['situation']),true);
assert.equal(includeSection('현황',['purpose']),false);
const situationReport=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[{...row,situation:'사업의 현재 여건과 현황'}],readOnly:true}));
const situationPrint=situationReport.slice(situationReport.indexOf('class="deckprint'));
assert.ok(situationPrint.indexOf('사업의 현재 여건과 현황')<situationPrint.indexOf('사업 개요'));
assert.ok(situationPrint.includes('사업의 현재 여건과 현황'));
assert.ok(!printing.includes('/ 현황'));
const {storedProjectChanges:storedSituationChanges}=require('../lib/report-source.ts');
assert.deepEqual(storedSituationChanges({...row,situation:'기존 현황'},[{key:'demo현황0',section:'현황',bodyRange:{start:0,end:5}}],{'demo현황0:situation':'수정된 현황'}),{situation:'수정된 현황'});
console.log('PASS: situation precedes overview, selectable section, empty legacy records omit situation, source synchronization');

const {presentationSections,toggleSection}=require('../app/components/ReportDeck.tsx');
assert.match(viewing,/발표에 포함할 항목/);
assert.match(viewing,/현재 조회 화면에만 적용/);
for(const label of ['현황','사업개요','추진현황','향후계획'])assert.ok(viewing.includes(label));
assert.deepEqual(toggleSection(['purpose'],'situation'),['purpose','situation']);
assert.deepEqual(toggleSection(['situation','purpose'],'purpose'),['situation']);
assert.deepEqual(toggleSection(['purpose'],'purpose'),['purpose']);
assert.equal(presentationSections(['unknown']),null);
assert.equal(presentationSections([]),null);
assert.deepEqual(presentationSections(['situation','purpose','situation']),['situation','purpose']);
console.log('PASS: read-only presentation exposes all section choices, preserves one section, validates local selections');

// Closing an expired-session prompt hides only the prompt; it cannot unlock editing.
{
 const {default:WorkspaceGate}=require('../app/components/WorkspaceGate.tsx');
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect};
 const oldWindow=global.window;const states=[],refs=[],events=new Map();let si=0,ri=0,registered=false;
 const workspace={id:'TESTREPORT01',department:'총괄부서',title:'보고서',pinLength:-1,role:'coordinator',sessionDepartment:'총괄부서'};
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=i===0?workspace:i===1?false:typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};
 React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};
 React.useEffect=fn=>{if(!registered&&fn.toString().includes('report-session-expired')){fn();registered=true;}};
 global.window={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener(){}};
 function render(){si=ri=0;return WorkspaceGate({children:()=>React.createElement('input',{defaultValue:'작성 중인 내용 유지'})});}
 function button(tree,label){if(!tree||typeof tree!=='object')return null;if(tree.type==='button'&&(tree.props['aria-label']===label||tree.props.children===label))return tree;for(const child of React.Children.toArray(tree.props?.children)){const match=button(child,label);if(match)return match;}return null;}
 try{
  render();events.get('report-session-expired')();let tree=render();assert.ok(button(tree,'보고서 다시 열기 창 닫기'));
  button(tree,'보고서 다시 열기 창 닫기').props.onClick();tree=render();let html=renderToStaticMarkup(tree);
  assert.ok(html.includes('접속 시간이 만료'));assert.ok(html.includes('inert=""'));assert.ok(html.includes('작성 중인 내용 유지'));assert.ok(!html.includes('class="workspace-lock"'));
  events.get('report-session-expired')();assert.ok(!renderToStaticMarkup(render()).includes('class="workspace-lock"'));
  button(tree,'보고서 다시 열기').props.onClick();assert.ok(button(render(),'보고서 다시 열기 창 닫기'));
  states[19]=true; // Entry began in recipient mode.
  events.get('report-change-access')();tree=render();html=renderToStaticMarkup(tree);assert.ok(html.includes('개별부서 입력'));assert.ok(html.includes('총괄부서 입력'));assert.ok(!html.includes('보고받을 보고서를 선택하세요'));button(tree,'접속 부서·권한 변경 창 닫기').props.onClick();html=renderToStaticMarkup(render());assert.ok(!html.includes('class="workspace-lock"'));assert.ok(!html.includes('inert=""'));
 }finally{Object.assign(React,original);if(oldWindow===undefined)delete global.window;else global.window=oldWindow;}
 console.log('PASS: expired prompt closes without discarding draft/unlocking editing, repeated expiry stays dismissed, reopen works, manual access change cancels');
}

// Recipient business links launch the entire report at that business; sample authoring stays available.
{
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect};
 const states=[],refs=[];let si=0,ri=0;
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};
 React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const c of React.Children.toArray(tree.props?.children)){const found=find(c,predicate);if(found)return found;}return null;}
 const workspace={id:'READREPORT',department:'총괄부서',title:'보고서',pinLength:-1,role:'viewer'};
 function app(){si=ri=0;return ReportApp({workspace});}
 try{
  app();const rowsIndex=states.findIndex((v,i)=>i>2&&Array.isArray(v));assert.ok(rowsIndex>=0);states[rowsIndex]=pickRows;
  let tree=app();const link=find(tree,n=>n.type==='button'&&n.props['aria-label']===pickRows[1].title+' 전체 발표 보기');assert.ok(link);
  const html=renderToStaticMarkup(tree);assert.ok(!html.includes('사업 관리</th>'));assert.ok(!html.includes('class="project-delete"'));
  link.props.onClick({stopPropagation(){}});tree=app();const deck=find(tree,n=>n.type===ReportDeck);assert.ok(deck);assert.equal(deck.props.startProject.id,pickRows[1].id);assert.equal(deck.props.rows.length,3);assert.equal(deck.props.readOnly,true);
  deck.props.onBack();assert.ok(find(app(),n=>n.type==='button'&&n.props['aria-label']===pickRows[1].title+' 전체 발표 보기'));
  const sample=renderToStaticMarkup(React.createElement(ReportApp,{workspace:{...workspace,id:'6979E2190EBC',role:'coordinator',sessionDepartment:'예시 총괄부서'}}));assert.match(sample,/부서별 입력/);assert.match(sample,/보고서 편집/);
 }finally{Object.assign(React,original);}
 console.log('PASS: recipient business click opens full read-only report at chosen business, returns to list, hides delete, sample retains input and editing');
}

{
 const {projectOverview,departmentOverview,projectBrief}=require('../lib/project-overview.ts');
 const data=[{...row,id:'one',department:'부서A',budget:100,progress:50,status:'진행',purpose:'기간: 10월\n내용: 시민 교육 확대'}, {...row,id:'two',department:'부서B',budget:300,progress:100,status:'완료'}];
 assert.deepEqual(projectOverview(data),{total:2,departments:2,counts:{예정:0,진행:1,완료:1,지연:0},average:75,budget:400});
 assert.equal(projectOverview([]).average,0);assert.equal(projectOverview([{...row,budget:NaN,progress:NaN}]).budget,0);
 assert.equal(departmentOverview(data).length,2);assert.equal(projectBrief(data[0]),'시민 교육 확대');assert.equal(projectBrief({situation:'※ 예시입니다\n현재 교육 중'}),'현재 교육 중');
 const many=Array.from({length:7},(_,i)=>({...row,id:'overview-project-'+i,title:'요약 사업 '+i,budget:(i+1)*100}));
 const output=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:many,readOnly:true}));
 const print=output.slice(output.indexOf('class="deckprint'));const articles=print.split('<article').slice(1);
 assert.ok(articles[0].startsWith(' class="pptcanvas pptcover"'));assert.ok(articles[1].includes('ppttoc'));assert.ok(articles[2].includes('ppttoc'));assert.ok(articles[3].startsWith(' class="pptcanvas ppt-overview"'));assert.ok(articles[4].startsWith(' class="pptcanvas ppt-overview"'));assert.ok(articles[5].includes('요약 사업 0'));
 assert.equal((articles[3].match(/class="ppt-overview-business"/g)||[]).length,6);assert.equal((articles[4].match(/class="ppt-overview-business"/g)||[]).length,1);
 assert.match(articles[1],/>6쪽</);assert.match(articles[2],/>24쪽</);assert.ok(articles[3].includes('2,800'));assert.ok(!print.includes('contentEditable'));
 const filtered=renderToStaticMarkup(React.createElement(ReportDeck,{...props,rows:[many[1]],readOnly:true}));assert.ok(!filtered.includes('요약 사업 0'));assert.ok(filtered.includes('요약 사업 1'));
 console.log('PASS: summary totals and excerpts, cover → all TOC pages → six-business summary pages → details, accurate TOC offsets, selected scope and printed summaries');
}

{
 const {MoaOverview}=require('../app/components/BriefingCatalog.tsx');
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useMemo:React.useMemo};
 let states=[],refs=[],si=0,ri=0;const opened=[];
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};React.useMemo=fn=>fn();
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const result=find(child,predicate);if(result)return result;}return null;}
 const businesses=[{...row,id:'a',workspace:'report-a',reportTitle:'보고서 A',summary:'시민 교육',department:'부서 A'},{...row,id:'b',workspace:'report-b',reportTitle:'보고서 B',summary:'행정 개선',department:'부서 B',title:'다른 부서 사업',budget:200,progress:100,status:'완료'}];
 try{
  function moa(){si=ri=0;return MoaOverview({rows:businesses,onOpen:p=>opened.push(p.id)});}
  let tree=moa();let html=renderToStaticMarkup(tree);assert.ok(html.indexOf('총괄 사업현황')<html.indexOf('부서별 현황'));assert.ok(html.indexOf('부서별 현황')<html.indexOf('개별사업 요약"'));assert.ok(html.includes('75'));assert.ok(html.includes('300'));
  const group=find(tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined&&React.Children.toArray(n.props.children).some(child=>child.type==='strong'&&child.props.children==='부서 A'));assert.ok(group);group.props.onClick();tree=moa();html=renderToStaticMarkup(tree);assert.ok(!html.includes('다른 부서 사업'));const business=find(tree,n=>n.type==='button'&&n.props.className==='business-present');business.props.onClick();assert.deepEqual(opened,['a']);
  states=[];refs=[];
  function deck(){si=ri=0;return ReportDeck({...props,rows:businesses,readOnly:true});}
  tree=deck();let nav=find(tree,n=>n.type==='nav'&&n.props['aria-label']==='슬라이드 목록');const summaryButton=React.Children.toArray(nav.props.children).find(n=>n.props.children[1].props.children[1].props.children[0]==='총괄 사업현황');assert.ok(summaryButton);summaryButton.props.onClick();tree=deck();let stage=find(tree,n=>n.props?.className==='deckstage');const summaryLink=find(stage,n=>n.type==='button'&&n.props.className==='ppt-overview-business');assert.ok(summaryLink);summaryLink.props.onClick();tree=deck();stage=find(tree,n=>n.props?.className==='deckstage');assert.ok(!find(stage,n=>n.props?.className==='ppt-overview-grid'));assert.ok(renderToStaticMarkup(stage).includes('시민 AI 교육'));
  const back=find(tree,n=>n.type==='button'&&n.props.children==='총괄 현황');assert.ok(back);back.props.onClick();stage=find(deck(),n=>n.props?.className==='deckstage');assert.ok(find(stage,n=>n.props?.className==='ppt-overview-grid'));
 }finally{Object.assign(React,original);}
 console.log('PASS: Moa aggregate-first layout, department drill-down, business opening, summary-to-detail slide navigation and return to overview');
}

{
 const {selectedInputSections,toggleInputSection}=require('../lib/input-sections.ts');const {default:InputSectionPicker}=require('../app/components/InputSectionPicker.tsx');
 assert.deepEqual(selectedInputSections(undefined),['situation','purpose','results','plan']);assert.deepEqual(selectedInputSections([]),[]);
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect};const states=[],refs=[];let si=0,ri=0;
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const result=find(child,predicate);if(result)return result;}return null;}
 const business={...row,situation:'보관할 현황',purpose:'보관할 개요',results:'보관할 실적',plan:'보관할 계획'};
 const workspace={id:'INPUTREPORT1',department:'총괄부서',title:'보고서',pinLength:-1,role:'department',sessionDepartment:row.department};
 function app(){si=ri=0;return ReportApp({workspace});}
 try{
  app();states[states.findIndex((v,i)=>i>2&&Array.isArray(v))]=[business];let tree=app();const tr=find(tree,n=>n.type==='tr'&&n.props.onClick);assert.ok(tr);tr.props.onClick();tree=app();let picker=find(tree,n=>n.type===InputSectionPicker);assert.ok(picker);assert.ok(find(tree,n=>n.type==='textarea'&&n.props.value==='보관할 개요'));
  picker.props.onChange(toggleInputSection(picker.props.value,'purpose'));tree=app();assert.ok(!find(tree,n=>n.type==='textarea'&&n.props.value==='보관할 개요'));assert.equal(states.find(v=>v?.id===row.id).purpose,'보관할 개요');
  picker=find(tree,n=>n.type===InputSectionPicker);picker.props.onChange(toggleInputSection(picker.props.value,'purpose'));tree=app();assert.ok(find(tree,n=>n.type==='textarea'&&n.props.value==='보관할 개요'));
  const add=find(tree,n=>n.type==='button'&&n.props.className==='section-page-add'&&React.Children.toArray(n.props.children).join('').includes('사업개요'));assert.ok(add);add.props.onClick();tree=app();let secondPage=find(tree,n=>n.type==='textarea'&&n.props['aria-label']==='사업개요 2페이지 본문');assert.ok(secondPage);secondPage.props.onChange({target:{value:'두 번째 개요'}});tree=app();assert.equal(states.find(v=>v?.id===row.id).purpose,'보관할 개요\f두 번째 개요');const secondImages=find(tree,n=>n.type===SectionImages&&n.props.sectionLabel==='사업개요 · 2페이지');secondImages.props.onChange([{id:'second-page-image',name:'두번째.png',layout:'inline'}]);tree=app();assert.equal(states.find(v=>v?.id===row.id).purposeImages[0].page,1);assert.ok(find(tree,n=>n.type==='textarea'&&n.props.value==='보관할 개요'));assert.ok(find(tree,n=>n.type==='textarea'&&n.props.value==='두 번째 개요'));
  picker=find(tree,n=>n.type===InputSectionPicker);picker.props.onChange([]);tree=app();for(const value of ['보관할 현황','보관할 개요','보관할 실적','보관할 계획'])assert.ok(!find(tree,n=>n.type==='textarea'&&n.props.value===value));assert.ok(renderToStaticMarkup(tree).includes('사업 예산 (천원)'));assert.equal(states.find(v=>v?.id===row.id).results,'보관할 실적');
 }finally{Object.assign(React,original);}
 console.log('PASS: department input sections hide/show immediately, preserve hidden source content, allow all optional sections off and keep core business fields visible');
}

{
 const {normalizeBounds,fitImageBounds,resizeImageBounds,alignImageBounds,imageHandles,imageCanvasRatio}=require('../lib/image-layout.ts');
 const frame={x:10,y:10,width:60,height:70};const fit=fitImageBounds(frame,1200,600);assert.ok(Math.abs(fit.width/fit.height*imageCanvasRatio-2)<1e-9);assert.ok(Math.abs(fit.x+fit.width/2-(frame.x+frame.width/2))<1e-9);assert.ok(Math.abs(fit.y+fit.height/2-(frame.y+frame.height/2))<1e-9);
 assert.deepEqual(normalizeBounds({x:0,y:0,width:100,height:100}),{x:0,y:0,width:100,height:100});assert.ok(Number.isFinite(normalizeBounds({x:NaN,y:NaN,width:NaN,height:NaN}).width));
 let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<250;n++){const width=1+random()*90,height=1+random()*90;const b={x:random()*(100-width),y:random()*(100-height),width,height};for(const handle of imageHandles){const next=resizeImageBounds(b,handle.id,(random()-.5)*400,(random()-.5)*400);assert.ok(next.x>=-1e-8&&next.y>=-1e-8);assert.ok(next.x+next.width<=100+1e-8&&next.y+next.height<=100+1e-8);assert.ok(next.width>0&&next.height>0);assert.ok(Math.abs(next.width/next.height-b.width/b.height)<1e-8);}}
 assert.equal(alignImageBounds(fit,'left').x,0);assert.equal(alignImageBounds(fit,'right').x+fit.width,100);assert.equal(alignImageBounds(fit,'top').y,0);assert.equal(alignImageBounds(fit,'bottom').y+fit.height,100);
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useMemo:React.useMemo};const oldRAF=global.requestAnimationFrame,oldCancel=global.cancelAnimationFrame;let states=[],refs=[],si=0,ri=0,frameId=0;const callbacks=new Map(),saves=[];
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};React.useMemo=fn=>fn();global.requestAnimationFrame=fn=>{callbacks.set(++frameId,fn);return frameId;};global.cancelAnimationFrame=id=>callbacks.delete(id);
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const result=find(child,predicate);if(result)return result;}return null;}
 function editor(){si=ri=0;return ImageLayoutEditor({images:[{id:'tight-image',name:'사진.png',bounds:frame}],text:'본문',sectionLabel:'사업개요',onApply:(id,bounds)=>saves.push({id,bounds}),onTextChange(){}});}
 const event=(x,y)=>({button:0,clientX:x,clientY:y,pointerId:1,preventDefault(){},stopPropagation(){},currentTarget:{setPointerCapture(){}}});
 try{
  let tree=editor();find(tree,n=>n.type==='img').props.onLoad({currentTarget:{naturalWidth:1200,naturalHeight:600}});tree=editor();const canvas=find(tree,n=>n.props?.className==='layoutcanvas');canvas.props.ref.current={getBoundingClientRect:()=>({width:1168,height:430})};let group=find(tree,n=>n.props?.role==='group');assert.equal(group.props.style.width,fit.width+'%');assert.equal(group.props.style.height,fit.height+'%');
  const edge=find(group,n=>n.props?.className==='resizehandle e');assert.ok(edge);edge.props.onPointerDown(event(200,150));edge.props.onPointerMove(event(316.8,150));edge.props.onPointerUp(event(316.8,150));assert.equal(saves.length,1);assert.equal(saves[0].id,'tight-image');assert.ok(Math.abs(saves[0].bounds.width/saves[0].bounds.height-fit.width/fit.height)<1e-9);assert.ok(saves[0].bounds.width>fit.width);
  tree=editor();group=find(tree,n=>n.props?.role==='group');group.props.onPointerDown(event(100,100));group.props.onPointerMove(event(200,100));group.props.onPointerCancel();assert.equal(saves.length,1);
 }finally{Object.assign(React,original);if(oldRAF===undefined)delete global.requestAnimationFrame;else global.requestAnimationFrame=oldRAF;if(oldCancel===undefined)delete global.cancelAnimationFrame;else global.cancelAnimationFrame=oldCancel;}
 console.log('PASS: image frames fit visible original aspect, all eight handles retain ratio and canvas bounds, four-edge alignment, direct side resize saves once and pointer cancel does not save');
}

{
 const situation=renderToStaticMarkup(React.createElement(ReportDeck,{...props,readOnly:true,rows:[{...row,situation:'',situationImages:[{id:'situation-shot',name:'현황 캡처.png',layout:'inline'}]}]}));
 const detail=situation.slice(situation.indexOf('class="deckprint'));assert.ok(detail.includes('situation-shot'));assert.ok(detail.includes('ppt-detail'));assert.ok(detail.includes('현황 캡처.png'));
 console.log('PASS: pasted situation images appear in their own detail slide even without text, compact layout applies to detail slides');
}

{
 const hint='본문을 입력하거나 이미지를 붙여넣으세요.';
 const {reportBodyText}=require('../lib/report-source.ts');assert.equal(reportBodyText(hint),'');assert.equal(reportBodyText('내용을 클릭하여 입력'),'');assert.equal(reportBodyText('실제 입력 내용'),'실제 입력 내용');
 const image={id:'image-only',name:'화면 캡처.png',layout:'inline'};
 const input=renderToStaticMarkup(React.createElement(ImageLayoutEditor,{images:[image],text:'',sectionLabel:'현황',onTextChange(){},onApply(){}}));assert.ok(!input.includes(hint));
 for(const body of ['',hint,'실제 입력 내용']){const html=renderToStaticMarkup(React.createElement(ReportDeck,{...props,readOnly:true,rows:[{...row,purpose:body,purposeImages:[image]}]}));const output=html.slice(html.indexOf('class="deckprint'));assert.ok(!output.includes(hint));assert.ok(!output.includes('내용을 클릭하여 입력'));assert.ok(output.includes('image-only'));if(body==='실제 입력 내용')assert.ok(output.includes(body));}
 console.log('PASS: image-only input hides prompt; final presentation and print omit editor prompts and retain real content and images');
}

{
 const {sectionPageSlides,sectionPageParts,replaceSectionPageImages}=require('../lib/section-pages.ts');
 const {applyPageEdits}=require('../lib/report-source.ts');
 const source='첫 페이지 한글😀\f두 번째 페이지\f';const images=[{id:'first-img',name:'첫.png',layout:'inline'},{id:'second-img',name:'둘.png',layout:'inline',page:1}];const pages=sectionPageSlides(source,images,32);
 assert.equal(pages.length,3);assert.deepEqual(pages.map(p=>p.manualPage),[0,1,2]);assert.equal(pages[0].inlineImages[0].id,'first-img');assert.equal(pages[1].inlineImages[0].id,'second-img');assert.equal(pages[2].body,'');
 assert.equal(applyPageEdits(source,[{...pages[1].bodyRange,value:'두 번째 수정'}]),'첫 페이지 한글😀\f두 번째 수정\f');assert.equal(applyPageEdits(source,[{...pages[2].bodyRange,value:'새 내용'}]),'첫 페이지 한글😀\f두 번째 페이지\f새 내용');
 const retained=replaceSectionPageImages(images,1,[{id:'new',name:'새.png',layout:'inline'}]);assert.equal(retained[0].id,'first-img');assert.equal(retained[1].page,1);assert.equal(sectionPageParts(source).length,3);
 const html=renderToStaticMarkup(React.createElement(ReportDeck,{...props,readOnly:true,rows:[{...row,purpose:source,purposeImages:images}]}));const printed=html.slice(html.indexOf('class="deckprint'));assert.ok(printed.indexOf('first-img')<printed.indexOf('second-img'));assert.ok(printed.includes('두 번째 페이지'));assert.ok(printed.includes('(1/3)'));assert.ok(printed.includes('(3/3)'));assert.ok(!html.includes('이 항목 페이지 추가'));
 console.log('PASS: manual section pages preserve blank pages, Unicode offsets and independent images, input add/edit persists separate pages, final presentation retains page order and hides edit buttons');
}

{
 const content='○ 기 간 : 2026. 9. ~2026. 11.\n○ 대 상 : 공무원 500명\n○ 장 소 : 한국기술교육대학교 제2캠퍼스';
 const {sectionPageSlides}=require('../lib/section-pages.ts');
 const pages=sectionPageSlides(content,[],32);assert.equal(pages.length,1);assert.equal(pages[0].body,content);assert.ok(pages[0].body.includes('2026. 11.'));assert.ok(pages[0].body.includes('제2캠퍼스'));
 const wideText='기간: 2026. 9. ~2026. 11. / 장소: 한국기술교육대학교 제2캠퍼스';const lines=paginateSource(wideText,8,20);assert.equal(lines.length,1);assert.equal(lines[0].text,wideText);assert.equal(lines[0].text.includes('\n'),false);
 const long=('한글😀와 날짜 2026. 11. 원문입니다. '.repeat(100))+'\n사용자가 직접 나눈 줄';const chunks=paginateSource(long,20,4);assert.ok(chunks.length>1);for(const page of chunks)assert.equal(page.text,long.slice(page.start,page.end));assert.equal(applyPageEdits(long,chunks.map(page=>({...page,value:page.text}))),long);
 const manual=sectionPageSlides(content+'\f다음 페이지\n직접 줄바꿈',[],32);assert.equal(manual[1].body,'다음 페이지\n직접 줄바꿈');
 console.log('PASS: dates and place names have no injected line breaks, user newlines remain, automatic/manual pagination and Unicode source edits preserve exact original text');
}

{
 const {sectionPageSlides}=require('../lib/section-pages.ts');assert.ok(sectionPageSlides('가'.repeat(500),[],32,2.5).length>sectionPageSlides('가'.repeat(500),[],32,1).length);
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useMemo:React.useMemo},oldStorage=global.sessionStorage,oldFetch=global.fetch;let states=[],refs=[],si=0,ri=0;const requests=[],local=new Map();global.sessionStorage={getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)};global.fetch=async(url,init)=>{requests.push(JSON.parse(init.body));return Response.json({});};
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};React.useMemo=fn=>fn();
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const found=find(child,predicate);if(found)return found;}return null;}
 function deck(readOnly){si=ri=0;return ReportDeck({...props,readOnly});}
 try{
  let tree=deck(true);states[states.indexOf('loading')-1]=true;tree=deck(true);let control=find(tree,n=>n.type==='select'&&n.props['aria-label']==='발표 본문 줄 간격');assert.equal(control.props.value,1.5);control.props.onChange({target:{value:'2'}});tree=deck(true);assert.equal(requests.length,0);assert.ok([...local.values()].includes('2'));const viewingMarkup=renderToStaticMarkup(tree);assert.equal((viewingMarkup.match(/--report-line-height:2/g)||[]).length,2);
  states=[];refs=[];tree=deck(false);states[states.indexOf('loading')-1]=true;tree=deck(false);control=find(tree,n=>n.type==='select'&&n.props['aria-label']==='발표 본문 줄 간격');control.props.onChange({target:{value:'1.2'}});assert.equal(requests.length,1);assert.equal(requests[0].design.bodyLineHeight,1.2);tree=deck(false);assert.equal(find(tree,n=>n.type==='select'&&n.props['aria-label']==='발표 본문 줄 간격').props.value,1.2);
 }finally{Object.assign(React,original);global.fetch=oldFetch;if(oldStorage===undefined)delete global.sessionStorage;else global.sessionStorage=oldStorage;}
 console.log('PASS: line-spacing control updates deck and print styles, editor saves settings, viewers change only local presentation, pagination follows selected spacing');
}

{
 const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useMemo:React.useMemo},oldDocument=global.document;let states=[],refs=[],si=0,ri=0;global.document={fullscreenElement:null};
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};React.useMemo=fn=>fn();
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const found=find(child,predicate);if(found)return found;}return null;}
 function deck(){si=ri=0;return ReportDeck(props);}
 try{let tree=deck();assert.ok(!find(tree,n=>n.props?.className==='presentation-exit'));const enter=find(tree,n=>n.type==='button'&&n.props.children==='전체화면 발표');enter.props.onClick();tree=deck();assert.ok(find(tree,n=>typeof n.props?.className==='string'&&n.props.className.startsWith('deck ')&&n.props.className.endsWith('presenting')));const exit=find(tree,n=>n.props?.className==='presentation-exit');assert.ok(exit);exit.props.onClick();tree=deck();assert.ok(!find(tree,n=>n.props?.className==='presentation-exit'));assert.ok(!find(tree,n=>typeof n.props?.className==='string'&&n.props.className.startsWith('deck ')&&n.props.className.endsWith('presenting')));assert.ok(find(tree,n=>n.type==='select'&&n.props['aria-label']==='발표 본문 줄 간격'));
 }finally{Object.assign(React,original);if(oldDocument===undefined)delete global.document;else global.document=oldDocument;}
 console.log('PASS: presentation fallback enters full-screen slide mode, separate exit returns to editor and line-spacing controls remain available after exit');
}

{
 const {MoaOverview}=require('../app/components/BriefingCatalog.tsx');
 const real={id:'real-report-project',workspace:'REALREPORT01',reportTitle:'실제 업무보고',department:'실제부서',title:'실제 사업',field:'행정',status:'진행',progress:50,budget:100,summary:'실제 내용'};
 const sample={...real,id:'sample-project',workspace:'6979E2190EBC',reportTitle:'예시 보고서',department:'예시부서',title:'노출되면 안 되는 예시사업',budget:999999};
 const html=renderToStaticMarkup(React.createElement(MoaOverview,{rows:[sample,real],onOpen(){}}));assert.ok(html.includes('실제 사업'));for(const text of ['예시 보고서','예시부서','노출되면 안 되는 예시사업','999,999'])assert.ok(!html.includes(text));assert.ok(html.includes('1개 보고서'));
 console.log('PASS: Moa sample report is excluded from business rows, department/report filters and aggregate totals');
}

{
 const {default:WorkspaceGate}=require('../app/components/WorkspaceGate.tsx');const original={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect};let states=[],refs=[],si=0,ri=0;
 React.useState=initial=>{const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};React.useRef=initial=>{const i=ri++;return refs[i]||(refs[i]={current:initial});};React.useEffect=()=>{};
 function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const result=find(child,predicate);if(result)return result;}return null;}
 function gate(){si=ri=0;return WorkspaceGate({children:()=>null});}
 try{gate();states[states.indexOf(true)]=false;let tree=gate();find(tree,n=>n.props?.role==='tab'&&n.props.children==='기존 보고서 이어쓰기').props.onClick();states[states.findIndex(Array.isArray)]=[{id:'6979E2190EBC',department:'스마트도시추진과',title:'작성 예시',pinLength:-1},{id:'REALREPORT01',department:'실제 총괄부서',title:'실제 보고서',pinLength:-1}];tree=gate();const selectReport=find(tree,n=>n.type==='select').props.onChange;assert.ok(!renderToStaticMarkup(tree).includes('value="6979E2190EBC"'));selectReport({target:{value:'6979E2190EBC'}});tree=gate();assert.ok(!find(tree,n=>n.type==='select'));assert.ok(!find(tree,n=>n.type==='input'&&n.props.autoComplete==='organization'));assert.equal(find(tree,n=>n.type==='button'&&n.props.className==='primary workspace-submit').props.disabled,false);
  find(tree,n=>n.type==='input'&&n.props.name==='access-role'&&!n.props.checked).props.onChange();tree=gate();assert.ok(!find(tree,n=>n.type==='input'&&n.props.autoComplete==='organization'));assert.ok(renderToStaticMarkup(tree).includes('작성 예시는 부서명 입력 없이 열립니다'));
  selectReport({target:{value:'REALREPORT01'}});tree=gate();assert.ok(find(tree,n=>n.type==='input'&&n.props.autoComplete==='organization'&&n.props.required));
 }finally{Object.assign(React,original);}
 console.log('PASS: sample report opens for either role without required department fields; normal report restores mandatory department input');
}
