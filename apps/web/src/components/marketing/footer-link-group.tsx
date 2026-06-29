import Link from "next/link";
import type { SimpleLink } from "@/lib/navigation";

interface FooterLinkGroupProps {
  title: string;
  links: SimpleLink[];
}

export function FooterLinkGroup({ title, links }: FooterLinkGroupProps) {
  return (
    <div>
      <h4 className="mb-4 font-semibold text-white">{title}</h4>
      <ul className="space-y-2 text-sm text-zinc-400">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="hover:text-primary"
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}