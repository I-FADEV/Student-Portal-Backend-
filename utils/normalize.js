const normalizeString = (value) => {
  if (!value || typeof value !== "string") return value;
  return value.trim().toUpperCase();
};

const normalizeDay = (day) => {
  if (!day) return day;
  const d = day.toLowerCase();
  return d.charAt(0).toUpperCase() + d.slice(1);
};

module.exports = { normalizeString, normalizeDay };
