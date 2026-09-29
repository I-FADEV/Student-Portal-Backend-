function calculateGrade(total) {
 const score = Number(total);
 if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('Total must be between 0 and 100');
 return score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : score >= 40 ? 'E' : 'F';
}
module.exports = calculateGrade;
