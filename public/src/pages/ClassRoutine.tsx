"use client"
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from "axios";

const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

type Slot = {
    id: number;
    start_time: string;
    end_time: string;
    created_at: string;
    isBreakEveryDay?: boolean;
};

type Routine = {
    id: number;
    class: number;
    slot_id: number;
    day: string;
    subject: string;
    created_at: string;
    slot?: Slot;
};

export default function ClassRoutinePage() {
    const [routine, setRoutine] = useState<Record<number, Routine[]>>({}); // Fix type: should be Record<number, Routine[]>
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const slotRes = await axios.get<Slot[]>("/api/class-routine/slots");
                let slotData = slotRes.data;
                slotData = slotData.slice().sort((a, b) => {
                    const toMinutes = (t: string) => {
                        // Accepts formats like "10:20 AM", "12:10 PM", etc.
                        const match = t.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
                        if (!match) return 0;
                        let hour = parseInt(match[1], 10);
                        const min = parseInt(match[2], 10);
                        const ap = match[3].toUpperCase();
                        if (ap === "PM" && hour !== 12) hour += 12;
                        if (ap === "AM" && hour === 12) hour = 0;
                        return hour * 60 + min;
                    };
                    return toMinutes(a.start_time) - toMinutes(b.start_time);
                });
                setSlots(slotData);

                const routineRes = await axios.get<Routine[]>("/api/class-routine");
                const routineData = routineRes.data;

                const grouped: Record<number, Routine[]> = {};
                for (const r of routineData) {
                    if (!grouped[r.class]) grouped[r.class] = [];
                    grouped[r.class].push(r);
                }
                setRoutine(grouped);
            } catch {
                setRoutine({});
                setSlots([]);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const getSlotsForClass = (classNum: number): (Slot & { isBreakEveryDay?: boolean })[] => {
        const classRoutines = routine[classNum] || [];
        const slotIds = Array.from(new Set(classRoutines.map(r => r.slot_id)));
        let slotObjs = slots.filter(s => slotIds.includes(s.id));

        // Sort slotObjs by start_time
        const toMinutes = (t: string) => {
            // Accepts formats like "10:20 AM", "12:10 PM", etc.
            const match = t.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
            if (!match) return 0;
            let hour = parseInt(match[1], 10);
            const min = parseInt(match[2], 10);
            const ap = match[3].toUpperCase();
            if (ap === "PM" && hour !== 12) hour += 12;
            if (ap === "AM" && hour === 12) hour = 0;
            return hour * 60 + min;
        };
        slotObjs = slotObjs.slice().sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

        const days = dayOrder.filter(d =>
            classRoutines.some(r => r.day === d)
        );
        return slotObjs.map(slot => {
            const isBreakEveryDay =
                days.length > 0 &&
                days.every(day =>
                    classRoutines.find(
                        r =>
                            r.slot_id === slot.id &&
                            r.day === day &&
                            r.subject.trim().toLowerCase() === "break"
                    )
                );
            return { ...slot, isBreakEveryDay };
        });
    };

    const getDaysForClass = (classNum: number): string[] => {
        const classRoutines = routine[classNum] || [];
        const days = Array.from(new Set(classRoutines.map(r => r.day)));
        return dayOrder.filter(d => days.includes(d));
    };

    return (
        <div className="py-12">
            <div className="container-custom">
                <h1 className="section-title">Class Routine</h1>
                <div className="mt-8">
                    <Tabs defaultValue="class6" className="w-full">
                        <TabsList className=" mb-8">
                            <TabsTrigger value="class6">Class 6</TabsTrigger>
                            <TabsTrigger value="class7">Class 7</TabsTrigger>
                            <TabsTrigger value="class8">Class 8</TabsTrigger>
                            <TabsTrigger value="class9">Class 9</TabsTrigger>
                            <TabsTrigger value="class10">Class 10</TabsTrigger>
                        </TabsList>
                        {[6, 7, 8, 9, 10].map(classNum => {
                            const slotsForClass = getSlotsForClass(classNum);
                            const daysForClass = getDaysForClass(classNum);
                            return (
                                <TabsContent key={classNum} value={`class${classNum}`}>
                                    <div className="overflow-x-auto">
                                        {loading ? (
                                            <div className="text-center py-8 text-gray-500">Loading...</div>
                                        ) : (routine[classNum]?.length > 0 && slots.length > 0) ? (
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-primary text-white">
                                                        <th className="border p-2">Day/Time</th>
                                                        {slotsForClass.map((slot, idx) => (
                                                            <th
                                                                className="border p-2"
                                                                key={slot.id + "-" + idx}
                                                            >
                                                                {slot.start_time} - {slot.end_time}
                                                                {slot.isBreakEveryDay && (
                                                                    <span className="ml-2 text-gray-200 font-semibold">(Break)</span>
                                                                )}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {daysForClass.map((day, rowIdx) => (
                                                        <tr className="hover:bg-gray-50" key={day}>
                                                            <td className="border p-2 font-medium">{day}</td>
                                                            {slotsForClass.map((slot, colIdx) => {

                                                                if (slot.isBreakEveryDay) {
                                                                    if (rowIdx === 0) {
                                                                        return (
                                                                            <td
                                                                                className="border p-2 text-center bg-slate-200 font-semibold"
                                                                                key={slot.id + "-" + colIdx}
                                                                                rowSpan={daysForClass.length}
                                                                            >
                                                                                Break
                                                                            </td>
                                                                        );
                                                                    } else {

                                                                        return null;
                                                                    }
                                                                } else {

                                                                    const classRoutines = routine[classNum] || [];
                                                                    const entry = classRoutines.find(
                                                                        r => r.slot_id === slot.id && r.day === day
                                                                    );
                                                                    return (
                                                                        <td className="border p-2" key={slot.id + "-" + colIdx}>
                                                                            {entry ? entry.subject : <span className="text-gray-300">-</span>}
                                                                        </td>
                                                                    );
                                                                }
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="bg-gray-50 p-8 rounded-lg text-center">
                                                <h3 className="text-xl font-medium text-gray-600">Class {classNum} Routine</h3>
                                                <p className="mt-2 text-gray-500">Routine will be updated soon.</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
