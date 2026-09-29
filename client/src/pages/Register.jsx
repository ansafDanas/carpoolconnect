import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, Users } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { cn } from "../lib/utils";

const ROLE_OPTIONS = [
  {
    value: "passenger",
    title: "As a passenger",
    hint: "Find a seat on someone's route",
    icon: Users,
  },
  {
    value: "driver",
    title: "As a driver",
    hint: "Share your seats and split the fuel cost",
    icon: Car,
  },
];

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roles: ["passenger"],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // One account can be a driver, a passenger, or both at the same time. The
  // roles are additive and can be changed later from the profile.
  const toggleRole = (role) => {
    setFormData((current) => {
      const nextRoles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role];

      return { ...current, roles: nextRoles.length ? nextRoles : [role] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(formData);
      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join a carpool community built around shared journeys and honest fuel costs."
    >
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Input
          id="register-name"
          label="Name"
          value={formData.name}
          onChange={(event) =>
            setFormData({ ...formData, name: event.target.value })
          }
          placeholder="How should we introduce you?"
          autoComplete="name"
          minLength={2}
          maxLength={50}
          required
        />

        <Input
          id="register-email"
          label="Email"
          type="email"
          value={formData.email}
          onChange={(event) =>
            setFormData({ ...formData, email: event.target.value })
          }
          placeholder="you@example.com"
          autoComplete="email"
          required
        />


        <div className="grid gap-2">
          <Input
            id="register-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={(event) =>
              setFormData({ ...formData, password: event.target.value })
            }
            helperText="At least 6 characters."
            autoComplete="new-password"
            minLength={6}
            required
            containerClassName="gap-1"
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
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            How will you use CarpoolConnect?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map((option) => {
              const selected = formData.roles.includes(option.value);
              const Icon = option.icon;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                    selected
                      ? "border-leaf bg-leaf-soft"
                      : "border-border bg-surface hover:border-leaf/40"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-leaf"
                    checked={selected}
                    onChange={() => toggleRole(option.value)}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Icon className="size-4 text-leaf" aria-hidden="true" />
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                      {option.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-text-muted">
            Pick both if you sometimes drive and sometimes need a ride. You can change
            this any time from your profile.
          </p>
        </fieldset>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          loadingText="Creating your account…"
        >
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
