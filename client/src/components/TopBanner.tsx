import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useNoticeStore from '@/store/noticeStore'


const TopBanner: React.FC = () => {
    const { notices, isLoading, loadNotices } = useNoticeStore();
    const [index, setIndex] = useState(0)
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        const controller = new AbortController()
        if (notices.length === 0 && !isLoading) {
            loadNotices();
        }

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
                <motion.a
                    className="m-0 text-gray-900 text-sm leading-6 truncate flex-1"
                    title={notice?.title || ''}
                    href={notice?.file || '#'}
                    target="_blank"
                >
                    <AnimatePresence mode="wait">
                        {isLoading ? (
                            <motion.span
                                key="loading"
                                className="text-gray-500"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.2 }}
                            >
                                নোটিশ লোড হচ্ছে...
                            </motion.span>
                        ) : notice ? (
                            <motion.span
                                key={notice.id ?? index}
                                className="notice-title"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.1 }}
                            >
                                {notice.title}
                            </motion.span>
                        ) : (
                            <motion.span
                                key="empty"
                                className="text-gray-500"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.2 }}
                            >
                                কোনো নোটিশ নেই
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.a>

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
