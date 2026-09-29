import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      const roles = result?.data?.roles || [];
      navigate(roles.includes("admin") ? "/admin/dashboard" : "/app/dashboard");
    } catch (requestError) {
      // The backend returns the same message for an unknown email and a bad
      // password, so this screen cannot be used to probe for accounts.
      setError(
        requestError.response?.data?.message ||
          "We could not sign you in. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to find a seat, share your route, or manage your journeys."
    >
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Input
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <div className="grid gap-2">
          <Input
            id="login-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            containerClassName="gap-1"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
                className="size-4 rounded accent-leaf"
              />
              Show password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-leaf hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          loadingText="Signing in…"
        >
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
