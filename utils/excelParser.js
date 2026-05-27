const XLSX = require("xlsx");

// Normalize keys like "Matric Number", "matric_number" → "matricnumber"
const normalizeKey = (key) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseExcel = (filePath) => {
  // opens the excel file
  const workbook = XLSX.readFile(filePath);
  // get first sheet
  const sheetName = workbook.SheetNames[0];
  // gets the actual data
  const sheet = workbook.Sheets[sheetName];

  // converts to json
  const rawData = XLSX.utils.sheet_to_json(sheet);

  const parsed = rawData
    .map((row) => {
      // Normalize all keys in the row
      const normalizedRow = {}
      for (const key in row) {
        normalizedRow[normalizeKey(key)] = row[key];
      }

      const matricNumber =
        normalizedRow.matricnumber || normalizedRow.matric || normalizedRow.matricno || null;

      const test = normalizedRow.test ?? null;
      const exam = normalizedRow.exam ?? null;

      // Skip completely empty rows
      if (!matricNumber && test === null && exam === null) return null;

      return {
        matricNumber,
        test,
        exam,
      };
    })
    .filter(Boolean); // remove null rows

  return parsed;
};

module.exports = parseExcel;