// Write keys to a new ignored file. Never overwrite deployed keys or print secrets.
const fs=require('node:fs');
const path=require('node:path');
const webPush=require('web-push');
const keys=webPush.generateVAPIDKeys();
const destination=path.join(__dirname,'../.env.push');
fs.writeFileSync(destination,`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:replace-with-your-ict-contact@example.com\n`,{flag:'wx',mode:0o600});
console.log('Created .env.push. Set the university ICT contact, then copy these three variables to the API environment. Keep the private key secret and stable.');
