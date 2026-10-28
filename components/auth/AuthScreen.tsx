"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";

import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth } from "../../lib/firebase";
import { db } from "../../lib/firestore";

type AuthMode = "login" | "signup" | "forgot" | "verify";

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  /* =====================================================
     SIGN UP
  ===================================================== */

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();

    clearMessages();

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      /* Create Firebase Authentication account */

      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      /* Save display name */

      await updateProfile(result.user, {
        displayName: name.trim(),
      });

      /* Create customer record */

      await setDoc(doc(db, "customers", result.user.uid), {
        name: name.trim(),
        email: email.trim(),
        status: "Active",
        createdAt: serverTimestamp(),
      });

      /* Send verification email */

      await sendEmailVerification(result.user, {
        url: window.location.origin,
        handleCodeInApp: false,
      });

      /* Sign out until email is verified */

      await signOut(auth);

      setMode("verify");

      setMessage(
        "Account created successfully. Please check your email and verify your account before signing in."
      );

      /* Clear password fields */

      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);

      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak.");
      } else if (err.code === "permission-denied") {
        setError(
          "Unable to save customer information. Please check Firestore permissions."
        );
      } else {
        setError(
          err.message || "Unable to create account."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LOGIN
  ===================================================== */

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    clearMessages();

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      /* Refresh Firebase user */

      await result.user.reload();

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError("Unable to authenticate your account.");
        return;
      }

      /* Check email verification */

      if (!currentUser.emailVerified) {
        await signOut(auth);

        setMode("verify");

        setError(
          "Your email is not verified yet. Please verify your email before signing in."
        );

        return;
      }

      /* Verified account */

      setMessage("Login successful.");

      /*
       * Small delay so Firebase auth state can update
       * before navigating to the protected dashboard.
       */

      setTimeout(() => {
        router.replace("/");
      }, 300);
    } catch (err: any) {
      console.error(err);

      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Too many attempts. Please try again later."
        );
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(
          err.message || "Unable to sign in."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     FORGOT PASSWORD
  ===================================================== */

  const handleForgotPassword = async (
    e: FormEvent
  ) => {
    e.preventDefault();

    clearMessages();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(
        auth,
        email.trim(),
        {
          url: window.location.origin,
          handleCodeInApp: false,
        }
      );

      setMessage(
        "Password reset email sent. Please check your inbox and follow the link to create a new password."
      );
    } catch (err: any) {
      console.error(err);

      if (err.code === "auth/user-not-found") {
        setError(
          "No account was found with this email."
        );
      } else if (err.code === "auth/invalid-email") {
        setError(
          "Please enter a valid email address."
        );
      } else {
        setError(
          err.message ||
            "Unable to send reset email."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     RESEND VERIFICATION
  ===================================================== */

  const resendVerification = async () => {
    clearMessages();

    try {
      setLoading(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError(
          "Please sign in first to resend the verification email."
        );
        return;
      }

      await sendEmailVerification(currentUser, {
        url: window.location.origin,
        handleCodeInApp: false,
      });

      await signOut(auth);

      setMessage(
        "A new verification email has been sent. Please check your inbox."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err.message ||
          "Unable to resend verification email."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LOGO
  ===================================================== */

  const renderLogo = () => (
    <div className="mb-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173F35] text-2xl font-bold text-[#F4EBDD] shadow-lg">
        S
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#111111]">
        PrimeCart
      </h1>

      <p className="mt-2 text-sm text-[#5D665F]">
        Manage your store with confidence
      </p>
    </div>
  );

  /* =====================================================
     MESSAGES
  ===================================================== */

  const renderMessages = () => (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-xl border border-[#B8D1C7] bg-[#EDF6F1] px-4 py-3 text-sm text-[#285746]">
          {message}
        </div>
      )}
    </>
  );

  /* =====================================================
     VERIFY EMAIL SCREEN
  ===================================================== */

  if (mode === "verify") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4EBDD] px-4 py-8">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl sm:p-10">

          {renderLogo()}

          <div className="text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF6F1] text-3xl">
              ✉
            </div>

            <h2 className="mt-6 text-2xl font-bold text-[#111111]">
              Verify your email
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#626862]">
              We&apos;ve sent a verification link to your email
              address. Please open the email and click the
              verification link.
            </p>

          </div>

          {renderMessages()}

          <button
            type="button"
            onClick={resendVerification}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-[#173F35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#285746] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Sending..."
              : "Resend verification email"}
          </button>

          <button
            type="button"
            onClick={() => {
              clearMessages();
              setMode("login");
              setPassword("");
            }}
            className="mt-3 w-full rounded-xl border border-[#D9D1C4] px-5 py-3.5 text-sm font-semibold text-[#173F35] transition hover:bg-[#F8F4EC]"
          >
            Back to login
          </button>

        </div>
      </main>
    );
  }

  /* =====================================================
     MAIN AUTH SCREEN
  ===================================================== */

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4EBDD] px-4 py-8">

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">

        {/* =================================================
            LEFT SIDE
        ================================================= */}

        <div className="hidden bg-[#173F35] p-12 text-white lg:flex lg:flex-col lg:justify-between">

          <div>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4EBDD] text-xl font-bold text-[#173F35]">
              S
            </div>

            <h2 className="mt-10 text-4xl font-bold leading-tight">
              Everything your store needs,

              <span className="block text-[#D9E8DD]">
                in one place.
              </span>
            </h2>

            <p className="mt-6 max-w-md text-sm leading-7 text-[#D9E8DD]">
              Manage products, orders, customers, inventory
              and sales from one powerful administration
              dashboard.
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">

            <p className="text-sm leading-6 text-[#E8F1EA]">
              Secure authentication powered by Firebase.
            </p>

          </div>

        </div>

        {/* =================================================
            RIGHT SIDE
        ================================================= */}

        <div className="p-7 sm:p-10 lg:p-12">

          {renderLogo()}

          {/* =================================================
              FORGOT PASSWORD
          ================================================= */}

          {mode === "forgot" ? (
            <>

              <div className="mb-7">

                <h2 className="text-2xl font-bold text-[#111111]">
                  Reset your password
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#686E69]">
                  Enter your email and we&apos;ll send you a
                  password reset link.
                </p>

              </div>

              {renderMessages()}

              <form
                onSubmit={handleForgotPassword}
                className="space-y-5"
              >

                <div>

                  <label
                    htmlFor="forgot-email"
                    className="mb-2 block text-sm font-semibold text-[#222222]"
                  >
                    Email address
                  </label>

                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="Enter your email"
                    className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                  />

                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#173F35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#285746] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Sending..."
                    : "Send reset link"}
                </button>

              </form>

              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode("login");
                }}
                className="mt-5 w-full text-center text-sm font-semibold text-[#355E4B] hover:underline"
              >
                Back to login
              </button>

            </>
          ) : (
            <>
              {renderMessages()}

              {/* =================================================
                  LOGIN / SIGNUP SWITCH
              ================================================= */}

              <div className="mb-7 flex rounded-xl bg-[#F5F1E9] p-1">

                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("login");
                  }}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-[#173F35] shadow-sm"
                      : "text-[#6D716D]"
                  }`}
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("signup");
                  }}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-white text-[#173F35] shadow-sm"
                      : "text-[#6D716D]"
                  }`}
                >
                  Sign up
                </button>

              </div>

              {/* =================================================
                  LOGIN FORM
              ================================================= */}

              {mode === "login" ? (
                <form
                  onSubmit={handleLogin}
                  className="space-y-5"
                >

                  <div>

                    <label
                      htmlFor="login-email"
                      className="mb-2 block text-sm font-semibold text-[#222222]"
                    >
                      Email address
                    </label>

                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      placeholder="Enter your email"
                      className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />

                  </div>

                  <div>

                    <div className="mb-2 flex items-center justify-between">

                      <label
                        htmlFor="login-password"
                        className="text-sm font-semibold text-[#222222]"
                      >
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          clearMessages();
                          setMode("forgot");
                        }}
                        className="text-xs font-semibold text-[#355E4B] hover:underline"
                      >
                        Forgot password?
                      </button>

                    </div>

                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />

                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#173F35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#285746] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Signing in..."
                      : "Sign in"}
                  </button>

                </form>
              ) : (

                /* =================================================
                   SIGNUP FORM
                ================================================= */

                <form
                  onSubmit={handleSignup}
                  className="space-y-5"
                >

                  <div>

                    <label
                      htmlFor="signup-name"
                      className="mb-2 block text-sm font-semibold text-[#222222]"
                    >
                      Full name
                    </label>

                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      placeholder="Enter your full name"
                      className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="signup-email"
                      className="mb-2 block text-sm font-semibold text-[#222222]"
                    >
                      Email address
                    </label>

                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      placeholder="Enter your email"
                      className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="signup-password"
                      className="mb-2 block text-sm font-semibold text-[#222222]"
                    >
                      Password
                    </label>

                    <input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Create a password"
                      className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="signup-confirm-password"
                      className="mb-2 block text-sm font-semibold text-[#222222]"
                    >
                      Confirm password
                    </label>

                    <input
                      id="signup-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(
                          e.target.value
                        )
                      }
                      placeholder="Confirm your password"
                      className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />

                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#173F35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#285746] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Creating account..."
                      : "Create account"}
                  </button>

                </form>
              )}
            </>
          )}

        </div>
      </div>
    </main>
  );
}