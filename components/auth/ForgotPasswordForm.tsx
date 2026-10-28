"use client";

import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(auth, email.trim());

      setMessage(
        "Password reset email sent. Please check your Gmail inbox."
      );
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? (error as { code: string }).code
          : "";

      if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/user-not-found") {
        setError("No account was found with this email.");
      } else {
        setError("Unable to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f4f3e] text-[#f3eadb]">
          <Mail size={25} />
        </div>

        <h1 className="mt-5 text-3xl font-bold text-[#2f4f3e]">
          Reset Password
        </h1>

        <p className="mt-2 text-sm text-[#6c675f]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form
        onSubmit={handleReset}
        className="space-y-5 rounded-3xl border border-[#ded4c3] bg-[#fbf8f2] p-7 shadow-xl"
      >
        {error && (
          <div className="rounded-xl bg-[#f8e2de] px-4 py-3 text-sm text-[#8a3930]">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-[#e0eadf] px-4 py-3 text-sm text-[#2f4f3e]">
            {message}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#171717]">
            Email Address
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={loading}
            className="h-12 w-full rounded-xl border border-[#d8cdbb] bg-white px-4 text-sm text-[#171717] outline-none placeholder:text-[#9b958b] focus:border-[#2f4f3e]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f4f3e] font-bold text-white hover:bg-[#243e31] disabled:opacity-60"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm font-semibold text-[#2f4f3e]"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </form>
    </div>
  );
}