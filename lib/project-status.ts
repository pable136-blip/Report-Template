// Keep saved status values stable so existing records, filters and counts stay compatible.
export function statusLabel(status:string){return status==='진행'?'추진 중':status;}
export function statusValue(label:string){return label.trim()==='추진 중'?'진행':label;}
