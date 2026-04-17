import { Request, Response } from "express";
import { ApiResponse } from "@/utils/ApiResponse.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { AuthService } from "./auth.service.js";

export class AuthController {
  static setupSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { email, token } = req.body;
    const data = await AuthService.setupSuperAdmin(req, email, token);

    res
      .status(201)
      .json(new ApiResponse(201, data, "Super admin created successfully"));
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const { accessToken, refreshToken, user } = await AuthService.loginAdmin(
      username,
      password,
      req.schoolId,
    );

    AuthService.sendRefreshToken(res, refreshToken);

    res
      .status(200)
      .json(new ApiResponse(200, { accessToken, user }, "Login successful"));
  });

  static superAdminLogin = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } =
      await AuthService.loginSuperAdmin(req, email, password);

    AuthService.sendRefreshToken(res, refreshToken);

    res
      .status(200)
      .json(new ApiResponse(200, { accessToken, user }, "Login successful"));
  });

  static student_login = asyncHandler(async (req: Request, res: Response) => {
    const { login_id, password } = req.body;
    const { accessToken, refreshToken, user } = await AuthService.loginStudent(
      login_id,
      password,
      req.schoolId,
    );

    AuthService.sendRefreshToken(res, refreshToken);

    res
      .status(200)
      .json(new ApiResponse(200, { accessToken, user }, "Login successful"));
  });

  static teacher_login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await AuthService.loginTeacher(
      email,
      password,
      req.schoolId,
    );

    AuthService.sendRefreshToken(res, refreshToken);

    res
      .status(200)
      .json(new ApiResponse(200, { accessToken, user }, "Login successful"));
  });

  static refresh_token = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies.refreshToken;
    const { accessToken, refreshToken, user } = await AuthService.refreshToken(
      req,
      token,
    );

    AuthService.sendRefreshToken(res, refreshToken);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken, user },
          "Token refreshed successfully",
        ),
      );
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken;

    await AuthService.logout(token, req.schoolId);
    AuthService.clearRefreshToken(res);

    res.status(200).json(new ApiResponse(200, {}, "Logged out successfully"));
  });

  static addAdminForSchool = asyncHandler(
    async (req: Request, res: Response) => {
      const { username, password } = req.body;
      const schoolIdRaw = req.params.schoolId;
      const schoolId = parseInt(
        Array.isArray(schoolIdRaw) ? schoolIdRaw[0] : schoolIdRaw,
        10,
      );
      const admin = await AuthService.addAdmin(username, password, schoolId);

      res
        .status(201)
        .json(new ApiResponse(201, admin, "Admin created successfully"));
    },
  );

  static requestTeacherPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { email } = req.body;
      const result = await AuthService.requestTeacherPasswordReset(
        email,
        req.schoolId,
      );

      res.status(200).json(new ApiResponse(200, null, result.message));
    },
  );

  static checkTeacherPasswordResetCode = asyncHandler(
    async (req: Request, res: Response) => {
      const { email, code } = req.body;
      await AuthService.checkTeacherPasswordResetCode(email, code);

      res
        .status(200)
        .json(new ApiResponse(200, null, "Code verified successfully"));
    },
  );

  static verifyTeacherPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { email, code, newPassword } = req.body;
      await AuthService.verifyTeacherPasswordReset(
        email,
        code,
        newPassword,
        req.schoolId,
      );

      res
        .status(200)
        .json(new ApiResponse(200, null, "Password reset successfully"));
    },
  );

  static requestStudentPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { login_id } = req.body;
      const result = await AuthService.requestStudentPasswordReset(
        login_id,
        req.schoolId,
      );

      res.status(200).json(new ApiResponse(200, null, result.message));
    },
  );

  static checkStudentPasswordResetCode = asyncHandler(
    async (req: Request, res: Response) => {
      const { login_id, code } = req.body;
      await AuthService.checkStudentPasswordResetCode(login_id, code);

      res
        .status(200)
        .json(new ApiResponse(200, null, "Code verified successfully"));
    },
  );

  static verifyStudentPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { login_id, code, newPassword } = req.body;
      await AuthService.verifyStudentPasswordReset(
        login_id,
        code,
        newPassword,
        req.schoolId,
      );

      res
        .status(200)
        .json(new ApiResponse(200, null, "Password reset successfully"));
    },
  );
}
