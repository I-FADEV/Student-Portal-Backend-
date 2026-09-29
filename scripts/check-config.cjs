// Offline, read-only deployment preflight. Never prints environment values or opens a database.
require('dotenv').config();
const path = require('node:path');
const fs = require('node:fs');
const results = [];
function check(name, ok, action) { results.push({name, status:ok?'pass':'needs-action', ...(ok?{}:{action})}); }
const env = process.env;
check('production mode', env.NODE_ENV === 'production', 'Set NODE_ENV=production on Render.');
check('database configured', /^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI || ''), 'Set the transaction-capable MongoDB connection string. Connectivity is not tested here.');
check('signing secret', (env.JWT_SECRET || '').length >= 32 && !/replace|example|fixture|changeme/i.test(env.JWT_SECRET), 'Use a unique random JWT_SECRET of at least 32 characters.');
check('HTTPS frontend origins', !!env.FRONTEND_URL && env.FRONTEND_URL.split(',').every(value => {
  try { const url = new URL(value.trim()); return url.protocol === 'https:' && url.origin === value.trim() && !url.username && !url.password; } catch { return false; }
}), 'Set exact HTTPS frontend origins without paths or trailing slashes.');
check('absolute upload path', !!env.UPLOAD_DIR && path.isAbsolute(env.UPLOAD_DIR), 'Set UPLOAD_DIR to the mounted persistent disk path on Render.');
let writable = false;
try { fs.accessSync(env.UPLOAD_DIR || path.join(__dirname,'../uploads'),fs.constants.R_OK | fs.constants.W_OK); writable=true; } catch { /* Report only. */ }
check('upload directory accessible', writable, 'Create/mount a readable and writable upload directory.');
let pushValid = false;
try { require('../services/push.service').validateConfiguration(); pushValid=!!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT); } catch { /* Never echo key validation details. */ }
check('push configuration', pushValid, 'Configure all three server-only VAPID settings; retain the same keys across deploys.');
check('ID-card artwork',fs.existsSync(path.join(__dirname,'../assets/idcard-template.pdf')),'Include the official ID-card PDF in the deployment.');
console.log(JSON.stringify({mode:'offline-read-only',checks:results,notVerified:['Database connectivity/transactions and existing records','Render disk persistence across redeploys','Always-running worker and real-device push delivery','Encrypted backups and restore','Vercel production API URL and deployed HTTPS/CORS']},null,2));
if(results.some(result=>result.status!=='pass'))process.exitCode=2;
