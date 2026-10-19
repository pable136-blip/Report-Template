import {env} from 'cloudflare:workers';
export function storage(){const bucket=(env as unknown as {UPLOADS:R2Bucket}).UPLOADS;if(!bucket)throw new Error('File storage unavailable');return bucket;}
