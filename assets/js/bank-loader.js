export const catalog = Object.freeze({
  normal:{file:'data_normal.js',version:'latest',count:388,read:()=>dataNormal},
  pro:{file:'data_pro.js',version:'latest',count:588,read:()=>dataPro},
  normal_renew:{file:'data_normal_renew.js',version:'115.4.7',count:120,read:()=>dataNormalRenew},
  pro_renew:{file:'data_pro_renew.js',version:'115.4.7',count:324,read:()=>dataProRenew}
});
export const banks = {};
const pending = new Map();
export function loadBank(id) {
  if(!Object.hasOwn(catalog,id))return Promise.reject(new Error('未知的題庫'));
  if(banks[id])return Promise.resolve(banks[id]);
  if(pending.has(id))return pending.get(id);
  const entry=catalog[id];
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL(`../../${entry.file}`,import.meta.url).href;
    script.async=true;
    script.onload=()=>{
      try{
        const data=entry.read();
        if(data.version!==entry.version||Object.keys(data.data).length!==entry.count)throw new Error('題庫格式或版本不符');
        banks[id]=data;resolve(data);
      }catch{reject(new Error('題庫格式或版本不符，請重新整理'));}
    };
    script.onerror=()=>{script.remove();reject(new Error(navigator.onLine?'題庫下載失敗，請重試；其他題庫仍可使用。':'目前離線，請恢復網路後重試；已載入的題庫仍可使用。'));};
    document.head.append(script);
  });
  pending.set(id,promise);
  promise.catch(()=>pending.delete(id));
  return promise;
}
