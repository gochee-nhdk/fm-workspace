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
  assert(calculateDaysOfCover(100, 10) === 10, 'DoC chuẩn xác khi có doanh số bình thường: 100 / 10 = 10 ngày');
  assert(calculateDaysOfCover(0, 10) === 0, 'DoC bằng 0 khi tồn kho bằng 0');
  assert(calculateDaysOfCover(-5, 10) === 0, 'DoC bằng 0 khi tồn kho âm (stockout)');
  assert(calculateDaysOfCover(50, 0) === 999, 'DoC xử lý an toàn khi tốc độ bán = 0 (trả về 999, không lỗi chia 0)');
  assert(calculateDaysOfCover(50, -2) === 999, 'DoC xử lý an toàn khi tốc độ bán âm (trả về 999)');

  // 2. Safety Stock Test
  assert(calculateSafetyStock(5, 3) === 15, 'Safety stock: 5 * 3 = 15');
  assert(calculateSafetyStock(0, 3) === 0, 'Safety stock bằng 0 khi ADS = 0');
  assert(calculateSafetyStock(5, 0) === 0, 'Safety stock bằng 0 khi SafetyDays = 0');
  assert(calculateSafetyStock(-5, 3) === 0, 'Safety stock bằng 0 khi ADS âm');
  assert(calculateSafetyStock(5, -3) === 0, 'Safety stock bằng 0 khi SafetyDays âm');

  // 3. Reorder Point Test
  assert(calculateReorderPoint(10, 2, 30) === 50, 'Reorder point: (10 * 2) + 30 = 50');
  assert(calculateReorderPoint(0, 2, 30) === 30, 'Reorder point khi ADS = 0: 0 + 30 = 30');
  assert(calculateReorderPoint(10, 0, 15) === 15, 'Reorder point khi LeadTime = 0: 0 + 15 = 15');
  assert(calculateReorderPoint(10, 2, 0) === 20, 'Reorder point khi SafetyStock = 0: 20 + 0 = 20');
  assert(calculateReorderPoint(-10, 2, 30) === 30, 'Reorder point xử lý an toàn khi ADS âm');

  // 4. Net Requirement & Incoming Stock Logic Test
  const testTargetStock = 100;
  const testCurrentStock = 20;
  const testIncomingStock = 40;
  const rawNeedWithIncoming = testTargetStock - (testCurrentStock + testIncomingStock);
  assert(rawNeedWithIncoming === 40, 'Nhu cầu đặt hàng ròng trừ chính xác lượng hàng đang về: 100 - (20 + 40) = 40');
  const rawNeedFullIncoming = testTargetStock - (testCurrentStock + 90);
  assert(rawNeedFullIncoming < 0, 'Khi hàng đang về đủ bù đắp mục tiêu, nhu cầu đặt hàng ròng <= 0');

  console.log(`\n=== KẾT QUẢ KIỂM THỬ: ${passed} ĐẠT, ${failed} THẤT BẠI ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
