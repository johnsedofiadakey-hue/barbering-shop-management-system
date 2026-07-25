import styles from './TimeSlotGrid.module.scss';
import { format } from 'date-fns';
import { formatTime } from '@utils/dateTime';
import Spinner from '@components/common/Spinner/Spinner';

const toLocalDate = (isoDate) => new Date(`${isoDate}T12:00:00`);

function TimeSlotGrid({ selectedDate, slots = [], selectedTime, onSelectTime, isLoading }) {
  if (!selectedDate) {
    return (
      <div className={styles.emptyState}>
        <p>Please select a date to view available times.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.emptyState}>
        <Spinner size="sm" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No times are available for this selection. Try another day.</p>
      </div>
    );
  }

  return (
    <div className={styles.timeSlotGrid}>
      <h3 className={styles.title}>Available times for {format(toLocalDate(selectedDate), 'MMMM d, yyyy')}</h3>

      <div className={styles.grid}>
        {slots.map((time) => {
          const isSelected = selectedTime === time;
          return (
            <button
              key={time}
              className={`${styles.slotBtn} ${isSelected ? styles.selected : ''}`}
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate(20);
                }
                onSelectTime(time);
              }}
            >
              {formatTime(time)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TimeSlotGrid;
