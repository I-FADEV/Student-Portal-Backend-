const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const cloudConfig=require('../config/cloudinary');
const cloudKey=/^cld_([a-f0-9]{32})\.(jpg|webp)$/;
const uploadDirectory=()=>path.resolve(process.env.UPLOAD_DIR||path.join(__dirname,'../uploads'));

function idFor(key) {
  const match=cloudKey.exec(key||'');
  if(!match)throw new Error('Invalid media key');
  return {id:match[1],format:match[2]};
}
function localPath(folder,key) {
  if(typeof key!=='string'||path.basename(key)!==key||key.includes('..'))throw new Error('Invalid media key');
  return path.join(uploadDirectory(),...(folder==='feed'?['feed']:[]),key);
}
function providerId(folder,key) {
  const {id}=idFor(key);
  if(!['passport','feed'].includes(folder))throw new Error('Invalid media category');
  return `ifatoss/${folder}/${id}`;
}
function uploadBuffer(client,buffer,folder,key) {
  const {format}=idFor(key);
  return new Promise((resolve,reject)=>{
    const stream=client.uploader.upload_stream({public_id:providerId(folder,key),resource_type:'image',type:'authenticated',format,overwrite:false,unique_filename:false},(error,result)=>error?reject(error):resolve(result));
    stream.end(buffer);
  });
}
async function store(buffer,folder,key) {
  if(cloudConfig.configured()) {
    const client=cloudConfig.configure();
    await uploadBuffer(client,buffer,folder,key);
    return key;
  }
  await fs.mkdir(path.dirname(localPath(folder,key)),{recursive:true});
  await fs.writeFile(localPath(folder,key),buffer,{flag:'wx'});
  return key;
}
async function read(bufferFolder,key) {
  if(cloudKey.test(key||'')) {
    const {id,format}=idFor(key);
    if(!cloudConfig.configured())throw new Error('Cloudinary is not configured for this stored image');
    const client=cloudConfig.configure();
    const url=client.utils.private_download_url(`ifatoss/${bufferFolder}/${id}`,format,{resource_type:'image',type:'authenticated',expires_at:Math.floor(Date.now()/1000)+60});
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Private image retrieval failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  return fs.readFile(localPath(bufferFolder,key));
}
async function remove(folder,key) {
  if(cloudKey.test(key||'')) {
    if(!cloudConfig.configured())return;
    const client=cloudConfig.configure();
    const result=await client.uploader.destroy(providerId(folder,key),{resource_type:'image',type:'authenticated',invalidate:true});
    if(!['ok','not found'].includes(result.result))throw new Error(`Cloudinary asset removal failed (${result.result})`);
    return;
  }
  await fs.unlink(localPath(folder,key)).catch(error=>{if(error.code!=='ENOENT')throw error});
}
function isCloudKey(key) { return cloudKey.test(key||''); }
function validateCloudinary() {
  const configuredAny=Boolean(process.env.CLOUDINARY_URL||process.env.CLOUD_NAME||process.env.CLOUD_API_KEY||process.env.CLOUD_API_SECRET);
  if(configuredAny&&!cloudConfig.configured())throw new Error('Configure Cloudinary storage using CLOUDINARY_URL or all of CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET.');
  return cloudConfig.configured();
}

module.exports={store,read,remove,isCloudKey,validateCloudinary,providerId};
