"use client";

import { FormEvent, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  Store,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");

    /* ------------------------------
       Validation
    ------------------------------ */

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      /* ------------------------------
         Create Firebase account
      ------------------------------ */

      const result =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      /* ------------------------------
         Save user's display name
      ------------------------------ */

      await updateProfile(result.user, {
        displayName: name.trim(),
      });

      /* ------------------------------
         Send verification email
      ------------------------------ */

      await sendEmailVerification(result.user);

      /*
       * IMPORTANT:
       * Do NOT sign out here.
       *
       * The Verify Email page needs the
       * authenticated Firebase user so
       * Resend Verification Email works.
       */

      router.replace("/verify-email");
    } catch (error: unknown) {
      console.error("Signup error:", error);

      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? (error as { code: string }).code
          : "";

      if (code === "auth/email-already-in-use") {
        setError(
          "An account already exists with this email."
        );
      } else if (code === "auth/invalid-email") {
        setError(
          "Please enter a valid email address."
        );
      } else if (code === "auth/weak-password") {
        setError(
          "Password is too weak. Use at least 6 characters."
        );
      } else if (
        code === "auth/network-request-failed"
      ) {
        setError(
          "Network error. Please check your internet connection."
        );
      } else {
        setError(
          "Unable to create account. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------
     Back to Login
  ------------------------------ */

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  return (
    <div className="w-full max-w-md">

      {/* Back Button */}

      <button
        type="button"
        onClick={handleBackToLogin}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#2f4f3e] transition hover:underline"
      >
        <ArrowLeft size={17} />
        Back to Login
      </button>

      {/* Header */}

      <div className="mb-7 text-center">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f4f3e] text-[#f3eadb] shadow-lg">
          <Store size={25} />
        </div>

        <h1 className="mt-5 text-3xl font-bold text-[#2f4f3e]">
          Create Account
        </h1>

        <p className="mt-2 text-sm text-[#6c675f]">
          Create your PrimeCart account
        </p>

      </div>

      {/* Signup Form */}

      <form
        onSubmit={handleSignup}
        className="space-y-5 rounded-3xl border border-[#ded4c3] bg-[#fbf8f2] p-7 shadow-xl"
      >

        {/* Error */}

        {error && (
          <div className="rounded-xl bg-[#f8e2de] px-4 py-3 text-sm leading-5 text-[#8a3930]">
            {error}
          </div>
        )}

        {/* Full Name */}

        <div>

          <label
            htmlFor="signup-name"
            className="mb-2 block text-sm font-semibold text-[#171717]"
          >
            Full Name
          </label>

          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="Enter your full name"
            disabled={loading}
            autoComplete="name"
            className="h-12 w-full rounded-xl border border-[#d8cdbb] bg-white px-4 text-sm text-[#171717] outline-none placeholder:text-[#9b958b] focus:border-[#2f4f3e] focus:ring-2 focus:ring-[#2f4f3e]/10 disabled:cursor-not-allowed disabled:bg-[#f3f0eb]"
          />

        </div>

        {/* Email */}

        <div>

          <label
            htmlFor="signup-email"
            className="mb-2 block text-sm font-semibold text-[#171717]"
          >
            Email Address
          </label>

          <input
            id="signup-email"
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

        {/* Password */}

        <div>

          <label
            htmlFor="signup-password"
            className="mb-2 block text-sm font-semibold text-[#171717]"
          >
            Password
          </label>

          <div className="relative">

            <input
              id="signup-password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Create a password"
              disabled={loading}
              autoComplete="new-password"
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

        {/* Confirm Password */}

        <div>

          <label
            htmlFor="signup-confirm-password"
            className="mb-2 block text-sm font-semibold text-[#171717]"
          >
            Confirm Password
          </label>

          <div className="relative">

            <input
              id="signup-confirm-password"
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              placeholder="Confirm your password"
              disabled={loading}
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-[#d8cdbb] bg-white px-4 pr-12 text-sm text-[#171717] outline-none placeholder:text-[#9b958b] focus:border-[#2f4f3e] focus:ring-2 focus:ring-[#2f4f3e]/10 disabled:cursor-not-allowed disabled:bg-[#f3f0eb]"
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
              disabled={loading}
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6c675f] transition hover:text-[#2f4f3e] disabled:opacity-50"
            >
              {showConfirmPassword ? (
                <EyeOff size={19} />
              ) : (
                <Eye size={19} />
              )}
            </button>

          </div>

        </div>

        {/* Submit */}

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f4f3e] text-sm font-bold text-white transition hover:bg-[#243e31] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2
                size={18}
                className="animate-spin"
              />
              Creating Account...
            </>
          ) : (
            "Create Account"
          )}
        </button>

        {/* Login */}

        <p className="text-center text-sm text-[#6c675f]">
          Already have an account?{" "}

          <Link
            href="/login"
            className="font-bold text-[#2f4f3e] hover:underline"
          >
            Sign in
          </Link>
        </p>

      </form>
    </div>
  );
}