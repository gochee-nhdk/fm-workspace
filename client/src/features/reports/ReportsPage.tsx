import React, { useState } from 'react';
import { api } from '@/lib/api';
import {
  Button,
  Badge,
  Spinner,
  EmptyState
} from '@/components/ui';
import { FileText, Download, Play, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<string>('daily_procurement');
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any | null>(null);

  const reportOptions = [
    {
      id: 'daily_procurement',
      name: 'Báo cáo Tổng hợp Thu mua Hàng ngày',
      desc: 'Tổng hợp danh mục, tồn kho và nhu cầu bổ sung hàng ngày'
    },
    {
      id: 'inventory',
      name: 'Báo cáo Định giá Tồn kho Toàn chuỗi',
      desc: 'Chi tiết số lượng tồn khả dụng, đơn giá vốn và tổng giá trị tồn kho'
    },
    {
      id: 'near_expiry',
      name: 'Báo cáo Kiểm soát Hàng Cận Date',
      desc: 'Danh sách các lô hàng approaching expiry date, số ngày còn lại và điểm bán'
    },
    {
      id: 'procurement_recommendations',
      name: 'Báo cáo Khuyến nghị Đặt hàng AI',
      desc: 'Tất cả các dòng đề xuất đặt hàng kèm lý do và mức độ rủi ro'
    }
  ];

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const res = await api.post('/reports/generate', { type: reportType });
      if (res.data?.data) {
        setReportResult(res.data.data);
        toast.success('Đã tạo báo cáo thành công.');
      }
    } catch (err: any) {
      toast.error('Lỗi khi tạo báo cáo.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.get(`/reports/export/excel?type=${reportType}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `farmers_market_${reportType}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải xuống tệp Excel thành công.');
    } catch {
      toast.error('Không thể xuất tệp Excel.');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get(`/reports/export/csv?type=${reportType}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `farmers_market_${reportType}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải xuống tệp CSV thành công.');
    } catch {
      toast.error('Không thể xuất tệp CSV.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-600" />
            <span>Trung tâm Báo cáo Thu mua (Report Builder)</span>
          </h2>
          <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
            Tạo và xuất báo cáo vận hành thu mua, định giá tồn kho và hàng cận hạn ra định dạng Excel / CSV
          </p>
        </div>

        {reportResult && (
          <div className="glass-container p-1.5 rounded-[16px] flex items-center gap-1.5">
            <Button
              variant="glass"
              size="sm"
              onClick={handleExportCsv}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Xuất CSV
            </Button>
            <Button
              variant="glassProminent"
              size="sm"
              onClick={handleExportExcel}
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              Xuất Excel (.xlsx)
            </Button>
          </div>
        )}
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {reportOptions.map((opt) => {
          const isSelected = opt.id === reportType;
          return (
            <div
              key={opt.id}
              onClick={() => {
                setReportType(opt.id);
                setReportResult(null);
              }}
              className={`glass-material-interactive rounded-[20px] p-4 cursor-pointer select-none space-y-1.5 transition-all ${
                isSelected
                  ? 'ring-2 ring-teal-500/50'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <FileText className={`w-4 h-4 ${isSelected ? 'text-teal-600' : 'text-[#76767b]'}`} />
                {isSelected && <Badge variant="success" size="sm">Đang chọn</Badge>}
              </div>
              <h4 className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                {opt.name}
              </h4>
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] leading-relaxed">
                {opt.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex justify-start">
        <div className="glass-container p-1.5 rounded-[16px]">
          <Button
            variant="glassProminent"
            size="md"
            onClick={handleGenerate}
            loading={loading}
            icon={<Play className="w-4 h-4" />}
          >
            Tạo và xem trước báo cáo
          </Button>
        </div>
      </div>

      {/* Report Preview */}
      {reportResult && (
        <div className="glass-material rounded-[22px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">{reportResult.title}</h3>
              <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
                Thời gian tạo: {new Date(reportResult.generatedAt).toLocaleString('vi-VN')} • {reportResult.rows?.length || 0} dòng
              </p>
            </div>

            <div className="glass-container p-1 flex items-center gap-1.5">
              <Button
                variant="glass"
                size="sm"
                onClick={handleExportCsv}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                CSV
              </Button>
              <Button
                variant="glassProminent"
                size="sm"
                onClick={handleExportExcel}
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              >
                Tải tệp Excel
              </Button>
            </div>
          </div>
          <div className="p-4">
            {reportResult.rows?.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-white/20 dark:border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/30 dark:bg-white/5 border-b border-white/20 dark:border-white/10 text-[11px] text-[#76767b] uppercase font-semibold">
                    <tr>
                      {reportResult.headers.map((h: string) => (
                        <th key={h} className="px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 dark:divide-white/5">
                    {reportResult.rows.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-white/10 dark:hover:bg-white/5">
                        {reportResult.keys.map((k: string) => (
                          <td key={k} className="px-4 py-2.5 whitespace-nowrap text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {typeof row[k] === 'number' ? row[k].toLocaleString() : row[k] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Báo cáo không có dòng dữ liệu nào"
                description="Hãy chắc chắn bạn đã nạp dữ liệu tồn kho hoặc đơn hàng vào hệ thống."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

