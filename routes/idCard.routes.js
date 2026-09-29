const express  = require("express");
const router   = express.Router();
const upload   = require("../config/multer");
const protect  = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const { createIdCardSchema } = require("../validation/idCard.validation");
const {
  viewIdCard,
  createIdcard,
  markFeePaid,
  markCollected,
  rejectIdCard,
  getAllIdCards,
  getIdCardStats,
} = require("../controllers/idCard.controller");

const cards = require('../models/idcard.model');
const printing = require('../services/cardPrinting.service');
const wrap = fn => async(req,res,next) => { try { await fn(req,res); } catch(e) { next(e); } };
router.get('/verify/:token', wrap(async(req,res) => {
 if(!/^[a-f0-9]{48}$/.test(req.params.token)) return res.status(404).json({ valid:false });
 const card = await cards.findOne({verificationToken:req.params.token}).populate('student','status');
 const valid=Boolean(card && card.student && card.student.status!=='archived' && card.feePaid && ['approved','collected'].includes(card.status) && card.expiresAt>new Date());
 res.set('Cache-Control','no-store').json(valid ? {valid:true,fullName:card.fullName,matricNumber:card.matricNumber,expiresAt:card.expiresAt} : {valid:false});
}));
router.get('/photo/:filename', protect, wrap(async(req,res) => {
 const card=await cards.findOne({photoURL:req.params.filename});
 if(!card || !(['idcard_admin','student_officer'].includes(req.user.adminType) || String(card.student)===req.user.userId)) return res.status(404).json({error:'Photo not found'});
 res.set('Cache-Control','private, no-store').type('jpeg').send(await printing.readPhoto(req.params.filename));
}));
router.post('/:id/approve', protect, roleCheck(['admin'],['idcard_admin']), wrap(async(req,res) => res.json({data:await printing.approve(req.params.id,req.user,req.ip)})));
router.post('/:id/renew', protect, roleCheck(['admin'],['idcard_admin']), wrap(async(req,res) => res.json({data:await printing.renew(req.params.id,req.user,req.ip)})));
router.get('/:id/print', protect, roleCheck(['admin'],['idcard_admin']), wrap(async(req,res) => {
 const pdf=await printing.printable(req.params.id,req.user,req.ip);
 res.set({'Content-Type':'application/pdf','Content-Disposition':'inline; filename="ifatoss-id-card.pdf"','Cache-Control':'no-store'}).send(pdf);
}));

// ── STUDENT ───────────────────────────────────────────────────────────────────

// GET /idcard/view — student views own record (auto-created on first visit)
router.get("/view", protect, roleCheck(["student"]), viewIdCard);

// POST /idcard/create — student submits form
router.post(
  "/create",
  protect,
  roleCheck(["student"]),
  upload.single("photoURL"),
  validate(createIdCardSchema),
  createIdcard,
);

// ── BURSAR ADMIN ──────────────────────────────────────────────────────────────

// PATCH /idcard/fee/:studentId — bursar marks ID card fee as paid
router.patch(
  "/fee/:studentId",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  markFeePaid,
);

// ── TAC ADMIN ─────────────────────────────────────────────────────────────────

// GET /idcard/stats — dashboard stat counts
router.get(
  "/stats",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  getIdCardStats,
);

// GET /idcard/admin?status= — view all submissions
router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  getAllIdCards,
);

// PATCH /idcard/:id/collect — mark as collected
router.patch(
  "/:id/collect",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  markCollected,
);

// PATCH /idcard/:id/reject — reject submission
router.patch(
  "/:id/reject",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  rejectIdCard,
);

module.exports = router;
