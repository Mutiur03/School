export type Duplicate = {
  message: string;
  existingRecord?: {
    id?: string | number;
  };
};
const DuplicateWarning: React.FC<{ duplicates: Duplicate[] }> = ({ duplicates }) => (
  <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
    <div className="flex items-start gap-2">
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <div className="flex-1">
        <h3 className="mb-2 font-semibold text-yellow-800">Duplicate Information Detected</h3>
        <div className="space-y-2">
          {duplicates.map((duplicate, index) => (
            <div key={index} className="text-sm text-yellow-700">
              <p className="font-medium">{duplicate.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default DuplicateWarning;
