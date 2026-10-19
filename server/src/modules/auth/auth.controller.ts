import { Request, Response } from 'express';
import { ApiResponse } from '@/utils/ApiResponse.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiError } from '@/utils/ApiError.js';
import { AuthService } from './auth.service.js';
import { platformAccessCode } from '@/nest/modules/school-codes/platform-code.js';
import { authClientOf, UnsupportedClientError, type AuthClient } from './auth-tokens.js';

export class AuthController {
  /** Web: HttpOnly cookie only. Native: JSON body only (a native caller never reads cookies). */
  private static getRefreshToken(req: Request, client: AuthClient) {
    if (client === 'native') {
      const token = req.body?.refreshToken;
      return typeof token === 'string' && token.length > 0 ? token : undefined;
    }
    return req.cookies?.refreshToken;
  }

  private static client(req: Request): AuthClient {
    try {
      return authClientOf(req);
    } catch (error) {
      if (error instanceof UnsupportedClientError) throw new ApiError(400, 'Unsupported client');
      throw error;
    }
  }

  /**
   * Login/refresh response. Web keeps the cookie contract unchanged; native gets the refresh
   * token in the body and no cookie.
   */
  private static sendSession(
    res: Response,
    client: AuthClient,
    session: { accessToken: string; refreshToken: string; user: unknown },
    message: string,
  ) {
    const { accessToken, refreshToken, user } = session;
    if (client === 'native') {
      return res
        .status(200)
        .json(new ApiResponse(200, { accessToken, refreshToken, user }, message));
    }
    AuthService.sendRefreshToken(res, refreshToken);
    return res.status(200).json(new ApiResponse(200, { accessToken, user }, message));
  }

  static setupSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { email, token } = req.body;
    const data = await AuthService.setupSuperAdmin(req, email, token);

    res.status(201).json(new ApiResponse(201, data, 'Super admin created successfully'));
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const client = AuthController.client(req);
    const session = await AuthService.loginAdmin(username, password, req.schoolId, client);
    AuthController.sendSession(res, client, session, 'Login successful');
  });

  static superAdminLogin = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const client = AuthController.client(req);
    const session = await AuthService.loginSuperAdmin(req, email, password, client);
    AuthController.sendSession(res, client, session, 'Login successful');
  });

  static student_login = asyncHandler(async (req: Request, res: Response) => {
    const { login_id, password } = req.body;
    const client = AuthController.client(req);
    const session = await AuthService.loginStudent(login_id, password, req.schoolId, client);
    AuthController.sendSession(res, client, session, 'Login successful');
  });

  static teacher_login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const client = AuthController.client(req);
    const session = await AuthService.loginTeacher(email, password, req.schoolId, client);
    AuthController.sendSession(res, client, session, 'Login successful');
  });

  static refresh_token = asyncHandler(async (req: Request, res: Response) => {
    const client = AuthController.client(req);
    const token = AuthController.getRefreshToken(req, client);
    const session = await AuthService.refreshToken(req, res, token, client);
    AuthController.sendSession(res, client, session, 'Token refreshed successfully');
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    const client = AuthController.client(req);
    const token = AuthController.getRefreshToken(req, client);

    await AuthService.logout(token, req.schoolId);
    if (client === 'web') AuthService.clearRefreshToken(res);

    res.status(200).json(new ApiResponse(200, {}, 'Logged out successfully'));
  });

  static addAdminForSchool = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const schoolIdRaw = req.params.schoolId;
    const schoolId = parseInt(Array.isArray(schoolIdRaw) ? schoolIdRaw[0] : schoolIdRaw, 10);
    const admin = await AuthService.addAdmin(username, password, schoolId);

    res.status(201).json(new ApiResponse(201, admin, 'Admin created successfully'));
  });

  /** The platform access code for a signed-in super admin to show as a QR. null when unset. */
  static getPlatformAccessCode = asyncHandler(async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res
      .status(200)
      .json(new ApiResponse(200, { code: platformAccessCode() }, 'Platform access code fetched'));
  });

  static listAdminsForSchool = asyncHandler(async (req: Request, res: Response) => {
    const schoolIdRaw = req.params.schoolId;
    const schoolId = parseInt(Array.isArray(schoolIdRaw) ? schoolIdRaw[0] : schoolIdRaw, 10);
    const admins = await AuthService.listAdminsForSchool(schoolId);

    res.status(200).json(new ApiResponse(200, admins, 'Admins fetched successfully'));
  });

  static deleteAdminForSchool = asyncHandler(async (req: Request, res: Response) => {
    const schoolIdRaw = req.params.schoolId;
    const adminIdRaw = req.params.adminId;
    const schoolId = parseInt(Array.isArray(schoolIdRaw) ? schoolIdRaw[0] : schoolIdRaw, 10);
    const adminId = parseInt(Array.isArray(adminIdRaw) ? adminIdRaw[0] : adminIdRaw, 10);
    const deleted = await AuthService.deleteAdmin(adminId, schoolId);

    res.status(200).json(new ApiResponse(200, deleted, 'Admin deleted successfully'));
  });

  static requestTeacherPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await AuthService.requestTeacherPasswordReset(email, req.schoolId);

    res.status(200).json(new ApiResponse(200, null, result.message));
  });

  static checkTeacherPasswordResetCode = asyncHandler(async (req: Request, res: Response) => {
    const { email, code } = req.body;
    await AuthService.checkTeacherPasswordResetCode(email, code);

    res.status(200).json(new ApiResponse(200, null, 'Code verified successfully'));
  });

  static verifyTeacherPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { email, code, newPassword } = req.body;
    await AuthService.verifyTeacherPasswordReset(email, code, newPassword, req.schoolId);

    res.status(200).json(new ApiResponse(200, null, 'Password reset successfully'));
  });

  static requestStudentPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { login_id } = req.body;
    const result = await AuthService.requestStudentPasswordReset(login_id, req.schoolId);

    res.status(200).json(new ApiResponse(200, null, result.message));
  });

  static checkStudentPasswordResetCode = asyncHandler(async (req: Request, res: Response) => {
    const { login_id, code } = req.body;
    await AuthService.checkStudentPasswordResetCode(login_id, code);

    res.status(200).json(new ApiResponse(200, null, 'Code verified successfully'));
  });

  static verifyStudentPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { login_id, code, newPassword } = req.body;
    await AuthService.verifyStudentPasswordReset(login_id, code, newPassword, req.schoolId);

    res.status(200).json(new ApiResponse(200, null, 'Password reset successfully'));
  });
}
