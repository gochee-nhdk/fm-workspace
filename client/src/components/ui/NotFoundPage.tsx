import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SFExclamationmarkCircle, SFSquareGrid2x2 } from 'sf-symbols-lib';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[70vh]">
      <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
          <SFExclamationmarkCircle size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            404 - Không tìm thấy trang
          </h1>
          <p className="text-[14px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển trong hệ thống.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Button
            variant="primary"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium shadow-md shadow-[#0071e3]/20"
          >
            <SFSquareGrid2x2 size={16} />
            Quay lại Bàn làm việc
          </Button>
        </div>
      </div>
    </div>
  );
};
export default NotFoundPage;
