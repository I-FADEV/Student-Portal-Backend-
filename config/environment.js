const path = require('path');
const fs = require('fs');
function validateEnvironment() {
  for (const name of ['MONGO_URI', 'JWT_SECRET']) if (!process.env[name]) throw new Error(`Missing ${name}. Check your environment configuration.`);
  if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.UPLOAD_DIR || !path.isAbsolute(process.env.UPLOAD_DIR)) throw new Error('Set UPLOAD_DIR to an absolute persistent storage volume path in production.');
    const origins = (process.env.FRONTEND_URL || '').split(',').map(value => value.trim());
    if (origins.some(value => { try { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value || !!url.username || !!url.password; } catch { return true; } })) throw new Error('Set FRONTEND_URL to exact HTTPS origins in production (no paths or trailing slashes).');
    if (/replace|example|fixture|changeme/i.test(process.env.JWT_SECRET)) throw new Error('Replace the placeholder JWT_SECRET before production.');
  }
  fs.mkdirSync(uploadDirectory(), { recursive: true });
}
function uploadDirectory() { return path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')); }
module.exports = { validateEnvironment, uploadDirectory };
