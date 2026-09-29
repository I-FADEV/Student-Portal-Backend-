const { current } = require('../services/session.service');
const AppError = require('./appError');
exports.getActiveSession = async () => {
 const session = await current(true);
 if (!session) throw new AppError('No active academic session. Ask the general administrator to start one.', 400);
 return session;
};
