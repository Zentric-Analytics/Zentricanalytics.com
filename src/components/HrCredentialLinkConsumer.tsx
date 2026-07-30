"use client";

import { useEffect, useState } from "react";

export function HrCredentialLinkConsumer({ endpoint, destination }: { endpoint: string; destination: string }) {
  const [message, setMessage] = useState("Validating your secure one-time link…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    history.replaceState(null, "", window.location.pathname);
    if (!token || token.length > 256) {
      setMessage("This secure link is invalid.");
      return;
    }
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "same-origin",
    }).then((response) => {
      if (!response.ok) throw new Error("invalid");
      window.location.replace(destination);
    }).catch(() => setMessage("This secure link is invalid or expired."));
  }, [destination, endpoint]);

  return <p role="status" className="text-sm text-slate-700">{message}</p>;
}
