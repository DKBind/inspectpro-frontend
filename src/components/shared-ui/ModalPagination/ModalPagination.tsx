import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ModalPagination.module.css';
import { cn } from '@/lib/utils';

interface ModalPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const ModalPagination = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: ModalPaginationProps) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  // const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className={cn(styles.wrapper, 'mt-2')}>
      <span className={styles.info}>
        Showing {startItem} out of {totalItems}
      </span>

      <div className={styles.controls}>
        <button
          className={styles.navBtn}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`e-${idx}`} className={styles.ellipsis}>…</span>
          ) : (
            <button
              key={page}
              className={`${styles.pageBtn} ${page === currentPage ? styles.active : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}

        <button
          className={styles.navBtn}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default ModalPagination;
