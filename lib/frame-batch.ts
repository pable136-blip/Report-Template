// Keep the newest pointer position and render at most once per animation frame.
export function createFrameBatch<T>(commit:(value:T)=>void,schedule:(callback:()=>void)=>number,cancelFrame:(id:number)=>void){let frame:number|null=null,pending:T|undefined,hasPending=false;
 const flush=()=>{if(frame!==null)cancelFrame(frame);frame=null;if(hasPending){const value=pending as T;hasPending=false;commit(value);}};
 return {push(value:T){pending=value;hasPending=true;if(frame===null)frame=schedule(()=>{frame=null;flush();});},flush,cancel(){if(frame!==null)cancelFrame(frame);frame=null;hasPending=false;}};
}
