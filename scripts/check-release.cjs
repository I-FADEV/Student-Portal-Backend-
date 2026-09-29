// Read-only by default. --apply recalculates derived fields and creates indexes.
require('dotenv').config();
const mongoose=require('mongoose');
const fs=require('node:fs');
const path=require('node:path');
mongoose.set('autoIndex',false);mongoose.set('autoCreate',false);
for(const name of fs.readdirSync(path.join(__dirname,'../models')).filter(n=>n.endsWith('.js')))require(path.join(__dirname,'../models',name));
const Finance=mongoose.model('Finance'),Result=mongoose.model('Result'),Session=mongoose.model('Session');
const recalculate=require('../utils/financeRecalculator');
const grade=require('../utils/resultCalculator');
async function run(){
 if(!process.env.MONGO_URI)throw new Error('Set MONGO_URI for the database you intend to inspect');
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false});
 const issues=[];
 for(const [model,keys] of [[Result,['student','courseCode','session','semester']],[Finance,['student','session','semester']]]){
  const duplicates=await model.aggregate([{$group:{_id:Object.fromEntries(keys.map(k=>[k,'$'+k])),count:{$sum:1},ids:{$push:'$_id'}}},{$match:{count:{$gt:1}}}]);
  for(const duplicate of duplicates)issues.push({type:'duplicate',collection:model.collection.name,...duplicate});
 }
 if(await Session.countDocuments({status:{$ne:'closed'}})>1)issues.push({type:'multiple-open-sessions'});
 const records=await Finance.find();
 for(const record of records){
  if(record.carriedOverBalance)issues.push({type:'legacy-balance-needs-bursar-review',id:record.id});
  try{recalculate(record)}catch(e){issues.push({type:'invalid-finance',id:record.id,message:e.message})}
 }
 const results=await Result.find();
 for(const result of results){if(result.sourceSheet&&result.outcome==='absent')continue;if(!Number.isFinite(result.test)||!Number.isFinite(result.exam)||result.test<0||result.test>40||result.exam<0||result.exam>60)issues.push({type:'invalid-result',id:result.id});}
 const legacyCollections={};
 for(const name of ['registers','courses'])legacyCollections[name]=await mongoose.connection.db.collection(name).countDocuments();
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'read-only',financeRecords:records.length,resultRecords:results.length,legacyCollections,issues},null,2));
 if(issues.length){process.exitCode=2;return;}
 if(!process.argv.includes('--apply'))return;
 for(const record of records)await record.save();
 for(const result of results){if(result.sourceSheet)continue;result.total=result.test+result.exam;result.grade=grade(result.total);await result.save();}
 // Create required indexes without dropping any existing index or deleting records.
 for(const model of Object.values(mongoose.models))await model.createIndexes();
 console.log('Derived totals, grades and indexes updated. No records deleted.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>mongoose.disconnect());
