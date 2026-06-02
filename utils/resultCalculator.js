/**
 * Calculates the grade for a given total score (out of 100).
 * Scale confirmed:
 *   A  →  70 – 100
 *   B  →  60 – 69
 *   C  →  50 – 59
 *   D  →  40 – 49
 *   E  →  30 – 39
 *   F  →   0 – 29
 */
function calculateGrade(total) {
  const score = Number(total);
  if (isNaN(score)) return 'F';
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  if (score >= 30) return 'E';
  return 'F';
}

module.exports = calculateGrade;