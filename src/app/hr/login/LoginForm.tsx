"use client";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { hrLoginAction } from "./actions";

export function LoginForm() { const [visible, setVisible] = useState(false); return <form action={hrLoginAction} className="hr-login-form">
  <label>Work email<span><Mail /><input name="email" type="email" autoComplete="username" placeholder="Enter your work email" required /></span></label>
  <label>Password<span><LockKeyhole /><input name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff /> : <Eye />}</button></span></label>
  <div className="hr-login-options"><label><input type="checkbox" name="remember" /> Remember me</label><a href="/hr/password-reset">Forgot password?</a></div>
  <button className="hr-auth-submit"><LockKeyhole />Continue</button>
</form>; }
