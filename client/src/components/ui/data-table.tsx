import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { SFChevronLeft, SFChevronRight, SFBackwardEnd, SFForwardEnd, SFArrowUpArrowDown, SFArrowUpDocument, SFCheckmark, SFTrash } from 'sf-symbols-lib';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Spinner } from './loading';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onExport?: () => void;
  exportLabel?: string;
  className?: string;
  pageSize?: number;
  enableRowSelection?: boolean;
  batchActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode;
  onBatchDelete?: (selectedRows: TData[], clearSelection: () => void) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  emptyTitle = 'Không có dữ liệu',
  emptyDescription = 'Không tìm thấy dữ liệu nào thỏa mãn điều kiện lọc.',
  onExport,
  exportLabel = 'Xuất dữ liệu',
  className,
  pageSize = 15,
  enableRowSelection = false,
  batchActions,
  onBatchDelete,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    initialState: {
      pagination: {
        pageSize
      }
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedRowCount = Object.keys(rowSelection).length;
  const clearSelection = () => setRowSelection({});

  return (
    <div className={cn('space-y-3.5', className)}>
      {onExport && (
        <div className="flex justify-end">
          <Button
            variant="glass"
            size="sm"
            onClick={onExport}
            className="active:scale-[0.96] transition-transform duration-120 touch-manipulation"
            icon={<SFArrowUpDocument size={14} className="text-[#0066cc] dark:text-[#2997ff]" />}
          >
            {exportLabel}
          </Button>
        </div>
      )}

      <div className="rounded-[20px] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#141418]/70 backdrop-blur-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
            <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] select-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-5 py-3.5 whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-[#1d1d1f] dark:hover:text-white active:scale-95 transition-all duration-120'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <SFArrowUpArrowDown size={12} className="text-[#76767b] opacity-60" />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <Spinner size="md" label="Đang tải dữ liệu..." />
                  </td>
                </tr>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'transition-all duration-200 ease-spring relative group',
                      'hover:bg-[#f8f9fc]/85 dark:hover:bg-white/[0.05]',
                      'hover:shadow-[0_4px_16px_rgba(0,102,204,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.35)]',
                      row.getIsSelected() && 'bg-[#0066cc]/[0.06] dark:bg-[#2997ff]/[0.08]'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="py-12">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {table.getPageCount() > 1 && (
          <div className="px-5 py-3.5 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#76767b] dark:text-[#a1a1a6]">
            <div>
              Trang <span className="font-semibold text-[#1d1d1f] dark:text-white">{table.getState().pagination.pageIndex + 1}</span> / <span className="font-semibold text-[#1d1d1f] dark:text-white">{table.getPageCount()}</span> ({data.length} mục)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-90 touch-manipulation"
                title="Trang đầu"
              >
                <SFBackwardEnd size={14} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-90 touch-manipulation"
                title="Trang trước"
              >
                <SFChevronLeft size={14} />
              </button>

              <span className="px-3 py-1 rounded-full bg-white dark:bg-[#1d1d1f] border border-[#e0e0e0] dark:border-white/10 text-xs font-semibold text-[#1d1d1f] dark:text-white shadow-2xs">
                {table.getState().pagination.pageIndex + 1}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-90 touch-manipulation"
                title="Trang sau"
              >
                <SFChevronRight size={14} />
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-90 touch-manipulation"
                title="Trang cuối"
              >
                <SFForwardEnd size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Apple Liquid Batch Action Bar with Fluid Slide Up/Down Transition */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-spring',
          selectedRowCount > 0
            ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
            : 'translate-y-16 opacity-0 scale-95 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/90 dark:bg-[#1c1c24]/90 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-[13px]">
          <span className="flex items-center gap-1.5 font-medium text-[#1d1d1f] dark:text-white">
            <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-[11px] font-bold">
              {selectedRowCount}
            </span>
            <span>đã chọn</span>
          </span>

          <div className="h-4 w-px bg-black/10 dark:bg-white/15" />

          {batchActions ? (
            batchActions(selectedRows, clearSelection)
          ) : (
            <div className="flex items-center gap-2">
              {onBatchDelete && (
                <button
                  type="button"
                  onClick={() => onBatchDelete(selectedRows, clearSelection)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 active:scale-95 transition-all duration-150 font-medium text-[12.5px] cursor-pointer touch-manipulation"
                >
                  <SFTrash size={13} />
                  <span>Xóa</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={clearSelection}
            className="px-2.5 py-1 text-xs text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white active:scale-95 transition-all duration-150 cursor-pointer"
          >
            Bỏ chọn
          </button>
        </div>
      </div>
    </div>
  );
}
