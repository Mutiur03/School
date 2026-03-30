export const BANGLA_ONLY = /^[\u0980-\u09FF\s.:]+$/;
export const PHONE_NUMBER = /^01\d{9}$/;
export const NID = /^(?:\d{10}|\d{13}|\d{17})$/;
export const BIRTH_REG_NO = /^\d{17}$/;
export const POST_CODE = /^\d{4}$/;
export const REGISTRATION_NO = /^\d{10}$/;
export const ROLL_NUMBER = /^\d{1,6}$/;

export const NAME = /^[A-Za-z][A-Za-z\s.,'()-]{0,99}$/;
export const SUBJECT_NAME =
  /^[A-Za-z0-9][A-Za-z0-9 .()&\/'-]{1,98}[A-Za-z0-9).]$/;
export const CLASS_NUM = /^(?:[1-9]|10)$/;
export const SECTION = /^[A-Za-z]$/;
export const ADDRESS_TEXT = /^[A-Za-z0-9\s,.\/()'-]{2,100}$/;
export const DESIGNATION = /^[A-Za-z][A-Za-z0-9\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]{0,49}$/;
export const USERNAME = /^[A-Za-z0-9_.@-]+$/;
export const ASCII_ONLY = /^[\x00-\x7F]+$/;
export const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const LOGIN_ID = /^\d{6}$/;

export const ENGLISH_FILTER = /[^A-Za-z.():\s]/g;
export const ADDRESS_FILTER = /[^A-Za-z0-9\s,.\/()'-]/g;
export const BANGLA_FILTER = /[^\u0980-\u09FF.():\s]/g;
export const NUMERIC_FILTER = /[^\d]/g;

export function filterEnglishInput(value: string) {
  return value
    .replace(ENGLISH_FILTER, "")
    .replace(/\s+/g, " ")
    .trimStart();
}

export function filterAddressInput(value: string) {
  return value
    .replace(ADDRESS_FILTER, "")
    .replace(/\s+/g, " ")
    .trimStart();
}

export function filterBanglaInput(value: string) {
  return value
    .replace(BANGLA_FILTER, "")
    .replace(/\s+/g, " ")
    .trimStart();
}

export function filterNumericInput(value: string) {
  return value.replace(NUMERIC_FILTER, "").replace(/\s+/g, "").trimStart();
}

export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const VALID_GROUPS = ["Science", "Commerce", "Humanities"] as const;

export const RELIGION = ["Islam", "Hinduism", "Christianity", "Buddhism"] as const;