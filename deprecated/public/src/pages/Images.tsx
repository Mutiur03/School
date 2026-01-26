import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FiX, FiChevronLeft, FiChevronRight, FiArrowLeft } from 'react-icons/fi';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

type ImageProps = {
    id: number;
    image_path: string;
};

function Images({ type }: { type: string }) {
    const navigate = useNavigate();
    const [currentImage, setCurrentImage] = useState<number | null>(null);
    const [images, setImages] = useState<ImageProps[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const { id } = useParams<{ id: string }>();
    const host = import.meta.env.VITE_BACKEND_URL;

    useEffect(() => {
        const fetchImages = async () => {
            try {
                setLoading(true);
                let response = null;
                if (type === 'events') {
                    response = await axios.get(`/api/gallery/getGalleries/event/${id}`);
                } else if (type === 'campus') {
                    response = await axios.get(`/api/gallery/getGalleries/campus/${id}`);
                }
                const data = response ? await response.data : [];
                setImages(data);
            } catch (error) {
                console.error("Error fetching images:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchImages();
    }, [id]);

    const openImage = (index: number) => setCurrentImage(index);
    const closeImage = () => setCurrentImage(null);
    const showNext = () => setCurrentImage((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : prev));
    const showPrev = () => setCurrentImage((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));

    return (
        <div className="">
            <button
                className="mt-4 ml-4 flex items-center gap-2 px-3 py-2 text-primary hover:scale-105 transition-all z-10"
                onClick={() => navigate(-1)}
            >
                <FiArrowLeft size={20} />
                Back to Gallery Page
            </button>
            <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} className="w-full h-48 rounded" />
                        ))
                    ) : images.length === 0 ? (
                        <p className="col-span-full text-center text-gray-500">No images available.</p>
                    ) : (
                        images.map((src, index) => (
                            <motion.div
                                key={index}
                                className="relative w-full pt-[75%] overflow-hidden rounded shadow cursor-pointer hover:opacity-80"
                                onClick={() => openImage(index)}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5 }}
                            >
                                <img
                                    src={src.image_path ? `${host}/${src.image_path}` : '/placeholder.svg'}
                                    alt={`Image ${index + 1}`}
                                    className="absolute top-0 left-0 w-full h-full object-cover"
                                />
                            </motion.div>
                        ))
                    )}
                </div>

                {currentImage !== null && (
                    <motion.div
                        className="fixed inset-0 backdrop-blur-2xl  flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0" onClick={closeImage}></div>
                        <motion.div
                            className="relative bg-white p-4 rounded shadow-lg max-w-3xl w-full"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                        >
                            <button
                                className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full z-10 hover:bg-black/80 transition-colors"
                                onClick={closeImage}
                            >
                                <FiX size={20} />
                            </button>

                            <button
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/60 text-white p-3 rounded-full z-10 hover:bg-black/80 transition-colors"
                                onClick={showPrev}
                                hidden={currentImage === 0}
                            >
                                <FiChevronLeft size={24} />
                            </button>
                            <img
                                src={images[currentImage].image_path ? `${host}/${images[currentImage].image_path}` : '/placeholder.svg'}
                                alt={`Image ${currentImage + 1}`}
                                className="max-w-full max-h-[80vh] mx-auto rounded-md"
                            />
                            <button
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/60 text-white p-3 rounded-full z-10 hover:bg-black/80 transition-colors"
                                onClick={showNext}
                                hidden={currentImage === images.length - 1}
                            >
                                <FiChevronRight size={24} />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

export default Images;
