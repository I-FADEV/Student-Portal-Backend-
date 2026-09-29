require('dotenv').config();
const mongoose = require('mongoose');
const { validateEnvironment } = require('./config/environment');
async function start() {
  validateEnvironment();
  require('./services/push.service').validateConfiguration();
  await mongoose.connect(process.env.MONGO_URI);
  const topology = await mongoose.connection.db.admin().command({hello:1});
  if(!topology.setName && topology.msg!=='isdbgrid') throw new Error('MongoDB must support transactions: configure a replica set or use Atlas.');
  const app = require('./app');
  await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
  const server = app.listen(process.env.PORT || 3000, () => console.log('Student Portal API ready'));
  const stopPushWorker = require('./services/push.service').startWorker();
  const scheduler = setInterval(() => require('./services/session.service').activateDue().catch(console.error), 30000);
  scheduler.unref();
  const shutdown = () => { stopPushWorker(); clearInterval(scheduler); server.close(() => mongoose.disconnect()); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
start().catch(error => { console.error(error.message); process.exitCode = 1; mongoose.disconnect(); });
