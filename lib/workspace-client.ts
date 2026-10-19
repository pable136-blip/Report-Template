'use client';
import {tabHeaders} from './tab-session';
export function workspaceCode(){return typeof window==='undefined'?'':new URLSearchParams(window.location.search).get('workspace')||'';}
export function workspaceUrl(path:string){const code=workspaceCode();if(!code)return path;return path+(path.includes('?')?'&':'?')+'workspace='+encodeURIComponent(code);}
export async function apiFetch(input:string,init?:RequestInit){const response=await globalThis.fetch(workspaceUrl(input),{...init,headers:tabHeaders(workspaceCode(),init?.headers)});if(response.status===401&&typeof window!=='undefined')window.dispatchEvent(new Event('report-session-expired'));return response;}
