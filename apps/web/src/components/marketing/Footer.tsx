import Link from "next/link";
import { LogstackLogo } from "@/components/brand/logstack-logo";
import { FooterLinkGroup } from "@/components/marketing/footer-link-group";
import {
  companyFooterLinks,
  productFooterLinks,
  resourcesFooterLinks,
} from "@/lib/navigation";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black pt-12 pb-8 sm:pt-16">
      <div className="container mx-auto px-4">
        <div className="mb-10 grid grid-cols-2 gap-8 sm:mb-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <LogstackLogo
              href="/"
              size={28}
              className="mb-4 text-xl text-white"
              labelClassName="text-white"
            />
            <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
              The modern logging stack for forward-thinking engineering teams.
              Designed for scale, built for speed.
            </p>
          </div>
          <FooterLinkGroup title="Product" links={productFooterLinks} />
          <FooterLinkGroup title="Resources" links={resourcesFooterLinks} />
          <FooterLinkGroup title="Company" links={companyFooterLinks} />
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-center text-xs text-zinc-600 md:text-left">
            © {new Date().getFullYear()} Logstack Inc. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-600 sm:gap-6 md:justify-end">
            <Link href="/privacy" className="hover:text-zinc-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-zinc-400">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-zinc-400">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
