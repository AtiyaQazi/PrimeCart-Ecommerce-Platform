"use client";

import { Suspense, useEffect, useState } from "react";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { useSearchParams } from "next/navigation";

import { auth } from "../../lib/firebase";

function ResetPasswordForm() {
  const searchParams = useSearchParams();

  const [oobCode, setOobCode] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get("oobCode");

    if (!code) {
      setError("Invalid or missing password reset link.");
      setLoading(false);
      return;
    }

    setOobCode(code);

    const checkCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, code);
        setEmail(userEmail);
      } catch (err: any) {
        console.error(err);

        if (err.code === "auth/expired-action-code") {
          setError("This password reset link has expired.");
        } else if (err.code === "auth/invalid-action-code") {
          setError("This password reset link is invalid or has already been used.");
        } else {
          setError("Unable to verify this password reset link.");
        }
      } finally {
        setLoading(false);
      }
    };

    checkCode();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!oobCode) {
      setError("Invalid password reset link.");
      return;
    }

    try {
      setSaving(true);

      await confirmPasswordReset(auth, oobCode, password);

      setSuccess(true);
      setMessage(
        "Your password has been changed successfully. You can now sign in with your new password."
      );
    } catch (err: any) {
      console.error(err);

      if (err.code === "auth/expired-action-code") {
        setError("This password reset link has expired.");
      } else if (err.code === "auth/invalid-action-code") {
        setError("This password reset link is invalid or has already been used.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak.");
      } else {
        setError("Unable to change your password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4EBDD] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173F35] text-2xl font-bold text-[#F4EBDD]">
            S
          </div>

          <div className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-4 border-[#D8D0C2] border-t-[#173F35]" />

          <p className="mt-4 text-sm text-[#646B66]">
            Verifying reset link...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4EBDD] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173F35] text-2xl font-bold text-[#F4EBDD]">
            S
          </div>

          <h1 className="mt-6 text-3xl font-bold text-[#111111]">
            Reset password
          </h1>

          {email && !error && (
            <p className="mt-2 text-sm text-[#737873]">
              Create a new password for{" "}
              <span className="font-semibold text-[#355E4B]">
                {email}
              </span>
            </p>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-[#B8D1C7] bg-[#EDF6F1] px-4 py-3 text-sm leading-6 text-[#285746]">
            {message}
          </div>
        )}

        {!error && !success && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-semibold text-[#222222]"
              >
                New password
              </label>

              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-semibold text-[#222222]"
              >
                Confirm new password
              </label>

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#173F35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#285746] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Changing password..." : "Change password"}
            </button>
          </form>
        )}

        {success && (
          <a
            href="/"
            className="mt-6 block w-full rounded-xl bg-[#173F35] px-5 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-[#285746]"
          >
            Back to login
          </a>
        )}

        {error && (
          <a
            href="/"
            className="mt-6 block w-full rounded-xl border border-[#D8D4CB] px-5 py-3.5 text-center text-sm font-semibold text-[#173F35] transition hover:bg-[#F8F4EC]"
          >
            Back to login
          </a>
        )}
      </div>
    </main>
  );
}

function ResetPasswordLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4EBDD] px-4">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#D8D0C2] border-t-[#173F35]" />

        <p className="mt-4 text-sm text-[#646B66]">
          Loading...
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}