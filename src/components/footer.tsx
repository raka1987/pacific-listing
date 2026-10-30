import Link from "next/link";
import { CATEGORIES, SITE } from "@/lib/constants";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-subtle pb-24 sm:mt-32 sm:pb-0">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-faint">
            The free, local marketplace for the Pacific. Buy, sell and find what you need — from Suva to Apia, Nuku‘alofa to
            Port Vila.
          </p>
        </div>
        <FooterCol title="Categories">
          {CATEGORIES.slice(0, 6).map((c) => (
            <FooterLink key={c.slug} href={`/category/${c.slug}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterCol>
        <FooterCol title="Pacific Listing">
          <FooterLink href="/about">About us</FooterLink>
          <FooterLink href="/notices">Notice board</FooterLink>
          <FooterLink href="/safety">Safety tips</FooterLink>
          <FooterLink href="/advertise">Advertise with us</FooterLink>
          <FooterLink href="/business">Business accounts</FooterLink>
          <FooterLink href="/contact">Contact &amp; feedback</FooterLink>
        </FooterCol>
        <FooterCol title="Legal">
          <FooterLink href="/terms">Terms of service</FooterLink>
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Pacific Listing. All rights reserved.</p>
          <p>Made with care for the Pacific 🌊</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-ink">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-faint transition hover:text-white">
        {children}
      </Link>
    </li>
  );
}
