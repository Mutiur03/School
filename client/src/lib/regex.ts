export const BANGLA_ONLY = /^[\u0980-\u09FF\s.:]+$/;
export const BANGLA_OPTIONAL = /^[\u0980-\u09FF\s.:]*$/;
export const ENGLISH_ONLY = /^[A-Za-z\s.:]+$/;
export const PHONE_NUMBER = /^01[3-9][0-9]{8}$/;
export const NID = /^\d{10,17}$/;
export const BIRTH_REG_NO = /^\d{17}$/;
export const POST_CODE = /^\d{4}$/;
export const REGISTRATION_NO = /^\d{10}$/;
export const ROLL_NUMBER = /^\d{1,6}$/;

export function filterEnglishInput(e: React.FormEvent<HTMLInputElement>) {
  const target = e.target as HTMLInputElement;
  return target.value.replace(/[^A-Za-z.():\s]/g, "");
}

export function filterBanglaInput(e: React.FormEvent<HTMLInputElement>) {
  const target = e.target as HTMLInputElement;
  return target.value.replace(/[^\u0980-\u09FF.():\s]/g, "");
}
export function filterNumericInput(e: React.FormEvent<HTMLInputElement>) {
  const target = e.target as HTMLInputElement;
  return target.value.replace(/[^\d]/g, "");
}
