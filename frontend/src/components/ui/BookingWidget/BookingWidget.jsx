import { useState, useEffect } from 'react';
import Calendar from './Calendar';
import TimeSlotGrid from './TimeSlotGrid';
import styles from './BookingWidget.module.scss';
import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';

function BookingWidget({ onBookingComplete }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileSheetOpen]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTime(null); // Reset time when date changes
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      onBookingComplete?.({ date: selectedDate, time: selectedTime });
    }
  };

  return (
    <>
      {/* Mobile FAB */}
      <button className={styles.mobileFab} onClick={() => setIsMobileSheetOpen(true)} aria-label="Book Appointment">
        <Icon name="calendar" />
        <span>Book Appointment</span>
      </button>

      {/* Backdrop for mobile sheet */}
      {isMobileSheetOpen && <div className={styles.sheetBackdrop} onClick={() => setIsMobileSheetOpen(false)} />}

      {/* Widget / Sheet */}
      <div className={`${styles.bookingWidget} glass-panel ${isMobileSheetOpen ? styles.sheetOpen : ''}`}>
        <div className={styles.sheetHandle} onClick={() => setIsMobileSheetOpen(false)} />

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
          <Button color="gold" disabled={!selectedDate || !selectedTime} onClick={handleConfirm} className={styles.confirmBtn}>
            Confirm Booking
          </Button>
        </div>
      </div>
    </>
  );
}

export default BookingWidget;
