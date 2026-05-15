import Link from "next/link";
import { FileQuestion, Home, Megaphone, Search, Users } from "lucide-react";

const quickLinks = [
  {
    href: "/notices",
    label: "Official Notices",
    icon: Megaphone,
  },
  {
    href: "/teacher-list",
    label: "Teacher List",
    icon: Users,
  },
  {
    href: "/at-a-glance",
    label: "At a glance",
    icon: Search,
  },
];

export default function NotFound() {
  return (
    <main className="min-h-[560px] bg-white px-4 py-10 text-gray-900 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 border border-[#d8e8c4] bg-[#f6fbef] px-3 py-1.5 text-sm font-medium text-[#4f7f13]">
            <FileQuestion aria-hidden="true" size={18} />
            Page not found
          </div>

          <h1 className="mt-6 font-serif text-5xl font-semibold leading-none text-[#2f2f2f] sm:text-6xl lg:text-7xl">
            404
          </h1>

          <p className="mt-4 max-w-xl text-2xl font-semibold leading-tight text-[#683091] sm:text-3xl">
            We could not find the page you requested.
          </p>

          <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
            The link may be outdated, moved, or typed incorrectly. Use the
            navigation above, return home, or choose a common section below.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#609513] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4f7f13] focus:outline-none focus:ring-2 focus:ring-[#609513] focus:ring-offset-2"
            >
              <Home aria-hidden="true" size={18} />
              Back to Home
            </Link>
            <Link
              href="/notices"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#683091] px-5 py-3 text-sm font-semibold text-[#683091] transition hover:bg-[#683091] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#683091] focus:ring-offset-2"
            >
              <Megaphone aria-hidden="true" size={18} />
              View Notices
            </Link>
          </div>
        </div>

        <div className="border-l-4 border-[#8bc643] bg-[#fbfbfb] p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-gray-500">
            Useful sections
          </p>
          <div className="mt-4 grid gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-14 items-center justify-between border border-gray-200 bg-white px-4 py-3 transition hover:border-[#8bc643] hover:bg-[#f8fcf3] focus:outline-none focus:ring-2 focus:ring-[#8bc643] focus:ring-offset-2"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                    <Icon
                      aria-hidden="true"
                      size={19}
                      className="text-[#609513]"
                    />
                    {item.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-lg leading-none text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#609513]"
                  >
                    &rarr;
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
