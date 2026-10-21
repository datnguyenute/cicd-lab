import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Request } from 'express';

export interface AuthUser {
  uid: string;
  email?: string;
}

export type AuthedRequest = Request & { user?: AuthUser };

// Chỉ cần projectId để verify ID token (Admin SDK tự tải public key của Google).
// Trên Cloud Run, credential lấy tự động từ service account gắn vào service (ADC).
function firebaseApp() {
  return getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // Chế độ local/docker-compose: bỏ qua Firebase để học nhanh
    if (process.env.AUTH_DISABLED === 'true') {
      req.user = { uid: 'local-dev-user', email: 'dev@local' };
      return true;
    }

    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const decoded = await getAuth(firebaseApp()).verifyIdToken(token);
      req.user = { uid: decoded.uid, email: decoded.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
