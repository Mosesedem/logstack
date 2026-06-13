import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Logstack",
  description: "Terms of service for Logstack log management platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="prose dark:prose-invert mx-auto">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: May 6, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Logstack, you agree to be bound by these Terms
          of Service and all applicable laws and regulations.
        </p>

        <h2>2. Use License</h2>
        <p>
          Permission is granted to temporarily view the materials (information
          or software) on Logstack's website for personal, non-commercial
          transitory viewing only.
        </p>

        <h2>3. Disclaimer</h2>
        <p>
          The materials on Logstack's website are provided "as is" without
          warranty of any kind, either express or implied.
        </p>

        <h2>4. Revisions and Errata</h2>
        <p>
          The materials appearing on Logstack's website could include technical,
          typographical, or photographic errors.
        </p>

        <h2>5. Revisions and Errata</h2>
        <p>
          We may revise these terms of service for our website at any time
          without notice.
        </p>

        <h2>6. Governing Law</h2>
        <p>
          These terms and conditions are governed by and construed in accordance
          with the laws of the jurisdiction where Logstack operates.
        </p>
      </div>
    </div>
  );
}
