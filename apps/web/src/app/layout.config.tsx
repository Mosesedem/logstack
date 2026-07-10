import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { LogstackLogo } from "@/components/brand/logstack-logo";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <LogstackLogo
        href={null}
        size={24}
        className="font-semibold"
        labelClassName="text-sm font-semibold"
      />
    ),
  },
  links: [
    {
      text: "Home",
      url: "/",
    },
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "Pricing",
      url: "/pricing",
    },
    {
      text: "Dashboard",
      url: "/overview",
    },
  ],
  githubUrl: "https://github.com/mosesedem/logstack",
};
