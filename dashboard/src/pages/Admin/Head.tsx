import React, { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";

interface Teacher {
  id: string;
  name: string;
}

interface HeadData {
  teacher?: Teacher;
  head_message?: string;
}

function Head() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      let fetchError = "";

      try {
        const res = await axios.get("/api/teachers/getTeachers");
        if (isMounted)
          setTeachers(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (e) {
        if (isAxiosError(e))
          fetchError =
            e.response?.data?.error || e.message || "Error loading teachers";
      }

      try {
        const resHead = await axios.get<HeadData>("/api/teachers/get_head_msg");
        const headData = resHead.data || {};
        if (isMounted) {
          if (headData.teacher) setSelectedTeacherId(headData.teacher.id);
          if (typeof headData.head_message === "string")
            setMessage(headData.head_message);
        }
      } catch (e) {
        if (isAxiosError(e))
          if (!fetchError) {
            fetchError =
              e.response?.data?.error ||
              e.message ||
              "Error loading head message";
          }
      }
      if (isMounted && fetchError) setError(fetchError);
      if (isMounted) setLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload: { teacherId?: string; message?: string } = {};
      if (selectedTeacherId) payload.teacherId = selectedTeacherId;
      if (message.trim()) payload.message = message.trim();
      if (Object.keys(payload).length === 0) throw new Error("Nothing to save");
      await axios.put("/api/teachers/update_head_msg", payload);
      setSuccess("Saved");
    } catch (e) {
      if (isAxiosError(e))
        setError(e.response?.data?.error || e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      {loading && <div className="text-gray-600">Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">{success}</div>}

      <form onSubmit={handleSubmit} className="mt-3 grid gap-2">
        <label className="inline-flex items-center">
          <span>Teacher:</span>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            disabled={loading || teachers.length === 0}
            className="ml-2 border rounded px-2 py-1 text-sm disabled:opacity-60 bg-accent"
          >
            <option value="">-- Select --</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>

        <textarea
          rows={5}
          placeholder="Write a message from the head..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
          className="w-full resize-y border rounded p-2 text-sm disabled:opacity-60 text-accent-foreground"
        />

        <div>
          <button
            type="submit"
            disabled={loading || (!selectedTeacherId && !message.trim())}
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            Save All
          </button>
        </div>
      </form>
    </div>
  );
}

export default Head;
