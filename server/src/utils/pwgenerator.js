const generatePassword = () => {
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let length = 8;

  let password = "";
  for (let i = 0; i < length; i++) {
    let index = Math.floor(Math.random() * characters.length);
    password += characters[index];
  }

  return password;
};
export default generatePassword;
