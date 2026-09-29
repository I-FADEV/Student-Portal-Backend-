const router = require('express').Router();
const protect = require('../middleware/auth.middleware');
const roleCheck = require('../middleware/roleCheck.middleware');
const service = require('../services/session.service');
const Session = require('../models/session.model');
const wrap = fn => async (req,res,next) => { try { await fn(req,res); } catch(e) { next(e); } };
router.use(protect);
router.get('/academic/active', wrap(async(req,res) => res.json({ data: await service.current(true) })));
router.get('/academic/current', roleCheck(['admin'], ['general_admin']), wrap(async(req,res) => res.json({ data: await service.current() })));
router.get('/active', (req,res) => res.json({ active: true, user: req.account }));
router.post('/logout', wrap(async(req,res) => { req.account.tokenVersion = (req.account.tokenVersion || 0) + 1; await req.account.save(); res.json({ message: 'Signed out' }); }));
router.get('/', roleCheck(['admin']), wrap(async(req,res) => res.json({ data: (await Session.find().sort({ createdAt:-1 })).map(service.present) })));
router.get('/history', roleCheck(['admin'], ['general_admin']), wrap(async(req,res) => res.json({ data: (await Session.find().sort({ createdAt:-1 })).map(service.present) })));
for(const [route,action] of [['create','create'],['end-current-phase','end'],['start-next-phase','start'],['close','close']]) {
 router.post('/'+route, roleCheck(['admin'], ['general_admin']), wrap(async(req,res) => res.status(action==='create'?201:200).json({ data: await service.change(action,req.body,req.user,req.ip) })));
}
module.exports = router;
