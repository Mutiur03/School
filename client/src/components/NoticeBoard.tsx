import { useEffect } from 'react'
import './NoticeBoard.css'
import { Link } from 'react-router-dom';
import useNoticeStore from '@/store/noticeStore';


const NoticeBoard = () => {

    const { notices, isLoading, loadNotices } = useNoticeStore();
    useEffect(() => {
        if (notices.length === 0) {
            loadNotices();
        }
    }, []);
    return (
        <div className="front-notices-area ">
            <div className="notices-front">
                <div className="notices-front-board">
                    <div className="notices-items">
                        <h2>Notice Board</h2>
                        {isLoading ? (
                            <p>Loading notices...</p>
                        ) : (
                            <ul className="notices_front_list">
                                {(notices ?? []).map((notice, index) => (
                                    <li key={index} className="notice-item text-left">
                                        <div className="notice-title">
                                            <h5>
                                                <a href={notice.file ?? '#'} target='_blank' rel="noreferrer">{notice.title}</a>
                                            </h5>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <h4 className="text-right">
                            <Link to="/notices">View All</Link>
                        </h4>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NoticeBoard
