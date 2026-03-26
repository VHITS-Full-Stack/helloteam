import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Button, Input, Card } from "../../components/common";
import { useAuth } from "../../context/AuthContext";

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState("");

  const validateEmail = () => {
    if (!email) {
      setValidationError("Email is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationError("Please enter a valid email address");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(
          result.error || "Failed to send reset email. Please try again.",
        );
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full opacity-50 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-100 rounded-full opacity-50 blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <Card className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Check Your Email
            </h2>
            <p className="text-gray-600 mb-6">
              If an account exists with <strong>{email}</strong>, we've sent a
              password reset link. Please check your inbox and spam folder.
            </p>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
              >
                Send Another Link
              </Button>
             <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-primary hover:text-primary-dark font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Link>
          </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-100 rounded-full opacity-50 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block p-2 bg-white rounded-2xl shadow-lg mb-4">
            <img
              src="/logo.png"
              alt="Hello Team"
              className="h-14 w-auto"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">
            Forgot Password?
          </h1>
          <p className="text-gray-500 mt-1">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <Card className="animate-fade-in backdrop-blur-sm bg-white/95">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              icon={Mail}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setValidationError("");
                setError("");
              }}
              error={validationError}
              required
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-primary hover:text-primary-dark font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Link>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Powered by{" "}
          <span className="font-semibold text-primary">Hello Team</span> &copy;
          2025
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
