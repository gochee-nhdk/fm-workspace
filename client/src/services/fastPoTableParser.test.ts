import {
  parseSmartNumber,
  cleanVietnameseNumber,
  cleanVietnameseDate,
  extractMetadataFromFileName,
  isPurchaseReturnDocument,
  parseFastPOFromText,
} from '../utils/fastPoTableParser';

console.log('=== BẮT ĐẦU KIỂM THỬ HIGH-PRECISION FAST PO TABLE PARSER (AC-02 & BUG-017) ===\n');

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
// NHÓM 1: CHUẨN HÓA SỐ TIỀN VÀ NGÀY THÁNG (SMART NUMBER PARSER)
// -------------------------------------------------------------
console.log('--- TEST GROUP 1: Vietnamese & US Smart Number Parser ---');
assert(parseSmartNumber('109,00') === 109, 'Số thập phân dấu phẩy VN: 109,00 -> 109');
assert(parseSmartNumber('7.700,00') === 7700, 'Số nghìn chấm, thập phân phẩy VN: 7.700,00 -> 7700');
assert(parseSmartNumber('839.300,00') === 839300, 'Số trăm nghìn VN: 839.300,00 -> 839300');
assert(parseSmartNumber('181.600,00') === 181600, 'Số tiền 181.600,00 -> 181600');
assert(parseSmartNumber('8.353.600,00') === 8353600, 'Số tiền triệu: 8.353.600,00 -> 8353600');
assert(parseSmartNumber('16.00') === 16, 'Số thập phân chấm chuẩn Anh-Mỹ: 16.00 -> 16');
assert(parseSmartNumber('58,056.00') === 58056, 'Số nghìn phẩy, thập phân chấm Anh-Mỹ: 58,056.00 -> 58056');
assert(parseSmartNumber('928,896.00') === 928896, 'Số tiền 928,896.00 -> 928896');
assert(parseSmartNumber('928.896') === 928896, 'Số tiền 928.896 -> 928896');
assert(parseSmartNumber('1.003.208') === 1003208, 'Số tiền tổng cộng 1.003.208 -> 1003208');
assert(parseSmartNumber('4.475.300') === 4475300, 'Số tiền 4.475.300 -> 4475300');
assert(parseSmartNumber('358.024') === 358024, 'Số tiền VAT 358.024 -> 358024');
assert(parseSmartNumber('4.833.324') === 4833324, 'Số tiền tổng cộng 4.833.324 -> 4833324');
assert(cleanVietnameseNumber('46,00') === 46, 'Alias cleanVietnameseNumber 46,00 -> 46');
assert(cleanVietnameseNumber('225') === 225, 'Alias cleanVietnameseNumber 225 -> 225');

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
// NHÓM 3: SỬA BUG-017 — PHÁT HIỆN CHỨNG TỪ TRẢ HÀNG
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 3: BUG-017 Purchase Return Document Detection ---');
assert(isPurchaseReturnDocument('PHIẾU XUẤT TRẢ HÀNG CHO NCC') === true, 'Phát hiện PHIẾU XUẤT TRẢ HÀNG');
assert(isPurchaseReturnDocument('Purchase Return Note PR-2026-001') === true, 'Phát hiện Purchase Return');
assert(isPurchaseReturnDocument('ĐƠN MUA HÀNG PO-118292') === false, 'Đơn mua hàng PO không phải là return');

const returnDocSample = `
CÔNG TY TNHH THƯƠNG MẠI LARIA
PHIẾU XUẤT TRẢ NHÀ CUNG CẤP
Số hiệu chứng từ: PR-009988
Ngày chứng từ: 05/11/2026
Tên NCC: CÔNG TY CỔ PHẦN DEVIE
Lý do xuất trả: Hàng cận hạn sử dụng
STT\tMã hàng\tMặt hàng\tSố lượng\tĐVT\tĐơn giá\tThành tiền
1\t10015745\tHạt dinh dưỡng Mix 400g\t10\tHũ\t180.000\t1.800.000
TỔNG TIỀN: 1.800.000
`;
const returnRes = parseFastPOFromText(returnDocSample);
assert(returnRes.data.isPurchaseReturn === true, 'BUG-017: Nhận diện đúng isPurchaseReturn = true');
assert(returnRes.data.documentType === 'PURCHASE_RETURN', 'BUG-017: documentType là PURCHASE_RETURN');
assert(typeof returnRes.data.warningMessage === 'string' && returnRes.data.warningMessage.includes('Phiếu Xuất Trả'), 'BUG-017: Có thông điệp cảnh báo người dùng');

// -------------------------------------------------------------
// NHÓM 4: NGHIỆM THU AC-02 — ĐƠN HÀNG PO-118263 (NỐI DÒNG VÀ VAT 8%)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 4: AC-02 Acceptance PO-118263 (Continuation line & Financial Engine) ---');

const po118263Text = `
CÔNG TY TNHH THƯƠNG MẠI LARIA
HỆ THỐNG SIÊU THỊ FARMERS MARKET
ĐƠN MUA HÀNG
Số hiệu chứng từ: PO-118263
Ngày chứng từ: 02/11/2026
Ngày giao hàng: 05/11/2026
Tên NCC: CÔNG TY CỔ PHẦN DEVIE    Mã NCC: V0001613
Chi nhánh yêu cầu: DC01 - Nơ Trang Long, 204 Nơ Trang Long, Phường Bình Thạnh, TP.HCM
Người đặt hàng: Nguyễn Hùng Tiến

STT\tInternal Code\tBarcode\tMặt hàng\tSố lượng\tĐVT\tĐơn giá chưa VAT\tThành tiền chưa VAT
1\t10015799\t8936034090999\tSữa tươi thanh trùng nguyên chất tiệt trùng đặc biệt dòng cao cấp trang trại Đà Lạt
đóng chai thủy tinh hữu cơ 900ml\t16.00\tChai\t58,056.00\t928,896.00

TỔNG CỘNG TRƯỚC THUẾ VAT: 928.896
THUẾ VAT (8%): 74.312
TỔNG CỘNG THANH TOÁN: 1.003.208
`;

const res118263 = parseFastPOFromText(po118263Text, 'PO-118263_DEVIE.pdf');

assert(res118263.isConfident === true, 'PO-118263 đạt trạng thái tin cậy');
assert(res118263.data.po_number === 'PO-118263', 'PO-118263: Mã đơn hàng đúng PO-118263');
assert(res118263.data.supplier_name === 'CÔNG TY CỔ PHẦN DEVIE', 'PO-118263: Tách đúng tên NCC khi chung dòng với Mã NCC');
assert(res118263.data.supplier_code === 'V0001613', 'PO-118263: Tách đúng mã NCC V0001613');
assert(res118263.data.po_date === '2026-11-02', 'PO-118263: Ngày chứng từ 2026-11-02');
assert(res118263.data.expected_delivery_date === '2026-11-05', 'PO-118263: Ngày giao hàng 2026-11-05');
assert(res118263.data.warehouse?.includes('DC01'), 'PO-118263: Ưu tiên bóc đúng Chi nhánh yêu cầu DC01');
assert(res118263.data.items.length === 1, 'PO-118263: Trích xuất đủ 1 dòng mặt hàng sau khi nối dòng');
assert(res118263.data.items[0].item_code === '10015799', 'PO-118263: Điểm neo Internal Code 10015799');
assert(res118263.data.items[0].barcode === '8936034090999', 'PO-118263: Điểm neo Barcode 13 số 8936034090999');
assert(res118263.data.items[0].item_name.includes('đóng chai thủy tinh hữu cơ 900ml'), 'PO-118263: Tên sản phẩm nối dòng hoàn chỉnh 2 dòng');
assert(res118263.data.items[0].ordered_qty === 16, 'PO-118263: Số lượng đặt 16.00 -> 16');
assert(res118263.data.items[0].unit_price === 58056, 'PO-118263: Đơn giá 58,056.00 -> 58056');
assert(res118263.data.items[0].total_price === 928896, 'PO-118263: Thành tiền dòng 928,896.00 -> 928896');
assert(res118263.data.items[0].lineVatAmount === 74312, 'PO-118263: Tiền thuế VAT 8% dòng hàng = Math.round(928896 * 8 / 100) = 74,312');

// Kiểm tra nghiệm thu AC-02 con số tài chính chính xác tuyệt đối:
assert(res118263.data.subTotalPreVat === 928896, 'AC-02: PO-118263 subTotalPreVat = 928,896 đ');
assert(res118263.data.totalVat === 74312, 'AC-02: PO-118263 totalVat = 74,312 đ (VAT 8%)');
assert(res118263.data.grandTotal === 1003208, 'AC-02: PO-118263 grandTotal = 1,003,208 đ');

// -------------------------------------------------------------
// NHÓM 5: NGHIỆM THU AC-02 — ĐƠN HÀNG PO-118873 (7 MẶT HÀNG, ĐVT TÚI, VAT 8%)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 5: AC-02 Acceptance PO-118873 (7 Items, UOM Túi, Financial Engine) ---');

const po118873Text = `
CÔNG TY TNHH THƯƠNG MẠI LARIA
HỆ THỐNG SIÊU THỊ FARMERS MARKET
ĐƠN MUA HÀNG
Số hiệu chứng từ: PO-118873
Ngày chứng từ: 02/11/2026
Ngày giao hàng: 05/11/2026
Tên NCC: CÔNG TY TNHH BẢO MINH    Mã NCC: V0001834
Chi nhánh yêu cầu: DC01 - Nơ Trang Long, 204 Nơ Trang Long, Phường Bình Thạnh, TP.HCM
Người đặt hàng: Hoàng Kim Dung

STT\tInternal Code\tBarcode\tMặt hàng\tSố lượng\tĐVT\tĐơn giá chưa VAT\tThành tiền chưa VAT
1\t10023401\t8935001234011\tBánh sandwich ngũ cốc tươi\t109,00\tTúi\t7.700,00\t839.300,00
2\t10023402\t8935001234028\tBánh mì bơ sữa mềm thơm\t40,00\tGói\t15.000,00\t600.000,00
3\t10023403\t8935001234035\tBánh bông lan trứng muối phô mai\t50,00\tHộp\t16.000,00\t800.000,00
4\t10023404\t8935001234042\tSữa chua uống men vi sinh hoa quả\t35,00\tChai\t20.000,00\t700.000,00
5\t10023405\t8935001234059\tMứt dâu tây rừng thượng hạng\t30,00\tHũ\t25.000,00\t750.000,00
6\t10023406\t8935001234066\tBánh quy yến mạch hạt chia dinh dưỡng\t20,00\tTúi\t19.300,00\t386.000,00
7\t10023407\t8935001234073\tBánh quy hạt điều bơ sữa\t20,00\tTúi\t20.000,00\t400.000,00

TỔNG CỘNG TRƯỚC THUẾ: 4.475.300
THUẾ VAT (8%): 358.024
TỔNG CỘNG THANH TOÁN: 4.833.324
`;

const res118873 = parseFastPOFromText(po118873Text, '118873_BẢO MINH_DC01.pdf');

assert(res118873.isConfident === true, 'PO-118873 đạt trạng thái tin cậy');
assert(res118873.data.po_number === 'PO-118873', 'PO-118873: Mã đơn hàng đúng PO-118873');
assert(res118873.data.supplier_name === 'CÔNG TY TNHH BẢO MINH', 'PO-118873: Tách đúng NCC BẢO MINH');
assert(res118873.data.supplier_code === 'V0001834', 'PO-118873: Tách đúng mã NCC V0001834');
assert(res118873.data.items.length === 7, 'AC-02: PO-118873 trích xuất ĐỦ ĐÚNG 7 MẶT HÀNG');

// Kiểm tra mặt hàng 1 có ĐVT Túi và các số liệu từ mô tả bài toán:
const item1 = res118873.data.items[0];
assert(item1.item_code === '10023401', 'PO-118873 Item 1: Internal Code 10023401');
assert(item1.barcode === '8935001234011', 'PO-118873 Item 1: Barcode 8935001234011');
assert(item1.ordered_qty === 109, 'PO-118873 Item 1: Qty 109,00 -> 109');
assert(item1.unit === 'Túi', 'PO-118873 Item 1: Nhận diện chính xác ĐVT Túi');
assert(item1.unit_price === 7700, 'PO-118873 Item 1: Unit price 7.700,00 -> 7700');
assert(item1.total_price === 839300, 'PO-118873 Item 1: Total price 839.300,00 -> 839300');

// Kiểm tra các mặt hàng khác có ĐVT Túi:
const item6 = res118873.data.items[5];
assert(item6.unit === 'Túi', 'PO-118873 Item 6: ĐVT Túi');
const item7 = res118873.data.items[6];
assert(item7.unit === 'Túi', 'PO-118873 Item 7: ĐVT Túi');

// Kiểm tra nghiệm thu AC-02 con số tài chính chính xác tuyệt đối:
assert(res118873.data.subTotalPreVat === 4475300, 'AC-02: PO-118873 trước VAT = 4,475,300 đ');
assert(res118873.data.totalVat === 358024, 'AC-02: PO-118873 VAT 8% = 358,024 đ');
assert(res118873.data.grandTotal === 4833324, 'AC-02: PO-118873 tổng cộng = 4,833,324 đ');

// -------------------------------------------------------------
// NHÓM 6: ĐƠN HÀNG DEVIE TRUYỀN THỐNG (PO-118292)
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 6: Classic PO-118292 Regression Test ---');

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
assert(res1.isConfident === true, 'PO-118292 đạt trạng thái tin cậy');
assert(res1.data.po_number === 'PO-118292', 'PO-118292: Số PO đúng');
assert(res1.data.supplier_name === 'CÔNG TY CỔ PHẦN DEVIE', 'PO-118292: Tên NCC đúng');
assert(res1.data.items[0].ordered_qty === 46, 'PO-118292: Số lượng 46');
assert(res1.data.items[0].unit_price === 181600, 'PO-118292: Đơn giá 181600');
assert(res1.data.items[0].total_price === 8353600, 'PO-118292: Thành tiền 8353600');
assert(res1.data.items[0].barcode === '8936034090123', 'PO-118292: Điểm neo Barcode 8936034090123');

// -------------------------------------------------------------
// NHÓM 7: VĂN BẢN RỖNG VÀ TÀI LIỆU KHÔNG PHẢI PO
// -------------------------------------------------------------
console.log('\n--- TEST GROUP 7: Edge cases & Fallbacks ---');
const emptyRes = parseFastPOFromText('', 'scan-image.pdf');
assert(emptyRes.isConfident === false, 'Văn bản rỗng trả về isConfident = false');
assert(emptyRes.data.items.length === 0, 'Danh sách mặt hàng rỗng khi văn bản rỗng');

const invalidRes = parseFastPOFromText('Đây là tài liệu thông báo chung nội bộ, không phải đơn mua hàng.');
assert(invalidRes.isConfident === false, 'Tài liệu không phải PO trả về isConfident = false');

console.log(`\n=== TẤT CẢ ${passedTests}/${totalTests} KIỂM THỬ ĐÃ VƯỢT QUA XUẤT SẮC 100%! ===`);
