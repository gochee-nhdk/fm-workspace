import {
  freeTranslate,
  offlineDictionaryTranslate,
  localTransform,
  WritingToolAction,
  sanitizeAiWritingOutput,
} from './writingToolsService.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== WRITING TOOLS COMPREHENSIVE UNIT TESTS ===\n');

  // Test 1: Offline Dictionary Translation
  console.log('--- TEST GROUP 1: Offline Dictionary & Term Translation ---');
  const en1 = offlineDictionaryTranslate('bút', 'en');
  assert(en1.toLowerCase() === 'pen', 'Translates "bút" to "pen"');

  const en2 = offlineDictionaryTranslate('nhà cung cấp', 'en');
  assert(en2.toLowerCase().includes('supplier'), 'Translates "nhà cung cấp" to "supplier"');

  const en3 = offlineDictionaryTranslate('hợp đồng', 'en');
  assert(en3.toLowerCase().includes('contract'), 'Translates "hợp đồng" to "contract"');

  const vi1 = offlineDictionaryTranslate('supplier', 'vi');
  assert(vi1.toLowerCase().includes('nhà cung cấp'), 'Translates "supplier" to "nhà cung cấp"');

  const vi2 = offlineDictionaryTranslate('report', 'vi');
  assert(vi2.toLowerCase().includes('báo cáo'), 'Translates "report" to "báo cáo"');

  // Test 2: freeTranslate fallback
  console.log('\n--- TEST GROUP 2: freeTranslate Fallback Behavior ---');
  const transRes = await freeTranslate('xin chào', 'en');
  assert(
    typeof transRes === 'string' && transRes.trim().length > 0 && transRes.toLowerCase() !== 'xin chào',
    `freeTranslate("xin chào", "en") translates properly: "${transRes}"`
  );

  // Test 3: Expansion heuristics (no robotic boilerplate)
  console.log('\n--- TEST GROUP 3: Expand Heuristics Quality ---');
  const roboticSuffix = '(bao gồm chi tiết thông số, kiểm tra xác nhận và theo dõi tiến độ thực hiện)';
  const testInputProcurement = 'Mua 50 hộp bút bi';
  const expandedProcurement = localTransform(testInputProcurement, 'expand');
  assert(!expandedProcurement.includes(roboticSuffix), 'Expand removes robotic boilerplate suffix for procurement');
  assert(
    expandedProcurement.includes('nhà cung cấp') || expandedProcurement.includes('báo giá'),
    'Expand adds realistic procurement context'
  );

  const testInputMeeting = 'Họp với khách hàng';
  const expandedMeeting = localTransform(testInputMeeting, 'expand');
  assert(!expandedMeeting.includes(roboticSuffix), 'Expand removes robotic boilerplate suffix for meetings');
  assert(
    expandedMeeting.includes('cuộc họp') || expandedMeeting.includes('nội dung'),
    'Expand adds realistic meeting context'
  );

  const testInputFood = 'Đi ăn phở bò';
  const expandedFood = localTransform(testInputFood, 'expand');
  assert(!expandedFood.includes(roboticSuffix), 'Expand removes robotic boilerplate suffix for daily life');
  assert(
    expandedFood.includes('trải nghiệm') || expandedFood.includes('phù hợp'),
    'Expand adds realistic lifestyle context'
  );

  // Test 4: Action Items extraction
  console.log('\n--- TEST GROUP 4: Action Items Extraction ---');
  const rawNotes = `Kế hoạch tuần này:
1. Gửi báo cáo tồn kho cho sếp
Hôm nay trời rất mát mẻ.
2. Mua văn phòng phẩm mới
Kiểm tra lại hợp đồng vận chuyển`;

  const actionItems = localTransform(rawNotes, 'action_items');
  const actionLines = actionItems.split('\n');
  assert(actionLines.length >= 3, `Extracted ${actionLines.length} action items`);
  assert(
    actionLines.every((line) => line.startsWith('- [ ] ')),
    'All extracted items have markdown checklist format "- [ ] "'
  );
  assert(
    actionLines.some((l) => l.includes('Gửi báo cáo')),
    'Extracted verb line: Gửi báo cáo'
  );
  assert(
    actionLines.some((l) => l.includes('Mua văn phòng phẩm')),
    'Extracted numbered/verb line: Mua văn phòng phẩm'
  );
  assert(
    actionLines.some((l) => l.includes('Kiểm tra')),
    'Extracted verb line: Kiểm tra'
  );

  // Test 5: Verify all 9 Writing Tools actions
  console.log('\n--- TEST GROUP 5: All 9 Writing Tools Coverage ---');
  const allActions: WritingToolAction[] = [
    'summarize',
    'keypoints',
    'professional',
    'concise',
    'proofread',
    'expand',
    'action_items',
    'translate_en',
    'translate_vi',
  ];
  assert(allActions.length === 9, 'All 9 writing tools are recognized and typed');

  for (const act of allActions) {
    const res = localTransform('Nhà cung cấp đã gửi báo cáo hôm nay.', act);
    assert(typeof res === 'string' && res.trim().length > 0, `localTransform works for action: ${act}`);
  }

  // Test 6: Offline translate never returns raw text if words match dictionary
  const enTermRes = localTransform('bút chì', 'translate_en');
  assert(enTermRes.toLowerCase().includes('pencil'), 'localTransform translate_en uses dictionary instead of untranslated text');

  const viTermRes = localTransform('supplier', 'translate_vi');
  assert(viTermRes.toLowerCase().includes('nhà cung cấp'), 'localTransform translate_vi uses dictionary instead of untranslated text');

  // Test 7: AI Output Sanitizer (fixes Image 1 meta-analysis reflection error)
  console.log('\n--- TEST GROUP 7: AI Output Sanitizer (Fix Image 1 Error) ---');

  // Case 7.1: Image 1 exact error structure
  const rawImage1Error = `* Input: "bút"
* Goal: Sửa lỗi chính tả tiếng Việt
* Constraint 1: Chỉ trả về kết quả
* Constraint 2: Không thêm giải thích
Bút bi chuyên dụng phục vụ ký kết hợp đồng.`;
  const sanitized71 = sanitizeAiWritingOutput(rawImage1Error);
  assert(
    sanitized71 === 'Bút bi chuyên dụng phục vụ ký kết hợp đồng.',
    'Sanitizer strips raw meta-analysis preamble (* Input:, * Goal:, * Constraint:)'
  );
  assert(!sanitized71.includes('* Input:'), 'Sanitizer drops * Input: line');
  assert(!sanitized71.includes('* Goal:'), 'Sanitizer drops * Goal: line');
  assert(!sanitized71.includes('* Constraint'), 'Sanitizer drops * Constraint line');

  // Case 7.2: Analysis block with Output / Result label
  const rawWithOutputLabel = `Analysis:
- Target: expand text
- Language: Vietnamese
Output: Mua 100 ram giấy in A4 chất lượng cao.`;
  const sanitized72 = sanitizeAiWritingOutput(rawWithOutputLabel);
  assert(
    sanitized72 === 'Mua 100 ram giấy in A4 chất lượng cao.',
    'Sanitizer extracts clean output following Output: label'
  );

  // Case 7.3: Conversational intro
  const rawWithIntro = `Dưới đây là kết quả sau khi xử lý:
Kiểm tra tiến độ giao hàng trước 17h.`;
  const sanitized73 = sanitizeAiWritingOutput(rawWithIntro);
  assert(
    sanitized73 === 'Kiểm tra tiến độ giao hàng trước 17h.',
    'Sanitizer strips Vietnamese conversational preamble'
  );

  // Case 7.4: Outer code fences
  const rawWithFences = '```markdown\nBáo cáo chi tiết đơn hàng quý 4.\n```';
  const sanitized74 = sanitizeAiWritingOutput(rawWithFences);
  assert(
    sanitized74 === 'Báo cáo chi tiết đơn hàng quý 4.',
    'Sanitizer removes outer markdown code fences'
  );

  // Case 7.5: Enclosing quotes
  const rawWithQuotes = '"Đã thanh toán cho nhà cung cấp."';
  const sanitized75 = sanitizeAiWritingOutput(rawWithQuotes);
  assert(
    sanitized75 === 'Đã thanh toán cho nhà cung cấp.',
    'Sanitizer removes enclosing quotes'
  );

  // Case 7.6: Legitimate checklist & numbered list are preserved
  const checklistInput = '- [ ] Mua văn phòng phẩm\n- [ ] Gửi hợp đồng';
  const sanitizedChecklist = sanitizeAiWritingOutput(checklistInput);
  assert(
    sanitizedChecklist === checklistInput,
    'Sanitizer preserves legitimate markdown checklists'
  );

  const numberedInput = '1. Ý chính thứ nhất\n2. Ý chính thứ hai';
  const sanitizedNumbered = sanitizeAiWritingOutput(numberedInput);
  assert(
    sanitizedNumbered === numberedInput,
    'Sanitizer preserves legitimate numbered points'
  );

  console.log(`\n=== TỔNG KẾT KIỂM THỬ WRITING TOOLS: ${passed} ĐẠT, ${failed} THẤT BẠI ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
