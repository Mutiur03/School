import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
export const teacher_me = async (req, res, next) => {
  console.log("Fetching teacher profile...");

  const token = req.cookies?.token;
  
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    const teacher = await prisma.teachers.findUnique({
      where: { id: req.user.id },
      include: { 
        levels: true,
      },
    });
    console.log("Teacher profile fetched:", teacher);

    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (teacher.password) {
      delete teacher.password; // Remove password from response
    }
    req.user = teacher;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};
