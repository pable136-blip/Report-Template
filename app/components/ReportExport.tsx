'use client';
import {apiFetch as fetch,workspaceUrl} from '../../lib/workspace-client';
import {useRef,useState} from 'react';
import {Printer,Download} from 'lucide-react';
import {toCanvas,getFontEmbedCSS} from 'html-to-image';
import {jsPDF} from 'jspdf';
export default function ReportExport({workName}:{workName:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[download,setDownload]=useState<{url:string;name:string}|null>(null);
 const lock=useRef(false);
 async function prepare(root:HTMLElement){await document.fonts.ready;await Promise.all(Array.from(root.querySelectorAll('img')).map(img=>img.decode().catch(()=>{throw new Error('보고서 이미지가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');})));}
 async function waitForSaves(){
  (document.activeElement as HTMLElement|null)?.blur();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const deadline=Date.now()+15000;
  while(document.querySelector('.deck [data-save-state="pending"]')){if(Date.now()>deadline)throw new Error('내용 저장이 아직 진행 중입니다. 저장이 끝난 뒤 다시 시도해 주세요.');await new Promise(resolve=>setTimeout(resolve,100));}
  if(document.querySelector('.deck [data-save-state="failed"]'))throw new Error('저장하지 못한 수정 내용이 있습니다. 먼저 다시 저장해 주세요.');
 }
 async function run(pdf:boolean){if(lock.current)return;lock.current=true;setBusy(true);setFailed(false);setMessage(pdf?'PDF 준비 중…':'인쇄 준비 중…');let snapshot:HTMLElement|null=null;
 try{await waitForSaves();const report=document.querySelector<HTMLElement>('.deckprint');if(!report)throw new Error('보고서를 먼저 열어 주세요.');
 if(!pdf){await prepare(report);setMessage('인쇄 창에서 프린터 또는 PDF로 저장을 선택하세요.');window.print();return;}
 snapshot=report.cloneNode(true) as HTMLElement;snapshot.classList.add('pdf-export-snapshot');snapshot.querySelectorAll('.slideeditstatus').forEach(el=>el.remove());snapshot.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));snapshot.setAttribute('aria-hidden','true');snapshot.inert=true;document.body.appendChild(snapshot);
 await prepare(snapshot);
 const frames=Array.from(snapshot.querySelectorAll<HTMLElement>('.pptframe'));if(!frames.length)throw new Error('저장할 슬라이드가 없습니다.');
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const fontEmbedCSS=await getFontEmbedCSS(snapshot,{preferredFontFormat:'woff2'});
 for(let i=0;i<frames.length;i++){
  setMessage('PDF 생성 중 · '+(i+1)+' / '+frames.length);
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  const canvas=await toCanvas(frames[i],{width:1280,height:720,pixelRatio:1.5,fontEmbedCSS,backgroundColor:'#ffffff'});
  if(i)doc.addPage();const width=270,height=width*9/16;
  doc.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',(297-width)/2,(210-height)/2,width,height,undefined,'FAST');
  canvas.width=0;canvas.height=0;
 }
 const name=(workName||'통합').replace(/[\\/:*?"<>|]/g,'_')+'_업무보고.pdf';
 setMessage('PDF 파일 저장 중…');const form=new FormData();form.append('file',doc.output('blob'),name);
 const response=await fetch('/api/exports',{method:'POST',body:form});const result=await response.json() as {url:string;name:string;error?:string};if(!response.ok)throw new Error(result.error||'PDF를 저장하지 못했습니다.');const url=result.url;setDownload({url,name});
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setMessage('PDF가 준비되었습니다. 다운로드가 시작되지 않으면 아래 링크를 누르세요.');
 }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해 주세요.');}finally{snapshot?.remove();lock.current=false;setBusy(false);}}
 return <div className="reportexport"><div><button disabled={busy} onClick={()=>void run(false)}><Printer size={17}/>인쇄</button><button className="primary" disabled={busy} onClick={()=>void run(true)}><Download size={17}/>{busy?'처리 중…':'PDF 파일 저장'}</button></div>{message&&<small role={failed?'alert':'status'}>{message}</small>}{download&&<a className="export-fallback" href={download.url} download={download.name}>생성한 PDF 다운로드</a>}</div>;
}
