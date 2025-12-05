import axios from 'axios'
import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface Notice {
    id?: string
    title?: string
    file?: string
}

const TopBanner: React.FC = () => {
    const [index, setIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [notices, setNotices] = useState<Notice[]>([])
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        const controller = new AbortController()
        setIsLoading(true)

        axios
            .get('/api/notices/getNotices?limit=5', { signal: controller.signal })
            .then((response) => {
                if (!mounted.current) return
                const data = Array.isArray(response.data) ? response.data : []
                setNotices(data)
                setIndex(0)
            })
            .catch((error) => {
                if (!mounted.current) return
                if (axios.isCancel && axios.isCancel(error)) return
                console.error('Error fetching notices:', error)
            })
            .finally(() => {
                if (!mounted.current) return
                setIsLoading(false)
            })

        return () => {
            mounted.current = false
            controller.abort()
        }
    }, [])

    useEffect(() => {
        if (!notices || notices.length <= 1) return
        const id = setInterval(() => {
            setIndex((i) => {
                const next = (i + 1) % notices.length
                return next
            })
        }, 5000)

        return () => clearInterval(id)
    }, [notices])

    const notice = notices && notices.length > 0 ? notices[index] : null

    return (
        <div className="w-full mt-2 bg-gray-50 border-t border-b border-gray-100" aria-hidden={false}>
            <div className="max-w-6xl mx-auto px-4 py-1 flex items-center justify-between gap-3">
                <a
                    className="m-0 text-gray-900 text-sm leading-6 truncate flex-1 transition-opacity duration-200"
                    title={notice?.title || ''}
                    href={notice?.file || '#'}
                    target='_blank'
                >
                    {isLoading ? (
                        <span className="text-gray-500">নোটিশ লোড হচ্ছে...</span>
                    ) : notice ? (
                        <span className="notice-title">{notice.title}</span>
                    ) : (
                        <span className="text-gray-500">কোনো নোটিশ নেই</span>
                    )}
                </a>

                <div className="shrink-0">
                    <Link
                        to={'/notices'}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-400 text-gray-700 rounded text-sm bg-transparent hover:bg-gray-50"
                        aria-label="show-all"
                    >
                        সকল
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default TopBanner
