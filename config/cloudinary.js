const cloudinary = require("cloudinary").v2;

function credentials() {
  if (process.env.CLOUDINARY_URL) {
    try {
      const value = new URL(process.env.CLOUDINARY_URL);
      if (value.protocol !== 'cloudinary:' || !value.username || !value.password || !value.hostname) return null;
      return { cloud_name:value.hostname, api_key:decodeURIComponent(value.username), api_secret:decodeURIComponent(value.password) };
    } catch { return null; }
  }
  const { CLOUD_NAME:cloud_name, CLOUD_API_KEY:api_key, CLOUD_API_SECRET:api_secret } = process.env;
  return cloud_name && api_key && api_secret ? { cloud_name, api_key, api_secret } : null;
}

function configured() { return Boolean(credentials()); }
function configure() {
  const config=credentials();
  if (!config) throw new Error('Configure CLOUDINARY_URL or CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET.');
  cloudinary.config(config);
  return cloudinary;
}

module.exports = { cloudinary, configured, configure };
