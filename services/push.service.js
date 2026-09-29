const webPush=require('web-push');
const Subscription=require('../models/pushSubscription.model');
const Delivery=require('../models/pushDelivery.model');
const Announcement=require('../models/announcement.model');
const Student=require('../models/student.model');
const AppError=require('../utils/appError');
function configuration() {
  const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
  return publicKey&&privateKey&&subject?{publicKey,privateKey,subject}:null;
}
function validateConfiguration() {
  if(![process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY,process.env.VAPID_SUBJECT].some(Boolean))return;
  const config=configuration();
  if(!config)throw new Error('Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT together');
  webPush.setVapidDetails(config.subject,config.publicKey,config.privateKey);
}
function validateSubscription(input) {
  let url;try{url=new URL(input.endpoint)}catch{throw new AppError('Invalid push endpoint',400)}
  const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
  const host=url.hostname.toLowerCase();
  // Endpoints are supplied by browsers; never permit an arbitrary server-side URL fetch.
  const allowed=hosts.includes(host)||host.endsWith('.notify.windows.com')||host.endsWith('.push.services.mozilla.com')||host.endsWith('.push.apple.com');
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!allowed||input.endpoint.length>4096)throw new AppError('Unsupported push service endpoint',400);
  const p256dh=input.keys?.p256dh,auth=input.keys?.auth;
  if(typeof p256dh!=='string'||typeof auth!=='string'||p256dh.length>100||auth.length>30||!/^[\w-]+={0,2}$/.test(p256dh)||!/^[\w-]+={0,2}$/.test(auth)||Buffer.from(p256dh,'base64url').length!==65||Buffer.from(p256dh,'base64url')[0]!==4||Buffer.from(auth,'base64url').length!==16)throw new AppError('Invalid push subscription keys',400);
  return {endpoint:url.href,keys:{p256dh,auth}};
}
async function subscribe(input,actor) {
  const config=configuration();if(!config)throw new AppError('Push notifications are not configured yet; announcements remain available in the portal',503);
  const data=validateSubscription(input);
  if(await Subscription.countDocuments({student:actor.userId,active:true,endpoint:{$ne:data.endpoint}})>=10)throw new AppError('Too many subscribed devices. Disable notifications on an unused device first.',400);
  await Subscription.findOneAndUpdate({endpoint:data.endpoint},{$set:{...data,student:actor.userId,recipientRole:actor.role,tokenVersion:actor.tokenVersion,active:true,vapidPublicKey:config.publicKey}},{upsert:true,new:true,runValidators:true});
  return {subscribed:true};
}
async function unsubscribe(endpoint,actor) {
  if(typeof endpoint!=='string'||endpoint.length>4096)throw new AppError('Invalid push endpoint',400);
  await Subscription.updateOne({endpoint,student:actor.userId},{$set:{active:false}});
  return {subscribed:false};
}
async function processQueue({send=webPush.sendNotification.bind(webPush),limit=20,now=new Date()}={}) {
  const config=configuration();if(!config)return {paused:true,processed:0};
  let processed=0;
  for(let i=0;i<limit;i++) {
    const job=await Delivery.findOneAndUpdate({$or:[{state:'pending',nextAttempt:{$lte:now}},{state:'processing',leaseUntil:{$lte:now}}]},{$set:{state:'processing',leaseUntil:new Date(Date.now()+60000)},$inc:{attempts:1}},{new:true,sort:{nextAttempt:1}});
    if(!job)break;
    processed++;
    const Model=job.recipientRole==='admin'?require('../models/admin.model'):job.recipientRole==='lecturer'?require('../models/staff.model'):Student;
    const [sub,student,announcement]=await Promise.all([Subscription.findById(job.subscription),Model.findById(job.student),Announcement.findById(job.announcement)]);
    const valid=sub?.active&&String(sub.student)===String(job.student)&&student&&!['archived','graduated'].includes(student.status)&&sub.tokenVersion===(student.tokenVersion||0)&&announcement?.state==='published'&&(!announcement.expiresAt||announcement.expiresAt>now);
    if(!valid||sub.vapidPublicKey!==config.publicKey) {
      await Delivery.updateOne({_id:job.id},{$set:{state:'skipped',leaseUntil:null}});continue;
    }
    try {
      // Lock-screen text contains no targeted announcement details or student information.
      const portal=job.recipientRole==='admin'?'admin':job.recipientRole==='lecturer'?'lecturer':'student';
      const payload=JSON.stringify({title:'i-FATOSS update',body:'A new campus update is available. Open the portal to read it.',tag:`announcement-${announcement.id}`,url:announcement.channel==='feed'?`/${portal}/feed?open=${announcement.feedPost}`:`/${portal}/announcements?open=${announcement.id}`});
      const ttl=Math.max(1,Math.min(86400,announcement.expiresAt?Math.floor((announcement.expiresAt-now)/1000):86400));
      await send({endpoint:sub.endpoint,keys:sub.keys.toObject?sub.keys.toObject():{p256dh:sub.keys.p256dh,auth:sub.keys.auth}},payload,{vapidDetails:config,TTL:ttl,timeout:10000,urgency:'normal'});
      await Delivery.updateOne({_id:job.id,state:'processing'},{$set:{state:'accepted',leaseUntil:null,lastStatus:201}});
    } catch(error) {
      const code=Number(error.statusCode)||0;
      if([404,410].includes(code))await Subscription.updateOne({_id:sub.id,endpoint:sub.endpoint},{$set:{active:false}});
      const retry=(code===0||code===429||code>=500)&&job.attempts<5;
      const retryAfter=Number(error.headers?.['retry-after']);
      const delay=Number.isFinite(retryAfter)&&retryAfter>0?Math.min(retryAfter*1000,86400000):Math.min(60000*2**(job.attempts-1),3600000);
      await Delivery.updateOne({_id:job.id,state:'processing'},{$set:{state:retry?'pending':'failed',leaseUntil:null,lastStatus:code,nextAttempt:new Date(now.getTime()+delay)}});
    }
  }
  return {processed};
}
function startWorker() {
  let busy=false,stopped=false;
  const tick=async()=>{if(busy||stopped)return;busy=true;try{await processQueue()}catch(error){console.error('Notification queue error:',error.name)}finally{busy=false}};
  const timer=setInterval(tick,15000);timer.unref();void tick();
  return ()=>{stopped=true;clearInterval(timer)};
}
module.exports={configuration,validateConfiguration,validateSubscription,subscribe,unsubscribe,processQueue,startWorker};
