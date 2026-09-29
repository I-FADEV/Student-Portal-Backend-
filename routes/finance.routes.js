const express   = require("express");
const router    = express.Router();
const protect   = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const validate  = require("../middleware/validate.middleware");
const {
  createFinance,
  payFinance,
  viewFinance,
  getFinanceStats,
  createBulkFinance,
  addItemToFinance,
} = require("../controllers/finance.controller");
const {
  createFinanceSchema,
  createBulkFinanceSchema,
  addItemSchema,
  paymentSchema,
} = require("../validation/finance.validation");

// ── Finance Admin only ────────────────────────────────────────────────────────
router.get(
  "/stats",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  getFinanceStats,
);

router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(createFinanceSchema),
  createFinance,
);

router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(createBulkFinanceSchema),
  createBulkFinance,
);

router.post(
  "/pay/:id",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(paymentSchema),
  payFinance,
);

router.post(
  "/:id/add-item",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(addItemSchema),
  addItemToFinance,
);

router.get(
  "/adminView",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  viewFinance,
);

// ── Student only ──────────────────────────────────────────────────────────────
router.get(
  "/view",
  protect,
  roleCheck(["student"]),
  viewFinance,
);

router.get('/:id/payments', protect, roleCheck(['admin','student']), async(req,res,next) => {
 try {
  const Finance = require('../models/finance.model'); const Payment = require('../models/payment.model');
  const record = await Finance.findById(req.params.id);
  if (!record || (req.user.role === 'student' && String(record.student) !== req.user.userId)) return res.status(404).json({ error: 'Record not found' });
  if (req.user.role === 'admin' && req.user.adminType !== 'finance_admin') return res.status(403).json({ error: 'Access denied' });
  res.json({ data: await Payment.find({ finance: record.id }).sort({ createdAt:-1 }) });
 } catch(e) { next(e); }
});
router.post('/payments/:id/reverse', protect, roleCheck(['admin'], ['finance_admin']), async(req,res,next) => {
 try { res.json({ data: await require('../services/payment.service').reverse(req.params.id, req.body.reason, req.user.userId, req.ip) }); } catch(e) { next(e); }
});
router.post('/:id/reconcile',protect,roleCheck(['admin'],['finance_admin']),async(req,res,next)=>{try{res.json({data:await require('../services/reconciliation.service').reconcile(req.params.id,req.body,req.user)})}catch(e){next(e)}});
module.exports = router;