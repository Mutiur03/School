import crypto from 'crypto';

const generatePassword = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[crypto.randomInt(0, chars.length)];
  }
  return password;
};

export default generatePassword;
