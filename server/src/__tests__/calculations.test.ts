import {
  calculateAverageDailySales,
  calculateDaysOfCover,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateRecommendedOrderQty
} from '../services/calculations.js';

async function runTests() {
  console.log('=== BẮT ĐẦU CHẠY KIỂM THỬ THUẬT TOÁN THU MUA (PROCUREMENT ENGINE TESTS) ===\n');

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

  // 1. Days of Cover Test
  // CurrentStock: 100, ADS: 10 -> DoC = 10
  assert(calculateDaysOfCover(100, 10) === 10, 'DoC chuẩn xác khi có doanh số bình thường: 100 / 10 = 10 ngày');
  
  // CurrentStock: 0, ADS: 10 -> DoC = 0
  assert(calculateDaysOfCover(0, 10) === 0, 'DoC bằng 0 khi tồn kho bằng 0');

  // ADS = 0 -> DoC = 999 (tránh chia cho 0)
  assert(calculateDaysOfCover(50, 0) === 999, 'DoC xử lý an toàn khi tốc độ bán = 0 (trả về 999, không lỗi chia 0)');

  // 2. Safety Stock Test
  // ADS: 5, SafetyDays: 3 -> SS = 15
  assert(calculateSafetyStock(5, 3) === 15, 'Safety stock: 5 * 3 = 15');

  // ADS: 0 -> SS = 0
  assert(calculateSafetyStock(0, 3) === 0, 'Safety stock bằng 0 khi ADS = 0');

  // 3. Reorder Point Test
  // ADS: 10, LeadTime: 2, SafetyStock: 30 -> ROP = 20 + 30 = 50
  assert(calculateReorderPoint(10, 2, 30) === 50, 'Reorder point: (10 * 2) + 30 = 50');

  console.log(`\n=== KẾT QUẢ KIỂM THỬ: ${passed} ĐẠT, ${failed} THẤT BẠI ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
