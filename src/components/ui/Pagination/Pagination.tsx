import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}: PaginationProps) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
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
    <div className={styles.paginationWrapper}>
      <div className={styles.info}>
        Showing <strong>{startItem}</strong> – <strong>{endItem}</strong> of{' '}
        <strong>{totalItems}</strong> results
      </div>

      <div className={styles.controls}>
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft />
        </button>
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={page}
              className={`${styles.pageBtn} ${
                page === currentPage ? styles.pageBtnActive : ''
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}

        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight />
        </button>
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronsRight />
        </button>
      </div>

      {onPageSizeChange && (
        <div className={styles.pageSizeSelect}>
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>per page</span>
        </div>
      )}
    </div>
  );
};

export default Pagination;
