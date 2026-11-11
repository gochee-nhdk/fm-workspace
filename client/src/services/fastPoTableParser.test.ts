import {
  cleanVietnameseNumber,
  cleanVietnameseDate,
  extractMetadataFromFileName,
  parseFastPOFromText,
} from '../utils/fastPoTableParser';

console.log('=== BẮT ĐẦU KIỂM THỬ HIGH-PRECISION FAST PO TABLE PARSER ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${msg}`);
  } else {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// -------------------------------------------------------------
// NHÓM 1: CHUẨN HÓA SỐ TIỀN VÀ NGÀY THÁNG VIỆT NAM
// -------------------------------------------------------------
console.log('--- TEST GROUP 1: Vietnamese Number & Date Sanitization ---');
assert(cleanVietnameseNumber('181.600,00') === 181600, 'Chuẩn hóa số tiền có chấm phân cách và phẩy thập phân: 181.600,00 -> 181600');
assert(cleanVietnameseNumber('8.353.600,00') === 8353600, 'Chuẩn hóa số tiền triệu: 8.353.600,00 -> 8353600');
assert(cleanVietnameseNumber('46,00') === 46, 'Chuẩn hóa số lượng thập phân: 46,00 -> 46');
assert(cleanVietnameseNumber('225') === 225, 'Chuẩn hóa số lượng nguyên: 225 -> 225');
assert(cleanVietnameseNumber('8,353,600') === 8353600, 'Chuẩn hóa định dạng phẩy phân cách: 8,353,600 -> 8353600');

assert(cleanVietnameseDate('2/11/2026') === '2026-11-02', 'Chuẩn hóa ngày 2/11/2026 thành 2026-11-02');
assert(cleanVietnameseDate('05/11/2026') === '2026-11-05', 'Chuẩn hóa ngày 05/11/2026 thành 2026-11-05');
assert(cleanVietnameseDate('05-Nov-2026') === '2026-11-05', 'Chuẩn hóa ngày tiếng Anh 05-Nov-2026 thành 2026-11-05');
assert(cleanVietnameseDate('Ngày chứng từ: 15/12/2026') === '2026-12-15', 'Tự động làm sạch tiền tố "Ngày chứng từ:"');

// -------------------------------------------------------------
// NHÓM 2: TRÍCH XUẤT METADATA TỪ TÊN FILE
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 2: File Name Metadata Extraction ---');
const meta1 = extractMetadataFromFileName('118873_BẢO MINH_DC01.pdf');
assert(meta1.po_number === 'PO-118873', 'Tên file chứa mã số đơn hàng nhận diện thành PO-118873');
assert(meta1.supplier_name === 'BẢO MINH', 'Nhận diện đúng tên nhà cung cấp BẢO MINH');
assert(meta1.warehouse === 'DC01', 'Nhận diện đúng kho nhận hàng DC01');

// -------------------------------------------------------------
// NHÓM 3: BÓC TÁCH ĐƠN HÀNG FARMERS MARKET / LARIA CHUẨN
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Standard Farmers Market PO Parsing ---');

const sampleFarmersMarketPO = `
CÔNG TY TNHH THƯƠNG MẠI LARIA
HỆ THỐNG SIÊU THỊ FARMERS MARKET
Số hiệu chứng từ: PO-118292
Ngày chứng từ: 02/11/2026
Ngày giao hàng: 05/11/2026
Tên NCC: CÔNG TY CỔ PHẦN DEVIE
Mã NCC: V0001613
Chi nhánh yêu cầu: DC01 - Nơ Trang Long, 204 Nơ Trang Long, Phường Bình Thạnh, TP.HCM
Người đặt hàng: Nguyễn Hùng Tiến

STT\tInternal Code\tBarcode\tMặt hàng\tSố lượng\tĐVT\tĐơn giá chưa VAT\tThành tiền chưa VAT
1\t10015745\t8936034090123\tHạt dinh dưỡng Your SuperFood Mix nhiều loại hạt hũ 400 g\t46,00\tHũ\t181.600,00\t8.353.600,00

TỔNG TIỀN HÀNG: 8.353.600
VAT (8%): 668.288
TỔNG THANH TOÁN: 9.021.888
`;

const res1 = parseFastPOFromText(sampleFarmersMarketPO, 'PO-118292_DEVIE_DC01.pdf');

assert(res1.isConfident === true, 'Đơn PO chuẩn đạt trạng thái tin cậy tuyệt đối isConfident = true');
assert(res1.confidenceScore === 1.0, 'Độ tin cậy toán học đạt 1.0 (100%)');
assert(res1.data.po_number === 'PO-118292', 'Trích xuất chính xác số PO: PO-118292');
assert(res1.data.supplier_name === 'CÔNG TY CỔ PHẦN DEVIE', 'Trích xuất chính xác NCC (bỏ qua Buyer LARIA)');
assert(res1.data.supplier_code === 'V0001613', 'Trích xuất đúng mã NCC: V0001613');
assert(res1.data.po_date === '2026-11-02', 'Trích xuất đúng ngày PO: 2026-11-02');
assert(res1.data.expected_delivery_date === '2026-11-05', 'Trích xuất đúng hạn giao hàng: 2026-11-05');
assert(res1.data.warehouse?.includes('DC01'), 'Trích xuất đúng kho nhận hàng: DC01');
assert(res1.data.notes === 'Nguyễn Hùng Tiến', 'Trích xuất đúng người đặt hàng: Nguyễn Hùng Tiến');
assert(res1.data.total_value === 8353600, 'Trích xuất đúng tổng tiền hàng: 8.353.600');
assert(res1.data.items.length === 1, 'Trích xuất đủ 1 dòng mặt hàng');
assert(res1.data.items[0].item_code === '10015745', 'Mã mặt hàng đúng: 10015745');
assert(res1.data.items[0].ordered_qty === 46, 'Số lượng đặt đúng: 46');
assert(res1.data.items[0].unit === 'Hũ', 'Đơn vị tính đúng: Hũ');
assert(res1.data.items[0].unit_price === 181600, 'Đơn giá đúng: 181.600');
assert(res1.data.items[0].total_price === 8353600, 'Thành tiền đúng: 8.353.600');
assert(res1.mathIntegrity.isSumMatch === true, 'Toàn vẹn toán học: sum(total_price) khớp chính xác tổng tiền đơn hàng');

// -------------------------------------------------------------
// NHÓM 4: ĐƠN HÀNG NHIỀU MẶT HÀNG (MULTI-ITEM PO)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Multi-item PO Parsing & Integrity ---');

const multiItemPO = `
ĐƠN ĐẶT HÀNG
Số PO: PO-998877
Ngày đặt: 10/11/2026
Ngày giao: 12/11/2026
Nhà cung cấp: CÔNG TY TNHH THỰC PHẨM SẠCH AN NHIÊN
Địa chỉ giao hàng: KHO TỔNG BÌNH TÂN

STT\tMã SP\tTên sản phẩm\tĐVT\tSố lượng\tĐơn giá\tThành tiền
1\tSP001\tBánh mì hoa cúc Pháp 500g\tGói\t100\t65.000\t6.500.000
2\tSP002\tSữa chua Hy Lạp lên men tự nhiên 200g\tHộp\t50\t32.000\t1.600.000
3\tSP003\tNho ngón tay Úc thượng hạng\tKg\t20\t240.000\t4.800.000

TỔNG CỘNG TRƯỚC THUẾ: 12.900.000
`;

const res2 = parseFastPOFromText(multiItemPO);
assert(res2.isConfident === true, 'Đơn multi-item tự động xác thực tin cậy');
assert(res2.data.items.length === 3, 'Trích xuất chính xác 3 dòng mặt hàng');
assert(res2.data.items[0].item_code === 'SP001', 'Dòng 1: mã SP001');
assert(res2.data.items[0].ordered_qty === 100, 'Dòng 1: SL 100');
assert(res2.data.items[1].item_code === 'SP002', 'Dòng 2: mã SP002');
assert(res2.data.items[1].ordered_qty === 50, 'Dòng 2: SL 50');
assert(res2.data.items[2].item_code === 'SP003', 'Dòng 3: mã SP003');
assert(res2.data.items[2].ordered_qty === 20, 'Dòng 3: SL 20');
assert(res2.data.total_value === 12900000, 'Tổng giá trị đơn hàng khớp: 12.900.000');
assert(res2.mathIntegrity.itemsTotalSum === 12900000, 'Tổng các dòng: 6.500.000 + 1.600.000 + 4.800.000 = 12.900.000');
assert(res2.mathIntegrity.lineItemsPassed === 3, 'Cả 3 dòng đều vượt qua kiểm tra toán học');

// -------------------------------------------------------------
// NHÓM 5: DÒNG MẶT HÀNG DÀI BỊ NGẮT DÒNG (WRAPPED CONTINUATION LINES)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 5: Wrapped Multiline Product Names ---');

const wrappedPO = `
Số hiệu chứng từ: PO-554433
Tên NCC: CÔNG TY XUẤT NHẬP KHẨU MAI ANH

STT\tMã hàng\tMặt hàng\tĐVT\tSố lượng\tĐơn giá\tThành tiền
1\tMA-01\tHạt dẻ cười Mỹ rang muối sấy giòn nguyên vỏ\tHũ\t10\t150.000\t1.500.000
loại thượng hạng đóng hộp thiếc 500g

TỔNG TIỀN: 1.500.000
`;

const res3 = parseFastPOFromText(wrappedPO);
assert(res3.data.items.length === 1, 'Trích xuất đúng 1 mặt hàng sau khi nối dòng');
assert(res3.data.items[0].item_name.includes('loại thượng hạng đóng hộp thiếc 500g'), 'Tên mặt hàng đã được nối hoàn chỉnh từ dòng tiếp theo');
assert(res3.data.items[0].total_price === 1500000, 'Thành tiền chính xác');

// -------------------------------------------------------------
// NHÓM 6: AN TOÀN KHI VĂN BẢN KHÔNG HỢP LỆ HOẶC ẢNH SCAN RỖNG
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 6: Scanned Image / Invalid Text Fallback ---');
const emptyRes = parseFastPOFromText('', 'scan-image.pdf');
assert(emptyRes.isConfident === false, 'Văn bản rỗng trả về isConfident = false để kích hoạt AI Vision');
assert(emptyRes.data.items.length === 0, 'Danh sách mặt hàng rỗng');

const invalidRes = parseFastPOFromText('Đây là tài liệu thông báo chung, không phải đơn mua hàng PO.');
assert(invalidRes.isConfident === false, 'Tài liệu không phải PO trả về isConfident = false');

console.log(`\n=== TẤT CẢ ${passedTests}/${totalTests} KIỂM THỬ FAST PO PARSER ĐÃ VƯỢT QUA 100%! ===`);
