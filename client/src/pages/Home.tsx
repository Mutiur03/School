import Chart from '@/components/Chart'
import ExtraHome from '@/components/ExtraHome'
import NoticeBoard from '@/components/NoticeBoard'
import { useEffect } from 'react';

function Home() {
    useEffect(() => {
        document.title = "Panchbibi Lal Bihari Pilot Government High School";
        }, []);
    return (
        <>
            <NoticeBoard />
            <Chart />
            <ExtraHome />
        </>

    )
}

export default Home
