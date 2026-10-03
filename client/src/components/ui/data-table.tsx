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
  ColumnFiltersState
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { SFChevronLeft, SFChevronRight, SFBackwardEnd, SFForwardEnd, SFArrowUpArrowDown, SFArrowDownDocument } from 'sf-symbols-lib';
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
  pageSize = 15
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters
    },
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

  return (
    <div className={cn('space-y-3.5', className)}>
      {onExport && (
        <div className="flex justify-end">
          <Button
            variant="glass"
            size="sm"
            onClick={onExport}
            icon={<SFArrowDownDocument size={14} className="text-[#0066cc] dark:text-[#2997ff]" />}
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
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-[#1d1d1f] dark:hover:text-white transition-colors'
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
                    className="hover:bg-[#f5f5f7]/60 dark:hover:bg-white/5 transition-colors duration-150"
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
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                title="Trang đầu"
              >
                <SFBackwardEnd size={14} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
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
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                title="Trang sau"
              >
                <SFChevronRight size={14} />
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                title="Trang cuối"
              >
                <SFForwardEnd size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
