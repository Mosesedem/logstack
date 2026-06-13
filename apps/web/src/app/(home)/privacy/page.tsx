import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Logstack",
  description: "Privacy policy for Logstack log management platform",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="prose dark:prose-invert mx-auto">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: May 6, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, including:</p>
        <ul>
          <li>Email address and name when you create an account</li>
          <li>Payment information when you subscribe to a paid plan</li>
          <li>Project data and logs you send to our service</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve our services</li>
          <li>Process your transactions and send you related information</li>
          <li>
            Send you technical notices, security alerts, and support messages
          </li>
          <li>Respond to your comments, questions, and requests</li>
        </ul>

        <h2>3. Data Security</h2>
        <p>
          We take reasonable measures to protect your data from unauthorized
          access, use, or disclosure. This includes:
        </p>
        <ul>
          <li>Encryption of data in transit using HTTPS</li>
          <li>Regular security assessments of our systems</li>
          <li>Access controls for our internal systems</li>
        </ul>

        <h2>4. Data Retention</h2>
        <p>
          We retain personal data for as long as necessary to provide our
          services or comply with legal obligations. The retention period
          depends on the type of data and the purposes for which we use it.
        </p>

        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your data</li>
          <li>Opt out of marketing communications</li>
        </ul>

        <h2>6. Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify
          you of any changes by posting the new policy on this page.
        </p>

        <h2>7. Contact Us</h2>
        <p>
          If you have any questions about this privacy policy, please contact us
          at:
        </p>
        <p>
          <a href="mailto:privacy@logstack.tech">privacy@logstack.tech</a>
        </p>
      </div>
    </div>
  );
}
