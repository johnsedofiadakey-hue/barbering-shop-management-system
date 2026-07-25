import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import styles from './Calendar.module.scss';
import Spinner from '@components/common/Spinner/Spinner';

// Parsed at noon to avoid UTC/local timezone day-shift bugs (same convention as formatBookingDate).
const toLocalDate = (isoDate) => new Date(`${isoDate}T12:00:00`);

function Calendar({ dates = [], selectedDate, onSelectDate, isLoading }) {
  const scrollRef = useRef(null);

  const handleSelect = (isoDate) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onSelectDate(isoDate);
  };

  // Scroll the selected date into view when it changes
  useEffect(() => {
    if (selectedDate && scrollRef.current) {
      const selectedEl = scrollRef.current.querySelector(`.${styles.selected}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDate]);

  if (isLoading) {
    return (
      <div className={styles.emptyState}>
        <Spinner size="sm" />
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No upcoming availability for this barber right now.</p>
      </div>
    );
  }

  return (
    <div className={styles.calendarStrip} ref={scrollRef}>
      {dates.map((isoDate) => {
        const day = toLocalDate(isoDate);
        const isSelected = selectedDate === isoDate;

        return (
          <button
            key={isoDate}
            className={`${styles.dayBubble} ${isSelected ? styles.selected : ''}`}
            onClick={() => handleSelect(isoDate)}
            type="button"
          >
            <span className={styles.month}>{format(day, 'MMM')}</span>
            <span className={styles.dateNumber}>{format(day, 'd')}</span>
            <span className={styles.dayName}>{format(day, 'EEE')}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Calendar;
