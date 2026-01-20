"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { COLORS } from "shared/styles/theme";
import UserNumberDisplay from "../../../components/UserNumberDisplay";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userNumber, setUserNumber] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Use the same fallback logic as auth.ts for consistency
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 
                      process.env.NEXT_PUBLIC_API_URL || 
                      (isDevelopment ? 'http://localhost:5000' : 'https://vssyl-server-235369681725.us-central1.run.app');
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      const responseData = await res.json();
      setUserNumber(responseData.user.userNumber);
      setSuccess(true);

      // After successful registration, sign in the user
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError(result.error || "Login failed after registration");
      } else if (result?.ok) {
        // Don't redirect immediately, show success message first
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full space-y-6 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: COLORS.neutralDark }}>
            Welcome to Vssyl!
          </h2>
          <p className="text-gray-600 mb-6">
            Your account has been created successfully. Here's your unique Vssyl ID:
          </p>
          
          {userNumber && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <UserNumberDisplay userNumber={userNumber} />
            </div>
          )}
          
          <p className="text-sm text-gray-500 mb-4">
            You'll be redirected to your dashboard in a few seconds...
          </p>
          
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Go to Dashboard Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full space-y-6"
      style={{ '--focus-ring-color': COLORS.infoBlue } as React.CSSProperties}
    >
      <div>
        <h2 className="text-center text-2xl font-extrabold mb-1" style={{ color: COLORS.neutralDark }}>
          Create your account
        </h2>
        <p className="text-center text-sm text-gray-600 mt-2">
          You'll receive a unique Vssyl ID for identification
        </p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-lg shadow-sm space-y-4">
          <div>
            <label htmlFor="name" className="block text-base font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="appearance-none rounded-md block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[${COLORS.infoBlue}] focus:border-[${COLORS.infoBlue}] text-base"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-base font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-md block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[${COLORS.infoBlue}] focus:border-[${COLORS.infoBlue}] text-base"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="appearance-none rounded-md block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[${COLORS.infoBlue}] focus:border-[${COLORS.infoBlue}] text-base"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm text-center font-semibold mt-1">{error}</div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-bold rounded-lg text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[${COLORS.infoBlue}] disabled:opacity-50 transition-all"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
} 