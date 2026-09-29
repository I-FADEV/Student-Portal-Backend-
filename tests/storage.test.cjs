const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
test('configured passport and feed storage survives application process restart',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ifatoss-storage-'));
  const cwd=path.join(__dirname,'..');
  function run(code) {
    const result=spawnSync(process.execPath,['-e',code],{cwd,env:{...process.env,UPLOAD_DIR:directory},encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr);return result.stdout.trim();
  }
  let photo;
  try {
    photo=run("(async()=>{const sharp=require('sharp');const bytes=await sharp({create:{width:80,height:100,channels:3,background:'#abcdef'}}).png().toBuffer();console.log(await require('./services/cardPrinting.service').storePhoto(bytes))})().catch(()=>process.exit(1))");
    assert.match(photo,/^[a-f0-9-]+\.jpg$/);
    fs.mkdirSync(path.join(directory,'feed'));
    fs.writeFileSync(path.join(directory,'feed','fixture.webp'),'storage-fixture');
    run(`const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const dir=require('./config/environment').uploadDirectory();assert.ok(fs.readFileSync(path.join(dir,${JSON.stringify(photo)})).length>0);assert.equal(fs.readFileSync(path.join(dir,'feed','fixture.webp'),'utf8'),'storage-fixture');`);
  } finally {
    // Only known fixture files within the exact mkdtemp directory are removed.
    if(photo && /^[a-f0-9-]+\.jpg$/.test(photo))fs.rmSync(path.join(directory,photo),{force:true});
    fs.rmSync(path.join(directory,'feed','fixture.webp'),{force:true});
    if(fs.existsSync(path.join(directory,'feed')))fs.rmdirSync(path.join(directory,'feed'));
    fs.rmdirSync(directory);
  }
});
