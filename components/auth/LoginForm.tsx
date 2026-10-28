"use client";

import { FormEvent, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  Store,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verifiedMessage =
    searchParams.get("verified") === "true";

  const handleLogin = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const result =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const currentUser = result.user;

      /*
       * Make sure Firebase has the latest
       * verification status.
       */
      await currentUser.reload();

      if (!currentUser.emailVerified) {
        await signOut(auth);

        setError(
          "Please verify your email before accessing the dashboard."
        );

        return;
      }

      /*
       * Refresh the Firebase ID token so
       * Firestore rules can recognize the
       * verified email status.
       */
      await currentUser.getIdToken(true);

      /*
       * Create the customer document on the
       * first successful verified login.
       *
       * If the customer already exists,
       * update the basic information without
       * changing the original createdAt.
       */
      try {
        const customerRef = doc(
          db,
          "customers",
          currentUser.uid
        );

        const customerSnap =
          await getDoc(customerRef);

        if (!customerSnap.exists()) {
          await setDoc(customerRef, {
            name:
              currentUser.displayName ||
              "",
            email:
              currentUser.email ||
              email.trim(),
            status: "Active",
            createdAt: serverTimestamp(),
          });
        } else {
          const existingData =
            customerSnap.data();

          await setDoc(
            customerRef,
            {
              name:
                currentUser.displayName ||
                existingData.name ||
                "",
              email:
                currentUser.email ||
                email.trim(),
              status:
                existingData.status ||
                "Active",
            },
            { merge: true }
          );
        }
      } catch (firestoreError) {
        /*
         * Login itself was successful.
         * Log Firestore errors but don't block
         * the user from entering the dashboard.
         */
        console.error(
          "Customer profile sync failed:",
          firestoreError
        );
      }

      router.replace("/");
    } catch (error: unknown) {
      console.error("Login error:", error);

      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? (error as { code: string }).code
          : "";

      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"
      ) {
        setError(
          "Invalid email or password."
        );
      } else if (
        code === "auth/invalid-email"
      ) {
        setError(
          "Please enter a valid email address."
        );
      } else if (
        code === "auth/too-many-requests"
      ) {
        setError(
          "Too many login attempts. Please wait a while and try again."
        );
      } else if (
        code === "auth/network-request-failed"
      ) {
        setError(
          "Network error. Please check your internet connection."
        );
      } else {
        setError(
          "Unable to sign in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f4f3e] text-[#f3eadb] shadow-lg">
          <Store size={25} />
        </div>

        <h1 className="mt-5 text-3xl font-bold text-[#2f4f3e]">
          Welcome Back
        </h1>

        <p className="mt-2 text-sm text-[#6c675f]">
          Sign in to your PrimeCart account
        </p>
      </div>

      <form
        onSubmit={handleLogin}
        className="space-y-5 rounded-3xl border border-[#ded4c3] bg-[#fbf8f2] p-7 shadow-xl"
      >
        {verifiedMessage && (
          <div className="rounded-xl bg-[#e5f1e8] px-4 py-3 text-sm text-[#2f4f3e]">
            Email verified successfully. You can
            now sign in.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-[#f8e2de] px-4 py-3 text-sm text-[#8a3930]">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="mb-2 block text-sm font-semibold text-[#171717]"
          >
            Email Address
          </label>

          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Enter your email"
            disabled={loading}
            autoComplete="email"
            className="h-12 w-full rounded-xl border border-[#d8cdbb] bg-white px-4 text-sm text-[#171717] outline-none placeholder:text-[#9b958b] focus:border-[#2f4f3e] focus:ring-2 focus:ring-[#2f4f3e]/10 disabled:cursor-not-allowed disabled:bg-[#f3f0eb]"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-sm font-semibold text-[#171717]"
            >
              Password
            </label>

            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#2f4f3e] hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="relative">
            <input
              id="login-password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              disabled={loading}
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-[#d8cdbb] bg-white px-4 pr-12 text-sm text-[#171717] outline-none placeholder:text-[#9b958b] focus:border-[#2f4f3e] focus:ring-2 focus:ring-[#2f4f3e]/10 disabled:cursor-not-allowed disabled:bg-[#f3f0eb]"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              disabled={loading}
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6c675f] transition hover:text-[#2f4f3e] disabled:opacity-50"
            >
              {showPassword ? (
                <EyeOff size={19} />
              ) : (
                <Eye size={19} />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f4f3e] font-bold text-white transition hover:bg-[#243e31] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <Loader2
              size={18}
              className="animate-spin"
            />
          )}

          {loading
            ? "Signing In..."
            : "Sign In"}
        </button>

        <p className="text-center text-sm text-[#6c675f]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-bold text-[#2f4f3e] hover:underline"
          >
            Create Account
          </Link>
        </p>
      </form>
    </div>
  );
}