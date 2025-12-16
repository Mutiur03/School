import React, { useState, useEffect, useRef, useReducer } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { districts, getUpazilasByDistrict } from '../lib/location'
import axios from 'axios'

function parseCsvString(v: unknown): string[] {
    if (v === undefined || v === null) return []
    const normalized = String(v).replace(/[–—−]/g, '-')
    return normalized
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
}

function expandSerialList(tokens: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const t of tokens) {
        const m = String(t).match(/^\s*(\d+)\s*-\s*(\d+)\s*$/)
        if (m) {
            let a = Number(m[1])
            let b = Number(m[2])
            if (Number.isNaN(a) || Number.isNaN(b)) continue
            if (a > b) [a, b] = [b, a]
            for (let i = a; i <= b; i++) {
                const s = String(i)
                if (!seen.has(s)) {
                    seen.add(s)
                    result.push(s)
                }
            }
        } else {
            const s = String(t).trim()
            if (!s) continue
            if (!seen.has(s)) {
                seen.add(s)
                result.push(s)
            }
        }
    }
    return result
}

type AdmissionSettings = {
    user_id_class6?: string | null
    user_id_class7?: string | null
    user_id_class8?: string | null
    user_id_class9?: string | null
    [key: string]: unknown
}

function getUserIdListFromSettings(settings: AdmissionSettings | null | undefined, admissionClass?: string | null) {
    if (!settings) return []
    const cls = String(admissionClass || '').trim().toLowerCase()
    if (cls === '6' || cls.includes('6') || cls.includes('six')) return parseCsvString(settings.user_id_class6)
    if (cls === '7' || cls.includes('7') || cls.includes('seven')) return parseCsvString(settings.user_id_class7)
    if (cls === '8' || cls.includes('8') || cls.includes('eight')) return parseCsvString(settings.user_id_class8)
    if (cls === '9' || cls.includes('9') || cls.includes('nine')) return parseCsvString(settings.user_id_class9)
    return []
}

const Instruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-gray-900">{children}</p>
)
const Error: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-red-600 text-sm">{children}</div>
)

type Duplicate = {
    message: string
    existingRecord?: {
        id?: string | number
    }
}

const DuplicateWarning: React.FC<{ duplicates: Duplicate[] }> = ({ duplicates }) => (
    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
                <h3 className="text-yellow-800 font-semibold mb-2">Duplicate Information Detected</h3>
                <div className="space-y-2">
                    {duplicates.map((duplicate, index) => (
                        <div key={index} className="text-yellow-700 text-sm">
                            <p className="font-medium">{duplicate.message}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
)

type FormState = {
    studentNameEn: string
    studentNameBn: string
    studentNickNameBn?: string
    fatherNameEn: string
    fatherNameBn: string
    motherNameEn: string
    motherNameBn: string
    fatherNid: string
    motherNid: string
    fatherPhone: string
    motherPhone: string
    birthDate: string
    bloodGroup: string
    birthRegNo: string
    email: string
    presentDistrict: string
    presentUpazila: string
    presentPostOffice: string
    presentPostCode: string
    presentVillageRoad: string
    permanentDistrict: string
    permanentUpazila: string
    permanentPostOffice: string
    permanentPostCode: string
    permanentVillageRoad: string
    birthYear: string
    birthMonth: string
    birthDay: string
    photo?: File | null
    religion: string
    guardianName?: string
    guardianPhone?: string
    guardianRelation?: string
    guardianNid?: string
    guardianAddressSameAsPermanent?: boolean
    guardianDistrict?: string
    guardianPostOffice?: string
    guardianPostCode?: string
    guardianVillageRoad?: string
    guardianUpazila?: string
    prevSchoolName: string
    prevSchoolDistrict: string
    prevSchoolUpazila: string
    sectionInprevSchool: string
    rollInprevSchool: string
    prevSchoolPassingYear: string
    father_profession: string
    father_profession_other?: string
    mother_profession: string
    mother_profession_other?: string
    parent_income: string
    admissionClass?: string
    listType?: string
    admissionUserId?: string
    serialNo?: string
    qouta?: string
    registrationNo?: string
    whatsappNumber?: string
}

const FieldRow: React.FC<{
    label: React.ReactNode
    required?: boolean
    instruction?: React.ReactNode
    error?: string | undefined
    tooltip?: string
    children: React.ReactNode
}> = ({ label, required, instruction, error, tooltip, children }) => (
    <div className="flex flex-col lg:flex-row items-start gap-1 lg:gap-4 py-2 w-full">
        <div className="w-full lg:w-60 text-left text-sm font-medium select-none mb-1 lg:mb-0 shrink-0">
            <span className="flex items-center gap-1">
                <span>{label}{required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}</span>
                {tooltip && (
                    <span className="cursor-pointer group relative inline-block align-middle">
                        <div className="w-4 h-4 bg-blue-500 border border-blue-400 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-blue-700 transition-colors">
                            ?
                        </div>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs px-2 py-1 rounded bg-gray-800 text-white text-sm opacity-0 group-hover:opacity-100 group-focus:opacity-100 pointer-events-none z-20 transition-opacity duration-200">
                            {tooltip}
                        </span>
                    </span>
                )}
            </span>
        </div>
        <div className="flex-1 w-full min-w-0">
            {children}
            {instruction && <Instruction>{instruction}</Instruction>}
            {error && <Error>{error}</Error>}
        </div>
    </div>
)


const SectionHeader: React.FC<{ step: number, title: string }> = ({ step, title }) => (
    <div className="flex items-center gap-2 sm:gap-3 mb-3">
        <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-lg shadow">{step}</span>
        <h3 className="text-base sm:text-lg lg:text-xl font-semibold">{title}</h3>
    </div>
)

type FormAction =
    | { type: 'SET_FIELD', name: string, value: string | boolean | File | null }
    | { type: 'SET_FIELDS', fields: Partial<FormState> }
    | { type: 'RESET', payload?: Partial<FormState> }

const initialFormState: FormState = {
    studentNameEn: '',
    studentNameBn: '',
    studentNickNameBn: '',
    fatherNameEn: '',
    fatherNameBn: '',
    motherNameEn: '',
    motherNameBn: '',
    fatherNid: '',
    motherNid: '',
    fatherPhone: '',
    motherPhone: '',
    birthDate: '',
    bloodGroup: '',
    birthRegNo: '',
    email: '',
    presentDistrict: '',
    presentUpazila: '',
    presentPostOffice: '',
    presentPostCode: '',
    presentVillageRoad: '',
    permanentDistrict: '',
    permanentUpazila: '',
    permanentPostOffice: '',
    permanentPostCode: '',
    permanentVillageRoad: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    photo: null,
    religion: '',
    guardianName: '',
    guardianPhone: '',
    guardianRelation: '',
    guardianNid: '',
    guardianAddressSameAsPermanent: false,
    guardianDistrict: '',
    guardianUpazila: '',
    guardianPostOffice: '',
    guardianPostCode: '',
    guardianVillageRoad: '',
    prevSchoolName: '',
    prevSchoolDistrict: '',
    prevSchoolUpazila: '',
    sectionInprevSchool: '',
    rollInprevSchool: '',
    prevSchoolPassingYear: '',
    father_profession: '',
    father_profession_other: '',
    mother_profession: '',
    mother_profession_other: '',
    parent_income: '',
    admissionClass: '',
    listType: '',
    admissionUserId: '',
    serialNo: '',
    qouta: '',
    registrationNo: '',
    whatsappNumber: '',
}

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.name]: action.value }
        case 'SET_FIELDS':
            return { ...state, ...action.fields }
        case 'RESET':
            return { ...initialFormState, ...action.payload }
        default:
            return state
    }
}

function AdmissionForm() {
    const navigate = useNavigate()
    const { id } = useParams()
    const isEditMode = Boolean(id)

    const [form, dispatch] = useReducer(formReducer, initialFormState)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [duplicates, setDuplicates] = useState<Duplicate[]>([])
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [success, setSuccess] = useState('')
    const [sameAddress, setSameAddress] = useState(false)
    const [guardianNotFather, setGuardianNotFather] = useState(false)
    const [presentUpazillas, setPresentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [permanentUpazillas, setPermanentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [guardianUpazillas, setGuardianUpazillas] = useState<{ id: string; name: string }[]>([])
    const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [shouldNavigate, setShouldNavigate] = useState(false)
    const [admissionClosed, setAdmissionClosed] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)
    const [admission_year, set_admission_year] = useState('');

    // Keep a ref of the current admissionUserId so the "options update" effect
    // can read it without forcing that effect to run on every keystroke.
    const admissionUserIdRef = useRef<string | undefined>(initialFormState.admissionUserId)

    const [classListOptions, setClassListOptions] = useState<string[]>([])
    const [listTypeOptions, setListTypeOptions] = useState<string[]>([])
    const [admissionSettings, setAdmissionSettings] = useState<AdmissionSettings | null>(null)
    const [userIdOptions, setUserIdOptions] = useState<string[]>([])
    const [serialNoOptions, setSerialNoOptions] = useState<string[]>([])

    useEffect(() => {
        const initializeData = async () => {
            try {
                setInitialLoading(true)

                const admissionStatusResponse = await axios.get('/api/admission')
                if (admissionStatusResponse.data) {
                    const { admission_open } = admissionStatusResponse.data
                    set_admission_year(admissionStatusResponse.data.admission_year || '');
                    setAdmissionSettings(admissionStatusResponse.data)

                    const expandSerialList = (tokens: string[]): string[] => {
                        const seen = new Set<string>()
                        const result: string[] = []

                        for (const t of tokens) {
                            const m = t.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/)
                            if (m) {
                                let a = Number(m[1])
                                let b = Number(m[2])
                                if (Number.isNaN(a) || Number.isNaN(b)) continue
                                if (a > b) [a, b] = [b, a]
                                for (let i = a; i <= b; i++) {
                                    const s = String(i)
                                    if (!seen.has(s)) {
                                        seen.add(s)
                                        result.push(s)
                                    }
                                }
                            } else {
                                const s = t
                                if (!seen.has(s)) {
                                    seen.add(s)
                                    result.push(s)
                                }
                            }
                        }
                        return result
                    }

                    const clsList = parseCsvString(admissionStatusResponse.data.class_list)
                    const lTypeList = parseCsvString(admissionStatusResponse.data.list_type)
                    const uidList = getUserIdListFromSettings(admissionStatusResponse.data)
                    const serialRaw = parseCsvString(admissionStatusResponse.data.serial_no)
                    const serialList = expandSerialList(serialRaw);
                    console.debug('admission.serial_raw=', serialRaw)
                    console.debug('admission.serial_expanded=', serialList)

                    if (clsList.length) setClassListOptions(clsList)
                    if (lTypeList.length) setListTypeOptions(lTypeList)
                    if (uidList.length) setUserIdOptions(uidList)
                    if (serialList.length) setSerialNoOptions(serialList)
                    if (!admission_open) {
                        setAdmissionClosed(true)
                        setInitialLoading(false)
                        return
                    }
                } else {
                    navigate('/', { replace: true })
                    return
                }
                if (isEditMode && id) {
                    const response = await axios.get(`/api/admission/form/${id}`)
                    if (response.data.success) {
                        const data = response.data.data
                        if (data.status !== 'pending') {
                            setShouldNavigate(true)
                            navigate('/admission/form/confirm/' + id, { replace: true })
                            return
                        }
                        dispatch({ type: 'SET_FIELD', name: 'prevSchoolName', value: data.prev_school_name || '' });
                        const fatherOptions = ['Government Service', 'Non-Government Service', 'Private Job', 'Other']
                        const motherOptions = ['Housewife', 'Government Service', 'Non-Government Service', 'Private Job', 'Other']
                        const resolvedFather = resolveProfessionOnLoad(data.father_profession, data.father_profession_other, fatherOptions)
                        const resolvedMother = resolveProfessionOnLoad(data.mother_profession, data.mother_profession_other, motherOptions)

                        const formData = {
                            studentNameEn: data.student_name_en || '',
                            studentNameBn: data.student_name_bn || '',
                            studentNickNameBn: data.student_nick_name_bn || '',
                            fatherNameEn: data.father_name_en || '',
                            fatherNameBn: data.father_name_bn || '',
                            motherNameEn: data.mother_name_en || '',
                            motherNameBn: data.mother_name_bn || '',
                            fatherNid: data.father_nid || '',
                            motherNid: data.mother_nid || '',
                            fatherPhone: data.father_phone || '',
                            motherPhone: data.mother_phone || '',
                            birthDate: data.birth_date || '',
                            birthRegNo: data.birth_reg_no || '',
                            bloodGroup: data.blood_group || '',
                            email: data.email || '',
                            admissionClass: data.admission_class || data.admissionClass || '',
                            listType: data.list_type || data.listType || '',
                            admissionUserId: data.admission_user_id || data.admissionUserId || '',
                            serialNo: data.serial_no || data.serialNo || '',
                            qouta: data.qouta || '',
                            presentDistrict: data.present_district || '',
                            presentUpazila: '',
                            presentPostOffice: data.present_post_office || '',
                            presentPostCode: data.present_post_code || '',
                            presentVillageRoad: data.present_village_road || '',
                            permanentDistrict: data.permanent_district || '',
                            permanentUpazila: '',
                            permanentPostOffice: data.permanent_post_office || '',
                            permanentPostCode: data.permanent_post_code || '',
                            permanentVillageRoad: data.permanent_village_road || '',
                            birthYear: data.birth_year || '',
                            birthMonth: data.birth_month || '',
                            birthDay: data.birth_day || '',
                            photo: null,
                            religion: data.religion || '',
                            guardianName: data.guardian_name || '',
                            guardianPhone: data.guardian_phone || '',
                            guardianRelation: data.guardian_relation || '',
                            guardianNid: data.guardian_nid || '',
                            guardianAddressSameAsPermanent: data.guardian_address_same_as_permanent || false,
                            guardianDistrict: data.guardian_district || '',
                            guardianUpazila: '',
                            guardianPostOffice: data.guardian_post_office || '',
                            guardianPostCode: data.guardian_post_code || '',
                            guardianVillageRoad: data.guardian_village_road || '',
                            prevSchoolDistrict: data.prev_school_district || '',
                            prevSchoolUpazila: '',
                            registrationNo: data.registration_no || '',
                            sectionInprevSchool: data.section_in_prev_school || '',
                            rollInprevSchool: data.roll_in_prev_school || '',
                            prevSchoolPassingYear: data.prev_school_passing_year || '',
                            father_profession: resolvedFather.selectValue,
                            father_profession_other: resolvedFather.otherValue,
                            mother_profession: resolvedMother.selectValue,
                            mother_profession_other: resolvedMother.otherValue,
                            parent_income: data.parent_income || '',
                            whatsappNumber: data.whatsapp_number || data.whatsappNumber || '',
                        }

                        dispatch({ type: 'SET_FIELDS', fields: formData })

                        setTimeout(() => {
                            if (data.present_district) {
                                const presentUpazilas = getUpazilasByDistrict(data.present_district)
                                setPresentUpazillas(presentUpazilas)
                            }
                            if (data.permanent_district) {
                                const permanentUpazilas = getUpazilasByDistrict(data.permanent_district)
                                setPermanentUpazillas(permanentUpazilas)
                            }
                            if (data.prev_school_district) {
                                const prevSchoolUpazilas = getUpazilasByDistrict(data.prev_school_district)
                                setPrevSchoolUpazilas(prevSchoolUpazilas)
                            }
                            if (data.guardian_district) {
                                const guardianUpazilas = getUpazilasByDistrict(data.guardian_district)
                                setGuardianUpazillas(guardianUpazilas)
                            }

                            setTimeout(() => {
                                dispatch({
                                    type: 'SET_FIELDS',
                                    fields: {
                                        presentUpazila: data.present_upazila || '',
                                        permanentUpazila: data.permanent_upazila || '',
                                        prevSchoolUpazila: data.prev_school_upazila || '',
                                        guardianUpazila: data.guardian_upazila || '',
                                    }
                                })
                            }, 100)
                        }, 50)

                        if (data.guardian_name) {
                            setGuardianNotFather(true)
                        }

                        if (data.present_district === data.permanent_district &&
                            data.present_upazila === data.permanent_upazila &&
                            data.present_post_office === data.permanent_post_office) {
                            setSameAddress(true)
                        }
                        if (data.permanent_district === data.guardian_district &&
                            data.permanent_upazila === data.guardian_upazila &&
                            data.permanent_post_office === data.guardian_post_office
                        ) {
                            dispatch({ type: 'SET_FIELD', name: 'guardianAddressSameAsPermanent', value: true })
                        }
                        if (data.photo_path) {
                            try {
                                const host = import.meta.env.VITE_BACKEND_URL;
                                setPhotoPreview(`${host}/${data.photo_path}`)
                            } catch (photoError) {
                                console.warn('Could not load existing photo:', photoError)
                            }
                        }
                    } else {
                        setShouldNavigate(true)
                        navigate('/admission/form', { replace: true })
                        return
                    }
                }
            } catch (error) {
                console.error('Failed to initialize data:', error)
                if (isEditMode) {
                    setShouldNavigate(true)
                    navigate('/admission/form', { replace: true })
                    return
                } else {
                    setShouldNavigate(true)
                    navigate('/', { replace: true })
                    return
                }
            } finally {
                setInitialLoading(false)
            }
        }

        initializeData()
    }, [isEditMode, id, navigate])
    useEffect(() => {
        if (!admissionSettings) return
        const list = getUserIdListFromSettings(admissionSettings, form.admissionClass)
        setUserIdOptions(list)
        const current = admissionUserIdRef.current
        if (current && list.length > 0 && !list.includes(current)) {
            dispatch({ type: 'SET_FIELD', name: 'admissionUserId', value: '' })
        }

        const cls = String(form.admissionClass || '').trim().toLowerCase()
        const getSetting = (k: string) => (admissionSettings as Record<string, unknown>)[k]
        let listTypeTokens: string[] = []
        let serialRawTokens: string[] = []
        let user_id_list: string[] = []
        if (cls === '6' || cls.includes('6') || cls.includes('six')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class6') ?? getSetting('listTypeClass6') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class6') ?? getSetting('serialNoClass6') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admissionClass)
        } else if (cls === '7' || cls.includes('7') || cls.includes('seven')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class7') ?? getSetting('listTypeClass7') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class7') ?? getSetting('serialNoClass7') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admissionClass)
        } else if (cls === '8' || cls.includes('8') || cls.includes('eight')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class8') ?? getSetting('listTypeClass8') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class8') ?? getSetting('serialNoClass8') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admissionClass)
        } else if (cls === '9' || cls.includes('9') || cls.includes('nine')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class9') ?? getSetting('listTypeClass9') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class9') ?? getSetting('serialNoClass9') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admissionClass)
        } else {
            listTypeTokens = parseCsvString(getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admissionClass)
        }

        if (listTypeTokens.length) {
            setListTypeOptions(listTypeTokens)
        } else {
            setListTypeOptions([])
        }
        if (user_id_list.length) {
            setUserIdOptions(user_id_list)
        } else {
            setUserIdOptions([])
        }
        const serialList = expandSerialList(serialRawTokens)
        if (serialList.length) setSerialNoOptions(serialList)
        else setSerialNoOptions([])
        if (form.listType && listTypeTokens.length > 0 && !listTypeTokens.includes(String(form.listType))) {
            dispatch({ type: 'SET_FIELD', name: 'listType', value: '' })
        }
        if (form.serialNo && serialList.length > 0 && !serialList.includes(String(form.serialNo))) {
            dispatch({ type: 'SET_FIELD', name: 'serialNo', value: '' })
        }
        if (form.admissionUserId && user_id_list.length > 0 && !user_id_list.includes(String(form.admissionUserId))) {
            dispatch({ type: 'SET_FIELD', name: 'admissionUserId', value: '' })
        }
    }, [admissionSettings, form.admissionClass, form.listType, form.serialNo])

    useEffect(() => {
        admissionUserIdRef.current = form.admissionUserId
    }, [form.admissionUserId])

    useEffect(() => {
        if (!isEditMode) {
            dispatch({ type: 'RESET' })
            setPhotoPreview(null)
            setSameAddress(false)
            setGuardianNotFather(false)
            setErrors({})
            setDuplicates([])
        }
    }, [isEditMode, id])

    useEffect(() => {
        const selectedDistrictId = form.presentDistrict
        if (!selectedDistrictId) {
            setPresentUpazillas([])
            if (!initialLoading) {
                dispatch({ type: 'SET_FIELD', name: 'presentUpazila', value: '' })
            }
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPresentUpazillas(upazilas)
        if (!initialLoading) {
            dispatch({ type: 'SET_FIELD', name: 'presentUpazila', value: '' })
        }
    }, [form.presentDistrict, initialLoading])

    useEffect(() => {
        const selectedDistrictId = form.permanentDistrict
        if (!selectedDistrictId) {
            setPermanentUpazillas([])
            if (!initialLoading) {
                dispatch({ type: 'SET_FIELD', name: 'permanentUpazila', value: '' })
            }
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPermanentUpazillas(upazilas)

        if (!initialLoading) {
            dispatch({ type: 'SET_FIELD', name: 'permanentUpazila', value: '' })
        }
    }, [form.permanentDistrict, initialLoading])

    useEffect(() => {
        const selectedDistrictId = form.prevSchoolDistrict
        if (!selectedDistrictId) {
            setPrevSchoolUpazilas([])
            if (!initialLoading) {
                dispatch({ type: 'SET_FIELD', name: 'prevSchoolUpazila', value: '' })
            }
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPrevSchoolUpazilas(upazilas)
        if (!initialLoading) {
            dispatch({ type: 'SET_FIELD', name: 'prevSchoolUpazila', value: '' })
        }
    }, [form.prevSchoolDistrict, initialLoading])

    const currentYear = new Date().getFullYear()
    const earliestYear = 1900
    const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, i) => String(currentYear - i))
    const months = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
        { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
        { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ]
    function getDaysInMonth(year: string, month: string) {
        if (!year || !month) return []
        const days = new Date(Number(year), Number(month), 0).getDate()
        return Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, '0'))
    }

    let days: string[] = []
    let monthOptions = months
    let disableMonth = false
    let disableDay = false

    // If a valid birth year is present (from the allowed years array), enable month/day selection
    if (form.birthYear && years.includes(form.birthYear)) {
        monthOptions = months
        disableMonth = false
        if (form.birthMonth) {
            days = getDaysInMonth(form.birthYear, form.birthMonth)
            disableDay = false
        } else {
            days = []
            disableDay = true
        }
    } else {
        days = []
        disableMonth = true
        disableDay = true
    }

    useEffect(() => {
        if (form.birthRegNo && form.birthRegNo.length >= 4) {
            const year = form.birthRegNo.slice(0, 4)
            const yearNum = Number(year)
            if (/^\d{4}$/.test(year) && yearNum >= earliestYear && yearNum <= currentYear) {
                dispatch({
                    type: 'SET_FIELDS',
                    fields: {
                        birthYear: year,
                        birthMonth: form.birthMonth,
                        birthDay: form.birthDay
                    }
                })
            } else {
                dispatch({ type: 'SET_FIELDS', fields: { birthYear: '', birthMonth: '', birthDay: '' } })
            }
        } else if (form.birthYear !== '') {
            dispatch({ type: 'SET_FIELDS', fields: { birthYear: '', birthMonth: '', birthDay: '' } })
        }
    }, [form.birthRegNo, form.birthMonth, form.birthDay, form.birthYear, currentYear, earliestYear])

    useEffect(() => {
        if (guardianNotFather && form.guardianAddressSameAsPermanent) {
            dispatch({
                type: 'SET_FIELDS',
                fields: {
                    guardianDistrict: form.permanentDistrict,
                    guardianUpazila: form.permanentUpazila,
                    guardianPostOffice: form.permanentPostOffice,
                    guardianPostCode: form.permanentPostCode,
                    guardianVillageRoad: form.permanentVillageRoad,
                }
            })
        }
    }, [
        guardianNotFather,
        form.guardianAddressSameAsPermanent,
        form.permanentDistrict,
        form.permanentUpazila,
        form.permanentPostOffice,
        form.permanentPostCode,
        form.permanentVillageRoad
    ])

    useEffect(() => {
        if (!guardianNotFather || form.guardianAddressSameAsPermanent) {
            setGuardianUpazillas([])
            return
        }
        const selectedDistrictId = form.guardianDistrict
        if (!selectedDistrictId) {
            setGuardianUpazillas([])
            if (!initialLoading) {
                dispatch({ type: 'SET_FIELD', name: 'guardianUpazila', value: '' })
            }
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setGuardianUpazillas(upazilas)
        if (!initialLoading) {
            dispatch({ type: 'SET_FIELD', name: 'guardianUpazila', value: '' })
        }
    }, [guardianNotFather, form.guardianDistrict, form.guardianAddressSameAsPermanent, initialLoading])

    function isBanglaField(name: string) {
        return (
            name === 'studentNameBn' ||
            name === 'studentNickNameBn' ||
            name === 'fatherNameBn' ||
            name === 'motherNameBn'
        )
    }

    const classGuidance: Record<string, Record<string, { instruction?: string; tooltip?: string }>> = {
        sixx: {
            studentNameBn: { instruction: '(প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)', tooltip: 'Enter your name as shown in Primary/Birth Registration Card in Bengali' },
            studentNameEn: { instruction: '(According to Primary/Birth Registration Card)', tooltip: 'Enter your name as shown in Primary/Birth Registration Card in English capital letters' },
            fatherNameBn: { instruction: '(এস‌এসসি সনদ/জাতীয় পরিচয়পত্র (NID) অনুযায়ী)', tooltip: "Enter father's name as shown in SSC Certificate/National ID Card in Bengali" },
            fatherNameEn: { instruction: '(According to SSC Certificate/National ID Card)', tooltip: "Enter father's name as shown in SSC Certificate/National ID Card in English capital letters" },
            motherNameBn: { instruction: '(এস‌এসসি সনদ/জাতীয় পরিচয়পত্র (NID) অনুযায়ী)', tooltip: "Enter mother's name as shown in SSC Certificate/National ID Card in Bengali" },
            motherNameEn: { instruction: '(According to SSC Certificate/National ID Card)', tooltip: "Enter mother's name as shown in SSC Certificate/National ID Card in English capital letters" },
        },
        seven: {
            studentNameBn: { instruction: '(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)', tooltip: 'Enter your name as it appears in your Class Six Printout in Bengali' },
            studentNameEn: { instruction: '(According to Class Six Printout)', tooltip: 'Enter your name as it appears in your Class Six Printout in English capital letters' },
            fatherNameBn: { instruction: '(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)', tooltip: "Enter father's name as it appears in Class Six Printout in Bengali" },
            fatherNameEn: { instruction: '(According to Class Six Printout)', tooltip: "Enter father's name as it appears in Class Six Printout in English capital letters" },
            motherNameBn: { instruction: '(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)', tooltip: "Enter mother's name as it appears in Class Six Printout in Bengali" },
            motherNameEn: { instruction: '(According to Class Six Printout)', tooltip: "Enter mother's name as it appears in Class Six Printout in English capital letters" },
        },
        eight: {
            studentNameBn: { instruction: '(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: 'Enter your name as it appears in your Class Six Registration Card in Bengali' },
            studentNameEn: { instruction: '(According to Class Six Registration Card)', tooltip: 'Enter your name as it appears in your Class Six Registration Card in English capital letters' },
            fatherNameBn: { instruction: '(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter father's name as it appears in Class Six Registration Card in Bengali" },
            fatherNameEn: { instruction: '(According to Class Six Registration Card)', tooltip: "Enter father's name as it appears in Class Six Registration Card in English capital letters" },
            motherNameBn: { instruction: '(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter mother's name as it appears in Class Six Registration Card in Bengali" },
            motherNameEn: { instruction: '(According to Class Six Registration Card)', tooltip: "Enter mother's name as it appears in Class Six Registration Card in English capital letters" },
        },
        nine: {
            studentNameBn: { instruction: '(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: 'Enter your name exactly as it appears in your JSC Printout/Class Six Registration Card in Bengali' },
            studentNameEn: { instruction: '(According to JSC Printout/Class Six Registration Card)', tooltip: 'Enter your name exactly as it appears in your JSC Printout/Class Six Registration Card in English capital letters' },
            fatherNameBn: { instruction: '(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter father's name exactly as it appears in JSC Printout/Class Six Registration Card in Bengali" },
            fatherNameEn: { instruction: '(According to JSC Printout/Class Six Registration Card)', tooltip: "Enter father's name exactly as it appears in JSC Printout/Class Six Registration Card in English capital letters" },
            motherNameBn: { instruction: '(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter mother's name exactly as it appears in JSC Printout/Class Six Registration Card in Bengali" },
            motherNameEn: { instruction: '(According to JSC Printout/Class Six Registration Card)', tooltip: "Enter mother's name exactly as it appears in JSC Printout/Class Six Registration Card in English capital letters" },
        }
    }

    function normalizeClassKey(c?: string | null) {
        if (!c) return ''
        const s = String(c).trim().toLowerCase()
        if (s === '6' || s.includes('6') || s.includes('six')) return 'sixx'
        if (s === '7' || s.includes('7') || s.includes('seven')) return 'seven'
        if (s === '8' || s.includes('8') || s.includes('eight')) return 'eight'
        if (s === '9' || s.includes('9') || s.includes('nine')) return 'nine'
        return ''
    }

    function isClassEightOrNine(c?: string | null) {
        const k = normalizeClassKey(c)
        return k === 'eight' || k === 'nine'
    }

    function getGuidance(fieldKey: string) {
        const clsKey = normalizeClassKey(form.admissionClass)
        if (!clsKey) return { instruction: undefined as string | undefined, tooltip: undefined as string | undefined }
        const data = classGuidance[clsKey]
        if (!data) return { instruction: undefined as string | undefined, tooltip: undefined as string | undefined }
        return data[fieldKey] || { instruction: undefined as string | undefined, tooltip: undefined as string | undefined }
    }

    function filterEnglishInput(value: string) {
        return value.replace(/[^\x20-\x7E]/g, '')
    }

    function filterBanglaInput(value: string) {
        return value.replace(/[^\u0980-\u09FF.()\s]/g, '')
    }

    function isOtherProfession(val?: string | null) {
        return String(val || '').trim().toLowerCase() === 'other'
    }

    function resolveProfessionOnLoad(value?: string | null, otherField?: string | null, allowedOptions: string[] = []) {
        const raw = String(value || '').trim()
        const otherRaw = String(otherField || '').trim()

        // If server provided an explicit other field, prefer it
        if (otherRaw) {
            return { selectValue: 'Other', otherValue: otherRaw }
        }

        if (!raw) return { selectValue: '', otherValue: '' }

        const matched = allowedOptions.find(o => String(o).trim().toLowerCase() === raw.toLowerCase())
        if (matched) return { selectValue: matched, otherValue: '' }
        return { selectValue: 'Other', otherValue: raw }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const target = e.target as HTMLInputElement;
        const { name, type, checked } = target;
        let value = target.value;

        const numericFields = [
            'rollInprevSchool', 'fatherNid', 'motherNid', 'guardianNid', 'birthRegNo',
            'fatherPhone', 'motherPhone', 'guardianPhone', 'whatsappNumber',
            'presentPostCode', 'permanentPostCode', 'guardianPostCode'
        ];

        const englishNameFields = ['studentNameEn', 'fatherNameEn', 'motherNameEn', 'guardianName'];

        if (numericFields.includes(name)) {
            value = value.replace(/\D/g, '');
        } else if (isBanglaField(name)) {
            value = filterBanglaInput(value);
        } else {
            value = filterEnglishInput(value);
        }

        if (englishNameFields.includes(name)) {
            value = value.toUpperCase();
        }


        if (name === 'fatherPhone' || name === 'motherPhone' || name === 'guardianPhone' || name === 'whatsappNumber') {
            value = value.slice(0, 11);
        }
        if (name === 'presentPostCode' || name === 'permanentPostCode' || name === 'guardianPostCode') {
            value = value.slice(0, 4);
        }
        if (name === 'birthRegNo') {
            value = value.slice(0, 17);
        }
        if (name === 'fatherNid' || name === 'motherNid' || name === 'guardianNid') {
            value = value.slice(0, 17);
        }
        if (name === 'birthYear') return;

        dispatch({ type: 'SET_FIELD', name, value: type === 'checkbox' ? checked : value })

        if (name === 'birthMonth') {
            dispatch({ type: 'SET_FIELD', name: 'birthDay', value: '' })
        }
        if (sameAddress) {
            if (name === 'permanentDistrict') {
                dispatch({ type: 'SET_FIELD', name: 'presentDistrict', value })
            }
            if (name === 'permanentUpazila') {
                dispatch({ type: 'SET_FIELD', name: 'presentUpazila', value })
            }
            if (name === 'permanentPostOffice') {
                dispatch({ type: 'SET_FIELD', name: 'presentPostOffice', value })
            }
            if (name === 'permanentPostCode') {
                dispatch({ type: 'SET_FIELD', name: 'presentPostCode', value })
            }
            if (name === 'permanentVillageRoad') {
                dispatch({ type: 'SET_FIELD', name: 'presentVillageRoad', value })
            }
        }
        if (guardianNotFather && name === 'guardianAddressSameAsPermanent') {
            if (checked) {
                dispatch({
                    type: 'SET_FIELDS',
                    fields: {
                        guardianDistrict: form.permanentDistrict,
                        guardianUpazila: form.permanentUpazila,
                        guardianPostOffice: form.permanentPostOffice,
                        guardianPostCode: form.permanentPostCode,
                        guardianVillageRoad: form.permanentVillageRoad,
                    }
                });
            } else {
                dispatch({
                    type: 'SET_FIELDS',
                    fields: {
                        guardianDistrict: '',
                        guardianUpazila: '',
                        guardianPostOffice: '',
                        guardianPostCode: '',
                        guardianVillageRoad: '',
                    }
                });
            }
        }
        setErrors(prev => ({ ...prev, [name]: '' }))
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, files } = e.target
        if (!files || files.length === 0) return
        const file = files[0]

        if (!file.type.includes('jpeg') && !file.type.includes('jpg') && file.type !== 'image/jpeg') {
            setErrors(prev => ({ ...prev, [name]: 'Only JPG format is allowed' }))
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, [name]: 'File must be smaller than 2MB' }))
            return
        }
        dispatch({ type: 'SET_FIELD', name, value: file })
        const reader = new FileReader()
        reader.onload = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
        setErrors(prev => ({ ...prev, [name]: '' }))
    }

    function validate() {
        const e: Record<string, string> = {}
        if (!form.prevSchoolName.trim()) e.prevSchoolName = 'Previous school name is required'
        if (!form.prevSchoolDistrict.trim()) e.prevSchoolDistrict = 'Previous school district is required'
        if (!form.prevSchoolUpazila.trim()) e.prevSchoolUpazila = 'Previous school upazila/thana is required'
        if (!form.studentNameEn.trim()) e.studentNameEn = 'Student name (in English) is required'
        if (!form.studentNameBn.trim()) e.studentNameBn = 'ছাত্রের নাম (বাংলায়) is required'
        if (!form.studentNickNameBn?.trim()) e.studentNickNameBn = 'ডাকনাম (এক শব্দে/বাংলায়) is required'
        if (!form.fatherNameEn.trim()) e.fatherNameEn = 'Father\'s name (in English) is required'
        if (!form.fatherNameBn.trim()) e.fatherNameBn = 'পিতার নাম (বাংলায়) is required'
        if (!form.motherNameEn.trim()) e.motherNameEn = 'Mother\'s name (in English) is required'
        if (!form.motherNameBn.trim()) e.motherNameBn = 'মাতার নাম (বাংলায়) is required'
        if (!/^\d{17}$/.test(form.birthRegNo)) e.birthRegNo = 'Birth registration number must be exactly 17 digits'
        if (!form.birthRegNo.trim()) e.birthRegNo = 'Birth registration number is required'
        if (!form.birthYear) e.birthYear = 'Birth year is required'
        if (!form.birthMonth) e.birthMonth = 'Birth month is required'
        if (!form.birthDay) e.birthDay = 'Birth day is required'
        // Age cutoff removed: no minimum-age validation enforced here anymore.
        if (!form.admissionClass) e.admissionClass = 'Please select class for admission'
        if (!form.listType) e.listType = 'Please select list type'
        if (!form.admissionUserId) {
            e.admissionUserId = 'User ID is required'
        } else if (userIdOptions.length > 0 && !userIdOptions.includes(form.admissionUserId)) {
            e.admissionUserId = 'Please select a valid User ID from the list'
        }
        if (!form.serialNo) e.serialNo = 'Serial number is required'
        if (!form.qouta) e.qouta = 'Quota selection is required'
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address'

        // Require registration number for class 8 and 9 students
        if (isClassEightOrNine(form.admissionClass) && !String(form.registrationNo || '').trim()) {
            e.registrationNo = 'Registration number is required for class 8 and 9 students'
        }
        if (isClassEightOrNine(form.admissionClass) && String(form.registrationNo || '').trim() && !/^\d{10}$/.test(form.registrationNo || '')) {
            e.registrationNo = 'Registration number mmust be exactly 10 digits'
        }
        if (!isEditMode && !form.photo) {
            e.photo = 'Student photo is required'
        }

        if (!form.fatherNid.trim()) {
            e.fatherNid = 'Father\'s NID is required'
        } else if (!/^\d{10,17}$/.test(form.fatherNid)) {
            e.fatherNid = 'Father\'s NID must be 10 to 17 digits'
        }
        if (!form.fatherPhone.trim()) {
            e.fatherPhone = 'Father\'s mobile number is required'
        } else if (!/^[0-9]{11}$/.test(form.fatherPhone)) {
            e.fatherPhone = 'Enter a valid mobile number (exactly 11 digits)'
        }

        if (!form.motherNid.trim()) {
            e.motherNid = 'Mother\'s NID is required'
        } else if (!/^\d{10,17}$/.test(form.motherNid)) {
            e.motherNid = 'Mother\'s NID must be 10 to 17 digits'
        }
        if (!form.motherPhone.trim()) e.motherPhone = 'Mother\'s mobile number is required'
        else if (!/^[0-9]{11}$/.test(form.motherPhone)) e.motherPhone = 'Enter a valid mobile number (exactly 11 digits)'
        if (form.whatsappNumber && !/^[0-9]{11}$/.test(form.whatsappNumber)) e.whatsappNumber = 'Enter a valid mobile number (exactly 11 digits)'
        if (!form.presentDistrict.trim()) e.presentDistrict = 'Present district is required'
        if (!form.presentUpazila.trim()) e.presentUpazila = 'Present upazila/thana is required'
        if (!form.presentPostOffice.trim()) e.presentPostOffice = 'Present post office is required'
        if (!form.presentPostCode.trim()) e.presentPostCode = 'Present post code is required'
        else if (!/^\d{4}$/.test(form.presentPostCode)) e.presentPostCode = 'Present post code must be exactly 4 digits'
        if (!form.presentVillageRoad.trim()) e.presentVillageRoad = 'Present village/road/house is required'
        if (!form.permanentDistrict.trim()) e.permanentDistrict = 'Permanent district is required'
        if (!form.permanentUpazila.trim()) e.permanentUpazila = 'Permanent upazila/thana is required'
        if (!form.permanentPostOffice.trim()) e.permanentPostOffice = 'Permanent post office is required'
        if (!form.permanentPostCode.trim()) e.permanentPostCode = 'Permanent post code is required'
        else if (!/^\d{4}$/.test(form.permanentPostCode)) e.permanentPostCode = 'Permanent post code must be exactly 4 digits'
        if (!form.permanentVillageRoad.trim()) e.permanentVillageRoad = 'Permanent village/road/house is required'
        if (!form.religion.trim()) e.religion = 'Religion is required'

        if (guardianNotFather) {
            if (!form.guardianName?.trim()) e.guardianName = 'Guardian\'s name is required'
            if (!form.guardianRelation?.trim()) e.guardianRelation = 'Relationship with guardian is required'
            if (!form.guardianNid?.trim()) {
                e.guardianNid = 'Guardian\'s NID is required'
            } else if (!/^\d{10,17}$/.test(form.guardianNid)) {
                e.guardianNid = 'Guardian\'s NID must be 10 to 17 digits'
            }
            if (!form.guardianPhone?.trim()) {
                e.guardianPhone = 'Guardian\'s mobile number is required'
            } else {
                const phoneRegex = /^[0-9]{11}$/
                if (!phoneRegex.test(form.guardianPhone)) {
                    e.guardianPhone = 'Enter a valid mobile number (exactly 11 digits)'
                }
            }
            if (!form.guardianAddressSameAsPermanent) {
                if (!form.guardianDistrict?.trim()) e.guardianDistrict = 'Guardian\'s district is required'
                if (!form.guardianUpazila?.trim()) e.guardianUpazila = 'Guardian\'s upazila/thana is required'
                if (!form.guardianPostOffice?.trim()) e.guardianPostOffice = 'Guardian\'s post office is required'
                if (!form.guardianPostCode?.trim()) e.guardianPostCode = 'Guardian\'s post code is required'
                else if (!/^\d{4}$/.test(form.guardianPostCode)) e.guardianPostCode = 'Guardian\'s post code must be exactly 4 digits'
                if (!form.guardianVillageRoad?.trim()) e.guardianVillageRoad = 'Guardian\'s village/road/house is required'
            }
        }
        if (!form.sectionInprevSchool.trim()) e.sectionInprevSchool = 'Section in previous school is required'
        if (!form.rollInprevSchool.trim()) e.rollInprevSchool = 'Roll in previous school is required'
        if (!form.prevSchoolPassingYear.trim()) e.prevSchoolPassingYear = 'Passing year is required'

        if (!form.father_profession.trim()) {
            e.father_profession = 'Father\'s profession is required'
        } else if (isOtherProfession(form.father_profession) && !form.father_profession_other?.trim()) {
            e.father_profession_other = 'Please specify father\'s profession'
        }

        if (!form.mother_profession.trim()) {
            e.mother_profession = 'Mother\'s profession is required'
        } else if (isOtherProfession(form.mother_profession) && !form.mother_profession_other?.trim()) {
            e.mother_profession_other = 'Please specify mother\'s profession'
        }
        if (!form.parent_income.trim()) e.parent_income = 'Parent\'s income is required'
        setErrors(e)
        if (Object.keys(e).length > 0) {
            console.log('Validation errors:', e)
        }
        return { valid: Object.keys(e).length === 0, errors: e }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSuccess('')
        setDuplicates([])

        const { valid, errors: validationErrors } = validate()
        if (!valid) {
            setTimeout(() => {
                const errorFields = Object.keys(validationErrors)
                if (errorFields.length > 0) {
                    let firstErrorField: Element | null = null
                    if (formRef.current) {
                        const allFields = Array.from(formRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input[name], select[name], textarea[name]'))
                        for (const f of allFields) {
                            const n = f.getAttribute('name')
                            if (n && validationErrors[n]) {
                                firstErrorField = f
                                break
                            }
                        }
                    }

                    if (!firstErrorField) {
                        firstErrorField = formRef.current?.querySelector(`[name="${errorFields[0]}"]`) || null
                    }

                    if (firstErrorField) {
                        ; (firstErrorField as HTMLElement).focus({ preventScroll: false })
                        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }
            }, 100)
            return
        }

        setLoading(true)

        try {
            const formData = new FormData()

            formData.append('religion', form.religion)

            formData.append('studentNameBn', form.studentNameBn)
            formData.append('studentNickNameBn', form.studentNickNameBn || '')
            formData.append('studentNameEn', form.studentNameEn)
            formData.append('birthRegNo', form.birthRegNo)
            if (form.registrationNo) {
                formData.append('registration_no', form.registrationNo)
            }
            formData.append('fatherNameBn', form.fatherNameBn)
            formData.append('fatherNameEn', form.fatherNameEn)
            formData.append('fatherNid', form.fatherNid)
            formData.append('fatherPhone', form.fatherPhone)
            formData.append('motherNameBn', form.motherNameBn)
            formData.append('motherNameEn', form.motherNameEn)
            formData.append('motherNid', form.motherNid)
            formData.append('motherPhone', form.motherPhone)

            const birthDate = `${form.birthDay}/${form.birthMonth}/${form.birthYear}`
            formData.append('birthDate', birthDate)
            formData.append('birthYear', form.birthYear)
            formData.append('birthMonth', form.birthMonth)
            formData.append('birthDay', form.birthDay)
            formData.append('bloodGroup', form.bloodGroup)
            formData.append('email', form.email)

            if (form.whatsappNumber) formData.append('whatsappNumber', form.whatsappNumber)

            formData.append('presentDistrict', form.presentDistrict)
            formData.append('presentUpazila', form.presentUpazila)
            formData.append('presentPostOffice', form.presentPostOffice)
            formData.append('presentPostCode', form.presentPostCode)
            formData.append('presentVillageRoad', form.presentVillageRoad)

            formData.append('permanentDistrict', form.permanentDistrict)
            formData.append('permanentUpazila', form.permanentUpazila)
            formData.append('permanentPostOffice', form.permanentPostOffice)
            formData.append('permanentPostCode', form.permanentPostCode)
            formData.append('permanentVillageRoad', form.permanentVillageRoad)


            if (guardianNotFather) {
                formData.append('guardianName', form.guardianName || '')
                formData.append('guardianPhone', form.guardianPhone || '')
                formData.append('guardianRelation', form.guardianRelation || '')
                formData.append('guardianNid', form.guardianNid || '')
                formData.append('guardianAddressSameAsPermanent', form.guardianAddressSameAsPermanent?.toString() || 'false')

                formData.append('guardianDistrict', form.guardianDistrict || '')
                formData.append('guardianUpazila', form.guardianUpazila || '')
                formData.append('guardianPostOffice', form.guardianPostOffice || '')
                formData.append('guardianPostCode', form.guardianPostCode || '')
                formData.append('guardianVillageRoad', form.guardianVillageRoad || '')
            }

            formData.append('prevSchoolName', form.prevSchoolName)
            formData.append('prevSchoolDistrict', form.prevSchoolDistrict)
            formData.append('prevSchoolUpazila', form.prevSchoolUpazila)
            formData.append('prevSchoolPassingYear', form.prevSchoolPassingYear || '')

            formData.append('sectionInprevSchool', form.sectionInprevSchool || '')
            formData.append('rollInprevSchool', form.rollInprevSchool || '')

            const fatherProfessionVal = isOtherProfession(form.father_profession) ? (form.father_profession_other || '') : (form.father_profession || '')
            const motherProfessionVal = isOtherProfession(form.mother_profession) ? (form.mother_profession_other || '') : (form.mother_profession || '')
            formData.append('father_profession', fatherProfessionVal)
            formData.append('mother_profession', motherProfessionVal)
            formData.append('parent_income', form.parent_income || '')
            formData.append('qouta', form.qouta || '')

            if (form.photo) {
                formData.append('photo', form.photo)
            }
            if (form.admissionClass) formData.append('admissionClass', form.admissionClass)
            if (form.listType) formData.append('listType', form.listType)
            if (form.admissionUserId) formData.append('admissionUserId', form.admissionUserId)
            if (form.serialNo) formData.append('serialNo', form.serialNo)


            let response
            if (isEditMode) {
                response = await axios.put(`/api/admission/form/${id}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                })
            } else {
                response = await axios.post('/api/admission/form', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                })
            }

            const result = response.data
            if (result.success) {
                const successMessage = isEditMode
                    ? `Admission updated successfully! Admission ID: ${id}`
                    : `Admission submitted successfully! Your admission ID is: ${result.data.id}. Status: ${result.data.status}`

                setSuccess(successMessage)

                if (!isEditMode) {
                    dispatch({ type: 'RESET' })
                    setPhotoPreview(null)
                    setErrors({})
                    setSameAddress(false)
                    setGuardianNotFather(false)
                    navigate(`/admission/form/confirm/${result.data.id}`)
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                    navigate(`/admission/form/confirm/${result.data.id}`)

                }
            } else {
                if (result.duplicates && result.duplicates.length > 0) {
                    setDuplicates(result.duplicates)
                }

                if (result.error && typeof result.error === 'object') {
                    setErrors(result.error)
                } else {
                    const errorMessage = isEditMode
                        ? 'Update failed. Please try again.'
                        : 'Admission failed. Please try again.'
                    setErrors({ general: result.message || errorMessage })
                }

                if (result.duplicates && result.duplicates.length > 0) {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }
            }

        } catch (error) {
            console.error('Admission submission error:', error)

            if (axios.isAxiosError(error) && error.response) {
                const errorData = error.response.data

                if (errorData.duplicates && errorData.duplicates.length > 0) {
                    setDuplicates(errorData.duplicates)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }

                if (errorData.error && typeof errorData.error === 'object') {
                    setErrors(errorData.error)
                } else {
                    const errorMessage = isEditMode
                        ? 'Update failed. Please try again.'
                        : 'Admission failed. Please try again.'
                    setErrors({
                        general: errorData.message || errorMessage
                    })
                }
            } else {
                setErrors({
                    general: 'Network error. Please check your connection and try again.'
                })
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (sameAddress) {
            dispatch({
                type: 'SET_FIELDS', fields: {
                    presentDistrict: form.permanentDistrict,
                    presentUpazila: form.permanentUpazila,
                }
            })
        }
    }, [form.permanentDistrict, form.permanentUpazila, sameAddress])


    if (initialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4 p-8">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">
                            {shouldNavigate
                                ? 'Redirecting...'
                                : isEditMode
                                    ? 'Loading Admission Data...'
                                    : 'Initializing Admission Form...'
                            }
                        </h3>
                        <p className="text-sm text-gray-500">Please wait while we prepare everything for you</p>
                    </div>
                </div>
            </div>
        )
    }

    if (admissionClosed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-xl w-full bg-white border border-gray-200 rounded-lg p-6 text-center shadow">
                    <svg className="mx-auto mb-4 w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Admissions are currently closed</h3>
                    <p className="text-sm text-gray-600 mb-4">Admission is not open at the moment. Please check back later or contact the school administration for updates.</p>
                    <div className="flex justify-center gap-3">
                        <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Go to Homepage</button>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 border rounded">Refresh</button>
                    </div>
                </div>
            </div>
        )
    }
    return (
        <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-blue-100 mb-4 py-2 sm:py-3 px-3 sm:px-4 rounded-t shadow-sm flex flex-col items-center">
                <h2 className="text-xl sm:text-2xl lg:text-3xl text-center font-bold text-blue-700 tracking-tight underline underline-offset-4 mb-1 sm:mb-2">
                    {isEditMode ? 'Edit Admission' : `Student's Information for Admission ${admission_year}`}
                </h2>
                <span className="text-xs sm:text-sm text-gray-600 text-center px-2">
                    Please fill all required fields. Fields marked <span className="text-red-600">*</span> are mandatory.
                </span>
            </div>

            {success && (
                <div className="mb-4 p-3 sm:p-4 bg-green-100 text-green-800 rounded text-sm sm:text-base animate-fade-in shadow">
                    {success}
                </div>
            )}

            {duplicates.length > 0 && (
                <DuplicateWarning duplicates={duplicates} />
            )}

            {errors.general && (
                <div className="mb-4 p-3 sm:p-4 bg-red-100 text-red-800 rounded text-sm sm:text-base animate-fade-in shadow">
                    {errors.general}
                </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-6">

                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={1} title="Personal Information:" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Admit to Class:" required error={errors.admissionClass} tooltip="Select the class from the admission settings">
                            <select
                                name="admissionClass"
                                value={form.admissionClass}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Class</option>
                                {classListOptions.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </FieldRow>

                        <FieldRow label="List Type:" required error={errors.listType} tooltip="Select list type from settings">
                            <select
                                name="listType"
                                value={form.listType}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select List Type</option>
                                {listTypeOptions.map((lt) => (
                                    <option key={lt} value={lt}>{lt}</option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Serial No:" required error={errors.serialNo} tooltip="Select serial number from settings">
                            <select
                                name="serialNo"
                                value={form.serialNo}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Serial No</option>
                                {serialNoOptions.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="User ID:" required error={errors.admissionUserId} tooltip="Select user id from settings">
                            <input
                                list="admission-userid-list"
                                name="admissionUserId"
                                value={form.admissionUserId}
                                onChange={handleChange}
                                disabled={!form.admissionClass}
                                placeholder={form.admissionClass ? 'Type or select User ID' : 'Select class first'}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                autoComplete="off"
                            />
                            <datalist id="admission-userid-list">
                                {userIdOptions.map((u) => (
                                    <option key={u} value={u} />
                                ))}
                            </datalist>
                        </FieldRow>


                        <FieldRow label="Qouta:" required error={errors.qouta} tooltip="Enter applicable quota (if any)">
                            <select
                                name="qouta"
                                value={form.qouta}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                            >
                                <option value="">Select Qouta</option>
                                <option value="(GEN)">সাধারণ (GEN)</option>
                                <option value="(DIS) ">বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS) </option>
                                <option value="(FF)">মুক্তিযোদ্ধার সন্তান (FF)</option>
                                <option value="(GOV)">সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)</option>
                                <option value="(ME)">শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)</option>
                                <option value="(SIB)">সহোদর ভাই (SIB)</option>
                                <option value="(TWN)">যমজ (TWN)</option>
                                <option value="(Mutual Transfer)">পারস্পরিক বদলি (Mutual Transfer)</option>
                                <option value="(Govt. Transfer)">সরকারি বদলি (Govt. Transfer)</option>
                            </select>
                        </FieldRow>
                        <FieldRow label="Religion:" required error={errors.religion} tooltip="Select your religion">
                            <select
                                name="religion"
                                value={form.religion}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.religion}
                            >
                                <option value="">Select Religion</option>
                                <option value="Islam">Islam</option>
                                <option value="Hinduism">Hinduism</option>
                                <option value="Christianity">Christianity</option>
                                <option value="Buddhism">Buddhism</option>
                            </select>
                        </FieldRow>

                        <FieldRow label="ছাত্রের নাম (বাংলায়):" required instruction={getGuidance('studentNameBn').instruction || '(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)'} error={errors.studentNameBn} tooltip={getGuidance('studentNameBn').tooltip || 'Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali'}>
                            <input name="studentNameBn" value={form.studentNameBn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="ছাত্রের নাম (বাংলায়)" aria-invalid={!!errors.studentNameBn} />
                        </FieldRow>
                        <FieldRow label="ডাকনাম (এক শব্দে/বাংলায়):" required error={errors.studentNickNameBn} tooltip="Enter your nickname in Bengali, use only one word">
                            <input
                                name="studentNickNameBn"
                                value={form.studentNickNameBn}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="ডাকনাম (এক শব্দে/বাংলায়)"
                                aria-invalid={!!errors.studentNickNameBn}
                            />
                        </FieldRow>
                        <FieldRow label="Student's Name (in English):" required instruction={getGuidance('studentNameEn').instruction || '(According to Primary/Birth Registration Card)'} error={errors.studentNameEn} tooltip={getGuidance('studentNameEn').tooltip || "Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"}>
                            <input name="studentNameEn" value={form.studentNameEn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Student Name (in English)" aria-invalid={!!errors.studentNameEn} />
                        </FieldRow>
                        <FieldRow label="Birth Registration Number:" required error={errors.birthRegNo} tooltip="Enter your 17-digit birth registration number. The year will be automatically extracted from this number">
                            <input
                                name="birthRegNo"
                                type="text"
                                inputMode="numeric"
                                pattern="\d{17}"
                                minLength={17}
                                maxLength={17}
                                value={form.birthRegNo}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="20XXXXXXXXXXXXXXX"
                                aria-invalid={!!errors.birthRegNo}
                            />
                        </FieldRow>

                        <FieldRow label="Date of Birth:" required error={errors.birthYear || errors.birthMonth || errors.birthDay} tooltip="Birth year is auto-filled from birth registration number. Select month and day manually">
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                                <input
                                    name="birthYear"
                                    value={form.birthYear}
                                    className="border rounded px-3 py-2 bg-gray-100 w-full sm:w-32 text-sm sm:text-base"
                                    placeholder="Year"
                                    readOnly
                                    tabIndex={-1}
                                    aria-invalid={!!errors.birthYear}
                                />
                                <select
                                    name="birthMonth"
                                    value={form.birthMonth}
                                    onChange={handleChange}
                                    className="border rounded px-3 py-2 w-full sm:w-40 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                    disabled={disableMonth || !form.birthYear}
                                    aria-invalid={!!errors.birthMonth}
                                >
                                    <option value="">Month</option>
                                    {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <select
                                    name="birthDay"
                                    value={form.birthDay}
                                    onChange={handleChange}
                                    className="border rounded px-3 py-2 w-full sm:w-28 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                    disabled={disableDay || !form.birthYear || !form.birthMonth}
                                    aria-invalid={!!errors.birthDay}
                                >
                                    <option value="">Day</option>
                                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            {/* <Instruction>
                                Student must be at least 12 years old on 1st January {currentYear}.
                            </Instruction> */}
                        </FieldRow>
                        <FieldRow label="পিতার নাম (বাংলায়):" required instruction={getGuidance('fatherNameBn').instruction || '(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)'} error={errors.fatherNameBn} tooltip={getGuidance('fatherNameBn').tooltip || "Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"}>
                            <input name="fatherNameBn" value={form.fatherNameBn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="পিতার নাম (বাংলায়)" aria-invalid={!!errors.fatherNameBn} />
                        </FieldRow>
                        <FieldRow label="Father's Name (in English):" required instruction={getGuidance('fatherNameEn').instruction || '(According to Primary/Birth Registration Card)'} error={errors.fatherNameEn} tooltip={getGuidance('fatherNameEn').tooltip || "Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"}>
                            <input name="fatherNameEn" value={form.fatherNameEn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Father's Name (in English)" aria-invalid={!!errors.fatherNameEn} />
                        </FieldRow>

                        <FieldRow label="Father's NID:" required error={errors.fatherNid} tooltip="Enter father's National ID number (10-17 digits)">
                            <input
                                name="fatherNid"
                                value={form.fatherNid}
                                type="text"
                                inputMode="numeric"
                                pattern="\d{10,17}"
                                minLength={10}
                                maxLength={17}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="1234567890"
                                aria-invalid={!!errors.fatherNid}
                            />
                        </FieldRow>

                        <FieldRow label="Father's Mobile No:" required error={errors.fatherPhone} tooltip="Enter father's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                            <input
                                name="fatherPhone"
                                value={form.fatherPhone}
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={11}
                                minLength={11}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="01XXXXXXXXX"
                                aria-invalid={!!errors.fatherPhone}
                            />
                        </FieldRow>



                        <FieldRow label="মাতার নাম (বাংলায়):" required instruction={getGuidance('motherNameBn').instruction || '(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)'} error={errors.motherNameBn} tooltip={getGuidance('motherNameBn').tooltip || "Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"}>
                            <input name="motherNameBn" value={form.motherNameBn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="মাতার নাম (বাংলায়)" aria-invalid={!!errors.motherNameBn} />
                        </FieldRow>
                        <FieldRow label="Mother's Name (in English):" required instruction={getGuidance('motherNameEn').instruction || '(According to Primary/Birth Registration Card)'} error={errors.motherNameEn} tooltip={getGuidance('motherNameEn').tooltip || "Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"}>
                            <input name="motherNameEn" value={form.motherNameEn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Mother's Name (in English)" aria-invalid={!!errors.motherNameEn} />
                        </FieldRow>

                        <FieldRow label="Mother's NID:" required error={errors.motherNid} tooltip="Enter mother's National ID number (10-17 digits)">
                            <input
                                name="motherNid"
                                value={form.motherNid}
                                type="text"
                                inputMode="numeric"
                                pattern="\d{10,17}"
                                minLength={10}
                                maxLength={17}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="1234567890"
                                aria-invalid={!!errors.motherNid}
                            />
                        </FieldRow>

                        <FieldRow label="Mother's Mobile No:" required error={errors.motherPhone} tooltip="Enter mother's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                            <input
                                name="motherPhone"
                                value={form.motherPhone}
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={11}
                                minLength={11}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="01XXXXXXXXX"
                                aria-invalid={!!errors.motherPhone}
                            />
                        </FieldRow>




                        <FieldRow label="Blood Group:" tooltip="Select your blood group if known. This is optional but helpful for medical emergencies">
                            <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200">
                                <option value="">Select Blood Group</option>
                                <option>A+</option>
                                <option>A-</option>
                                <option>B+</option>
                                <option>B-</option>
                                <option>O+</option>
                                <option>O-</option>
                                <option>AB+</option>
                                <option>AB-</option>
                            </select>
                        </FieldRow>

                        <FieldRow label="Email:" error={errors.email} tooltip="Enter a valid email address for communication. This is optional but recommended">
                            <input name="email" value={form.email} type='email' onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder='example@gmail.com' />
                        </FieldRow>
                        <FieldRow label="Whatsapp Number:" error={errors.whatsappNumber} tooltip="Optional — enter WhatsApp mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                            <input
                                name="whatsappNumber"
                                value={form.whatsappNumber}
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={11}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="01XXXXXXXXX"
                                aria-invalid={!!errors.whatsappNumber}
                            />
                        </FieldRow>
                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={2} title="Address:" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <h4 className="font-semibold mb-2 text-sm sm:text-base">Permanent Address:</h4>
                        <FieldRow label="District:" required error={errors.permanentDistrict} tooltip="Select the district of your permanent address">
                            <select name="permanentDistrict" value={form.permanentDistrict} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200">
                                <option value="">Select district</option>
                                {districts.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Upazila/Thana:" required error={errors.permanentUpazila} tooltip="Select the upazila/thana of your permanent address. First select district to see options">
                            <select
                                name="permanentUpazila"
                                value={form.permanentUpazila}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={!form.permanentDistrict}
                            >
                                <option value="">Select upazila/thana</option>
                                {permanentUpazillas.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Post Office:" required error={errors.permanentPostOffice} tooltip="Enter the name of your nearest post office">
                            <input
                                name="permanentPostOffice"
                                value={form.permanentPostOffice}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Post Office Name"
                            />
                        </FieldRow>
                        <FieldRow label="Post Code:" required error={errors.permanentPostCode} tooltip="Enter the 4-digit postal code of your area">
                            <input
                                name="permanentPostCode"
                                value={form.permanentPostCode}
                                onChange={handleChange}
                                type='text'
                                inputMode="numeric"
                                pattern="\d{4}"
                                maxLength={4}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="1234"
                                aria-invalid={!!errors.permanentPostCode}
                            />
                        </FieldRow>
                        <FieldRow label="Village/Road/House No:" required error={errors.permanentVillageRoad} tooltip="Enter your village name, road name, and house number">
                            <input
                                name="permanentVillageRoad"
                                value={form.permanentVillageRoad}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Village/Road/House No"
                            />
                        </FieldRow>
                        <h4 className="font-semibold mb-2 mt-4 sm:mt-6 text-sm sm:text-base">Present Address:</h4>
                        <FieldRow label="Same as Permanent:" tooltip="Check this box if your present address is the same as permanent address">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={sameAddress}
                                    onChange={(ev) => {
                                        const checked = ev.target.checked
                                        setSameAddress(checked)
                                        if (checked) {
                                            dispatch({
                                                type: 'SET_FIELDS',
                                                fields: {
                                                    presentDistrict: form.permanentDistrict,
                                                    presentUpazila: form.permanentUpazila,
                                                    presentPostOffice: form.permanentPostOffice,
                                                    presentPostCode: form.permanentPostCode,
                                                    presentVillageRoad: form.permanentVillageRoad,
                                                }
                                            })
                                            setErrors(prev => ({ ...prev, presentDistrict: '', presentUpazila: '', presentPostOffice: '', presentPostCode: '', presentVillageRoad: '' }))
                                        } else {
                                            dispatch({
                                                type: 'SET_FIELDS',
                                                fields: {
                                                    presentDistrict: '',
                                                    presentUpazila: '',
                                                    presentPostOffice: '',
                                                    presentPostCode: '',
                                                    presentVillageRoad: '',
                                                }
                                            })
                                        }
                                    }}
                                />
                                <span className="text-sm">Same as Permanent Address</span>
                            </label>
                        </FieldRow>
                        {!sameAddress && (
                            <div className="space-y-2">
                                <FieldRow label="District:" required error={errors.presentDistrict}>
                                    <select name="presentDistrict" value={form.presentDistrict} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200">
                                        <option value="">Select district</option>
                                        {districts.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </FieldRow>
                                <FieldRow label="Upazila/Thana:" required error={errors.presentUpazila}>
                                    <select
                                        name="presentUpazila"
                                        value={form.presentUpazila}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        disabled={!form.presentDistrict}
                                    >
                                        <option value="">Select upazila/thana</option>
                                        {presentUpazillas.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </FieldRow>
                                <FieldRow label="Post Office:" required error={errors.presentPostOffice}>
                                    <input
                                        name="presentPostOffice"
                                        value={form.presentPostOffice}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Post Office Name"
                                    />
                                </FieldRow>
                                <FieldRow label="Post Code:" required error={errors.presentPostCode}>
                                    <input
                                        name="presentPostCode"
                                        value={form.presentPostCode}
                                        onChange={handleChange}
                                        type='text'
                                        inputMode="numeric"
                                        pattern="\d{4}"
                                        maxLength={4}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="1234"
                                        aria-invalid={!!errors.presentPostCode}
                                    />
                                </FieldRow>
                                <FieldRow label="Village/Road/House No:" required error={errors.presentVillageRoad}>
                                    <input
                                        name="presentVillageRoad"
                                        value={form.presentVillageRoad}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Village/Road/House No"
                                    />
                                </FieldRow>
                            </div>
                        )}
                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={3} title="Guardian Information (if not father):" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Guardian is not the father:" tooltip="Check this box only if your guardian is someone other than your father (e.g., mother, uncle, etc.)">
                            <label className="inline-flex items-start sm:items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={guardianNotFather}
                                    onChange={e => {
                                        setGuardianNotFather(e.target.checked)
                                        if (!e.target.checked) {
                                            dispatch({
                                                type: 'SET_FIELDS',
                                                fields: {
                                                    guardianName: '',
                                                    guardianPhone: '',
                                                    guardianRelation: '',
                                                    guardianNid: '',
                                                    guardianAddressSameAsPermanent: false,
                                                    guardianDistrict: '',
                                                    guardianUpazila: '',
                                                    guardianPostOffice: '',
                                                    guardianPostCode: '',
                                                    guardianVillageRoad: '',
                                                }
                                            })
                                            setErrors(prev => ({
                                                ...prev,
                                                guardianName: '',
                                                guardianPhone: '',
                                                guardianRelation: '',
                                                guardianNid: '',
                                                guardianDistrict: '',
                                                guardianUpazila: '',
                                                guardianPostOffice: '',
                                                guardianPostCode: '',
                                                guardianVillageRoad: '',
                                            }))
                                        }
                                    }}
                                    className="mt-0.5 sm:mt-0"
                                />
                                <span className="text-sm leading-relaxed">Check if guardian is not father (can be mother or others)</span>
                            </label>
                        </FieldRow>
                        {guardianNotFather && (
                            <div className="space-y-2">
                                <FieldRow label="Guardian's Name:" required error={errors.guardianName} tooltip="Enter the full name of your guardian in English capital letters">
                                    <input
                                        name="guardianName"
                                        value={form.guardianName}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian's Name"
                                        aria-invalid={!!errors.guardianName}
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian's NID:" required error={errors.guardianNid} tooltip="Enter guardian's National ID number (10-17 digits)">
                                    <input
                                        name="guardianNid"
                                        value={form.guardianNid}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d{10,17}"
                                        minLength={10}
                                        maxLength={17}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian's NID"
                                        aria-invalid={!!errors.guardianNid}
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian's Mobile No:" required error={errors.guardianPhone} tooltip="Enter guardian's mobile number in 11-digit format">
                                    <input
                                        name="guardianPhone"
                                        value={form.guardianPhone}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        maxLength={11}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="01XXXXXXXXX"
                                        aria-invalid={!!errors.guardianPhone}
                                    />
                                </FieldRow>


                                <FieldRow label="Relationship with Guardian:" required error={errors.guardianRelation} tooltip="Select your relationship with the guardian from the dropdown">
                                    <select
                                        name="guardianRelation"
                                        value={form.guardianRelation}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        aria-invalid={!!errors.guardianRelation}
                                    >
                                        <option value="">Select Relationship / সম্পর্ক নির্বাচন করুন</option>
                                        <option value="Mother">Mother (মা)</option>
                                        <option value="Paternal Uncle">Paternal Uncle (চাচা/কাকা)</option>
                                        <option value="Paternal Aunt">Paternal Aunt (চাচী/কাকী)</option>
                                        <option value="Maternal Uncle">Maternal Uncle (মামা)</option>
                                        <option value="Maternal Aunt">Maternal Aunt (মামী)</option>
                                        <option value="Paternal Grandfather">Paternal Grandfather (দাদা)</option>
                                        <option value="Maternal Grandfather">Maternal Grandfather (নানা)</option>
                                        <option value="Paternal Grandmother">Paternal Grandmother (দাদী)</option>
                                        <option value="Maternal Grandmother">Maternal Grandmother (নানী)</option>
                                        <option value="Cousin">Cousin (চাচাতো/মামাতো ভাই/বোন)</option>
                                        <option value="Brother">Brother (ভাই)</option>
                                        <option value="Sister">Sister (বোন)</option>
                                        <option value="Other">Other (অন্যান্য)</option>
                                    </select>
                                </FieldRow>
                                <FieldRow label="Guardian's Address:" tooltip="Check if guardian's address is same as permanent address, otherwise fill separately">
                                    <label className="inline-flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            name="guardianAddressSameAsPermanent"
                                            checked={form.guardianAddressSameAsPermanent}
                                            onChange={(e) => {
                                                const checked = e.target.checked
                                                if (checked) {
                                                    dispatch({
                                                        type: 'SET_FIELDS',
                                                        fields: {
                                                            guardianAddressSameAsPermanent: checked,
                                                            guardianDistrict: form.permanentDistrict,
                                                            guardianUpazila: form.permanentUpazila,
                                                            guardianPostOffice: form.permanentPostOffice,
                                                            guardianPostCode: form.permanentPostCode,
                                                            guardianVillageRoad: form.permanentVillageRoad,
                                                        }
                                                    })
                                                    setErrors(prev => ({
                                                        ...prev,
                                                        guardianDistrict: '',
                                                        guardianUpazila: '',
                                                        guardianPostOffice: '',
                                                        guardianPostCode: '',
                                                        guardianVillageRoad: '',
                                                    }))
                                                } else {
                                                    dispatch({
                                                        type: 'SET_FIELDS',
                                                        fields: {
                                                            guardianAddressSameAsPermanent: checked,
                                                            guardianDistrict: '',
                                                            guardianUpazila: '',
                                                            guardianPostOffice: '',
                                                            guardianPostCode: '',
                                                            guardianVillageRoad: '',
                                                        }
                                                    })
                                                }
                                            }}
                                        />
                                        <span className="text-sm">Same as Permanent Address</span>
                                    </label>
                                </FieldRow>
                                {!form.guardianAddressSameAsPermanent && (
                                    <div className="space-y-2">
                                        <FieldRow label="District:" required error={errors.guardianDistrict} tooltip="Select the district where your guardian lives">
                                            <select
                                                name="guardianDistrict"
                                                value={form.guardianDistrict}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            >
                                                <option value="">Select district</option>
                                                {districts.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="Upazila/Thana:" required error={errors.guardianUpazila} tooltip="Select the upazila/thana where your guardian lives">
                                            <select
                                                name="guardianUpazila"
                                                value={form.guardianUpazila}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                disabled={!form.guardianDistrict}
                                            >
                                                <option value="">Select upazila/thana</option>
                                                {guardianUpazillas.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="Post Office:" required error={errors.guardianPostOffice} tooltip="Enter the name of your guardian's nearest post office">
                                            <input
                                                name="guardianPostOffice"
                                                value={form.guardianPostOffice}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Post Office Name"
                                            />
                                        </FieldRow>
                                        <FieldRow label="Post Code:" required error={errors.guardianPostCode} tooltip="Enter the 4-digit postal code of your guardian's area">
                                            <input
                                                name="guardianPostCode"
                                                value={form.guardianPostCode}
                                                onChange={handleChange}
                                                type='text'
                                                inputMode="numeric"
                                                pattern="\d{4}"
                                                maxLength={4}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="1234"
                                                aria-invalid={!!errors.guardianPostCode}
                                            />
                                        </FieldRow>
                                        <FieldRow label="Village/Road/House No:" required error={errors.guardianVillageRoad} tooltip="Enter your guardian's village name, road name, and house number">
                                            <input
                                                name="guardianVillageRoad"
                                                value={form.guardianVillageRoad}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Village/Road/House No"
                                            />
                                        </FieldRow>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* <section className="mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                        <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-lg shadow">4</span>
                        <h3 className="text-base sm:text-lg lg:text-xl font-semibold">Student's Photo:</h3>
                    </div>
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md">
                    </div>
                </section> */}
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={4} title="Previous School Information:" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Name of Previous School :" required error={errors.prevSchoolName} tooltip="Enter the full name of your previous school">
                            <input
                                name="prevSchoolName"
                                value={form.prevSchoolName}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Enter the name of your previous school"
                                aria-invalid={!!errors.prevSchoolName}
                            />
                        </FieldRow>
                        {isClassEightOrNine(form.admissionClass) && (
                            <FieldRow label="Registration Number:" required error={errors.registrationNo} tooltip="Enter your Registration Number from the registration card (required for Class 8 & 9)">
                                <input
                                    name="registrationNo"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\\d{10}"
                                    minLength={10}
                                    maxLength={10}
                                    value={form.registrationNo}
                                    onChange={(e) => {
                                        const cleaned = (e.target.value || '').replace(/\D/g, '').slice(0, 10)
                                        e.target.value = cleaned
                                        handleChange(e)

                                    }}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="10-digit Registration Number"
                                    aria-invalid={!!errors.registrationNo}
                                />
                            </FieldRow>
                        )}
                        <FieldRow label="Passing Year :" required error={errors.prevSchoolPassingYear} tooltip="Select the year you passed from your previous school">
                            <select
                                name="prevSchoolPassingYear"
                                value={form.prevSchoolPassingYear}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Year</option>
                                {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </FieldRow>

                        <FieldRow label="Section :" required error={errors.sectionInprevSchool} tooltip="Select which section you were in during previous school">
                            <select
                                name="sectionInprevSchool"
                                value={form.sectionInprevSchool}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.sectionInprevSchool}
                            >
                                <option value="">Select Section</option>
                                {["No section", 'A', 'B', 'C', 'D', 'E', 'F'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </FieldRow>

                        <FieldRow label="Roll :" required error={errors.rollInprevSchool} tooltip="Enter your roll number in previous school">
                            <input
                                name="rollInprevSchool"
                                value={form.rollInprevSchool}
                                onChange={handleChange}
                                inputMode="numeric"
                                maxLength={6}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Roll number"
                                aria-invalid={!!errors.rollInprevSchool}
                            />
                        </FieldRow>
                        <FieldRow label="District:" required error={errors.prevSchoolDistrict} tooltip="Select the district where your previous school is located">
                            <select
                                name="prevSchoolDistrict"
                                value={form.prevSchoolDistrict}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.prevSchoolDistrict}
                            >
                                <option value="">Select district</option>
                                {districts.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Upazila/Thana:" required error={errors.prevSchoolUpazila} tooltip="Select the upazila/thana where your previous school is located">
                            <select
                                name="prevSchoolUpazila"
                                value={form.prevSchoolUpazila}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                disabled={!form.prevSchoolDistrict}
                                aria-invalid={!!errors.prevSchoolUpazila}
                            >
                                <option value="">Select upazila/thana</option>
                                {prevSchoolUpazilas.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </FieldRow>
                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={5} title="Additional Information:" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Father's Profession:" required error={errors.father_profession} tooltip="Select father's profession">
                            <div>
                                <select
                                    name="father_profession"
                                    value={form.father_profession}
                                    onChange={handleChange}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                                >
                                    <option value="">Select Profession</option>
                                    <option value="Government Service">Government Service</option>
                                    <option value="Non-Government Service">Non-Government Service</option>
                                    <option value="Private Job">Private Job</option>
                                    <option value="Other">Other</option>
                                </select>

                                {isOtherProfession(form.father_profession) && (
                                    <div className="mt-2">
                                        <input
                                            name="father_profession_other"
                                            value={form.father_profession_other}
                                            onChange={handleChange}
                                            placeholder="Please specify father's profession"
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                                            aria-invalid={!!errors.father_profession_other}
                                        />
                                    </div>
                                )}
                            </div>
                        </FieldRow>

                        <FieldRow label="Mother's Profession:" required error={errors.mother_profession || errors.mother_profession_other} tooltip="Select mother's profession">
                            <div>
                                <select
                                    name="mother_profession"
                                    value={form.mother_profession}
                                    onChange={handleChange}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                                >
                                    <option value="">Select Profession</option>
                                    <option value="Housewife">Housewife</option>
                                    <option value="Government Service">Government Service</option>
                                    <option value="Non-Government Service">Non-Government Service</option>
                                    <option value="Private Job">Private Job</option>
                                    <option value="Other">Other</option>
                                </select>

                                {isOtherProfession(form.mother_profession) && (
                                    <div className="mt-2">
                                        <input
                                            name="mother_profession_other"
                                            value={form.mother_profession_other}
                                            onChange={handleChange}
                                            placeholder="Please specify mother's profession"
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                                            aria-invalid={!!errors.mother_profession_other}
                                        />
                                    </div>
                                )}
                            </div>
                        </FieldRow>

                        <FieldRow label="Parent's Annual Income Range:" required tooltip="Select guardian's annual income range" error={errors.parent_income}>
                            <select
                                name="parent_income"
                                value={form.parent_income}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                            >
                                <option value="">Select Income Range</option>
                                <option value="below_50000">0 - 50,000</option>
                                <option value="50000_100000">50,000 - 100,000</option>
                                <option value="100001_200000">100,001 - 200,000</option>
                                <option value="200001_500000">200,001 - 500,000</option>
                                <option value="above_500000">Above 500,000</option>
                            </select>
                        </FieldRow>


                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                        <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-lg shadow">6</span>
                        <h3 className="text-base sm:text-lg lg:text-xl font-semibold">Student's Photo:</h3>
                    </div>
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md">
                        <FieldRow
                            label={
                                <span>
                                    Photo:
                                    {!isEditMode && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
                                </span>
                            }
                            tooltip="Upload a recent photo. File must be JPG format and less than 2MB"
                        >
                            <div >
                                <div className="flex flex-col lg:flex-row items-start gap-4">
                                    <div className="shrink-0">
                                        <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 bg-gray-50 overflow-hidden">
                                            {photoPreview ? (
                                                <img src={photoPreview} alt="photo preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center px-2">
                                                    <svg className="mx-auto mb-1 w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7-5 7 5v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <div className="text-xs sm:text-sm text-gray-500">
                                                        {isEditMode ? 'Current photo' : 'No photo uploaded'}
                                                    </div>
                                                </div>
                                            )}

                                            <input
                                                id="photo-input"
                                                type="file"
                                                name="photo"
                                                accept=".jpg,.jpeg,image/jpeg"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                aria-invalid={!!errors.photo}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <label htmlFor="photo-input" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 cursor-pointer text-sm sm:text-base">
                                                {photoPreview ? 'Change Photo' : 'Choose Photo'}
                                            </label>

                                            {(photoPreview || form.photo) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        dispatch({ type: 'SET_FIELD', name: 'photo', value: null })
                                                        setPhotoPreview(null)
                                                        const input = document.getElementById('photo-input') as HTMLInputElement | null
                                                        if (input) input.value = ''
                                                        setErrors(prev => ({ ...prev, photo: '' }))
                                                    }}
                                                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded bg-white text-sm sm:text-base hover:bg-gray-50"
                                                >
                                                    Remove Photo
                                                </button>
                                            )}
                                        </div>

                                        <Instruction>
                                            JPG only. Max file size 2MB. Click the box or "Choose Photo" to upload.
                                        </Instruction>

                                        {errors.photo && <Error>{errors.photo}</Error>}
                                        {isEditMode && !form.photo && photoPreview && (
                                            <Instruction>Existing photo will be kept if you don't upload a new one.</Instruction>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </FieldRow>
                    </div>
                </section>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 sm:mt-8">
                    <button
                        type="submit"
                        className={`px-6 py-3 bg-blue-600 text-white rounded shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition font-semibold flex items-center justify-center gap-2 text-sm sm:text-base ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={loading}
                    >
                        {loading && <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
                        {loading
                            ? (isEditMode ? 'Updating...' : 'Submitting...')
                            : (isEditMode ? 'Update Admission' : 'Submit Admission')
                        }
                    </button>

                    {!isEditMode && (
                        <button
                            type="button"
                            className="px-6 py-3 border border-gray-300 rounded shadow bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition text-sm sm:text-base"
                            onClick={() => {
                                dispatch({ type: 'RESET' }); setPhotoPreview(null); setErrors({}); setSuccess('')
                                setSameAddress(false)
                                setGuardianNotFather(false)
                            }}
                            disabled={loading}
                        >Reset</button>
                    )}

                    {isEditMode && (
                        <button
                            type="button"
                            className="px-6 py-3 border border-gray-300 rounded shadow bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition text-sm sm:text-base"
                            onClick={() => navigate(-1)}
                            disabled={loading}
                        >Cancel</button>
                    )}
                </div>
            </form>

            <style>{`   
                .animate-fade-in {
                    animation: fadeIn 0.7s;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px);}
                    to { opacity: 1; transform: none;}
                }
            `}</style>
        </div>
    )
}

export default AdmissionForm