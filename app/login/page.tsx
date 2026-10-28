import { Suspense } from "react";
import LoginForm from "../../components/auth/LoginForm";

function LoginFormLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D8D4CB] border-t-[#173F35]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f0e4] px-4 py-10">
      <Suspense fallback={<LoginFormLoading />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}