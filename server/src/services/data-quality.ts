export interface QualityIssue {
  rowNumber?: number;
  field: string;
  issueType: 'missing' | 'duplicate' | 'invalid_date' | 'negative_value' | 'format_error';
  severity: 'critical' | 'warning';
  message: string;
  rawValue?: any;
}

export interface QualityReport {
  totalRows: number;
  validRows: number;
  warningCount: number;
  criticalCount: number;
  qualityScore: number; // 0 to 100
  isReliable: boolean;
  issues: QualityIssue[];
  summary: {
    missingSkuCount: number;
    duplicateCount: number;
    negativeValueCount: number;
    invalidDateCount: number;
  };
}

export class DataQualityService {
  /**
   * Validate raw mapped rows according to procurement data standards
   */
  static evaluate(rows: Record<string, any>[], entityType: string): QualityReport {
    const issues: QualityIssue[] = [];
    let missingSkuCount = 0;
    let duplicateCount = 0;
    let negativeValueCount = 0;
    let invalidDateCount = 0;

    const seenKeys = new Set<string>();

    const invalidRowIndices = new Set<number>();

    rows.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1

      // 1. Check SKU Code
      const sku = row.sku_code || row.sku || row.barcode;
      if (!sku && ['inventory', 'sales', 'products', 'expiry'].includes(entityType)) {
        issues.push({
          rowNumber: rowNum,
          field: 'sku_code',
          issueType: 'missing',
          severity: 'critical',
          message: `Dòng ${rowNum}: Thiếu mã SKU/Sản phẩm bắt buộc.`
        });
        missingSkuCount++;
        invalidRowIndices.add(index);
      }

      // 2. Check Duplicates (Store + SKU or SKU alone)
      const store = row.store_code || row.store_id || 'DEFAULT';
      if (sku) {
        const uniqueKey = `${store}_${sku}_${row.date || ''}`;
        if (seenKeys.has(uniqueKey)) {
          issues.push({
            rowNumber: rowNum,
            field: 'duplicate',
            issueType: 'duplicate',
            severity: 'warning',
            message: `Dòng ${rowNum}: Dữ liệu trùng lặp cho SKU "${sku}" tại điểm bán "${store}".`
          });
          duplicateCount++;
        } else {
          seenKeys.add(uniqueKey);
        }
      }

      // 3. Check Numeric Values (Inventory, Sales, Price)
      const qtyFields = ['inventory_qty', 'sales_qty', 'quantity', 'unit_price'];
      for (const f of qtyFields) {
        if (row[f] !== undefined && row[f] !== null && row[f] !== '') {
          const num = Number(row[f]);
          if (!Number.isFinite(num)) {
            issues.push({
              rowNumber: rowNum,
              field: f,
              issueType: 'format_error',
              severity: 'critical',
              message: `Dòng ${rowNum}: Giá trị "${row[f]}" trong cột ${f} không phải là số hợp lệ.`,
              rawValue: row[f]
            });
            invalidRowIndices.add(index);
          } else if (num < 0) {
            issues.push({
              rowNumber: rowNum,
              field: f,
              issueType: 'negative_value',
              severity: 'critical',
              message: `Dòng ${rowNum}: Số lượng hoặc giá trị ${f} mang giá trị âm (${num}) bất hợp lệ.`,
              rawValue: num
            });
            negativeValueCount++;
            invalidRowIndices.add(index);
          }
        }
      }

      // 4. Check Date Values
      const dateFields = ['date', 'expiry_date', 'sale_date'];
      for (const df of dateFields) {
        if (row[df]) {
          const parsedDate = Date.parse(String(row[df]));
          if (isNaN(parsedDate)) {
            issues.push({
              rowNumber: rowNum,
              field: df,
              issueType: 'invalid_date',
              severity: 'warning',
              message: `Dòng ${rowNum}: Định dạng ngày "${row[df]}" không hợp lệ hoặc không xác định được.`,
              rawValue: row[df]
            });
            invalidDateCount++;
          }
        }
      }
    });

    const totalRows = rows.length;
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    // Quality score formula: 100 - (critical * 5 + warning * 1) / totalRows * 100
    const deductions = totalRows > 0 ? ((criticalCount * 5 + warningCount * 1) / totalRows) * 100 : 0;
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - deductions)));
    const validRows = Math.max(0, totalRows - invalidRowIndices.size);

    return {
      totalRows,
      validRows,
      warningCount,
      criticalCount,
      qualityScore,
      isReliable: criticalCount === 0 && qualityScore >= 80,
      issues: issues.slice(0, 100), // return top 100 issues for UI preview
      summary: {
        missingSkuCount,
        duplicateCount,
        negativeValueCount,
        invalidDateCount
      }
    };
  }
}
