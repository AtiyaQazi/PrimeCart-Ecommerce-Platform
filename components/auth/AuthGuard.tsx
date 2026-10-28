"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import { auth } from "../../lib/firebase";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        try {
          if (!user) {
            setAuthorized(false);
            setCheckingAuth(false);

            router.replace("/login");
            return;
          }

          /*
           * Refresh the user's Firebase information.
           * This updates emailVerified after the user
           * verifies their email.
           */
          await user.reload();

          const currentUser = auth.currentUser;

          if (!currentUser) {
            setAuthorized(false);
            setCheckingAuth(false);

            router.replace("/login");
            return;
          }

          /*
           * User exists but email is not verified.
           */
          if (!currentUser.emailVerified) {
            setAuthorized(false);
            setCheckingAuth(false);

            router.replace("/verify-email");
            return;
          }

          /*
           * User is authenticated and verified.
           */
          setAuthorized(true);
          setCheckingAuth(false);
        } catch (error: unknown) {
          console.error(
            "Authentication check failed:",
            error
          );

          setAuthorized(false);
          setCheckingAuth(false);

          /*
           * Only redirect if authentication
           * is actually no longer available.
           */
          if (!auth.currentUser) {
            router.replace("/login");
          }
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4EBDD]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#D8D4CB] border-t-[#173F35]" />

          <p className="mt-4 text-sm font-medium text-[#355E4B]">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}