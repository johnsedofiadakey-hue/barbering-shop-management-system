import { useState, useEffect, Children } from 'react';
import styles from './Pagination.module.scss';

import StatCard from '@components/ui/StatCard/StatCard';
import Icon from '@components/common/Icon/Icon';
import Button from '@components/common/Button/Button';
import Spinner from '@components/common/Spinner/Spinner';

const getTextContent = (node) =>
  Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (child?.props?.children) return getTextContent(child.props.children);
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

function Pagination({
  icon,
  label,
  children,
  itemsPerPage = 3,
  loading,
  emptyMessage = 'No items',
  className = '', //
}) {
  // Extracts first PaginationColumn and PaginationRow children by displayName
  const [action, columns, rows] = [Action.displayName, Column.displayName, Row.displayName].map((name) =>
    Children.toArray(children).filter((child) => child.type.displayName === name),
  );

  // Pagination state
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(rows.length / itemsPerPage);
  const pageRows = rows.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  // Generates a stable row identity signature for pagination reset logic
  const rowKeys = rows.map((r) => r.key).join(',');

  /**
   *  Always reset to first page when table content or paging changes
   */
  useEffect(() => {
    setPage(0);
  }, [rowKeys, itemsPerPage]);

  // Get all style classes into a string
  const computedClassName = [className].join(' ');

  return (
    <StatCard className={computedClassName} icon={icon} label={label}>
      {action}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              {columns.map((column, idx) => (
                <th className={styles.tableHeadRow} key={idx}>
                  {column.props.children}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className={styles.tableBody}>
            {loading && (
              <tr>
                <td colSpan={columns.length || 1} className={styles.empty}>
                  <Spinner />
                </td>
              </tr>
            )}

            {!loading &&
              rows.length > 0 &&
              pageRows.map((row, ridx) => {
                const cells = Children.toArray(row.props.children).filter((cell) => cell.type.displayName === Cell.displayName);

                return (
                  <tr key={row.key || ridx}>
                    {cells.map((cell, cidx) => (
                      <td
                        className={styles.tableBodyRow}
                        data-label={getTextContent(columns[cidx]?.props.children) || `Item ${cidx + 1}`}
                        key={cidx}
                      >
                        {cell.props.children}
                      </td>
                    ))}
                  </tr>
                );
              })}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination nav */}
      {pageCount > 1 && (
        <nav className={styles.paginationNav}>
          <Button
            className={styles.pageButton}
            type="button"
            onClick={() => setPage(page - 1)}
            color="actionbtn"
            size="sm"
            disabled={page === 0}
          >
            <Icon name="left" size="sm" />
          </Button>
          <span className={styles.pageStatus}>
            Page <span className={styles.pageCurrent}>{page + 1}</span> / {pageCount}
          </span>
          <Button
            className={styles.pageButton}
            type="button"
            onClick={() => setPage(page + 1)}
            color="actionbtn"
            size="sm"
            disabled={page + 1 >= pageCount}
          >
            <Icon name="right" size="sm" />
          </Button>
        </nav>
      )}
    </StatCard>
  );
}

// Subcomponents for clean declarative
const Action = ({ children }) => <>{children}</>;
const Column = ({ children }) => <>{children}</>;
const Row = ({ children }) => <>{children}</>;
const Cell = ({ children }) => <>{children}</>;

// Set display names for subcomponent identification
Action.displayName = 'PaginationAction';
Column.displayName = 'PaginationColumn';
Row.displayName = 'PaginationRow';
Cell.displayName = 'PaginationCell';

// Attach to main component for namespacing
Pagination.Action = Action;
Pagination.Column = Column;
Pagination.Row = Row;
Pagination.Cell = Cell;

export default Pagination;
