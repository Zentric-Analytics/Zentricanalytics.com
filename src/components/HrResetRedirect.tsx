"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function HrResetRedirect() { const router = useRouter(); useEffect(() => { const timer = window.setTimeout(() => router.replace("/hr/login"), 4000); return () => window.clearTimeout(timer); }, [router]); return <p className="sr-only" role="status">You will be redirected to sign in in approximately 4 seconds.</p>; }
