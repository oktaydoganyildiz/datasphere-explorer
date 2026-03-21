const ExcelJS = require('exceljs');

class ExportService {
  async createExcel(tableName, columns, rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DataSphere Explorer';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(tableName.substring(0, 31)); // Excel limit

    // Define Columns
    sheet.columns = columns.map(col => ({
      header: col.COLUMN_NAME,
      key: col.COLUMN_NAME,
      width: 20
    }));

    // Style Header Row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C5F8A' } // SAP Blue-ish
    };

    // Add Data
    rows.forEach(row => {
      sheet.addRow(row);
    });

    return workbook.xlsx.writeBuffer();
  }
}

module.exports = new ExportService();
