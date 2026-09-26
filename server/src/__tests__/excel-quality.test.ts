import { DataQualityService } from '../services/data-quality.js';
import { ExcelParserService } from '../services/excel-parser.js';

async function runExcelQualityTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ PIPELINE DỮ LIỆU EXCEL & DATA QUALITY ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Date normalization tests (DD/MM/YYYY -> YYYY-MM-DD)
  const d1 = ExcelParserService.cleanCellValue('25/12/2026');
  assert(d1 === '2026-12-25', 'Chuẩn hóa định dạng ngày VN 25/12/2026 sang 2026-12-25');

  const d2 = ExcelParserService.cleanCellValue('5-4-2026');
  assert(d2 === '2026-04-05', 'Chuẩn hóa định dạng ngày 5-4-2026 sang 2026-04-05');

  const d3 = ExcelParserService.cleanCellValue(new Date('2026-09-26T00:00:00.000Z'));
  assert(d3 === '2026-09-26', 'Chuẩn hóa đối tượng Date sang YYYY-MM-DD');

  // 2. Semantic Mapping tests (Vietnamese FMCG & Retail headers)
  const map1 = ExcelParserService.guessFieldMapping('mã sản phẩm');
  assert(map1?.mapping === 'sku_code', 'Ánh xạ chuẩn "mã sản phẩm" -> sku_code');

  const map2 = ExcelParserService.guessFieldMapping('tồn kho');
  assert(map2?.mapping === 'inventory_qty', 'Ánh xạ chuẩn "tồn kho" -> inventory_qty');

  const map3 = ExcelParserService.guessFieldMapping('doanh thu');
  assert(map3?.mapping === 'sales_revenue', 'Ánh xạ chuẩn "doanh thu" -> sales_revenue');

  // 3. Data Quality Engine - Clean valid data
  const validRows = [
    { sku_code: 'SKU-001', inventory_qty: 50, unit_price: 120000, date: '2026-09-26' },
    { sku_code: 'SKU-002', inventory_qty: 30, unit_price: 85000, date: '2026-09-26' }
  ];
  const reportValid = DataQualityService.evaluate(validRows, 'inventory');
  assert(reportValid.qualityScore === 100, 'Tập dữ liệu sạch đạt điểm chất lượng 100/100');
  assert(reportValid.isReliable === true, 'Đánh giá độ tin cậy isReliable = true');
  assert(reportValid.criticalCount === 0, 'Số lỗi nghiêm trọng = 0');

  // 4. Data Quality Engine - Error handling (Negative, Missing SKU, Invalid Number)
  const dirtyRows = [
    { sku_code: '', inventory_qty: 50 }, // Missing SKU (Critical)
    { sku_code: 'SKU-003', inventory_qty: -10 }, // Negative stock (Critical)
    { sku_code: 'SKU-004', inventory_qty: 'abc_invalid' }, // Format error (Critical)
    { sku_code: 'SKU-005', inventory_qty: 20, date: 'invalid-date-format' } // Invalid date (Warning)
  ];
  const reportDirty = DataQualityService.evaluate(dirtyRows, 'inventory');
  assert(reportDirty.criticalCount === 3, 'Phát hiện chính xác 3 lỗi nghiêm trọng (missing SKU, negative, format error)');
  assert(reportDirty.summary.missingSkuCount === 1, 'Đếm đúng 1 lỗi thiếu SKU');
  assert(reportDirty.summary.negativeValueCount === 1, 'Đếm đúng 1 lỗi giá trị âm');
  assert(reportDirty.summary.invalidDateCount === 1, 'Đếm đúng 1 cảnh báo ngày sai định dạng');
  assert(reportDirty.isReliable === false, 'Tập dữ liệu lỗi không được đánh dấu là tin cậy (isReliable = false)');

  console.log(`\n=== KẾT QUẢ KIỂM THỬ DATA QUALITY: ${passed} ĐẠT, ${failed} THẤT BẠI ===`);
  if (failed > 0) process.exit(1);
}

runExcelQualityTests().catch(console.error);
