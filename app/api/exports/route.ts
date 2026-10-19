import {apiError,requireCoordinator} from '../../../lib/workspace-auth';
import {storage} from '../../../db/storage';

const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request:Request) {
  try {
    const code = await requireCoordinator(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024) {
      return Response.json({error:'PDF 파일이 너무 큽니다. 부서 또는 분야를 나누어 저장해 주세요.'},{status:400});
    }
    const bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0,5)) !== '%PDF-') {
      return Response.json({error:'올바른 PDF 파일이 아닙니다.'},{status:400});
    }
    const id = crypto.randomUUID();
    const name = file.name.replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,180);
    await storage().put('workspaces/'+code+'/exports/'+id, bytes, {
      httpMetadata:{contentType:'application/pdf'},
      customMetadata:{name},
    });
    return Response.json({url:'/api/exports?id='+id+'&workspace='+code,name},{status:201,headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request:Request) {
  try {
    const code = await requireCoordinator(request);
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!validId.test(id)) return Response.json({error:'파일을 찾을 수 없습니다.'},{status:404});
    const file = await storage().get('workspaces/'+code+'/exports/'+id);
    if (!file) return Response.json({error:'파일을 찾을 수 없습니다.'},{status:404});
    return new Response(file.body,{headers:{
      'Content-Type':'application/pdf',
      'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.customMetadata?.name||'report.pdf'),
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
    }});
  } catch (error) {
    return apiError(error);
  }
}
