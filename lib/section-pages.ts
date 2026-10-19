import {paginateSource} from './report-source';
import {imageGroups,type ReportImageItem} from './report-images';
import {normalizeBounds,textBounds} from './image-layout';
export const pageSeparator='\f';
export function sectionPageParts(body:string){return body.split(pageSeparator);}
export function sectionPageImages<T extends ReportImageItem>(images:T[],page:number){return images.filter(image=>(image.page||0)===page);}
export function replaceSectionPageImages<T extends ReportImageItem>(images:T[],page:number,next:T[]){return [...images.filter(image=>(image.page||0)!==page),...next.map(image=>({...image,page}))];}
export function paginateByWidth(text:string,width:number,nextWidth:number,maxLines:number){
 const pages:{text:string;start:number;end:number}[]=[];let start=0,pos=0,line=1,used=0,capacity=width;
 for(const char of text){
  const size=char==='\t'?2:/[\u0000-\u007f]/.test(char)?(/[il.,:;'!| ]/.test(char)?.32:/[MW@%]/.test(char)?.9:.62):1;
  const wrap=char!=='\n'&&used+size>capacity&&used>0;
  if(char==='\n'||wrap){
   if(line===maxLines){const end=char==='\n'?pos+char.length:pos;pages.push({text:text.slice(start,end),start,end});start=end;line=1;capacity=nextWidth;}else line++;
   used=0;
  }
  if(char!=='\n')used+=size;
  pos+=char.length;
 }
 if(start<text.length||!pages.length)pages.push({text:text.slice(start),start,end:text.length});
 return pages;
}
export function sectionPageSlides(body:string,images:ReportImageItem[],bodySize:number,lineHeight=1.5,showMetrics=true){
 const output:{body:string;bodyRange:{start:number;end:number};manualPage:number;localIndex:number;inlineImages?:ReturnType<typeof imageGroups>[number];image?:ReportImageItem}[]=[];let offset=0;
 sectionPageParts(body).forEach((part,manualPage)=>{
  const attached=sectionPageImages(images,manualPage),groups=imageGroups(attached),inline=groups.flat();
  // Pagination estimates capacity; only the browser wraps text within a page.
  const frame=inline.length>1?{width:1072*.5,height:440}:inline.length?{width:1072*textBounds(normalizeBounds(inline[0].bounds)).width/100,height:440*textBounds(normalizeBounds(inline[0].bounds)).height/100}:{width:showMetrics&&manualPage===0?756:1072,height:440};
  const columns=Math.max(6,(frame.width-60)/bodySize),nextColumns=inline.length?columns:(1072-60)/bodySize,lines=Math.max(1,Math.floor((frame.height-48)/(bodySize*lineHeight)));
  const pages=part.trim()?paginateByWidth(part,columns,nextColumns,lines):attached.length?[]:[{text:body.includes(pageSeparator)?'':'미입력',start:0,end:0}];
  const count=Math.max(pages.length,groups.length);
  for(let i=0;i<count;i++)output.push({body:pages[i]?.text||'',bodyRange:{start:offset+(pages[i]?.start??part.length),end:offset+(pages[i]?.end??part.length)},manualPage,localIndex:i,inlineImages:groups[i]});
  attached.filter(image=>image.layout!=='inline').forEach((image,i)=>output.push({body:'',bodyRange:{start:offset,end:offset},manualPage,localIndex:i,image}));
  offset+=part.length+1;
 });return output;
}

export function deleteSectionPage<T extends ReportImageItem>(body:string,images:T[],page:number){
 const parts=sectionPageParts(body);
 if(parts.length<=1||page<0||page>=parts.length)throw new Error('기본 페이지는 유지해야 합니다.');
 parts.splice(page,1);
 return {body:parts.join(pageSeparator),images:images.filter(image=>(image.page||0)!==page).map(image=>({...image,page:(image.page||0)>page?(image.page||0)-1:(image.page||0)}))};
}

// Delete exactly the visible slide, including automatic overflow and image-only slides.
export function deleteVisibleSectionPage<T extends ReportImageItem>(body:string,images:T[],slide:{manualPage?:number;bodyRange?:{start:number;end:number};image?:{id:string};inlineImages?:{id:string}[]},bodySize:number,lineHeight:number,showMetrics=true){
 const page=slide.manualPage||0;
 const peers=sectionPageSlides(body,images,bodySize,lineHeight,showMetrics).filter(item=>item.manualPage===page);
 if(peers.length===1&&sectionPageParts(body).length>1)return deleteSectionPage(body,images,page);
 const ids=new Set(slide.image?[slide.image.id]:(slide.inlineImages||[]).map(image=>image.id));
 const range=slide.image?undefined:slide.bodyRange;
 const nextBody=range?body.slice(0,range.start)+body.slice(range.end):body;
 return {body:nextBody,images:images.filter(image=>!ids.has(image.id))};
}
