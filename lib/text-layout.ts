export type TextOffset={x:number;y:number;width?:number;height?:number;textScale?:number};
export function resizeText(start:TextOffset,width:number,height:number,mode:string,dx:number,dy:number,left:number,top:number){
 let l=left,t=top,r=left+width,b=top+height;
 if(mode.includes('w'))l=Math.max(0,Math.min(r-100,l+dx));
 if(mode.includes('e'))r=Math.min(1280,Math.max(l+100,r+dx));
 if(mode.includes('n'))t=Math.max(0,Math.min(b-60,t+dy));
 if(mode.includes('s'))b=Math.min(720,Math.max(t+60,b+dy));
 return {...start,x:start.x+l-left,y:start.y+t-top,width:r-l,height:b-t};
}

export function resizeTextScale(start:TextOffset,width:number,height:number,next:TextOffset){return Math.max(0.1,Math.min(10,(start.textScale||1)*Math.min((next.width||width)/width,(next.height||height)/height)));}
