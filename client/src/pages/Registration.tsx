import React, { useState, useEffect, useRef } from 'react'

const Instruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-gray-900">{children}</p>
)
const Error: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-red-600 text-sm">{children}</div>
)
type FormState = {
    studentNameEn: string
    studentNameBn: string
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
    phone: string
    email: string
    presentAddress: string
    permanentAddress: string
    presentDivision: string
    presentDistrict: string
    presentUpazila: string
    presentPostOffice: string
    presentPostCode: string
    presentVillageRoad: string
    permanentDivision: string
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
    // Guardian fields
    guardianName?: string
    guardianNid?: string
    guardianPhone?: string
    guardianRelation?: string
    guardianAddress?: string
    guardianAddressSameAsPresent?: boolean
    // Guardian address fields (structured)
    guardianDivision?: string
    guardianDistrict?: string
    guardianPostOffice?: string
    guardianPostCode?: string
    guardianVillageRoad?: string
    guardianUpazila?: string
}

const FieldRow: React.FC<{
    label: React.ReactNode
    required?: boolean
    instruction?: React.ReactNode
    error?: string | undefined
    children: React.ReactNode
}> = ({ label, required, instruction, error, children }) => (
    <div className="flex flex-col md:flex-row items-start gap-1 md:gap-4 py-2 w-full">
        <div className="w-full md:w-56 text-left text-sm font-medium select-none mb-1 md:mb-0 flex-shrink-0">
            <span>{label}{required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}</span>
            <span className="mx-2">:</span>
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
    <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-lg shadow">{step}</span>
        <h3 className="text-lg md:text-xl font-semibold">{title}</h3>
    </div>
)

function Registration() {
    const [form, setForm] = useState<FormState>({
        studentNameEn: '',
        studentNameBn: '',
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
        phone: '',
        email: '',
        presentAddress: '',
        permanentAddress: '',
        presentDivision: '',
        presentDistrict: '',
        presentUpazila: '',
        presentPostOffice: '',
        presentPostCode: '',
        presentVillageRoad: '',
        permanentDivision: '',
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
        // Guardian fields
        guardianName: '',
        guardianNid: '',
        guardianPhone: '',
        guardianRelation: '',
        guardianAddress: '',
        guardianAddressSameAsPresent: false,
        guardianDivision: '',
        guardianDistrict: '',
        guardianUpazila: '',
        guardianPostOffice: '',
        guardianPostCode: '',
        guardianVillageRoad: '',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [success, setSuccess] = useState('')
    const [sameAddress, setSameAddress] = useState(false)
    const [guardianNotParents, setGuardianNotParents] = useState(false)
    const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([])
    const [presentDistricts, setPresentDistricts] = useState<{ id: string; name: string }[]>([])
    const [presentUpazillas, setPresentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [permanentDistricts, setPermanentDistricts] = useState<{ id: string; name: string }[]>([])
    const [permanentUpazillas, setPermanentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [guardianDistricts, setGuardianDistricts] = useState<{ id: string; name: string }[]>([])
    const [guardianUpazillas, setGuardianUpazillas] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)

    function normalizeList(items: { id: string; name: string }[]): { id: string; name: string }[] {
        if (!Array.isArray(items)) return []
        return items.map(i => {
            const id = String(i.id ?? '')
            const name = i.name ?? ''
            return { id, name }
        })
    }

    useEffect(() => {
        fetch('https://bdapi.vercel.app/api/v.1/division')
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.divisions ?? []
                setDivisions(normalizeList(items))
            })
            .catch(() => setDivisions([]))
    }, [])

    useEffect(() => {
        const selectedDivisionName = form.presentDivision
        if (!selectedDivisionName) {
            setPresentDistricts([])
            setPresentUpazillas([])
            setForm(prev => ({ ...prev, presentDistrict: '', presentUpazila: '' }))
            return
        }
        const selectedDivision = divisions.find(d => d.name === selectedDivisionName)
        if (!selectedDivision) return

        fetch(`https://bdapi.vercel.app/api/v.1/district/${encodeURIComponent(selectedDivision.id)}`)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.districts ?? []
                setPresentDistricts(normalizeList(items))
                setPresentUpazillas([])
                setForm(prev => ({ ...prev, presentDistrict: '', presentUpazila: '' }))
            })
            .catch(() => {
                setPresentDistricts([])
                setPresentUpazillas([])
            })
    }, [form.presentDivision, divisions])

    useEffect(() => {
        const selectedDistrictName = form.presentDistrict
        if (!selectedDistrictName) {
            setPresentUpazillas([])
            setForm(prev => ({ ...prev, presentUpazila: '' }))
            return
        }
        const selectedDistrict = presentDistricts.find(d => d.name === selectedDistrictName)
        if (!selectedDistrict) return

        fetch(`https://bdapi.vercel.app/api/v.1/upazilla/${encodeURIComponent(selectedDistrict.id)}`)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.upazillas ?? []
                setPresentUpazillas(normalizeList(items))
                setForm(prev => ({ ...prev, presentUpazila: '' }))
            })
            .catch(() => setPresentUpazillas([]))
    }, [form.presentDistrict, presentDistricts])

    useEffect(() => {
        const selectedDivisionName = form.permanentDivision
        if (!selectedDivisionName) {
            setPermanentDistricts([])
            setPermanentUpazillas([])
            setForm(prev => ({ ...prev, permanentDistrict: '', permanentUpazila: '' }))
            return
        }
        const selectedDivision = divisions.find(d => d.name === selectedDivisionName)
        if (!selectedDivision) return

        fetch(`https://bdapi.vercel.app/api/v.1/district/${encodeURIComponent(selectedDivision.id)}`)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.districts ?? []
                setPermanentDistricts(normalizeList(items))
                setPermanentUpazillas([])
                setForm(prev => ({ ...prev, permanentDistrict: '', permanentUpazila: '' }))
            })
            .catch(() => {
                setPermanentDistricts([])
                setPermanentUpazillas([])
            })
    }, [form.permanentDivision, divisions])

    useEffect(() => {
        const selectedDistrictName = form.permanentDistrict
        if (!selectedDistrictName) {
            setPermanentUpazillas([])
            setForm(prev => ({ ...prev, permanentUpazila: '' }))
            return
        }
        const selectedDistrict = permanentDistricts.find(d => d.name === selectedDistrictName)
        if (!selectedDistrict) return

        fetch(`https://bdapi.vercel.app/api/v.1/upazilla/${encodeURIComponent(selectedDistrict.id)}`)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.upazillas ?? []
                setPermanentUpazillas(normalizeList(items))
                setForm(prev => ({ ...prev, permanentUpazila: '' }))
            })
            .catch(() => setPermanentUpazillas([]))
    }, [form.permanentDistrict, permanentDistricts])

    // Helper arrays for dropdowns
    const currentYear = new Date().getFullYear()
    const minYear = currentYear - 15
    // Allow all years up to minYear (older students allowed)
    const years = Array.from({ length: 40 }, (_, i) => String(minYear - i))
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

    // Restrict month/day for minYear to only allow dates <= 1st Jan of current year
    let days: string[] = []
    let monthOptions = months
    let disableMonth = false
    let disableDay = false
    if (form.birthYear && years.includes(form.birthYear)) {
        if (form.birthYear === String(minYear)) {
            // Only allow January
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
            // For years less than minYear, allow all months/days
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

    // Guardian address sync
    useEffect(() => {
        if (guardianNotParents && form.guardianAddressSameAsPresent) {
            setForm(prev => ({
                ...prev,
                guardianAddress: form.presentAddress,
                guardianDivision: form.presentDivision,
                guardianDistrict: form.presentDistrict,
                guardianUpazila: form.presentUpazila,
                guardianPostOffice: form.presentPostOffice,
                guardianPostCode: form.presentPostCode,
                guardianVillageRoad: form.presentVillageRoad,
            }))
        }
    }, [
        guardianNotParents,
        form.guardianAddressSameAsPresent,
        form.presentAddress,
        form.presentDivision,
        form.presentDistrict,
        form.presentUpazila,
        form.presentPostOffice,
        form.presentPostCode,
        form.presentVillageRoad
    ])

    // Guardian division/district/upazila dropdowns
    useEffect(() => {
        if (!guardianNotParents || form.guardianAddressSameAsPresent) {
            setGuardianDistricts([])
            setGuardianUpazillas([])
            return
        }
        const selectedDivision = divisions.find(d => d.name === form.guardianDivision)
        if (!selectedDivision) {
            setGuardianDistricts([])
            setGuardianUpazillas([])
            setForm(prev => ({ ...prev, guardianDistrict: '', guardianUpazila: '' }))
            return
        }
        fetch(`https://bdapi.vercel.app/api/v.1/district/${encodeURIComponent(selectedDivision.id)}`)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.districts ?? []
                setGuardianDistricts(items.map((i: { id: number, name: string }) => ({ id: String(i.id ?? ''), name: i.name ?? '' })))
                setGuardianUpazillas([])
                setForm(prev => ({ ...prev, guardianDistrict: '', guardianUpazila: '' }))
            })
            .catch(() => {
                setGuardianDistricts([])
                setGuardianUpazillas([])
            })
    }, [guardianNotParents, form.guardianDivision, divisions, form.guardianAddressSameAsPresent])

    useEffect(() => {
        if (!guardianNotParents || form.guardianAddressSameAsPresent) {
            setGuardianUpazillas([])
            return
        }
        const selectedDistrict = guardianDistricts.find(d => d.name === form.guardianDistrict)
        if (!selectedDistrict) {
            setGuardianUpazillas([])
            setForm(prev => ({ ...prev, guardianUpazila: '' }))
            return
        }
        fetch(`https://bdapi.vercel.app/api/v.1/upazilla/${encodeURIComponent(selectedDistrict.id)}`)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data) ? data : data?.data ?? data?.upazillas ?? []
                setGuardianUpazillas(items.map((i: { id: number, name: string }) => ({ id: String(i.id ?? ''), name: i.name ?? '' })))
                setForm(prev => ({ ...prev, guardianUpazila: '' }))
            })
            .catch(() => setGuardianUpazillas([]))
    }, [guardianNotParents, form.guardianDistrict, guardianDistricts, form.guardianAddressSameAsPresent])

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const target = e.target as HTMLInputElement
        const { name, value, type, checked } = target
        // Prevent manual change of birthYear
        if (name === 'birthYear') return
        setForm(prev => {
            const updated = { ...prev, [name]: type === 'checkbox' ? checked : value }
            // Reset day if month changes
            if (name === 'birthMonth') {
                updated.birthDay = ''
            }
            if (name === 'presentAddress' && sameAddress) {
                updated.permanentAddress = value
            }
            if (sameAddress) {
                if (name === 'presentDivision') {
                    updated.permanentDivision = value
                }
                if (name === 'presentDistrict') {
                    updated.permanentDistrict = value
                }
                if (name === 'presentUpazila') {
                    updated.permanentUpazila = value
                }
                if (name === 'presentPostOffice') {
                    updated.permanentPostOffice = value
                }
                if (name === 'presentPostCode') {
                    updated.permanentPostCode = value
                }
                if (name === 'presentVillageRoad') {
                    updated.permanentVillageRoad = value
                }
            }
            // Guardian address sync
            if (guardianNotParents && name === 'guardianAddressSameAsPresent') {
                if (checked) {
                    updated.guardianAddress = prev.presentAddress
                    updated.guardianDivision = prev.presentDivision
                    updated.guardianDistrict = prev.presentDistrict
                    updated.guardianUpazila = prev.presentUpazila
                    updated.guardianPostOffice = prev.presentPostOffice
                    updated.guardianPostCode = prev.presentPostCode
                    updated.guardianVillageRoad = prev.presentVillageRoad
                } else {
                    updated.guardianAddress = ''
                    updated.guardianDivision = ''
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
        if (!form.studentNameEn.trim()) e.studentNameEn = 'Student name (English) is required'
        if (!form.studentNameBn.trim()) e.studentNameBn = 'ছাত্রের নাম (বাংলা) is required'
        if (!form.fatherNameEn.trim()) e.fatherNameEn = 'Father name (English) is required'
        if (!form.fatherNameBn.trim()) e.fatherNameBn = 'পিতার নাম (বাংলা) is required'
        if (!form.motherNameEn.trim()) e.motherNameEn = 'Mother name (English) is required'
        if (!form.motherNameBn.trim()) e.motherNameBn = 'মাতার নাম (বাংলা) is required'
        if (!form.birthRegNo.trim()) e.birthRegNo = 'Birth Reg No is required'
        if (!/^\d{17,17}$/.test(form.birthRegNo)) e.birthRegNo = 'Birth Reg No must be 17 digits'
        // Only allow 15 years completed on 1st Jan of current year or older
        if (!form.birthYear) e.birthYear = 'Birth year is required'
        if (!form.birthMonth) e.birthMonth = 'Birth month is required'
        if (!form.birthDay) e.birthDay = 'Birth day is required'
        if (
            !form.birthYear ||
            !form.birthMonth ||
            !form.birthDay
        ) {
            // already handled above
        } else {
            // Check if date is at least 15 years before 1st Jan of current year
            const dob = new Date(`${form.birthYear}-${form.birthMonth}-${form.birthDay}`)
            const minDate = new Date(`${minYear}-01-01`)
            if (dob > minDate) {
                e.birthYear = `Student must be at least 15 years old on 1st January ${currentYear}`
            }
        }
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
        if (!form.photo) e.photo = 'Student photo is required'
        const parentPhoneProvided = !!form.fatherPhone.trim() || !!form.motherPhone.trim()
        if (!parentPhoneProvided) {
            const msg = 'Provide at least one parent phone number (father or mother)'
            e.fatherPhone = msg
            e.motherPhone = msg
        } else {
            const phoneRegex = /^[0-9+\- ]{6,20}$/
            if (form.fatherPhone.trim() && !phoneRegex.test(form.fatherPhone)) {
                e.fatherPhone = 'Enter a valid phone number'
            }
            if (form.motherPhone.trim() && !phoneRegex.test(form.motherPhone)) {
                e.motherPhone = 'Enter a valid phone number'
            }
        }
        // Always require present and permanent address fields
        if (!form.presentAddress.trim()) e.presentAddress = 'Present address is required'
        if (!form.permanentAddress.trim()) e.permanentAddress = 'Permanent address is required'
        if (!form.presentDivision.trim()) e.presentDivision = 'Present division is required'
        if (!form.presentDistrict.trim()) e.presentDistrict = 'Present district is required'
        if (!form.presentUpazila.trim()) e.presentUpazila = 'Present upazila is required'
        if (!form.presentPostOffice.trim()) e.presentPostOffice = 'Present post office is required'
        if (!form.presentPostCode.trim()) e.presentPostCode = 'Present post code is required'
        if (!form.presentVillageRoad.trim()) e.presentVillageRoad = 'Present village/road is required'
        if (!form.permanentDivision.trim()) e.permanentDivision = 'Permanent division is required'
        if (!form.permanentDistrict.trim()) e.permanentDistrict = 'Permanent district is required'
        if (!form.permanentUpazila.trim()) e.permanentUpazila = 'Permanent upazila is required'
        if (!form.permanentPostOffice.trim()) e.permanentPostOffice = 'Permanent post office is required'
        if (!form.permanentPostCode.trim()) e.permanentPostCode = 'Permanent post code is required'
        if (!form.permanentVillageRoad.trim()) e.permanentVillageRoad = 'Permanent village/road is required'
        // Section, Roll, Religion required
        if (!form.section.trim()) e.section = 'Section is required'
        if (!form.roll.trim()) e.roll = 'Roll is required'
        if (!form.religion.trim()) e.religion = 'Religion is required'
        // Guardian validation
        if (guardianNotParents) {
            if (!form.guardianName?.trim()) e.guardianName = 'Guardian name is required'
            if (!form.guardianRelation?.trim()) e.guardianRelation = 'Relation with guardian is required'
            if (!form.guardianPhone?.trim()) {
                e.guardianPhone = 'Guardian phone number is required'
            } else {
                const phoneRegex = /^[0-9+\- ]{6,20}$/
                if (!phoneRegex.test(form.guardianPhone)) {
                    e.guardianPhone = 'Enter a valid phone number'
                }
            }
            // Guardian address fields required
            if (!form.guardianAddressSameAsPresent) {
                if (!form.guardianAddress?.trim()) e.guardianAddress = 'Guardian address is required'
                if (!form.guardianDivision?.trim()) e.guardianDivision = 'Guardian division is required'
                if (!form.guardianDistrict?.trim()) e.guardianDistrict = 'Guardian district is required'
                if (!form.guardianUpazila?.trim()) e.guardianUpazila = 'Guardian upazila is required'
                if (!form.guardianPostOffice?.trim()) e.guardianPostOffice = 'Guardian post office is required'
                if (!form.guardianPostCode?.trim()) e.guardianPostCode = 'Guardian post code is required'
                if (!form.guardianVillageRoad?.trim()) e.guardianVillageRoad = 'Guardian village/road is required'
            }
        }
        setErrors(e)
        return Object.keys(e).length === 0
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSuccess('')
        if (!validate()) {
            // Scroll to first error field
            setTimeout(() => {
                const firstError = formRef.current?.querySelector('[aria-invalid="true"]')
                if (firstError) {
                    (firstError as HTMLElement).focus({ preventScroll: false })
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }, 100)
            return
        }
        setLoading(true)
        // Combine birth date
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

    return (
        <div className="max-w-full md:max-w-3xl lg:max-w-4xl mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6">
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-blue-100 mb-4 py-2 px-2 rounded-t shadow-sm flex flex-col items-center">
                <h2 className="text-2xl md:text-3xl text-center font-bold text-blue-700 tracking-tight underline underline-offset-4 mb-1">SSC Student Registration (Bangladesh)</h2>
                <span className="text-sm text-gray-600">Please fill all required fields. Fields marked <span className="text-red-600">*</span> are mandatory.</span>
            </div>
            {success && (
                <div className="mb-4 p-2 md:p-3 bg-green-100 text-green-800 rounded-sm animate-fade-in shadow">
                    {success}
                </div>
            )}
            <form ref={formRef} onSubmit={handleSubmit} noValidate>
                {/* Step 1: Personal Info */}
                <section className="mb-6">
                    <SectionHeader step={1} title="Personal Information" />
                    <div className="border rounded-lg p-4 bg-white shadow-md flex flex-col gap-y-2">
                        {/* --- All fields in column order --- */}
                        <FieldRow label={<span>Section <Tooltip text="Your class section (e.g. A, B, C)" /></span>} required error={errors.section}>
                            <input
                                name="section"
                                value={form.section}
                                onChange={handleChange}
                                className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Section"
                                aria-invalid={!!errors.section}
                            />
                        </FieldRow>
                        <FieldRow label={<span>Roll <Tooltip text="Your roll number as assigned by the school" /></span>} required error={errors.roll}>
                            <input
                                name="roll"
                                value={form.roll}
                                onChange={handleChange}
                                className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Roll"
                                aria-invalid={!!errors.roll}
                            />
                        </FieldRow>
                        <FieldRow label={<span>Religion <Tooltip text="Your religion (e.g. Islam, Hinduism, etc.)" /></span>} required error={errors.religion}>
                            <input
                                name="religion"
                                value={form.religion}
                                onChange={handleChange}
                                className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Religion"
                                aria-invalid={!!errors.religion}
                            />
                        </FieldRow>
                        <FieldRow label={<span>Student's Name (English) <Tooltip text="According to JSC/JDC Registration" /></span>} required instruction="(According to JSC/JDC Registration)" error={errors.studentNameEn}>
                            <input name="studentNameEn" value={form.studentNameEn} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Student Name (English)" aria-invalid={!!errors.studentNameEn} />
                        </FieldRow>
                        <FieldRow label={<span>ছাত্রের নাম (বাংলা) <Tooltip text="জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী" /></span>} required instruction="(জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী)" error={errors.studentNameBn}>
                            <input name="studentNameBn" value={form.studentNameBn} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="ছাত্রের নাম (বাংলা)" aria-invalid={!!errors.studentNameBn} />
                        </FieldRow>
                        <FieldRow label="Birth Reg No" required error={errors.birthRegNo}>
                            <input name="birthRegNo" value={form.birthRegNo} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder='20XXXXXXXXXXXXXXX' aria-invalid={!!errors.birthRegNo} />
                        </FieldRow>
                        <FieldRow label={<span>Father's Name (English) <Tooltip text="According to JSC/JDC Registration" /></span>} required instruction="(According to JSC/JDC Registration)" error={errors.fatherNameEn}>
                            <input name="fatherNameEn" value={form.fatherNameEn} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Father's Name (English)" aria-invalid={!!errors.fatherNameEn} />
                        </FieldRow>
                        <FieldRow label={<span>পিতার নাম (বাংলা) <Tooltip text="জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী" /></span>} required instruction="(জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী)" error={errors.fatherNameBn}>
                            <input name="fatherNameBn" value={form.fatherNameBn} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="পিতার নাম (বাংলা)" aria-invalid={!!errors.fatherNameBn} />
                        </FieldRow>
                        <FieldRow label="Father's NID"  >
                            <input name="fatherNid" value={form.fatherNid} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="1234567890" />
                        </FieldRow>
                        <FieldRow label="Father's Phone " error={errors.fatherPhone} >
                            <input name="fatherPhone" value={form.fatherPhone} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="01XXXXXXXXX" aria-invalid={!!errors.fatherPhone} />
                        </FieldRow>
                        <FieldRow label={<span>Mother's Name (English) <Tooltip text="According to JSC/JDC Registration" /></span>} required instruction="(According to JSC/JDC Registration)" error={errors.motherNameEn}>
                            <input name="motherNameEn" value={form.motherNameEn} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Mother's Name (English)" aria-invalid={!!errors.motherNameEn} />
                        </FieldRow>
                        <FieldRow label={<span>মাতার নাম (বাংলা) <Tooltip text="জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী" /></span>} required instruction="(জেএসসি/জেডিসি রেজিস্ট্রেশন অনুযায়ী)" error={errors.motherNameBn}>
                            <input name="motherNameBn" value={form.motherNameBn} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="মাতার নাম (বাংলা)" aria-invalid={!!errors.motherNameBn} />
                        </FieldRow>
                        <FieldRow label="Mother's NID "  >
                            <input name="motherNid" value={form.motherNid} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="1234567890" />
                        </FieldRow>
                        <FieldRow label="Mother's Phone " error={errors.motherPhone} >
                            <input name="motherPhone" value={form.motherPhone} onChange={handleChange} className="block w-full border rounded px-2 py-1 transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="01XXXXXXXXX" aria-invalid={!!errors.motherPhone} />
                        </FieldRow>
                        <FieldRow label={<span>Date of Birth <Tooltip text={`Student must be at least 15 years old on 1st January ${currentYear}`} /></span>} required error={errors.birthYear || errors.birthMonth || errors.birthDay}>
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                                <input
                                    name="birthYear"
                                    value={form.birthYear}
                                    className="border rounded px-2 py-1 bg-gray-100 w-full sm:w-28"
                                    placeholder="Year"
                                    readOnly
                                    tabIndex={-1}
                                    aria-invalid={!!errors.birthYear}
                                />
                                <select
                                    name="birthMonth"
                                    value={form.birthMonth}
                                    onChange={handleChange}
                                    className="border rounded px-2 py-1 w-full sm:w-36 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
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
                                    className="border rounded px-2 py-1 w-full sm:w-24 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                    disabled={disableDay || !form.birthYear || !form.birthMonth}
                                    aria-invalid={!!errors.birthDay}
                                >
                                    <option value="">Day</option>
                                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <Instruction>
                                Student must be at least 15 years old on 1st January {currentYear}
                            </Instruction>
                        </FieldRow>
                        <FieldRow label="Blood Group ">
                            <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200">
                                <option value="">Select / নির্বাচন করুন</option>
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
                            <input name="email" value={form.email} onChange={handleChange} className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder='example@gmail.com' />
                        </FieldRow>
                    </div>
                </section>
                {/* Step 2: Address */}
                <section className="mb-6">
                    <SectionHeader step={2} title="Address / ঠিকানা" />
                    <div className="border rounded-lg p-4 bg-white shadow-md flex flex-col gap-y-2">
                        {/* Present Address */}
                        <h4 className="font-semibold mb-2">Present Address / বর্তমান ঠিকানা</h4>
                        <FieldRow label="Address" error={errors.presentAddress}>
                            <textarea name="presentAddress" value={form.presentAddress} onChange={handleChange} className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200" rows={3} />
                        </FieldRow>
                        <FieldRow label="Division" error={errors.presentDivision}>
                            <select name="presentDivision" value={form.presentDivision} onChange={handleChange} className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200">
                                <option value="">Select division / বিভাগ নির্বাচন করুন</option>
                                {divisions.map((d) => (
                                    <option key={d.id} value={d.name}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="District" error={errors.presentDistrict}>
                            <select
                                name="presentDistrict"
                                value={form.presentDistrict}
                                onChange={handleChange}
                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={!form.presentDivision}
                            >
                                <option value="">Select district / জেলা নির্বাচন করুন</option>
                                {presentDistricts.map((d) => (
                                    <option key={d.id} value={d.name}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Upazila" error={errors.presentUpazila}>
                            <select
                                name="presentUpazila"
                                value={form.presentUpazila}
                                onChange={handleChange}
                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={!form.presentDistrict}
                            >
                                <option value="">Select upazila / উপজেলা নির্বাচন করুন</option>
                                {presentUpazillas.map((u) => (
                                    <option key={u.id} value={u.name}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow label="Post Office" error={errors.presentPostOffice}>
                            <input
                                name="presentPostOffice"
                                value={form.presentPostOffice}
                                onChange={handleChange}
                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Post Office Name"
                            />
                        </FieldRow>
                        <FieldRow label="Post Code" error={errors.presentPostCode}>
                            <input
                                name="presentPostCode"
                                value={form.presentPostCode}
                                onChange={handleChange}
                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="1234"
                            />
                        </FieldRow>
                        <FieldRow label="Village/Road No" error={errors.presentVillageRoad}>
                            <input
                                name="presentVillageRoad"
                                value={form.presentVillageRoad}
                                onChange={handleChange}
                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Village/Road No"
                            />
                        </FieldRow>
                        {/* Permanent Address */}
                        <h4 className="font-semibold mb-2 mt-6">Permanent Address / স্থায়ী ঠিকানা</h4>
                        <FieldRow label="Same as Present">
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
                                                permanentAddress: prev.presentAddress,
                                                permanentDivision: prev.presentDivision,
                                                permanentDistrict: prev.presentDistrict,
                                                permanentUpazila: prev.presentUpazila,
                                                permanentPostOffice: prev.presentPostOffice,
                                                permanentPostCode: prev.presentPostCode,
                                                permanentVillageRoad: prev.presentVillageRoad,
                                            }))
                                            setErrors(prev => ({ ...prev, permanentAddress: '', permanentDivision: '', permanentDistrict: '', permanentUpazila: '', permanentPostOffice: '', permanentPostCode: '', permanentVillageRoad: '' }))
                                        } else {
                                            setForm(prev => ({
                                                ...prev,
                                                permanentAddress: '',
                                                permanentDivision: '',
                                                permanentDistrict: '',
                                                permanentUpazila: '',
                                                permanentPostOffice: '',
                                                permanentPostCode: '',
                                                permanentVillageRoad: '',
                                            }))
                                        }
                                    }}
                                />
                                <span className="text-sm">Same as Present Address / বর্তমান ঠিকানার মতো</span>
                            </label>
                        </FieldRow>
                        {!sameAddress && (
                            <>
                                <FieldRow label="Address" required error={errors.permanentAddress}>
                                    <textarea
                                        name="permanentAddress"
                                        value={form.permanentAddress}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        rows={3}
                                    />
                                </FieldRow>
                                <FieldRow label="Division" required error={errors.permanentDivision}>
                                    <select name="permanentDivision" value={form.permanentDivision} onChange={handleChange} className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200">
                                        <option value="">Select division / বিভাগ নির্বাচন করুন</option>
                                        {divisions.map((d) => (
                                            <option key={d.id} value={d.name}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </FieldRow>
                                <FieldRow label="District" required error={errors.permanentDistrict}>
                                    <select
                                        name="permanentDistrict"
                                        value={form.permanentDistrict}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        disabled={!form.permanentDivision}
                                    >
                                        <option value="">Select district / জেলা নির্বাচন করুন</option>
                                        {permanentDistricts.map((d) => (
                                            <option key={d.id} value={d.name}>
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
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        disabled={!form.permanentDistrict}
                                    >
                                        <option value="">Select upazila / উপজেলা নির্বাচন করুন</option>
                                        {permanentUpazillas.map((u) => (
                                            <option key={u.id} value={u.name}>
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
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Post Office Name"
                                    />
                                </FieldRow>
                                <FieldRow label="Post Code" required error={errors.permanentPostCode}>
                                    <input
                                        name="permanentPostCode"
                                        value={form.permanentPostCode}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="1234"
                                    />
                                </FieldRow>
                                <FieldRow label="Village/Road No" required error={errors.permanentVillageRoad}>
                                    <input
                                        name="permanentVillageRoad"
                                        value={form.permanentVillageRoad}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Village/Road No"
                                    />
                                </FieldRow>
                            </>
                        )}
                    </div>
                </section>
                {/* Step 3: Guardian */}
                <section className="mb-6">
                    <SectionHeader step={3} title="Guardian Information (if not parents)" />
                    <div className="border rounded-lg p-4 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label="Guardian is not the parents">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={guardianNotParents}
                                    onChange={e => {
                                        setGuardianNotParents(e.target.checked)
                                        if (!e.target.checked) {
                                            setForm(prev => ({
                                                ...prev,
                                                guardianName: '',
                                                guardianNid: '',
                                                guardianPhone: '',
                                                guardianRelation: '',
                                                guardianAddress: '',
                                                guardianAddressSameAsPresent: false,
                                                guardianDivision: '',
                                                guardianDistrict: '',
                                                guardianUpazila: '',
                                                guardianPostOffice: '',
                                                guardianPostCode: '',
                                                guardianVillageRoad: '',
                                            }))
                                            setErrors(prev => ({
                                                ...prev,
                                                guardianName: '',
                                                guardianNid: '',
                                                guardianPhone: '',
                                                guardianRelation: '',
                                                guardianAddress: '',
                                                guardianDivision: '',
                                                guardianDistrict: '',
                                                guardianUpazila: '',
                                                guardianPostOffice: '',
                                                guardianPostCode: '',
                                                guardianVillageRoad: '',
                                            }))
                                        }
                                    }}
                                />
                                <span className="text-sm">Check if guardian is not the parents</span>
                            </label>
                        </FieldRow>
                        {guardianNotParents && (
                            <>
                                <FieldRow label="Guardian Name" required error={errors.guardianName}>
                                    <input
                                        name="guardianName"
                                        value={form.guardianName}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian Name"
                                        aria-invalid={!!errors.guardianName}
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian NID">
                                    <input
                                        name="guardianNid"
                                        value={form.guardianNid}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian NID"
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian Phone" required error={errors.guardianPhone}>
                                    <input
                                        name="guardianPhone"
                                        value={form.guardianPhone}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian Phone"
                                        aria-invalid={!!errors.guardianPhone}
                                    />
                                </FieldRow>
                                <FieldRow label="Relation with Guardian" required error={errors.guardianRelation}>
                                    <input
                                        name="guardianRelation"
                                        value={form.guardianRelation}
                                        onChange={handleChange}
                                        className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Relation with Guardian"
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian Address">
                                    <label className="inline-flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            name="guardianAddressSameAsPresent"
                                            checked={form.guardianAddressSameAsPresent}
                                            onChange={handleChange}
                                        />
                                        <span className="text-sm">Same as Present Address</span>
                                    </label>
                                </FieldRow>
                                {/* Guardian address fields, only show if not same as present */}
                                {!form.guardianAddressSameAsPresent && (
                                    <>
                                        <FieldRow label="Address" required error={errors.guardianAddress}>
                                            <textarea
                                                name="guardianAddress"
                                                value={form.guardianAddress}
                                                onChange={handleChange}
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                rows={2}
                                                placeholder="Guardian Address"
                                            />
                                        </FieldRow>
                                        <FieldRow label="Division" required error={errors.guardianDivision}>
                                            <select
                                                name="guardianDivision"
                                                value={form.guardianDivision}
                                                onChange={handleChange}
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            >
                                                <option value="">Select division / বিভাগ নির্বাচন করুন</option>
                                                {divisions.map((d) => (
                                                    <option key={d.id} value={d.name}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </FieldRow>
                                        <FieldRow label="District" required error={errors.guardianDistrict}>
                                            <select
                                                name="guardianDistrict"
                                                value={form.guardianDistrict}
                                                onChange={handleChange}
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                disabled={!form.guardianDivision}
                                            >
                                                <option value="">Select district / জেলা নির্বাচন করুন</option>
                                                {guardianDistricts.map((d) => (
                                                    <option key={d.id} value={d.name}>
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
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                disabled={!form.guardianDistrict}
                                            >
                                                <option value="">Select upazila / উপজেলা নির্বাচন করুন</option>
                                                {guardianUpazillas.map((u) => (
                                                    <option key={u.id} value={u.name}>
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
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Post Office Name"
                                            />
                                        </FieldRow>
                                        <FieldRow label="Post Code" required error={errors.guardianPostCode}>
                                            <input
                                                name="guardianPostCode"
                                                value={form.guardianPostCode}
                                                onChange={handleChange}
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="1234"
                                            />
                                        </FieldRow>
                                        <FieldRow label="Village/Road No" required error={errors.guardianVillageRoad}>
                                            <input
                                                name="guardianVillageRoad"
                                                value={form.guardianVillageRoad}
                                                onChange={handleChange}
                                                className="block w-full border rounded-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Village/Road No"
                                            />
                                        </FieldRow>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </section>
                {/* Step 4: Uploads */}
                <section className="mb-6">
                    <SectionHeader step={4} title="Uploads / আপলোড" />
                    <div className="border rounded-lg p-4 bg-white shadow-md flex flex-col gap-y-2">
                        <FieldRow label={<span>Student Photo <Tooltip text="Upload a clear passport-size photo (jpg/png, less than 2MB)" /></span>} required error={errors.photo}>
                            <div className="relative group">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 bg-gray-50 transition group-hover:border-blue-400 group-focus-within:border-blue-400 cursor-pointer overflow-hidden">
                                    {!photoPreview
                                        ? <span className="text-xs sm:text-sm text-center text-gray-500">Click or drag to upload image</span>
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
                        </FieldRow>
                    </div>
                </section>
                {/* Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-6">
                    <button
                        type="submit"
                        className={`px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition font-semibold flex items-center justify-center gap-2 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={loading}
                    >
                        {loading && <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
                        {loading ? 'Submitting...' : 'Submit Registration'}
                    </button>
                    <button
                        type="button"
                        className="px-6 py-2 border border-gray-300 rounded shadow bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                        onClick={() => {
                            setForm({
                                studentNameEn: '',
                                studentNameBn: '',
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
                                phone: '',
                                email: '',
                                presentAddress: '',
                                permanentAddress: '',
                                presentDivision: '',
                                presentDistrict: '',
                                presentUpazila: '',
                                presentPostOffice: '',
                                presentPostCode: '',
                                presentVillageRoad: '',
                                permanentDivision: '',
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
                                guardianNid: '',
                                guardianPhone: '',
                                guardianRelation: '',
                                guardianAddress: '',
                                guardianAddressSameAsPresent: false,
                                guardianDivision: '',
                                guardianDistrict: '',
                                guardianUpazila: '',
                                guardianPostOffice: '',
                                guardianPostCode: '',
                                guardianVillageRoad: '',
                            }); setPhotoPreview(null); setErrors({}); setSuccess('')
                            setSameAddress(false)
                            setGuardianNotParents(false)
                        }}
                        disabled={loading}
                    >Reset</button>
                </div>
            </form>
            {/* Animation for success/error */}
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