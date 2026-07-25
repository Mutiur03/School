import ResultClient from "./ResultClient";
import { fetchPublicExams } from "@/queries/public-result.queries";

export const metadata = {
  title: "Check Result",
  description: "Check your result and download your marksheet.",
};

const DEFAULT_CLASS = 6;

export default async function ResultPage() {
  const year = new Date().getFullYear();
  const initialExams = await fetchPublicExams(year, DEFAULT_CLASS);

  return (
    <ResultClient
      initialYear={year}
      initialClass={DEFAULT_CLASS}
      initialExams={initialExams}
    />
  );
}
