import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Send USDT. They receive local money.</h1>
        <p className="text-slate-600">
          You send USDT from your own wallet. Your recipient verifies with our regulated off-ramp partner (MoonPay),
          adds an eligible Visa debit card where supported, and receives fiat.
        </p>
        <Link href="/login" className="btn-primary w-full sm:w-auto">
          Get started
        </Link>
      </section>
      <section className="card text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-900">How AvicPay works</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>You enter the recipient and amount, and see a live quote from the payout partner.</li>
          <li>Your recipient opens their link, completes identity verification and chooses a payout card.</li>
          <li>The partner issues a one-time deposit address for that order. You send the exact USDT to it.</li>
          <li>The partner converts and pays out. You track every step here.</li>
        </ol>
        <p className="mt-3">AvicPay never holds your funds and never converts crypto itself.</p>
      </section>
    </div>
  );
}
