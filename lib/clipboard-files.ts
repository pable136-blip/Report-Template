/** Read clipboard files once: browsers expose screenshots through items or files. */
export function clipboardFiles(data:Pick<DataTransfer,'items'|'files'>):File[]{
 const files=Array.from(data.files||[]);
 if(files.length)return files;
 return Array.from(data.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter((file):file is File=>!!file);
}
export function isClipboardImage(file:File){return ['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||/\.(png|jpe?g|webp|gif)$/i.test(file.name);}
