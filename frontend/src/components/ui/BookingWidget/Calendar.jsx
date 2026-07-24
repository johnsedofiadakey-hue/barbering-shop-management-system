import { useEffect, useRef } from 'react';
import { format, isSameDay, addDays, startOfDay } from 'date-fns';
import styles from './Calendar.module.scss';

function Calendar({ selectedDate, onSelectDate }) {
  const scrollRef = useRef(null);
  const today = startOfDay(new Date());

  // Generate the next 30 days
  const days = Array.from({ length: 30 }).map((_, i) => addDays(today, i));

  const handleSelect = (day) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onSelectDate(day);
  };

  // Optional: scroll the selected date into view on mount if it exists
  useEffect(() => {
    if (selectedDate && scrollRef.current) {
      const selectedEl = scrollRef.current.querySelector(`.${styles.selected}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDate]); // Only on mount/selectedDate change

  return (
    <div className={styles.calendarStrip} ref={scrollRef}>
      {days.map((day) => {
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isToday = isSameDay(day, today);

        return (
          <button
            key={day.toISOString()}
            className={`${styles.dayBubble} ${isSelected ? styles.selected : ''}`}
            onClick={() => handleSelect(day)}
            type="button"
          >
            <span className={styles.month}>{format(day, 'MMM')}</span>
            <span className={styles.dateNumber}>{format(day, 'd')}</span>
            <span className={styles.dayName}>{isToday ? 'Today' : format(day, 'EEE')}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Calendar;
