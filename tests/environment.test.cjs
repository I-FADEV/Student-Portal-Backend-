const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {validateEnvironment}=require('../config/environment');
test('production rejects unsafe deployment configuration before creating upload directories',()=>{
  const keys=['NODE_ENV','MONGO_URI','JWT_SECRET','FRONTEND_URL','UPLOAD_DIR'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ifatoss-environment-'));
  try {
    Object.assign(process.env,{NODE_ENV:'production',MONGO_URI:'mongodb://127.0.0.1:27017/unused',JWT_SECRET:'a'.repeat(64),FRONTEND_URL:'https://portal.university.edu',UPLOAD_DIR:directory});
    assert.doesNotThrow(validateEnvironment);
    for(const origin of ['','http://portal.university.edu','https://portal.university.edu/','https://portal.university.edu/path','https://user:pass@portal.university.edu']) {
      process.env.FRONTEND_URL=origin; assert.throws(validateEnvironment,/HTTPS origins/);
    }
    process.env.FRONTEND_URL='https://portal.university.edu,https://staging.university.edu';
    assert.doesNotThrow(validateEnvironment);
    process.env.UPLOAD_DIR='./uploads'; assert.throws(validateEnvironment,/absolute persistent/);
    process.env.UPLOAD_DIR=directory;process.env.JWT_SECRET='replace-with-a-random-secret-of-at-least-32-characters';assert.throws(validateEnvironment,/placeholder/);
  } finally {
    for(const key of keys) { if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]; }
    // Only remove the exact temporary directory generated above; it must remain empty.
    fs.rmdirSync(directory);
  }
});
