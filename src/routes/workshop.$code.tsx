import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  generateCertificate,
  getWorkshopByCode,
  downloadCertificate,
} from "#/server/functions/certificates";

export const Route = createFileRoute("/workshop/$code")({
  loader: async ({ params }) => {
    const workshop = await getWorkshopByCode({ data: { code: params.code } });
    return { workshop };
  },
  component: WorkshopPage,
});

function WorkshopPage() {
  const { workshop } = Route.useLoaderData();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    certId: string;
    downloadUrl: string;
    remainingAttempts: number;
  } | null>(null);
  const [error, setError] = useState("");

  if (!workshop) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-10 text-center max-w-md animate-scale-in">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Workshop Not Found
          </h2>
          <p className="text-gray-500 mb-6">
            The workshop code you entered is invalid or the workshop is no
            longer active.
          </p>
          <Link to="/" className="btn-primary">
            ← Try Again
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);
    setError("");

    try {
      const res = await generateCertificate({
        data: {
          name: name.trim(),
          email: email.trim(),
          workshopCode: workshop.code,
        },
      });
      setResult(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const res = await downloadCertificate({ data: { id: result.certId } });
      const byteChars = atob(res.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download certificate");
    }
  };

  // Success state
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="success-card max-w-md w-full animate-scale-in">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            Certificate Generated!
          </h2>
          <p className="text-green-700 mb-6">
            Your certificate for <strong>{workshop.title}</strong> has been
            created and emailed to <strong>{email}</strong>.
          </p>
          <button type="button" onClick={handleDownload} className="btn-primary mb-4">
            ⬇ Download Certificate (PDF)
          </button>
          {result.remainingAttempts > 0 && (
            <p className="text-sm text-green-600 mt-4">
              You have{" "}
              <strong>{result.remainingAttempts} attempt(s)</strong>{" "}
              remaining for this workshop.
            </p>
          )}
          {result.remainingAttempts === 0 && (
            <p className="text-sm text-amber-600 mt-4">
              ⚠️ No attempts remaining. This was your last certificate for this
              workshop.
            </p>
          )}
          <div className="mt-6">
            <Link to="/" className="text-sm text-green-600 hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link to="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            <span className="text-[#F5A623]">talent</span>
            <span className="text-[#D0021B]">e</span>
            <span className="text-[#F5A623]">ase</span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-lg animate-fade-in-up">
          {/* Workshop info */}
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 rounded-full bg-orange-50 text-[#D4900F] text-xs font-semibold tracking-wider uppercase mb-4">
              {workshop.code}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
              {workshop.title}
            </h1>
            <p className="text-gray-500 text-sm">{workshop.date}</p>
          </div>

          {/* Warning */}
          <div className="warning-banner mb-6">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div>
              <strong className="block text-sm">Important</strong>
              You can generate a maximum of <strong>2 certificates</strong> per
              email for this workshop. Please double-check your name and email
              carefully before submitting.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="glass-card rounded-2xl p-8">
              <div className="mb-5">
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="As it should appear on the certificate"
                  className="input-field"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>

              <div className="mb-6">
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-field"
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  The certificate PDF will be sent to this email.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || !name.trim() || !email.trim()}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Certificate"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Confirm Your Details
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please verify the information below. The certificate will be
              generated with these exact details.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="font-semibold text-gray-900">{name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Email</span>
                <span className="font-semibold text-gray-900">{email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Workshop</span>
                <span className="font-semibold text-gray-900">
                  {workshop.title}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setShowConfirm(false)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleConfirm}
              >
                Confirm & Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
