import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy - Logstack",
  description: "Cookie policy for Logstack log management platform",
};

export default function CookiePolicyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="prose dark:prose-invert mx-auto">
        <h1>Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: May 6, 2026</p>

        <h2>1. What Are Cookies</h2>
        <p>
          Cookies are small text files that are stored on your device when you
          visit a website.
        </p>

        <h2>2. How We Use Cookies</h2>
        <p>We use cookies to:</p>
        <ul>
          <li>Remember your login session</li>
          <li>Understand how you use our website</li>
          <li>Improve your browsing experience</li>
          <li>Market our services to you</li>
        </ul>

        <h2>3. Types of Cookies We Use</h2>
        <ul>
          <li>
            <strong>Essential Cookies:</strong> Necessary for our website to
            function
          </li>
          <li>
            <strong>Performance Cookies:</strong> Help us understand how
            visitors use our site
          </li>
          <li>
            <strong>Functionality Cookies:</strong> Allow us to remember your
            preferences
          </li>
        </ul>

        <h2>4. Managing Cookies</h2>
        <p>
          You can control and manage cookies in your browser settings. However,
          disabling cookies may affect your experience on our website.
        </p>
      </div>
    </div>
  );
}
