import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// NEXT_PUBLIC_* được "nướng" (inline) vào JS lúc `next build`
// → mỗi môi trường (dev/test/prod) phải build image FE riêng.
export const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

// Khởi tạo lười (lazy) để lúc build/prerender không cần config Firebase
export function firebaseAuth() {
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  return getAuth(app);
}

export function signInWithGoogle() {
  return signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
}

export function signOutUser() {
  return signOut(firebaseAuth());
}
