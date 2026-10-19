import {reportBodyText} from './report-source';
export type OverviewProject={id:string;department:string;status:string;progress:number;budget:number;situation?:string;purpose?:string;results?:string;plan?:string};
const amount=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0;};
export function projectOverview<T extends OverviewProject>(rows:T[]){
 const counts={예정:0,진행:0,완료:0,지연:0};let progress=0,budget=0;const departments=new Set<string>();
 for(const row of rows){if(Object.hasOwn(counts,row.status))counts[row.status as keyof typeof counts]++;progress+=Math.min(100,amount(row.progress));budget+=amount(row.budget);departments.add(row.department);}
 return {total:rows.length,departments:departments.size,counts,average:rows.length?Math.round(progress/rows.length):0,budget};
}
export function departmentOverview<T extends OverviewProject>(rows:T[]){const groups=new Map<string,T[]>();for(const row of rows){const group=groups.get(row.department)||[];group.push(row);groups.set(row.department,group);}return [...groups].map(([department,projects])=>({department,...projectOverview(projects)}));}
export function projectBrief(row:Pick<OverviewProject,'situation'|'purpose'|'results'>){
 const lines=reportBodyText(row.purpose||'').split(/\n/).map(s=>s.trim()).filter(Boolean);const content=lines.find(s=>/^(?:사업\s*)?내용\s*[:：]/.test(s));
 return (content?.replace(/^(?:사업\s*)?내용\s*[:：]\s*/,'')||reportBodyText(row.situation||'').split(/\n/).map(s=>s.trim()).find(s=>s&&!s.startsWith('※'))||lines.find(s=>!s.startsWith('※'))||reportBodyText(row.results||'').split(/\n/).find(s=>s.trim())||'핵심 내용 미입력').replace(/\s+/g,' ').slice(0,120);
}
