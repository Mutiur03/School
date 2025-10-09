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
    const host = import.meta.env.VITE_BACKEND_URL;
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
        <tr className="border-b last:border-b-0 align-top border-gray-100">
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
        }).replace(/(\w+)\s(\d{4})/, '$1, $2');
    };

    const formatMobileNumbers = () => {
        return [
            registration?.father_phone ?? '',
            registration?.mother_phone ?? ''
        ].filter(Boolean).join(', ') || 'No';
    };

    const formatJSCInfo = () => {
        return [
            registration?.jsc_board ? `Board: ${registration?.jsc_board}` : '',
            registration?.jsc_passing_year ? `Passing Year: ${registration?.jsc_passing_year}` : '',
            registration?.jsc_roll_no ? `Roll No- ${registration?.jsc_roll_no}` : 'Roll No- N/A'
        ].filter(Boolean).join(', ') || null;
    };

    const formatMainAndFourthSubject = () => {
        return [
            registration?.group_class_nine ?? '',
            registration?.main_subject ? `, ${registration?.main_subject}` : '',
            registration?.fourth_subject ? `, 4th: ${registration?.fourth_subject}` : ''
        ].map(s => s.trim()).filter(Boolean).join(' ') || null;
    };

    const formatPreviousSchool = () => {
        return [
            registration?.prev_school_name,
            registration?.prev_school_upazila,
            registration?.prev_school_district
        ].filter(Boolean).join(', ') || null;
    };

    // const handleEditRegistration = () => {
    //     if (registration?.id) {
    //         navigate(`/edit-registration/${registration.id}`);
    //     }
    // };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-100">
                <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-gray-600"></div>
            </div>
        );
    }

    if (error || !registration) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-100">
                <div className="bg-white border border-gray-300 rounded p-8 shadow max-w-md w-full text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600">{error || 'Registration not found'}</p>
                </div>
            </div>
        );
    }

    if (showInstructions) {
        return (
            <div className="min-h-screen bg-gray-100 py-8 px-4">
                <div className="max-w-4xl mx-auto animate-fade-in">
                    <div className="bg-gray-800 text-white p-8 text-center rounded-t">
                        <div className="mb-6">
                            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-white">
                                <svg className="w-12 h-12 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold mb-3">Registration Confirmed!</h1>
                        <p className="text-xl">Your application has been successfully submitted</p>
                    </div>

                    <div className="bg-white shadow rounded-b overflow-hidden">
                        <div className="p-8 space-y-8">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center p-3 bg-gray-100 rounded-full mb-4">
                                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">Download Your Registration Form</h2>
                                <p className="text-gray-600 text-lg mb-6">
                                    Download the PDF document and follow the instructions for the next steps.
                                </p>
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={downloadingPDF}
                                    className={`px-8 py-4 rounded font-semibold text-lg transition-all duration-300 shadow ${downloadingPDF
                                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                        : 'bg-gray-700 text-white hover:bg-gray-800'
                                        }`}
                                >
                                    {downloadingPDF ? (
                                        <div className="flex items-center space-x-3">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
                                            <span>Generating PDF...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-3">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span>Download PDF</span>
                                        </div>
                                    )}
                                </button>
                            </div>

                            <div className="grid md:grid-cols-1 gap-6">
                                <div className="bg-gray-50 border border-gray-200 p-6 rounded">
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0">
                                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg mb-2">Contact Information</h3>
                                            <div className="space-y-2 text-gray-600">
                                                <p className="flex items-center space-x-2"><span className="font-medium">Phone:</span> <span>+880 1309-121983</span></p>
                                                <p className="flex items-center space-x-2"><span className="font-medium">Email:</span> <span>lbpgovtschool@gmail.com</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="w-full min-h-[100vh] bg-gray-100 py-8 px-4">
            <div className={`max-w-4xl mx-auto transition-all duration-1000 ${isConfirmed ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                <div className="bg-gray-800 text-white p-6 sm:p-8 rounded-t">
                    <h1 className="text-2xl sm:text-3xl font-bold">Registration Confirmation</h1>
                    <p className="mt-2 text-sm sm:text-base">Please review your information and confirm if everything is correct.</p>
                </div>

                {registration.photo_path && (
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
                        <h3 className="text-base font-semibold mb-2 text-gray-700">Student's Photo</h3>
                        <img
                            src={`${host}/${registration.photo_path}`}
                            alt="Student Photo"
                            className="w-28 h-28 object-cover border-2 border-gray-300 rounded shadow-sm"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>
                )}

                <div className="bg-white p-4 sm:p-8 space-y-8">
                    <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Section: {registration.section || '-'}</span>
                        <span>Roll No: {registration.roll || '-'}</span>
                        <span>Religion: {registration.religion || '-'}</span>
                        <span>JSC/JDC Regi. No: {registration.jsc_reg_no || '-'}</span>
                    </div>

                    <div className="grid gap-8">
                        {/* Single comprehensive table matching PDF structure */}
                        <div className="border border-gray-200 bg-white rounded">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed" style={{ minWidth: '600px' }}>
                                    <tbody>
                                        {renderTableRow("ছাত্রের নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):", registration.student_name_bn)}
                                        {renderTableRow("Student's Name:", registration.student_name_en?.toUpperCase())}
                                        {renderTableRow("Birth Registration Number:", registration.birth_reg_no)}
                                        {renderTableRow("Date of Birth (According to JSC/JDC):", formatDateLong(registration.birth_date))}
                                        {renderTableRow("Email Address:", registration.email || "No")}
                                        {renderTableRow("Mobile Numbers:", formatMobileNumbers())}
                                        {renderTableRow("পিতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):", registration.father_name_bn)}
                                        {renderTableRow("Father's Name:", registration.father_name_en?.toUpperCase())}
                                        {renderTableRow("Father's National ID Number:", registration.father_nid)}
                                        {renderTableRow("মাতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):", registration.mother_name_bn)}
                                        {renderTableRow("Mother's Name:", registration.mother_name_en?.toUpperCase())}
                                        {renderTableRow("Mother's National ID Number:", registration.mother_nid)}
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
                                        {renderTableRow("Guardian's Name:", formatGuardianInfo())}
                                        {renderTableRow("Guardian's Address:", formatGuardianAddress())}
                                        {renderTableRow("Previous School Name & Address:", formatPreviousSchool())}
                                        {renderTableRow("Information of JSC/JDC:", formatJSCInfo())}
                                        {renderTableRow("Main and 4th Subject:", formatMainAndFourthSubject())}
                                        {renderTableRow("বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:", registration.nearby_nine_student_info)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white p-6 text-center rounded-b border-t border-gray-200">
                    <p className="text-gray-600 mb-4 text-sm">
                        Please review all information carefully before confirming your registration.
                    </p>
                    {registration.status !== 'approved' ? (
                        <div className="mb-6">
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
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
                                    className="px-6 py-3 rounded font-medium transition-all duration-200 bg-gray-600 hover:bg-gray-700 text-white text-lg focus:outline-none flex items-center justify-center"
                                >
                                    <span className="mr-2">✏️</span>
                                    Edit Registration
                                </button>
                                <button
                                    onClick={handleConfirmRegistration}
                                    disabled={confirming}
                                    className={`px-8 py-3 rounded font-medium transition-all duration-200 ${confirming
                                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                        } text-lg focus:outline-none flex items-center justify-center`}
                                >
                                    {confirming ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-3"></div>
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
                            <div className="bg-green-50 border border-green-300 rounded p-4">
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
