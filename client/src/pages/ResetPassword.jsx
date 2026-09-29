import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound } from "lucide-react";

import api from "../api/axios";
import { AuthLayout } from "../components/AuthLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

/**
 * Step two of password recovery: redeem the token and set a new password.
 *
 * A missing, expired, already-used or tampered token all surface the same
 * calm message with a way back to requesting a new link.
 */
function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const nextErrors = {};
    if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "The two passwords do not match";
    }

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        token,
        password,
        confirmPassword,
      });

      setDone(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not update your password. Please request a new link."
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="You can now sign in with your new password."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className="grid size-14 place-items-center rounded-2xl bg-success-soft text-leaf"
            aria-hidden="true"
          >
            <CheckCircle2 className="size-7" />
          </span>
          <p className="text-sm leading-6 text-text-muted">
            Your reset link has been closed and cannot be used again.
          </p>
        </div>

        <Button fullWidth size="lg" onClick={() => navigate("/login")}>
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you have not used before. You will sign in with it immediately."
    >
      {!token ? (
        <Alert tone="warning" title="This link is incomplete">
          Open the most recent reset link from your email, or{" "}
          <Link to="/forgot-password" className="font-semibold underline">
            request a new one
          </Link>
          .
        </Alert>
      ) : null}

      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Input
          id="reset-password"
          label="New password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          helperText="At least 6 characters."
          autoComplete="new-password"
          required
          disabled={!token}
        />

        <Input
          id="reset-confirm-password"
          label="Confirm new password"
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
          disabled={!token}
        />

        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
            className="size-4 rounded accent-leaf"
          />
          Show password
        </label>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          loadingText="Updating…"
          disabled={!token}
        >
          <KeyRound aria-hidden="true" />
          Update password
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default ResetPassword;
