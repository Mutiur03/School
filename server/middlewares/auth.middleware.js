import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";
class AuthMiddleware {
  static async authenticateTeacher(req, res, next) {
    console.log("Fetching teacher profile...");

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return next(new ApiError(401, "Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      const teacher = await prisma.teachers.findUnique({
        where: { id: req.user.id, available: true },
        include: {
          levels: true,
        },
      });
      console.log("Teacher profile fetched:", teacher);

      if (!teacher) return next(new ApiError(404, "Teacher not found"));
      if (teacher.password) {
        delete teacher.password;
      }
      req.user = teacher;
      req.user.role = "teacher";
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return next(new ApiError(401, "Token expired"));
      }
      return next(new ApiError(401, "Invalid Token"));
    }
  }

  static async authenticateAdmin(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return next(new ApiError(401, "Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (!req.user.id) return next(new ApiError(401, "Unauthorized"));
      if (req.user.role !== "admin")
        return next(new ApiError(401, "Unauthorized"));
      const check = await prisma.admin.findUnique({
        where: { id: req.user.id },
      });
      if (!check) return next(new ApiError(401, "Unauthorized"));

      req.admin = check;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return next(new ApiError(401, "Token expired"));
      }
      return next(new ApiError(401, "Invalid Token"));
    }
  }

  static async authenticateStudent(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return next(new ApiError(401, "Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const check = await prisma.students.findUnique({
        where: { id: decoded.id },
      });
      if (!check) return next(new ApiError(401, "Unauthorized"));

      req.user = decoded;
      if (req.user.password) {
        delete req.user.password;
      }
      req.user.role = "student";
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return next(new ApiError(401, "Token expired"));
      }
      return next(new ApiError(401, "Invalid Token"));
    }
  }
  static async authenticateUser(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return next(new ApiError(401, "Unauthorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      let user;

      if (decoded.role === "admin") {
        user = await prisma.admin.findUnique({
          where: { id: req.user.id },
        });
      } else if (decoded.role === "teacher") {
        user = await prisma.teachers.findUnique({
          where: { id: req.user.id, available: true },
          include: {
            levels: true,
          },
        });
        if (user && user.password) delete user.password;
      } else if (decoded.role === "student") {
        user = await prisma.students.findUnique({
          where: { id: req.user.id },
        });
        if (user && user.password) delete user.password;
      }

      if (!user) return next(new ApiError(401, "Unauthorized"));

      req.user = user;
      req.user.role = decoded.role;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return next(new ApiError(401, "Token expired"));
      }
      return next(new ApiError(401, "Invalid Token"));
    }
  }

  static authenticate(roles = []) {
    return async (req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) return next(new ApiError(401, "Unauthorized"));

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        if (roles.length > 0 && !roles.includes(decoded.role)) {
          return next(new ApiError(403, "Forbidden: Insufficient permissions"));
        }

        let user;

        if (decoded.role === "admin") {
          user = await prisma.admin.findUnique({
            where: { id: req.user.id },
          });
        } else if (decoded.role === "teacher") {
          user = await prisma.teachers.findUnique({
            where: { id: req.user.id, available: true },
            include: {
              levels: true,
            },
          });
          if (user && user.password) delete user.password;
        } else if (decoded.role === "student") {
          user = await prisma.students.findUnique({
            where: { id: req.user.id },
          });
          if (user && user.password) delete user.password;
        }

        if (!user) return next(new ApiError(401, "Unauthorized"));

        req.user = user;
        req.user.role = decoded.role;
        next();
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          return next(new ApiError(401, "Token expired"));
        }
        return next(new ApiError(401, "Invalid Token"));
      }
    };
  }
}

export default AuthMiddleware;
