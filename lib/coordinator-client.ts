const keyName=(id:string)=>'report-coordinator:'+id;
export function coordinatorKey(id:string){try{return localStorage.getItem(keyName(id))||'';}catch{return '';}}
export function rememberCoordinator(id:string,key?:string){if(key)try{localStorage.setItem(keyName(id),key);}catch{}}
export function coordinatorLink(id:string,key:string){return window.location.origin+'/?workspace='+encodeURIComponent(id)+'&access=coordinator#manage='+encodeURIComponent(key);}
