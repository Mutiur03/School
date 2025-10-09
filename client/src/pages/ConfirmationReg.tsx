import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

interface RegistrationData {
    id: string;
    ssc_batch: string;
    section: string;
    roll: string;
    religion: string;
    student_name_bn: string;
    student_nick_name_bn: string;
    student_name_en: string;
    birth_reg_no: string;
    father_name_bn: string;
    father_name_en: string;
    father_nid: string;
    father_phone: string;
    mother_name_bn: string;
    mother_name_en: string;
    mother_nid: string;
    mother_phone: string;
    birth_date: string;
    birth_year: string;
    birth_month: string;
    birth_day: string;
    blood_group: string;
    email: string;
    present_district: string;
    present_upazila: string;
    present_post_office: string;
    present_post_code: string;
    present_village_road: string;
    permanent_district: string;
    permanent_upazila: string;
    permanent_post_office: string;
    permanent_post_code: string;
    permanent_village_road: string;
    guardian_name: string;
    guardian_phone: string;
    guardian_relation: string;
    guardian_nid: string;
    guardian_address_same_as_permanent: boolean;
    guardian_district: string;
    guardian_upazila: string;
    guardian_post_office: string;
    guardian_post_code: string;
    guardian_village_road: string;
    prev_school_name: string;
    prev_school_district: string;
    prev_school_upazila: string;
    jsc_passing_year: string;
    jsc_board: string;
    jsc_reg_no: string;
    jsc_roll_no: string;
    group_class_nine: string;
    main_subject: string;
    fourth_subject: string;
    photo_path: string;
    status: string;
    submission_date: string;
    created_at: string;
    updated_at: string;
    nearby_nine_student_info: string;
}

function ConfirmationReg() {
    const { id } = useParams<{ id: string }>();
    const [registration, setRegistration] = useState<RegistrationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    useEffect(() => {
        if (id) {
            fetchRegistrationData(id);
        }
    }, [id]);

    const fetchRegistrationData = async (registrationId: string) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/reg/ssc/form/${registrationId}`);

            if (response.data.success) {
                setRegistration(response.data.data);
                if (response.data.data.status === 'approved') {
                    setIsConfirmed(true);
                    setShowInstructions(true);
                }
            } else {
                setError('Registration not found');
                toast.error('Registration not found');
            }
        } catch (error: unknown) {
            console.error('Error fetching registration:', error);
            let message = 'Failed to fetch registration data';
            if (axios.isAxiosError(error)) {
                message = error.response?.data?.message || message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRegistration = async () => {
        if (!registration || registration.status === 'approved') return;

        try {
            setConfirming(true);

            const response = await axios.put(`/api/reg/ssc/form/${registration.id}/status`, {
                status: 'approved'
            });

            if (response.data.success) {
                toast.success('Registration confirmed successfully!');
                setIsConfirmed(true);

                // Wait for animation to start
                setTimeout(() => {
                    setShowInstructions(true);
                }, 1000);
            } else {
                toast.error('Failed to confirm registration');
            }
        } catch (error: unknown) {
            console.error('Error fetching registration:', error);
            let message = 'Failed to fetch registration data';
            if (axios.isAxiosError(error)) {
                message = error.response?.data?.message || message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            setError(message);
            toast.error(message);
        } finally {
            setConfirming(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!registration) return;
        try {
            setDownloadingPDF(true);
            const response = await axios.get(
                `/api/reg/ssc/form/${registration.id}/pdf`,
                { responseType: 'blob' }
            );
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SSC_Registration_${registration.student_name_en || registration.roll}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to download PDF');
        } finally {
            setDownloadingPDF(false);
        }
    };

    const renderTableRow = (label: string, value: string | number | boolean | null) => (
        <tr className="border-b last:border-b-0 align-top">
            <td className="py-2 px-4 font-medium text-gray-700 bg-gray-50 align-top" style={{ width: '35%', minWidth: '200px' }}>
                <div className="whitespace-normal break-words">
                    {label}
                </div>
            </td>
            <td className="py-2 px-4 align-top" style={{ width: '65%' }}>
                <div className="whitespace-normal break-words">
                    {value === null || value === undefined || value === ''
                        ? <span className="text-gray-400">Not provided</span>
                        : typeof value === 'boolean'
                            ? (value ? 'Yes' : 'No')
                            : value.toString()
                    }
                </div>
            </td>
        </tr>
    );

    const renderSectionHeader = (title: string) => (
        <tr>
            <td colSpan={2} className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b">
                <div className="whitespace-normal break-words">
                    {title}
                </div>
            </td>
        </tr>
    );

    const joinAddr = (village: string, postOffice: string, postCode: string, upazila: string, district: string) => {
        return [
            village || '',
            postOffice ? (postCode ? `${postOffice} (${postCode})` : postOffice) : '',
            upazila || '',
            district || ''
        ].filter(Boolean).map(s => s.toString().trim()).filter(s => s.length > 0).join(', ') || null;
    };

    const formatGuardianInfo = () => {
        if (!registration?.guardian_name && !registration?.guardian_phone && !registration?.guardian_relation && !registration?.guardian_nid) {
            return 'Not Applicable';
        }
        return [
            registration?.guardian_name ? `Name: ${registration?.guardian_name}` : '',
            registration?.guardian_relation ? `Relation: ${registration?.guardian_relation}` : '',
            registration?.guardian_phone ? `Phone: ${registration?.guardian_phone}` : '',
            registration?.guardian_nid ? `NID: ${registration?.guardian_nid}` : ''
        ].filter(Boolean).join(', ') || 'Not Applicable';
    };

    const formatGuardianAddress = () => {
        const address = joinAddr(
            registration?.guardian_village_road ?? '',
            registration?.guardian_post_office ?? '',
            registration?.guardian_post_code ?? '',
            registration?.guardian_upazila ?? '',
            registration?.guardian_district ?? ''
        );
        return address || 'Not Applicable';
    };

    const formatDateLong = (dateStr: string) => {
        if (!dateStr) return '';
        let d: string, m: string, y: string;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            [d, m, y] = dateStr.split('/');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            [y, m, d] = dateStr.split('-');
        } else {
            return dateStr;
        }
        const dateObj = new Date(`${y}-${m}-${d}`);
        if (isNaN(dateObj.getTime())) return dateStr;
        return dateObj.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatMobileNumbers = () => {
        return [
            registration?.father_phone ?? '',
            registration?.mother_phone ?? '',
            registration?.guardian_phone ?? ''
        ].filter(Boolean).join(', ') || 'No';
    };

    const formatJSCInfo = () => {
        return [
            registration?.jsc_board ? `Board: ${registration?.jsc_board}` : '',
            registration?.jsc_passing_year ? `Passing Year: ${registration?.jsc_passing_year}` : '',
            registration?.jsc_roll_no ? `Roll No: ${registration?.jsc_roll_no}` : 'Roll No: N/A'
        ].filter(Boolean).join(', ') || null;
    };

    const formatAcademicSubjects = () => {
        return [
            registration?.group_class_nine ?? '',
            registration?.main_subject ? `, ${registration?.main_subject}` : '',
            registration?.fourth_subject ? `, 4th: ${registration?.fourth_subject}` : ''
        ].map(s => s.trim()).filter(Boolean).join(' ') || null;
    };

    // const handleEditRegistration = () => {
    //     if (registration?.id) {
    //         navigate(`/edit-registration/${registration.id}`);
    //     }
    // };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
                <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    if (error || !registration) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 shadow-lg max-w-md w-full text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
                    <p className="text-red-700">{error || 'Registration not found'}</p>
                </div>
            </div>
        );
    }

    if (showInstructions) {
        return (
            <div className="w-full min-h-[100vh] bg-gray-50 py-8 px-4">
                <div className="max-w-4xl mx-auto animate-fade-in">
                    <div className="bg-green-600 text-white p-8 text-center rounded-t-2xl">
                        <div className="animate-bounce mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Registration Confirmed!</h1>
                    </div>
                    <div className="bg-white p-6 sm:p-8 space-y-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Next Steps</h2>
                        <div className="space-y-4">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-sm">
                                <h3 className="font-semibold text-blue-800 mb-1">📋 Step 1: Document Preparation</h3>
                                <p className="text-blue-700 text-sm">
                                    Prepare all required documents including JSC certificate, birth certificate,
                                    recent passport-size photos, and other necessary papers as per school requirements.
                                </p>
                            </div>
                            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-sm">
                                <h3 className="font-semibold text-green-800 mb-1">🏫 Step 2: Visit School Office</h3>
                                <p className="text-green-700 text-sm">
                                    Visit the school office within the next 7 days with all required documents
                                    to complete the admission process and pay necessary fees.
                                </p>
                            </div>
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg shadow-sm">
                                <h3 className="font-semibold text-orange-800 mb-1">💰 Step 3: Fee Payment</h3>
                                <p className="text-orange-700 text-sm">
                                    Complete the admission fee payment as per the fee structure.
                                    Receipt will be provided for your records.
                                </p>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                            <h3 className="font-semibold text-gray-800 mb-2 text-base">📞 Contact Information</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                                <div>
                                    <p><strong>Phone:</strong> +880 1309-121983</p>
                                    <p><strong>Email:</strong> lbpgovtschool@gmail.com</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-sm">
                            <h4 className="font-semibold text-yellow-800 mb-1">⚠️ Important Notes:</h4>
                            <ul className="text-xs text-yellow-700 space-y-1">
                                <li>• Keep your registration ID safe for future reference</li>
                                <li>• Bring original documents along with photocopies</li>
                                <li>• Late submission may result in cancellation of admission</li>
                                <li>• For any queries, contact the school office</li>
                            </ul>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloadingPDF}
                                className={`px-5 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 shadow flex items-center justify-center ${downloadingPDF
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {downloadingPDF ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Generating PDF...
                                    </>
                                ) : (
                                    'Download PDF'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-[100vh] bg-gray-50 py-8 px-4">
            <div className={`max-w-4xl mx-auto transition-all duration-1000 ${isConfirmed ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white p-6 sm:p-8 rounded-t-2xl">
                    <h1 className="text-2xl sm:text-3xl font-bold">Registration Confirmation</h1>
                    <p className="mt-2 text-sm sm:text-base">Please review your information and confirm if everything is correct.</p>
                </div>

                {registration.photo_path && (
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
                        <h3 className="text-base font-semibold mb-2 text-gray-700">Student's Photo</h3>
                        <img
                            src={`${import.meta.env.VITE_BACKEND_URL}/${registration.photo_path}`}
                            alt="Student Photo"
                            className="w-28 h-28 object-cover border-2 border-gray-300 rounded-lg shadow"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>
                )}

                <div className="bg-white p-4 sm:p-8 space-y-8">
                    <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1 shadow-sm">
                        <span>Section: {registration.section || '-'}</span>
                        <span>Roll No: {registration.roll || '-'}</span>
                        <span>Religion: {registration.religion || '-'}</span>
                        <span>JSC/JDC Regi. No: {registration.jsc_reg_no || '-'}</span>
                    </div>

                    <div className="grid gap-8">
                        {/* Single comprehensive table matching PDF structure */}
                        <div className="border border-gray-200 bg-white rounded-lg">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed" style={{ minWidth: '600px' }}>
                                    <tbody>
                                        {/* Personal Information Section */}
                                        {renderSectionHeader("ব্যক্তিগত তথ্য (Personal Information)")}
                                        {renderTableRow("ছাত্রের নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):", registration.student_name_bn)}
                                        {renderTableRow("Student's Name (In Capital Letter):", registration.student_name_en)}
                                        {renderTableRow("Birth Registration No. (In English):", registration.birth_reg_no)}
                                        {renderTableRow("Date of Birth (According to JSC/JDC):", formatDateLong(registration.birth_date))}
                                        {renderTableRow("Email Address:", registration.email || "No")}
                                        {renderTableRow("Mobile No (s):", formatMobileNumbers())}

                                        {/* Father's Information Section */}
                                        {renderSectionHeader("পিতার তথ্য (Father's Information)")}
                                        {renderTableRow("পিতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):", registration.father_name_bn)}
                                        {renderTableRow("Father's Name (In Capital Letter):", registration.father_name_en)}
                                        {renderTableRow("National ID Number (In English):", registration.father_nid)}

                                        {/* Mother's Information Section */}
                                        {renderSectionHeader("মাতার তথ্য (Mother's Information)")}
                                        {renderTableRow("মাতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):", registration.mother_name_bn)}
                                        {renderTableRow("Mother's Name (In Capital Letter):", registration.mother_name_en)}
                                        {renderTableRow("National ID Number (In English):", registration.mother_nid)}

                                        {/* Guardian's Information Section */}
                                        {renderSectionHeader("অভিভাবকের তথ্য (Guardian's Information)")}
                                        {renderTableRow("Guardian's Name:", formatGuardianInfo())}
                                        {renderTableRow("Guardian's Address:", formatGuardianAddress())}

                                        {/* Address Section */}
                                        {renderSectionHeader("ঠিকানা (Address)")}
                                        {renderTableRow("Permanent Address:", joinAddr(
                                            registration.permanent_village_road,
                                            registration.permanent_post_office,
                                            registration.permanent_post_code,
                                            registration.permanent_upazila,
                                            registration.permanent_district
                                        ))}
                                        {renderTableRow("Present Address:", joinAddr(
                                            registration.present_village_road,
                                            registration.present_post_office,
                                            registration.present_post_code,
                                            registration.present_upazila,
                                            registration.present_district
                                        ))}

                                        {/* Academic Information Section */}
                                        {renderSectionHeader("শিক্ষাগত তথ্য (Academic Information)")}
                                        {renderTableRow("Previous School Name & Address:", [
                                            registration.prev_school_name,
                                            registration.prev_school_upazila,
                                            registration.prev_school_district
                                        ].filter(Boolean).join(', ') || null)}
                                        {renderTableRow("জেএসসি/জেডিসি'র তথ্য:", formatJSCInfo())}
                                        {renderTableRow("আবশ্যিক ও ৪র্থ বিষয়:", formatAcademicSubjects())}
                                        {renderTableRow("বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:", registration.nearby_nine_student_info)}

                                        {/* Additional Information (if any missing fields exist) */}
                                        {(registration.student_nick_name_bn || registration.blood_group) && (
                                            <>
                                                {renderSectionHeader("অতিরিক্ত তথ্য (Additional Information)")}
                                                {registration.student_nick_name_bn && renderTableRow("ডাকনাম:", registration.student_nick_name_bn)}
                                                {registration.blood_group && renderTableRow("Blood Group:", registration.blood_group)}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white p-6 text-center rounded-b-2xl border-t border-gray-200">
                    <p className="text-gray-600 mb-4 text-sm">
                        Please review all information carefully before confirming your registration.
                    </p>
                    {registration.status !== 'approved' ? (
                        <div className="mb-6">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 shadow-sm">
                                <p className="text-yellow-800 font-medium mb-1">
                                    ⚠️ Please review all information carefully before confirming
                                </p>
                                <p className="text-yellow-700 text-xs">
                                    Once confirmed, you cannot modify your registration details.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center gap-3">
                                <button
                                    onClick={() => {
                                        if (registration?.id) {
                                            window.location.href = `/registration/ssc/${registration.id}`;
                                        }
                                    }}
                                    className="px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center justify-center"
                                >
                                    <span className="mr-2">✏️</span>
                                    Edit Registration
                                </button>
                                <button
                                    onClick={handleConfirmRegistration}
                                    disabled={confirming}
                                    className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow ${confirming
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
                                        } text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center justify-center`}
                                >
                                    {confirming ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                            Confirming...
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2">✓</span>
                                            Confirm Registration
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
                                <p className="text-green-800 font-medium">
                                    ✅ Your registration has been confirmed
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px);}
                    to { opacity: 1; transform: translateY(0);}
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out;
                }
            `}</style>
        </div>
    );
}

export default ConfirmationReg;
