"use client";
import { useRef, useState } from "react";
import { hrMfaAction } from "../actions";

export function OtpForm() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]); const refs = useRef<Array<HTMLInputElement | null>>([]);
  const update = (index: number, value: string) => { const digit = value.replace(/\D/g, "").slice(-1); const next = [...digits]; next[index] = digit; setDigits(next); if (digit && index < 5) refs.current[index + 1]?.focus(); };
  const paste = (event: React.ClipboardEvent) => { const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (code.length === 6) { event.preventDefault(); setDigits(code.split("")); refs.current[5]?.focus(); } };
  return <form action={hrMfaAction} className="hr-otp-form"><input type="hidden" name="code" value={digits.join("")} /><div className="hr-otp-boxes" onPaste={paste}>{digits.map((digit, index) => <input aria-label={`Authenticator digit ${index + 1}`} autoComplete={index === 0 ? "one-time-code" : "off"} inputMode="numeric" key={index} maxLength={1} onChange={event => update(index, event.target.value)} onKeyDown={event => { if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus(); }} ref={element => { refs.current[index] = element; }} value={digit} />)}</div><button className="hr-auth-submit" disabled={digits.some(digit => !digit)}>Verify code</button></form>;
}
