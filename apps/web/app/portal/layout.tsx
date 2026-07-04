import type { Metadata } from "next";
import Link from "next/link";
import { Crest } from "@/components/portal/Crest";
import { getSessionUser } from "@/lib/portal/auth";
import { logoutAction } from "@/lib/portal/actions";

export const metadata: Metadata = {
  title: "TradeGate — Customs Declaration Management System",
  description: "Federal Customs & Border Authority — declaration management for authorised brokers.",
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="portal-root min-h-screen flex flex-col">
      {/* Official top strip */}
      <div className="bg-gov-navy-dark text-white text-[13px]">
        <div className="mx-auto max-w-[1100px] px-4 py-1.5 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3.5 w-5 border border-white/40 bg-gov-red relative">
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-white" />
              <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] bg-white" />
            </span>
            An official service of the Federal Customs &amp; Border Authority
          </span>
          <span className="uppercase tracking-wider text-white/70 font-semibold text-[11px]">
            Training environment
          </span>
        </div>
      </div>

      {/* Masthead */}
      <header className="bg-gov-navy text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-4 flex items-center justify-between gap-6">
          <Link href="/portal/cases" className="flex items-center gap-3 no-underline text-white">
            <Crest size={46} className="text-white shrink-0" />
            <span>
              <span className="block text-[21px] font-bold leading-tight tracking-tight">
                TradeGate
              </span>
              <span className="block text-[13px] text-white/75 leading-tight">
                Customs Declaration Management System
              </span>
            </span>
          </Link>
          {user ? (
            <div className="flex items-center gap-4 text-[14px]">
              <span className="text-white/85 text-right leading-tight">
                <span className="block font-semibold">{user.displayName}</span>
                <span className="block text-white/60 text-[12.5px]">{user.brokerFirm}</span>
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  data-testid="portal-sign-out"
                  className="underline text-white/90 hover:text-white cursor-pointer bg-transparent border-0 text-[14px] p-1"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <span className="text-[13px] text-white/70">Restricted access — authorised users only</span>
          )}
        </div>
        {/* service navigation */}
        <nav className="border-t border-white/20 bg-[rgba(255,255,255,0.04)]">
          <div className="mx-auto max-w-[1100px] px-4 flex gap-1 text-[14.5px] font-semibold">
            <Link
              href="/portal/cases"
              className="px-3 py-2.5 text-white no-underline border-b-[3px] border-white"
            >
              Declarations
            </Link>
            <span className="px-3 py-2.5 text-white/50 cursor-not-allowed border-b-[3px] border-transparent">
              Tariff lookup
            </span>
            <span className="px-3 py-2.5 text-white/50 cursor-not-allowed border-b-[3px] border-transparent">
              Payments
            </span>
            <span className="px-3 py-2.5 text-white/50 cursor-not-allowed border-b-[3px] border-transparent">
              Reports
            </span>
            <span className="px-3 py-2.5 text-white/50 cursor-not-allowed border-b-[3px] border-transparent">
              Help &amp; contact
            </span>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-4 py-8 w-full">{children}</div>
      </main>

      {/* Official footer */}
      <footer className="mt-10 border-t-[6px] border-gov-navy bg-gov-grey">
        <div className="mx-auto max-w-[1100px] px-4 py-8 text-[14px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <h3 className="font-bold mb-2 text-[15px]">Services</h3>
              <ul className="space-y-1.5 list-none p-0 m-0">
                <li><a className="gov-link" href="#">Declaration lodgement</a></li>
                <li><a className="gov-link" href="#">Tariff &amp; duty calculator</a></li>
                <li><a className="gov-link" href="#">Broker registration</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2 text-[15px]">Guidance</h3>
              <ul className="space-y-1.5 list-none p-0 m-0">
                <li><a className="gov-link" href="#">Valuation rules</a></li>
                <li><a className="gov-link" href="#">Origin &amp; preferences</a></li>
                <li><a className="gov-link" href="#">Prohibited goods</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2 text-[15px]">Legal</h3>
              <ul className="space-y-1.5 list-none p-0 m-0">
                <li><a className="gov-link" href="#">Legal notices</a></li>
                <li><a className="gov-link" href="#">Data protection</a></li>
                <li><a className="gov-link" href="#">Accessibility statement</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2 text-[15px]">About</h3>
              <ul className="space-y-1.5 list-none p-0 m-0">
                <li><a className="gov-link" href="#">The Authority</a></li>
                <li><a className="gov-link" href="#">Statistics &amp; open data</a></li>
                <li><a className="gov-link" href="#">Careers</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-gov-border flex items-center justify-between gap-4 text-gov-muted">
            <span className="flex items-center gap-2.5">
              <Crest size={30} className="text-gov-navy" />
              <span>© 2026 Federal Customs &amp; Border Authority</span>
            </span>
            <span>
              All content is available under the Open Government Licence v3.0, except where otherwise stated.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
