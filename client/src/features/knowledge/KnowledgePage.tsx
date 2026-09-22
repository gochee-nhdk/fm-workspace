import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Button,
  Badge,
  Input,
  Modal,
  Tabs,
  Alert,
  Spinner,
  EmptyState
} from '@/components/ui';
import {
  BookOpen,
  Sparkles,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sliders
} from 'lucide-react';
import toast from 'react-hot-toast';

export const KnowledgePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'sops' | 'terminology' | 'rules'>('inspector');
  const [loading, setLoading] = useState(true);
  const [inspectData, setInspectData] = useState<any>(null);

  // Sub-items states
  const [sops, setSops] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  // Modal states
  const [newSopModal, setNewSopModal] = useState(false);
  const [sopTitle, setSopTitle] = useState('');
  const [sopContent, setSopContent] = useState('');
  const [sopScope, setSopScope] = useState('Toàn công ty');

  const [newTermModal, setNewTermModal] = useState(false);
  const [termWord, setTermWord] = useState('');
  const [termMeaning, setTermMeaning] = useState('');
  const [termStandard, setTermStandard] = useState('');

  const [newRuleModal, setNewRuleModal] = useState(false);
  const [ruleCode, setRuleCode] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleCat, setRuleCat] = useState('ordering');

  const fetchInspector = async () => {
    try {
      setLoading(true);
      const res = await api.get('/knowledge/inspect');
      if (res.data?.data) {
        setInspectData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSops = async () => {
    try {
      const res = await api.get('/knowledge');
      if (res.data?.data) setSops(res.data.data);
    } catch (err) {}
  };

  const fetchTerms = async () => {
    try {
      const res = await api.get('/knowledge/terminology');
      if (res.data?.data) setTerms(res.data.data);
    } catch (err) {}
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/knowledge/rules');
      if (res.data?.data) setRules(res.data.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchInspector();
    fetchSops();
    fetchTerms();
    fetchRules();
  }, []);

  const handleSaveSop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/knowledge', {
        title: sopTitle,
        content: sopContent,
        applicable_scope: sopScope
      });
      toast.success('Đã lưu tài liệu quy trình vào Cơ sở tri thức.');
      setNewSopModal(false);
      setSopTitle('');
      setSopContent('');
      fetchSops();
      fetchInspector();
    } catch (err: any) {
      toast.error('Lỗi khi lưu tài liệu.');
    }
  };

  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/knowledge/terminology', {
        term: termWord,
        meaning: termMeaning,
        standard_term: termStandard
      });
      toast.success('Đã lưu thuật ngữ công ty.');
      setNewTermModal(false);
      setTermWord('');
      setTermMeaning('');
      setTermStandard('');
      fetchTerms();
      fetchInspector();
    } catch (err) {
      toast.error('Lỗi khi lưu thuật ngữ.');
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/knowledge/rules', {
        rule_code: ruleCode,
        name: ruleName,
        category: ruleCat,
        description: ruleDesc
      });
      toast.success('Đã thêm quy tắc nghiệp vụ.');
      setNewRuleModal(false);
      setRuleCode('');
      setRuleName('');
      setRuleDesc('');
      fetchRules();
      fetchInspector();
    } catch (err) {
      toast.error('Lỗi khi lưu quy tắc.');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner size="lg" label="Đang kiểm tra mức độ hiểu biết của AI..." />
      </div>
    );
  }

  const stats = inspectData?.stats || {};
  const missing = inspectData?.missing || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Cơ sở Tri thức & AI Inspector</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Quản lý SOP, Thuật ngữ nội bộ và kiểm tra chính xác AI hiện đang nắm giữ những dữ liệu gì
          </p>
        </div>

        <Button
          variant="glass"
          size="sm"
          onClick={() => {
            fetchInspector();
            fetchSops();
            fetchTerms();
            fetchRules();
          }}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Làm mới
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'inspector', label: 'AI Inspector ("AI đang biết gì?")' },
          { id: 'sops', label: 'SOP & Quy trình', badge: sops.length },
          { id: 'terminology', label: 'Thuật ngữ Nội bộ', badge: terms.length },
          { id: 'rules', label: 'Quy tắc Nghiệp vụ', badge: rules.length }
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* TAB 1: AI KNOWLEDGE INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="space-y-6">
          {/* Readiness Banner */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Mức độ sẵn sàng phân tích của AI
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trạng thái hiện tại: <span className="font-semibold text-teal-600 uppercase">{inspectData?.systemState || 'EMPTY'}</span>
                </p>
              </div>
            </div>

            <Badge
              variant={inspectData?.systemState === 'READY' ? 'success' : 'warning'}
              size="md"
              dot
            >
              {inspectData?.systemState === 'READY' ? 'Sẵn sàng phân tích đầy đủ' : 'Cần bổ sung dữ liệu'}
            </Badge>
          </div>

          {/* Counts Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="glass-material p-4 rounded-[18px] text-center">
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] font-medium">Sản phẩm (SKU)</p>
              <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">
                {stats.productCount || 0}
              </p>
            </div>

            <div className="glass-material p-4 rounded-[18px] text-center">
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] font-medium">Điểm bán / Kho</p>
              <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">
                {stats.storeCount || 0}
              </p>
            </div>

            <div className="glass-material p-4 rounded-[18px] text-center">
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] font-medium">Dòng tồn kho</p>
              <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">
                {stats.inventoryCount || 0}
              </p>
            </div>

            <div className="glass-material p-4 rounded-[18px] text-center">
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] font-medium">Giao dịch bán hàng</p>
              <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">
                {stats.salesCount || 0}
              </p>
            </div>

            <div className="glass-material p-4 rounded-[18px] text-center">
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] font-medium">Thuật ngữ công ty</p>
              <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">
                {stats.termCount || 0}
              </p>
            </div>

            <div className="glass-material p-4 rounded-[18px] text-center">
              <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] font-medium">Quy tắc nghiệp vụ</p>
              <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">
                {stats.ruleCount || 0}
              </p>
            </div>
          </div>

          {/* Missing Checklist */}
          <div className="glass-material rounded-[22px] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>Các thông tin hệ thống AI đang cần bạn nạp thêm</span>
              </h3>
            </div>
            <div className="p-5">
              {missing.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#76767b] dark:text-[#a1a1a6]">
                    Để đạt được khuyến nghị thu mua chính xác cao nhất (không có giả định), hệ thống cần các nguồn dữ liệu sau:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    {missing.map((item: string) => (
                      <div
                        key={item}
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 text-amber-800 dark:text-amber-300 text-xs font-medium"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Chưa có: {item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tuyệt vời! Tất cả các thông tin cơ bản về chuỗi cung ứng đều đã được nạp đầy đủ.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOPS & DOCUMENTS */}
      {activeTab === 'sops' && (
        <div className="glass-material rounded-[22px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Quy trình & Hướng dẫn Công việc (SOP)</h3>
            <Button
              variant="glassProminent"
              size="sm"
              onClick={() => setNewSopModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Thêm tài liệu SOP
            </Button>
          </div>
          <div className="p-5">
            {sops.length > 0 ? (
              <div className="space-y-3">
                {sops.map((sop) => (
                  <div
                    key={sop.id}
                    className="glass-material-interactive rounded-[18px] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                          {sop.title}
                        </h4>
                      </div>
                      <Badge variant="default" size="sm">
                        Phiên bản {sop.version}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed whitespace-pre-wrap">
                      {sop.content}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#76767b] dark:text-[#a1a1a6] pt-1 border-t border-white/10">
                      <span>Phạm vi: {sop.applicable_scope}</span>
                      <span>Cập nhật: {new Date(sop.updated_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có tài liệu quy trình"
                description="Thêm quy trình thu mua hoặc SOP của công ty để AI nắm rõ các quy định nội bộ."
                actionLabel="Thêm SOP đầu tiên"
                onAction={() => setNewSopModal(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TERMINOLOGY */}
      {activeTab === 'terminology' && (
        <div className="glass-material rounded-[22px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Thuật ngữ & Tiếng lóng Nội bộ (Company Terminology)</h3>
              <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
                Giúp AI hiểu chính xác các từ viết tắt hoặc cách gọi quen thuộc của công ty bạn
              </p>
            </div>
            <Button
              variant="glassProminent"
              size="sm"
              onClick={() => setNewTermModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Thêm thuật ngữ
            </Button>
          </div>
          <div className="p-2">
            {terms.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/20 dark:bg-white/5 border-b border-white/10 text-[11px] text-[#76767b] uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Từ viết tắt / Thuật ngữ</th>
                      <th className="px-4 py-2.5">Ý nghĩa nội bộ</th>
                      <th className="px-4 py-2.5">Khái niệm chuẩn tương đương</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 dark:divide-white/5">
                    {terms.map((t) => (
                      <tr key={t.id} className="hover:bg-white/10">
                        <td className="px-4 py-3 font-semibold text-teal-700 dark:text-teal-400">
                          {t.term}
                        </td>
                        <td className="px-4 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
                          {t.meaning}
                        </td>
                        <td className="px-4 py-3 text-[#76767b] dark:text-[#a1a1a6]">{t.standard_term || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Chưa có thuật ngữ nội bộ"
                description="Ví dụ: 'Hàng xả' nghĩa là 'Clearance stock', 'Date ngắn' nghĩa là 'Near-expiry <= 3 ngày'."
                actionLabel="Thêm thuật ngữ"
                onAction={() => setNewTermModal(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BUSINESS RULES */}
      {activeTab === 'rules' && (
        <div className="glass-material rounded-[22px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Quy tắc Nghiệp vụ Thu mua (Business Rules)</h3>
              <p className="text-xs text-[#76767b] dark:text-[#a1a1a6] mt-0.5">
                Các quy định về đặt hàng, MOQ, Lead Time mà AI phải tuân thủ nghiêm ngặt
              </p>
            </div>
            <Button
              variant="glassProminent"
              size="sm"
              onClick={() => setNewRuleModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Thêm quy tắc
            </Button>
          </div>
          <div className="p-5">
            {rules.length > 0 ? (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="glass-material-interactive rounded-[18px] p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="purple" size="sm">
                          {rule.rule_code}
                        </Badge>
                        <h4 className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                          {rule.name}
                        </h4>
                      </div>
                      <Badge variant="success" size="sm">
                        Đang áp dụng
                      </Badge>
                    </div>
                    <p className="text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {rule.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có quy tắc đặt hàng riêng"
                description="Thêm các ràng buộc như 'Không đặt hàng nếu DoC > 15 ngày' hoặc 'MOQ tối thiểu 1 thùng'."
                actionLabel="Thêm quy tắc"
                onAction={() => setNewRuleModal(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal: New SOP */}
      <Modal
        isOpen={newSopModal}
        onClose={() => setNewSopModal(false)}
        title="Thêm Quy trình / Hướng dẫn Nghiệp vụ"
        size="lg"
      >
        <form onSubmit={handleSaveSop} className="space-y-4">
          <Input
            label="Tiêu đề quy trình"
            value={sopTitle}
            onChange={(e) => setSopTitle(e.target.value)}
            placeholder="Ví dụ: Quy định duyệt đơn đặt hàng rau củ quả tươi"
            required
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nội dung quy trình (Chi tiết các bước thực hiện)
            </label>
            <textarea
              rows={6}
              value={sopContent}
              onChange={(e) => setSopContent(e.target.value)}
              placeholder="Ghi rõ các nguyên tắc, tiêu chí duyệt, thời hạn giao hàng và trách nhiệm..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 focus:ring-teal-500"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="glass" size="sm" type="button" onClick={() => setNewSopModal(false)}>
              Hủy
            </Button>
            <Button variant="glassProminent" size="sm" type="submit">
              Lưu vào cơ sở tri thức
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Term */}
      <Modal
        isOpen={newTermModal}
        onClose={() => setNewTermModal(false)}
        title="Thêm Thuật ngữ Nội bộ"
        size="md"
      >
        <form onSubmit={handleSaveTerm} className="space-y-4">
          <Input
            label="Từ viết tắt / Thuật ngữ dùng trong nội bộ"
            value={termWord}
            onChange={(e) => setTermWord(e.target.value)}
            placeholder="Ví dụ: Hàng xả date"
            required
          />
          <Input
            label="Ý nghĩa chính xác tại công ty"
            value={termMeaning}
            onChange={(e) => setTermMeaning(e.target.value)}
            placeholder="Ví dụ: Hàng còn dưới 5 ngày sử dụng, giảm giá 30% để thanh lý"
            required
          />
          <Input
            label="Thuật ngữ chuỗi cung ứng chuẩn (nếu có)"
            value={termStandard}
            onChange={(e) => setTermStandard(e.target.value)}
            placeholder="Ví dụ: Clearance / Mark-down"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="glass" size="sm" type="button" onClick={() => setNewTermModal(false)}>
              Hủy
            </Button>
            <Button variant="glassProminent" size="sm" type="submit">
              Lưu thuật ngữ
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Rule */}
      <Modal
        isOpen={newRuleModal}
        onClose={() => setNewRuleModal(false)}
        title="Thêm Quy tắc Nghiệp vụ"
        size="md"
      >
        <form onSubmit={handleSaveRule} className="space-y-4">
          <Input
            label="Mã quy tắc"
            value={ruleCode}
            onChange={(e) => setRuleCode(e.target.value)}
            placeholder="Ví dụ: RULE-MOQ-VEG"
            required
          />
          <Input
            label="Tên quy tắc"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Ví dụ: Số lượng đặt tối thiểu nhóm rau sạch"
            required
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1d1d1f] dark:text-white">
              Mô tả chi tiết quy tắc
            </label>
            <textarea
              rows={4}
              value={ruleDesc}
              onChange={(e) => setRuleDesc(e.target.value)}
              placeholder="Ví dụ: Khi đặt hàng các mặt hàng rau sạch Đà Lạt, số lượng đặt phải làm tròn lên bội số của 5kg..."
              className="w-full text-xs rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-3 focus:ring-teal-500 text-[#1d1d1f] dark:text-white"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="glass" size="sm" type="button" onClick={() => setNewRuleModal(false)}>
              Hủy
            </Button>
            <Button variant="glassProminent" size="sm" type="submit">
              Lưu quy tắc
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

