import { useState } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isBefore,
  startOfDay,
} from 'date-fns';
import styles from './Calendar.module.scss';
import Icon from '@components/common/Icon/Icon';

function Calendar({ selectedDate, onSelectDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = startOfDay(new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className={styles.header}>
        <button type="button" className={styles.navButton} onClick={prevMonth}>
          <Icon name="chevron-left" />
        </button>
        <div className={styles.currentMonth}>{format(currentMonth, 'MMMM yyyy')}</div>
        <button type="button" className={styles.navButton} onClick={nextMonth}>
          <Icon name="chevron-right" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth);

    for (let i = 0; i < 7; i++) {
      days.push(
        <div className={styles.dayName} key={i}>
          {format(addDays(startDate, i), 'EEE')}
        </div>,
      );
    }
    return <div className={styles.daysRow}>{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const isPast = isBefore(day, today);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);

        days.push(
          <div
            className={`${styles.cell} ${
              !isCurrentMonth ? styles.disabled : isPast ? styles.past : isSelected ? styles.selected : ''
            }`}
            key={day}
            onClick={() => {
              if (isCurrentMonth && !isPast) {
                onSelectDate(cloneDay);
              }
            }}
          >
            <span className={styles.dateNumber}>{formattedDate}</span>
          </div>,
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className={styles.row} key={day}>
          {days}
        </div>,
      );
      days = [];
    }
    return <div className={styles.body}>{rows}</div>;
  };

  return (
    <div className={styles.calendar}>
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
}

export default Calendar;
