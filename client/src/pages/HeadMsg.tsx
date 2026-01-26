import { useHeadMasterMsg } from "@/hooks/useSchoolData";
import backend from "@/lib/backend";
import { useEffect } from "react";

function HeadMsg() {
  useEffect(() => {
    document.title = "Message From Headmaster";
  }, []);
  const { data: head, isLoading } = useHeadMasterMsg();
  return (
    <div className="flex flex-col items-center h-screen pt-12">
      <h2 className="mb-5 text-4xl underline">Message From Headmaster</h2>
      <div className="p-4 mb-5 border border-gray-100  shadow-lg">
        {isLoading ? (
          <div className="w-42 h-42 mb-5 bg-gray-300 animate-pulse shadow-2xl"></div>
        ) : (
          <img
            src={
              head?.teacher.image
                ? `${backend}/${head.teacher.image}`
                : "/placeholder.svg"
            }
            alt="Head Image"
            className="w-42 h-42 object-cover object-top "
          />
        )}
      </div>
      <h1 className="text-2xl font-bold mb-4">{head?.teacher.name ?? ""}</h1>
      <div className=" text-justify max-w-2xl w-full">
        <p>{head?.head_message ?? ""}</p>
      </div>
    </div>
  );
}

export default HeadMsg;
