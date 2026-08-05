"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect password.");
        setBusy(false);
        return;
      }
      router.push(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f4ee" }}>
      <form onSubmit={submit} className="card" style={{ width: 360 }}>
        <div className="eyebrow">Fort Crazypants</div>
        <h1 className="title" style={{ fontSize: 24 }}>
          Merch Manager
        </h1>
        <p className="muted">Enter the shared password to continue.</p>
        <div className="field full" style={{ marginTop: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="status">{error}</div>}
        <button className="primary" type="submit" disabled={busy} style={{ marginTop: 14, width: "100%" }}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
