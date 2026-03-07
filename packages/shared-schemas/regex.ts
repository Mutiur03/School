export const BANGLA_ONLY = /^[\u0980-\u09FF\s.:]+$/;
export const ENGLISH_ONLY = /^[A-Za-z\s.:]+$/;
export const PHONE_NUMBER = /^01[3-9][0-9]{8}$/;
export const NID = /^(?:\d{10}|\d{13}|\d{17})$/;
export const BIRTH_REG_NO = /^\d{17}$/;
export const POST_CODE = /^\d{4}$/;
export const REGISTRATION_NO = /^\d{10}$/;
export const ROLL_NUMBER = /^\d{1,6}$/;

// Utility filters for UI (used by both frontend and shared logic)
export function filterEnglishInput(value: string) {
  return value.replace(/[^A-Za-z.():\s]/g, "");
}

export function filterBanglaInput(value: string) {
  return value.replace(/[^\u0980-\u09FF.():\s]/g, "");
}

export function filterNumericInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
