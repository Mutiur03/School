import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const enrollments = await prisma.student_enrollments.findMany({
        where: {
            year: 2026,
        },
        include: {
            student: {
                select: {
                    father_phone: true,
                    mother_phone: true,
                },
            },
        },
    });

    const uniquePhones = new Set();
    const duplicate_numbers = [];
    for (const e of enrollments) {
        const phone = e.student.father_phone || e.student.mother_phone;
        if (phone) {
            if (uniquePhones.has(phone)) {
                duplicate_numbers.push(phone);
            } else {
                uniquePhones.add(phone);
            }
        }
    }

    console.log("Total students:", enrollments.length);
    console.log("Unique phones:", uniquePhones.size);
    console.log("Duplicate numbers:", duplicate_numbers.length);
}

main();
