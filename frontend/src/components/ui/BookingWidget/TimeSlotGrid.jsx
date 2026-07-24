import styles from './TimeSlotGrid.module.scss';
import { format } from 'date-fns';

function TimeSlotGrid({ selectedDate, availableSlots = [], selectedTime, onSelectTime }) {
  if (!selectedDate) {
    return (
      <div className={styles.emptyState}>
        <p>Please select a date to view available times.</p>
      </div>
    );
  }

  // Dummy slots for demonstration if none are provided
  const slots =
    availableSlots.length > 0
      ? availableSlots
      : [
          { time: '09:00', available: true },
          { time: '09:30', available: true },
          { time: '10:00', available: false },
          { time: '10:30', available: true },
          { time: '11:00', available: true },
          { time: '11:30', available: false },
          { time: '13:00', available: true },
          { time: '13:30', available: true },
          { time: '14:00', available: true },
          { time: '14:30', available: true },
          { time: '15:00', available: true },
        ];

  return (
    <div className={styles.timeSlotGrid}>
      <h3 className={styles.title}>Available times for {format(selectedDate, 'MMMM d, yyyy')}</h3>

      <div className={styles.grid}>
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          return (
            <button
              key={slot.time}
              className={`${styles.slotBtn} ${!slot.available ? styles.unavailable : ''} ${isSelected ? styles.selected : ''}`}
              disabled={!slot.available}
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate(20);
                }
                onSelectTime(slot.time);
              }}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TimeSlotGrid;
