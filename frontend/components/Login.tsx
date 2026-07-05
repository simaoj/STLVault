import React, { useState } from "react";
import Icon from "./Icon";
import { api } from "../services/api";

interface LoginProps {
  onSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await api.login(username, password);
      onSuccess();
    } catch (err) {
      setError("Invalid username or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-dvh bg-background px-4">
      <div className="w-full max-w-sm bg-surface-container-high border border-outline-variant rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <span className="text-headline-md font-headline-md font-bold text-primary tracking-tight">
            STLVault
          </span>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
            Sign in to manage your library
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Username
            </label>
            <input
              autoFocus
              type="text"
              required
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error text-body-sm">
              <Icon name="error" className="text-sm" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !username || !password}
            className="w-full bg-primary-container text-on-primary-container rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
