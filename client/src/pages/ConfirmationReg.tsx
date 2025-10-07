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
}

function ConfirmationReg() {
    const { id } = useParams<{ id: string }>();
    const [registration, setRegistration] = useState<RegistrationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        if (id) {
            fetchRegistrationData(id);
        }
    }, [id]);

    const fetchRegistrationData = async (registrationId: string) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/student-registration/${registrationId}`);

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

            const response = await axios.put(`/api/student-registration/${registration.id}/status`, {
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

    const renderTableRow = (label: string, value: string | number | boolean | null) => {
        return (
            <tr className="border-b">
                <td className="py-2 px-4 font-medium text-gray-700 bg-gray-50">{label}</td>
                <td className="py-2 px-4">
                    {value === null || value === undefined || value === ''
                        ? <span className="text-gray-400">Not provided</span>
                        : typeof value === 'boolean'
                            ? (value ? 'Yes' : 'No')
                            : value.toString()
                    }
                </td>
            </tr>
        );
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error || !registration) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
                    <p className="text-red-700">{error || 'Registration not found'}</p>
                </div>
            </div>
        );
    }

    // Show instructions after confirmation
    if (showInstructions) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-white shadow-lg rounded-lg overflow-hidden animate-fade-in">
                    {/* Success Header */}
                    <div className="bg-green-600 text-white p-8 text-center">
                        <div className="animate-bounce mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Registration Confirmed!</h1>
                        <p className="text-xl">Your SSC registration has been successfully confirmed.</p>
                    </div>

                    {/* Instructions */}
                    <div className="p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Next Steps</h2>

                        <div className="space-y-6">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
                                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                                    📋 Step 1: Document Preparation
                                </h3>
                                <p className="text-blue-700">
                                    Prepare all required documents including JSC certificate, birth certificate,
                                    recent passport-size photos, and other necessary papers as per school requirements.
                                </p>
                            </div>

                            <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg">
                                <h3 className="text-lg font-semibold text-green-800 mb-2">
                                    🏫 Step 2: Visit School Office
                                </h3>
                                <p className="text-green-700">
                                    Visit the school office within the next 7 days with all required documents
                                    to complete the admission process and pay necessary fees.
                                </p>
                            </div>

                            <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-lg">
                                <h3 className="text-lg font-semibold text-orange-800 mb-2">
                                    💰 Step 3: Fee Payment
                                </h3>
                                <p className="text-orange-700">
                                    Complete the admission fee payment as per the fee structure.
                                    Receipt will be provided for your records.
                                </p>
                            </div>

                            
                        </div>

                        {/* Contact Information */}
                        <div className="mt-8 bg-gray-50 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">📞 Contact Information</h3>
                            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                                <div>
                                    <p><strong>Office Hours:</strong> 9:00 AM - 4:00 PM</p>
                                    <p><strong>Phone:</strong> +880-XXXX-XXXXX</p>
                                </div>
                                <div>
                                    <p><strong>Email:</strong> info@school.edu.bd</p>
                                    <p><strong>Address:</strong> School Address</p>
                                </div>
                            </div>
                        </div>

                        {/* Important Notes */}
                        <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes:</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                <li>• Keep your registration ID safe for future reference</li>
                                <li>• Bring original documents along with photocopies</li>
                                <li>• Late submission may result in cancellation of admission</li>
                                <li>• For any queries, contact the school office</li>
                            </ul>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-8 text-center space-x-4">
                            <button
                                onClick={() => window.print()}
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Print Instructions
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Go to Homepage
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div
                className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-1000 ${isConfirmed ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                    }`}
            >
                {/* Header */}
                <div className="bg-blue-600 text-white p-6">
                    <h1 className="text-3xl font-bold">Registration Confirmation</h1>
                    <p className="mt-2">Please review your information and confirm if everything is correct.</p>
                    <div className="mt-4 flex gap-4 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${registration.status === 'approved' ? 'bg-green-500' :
                                registration.status === 'rejected' ? 'bg-red-500' :
                                    'bg-yellow-500'
                            }`}>
                            Status: {registration.status.toUpperCase()}
                        </span>
                        <span className="px-3 py-1 bg-blue-500 rounded-full text-sm font-medium">
                            SSC Batch: {registration.ssc_batch}
                        </span>
                        
                    </div>
                </div>

                {/* Student Photo */}
                {registration.photo_path && (
                    <div className="p-6 border-b bg-gray-50">
                        <h3 className="text-lg font-semibold mb-4">Student Photo</h3>
                        <div className="flex justify-center">
                            <img
                                src={`${import.meta.env.VITE_BACKEND_URL}/${registration.photo_path}`}
                                alt="Student Photo"
                                className="w-32 h-32 object-cover border-2 border-gray-300 rounded-lg"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Registration Details Tables */}
                <div className="p-6 space-y-8">

                    {/* Basic Information */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Basic Information</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('Section', registration.section)}
                                {renderTableRow('Roll Number', registration.roll)}
                                {renderTableRow('Religion', registration.religion)}
                                {renderTableRow('Student Name (English)', registration.student_name_en)}
                                {renderTableRow('Student Name (Bangla)', registration.student_name_bn)}
                                {renderTableRow('Nick Name (Bangla)', registration.student_nick_name_bn)}
                                {renderTableRow('Birth Registration No', registration.birth_reg_no)}
                                {renderTableRow('Email', registration.email)}
                                {renderTableRow('Blood Group', registration.blood_group)}
                            </tbody>
                        </table>
                    </div>

                    {/* Birth Information */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Birth Information</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('Birth Date', registration.birth_date)}
                                {renderTableRow('Birth Year', registration.birth_year)}
                                {renderTableRow('Birth Month', registration.birth_month)}
                                {renderTableRow('Birth Day', registration.birth_day)}
                            </tbody>
                        </table>
                    </div>

                    {/* Parents Information */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Parents Information</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow("Father's Name (English)", registration.father_name_en)}
                                {renderTableRow("Father's Name (Bangla)", registration.father_name_bn)}
                                {renderTableRow("Father's NID", registration.father_nid)}
                                {renderTableRow("Father's Phone", registration.father_phone)}
                                {renderTableRow("Mother's Name (English)", registration.mother_name_en)}
                                {renderTableRow("Mother's Name (Bangla)", registration.mother_name_bn)}
                                {renderTableRow("Mother's NID", registration.mother_nid)}
                                {renderTableRow("Mother's Phone", registration.mother_phone)}
                            </tbody>
                        </table>
                    </div>

                    {/* Present Address */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Present Address</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('District', registration.present_district)}
                                {renderTableRow('Upazila', registration.present_upazila)}
                                {renderTableRow('Post Office', registration.present_post_office)}
                                {renderTableRow('Post Code', registration.present_post_code)}
                                {renderTableRow('Village/Road', registration.present_village_road)}
                            </tbody>
                        </table>
                    </div>

                    {/* Permanent Address */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Permanent Address</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('District', registration.permanent_district)}
                                {renderTableRow('Upazila', registration.permanent_upazila)}
                                {renderTableRow('Post Office', registration.permanent_post_office)}
                                {renderTableRow('Post Code', registration.permanent_post_code)}
                                {renderTableRow('Village/Road', registration.permanent_village_road)}
                            </tbody>
                        </table>
                    </div>

                    {/* Guardian Information */}
                    {(registration.guardian_name || registration.guardian_phone || registration.guardian_relation || registration.guardian_nid) && (
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Guardian Information</h3>
                            <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                                <tbody>
                                    {renderTableRow('Guardian Name', registration.guardian_name)}
                                    {renderTableRow('Guardian Phone', registration.guardian_phone)}
                                    {renderTableRow('Guardian Relation', registration.guardian_relation)}
                                    {renderTableRow('Guardian NID', registration.guardian_nid)}
                                    {renderTableRow('Address Same as Permanent', registration.guardian_address_same_as_permanent)}
                                    {!registration.guardian_address_same_as_permanent && (
                                        <>
                                            {renderTableRow('Guardian District', registration.guardian_district)}
                                            {renderTableRow('Guardian Upazila', registration.guardian_upazila)}
                                            {renderTableRow('Guardian Post Office', registration.guardian_post_office)}
                                            {renderTableRow('Guardian Post Code', registration.guardian_post_code)}
                                            {renderTableRow('Guardian Village/Road', registration.guardian_village_road)}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Previous School Information */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Previous School Information</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('Previous School Name', registration.prev_school_name)}
                                {renderTableRow('Previous School District', registration.prev_school_district)}
                                {renderTableRow('Previous School Upazila', registration.prev_school_upazila)}
                            </tbody>
                        </table>
                    </div>

                    {/* JSC Information */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">JSC Information</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('JSC Passing Year', registration.jsc_passing_year)}
                                {renderTableRow('JSC Board', registration.jsc_board)}
                                {renderTableRow('JSC Registration No', registration.jsc_reg_no)}
                                {renderTableRow('JSC Roll No', registration.jsc_roll_no)}
                            </tbody>
                        </table>
                    </div>

                    {/* Academic Information */}
                    <div>
                        <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">Academic Information</h3>
                        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
                            <tbody>
                                {renderTableRow('Group (Class Nine)', registration.group_class_nine)}
                                {renderTableRow('Main Subject', registration.main_subject)}
                                {renderTableRow('Fourth Subject', registration.fourth_subject)}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-6 text-center">
                    <p className="text-gray-600 mb-4">
                        Please review all information carefully before confirming your registration.
                    </p>

                    {/* Confirmation Button - Only show if not approved */}
                    {registration.status !== 'approved' ? (
                        <div className="mb-6">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                <p className="text-yellow-800 font-medium mb-2">
                                    ⚠️ Please review all information carefully before confirming
                                </p>
                                <p className="text-yellow-700 text-sm">
                                    Once confirmed, you cannot modify your registration details.
                                </p>
                            </div>
                            <button
                                onClick={handleConfirmRegistration}
                                disabled={confirming}
                                className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${confirming
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
                                    } text-white text-lg`}
                            >
                                {confirming ? (
                                    <div className="flex items-center">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                        Confirming...
                                    </div>
                                ) : (
                                    'Confirm Registration ✓'
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="mb-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-green-800 font-medium">
                                    ✅ Your registration has been confirmed
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Print Registration Details
                    </button>
                </div>
            </div>

            {/* Add CSS for animations */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out;
                }
            `}</style>
        </div>
    );
}

export default ConfirmationReg;
