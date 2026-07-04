import { redirect } from "next/navigation";
import { loginAction } from "@/lib/portal/actions";
import { getSessionUser } from "@/lib/portal/auth";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/portal/cases");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-[480px]">
      <h1 className="text-[32px] font-bold leading-tight mb-2">Sign in to TradeGate</h1>
      <p className="text-gov-muted mb-6 text-[15.5px]">
        Declaration management for authorised customs brokers, importers and their
        representatives.
      </p>

      {error ? (
        <div
          className="gov-notice-warning mb-6"
          role="alert"
          aria-live="polite"
          data-testid="login-error"
        >
          <h2 className="font-bold text-[17px] mb-1 text-gov-red">There is a problem</h2>
          <p className="m-0">
            The username or password you entered is not recognised. Check your credentials
            and try again.
          </p>
        </div>
      ) : null}

      <div className="gov-panel p-6">
        <form action={loginAction} className="space-y-5">
          <div>
            <label className="gov-label" htmlFor="username">
              Username
            </label>
            <span className="gov-hint">As issued by the Authority, e.g. j.smith</span>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="gov-input"
              data-testid="portal-username"
            />
          </div>
          <div>
            <label className="gov-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="gov-input"
              data-testid="portal-password"
            />
          </div>
          <button type="submit" className="gov-btn w-full" data-testid="portal-sign-in">
            Sign in
          </button>
        </form>
        <p className="mt-4 mb-0 text-[14px]">
          <a href="#" className="gov-link">
            Forgotten your password?
          </a>
        </p>
      </div>

      <div className="mt-6 border-l-[6px] border-gov-navy bg-white border border-gov-border p-4 text-[13.5px] leading-relaxed text-gov-muted">
        <strong className="block text-gov-ink mb-1">Restricted government system</strong>
        You are accessing a restricted information system operated by the Federal Customs
        &amp; Border Authority. Unauthorised access or use is prohibited and may result in
        prosecution. Activity on this system is logged and may be monitored. This is a
        training environment — use your issued training credentials.
      </div>
    </div>
  );
}
