import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
export const authenticateUser = async (req, res, next) => {
  const token = req.cookies?.token; 
  console.log(token);
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  // console.log(token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log(req.user);
    console.log(req.user.id);
    if(!req.user.id) return res.status(401).json({ message: "Unauthorized" });
    if(req.user.role !== "admin") return res.status(401).json({ message: "Unauthorized" });
    const check = await pool.query("SELECT * FROM admin WHERE id = $1", [
      req.user.id,
    ]);
    if (!check.rows[0])
      return res.status(401).json({ message: "Unauthorized" });
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};
export const login = async (req, res) => {
  const { username, password } = req.body;

  const query =
    "SELECT * FROM admin WHERE username = $1 AND password = $2 AND role = $3";
  pool.query(query, [username, password, "admin"], (err, result) => {
    if (err) {
      console.log(username, password);

      return res
        .status(500)
        .json({ success: false, error: "Error logging in" });
    }
    console.log("logging in");
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET
      // { expiresIn: "1m" }
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      // maxAge: 60 * 1000,
    });
    res.json({ success: true, message: "Login successful" });
    // res.status(200).json({ token });
  });
};

export const student_login = async (req, res) => {
  // const { login_id, password } = req.body;
  console.log("Received login data:", req.body);
  const { login_id, password } = req.body;
  console.log("Received login data:", login_id, password);

  const query = "SELECT * FROM students WHERE login_id = $1";
  const result = await pool.query(query, [login_id]);
  if (result.rows.length === 0) {
    return res.status(401).json({ message: "Invalid login id" });
  }
  console.log(result.rows[0].password);
  const hashedPassword = result.rows[0].password;
  const isValidPassword = await bcrypt.compare(password, hashedPassword);
  if (!isValidPassword) {
    return res.status(401).json({ message: "Invalid password" });
  }
  // console.log(result.rows[0]);

  const token = jwt.sign(
    {
      id: result.rows[0].id,
      role: "student",
      login_id: result.rows[0].login_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  console.log(token);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    // maxAge: 60 * 1000,
  });
  res.json({ success: true, message: "Login successful" });
};

export const authenticateStudent = async (req, res, next) => {
  const token = req.cookies?.token; // Use optional chaining to avoid errors
  console.log("Authenticating",token);
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  // console.log(token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    
    req.user = decoded;
    const check = await pool.query(
      "SELECT * FROM students WHERE login_id = $1",
      [req.user.login_id]
    );
    if (check.rows.length === 0)
      return res.status(401).json({ message: "Unauthorized" });
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};
