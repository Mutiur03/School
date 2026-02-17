import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/ApiError.js";
class AuthMiddleware {
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
