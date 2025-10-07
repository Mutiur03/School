import React, { useState, useEffect, useRef } from 'react'
import { districts, getUpazilasByDistrict } from '../lib/location'

const Instruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-gray-900">{children}</p>
)
const Error: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-red-600 text-sm">{children}</div>
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
    section: string
    roll: string
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
    jscPassingYear: string
    jscBoard: string
    jscRegNo: string
    jscRollNo: string
    groupClassNine: string
    mainSubject: string
    fourthSubject: string
}

const FieldRow: React.FC<{
    label: React.ReactNode
    required?: boolean
    instruction?: React.ReactNode
    error?: string | undefined
    children: React.ReactNode
}> = ({ label, required, instruction, error, children }) => (
    <div className="flex flex-col lg:flex-row items-start gap-1 lg:gap-4 py-2 w-full">
        <div className="w-full lg:w-60 text-left text-sm font-medium select-none mb-1 lg:mb-0 flex-shrink-0">
            <span>{label}{required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}</span>
            <span className="mx-2 hidden lg:inline">:</span>
        </div>
        <div className="flex-1 w-full min-w-0">
            {children}
            {instruction && <Instruction>{instruction}</Instruction>}
            {error && <Error>{error}</Error>}
        </div>
    </div>
)

const Tooltip: React.FC<{ text: string }> = ({ text }) => (
    <span className="ml-1 cursor-pointer group relative inline-block align-middle">
        <svg className="w-4 h-4 text-blue-400 inline" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" /><text x="10" y="15" textAnchor="middle" fontSize="12" fill="#fff">?</text></svg>
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs px-2 py-1 rounded bg-gray-800 text-white text-xs opacity-0 group-hover:opacity-100 group-focus:opacity-100 pointer-events-none z-20 transition-opacity duration-200">
            {text}
        </span>
    </span>
)

const SectionHeader: React.FC<{ step: number, title: string }> = ({ step, title }) => (
    <div className="flex items-center gap-2 sm:gap-3 mb-3">
        <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-lg shadow">{step}</span>
        <h3 className="text-base sm:text-lg lg:text-xl font-semibold">{title}</h3>
    </div>
)

function Registration() {
    const [form, setForm] = useState<FormState>({
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
        section: '',
        roll: '',
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
        jscPassingYear: '',
        jscBoard: '',
        jscRegNo: '',
        jscRollNo: '',
        groupClassNine: '',
        mainSubject: '',
        fourthSubject: '',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [success, setSuccess] = useState('')
    const [sameAddress, setSameAddress] = useState(false)
    const [guardianNotFather, setGuardianNotFather] = useState(false)
    const [presentUpazillas, setPresentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [permanentUpazillas, setPermanentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [guardianUpazillas, setGuardianUpazillas] = useState<{ id: string; name: string }[]>([])
    const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)

    useEffect(() => {
        const selectedDistrictId = form.presentDistrict
        if (!selectedDistrictId) {
            setPresentUpazillas([])
            setForm(prev => ({ ...prev, presentUpazila: '' }))
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPresentUpazillas(upazilas)
        setForm(prev => ({ ...prev, presentUpazila: '' }))
    }, [form.presentDistrict])

    useEffect(() => {
        const selectedDistrictId = form.permanentDistrict
        if (!selectedDistrictId) {
            setPermanentUpazillas([])
            setForm(prev => ({ ...prev, permanentUpazila: '' }))
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPermanentUpazillas(upazilas)
        setForm(prev => ({ ...prev, permanentUpazila: '' }))
    }, [form.permanentDistrict])

    useEffect(() => {
        const selectedDistrictId = form.prevSchoolDistrict
        if (!selectedDistrictId) {
            setPrevSchoolUpazilas([])
            setForm(prev => ({ ...prev, prevSchoolUpazila: '' }))
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPrevSchoolUpazilas(upazilas)
        setForm(prev => ({ ...prev, prevSchoolUpazila: '' }))
    }, [form.prevSchoolDistrict])

    const currentYear = new Date().getFullYear()
    const minYear = currentYear - 12
    const years = Array.from({ length: 40 }, (_, i) => String(minYear - i))

    // JSC passing years (last 3 years)
    const jscPassingYears = Array.from({ length: 3 }, (_, i) => String(currentYear - i -1))

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
    if (form.birthYear && years.includes(form.birthYear)) {
        if (form.birthYear === String(minYear)) {
            monthOptions = months.filter(m => m.value === '01')
            disableMonth = false
            if (form.birthMonth === '01') {
                days = ['01']
                disableDay = false
            } else {
                days = []
                disableDay = true
            }
        } else {
            monthOptions = months
            disableMonth = false
            if (form.birthMonth) {
                days = getDaysInMonth(form.birthYear, form.birthMonth)
                disableDay = false
            } else {
                days = []
                disableDay = true
            }
        }
    } else {
        days = []
        disableMonth = true
        disableDay = true
    }

    useEffect(() => {
        if (form.birthRegNo && form.birthRegNo.length >= 4) {
            const year = form.birthRegNo.slice(0, 4)
            if (/^\d{4}$/.test(year) && years.includes(year)) {
                setForm(prev => ({
                    ...prev,
                    birthYear: year,
                    birthMonth: prev.birthMonth,
                    birthDay: prev.birthDay
                }))
            } else {
                setForm(prev => ({ ...prev, birthYear: '', birthMonth: '', birthDay: '' }))
            }
        } else if (form.birthYear !== '') {
            setForm(prev => ({ ...prev, birthYear: '', birthMonth: '', birthDay: '' }))
        }
    }, [form.birthRegNo])

    useEffect(() => {
        if (guardianNotFather && form.guardianAddressSameAsPermanent) {
            setForm(prev => ({
                ...prev,
                guardianDistrict: form.permanentDistrict,
                guardianUpazila: form.permanentUpazila,
                guardianPostOffice: form.permanentPostOffice,
                guardianPostCode: form.permanentPostCode,
                guardianVillageRoad: form.permanentVillageRoad,
            }))
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
            setForm(prev => ({ ...prev, guardianUpazila: '' }))
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setGuardianUpazillas(upazilas)
        setForm(prev => ({ ...prev, guardianUpazila: '' }))
    }, [guardianNotFather, form.guardianDistrict, form.guardianAddressSameAsPermanent])

    function isBanglaField(name: string) {
        return (
            name === 'studentNameBn' ||
            name === 'studentNickNameBn' ||
            name === 'fatherNameBn' ||
            name === 'motherNameBn'
        )
    }

    function filterEnglishInput(value: string) {
        return value.replace(/[^\x20-\x7E]/g, '')
    }

    function filterBanglaInput(value: string) {
        return value.replace(/[^\u0980-\u09FF.()\s]/g, '')
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const target = e.target as HTMLInputElement
        const { name, type, checked } = target
        let value = target.value

        // Numeric fields that should only accept numbers
        const numericFields = [
            'roll', 'fatherNid', 'motherNid', 'guardianNid', 'birthRegNo',
            'fatherPhone', 'motherPhone', 'guardianPhone',
            'presentPostCode', 'permanentPostCode', 'guardianPostCode',
            'jscRegNo', 'jscRollNo'
        ]

        if (numericFields.includes(name)) {
            // Only allow digits for numeric fields
            value = value.replace(/\D/g, '')
        } else if (isBanglaField(name)) {
            value = filterBanglaInput(value)
        } else if (name !== 'jscPassingYear') {
            value = filterEnglishInput(value)
        }

        // Specific length restrictions for certain numeric fields
        if (name === 'fatherPhone' || name === 'motherPhone' || name === 'guardianPhone') {
            value = value.slice(0, 11)
        }
        if (name === 'presentPostCode' || name === 'permanentPostCode' || name === 'guardianPostCode') {
            value = value.slice(0, 4)
        }
        if (name === 'birthRegNo') {
            value = value.slice(0, 17)
        }
        if (name === 'fatherNid' || name === 'motherNid' || name === 'guardianNid') {
            value = value.slice(0, 17)
        }
        if (name === 'jscRegNo') {
            value = value.slice(0, 10)
        }
        if (name === 'birthYear') return

        setForm(prev => {
            const updated = { ...prev, [name]: type === 'checkbox' ? checked : value }
            if (name === 'birthMonth') {
                updated.birthDay = ''
            }
            if (sameAddress) {
                if (name === 'permanentDistrict') {
                    updated.presentDistrict = value
                }
                if (name === 'permanentUpazila') {
                    updated.presentUpazila = value
                }
                if (name === 'permanentPostOffice') {
                    updated.presentPostOffice = value
                }
                if (name === 'permanentPostCode') {
                    updated.presentPostCode = value
                }
                if (name === 'permanentVillageRoad') {
                    updated.presentVillageRoad = value
                }
            }
            if (guardianNotFather && name === 'guardianAddressSameAsPermanent') {
                if (checked) {
                    updated.guardianDistrict = prev.permanentDistrict
                    updated.guardianUpazila = prev.permanentUpazila
                    updated.guardianPostOffice = prev.permanentPostOffice
                    updated.guardianPostCode = prev.permanentPostCode
                    updated.guardianVillageRoad = prev.permanentVillageRoad
                } else {
                    updated.guardianDistrict = ''
                    updated.guardianUpazila = ''
                    updated.guardianPostOffice = ''
                    updated.guardianPostCode = ''
                    updated.guardianVillageRoad = ''
                }
            }
            return updated
        })
        setErrors(prev => ({ ...prev, [name]: '' }))
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, files } = e.target
        if (!files || files.length === 0) return
        const file = files[0]
        if (!file.type.startsWith('image/')) {
            setErrors(prev => ({ ...prev, [name]: 'Only image files are allowed' }))
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, [name]: 'File must be smaller than 2MB' }))
            return
        }
        setForm(prev => ({ ...prev, photo: file }))
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
        if (!form.jscPassingYear.trim()) e.jscPassingYear = 'JSC passing year is required'
        if (!jscPassingYears.includes(form.jscPassingYear)) e.jscPassingYear = 'Please select a valid JSC passing year'
        if (!form.jscBoard.trim()) e.jscBoard = 'JSC board is required'
        if (!form.jscRegNo.trim()) e.jscRegNo = 'JSC registration number is required'
        if (!/^\d{10}$/.test(form.jscRegNo)) e.jscRegNo = 'JSC registration number must be exactly 10 digits'
        if (!form.studentNameEn.trim()) e.studentNameEn = 'Student name (English) is required'
        if (!form.studentNameBn.trim()) e.studentNameBn = 'ছাত্রের নাম (বাংলায়) is required'
        if (!form.studentNickNameBn?.trim()) e.studentNickNameBn = 'ডাকনাম (এক শব্দে/বাংলায়) is required'
        if (!form.fatherNameEn.trim()) e.fatherNameEn = 'Father\'s name (English) is required'
        if (!form.fatherNameBn.trim()) e.fatherNameBn = 'পিতার নাম (বাংলায়) is required'
        if (!form.motherNameEn.trim()) e.motherNameEn = 'Mother\'s name (English) is required'
        if (!form.motherNameBn.trim()) e.motherNameBn = 'মাতার নাম (বাংলায়) is required'
        if (!form.birthRegNo.trim()) e.birthRegNo = 'Birth registration number is required'
        if (!/^\d{17}$/.test(form.birthRegNo)) e.birthRegNo = 'Birth registration number must be exactly 17 digits'
        if (!form.birthYear) e.birthYear = 'Birth year is required'
        if (!form.birthMonth) e.birthMonth = 'Birth month is required'
        if (!form.birthDay) e.birthDay = 'Birth day is required'
        if (form.birthYear && form.birthMonth && form.birthDay) {
            const dob = new Date(`${form.birthYear}-${form.birthMonth}-${form.birthDay}`)
            const minDate = new Date(`${minYear}-01-01`)
            if (dob > minDate) {
                e.birthYear = `Student must be at least 12 years old on 1st January ${currentYear}`
            }
        }
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address'
        if (!form.photo) e.photo = 'Student photo is required'

        // Father NID and mobile validation - always required
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

        // Mother NID and mobile validation - always required
        if (!form.motherNid.trim()) {
            e.motherNid = 'Mother\'s NID is required'
        } else if (!/^\d{10,17}$/.test(form.motherNid)) {
            e.motherNid = 'Mother\'s NID must be 10 to 17 digits'
        }
        if (!form.motherPhone.trim()) {
            e.motherPhone = 'Mother\'s mobile number is required'
        } else if (!/^[0-9]{11}$/.test(form.motherPhone)) {
            e.motherPhone = 'Enter a valid mobile number (exactly 11 digits)'
        }
        if (!form.presentDistrict.trim()) e.presentDistrict = 'Present district is required'
        if (!form.presentUpazila.trim()) e.presentUpazila = 'Present upazila is required'
        if (!form.presentPostOffice.trim()) e.presentPostOffice = 'Present post office is required'
        if (!form.presentPostCode.trim()) e.presentPostCode = 'Present post code is required'
        else if (!/^\d{4}$/.test(form.presentPostCode)) e.presentPostCode = 'Present post code must be exactly 4 digits'
        if (!form.presentVillageRoad.trim()) e.presentVillageRoad = 'Present village/road is required'
        if (!form.permanentDistrict.trim()) e.permanentDistrict = 'Permanent district is required'
        if (!form.permanentUpazila.trim()) e.permanentUpazila = 'Permanent upazila is required'
        if (!form.permanentPostOffice.trim()) e.permanentPostOffice = 'Permanent post office is required'
        if (!form.permanentPostCode.trim()) e.permanentPostCode = 'Permanent post code is required'
        else if (!/^\d{4}$/.test(form.permanentPostCode)) e.permanentPostCode = 'Permanent post code must be exactly 4 digits'
        if (!form.permanentVillageRoad.trim()) e.permanentVillageRoad = 'Permanent village/road is required'
        if (!form.section.trim()) e.section = 'Section is required'
        if (!form.roll.trim()) e.roll = 'Roll number is required'
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
                if (!form.guardianUpazila?.trim()) e.guardianUpazila = 'Guardian\'s upazila is required'
                if (!form.guardianPostOffice?.trim()) e.guardianPostOffice = 'Guardian\'s post office is required'
                if (!form.guardianPostCode?.trim()) e.guardianPostCode = 'Guardian\'s post code is required'
                else if (!/^\d{4}$/.test(form.guardianPostCode)) e.guardianPostCode = 'Guardian\'s post code must be exactly 4 digits'
                if (!form.guardianVillageRoad?.trim()) e.guardianVillageRoad = 'Guardian\'s village/road is required'
            }
        }
        if (!form.groupClassNine) e.groupClassNine = 'Group in class nine is required'
        if (!form.mainSubject) e.mainSubject = 'Main subject is required'
        if (!form.fourthSubject) e.fourthSubject = '4th subject is required'

        setErrors(e)
        if (Object.keys(e).length > 0) {
            console.log('Validation errors:', e)
        }
        return Object.keys(e).length === 0
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSuccess('')
        const valid = validate()
        if (!valid) {
            setTimeout(() => {
                const errorFields = Object.keys(errors)
                if (errorFields.length > 0) {
                    const firstErrorField = formRef.current?.querySelector(`[name="${errorFields[0]}"]`)
                    if (firstErrorField) {
                        (firstErrorField as HTMLElement).focus({ preventScroll: false })
                        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }
            }, 100)
            return
        }
        setLoading(true)
        const birthDate = `${form.birthYear}-${form.birthMonth}-${form.birthDay}`
        const payload = {
            ...form,
            birthDate,
            photo: form.photo?.name,
        }
        console.log('Submitting registration:', payload)
        setTimeout(() => {
            setSuccess('Registration submitted successfully (simulated). You can now send this data to your server.')
            setLoading(false)
        }, 1200)
    }

    useEffect(() => {
        if (sameAddress) {
            setForm(prev => ({
                ...prev,
                presentDistrict: prev.permanentDistrict,
                presentUpazila: prev.permanentUpazila,
            }))
        }
    }, [form.permanentDistrict, form.permanentUpazila, sameAddress])

    const subjectOptionsByGroup = {
        Science: {
            main: [
                { value: "Higher Mathematics", label: "উচ্চতর গণিত (Higher Mathematics) Code-126" },
                { value: "Biology", label: "জীববিজ্ঞান (Biology) Code-138" }
            ],
            fourth: [
                { value: "Higher Mathematics", label: "উচ্চতর গণিত (Higher Mathematics) Code-126" },
                { value: "Biology", label: "জীববিজ্ঞান (Biology) Code-138" },
                { value: "Agricultural Studies", label: "কৃষিশিক্ষা (Agricultural Studies) Code-134" },
                { value: "Geography & Environment", label: "ভূগোল ও পরিবেশ (Geography & Environment) Code-110" }
            ]
        },
        Humanities: {
            main: [
                { value: "Civics", label: "পৌরনীতি ও নাগরিকতা (Civics) Code-140" }
            ],
            fourth: [
                { value: "Agricultural Studies", label: "কৃষিশিক্ষা (Agricultural Studies) Code-134" },
            ]
        },
    }

    return (
        <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-blue-100 mb-4 py-2 sm:py-3 px-3 sm:px-4 rounded-t shadow-sm flex flex-col items-center">
                <h2 className="text-xl sm:text-2xl lg:text-3xl text-center font-bold text-blue-700 tracking-tight underline underline-offset-4 mb-1 sm:mb-2">Student's Information for SSC Exam Registration</h2>
                <span className="text-xs sm:text-sm text-gray-600 text-center px-2">Please fill all required fields. Fields marked <span className="text-red-600">*</span> are mandatory.</span>
            </div>
            {success && (
                <div className="mb-4 p-3 sm:p-4 bg-green-100 text-green-800 rounded text-sm sm:text-base animate-fade-in shadow">
                    {success}
                </div>
            )}
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-6">

                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={1} title="Personal Information" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label={<span>Section <Tooltip text="Your class section (e.g. A, B, C)" /></span>} required error={errors.section}>
                            <select
                                name="section"
                                value={form.section}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.section}
                            >
                                <option value="">Select Section</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                            </select>
                        </FieldRow>
                        <FieldRow label={<span>Roll <Tooltip text="Your roll number as assigned by the school" /></span>} required error={errors.roll}>
                            <input
                                name="roll"
                                value={form.roll}
                                type='number'
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Roll"
                                aria-invalid={!!errors.roll}
                            />
                        </FieldRow>
                        <FieldRow label={<span>Religion <Tooltip text="Your religion (e.g. Islam, Hinduism, etc.)" /></span>} required error={errors.religion}>
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
                        <FieldRow label={<span>ছাত্রের নাম (বাংলায়) <Tooltip text="জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী" /></span>} required instruction="(জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী)" error={errors.studentNameBn}>
                            <input name="studentNameBn" value={form.studentNameBn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="ছাত্রের নাম (বাংলায়)" aria-invalid={!!errors.studentNameBn} />
                        </FieldRow>
                        <FieldRow label={<span>ডাকনাম (এক শব্দে/বাংলায়) <Tooltip text="ছাত্রের ডাকনাম, এক শব্দে লিখুন" /></span>} required error={errors.studentNickNameBn}>
                            <input
                                name="studentNickNameBn"
                                value={form.studentNickNameBn}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="ডাকনাম (এক শব্দে/বাংলায়)"
                                aria-invalid={!!errors.studentNickNameBn}
                            />
                        </FieldRow>
                        <FieldRow label={<span>Student's Name (English) <Tooltip text="According to JSC/JDC Registration" /></span>} required instruction="(According to JSC/JDC Registration)" error={errors.studentNameEn}>
                            <input name="studentNameEn" value={form.studentNameEn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Student Name (In English)" aria-invalid={!!errors.studentNameEn} />
                        </FieldRow>
                        <FieldRow label="Birth Registration No" required error={errors.birthRegNo}>
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
                        <FieldRow label={<span>পিতার নাম (বাংলায়) <Tooltip text="জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী" /></span>} required instruction="(জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী)" error={errors.fatherNameBn}>
                            <input name="fatherNameBn" value={form.fatherNameBn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="পিতার নাম (বাংলায়)" aria-invalid={!!errors.fatherNameBn} />
                        </FieldRow>
                        <FieldRow label={<span>Father's Name (English) <Tooltip text="According to JSC/JDC Registration" /></span>} required instruction="(According to JSC/JDC Registration)" error={errors.fatherNameEn}>
                            <input name="fatherNameEn" value={form.fatherNameEn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Father's Name (In English)" aria-invalid={!!errors.fatherNameEn} />
                        </FieldRow>

                        <FieldRow label="Father's NID" required error={errors.fatherNid}>
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

                        <FieldRow label="Father's Mobile No" required error={errors.fatherPhone} >
                            <input
                                name="fatherPhone"
                                value={form.fatherPhone}
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={11}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="01XXXXXXXXX"
                                aria-invalid={!!errors.fatherPhone}
                            />
                        </FieldRow>

                        <FieldRow label={<span>মাতার নাম (বাংলায়) <Tooltip text="জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী" /></span>} required instruction="(জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী)" error={errors.motherNameBn}>
                            <input name="motherNameBn" value={form.motherNameBn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="মাতার নাম (বাংলায়)" aria-invalid={!!errors.motherNameBn} />
                        </FieldRow>
                        <FieldRow label={<span>Mother's Name (English) <Tooltip text="According to JSC/JDC Registration" /></span>} required instruction="(According to JSC/JDC Registration)" error={errors.motherNameEn}>
                            <input name="motherNameEn" value={form.motherNameEn} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Mother's Name (In English)" aria-invalid={!!errors.motherNameEn} />
                        </FieldRow>

                        <FieldRow label="Mother's NID" required error={errors.motherNid}>
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

                        <FieldRow label="Mother's Mobile No" required error={errors.motherPhone} >
                            <input
                                name="motherPhone"
                                value={form.motherPhone}
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={11}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="01XXXXXXXXX"
                                aria-invalid={!!errors.motherPhone}
                            />
                        </FieldRow>

                        <FieldRow label={<span>Date of Birth <Tooltip text={`Student must be at least 12 years old on 1st January ${currentYear}`} /></span>} required error={errors.birthYear || errors.birthMonth || errors.birthDay}>
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
                            <Instruction>
                                Student must be at least 12 years old on 1st January {currentYear}
                            </Instruction>
                        </FieldRow>
                        <FieldRow label="Blood Group ">
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

                        <FieldRow label="Email" error={errors.email}>
                            <input name="email" value={form.email} type='email' onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder='example@gmail.com' />
                        </FieldRow>
                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={2} title="Address" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <h4 className="font-semibold mb-2 text-sm sm:text-base">Permanent Address</h4>
                        <FieldRow label="District" required error={errors.permanentDistrict}>
                            <select name="permanentDistrict" value={form.permanentDistrict} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200">
                                <option value="">Select district</option>
                                {districts.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Upazila" required error={errors.permanentUpazila}>
                            <select
                                name="permanentUpazila"
                                value={form.permanentUpazila}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={!form.permanentDistrict}
                            >
                                <option value="">Select upazila</option>
                                {permanentUpazillas.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Post Office" required error={errors.permanentPostOffice}>
                            <input
                                name="permanentPostOffice"
                                value={form.permanentPostOffice}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Post Office Name"
                            />
                        </FieldRow>
                        <FieldRow label="Post Code" required error={errors.permanentPostCode}>
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
                        <FieldRow label="Village/Road No" required error={errors.permanentVillageRoad}>
                            <input
                                name="permanentVillageRoad"
                                value={form.permanentVillageRoad}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Village/Road No"
                            />
                        </FieldRow>
                        <h4 className="font-semibold mb-2 mt-4 sm:mt-6 text-sm sm:text-base">Present Address</h4>
                        <FieldRow label="Same as Permanent">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={sameAddress}
                                    onChange={(ev) => {
                                        const checked = ev.target.checked
                                        setSameAddress(checked)
                                        if (checked) {
                                            setForm(prev => ({
                                                ...prev,
                                                presentDistrict: prev.permanentDistrict,
                                                presentUpazila: prev.permanentUpazila,
                                                presentPostOffice: prev.permanentPostOffice,
                                                presentPostCode: prev.permanentPostCode,
                                                presentVillageRoad: prev.permanentVillageRoad,
                                            }))
                                            setErrors(prev => ({ ...prev, presentDistrict: '', presentUpazila: '', presentPostOffice: '', presentPostCode: '', presentVillageRoad: '' }))
                                        } else {
                                            setForm(prev => ({
                                                ...prev,
                                                presentDistrict: '',
                                                presentUpazila: '',
                                                presentPostOffice: '',
                                                presentPostCode: '',
                                                presentVillageRoad: '',
                                            }))
                                        }
                                    }}
                                />
                                <span className="text-sm">Same as Permanent Address</span>
                            </label>
                        </FieldRow>
                        {!sameAddress && (
                            <div className="space-y-2">
                                <FieldRow label="District" required error={errors.presentDistrict}>
                                    <select name="presentDistrict" value={form.presentDistrict} onChange={handleChange} className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200">
                                        <option value="">Select district</option>
                                        {districts.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </FieldRow>
                                <FieldRow label="Upazila" required error={errors.presentUpazila}>
                                    <select
                                        name="presentUpazila"
                                        value={form.presentUpazila}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        disabled={!form.presentDistrict}
                                    >
                                        <option value="">Select upazila</option>
                                        {presentUpazillas.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </FieldRow>
                                <FieldRow label="Post Office" required error={errors.presentPostOffice}>
                                    <input
                                        name="presentPostOffice"
                                        value={form.presentPostOffice}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Post Office Name"
                                    />
                                </FieldRow>
                                <FieldRow label="Post Code" required error={errors.presentPostCode}>
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
                                <FieldRow label="Village/Road No" required error={errors.presentVillageRoad}>
                                    <input
                                        name="presentVillageRoad"
                                        value={form.presentVillageRoad}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Village/Road No"
                                    />
                                </FieldRow>
                            </div>
                        )}
                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={3} title="Guardian Information (if not father)" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Guardian is not the father">
                            <label className="inline-flex items-start sm:items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={guardianNotFather}
                                    onChange={e => {
                                        setGuardianNotFather(e.target.checked)
                                        if (!e.target.checked) {
                                            setForm(prev => ({
                                                ...prev,
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
                                            }))
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
                                <FieldRow label="Guardian's Name" required error={errors.guardianName}>
                                    <input
                                        name="guardianName"
                                        value={form.guardianName}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian's Name"
                                        aria-invalid={!!errors.guardianName}
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian's NID" required error={errors.guardianNid}>
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
                                <FieldRow label="Guardian's Mobile No" required error={errors.guardianPhone}>
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
                                <FieldRow label="Relationship with Guardian" required error={errors.guardianRelation}>
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
                                <FieldRow label="Guardian's Address">
                                    <label className="inline-flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            name="guardianAddressSameAsPermanent"
                                            checked={form.guardianAddressSameAsPermanent}
                                            onChange={handleChange}
                                        />
                                        <span className="text-sm">Same as Permanent Address</span>
                                    </label>
                                </FieldRow>
                                {!form.guardianAddressSameAsPermanent && (
                                    <div className="space-y-2">
                                        <FieldRow label="District" required error={errors.guardianDistrict}>
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
                                        <FieldRow label="Upazila" required error={errors.guardianUpazila}>
                                            <select
                                                name="guardianUpazila"
                                                value={form.guardianUpazila}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                disabled={!form.guardianDistrict}
                                            >
                                                <option value="">Select upazila</option>
                                                {guardianUpazillas.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="Post Office" required error={errors.guardianPostOffice}>
                                            <input
                                                name="guardianPostOffice"
                                                value={form.guardianPostOffice}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Post Office Name"
                                            />
                                        </FieldRow>
                                        <FieldRow label="Post Code" required error={errors.guardianPostCode}>
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
                                        <FieldRow label="Village/Road No" required error={errors.guardianVillageRoad}>
                                            <input
                                                name="guardianVillageRoad"
                                                value={form.guardianVillageRoad}
                                                onChange={handleChange}
                                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Village/Road No"
                                            />
                                        </FieldRow>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                <section className="mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                        <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-lg shadow">4</span>
                        <h3 className="text-base sm:text-lg lg:text-xl font-semibold">Student Photo</h3>
                    </div>
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md">
                        <div className="flex flex-col lg:flex-row items-start gap-1 lg:gap-4 py-2 w-full">
                            <div className="w-full lg:w-60 text-left text-sm font-medium select-none mb-1 lg:mb-0 flex-shrink-0">
                                <span>Photo <Tooltip text="Upload a clear passport-size photo (jpg/png, less than 2MB)" /><span className="text-red-600 ml-1" aria-hidden="true">*</span></span>
                                <span className="mx-2 hidden lg:inline">:</span>
                            </div>
                            <div className="flex-1 w-full min-w-0">
                                <div className="relative group">
                                    <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 bg-gray-50 transition group-hover:border-blue-400 group-focus-within:border-blue-400 cursor-pointer overflow-hidden mx-auto lg:mx-0">
                                        {!photoPreview
                                            ? <span className="text-xs sm:text-sm text-center text-gray-500 px-2">Click or drag to upload image</span>
                                            : <img src={photoPreview} alt="photo preview" className="w-full h-full object-cover rounded" />}
                                    </div>
                                    <input
                                        type="file"
                                        name="photo"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        aria-invalid={!!errors.photo}
                                    />
                                </div>
                                {errors.photo && <Error>{errors.photo}</Error>}
                            </div>
                        </div>
                    </div>
                </section>
                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={5} title="Previous School Information" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Name of Previous School" required error={errors.prevSchoolName}>
                            <input
                                name="prevSchoolName"
                                value={form.prevSchoolName}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="e.g. PGPS"
                                aria-invalid={!!errors.prevSchoolName}
                            />
                        </FieldRow>
                        <FieldRow label="District" required error={errors.prevSchoolDistrict}>
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
                        <FieldRow label="Upazila/Thana" required error={errors.prevSchoolUpazila}>
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
                    <SectionHeader step={6} title="JSC/JDC Information" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="flex-1">
                                <FieldRow label="JSC Passing Year" required error={errors.jscPassingYear}>
                                    <select
                                        name="jscPassingYear"
                                        value={form.jscPassingYear}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        aria-invalid={!!errors.jscPassingYear}
                                    >
                                        <option value="">Select Year</option>
                                        {jscPassingYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </FieldRow>
                            </div>
                            <div className="flex-1">
                                <FieldRow label="JSC Board" required error={errors.jscBoard}>
                                    <select
                                        name="jscBoard"
                                        value={form.jscBoard}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        aria-invalid={!!errors.jscBoard}
                                    >
                                        <option value="">Select Board</option>
                                        <option value="Rajshahi">Rajshahi</option>
                                        <option value="Dhaka">Dhaka</option>
                                        <option value="Chittagong">Chittagong</option>
                                        <option value="Barisal">Barisal</option>
                                        <option value="Comilla">Comilla</option>
                                        <option value="Dinajpur">Dinajpur</option>
                                        <option value="Jessore">Jessore</option>
                                        <option value="Sylhet">Sylhet</option>
                                        <option value="Barisal">Barisal</option>
                                        <option value="Madrasah">Madrasah</option>
                                        <option value="Technical">Technical</option>
                                    </select>
                                </FieldRow>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="flex-1">
                                <FieldRow label="JSC Registration Number" required error={errors.jscRegNo}>
                                    <input
                                        name="jscRegNo"
                                        value={form.jscRegNo}
                                        onChange={handleChange}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d{10}"
                                        maxLength={10}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        placeholder="1234567890"
                                        aria-invalid={!!errors.jscRegNo}
                                    />
                                </FieldRow>
                            </div>
                            <div className="flex-1">
                                <FieldRow label="JSC Roll Number">
                                    <input
                                        name="jscRollNo"
                                        value={form.jscRollNo}
                                        onChange={handleChange}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        placeholder="(if any)"
                                    />
                                </FieldRow>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-4 sm:mb-6">
                    <SectionHeader step={7} title="Class Nine Information" />
                    <div className="border rounded-lg p-3 sm:p-4 lg:p-6 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Group in Class Nine" required error={errors.groupClassNine}>
                            <select
                                name="groupClassNine"
                                value={form.groupClassNine}

                                onChange={e => {
                                    handleChange(e);
                                    setForm(prev => ({
                                        ...prev,
                                        mainSubject: '',
                                        fourthSubject: ''
                                    }));
                                }}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.groupClassNine}
                            >
                                <option value="">Select Group</option>
                                <option value="Science">Science</option>
                                <option value="Humanities">Humanities</option>
                            </select>
                        </FieldRow>
                        <FieldRow label="Main Subject" required error={errors.mainSubject}>
                            <select
                                name="mainSubject"
                                value={form.mainSubject}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.mainSubject}
                                disabled={!form.groupClassNine}
                            >
                                <option value="">Select Main Subject</option>
                                {form.groupClassNine &&
                                    subjectOptionsByGroup[form.groupClassNine as keyof typeof subjectOptionsByGroup]?.main.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))
                                }
                            </select>
                        </FieldRow>
                        <FieldRow label="4th Subject" required error={errors.fourthSubject}>
                            <select
                                name="fourthSubject"
                                value={form.fourthSubject}
                                onChange={handleChange}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                aria-invalid={!!errors.fourthSubject}
                                disabled={!form.groupClassNine}
                            >
                                <option value="">Select 4th Subject</option>
                                {form.groupClassNine &&
                                    subjectOptionsByGroup[form.groupClassNine as keyof typeof subjectOptionsByGroup]?.fourth
                                        .filter(opt => opt.value !== form.mainSubject)
                                        .map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))
                                }
                            </select>
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
                        {loading ? 'Submitting...' : 'Submit Registration'}
                    </button>
                    <button
                        type="button"
                        className="px-6 py-3 border border-gray-300 rounded shadow bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition text-sm sm:text-base"
                        onClick={() => {
                            setForm({
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
                                section: '',
                                roll: '',
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
                                jscPassingYear: '',
                                jscBoard: '',
                                jscRegNo: '',
                                jscRollNo: '',
                                groupClassNine: '',
                                mainSubject: '',
                                fourthSubject: '',
                            }); setPhotoPreview(null); setErrors({}); setSuccess('')
                            setSameAddress(false)
                            setGuardianNotFather(false)
                        }}
                        disabled={loading}
                    >Reset</button>
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

export default Registration