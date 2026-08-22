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
    <div className="flex h-screen flex-col items-center pt-12">
      <h2 className="mb-5 text-4xl underline">Message From Headmaster</h2>
      <div className="mb-5 border border-gray-100 p-4 shadow-lg">
        <Image
          src={getFileUrl(head?.teacher?.image || null) || '/placeholder.svg'}
          alt="Head Image"
          width={168}
          height={168}
          className="h-42 w-42 object-cover object-top"
        />
      </div>
      <h1 className="mb-4 text-2xl font-bold">{head?.teacher?.name ?? ''}</h1>
      <div className="w-full max-w-2xl text-justify">
        <p>{head?.head_message ?? ''}</p>
      </div>
    </div>
  );
}

export default page;
