/** Classes and sections the attendance pages work with. */
export const ATTENDANCE_CLASSES = [6, 7, 8, 9, 10];
export const ATTENDANCE_SECTIONS = ['A', 'B'];

const CLASS_STORAGE_KEY = 'attendance:class';

// Remembered class (per browser), shared by Attendance and Running Away.
// localStorage can throw in private mode, so both helpers are guarded.
export const readStoredClass = (): number | '' => {
  try {
    const value = Number(localStorage.getItem(CLASS_STORAGE_KEY));
    return ATTENDANCE_CLASSES.includes(value) ? value : '';
  } catch {
    return '';
  }
};

export const storeClass = (value: number | '') => {
  try {
    localStorage.setItem(CLASS_STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable: just don't remember */
  }
};
