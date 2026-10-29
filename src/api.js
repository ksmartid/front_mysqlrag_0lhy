export const API=import.meta.env.VITE_API_BASE||'http://127.0.0.1:8000';

let userId=null;
export function setUserId(id){userId=id}

function headers(json){
  const h={};
  if(json)h['Content-Type']='application/json';
  if(userId)h['X-User-Id']=String(userId);
  return h;
}

async function errorText(res){
  try{
    const detail=(await res.json()).detail;
    if(Array.isArray(detail))return detail.map(d=>`${(d.loc||[]).slice(1).join('.')}: ${d.msg}`).join(', ');
    return detail||`HTTP ${res.status}`;
  }catch{return `HTTP ${res.status}`}
}

export async function request(path,method='GET',body){
  const isForm=body instanceof FormData;
  const res=await fetch(API+path,{method,headers:headers(body&&!isForm),body:body?(isForm?body:JSON.stringify(body)):undefined});
  if(!res.ok)throw new Error(await errorText(res));
  return res.json();
}

export async function download(path,filename){
  const res=await fetch(API+path,{headers:headers(false)});
  if(!res.ok)throw new Error(await errorText(res));
  const url=URL.createObjectURL(await res.blob());
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
