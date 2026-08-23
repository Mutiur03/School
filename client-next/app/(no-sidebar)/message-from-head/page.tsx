import { fetchHeadMasterMsg } from '@/queries/teacher.queries';
import { getFileUrl } from '@/lib/backend';
import Image from 'next/image';
export const metadata = {
  title: 'Message From Headmaster',
  description: 'Read the message from the headmaster of the school.',
};

async function page() {
  const head = await fetchHeadMasterMsg();
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-col items-center px-4 py-8 sm:py-12">
      <h2 className="mb-5 text-center text-2xl text-balance underline sm:text-3xl md:text-4xl">
        Message From Headmaster
      </h2>
      <div className="mb-5 border border-gray-100 p-3 shadow-lg sm:p-4">
        <Image
          src={getFileUrl(head?.teacher?.image || null) || '/placeholder.svg'}
          alt="Head Image"
          width={168}
          height={168}
          className="h-32 w-32 object-cover object-top sm:h-42 sm:w-42"
        />
      </div>
      <h1 className="mb-4 text-center text-xl font-bold sm:text-2xl">
        {head?.teacher?.name ?? ''}
      </h1>
      <div className="w-full max-w-2xl text-justify text-sm leading-relaxed text-pretty sm:text-base">
        <p>{head?.head_message ?? ''}</p>
      </div>
    </div>
  );
}

export default page;
