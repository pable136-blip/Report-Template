export type ImageBounds={x:number;y:number;width:number;height:number};
export const imageCanvasRatio=1168/480;
export const imageHandles=[{id:'nw',label:'왼쪽 위 모서리'},{id:'n',label:'위쪽'},{id:'ne',label:'오른쪽 위 모서리'},{id:'e',label:'오른쪽'},{id:'se',label:'오른쪽 아래 모서리'},{id:'s',label:'아래쪽'},{id:'sw',label:'왼쪽 아래 모서리'},{id:'w',label:'왼쪽'}] as const;
const minSize=0.1;
const finite=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;
export function normalizeBounds(b:ImageBounds):ImageBounds{const width=Math.max(minSize,Math.min(100,finite(b.width,45))),height=Math.max(minSize,Math.min(100,finite(b.height,45)));return{x:Math.max(0,Math.min(100-width,finite(b.x,0))),y:Math.max(0,Math.min(100-height,finite(b.y,0))),width,height};}
export function textBounds(image:ImageBounds):ImageBounds{const gapX=2,gapY=4;const options=[{x:0,y:0,width:Math.max(0,image.x-gapX),height:100},{x:image.x+image.width+gapX,y:0,width:Math.max(0,100-image.x-image.width-gapX),height:100},{x:0,y:0,width:100,height:Math.max(0,image.y-gapY)},{x:0,y:image.y+image.height+gapY,width:100,height:Math.max(0,100-image.y-image.height-gapY)}];return options.sort((a,b)=>b.width*b.height-a.width*a.height)[0];}
export function percentStyle(b:ImageBounds){return{left:b.x+'%',top:b.y+'%',width:b.width+'%',height:b.height+'%'};}
// Match the box to the visible image, retaining the appearance of existing contain-fit placements.
export function fitImageBounds(frame:ImageBounds,naturalWidth:number,naturalHeight:number,canvasRatio=imageCanvasRatio):ImageBounds{const b=normalizeBounds(frame);if(!Number.isFinite(naturalWidth)||!Number.isFinite(naturalHeight)||naturalWidth<=0||naturalHeight<=0||canvasRatio<=0)return b;const ratio=naturalWidth/naturalHeight/canvasRatio;let width=b.width,height=b.height;if(width/height>ratio)width=height*ratio;else height=width/ratio;return{x:b.x+(b.width-width)/2,y:b.y+(b.height-height)/2,width,height};}
export function dragImageBounds(start:ImageBounds,mode:string,dx:number,dy:number):ImageBounds{if(mode==='move')return normalizeBounds({...start,x:start.x+dx,y:start.y+dy});let l=start.x,t=start.y,r=start.x+start.width,b=start.y+start.height;if(mode.includes('w'))l=Math.max(0,Math.min(r-minSize,l+dx));if(mode.includes('e'))r=Math.min(100,Math.max(l+minSize,r+dx));if(mode.includes('n'))t=Math.max(0,Math.min(b-minSize,t+dy));if(mode.includes('s'))b=Math.min(100,Math.max(t+minSize,b+dy));return normalizeBounds({x:l,y:t,width:r-l,height:b-t});}
// Side handles scale around the opposite edge; corner handles retain the opposite corner.
export function resizeImageBounds(start:ImageBounds,mode:string,dx:number,dy:number):ImageBounds{
 if(mode==='move')return dragImageBounds(start,mode,dx,dy);
 const b=normalizeBounds(start),west=mode.includes('w'),east=mode.includes('e'),north=mode.includes('n'),south=mode.includes('s');
 if(!west&&!east&&!north&&!south)return b;
 const sx=1+(west?-dx:dx)/b.width,sy=1+(north?-dy:dy)/b.height;
 let scale:number;
 if((west||east)&&(north||south))scale=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;
 else scale=west||east?sx:sy;
 const cx=b.x+b.width/2,cy=b.y+b.height/2;
 const maxX=west?(b.x+b.width)/b.width:east?(100-b.x)/b.width:2*Math.min(cx,100-cx)/b.width;
 const maxY=north?(b.y+b.height)/b.height:south?(100-b.y)/b.height:2*Math.min(cy,100-cy)/b.height;
 const maxScale=Math.min(maxX,maxY),minimumScale=Math.min(Math.max(minSize/b.width,minSize/b.height),maxScale);
 scale=Math.max(minimumScale,Math.min(finite(scale,1),maxScale));
 const width=b.width*scale,height=b.height*scale;
 return{x:west?b.x+b.width-width:east?b.x:cx-width/2,y:north?b.y+b.height-height:south?b.y:cy-height/2,width,height};
}
export function alignImageBounds(bounds:ImageBounds,alignment:'left'|'center'|'right'|'top'|'middle'|'bottom'):ImageBounds{const b=normalizeBounds(bounds);return {...b,...(alignment==='left'?{x:0}:alignment==='center'?{x:(100-b.width)/2}:alignment==='right'?{x:100-b.width}:alignment==='top'?{y:0}:alignment==='middle'?{y:(100-b.height)/2}:{y:100-b.height})};}
