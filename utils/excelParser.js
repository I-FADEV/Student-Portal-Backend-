const ExcelJS = require('exceljs');
module.exports = async filePath => {
 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.readFile(filePath);
 const sheet=workbook.worksheets[0]; if(!sheet) return [];
 if(sheet.rowCount>2001 || sheet.columnCount>50) throw new Error('Workbook limit: 2000 result rows and 50 columns');
 const headers=[]; sheet.getRow(1).eachCell((cell,col)=>{headers[col]=cell.text.toLowerCase().replace(/[^a-z0-9]/g,'');});
 const rows=[];
 sheet.eachRow((row,index)=>{ if(index===1) return; const values={}; row.eachCell((cell,col)=>{values[headers[col]]=cell.value?.result ?? cell.value;});
 rows.push({matricNumber:values.matricnumber||values.matric||values.matricno,test:values.test??values.testscore,exam:values.exam??values.examscore}); });
 return rows;
};
