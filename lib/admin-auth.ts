import {env} from 'cloudflare:workers';
import {database} from '../db/raw';
import {ApiError,digest,noStore,passwordHash,randomToken,requireOrigin,sameHash} from './workspace-auth';
export const adminLifetime=2*60*60*1000;
export function adminCookie(token:string,maxAge=adminLifetime/1000){return `report_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
export function adminToken(request:Request){return (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('report_admin='))?.slice('report_admin='.length)||'';}
export async function requireAdmin(request:Request){requireOrigin(request);const token=adminToken(request);if(!/^[a-f0-9]{64}$/.test(token))throw new ApiError(401,'관리자 비밀번호로 접속해 주세요.');const hash=await digest(token);const row=await database().prepare('SELECT token_hash,expires FROM report_admin_sessions WHERE token_hash=? AND expires>?').bind(hash,Date.now()).first<{token_hash:string;expires:number}>();if(!row)throw new ApiError(401,'관리자 접속 시간이 만료되었습니다. 다시 접속해 주세요.');return row;}
export async function adminConfig(){return database().prepare('SELECT password_hash,salt FROM report_admin_config WHERE id=1').first<{password_hash:string;salt:string}>();}
export async function verifySetup(value:unknown){const secret=(env as unknown as {REPORT_ADMIN_SETUP_KEY?:string}).REPORT_ADMIN_SETUP_KEY;if(!secret||typeof value!=='string'||value.length>256||!sameHash(await digest(value),await digest(secret)))throw new ApiError(403,'관리자 최초 설정 링크가 필요합니다.');}
export function validateAdminPassword(value:unknown):asserts value is string{if(typeof value!=='string'||value.length<10||value.length>128)throw new ApiError(400,'관리자 비밀번호는 10~128자로 입력해 주세요.');}
export async function issueAdmin(){const token=randomToken();await database().prepare('INSERT INTO report_admin_sessions(token_hash,expires) VALUES(?,?)').bind(await digest(token),Date.now()+adminLifetime).run();return {headers:{...noStore,'Set-Cookie':adminCookie(token)}};}
export async function checkAdminPassword(value:unknown){if(typeof value!=='string'||value.length>128)throw new ApiError(400,'관리자 비밀번호를 확인해 주세요.');const config=await adminConfig();if(!config||!sameHash(await passwordHash(value,config.salt),config.password_hash))throw new ApiError(401,'관리자 비밀번호가 맞지 않습니다.');}
// Per-client fixed window bounds failed and successful login attempts across Workers.
export async function limitAdminLogin(request:Request){const key=await digest(request.headers.get('cf-connecting-ip')||'unknown');const now=Date.now();await database().prepare('INSERT INTO report_admin_attempts(client_key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(client_key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').bind(key,now+15*60*1000,now,now).run();const row=await database().prepare('SELECT attempts FROM report_admin_attempts WHERE client_key=?').bind(key).first<{attempts:number}>();if(row&&row.attempts>10)throw new ApiError(429,'접속 시도가 많습니다. 15분 후 다시 시도해 주세요.');}

// Recovery changes only administrator credentials/sessions, never report records.
export async function resetAdminPassword(value:unknown,password:unknown){
 const settings=env as unknown as {REPORT_ADMIN_RESET_KEY?:string;REPORT_ADMIN_RESET_EXPIRES?:string};
 const secret=settings.REPORT_ADMIN_RESET_KEY;
 if(!secret||typeof value!=='string'||value.length>256||Date.now()>=Number(settings.REPORT_ADMIN_RESET_EXPIRES||0)||!sameHash(await digest(value),await digest(secret)))throw new ApiError(403,'재설정 링크가 유효하지 않거나 만료되었습니다. 새 링크를 요청해 주세요.');
 validateAdminPassword(password);
 const marker='admin-reset:'+await digest(secret),salt=randomToken(),hash=await passwordHash(password,salt);
 const results=await database().batch([
  database().prepare('UPDATE report_admin_config SET password_hash=?,salt=? WHERE id=1 AND NOT EXISTS(SELECT 1 FROM report_admin_attempts WHERE client_key=?)').bind(hash,salt,marker),
  database().prepare('DELETE FROM report_sessions WHERE admin_session_hash IS NOT NULL AND EXISTS(SELECT 1 FROM report_admin_config WHERE id=1 AND salt=?)').bind(salt),
  database().prepare('DELETE FROM report_admin_sessions WHERE EXISTS(SELECT 1 FROM report_admin_config WHERE id=1 AND salt=?)').bind(salt),
  database().prepare('INSERT OR IGNORE INTO report_admin_attempts(client_key,attempts,reset_at) SELECT ?,1,? WHERE EXISTS(SELECT 1 FROM report_admin_config WHERE id=1 AND salt=?)').bind(marker,Number(settings.REPORT_ADMIN_RESET_EXPIRES),salt)
 ]);
 if(!results[0].meta.changes)throw new ApiError(409,'이미 사용한 재설정 링크입니다. 관리자 비밀번호로 접속해 주세요.');
}
