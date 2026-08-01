import { HrCredentialLinkConsumer } from "@/components/HrCredentialLinkConsumer";

export default function RedeemPasswordResetPage() {
  return <main className="min-h-screen bg-slate-100 px-4 py-16"><section className="mx-auto max-w-md rounded-3xl bg-white p-7"><h1 className="text-2xl font-bold">Secure password reset</h1><div className="mt-4"><HrCredentialLinkConsumer endpoint="/hr/password-reset/consume" destination="/hr/password-reset" /></div></section></main>;
}
