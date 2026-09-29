const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const bwip = require('bwip-js');
const { uploadDirectory } = require('../config/environment');
const IdCard = require('../models/idcard.model');
const AppError = require('../utils/appError');
const logAction = require('../utils/logAction');

function photoPath(filename) {
  if (!filename || path.basename(filename) !== filename || filename.includes('..')) throw new AppError('Invalid photo', 400);
  return path.join(uploadDirectory(), filename);
}
async function storePhoto(buffer) {
  let data;
  try { data = await sharp(buffer, { limitInputPixels: 16000000 }).rotate().resize(800, 1000, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(); }
  catch { throw new AppError('Upload a valid JPEG or PNG passport photograph', 400); }
  await fs.mkdir(uploadDirectory(), { recursive: true });
  const filename = `${crypto.randomUUID()}.jpg`;
  await fs.writeFile(photoPath(filename), data, { flag: 'wx' });
  return filename;
}
async function removePhoto(filename) { await fs.unlink(photoPath(filename)).catch(() => {}); }
async function approve(id, user, ipAddress) {
  const card = await IdCard.findById(id);
  if (!card || card.status !== 'pending') throw new AppError('Only pending submissions can be approved', 409);
  if (!card.feePaid || !card.photoURL) throw new AppError('Confirm payment and a passport photo first', 400);
  const student = await require('../models/student.model').findById(card.student);
  if (!student || student.status === 'archived') throw new AppError('Student is inactive', 400);
  Object.assign(card, { fullName: student.name, matricNumber: student.matricNumber, department: student.department, level: student.level, status: 'approved', approvedAt: new Date(), approvedBy: user.userId, verificationToken: crypto.randomBytes(24).toString('hex'), expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  await card.save();
  await logAction({ performedBy: user.userId, ipAddress, action: 'UPDATE', targetType: 'IDCARD', targetId: card.id, affectedStudent: card.student, description: 'ID card approved for printing' });
  return card;
}
async function renew(id, user, ipAddress) {
  const card = await IdCard.findById(id);
  if (!card || !['approved', 'collected'].includes(card.status)) throw new AppError('Only issued cards can be renewed', 409);
  card.previousCards.push({ photoURL: card.photoURL, session: card.session, approvedAt: card.approvedAt, expiresAt: card.expiresAt, collectedAt: card.collectedAt });
  card.status = 'unsubmitted'; card.verificationToken = undefined; card.approvedAt = undefined; card.expiresAt = undefined; card.collectedAt = undefined;
  await card.save();
  await logAction({ performedBy: user.userId, ipAddress, action: 'UPDATE', targetType: 'IDCARD', targetId: card.id, affectedStudent: card.student, description: 'ID card renewal opened; previous verification revoked' });
  return card;
}
async function render(card) {
  const source = await PDFDocument.load(await fs.readFile(path.join(__dirname, '../assets/idcard-template.pdf')));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 85.6 * 72 / 25.4, height = 54 * 72 / 25.4;
  // Artwork coordinates measured from the supplied PDF; the original is left intact.
  const boxes = [{ left:18.5, bottom:133.2, right:264, top:289.2 }, { left:20, bottom:304.2, right:261.5, top:459.5 }];
  const [frontArt, backArt] = await pdf.embedPages([source.getPage(0), source.getPage(0)], boxes);
  const front = pdf.addPage([width, height]);
  front.drawPage(frontArt, { x:0, y:0, width, height });
  const sx = width / 245.5, sy = height / 156;
  const box = (x,y,w,h,color=rgb(1,1,1)) => front.drawRectangle({ x:x*sx, y:height-(y+h)*sy, width:w*sx, height:h*sy, color });
  const text = (value,x,y,w,size=6.4,b=false) => {
    const f=b?bold:font;
    const safe = String(value || '—').normalize('NFC').replace(/[\u2010-\u2015]/g,'-');
    // Standard fonts cover the Latin names in the supplied design; reject unsupported data rather than produce a corrupt PDF.
    let actual=size;
    while(actual>3 && f.widthOfTextAtSize(safe,actual)>w*sx) actual-=0.2;
    front.drawText(safe,{x:x*sx,y:height-y*sy,size:actual,font:f,color:rgb(.02,.08,.15)});
  };
  box(7,58,70,94);
  const photo = await pdf.embedJpg(await sharp(await fs.readFile(photoPath(card.photoURL))).resize(700,940,{fit:'cover'}).jpeg().toBuffer());
  front.drawImage(photo,{x:7*sx,y:height-152*sy,width:70*sx,height:94*sy});
  // White fields cover all sample personal details while retaining labels and blue bands.
  box(96,53,148,10.5); text(card.fullName,99,61,143,6.8,true);
  box(96,72,87,10); text(card.nationality,99,80,83);
  box(185,72,59,10); text(card.dateOfBirth?new Date(card.dateOfBirth).toLocaleDateString('en-GB',{timeZone:'UTC'}):'',187,80,55,6);
  box(96,91,148,10); text(card.department,99,99,143,6.5);
  box(96,111,75,11); text(card.session,99,120,70,8,true);
  box(176,111,36,11); text(card.gender,179,120,31,6.8);
  box(96,128,116,12,rgb(.77,.92,.98)); text(card.matricNumber,99,137,110,7,true);
  box(96,143,115,11); text(`TEL: ${card.phone || ''}`,98,150,111,6);
  box(212,126,31,29);
  const origin=(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/,'');
  const qr=await pdf.embedPng(await QRCode.toBuffer(`${origin}/verify/${card.verificationToken}`,{margin:1,width:300,errorCorrectionLevel:'M'}));
  front.drawImage(qr,{x:213*sx,y:height-154*sy,width:28*sx,height:28*sy});
  const back=pdf.addPage([width,height]); back.drawPage(backArt,{x:0,y:0,width,height});
  const bx=width/241.5, by=height/155.3;
  back.drawRectangle({x:0,y:height-29*by,width,height:20*by,color:rgb(1,1,1)});
  const barcode=await pdf.embedPng(await bwip.toBuffer({bcid:'code128',text:card.matricNumber,scale:3,height:8,includetext:false}));
  back.drawImage(barcode,{x:3*bx,y:height-29*by,width:235*bx,height:19*by});
  back.drawRectangle({x:151*bx,y:height-55*by,width:38*bx,height:13*by,color:rgb(1,1,1)});
  back.drawText(String(new Date(card.approvedAt).getFullYear()),{x:159*bx,y:height-51*by,font:bold,size:8});
  pdf.setTitle(`i-FATOSS ID card - ${card.matricNumber}`);
  pdf.setSubject('Print at actual size / 100%. Front: page 1. Back: page 2.');
  return Buffer.from(await pdf.save());
}
async function printable(id,user,ipAddress) {
  const card=await IdCard.findById(id);
  if(!card || !['approved','collected'].includes(card.status) || !card.feePaid || !card.verificationToken || card.expiresAt < new Date()) throw new AppError('Approve a paid, valid ID card before printing',409);
  const student=await require('../models/student.model').findById(card.student);
  if(!student || student.status==='archived') throw new AppError('Student is inactive',409);
  const buffer=await render(card);
  await IdCard.updateOne({_id:id},{$inc:{printCount:1},$set:{lastPrintedAt:new Date()}});
  await logAction({performedBy:user.userId,ipAddress,action:'UPDATE',targetType:'IDCARD',targetId:id,affectedStudent:card.student,description:'Front and back ID-card PDF generated'});
  return buffer;
}
module.exports={storePhoto,removePhoto,photoPath,approve,renew,render,printable};
