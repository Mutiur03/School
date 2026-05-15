import { fetchHeadMasterMsg } from "@/hooks/useSchoolData";
import { getFileUrl } from "@/lib/backend";
import Image from "next/image";
export const metadata = {
  title: "Message From Headmaster",
  description: "Read the message from the headmaster of the school.",
};

async function page() {
  const head = await fetchHeadMasterMsg();
  return (
    <div className="flex flex-col items-center h-screen pt-12">
      <h2 className="mb-5 text-4xl underline">Message From Headmaster</h2>
      <div className="p-4 mb-5 border border-gray-100  shadow-lg">

        <Image
          src={getFileUrl(head?.teacher?.image || null) || "/placeholder.svg"}
          alt="Head Image"
          width={168}
          height={168}
          className="w-42 h-42 object-cover object-top "
        />

      </div>
      <h1 className="text-2xl font-bold mb-4">{head?.teacher?.name ?? ""}</h1>
      <div className=" text-justify max-w-2xl w-full">
        <p>{head?.head_message ?? ""}</p>
      </div>
    </div>
  );
}

export default page;
