"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl tracking-tight text-white hover:opacity-80 transition-opacity"
            onClick={() => setIsOpen(false)}
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg ">
              <svg
                className="h-7 w-7 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5z"
                  fill="currentColor"
                  opacity="0.8"
                />
                <path
                  d="M2 17l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            Logstack
          </Link>

          {/* Desktop Menu - Improved visibility with text-zinc-300 */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { name: "Documentation", url: "docs " },
              { name: "Pricing", url: "pricing" },
              { name: "Blog", url: "blog" },
            ].map((item) => (
              <Link
                key={item.name}
                href={`/${item.url.toLowerCase()}`}
                className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-zinc-200 transition-all hover:scale-105"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-white z-50"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay - Changed to fixed to cover screen */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black md:hidden animate-in fade-in slide-in-from-top-5 duration-200">
          <div className="flex flex-col p-8 pt-24 gap-4 h-full">
            <Link
              href="/docs"
              className="text-2xl font-semibold text-white"
              onClick={() => setIsOpen(false)}
            >
              Documentation
            </Link>
            <Link
              href="/pricing"
              className="text-2xl font-semibold text-white"
              onClick={() => setIsOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="text-2xl font-semibold text-white"
              onClick={() => setIsOpen(false)}
            >
              Blog
            </Link>
            <div className="h-px bg-white/10 my-2" />
            <Link
              href="/login"
              className="flex items-center justify-center p-4 text-lg font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              onClick={() => setIsOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex items-center justify-center p-4 text-lg font-bold text-black bg-white rounded-full hover:bg-zinc-200 transition-all"
              onClick={() => setIsOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
