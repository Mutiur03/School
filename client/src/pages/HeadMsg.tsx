import axios from 'axios';
import React, { useEffect } from 'react'
interface Head {
    head_message: string;
    teacher: {
        name: string;
        image: string;
    }
}
function HeadMsg() {
    const host = import.meta.env.VITE_BACKEND_URL;
    const [head, setHead] = React.useState<Head | null>(null);
    const [imgLoading, setImgLoading] = React.useState<boolean>(true);
    useEffect(() => {
        axios.get('/api/teachers/get_head_msg').then(response => {
            console.log(response.data);
            setHead(response.data || null);
            setImgLoading(false);
        }).catch(error => {
            console.error('Error fetching head message:', error);
        });
    }, [])
    return (
        <div className="flex flex-col items-center h-screen pt-12">
            <h2 className='mb-5 text-4xl underline'>Message From Headmaster</h2>
            <div className="p-4 mb-5 border-1 border-gray-100  shadow-lg">
                {imgLoading ? (
                    <div className="w-42 h-42 mb-5 bg-gray-300 animate-pulse shadow-2xl"></div>
                ) : (
                    <img
                        src={head?.teacher.image ? `${host}/${head.teacher.image}` : '/placeholder.svg'}
                        alt="Head Image"
                        className="w-42 h-42 object-cover "
                    />
                )}
            </div>
            <h1 className="text-2xl font-bold mb-4">{head?.teacher.name ?? ''}</h1>
            <div className=" text-justify max-w-2xl w-full">
                <p>{head?.head_message ?? ''}</p>
            </div>
        </div>
    );
}

export default HeadMsg
