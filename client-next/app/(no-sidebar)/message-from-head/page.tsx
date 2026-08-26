import { fetchHeadMasterMsg } from '@/queries/teacher.queries';
import { getFileUrl } from '@/lib/backend';
import { toParagraphs } from '@/lib/headMessage';
import Image from 'next/image';

export const metadata = {
  title: 'Message From Headmaster',
  description: 'Read the message from the headmaster of the school.',
};

async function page() {
  const head = await fetchHeadMasterMsg();
  const name = head?.teacher?.name?.trim() || '';
  const role = head?.head_role?.trim() || 'Headmaster';
  const paragraphs = toParagraphs(head?.head_message ?? '');
  const imageSrc = getFileUrl(head?.teacher?.image || null) || '/placeholder.svg';

  return (
    <main className="relative isolate min-h-[70vh] overflow-x-clip bg-[#f3f7ee] px-3 py-8 sm:px-6 sm:py-12 lg:py-16">
      {/* Soft institutional wash — cool leaf, not cream */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% 0%, #dce8c8 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, #cfdceb 0%, transparent 50%)',
        }}
      />

      <article className="head-msg-enter mx-auto w-full max-w-5xl">
        <header className="mb-6 text-center sm:mb-8">
          <h1 className="text-2xl font-bold tracking-wide text-balance text-[#1b2430] sm:text-3xl md:text-4xl">
            প্রধান শিক্ষকের বাণী
          </h1>
        </header>

        <div className="overflow-hidden rounded-md border border-[#c5d4a8] bg-[#fafcf7] shadow-[0_12px_40px_-18px_rgba(27,36,48,0.35)]">
          {/* Brand rule */}
          <div
            className="h-1.5 w-full bg-gradient-to-r from-[#3f6b0c] via-[#609513] to-[#7ba428]"
            aria-hidden
          />

          <div className="flex flex-col lg:flex-row">
            {/* Signature: vertical বাণী rail + portrait */}
            <aside className="relative flex flex-col items-center gap-5 border-b border-[#d7e2c4] bg-[#e8f0dc]/55 px-5 py-7 sm:px-8 lg:w-[280px] lg:shrink-0 lg:border-r lg:border-b-0 lg:py-10">
              <p
                className="hidden text-[11px] font-bold tracking-[0.35em] text-[#4f7c12]/80 uppercase lg:block lg:rotate-180 lg:[writing-mode:vertical-rl]"
                aria-hidden
              >
                বাণী
              </p>

              <div className="relative">
                <div
                  className="absolute -inset-2 rounded-sm border border-[#609513]/35"
                  aria-hidden
                />
                <div className="relative overflow-hidden rounded-sm border-2 border-[#609513]/55 bg-white shadow-md">
                  <Image
                    src={imageSrc}
                    alt={name ? `${name}, ${role}` : role}
                    width={220}
                    height={280}
                    className="h-52 w-40 object-cover object-top sm:h-60 sm:w-44"
                    priority
                  />
                </div>
              </div>

              <div className="max-w-full min-w-0 text-center">
                {name ? (
                  <h2
                    className="truncate text-xl font-bold tracking-wide text-[#1b2430] sm:text-2xl"
                    title={name}
                    translate="no"
                  >
                    {name}
                  </h2>
                ) : (
                  <h2 className="text-xl font-bold text-[#1b2430]/60 sm:text-2xl">Headmaster</h2>
                )}
                <p className="mt-1 text-sm font-medium text-[#4f7c12]">প্রধান শিক্ষক</p>
                <p className="mt-0.5 text-xs tracking-wide text-[#5c6b5a] uppercase">{role}</p>
              </div>
            </aside>

            {/* Letter body */}
            <section className="relative min-w-0 flex-1 px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
              <span
                className="pointer-events-none absolute top-3 left-4 text-7xl leading-none text-[#609513]/12 select-none sm:top-4 sm:left-6 sm:text-8xl"
                aria-hidden
              >
                “
              </span>

              <div className="relative border-l-[3px] border-[#609513] pl-4 sm:pl-6">
                {paragraphs.length > 0 ? (
                  <div className="space-y-4 text-justify text-[15px] leading-8 text-pretty text-[#1b2430] sm:text-base sm:leading-8">
                    {paragraphs.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#5c6b5a]">No message available.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </article>

      <style>{`
        @keyframes head-msg-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .head-msg-enter {
          animation: head-msg-enter 0.55s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .head-msg-enter { animation: none; }
        }
      `}</style>
    </main>
  );
}

export default page;
