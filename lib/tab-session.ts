type TabSession={token:string;role:'coordinator'|'department'|'viewer';department:string};
const sessions=new Map<string,TabSession>();
const key=(code:string)=>'report-tab-session:'+code;
export function tabSession(code:string):TabSession|null{if(sessions.has(code))return sessions.get(code)!;try{const value=JSON.parse(sessionStorage.getItem(key(code))||'null');if(value&&/^[0-9a-f]{64}$/.test(value.token)&&['coordinator','department','viewer'].includes(value.role)){sessions.set(code,value);return value;}}catch{}return null;}
export function rememberTab(code:string,token:string|undefined,role:'coordinator'|'department'|'viewer'|undefined,department:string|undefined){if(!token||!role)return;const value={token,role,department:department||''};sessions.set(code,value);try{sessionStorage.setItem(key(code),JSON.stringify(value));}catch{}}
export function tabHeaders(code:string,headers?:HeadersInit){const result=new Headers(headers);const session=tabSession(code);if(session)result.set('X-Report-Session',session.token);return result;}
export function clearTab(code:string){sessions.delete(code);try{sessionStorage.removeItem(key(code));}catch{}}
export function entryRole(explicit:string|null,sharedKey:string,session:TabSession|null):'coordinator'|'department'|'viewer'{if(explicit==='viewer')return 'viewer';if(explicit==='department')return 'department';if(explicit==='coordinator'||sharedKey)return 'coordinator';return session?.role||'department';}
export function openAccessBody(role:'coordinator'|'department'|'viewer',department:string,key:string){return {entryRole:role,department,coordinatorKey:role==='coordinator'?key:''};}
