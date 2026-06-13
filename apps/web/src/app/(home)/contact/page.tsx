import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us - Logstack",
  description: "Contact Logstack for log management support",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="prose dark:prose-invert mx-auto">
        <h1>Contact Us</h1>
        <p>Have questions about Logstack? We're here to help.</p>

        <h2>Get in Touch</h2>
        <p>
          Email:{" "}
          <a href="mailto:support@logstack.tech">support@logstack.tech</a>
        </p>
        <p>Or use our contact form below:</p>

        <form className="mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-3 py-2 border rounded-md"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-1">
              Message
            </label>
            <textarea
              id="message"
              rows={4}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="How can we help?"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-md"
          >
            Send Message
          </button>
        </form>

        <h2>Support Hours</h2>
        <p>
          Our support team is available Monday through Friday, 9am to 6pm EST.
        </p>
      </div>
    </div>
  );
}
