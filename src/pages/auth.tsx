import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, qs, useAuth, useTitle } from "../lib";
import { useAction } from "../ui/base";
import type { Session } from "../../shared/auth";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

// ---------- auth ----------
export function AuthPage({ mode }: { mode: "login" | "join" }) {
  const { me, setMe } = useAuth(), nav = useNavigate(), [sp] = useSearchParams(), next = safeNext(sp.get("next"));
  const [f, setF] = useState({ username: "", email: "", password: "" }), act = useAction();
  useTitle(mode === "login" ? "Log in" : "Join");
  if (me) return <Navigate to={next} replace />;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => { e.preventDefault(); act.run(async () => { const r = await api<Session>(`/auth/${mode === "login" ? "login" : "signup"}`, { body: f }); setMe(r.user); nav(next); }); };
  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{mode === "login" ? "Log in" : "Join Sonosphere"}</h1>
      <form className="form card" onSubmit={submit}>
        <label>{mode === "login" ? "Username or email" : "Username"}<Input value={f.username} onChange={set("username")} autoComplete="username" required autoFocus maxLength={mode === "login" ? 200 : 15} /></label>
        {mode === "join" && <label>Email<Input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>}
        <label>Password<Input type="password" value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "join" ? 8 : undefined} /></label>
        {act.note}
        <Button kind="btn" loading={act.busy}>{mode === "login" ? "Log in" : "Create account"}</Button>
      </form>
      {mode === "login"
        ? <><p>New here? <Link to={`/join${qs({ next: sp.get("next") })}`}>Create an account</Link>.</p></>
        : <p>Already have an account? <Link to={`/login${qs({ next: sp.get("next") })}`}>Log in</Link>.</p>}
    </div>
  );
}
