import { useState } from 'react';
import Calendar from './Calendar';
import TimeSlotGrid from './TimeSlotGrid';
import styles from './BookingWidget.module.scss';
import Button from '@components/common/Button/Button';

function BookingWidget({ onBookingComplete }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTime(null); // Reset time when date changes
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      onBookingComplete?.({ date: selectedDate, time: selectedTime });
    }
  };

  return (
    <div className={`${styles.bookingWidget} glass-panel`}>
      <div className={styles.layout}>
        <div className={styles.calendarSection}>
          <Calendar selectedDate={selectedDate} onSelectDate={handleDateSelect} />
        </div>
        <div className={styles.timeSection}>
          <TimeSlotGrid selectedDate={selectedDate} selectedTime={selectedTime} onSelectTime={handleTimeSelect} />
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.selectionSummary}>
          {selectedDate && selectedTime ? (
            <p>
              Selected: <span className="text-gradient-gold">{selectedDate.toLocaleDateString()}</span> at{' '}
              <span className="text-gradient-gold">{selectedTime}</span>
            </p>
          ) : (
            <p className={styles.hint}>Select a date and time to continue.</p>
          )}
        </div>
        <Button color="gold" disabled={!selectedDate || !selectedTime} onClick={handleConfirm}>
          Confirm Booking
        </Button>
      </div>
    </div>
  );
}

export default BookingWidget;
