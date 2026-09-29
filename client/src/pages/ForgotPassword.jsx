import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, MailCheck } from "lucide-react";

import api from "../api/axios";
import { AuthLayout } from "../components/AuthLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

/**
 * Step one of password recovery: ask for a link.
 *
 * The confirmation copy is deliberately identical whether or not the address
 * is registered, matching the backend so the screen cannot be used to work
 * out who has an account.
 */
function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", { email });

      setSubmitted(true);
      // The backend only returns a link outside production, so the flow is
      // testable locally without ever exposing a real token in production.
      setDevResetUrl(response.data?.devResetUrl || "");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not send a reset link. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle="If an account exists for that email, a reset link is on its way."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className="grid size-14 place-items-center rounded-2xl bg-success-soft text-leaf"
            aria-hidden="true"
          >
            <MailCheck className="size-7" />
          </span>
          <p className="text-sm leading-6 text-text-muted">
            The link expires in 60 minutes and can only be used once. If it does not
            arrive, check your spam folder or try again.
          </p>
        </div>

        {devResetUrl ? (
          <Alert tone="info" title="Development only">
            <p>SMTP is not configured, so the reset link is shown here:</p>
            <button
              type="button"
              className="mt-1 break-all text-left font-semibold underline"
              onClick={() => navigate(`/reset-password?token=${extractToken(devResetUrl)}`)}
            >
              {devResetUrl}
            </button>
          </Alert>
        ) : null}

        <Button variant="secondary" fullWidth asChild>
          <Link to="/login">
            <ArrowLeft aria-hidden="true" />
            Back to sign in
          </Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter the email you signed up with and we will send you a link to choose a new password."
    >
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Input
          id="forgot-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          loadingText="Sending link…"
        >
          Send reset link
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
        <Car className="size-4 text-leaf" aria-hidden="true" />
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

function extractToken(url) {
  try {
    return new URL(url).searchParams.get("token") || "";
  } catch {
    return "";
  }
}

export default ForgotPassword;
