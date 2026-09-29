const AppError=require('../utils/appError');
// No vendor has been selected. Never accept client-supplied matched flags or fake templates.
const status=()=>({configured:false,connected:false,state:'not_configured',message:'Scanner not configured. A supported fingerprint device and its verified adapter are required.'});
async function enroll(){throw new AppError('Scanner not configured. Fingerprint enrolment is unavailable until a supported device adapter is installed.',503)}
async function verify(){throw new AppError('Scanner not configured. Use a documented exception request for academic-officer review.',503)}
module.exports={status,enroll,verify};
