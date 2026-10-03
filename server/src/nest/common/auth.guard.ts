import { CanActivate, ExecutionContext, Injectable, mixin } from '@nestjs/common';
import AuthMiddleware from '@/middlewares/auth.middleware.js';

/** `@UseGuards(Auth('admin'))` — reuses the legacy auth middleware, so roles/tenant checks stay in one place. */
export const Auth = (...roles: string[]) => {
  const authenticate = AuthMiddleware.authenticate(roles);

  @Injectable()
  class AuthGuard implements CanActivate {
    canActivate(ctx: ExecutionContext) {
      const http = ctx.switchToHttp();
      return new Promise<boolean>((resolve, reject) => {
        authenticate(http.getRequest(), http.getResponse(), (err?: unknown) =>
          err ? reject(err) : resolve(true),
        );
      });
    }
  }
  return mixin(AuthGuard);
};
