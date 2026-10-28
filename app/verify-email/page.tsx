"use client";

import { useEffect, useState } from "react";
import {
  reload,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import {
  MailCheck,
  Loader2,
  ArrowLeft,
} from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setEmail(auth.currentUser.email ?? "");
    }
  }, []);

  const checkVerification = async () => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await reload(auth.currentUser);

      if (auth.currentUser.emailVerified) {
        await signOut(auth);
        router.replace("/login?verified=true");
      } else {
        setMessage(
          "Your email is not verified yet. Please check your Gmail inbox."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (!auth.currentUser) {
      setMessage(
        "Your session has expired. Please go back to login."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await sendEmailVerification(auth.currentUser);

      setMessage("Verification email sent again.");
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to resend verification email."
      );
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (error) {
      console.error(error);
    } finally {
      router.replace("/login");
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f6f0e4] px-4 py-10">

      
      
      {/* =====================================================
          VERIFY CARD
      ===================================================== */}

      <div className="w-full max-w-md rounded-3xl border border-[#ded4c3] bg-[#fbf8f2] p-8 text-center shadow-xl">

        {/* Icon */}

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2f4f3e] text-[#f3eadb]">
          <MailCheck size={30} />
        </div>

        {/* Heading */}

        <h1 className="mt-6 text-2xl font-bold text-[#2f4f3e]">
          Verify Your Email
        </h1>

        {/* Description */}

        <p className="mt-3 text-sm leading-6 text-[#6c675f]">
          We sent a verification email to:
        </p>

        {/* Email */}

        <p className="mt-2 break-all font-semibold text-[#171717]">
          {email || "your email address"}
        </p>

        <p className="mt-4 text-sm leading-6 text-[#6c675f]">
          Open your Gmail, click the verification link,
          then come back here and click the button below.
        </p>

        {/* Message */}

        {message && (
          <div className="mt-5 rounded-xl bg-[#f3eadb] px-4 py-3 text-sm leading-5 text-[#2f4f3e]">
            {message}
          </div>
        )}

        {/* =====================================================
            CHECK VERIFICATION
        ===================================================== */}

        <button
          type="button"
          onClick={checkVerification}
          disabled={loading}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f4f3e] font-bold text-white transition hover:bg-[#243e31] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <Loader2
              size={18}
              className="animate-spin"
            />
          )}

          I Have Verified My Email
        </button>

        {/* =====================================================
            RESEND EMAIL
        ===================================================== */}

        <button
          type="button"
          onClick={resendEmail}
          disabled={loading}
          className="mt-3 w-full rounded-xl border border-[#2f4f3e] py-3 text-sm font-semibold text-[#2f4f3e] transition hover:bg-[#f3eadb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Resend Verification Email
        </button>

        {/* =====================================================
            SIGN UP
        ===================================================== */}

        <p className="mt-6 text-sm text-[#6c675f]">
          Want to create a different account?
        </p>

        <button
          type="button"
          onClick={async () => {
            await goToLogin();
          }}
          className="mt-2 text-sm font-bold text-[#2f4f3e] hover:underline"
        >
          Go to Login / Sign Up
        </button>

      </div>
    </main>
  );
}