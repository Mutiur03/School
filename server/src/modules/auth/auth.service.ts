import jwt from "jsonwebtoken";
import { Response } from "express";
import { env } from "@/config/env.js";

export type AuthUser = {
  id: number;
  role: string;
  username?: string | null;
  email?: string | null;
  login_id?: bigint | null;
  tokenVersion?: number | null;
};

export class AuthService {
  static generateTokens(user: AuthUser) {
    const secret = process.env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        email: user.email,
        login_id: user.login_id,
      },
      env.JWT_SECRET,
      { expiresIn: env.NODE_ENV === "development" ? "1m" : "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user.id, role: user.role, version: user.tokenVersion || 0 },
      secret,
      { expiresIn: "7d" },
    );
    return { accessToken, refreshToken };
  }

  static sendRefreshToken(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      partitioned: isProduction,
    });
  }

  static clearRefreshToken(res: Response) {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain = isProduction ? process.env.DOMAIN : undefined;

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      domain: cookieDomain,
      partitioned: isProduction,
    });
  }
}
