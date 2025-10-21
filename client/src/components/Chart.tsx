import { useEffect, useState } from 'react'
import './Chart.css'
import axios from 'axios'
import { Link } from 'react-router-dom';

export type Syllabus = {
    id: number;
    class: number;
    year: number;
    pdf_url: string;
    download_url: string;
    public_id: string;
    created_at: string;
};

function Chart() {
    const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);
    const [citizenCharterUrl, setCitizenCharterUrl] = useState<string | null>(null);
    const [routinePDF, setRoutinePDF] = useState<string | null>(null);
    useEffect(() => {
        axios.get("/api/syllabus").then((res) => {
            console.log(res.data);
            setSyllabuses(res.data)
        }).catch((err) => { console.error("Error fetching syllabuses:", err) });
        axios.get("/api/file-upload/citizen-charter").then((response) => {
            setCitizenCharterUrl(response.data.file);
        }).catch(() => {
            console.log("No Citizen Charter PDF found");
        });
        axios.get("/api/class-routine/pdf")
            .then(res => setRoutinePDF(res.data[0].pdf_url || null))
            .catch(() => setRoutinePDF(null));
    }, []);
    const getLatestSyllabusForClass = (classNum: number) => {
        const list = syllabuses.filter(s => s.class === classNum);
        if (!list.length) return undefined;
        return list.reduce((max, cur) => (cur.year > max.year ? cur : max), list[0]);
    };

    return (
        <div className="front-boxs-area">
            <div className="boxs-front">
                <div className="boxs-front-board">
                    <div className="row">
                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>বিদ্যালয় প্রশাসন</h3>
                                </div>
                                <div className='flex '>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/01.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><Link to='/message-from-head'
                                            >প্রধান শিক্ষক</Link></li>
                                            <li><a
                                            >সহকারী প্রধান শিক্ষক</a></li>
                                            <li><a
                                            >একাডেমিক কাউন্সিল</a></li>
                                            <li><a
                                            >অরগ্যানোগ্রাম</a></li>
                                            <li><Link to='/teacher-list'
                                            >শিক্ষকবৃন্দ</Link></li>
                                            <li><Link to='/staff-list'
                                            >কর্মচারীবৃন্দ</Link></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>একাডেমিক/রুটিন</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/academic.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a href={routinePDF ?? '#'} target={routinePDF ? '_blank' : undefined} rel="noopener noreferrer"
                                            >ষষ্ঠ শ্রেণি</a></li>
                                            <li><a href={routinePDF ?? '#'} target={routinePDF ? '_blank' : undefined} rel="noopener noreferrer"
                                            >সপ্তম শ্রেণি</a></li>
                                            <li><a href={routinePDF ?? '#'} target={routinePDF ? '_blank' : undefined} rel="noopener noreferrer"
                                            >অষ্টম শ্রেণি</a></li>
                                            <li><a href={routinePDF ?? '#'} target={routinePDF ? '_blank' : undefined} rel="noopener noreferrer"
                                            >নবম শ্রেণি</a></li>
                                            <li><a href={routinePDF ?? '#'} target={routinePDF ? '_blank' : undefined} rel="noopener noreferrer"
                                            >দশম শ্রেণি</a></li>

                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>অফিস আদেশ/বিজ্ঞপ্তি</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/office-order.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a title="সভার নোটিশ"
                                            >সভার নোটিশ</a></li>
                                            <li><a title="অন্যান্য নোটিশ"
                                            >অন্যান্য নোটিশ</a></li>
                                            <li><a title="অফিস আদেশ"
                                            >অফিস আদেশ</a></li>
                                            <li><a title="সরকারি আদেশ"
                                            >সরকারি আদেশ</a></li>
                                            <li><a title="অনাপত্তি পত্র (NOC) "
                                            >অনাপত্তি পত্র (NOC)</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>সিলেবাস</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Class-Routine_Syllabus.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li>
                                                <a
                                                    href={getLatestSyllabusForClass(6)?.pdf_url ?? '#'}
                                                    target={getLatestSyllabusForClass(6) ? '_blank' : undefined}
                                                    rel="noopener noreferrer"
                                                >
                                                    ষষ্ঠ শ্রেণি
                                                </a>
                                            </li>
                                            <li>
                                                <a
                                                    href={getLatestSyllabusForClass(7)?.pdf_url ?? '#'}
                                                    target={getLatestSyllabusForClass(7) ? '_blank' : undefined}
                                                    rel="noopener noreferrer"
                                                >
                                                    সপ্তম শ্রেণি
                                                </a>
                                            </li>
                                            <li>
                                                <a
                                                    href={getLatestSyllabusForClass(8)?.pdf_url ?? '#'}
                                                    target={getLatestSyllabusForClass(8) ? '_blank' : undefined}
                                                    rel="noopener noreferrer"
                                                >
                                                    অষ্টম শ্রেণি
                                                </a>
                                            </li>
                                            <li>
                                                <a
                                                    href={getLatestSyllabusForClass(9)?.pdf_url ?? '#'}
                                                    target={getLatestSyllabusForClass(9) ? '_blank' : undefined}
                                                    rel="noopener noreferrer"
                                                >
                                                    নবম শ্রেণি
                                                </a>
                                            </li>
                                            <li>
                                                <a
                                                    href={getLatestSyllabusForClass(10)?.pdf_url ?? '#'}
                                                    target={getLatestSyllabusForClass(10) ? '_blank' : undefined}
                                                    rel="noopener noreferrer"
                                                >
                                                    দশম শ্রেণি
                                                </a>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>ভর্তি সম্পর্কিত</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/admission.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >ষষ্ঠ শ্রেণি</a></li>
                                            <li><a
                                            >সপ্তম শ্রেণি</a></li>
                                            <li><a
                                            >অষ্টম শ্রেণি</a></li>
                                            <li><a
                                            >নবম শ্রেণি</a></li>

                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>ডাটাবেজ</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/datasymbol.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >বিদ্যালয় ডাটাবেজ</a></li>
                                            <li><a
                                            >শিক্ষক ডাটাবেজ</a></li>
                                            <li><a
                                            >স্টাফ ডাটাবেজ</a></li>
                                            <li><a
                                            >স্টুডেন্ট ডাটাবেজ</a></li>
                                            <li><a
                                            >ই-পেমেন্ট</a></li>
                                            <li><a
                                            >ই-লাইব্রেরি</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>ফলাফল</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Result-Icon-2.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a href='https://student.lbphs.gov.bd/' target='_blank' rel="noopener noreferrer"
                                            >ষষ্ঠ শ্রেণি</a></li>
                                            <li><a href='https://student.lbphs.gov.bd/' target='_blank' rel="noopener noreferrer"
                                            >সপ্তম শ্রেণি</a></li>
                                            <li><a href='https://student.lbphs.gov.bd/' target='_blank' rel="noopener noreferrer"
                                            >অষ্টম শ্রেণি</a></li>
                                            <li><a href='https://student.lbphs.gov.bd/' target='_blank' rel="noopener noreferrer"
                                            >নবম শ্রেণি</a></li>
                                            <li><a href='https://student.lbphs.gov.bd/' target='_blank' rel="noopener noreferrer"
                                            >দশম শ্রেণি</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>রেজিস্ট্রেশন সম্পর্কিত</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Form-Fillup.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >ষষ্ঠ শ্রেণি</a></li>
                                            <li><a>সপ্তম শ্রেণি</a></li>
                                            <li><a>অষ্টম শ্রেণি</a></li>
                                            <li><Link to={'/reg/ssc'}>নবম শ্রেণি</Link></li>
                                            <li><a >দশম শ্রেণি</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>সিটিজেন চার্টার</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/citizen.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li>
                                                <a
                                                    href={citizenCharterUrl ?? '#'}
                                                    target={citizenCharterUrl ? '_blank' : undefined}
                                                    rel={citizenCharterUrl ? 'noopener noreferrer' : undefined}
                                                >
                                                    সিটিজেন্‌স চার্টার
                                                </a>
                                            </li>
                                            {/* <li><a>সিটিজেন্‌স চার্টার</a></li>
                                            <li><a >মাউশি</a></li>
                                            <li><a >শিক্ষা মন্ত্রণালয়</a></li>
                                            <li><a >বার্ষিক প্রতিবেদন</a></li> */}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>বার্ষিক কর্মসম্পাদন চুক্তি</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/apa_cab.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >নোটিশ</a></li>
                                            <li><a
                                            >অফিস আদেশ</a></li>
                                            <li><a
                                            >প্রজ্ঞাপন/কর্মপদ্ধতি/কাঠামো</a></li>
                                            <li><a
                                            >নীতিমালা/চুক্তি/অগ্রগতি</a></li>
                                            <li><a
                                            >প্রতিবেদন</a></li>
                                            <li><a
                                            >আঞ্চলিক কার্যালয়ের চুক্তিসমূহ</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>শুদ্ধাচার পরিকল্পনা</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/nis_logo3.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >শুদ্ধাচার কর্মকৌশল</a></li>
                                            <li><a
                                            >আদেশ/বিজ্ঞপ্তি</a></li>
                                            <li><a
                                            >শুদ্ধাচার কর্মপরিকল্পণার  </a></li>
                                            <li><a
                                            >প্রতিবেদন</a></li>
                                            <li><a
                                            >শুদ্ধাচার পুরস্কার</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div> */}

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>সহশিক্ষা কার্যক্রম</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Co-educational-activities.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >ডিবেটিং  সোসাইটি</a></li>
                                            {/* <li><a
                                            >বিএনসিসি সেনা</a></li>
                                            <li><a
                                            >বিএনসিসি বিমান</a></li> */}
                                            <li><a
                                            >বয়েজ স্কাউটস্</a></li>
                                            <li><a
                                            >রেড ক্রিসেন্ট</a></li>
                                            {/* <li><a
                                            >বাঁধন</a></li> */}
                                            <li><a
                                            >ক্লাবসমূহ</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>অনলাইন শিক্ষা</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Online-Class.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >ষষ্ঠ শ্রেণি</a></li>
                                            <li><a
                                            >সপ্তম শ্রেণি</a></li>
                                            <li><a
                                            >অষ্টম শ্রেণি</a></li>
                                            <li><a
                                            >নবম শ্রেণি</a></li>
                                            <li><a
                                            >দশম শ্রেণি</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>ফরম ডাউনলোড</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/download-1.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >ছুটির ফরম</a></li>
                                            <li><a href="http://www.dip.gov.bd/site/forms/814bebd1-ddc5-4923-a5f9-e215761fbdc1/-">পার্সপোর্ট ফরম</a></li>
                                            <li><a href="http://www.dip.gov.bd/site/forms/826f6ebe-9fbc-4e86-8629-e3336e070dec/-">অনাপত্তি পত্র (NOC) ফরম</a></li>
                                            <li><a
                                            >হোস্টেল ভর্তির প্রাথমিক আবেদন ফরম</a></li>
                                            <li><a
                                            >চারিত্রিক সনদ</a></li>
                                            <li><a
                                            >সনদ ও নম্বরপত্র</a></li>
                                            <li><a
                                            >বৃত্তি</a></li>
                                            <li><a
                                            >অন্যান্য</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div> */}

                        {/* <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>পাবলিকেশনস</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/publications.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            ></a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div> */}

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>বিবিধ</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/0-1.png"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >সরকারি ছুটির তালিকা</a></li>
                                            <li><a
                                            >হলিডে লিস্ট শিক্ষা প্রতিষ্ঠান</a></li>
                                            <li><a
                                            >মেডিকেল সেন্টার</a></li>
                                            <li><a
                                            >উদ্ভাবন কর্ণার</a></li>
                                            <li><a
                                            >ইন-হাউজ ট্রেনিং</a></li>
                                            <li><a href="http://cga.portal.gov.bd/sites/default/files/files/cga.portal.gov.bd/page/9e02aa22_ffef_4f13_bff5_8aee0e73fb9e/pay_civil2015.pdf">জাতীয় বেতনস্কেল ২০১৫</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>জরুরি কল ও সেবা</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Emergency-call-Services.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >হেল্পডেস্ক</a></li>
                                            <li><a
                                            >কল সেন্টারসমূহ</a></li>
                                            <li><a
                                            >ফোনে ডাক্তারের সেবা</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* <div className="text-left col-md-6">
                            <div className="box-item">
                                <div className="box-title">
                                    <h3>অ্যালামনাই কর্নার</h3>
                                </div>
                                <div className='flex'>
                                    <div className="box-img">
                                        <img
                                            width="150"
                                            height="150"
                                            src="/Alumnai-Corner.jpg"
                                            className="thumbs wp-post-image"
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="box-text">
                                        <ul>
                                            <li><a
                                            >সদস্য আবেদন সংক্রান্ত</a></li>
                                            <li><a
                                            >সদস্য আবেদন ফরম</a></li>
                                            <li><a
                                            >যোগাযোগ</a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div> */}
                    </div>
                </div>
            </div>
        </div >
    )
}

export default Chart
