/* eslint-disable @next/next/no-img-element */

/** Triangle mark + "Avec Pay" wordmark, for use on the dark brand background. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src="/brand/avecpay-mark.png" alt="" width={size} height={size} />
      <span className="whitespace-nowrap text-xl font-black italic tracking-tight text-white">Avec Pay</span>
    </span>
  );
}

/** Full square logo (mark + wordmark on navy), as supplied. */
export function LogoFull({ size = 160 }: { size?: number }) {
  return <img src="/brand/avecpay-logo.jpg" alt="Avec Pay" width={size} height={size} className="rounded-2xl" />;
}
