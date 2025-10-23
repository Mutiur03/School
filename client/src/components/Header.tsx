import { useState, useEffect } from 'react';

function Header() {
    const [currentSlide, setCurrentSlide] = useState(0);

    const bannerImages = [
        '/banner1.jpg',
        '/banner2.jpeg',
        '/banner3.jpg',
        '/banner4.jpeg'
    ];

    useEffect(() => {
        const slideInterval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % bannerImages.length);
        }, 4000);

        return () => clearInterval(slideInterval);
    }, [bannerImages.length]);

    return (
        <div className="relative shadow-lg ">
            <div id="banner" className="banner slider-header"></div>
            <div className="carousel slide"
            ></div>
            <div className="relative h-50 md:h-60 lg:h-70  overflow-hidden  ">
                {/* Image Container */}
                <div
                    className="flex transition-transform duration-500 ease-in-out h-full "
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                    {bannerImages.map((image, index) => (
                        <div key={index} className="min-w-full h-full relative">
                            <img
                                src={image}
                                alt={`Banner ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            {/* Dark overlay */}
                            <div className="absolute inset-0 bg-black/30"></div>
                        </div>
                    ))}
                </div>

                {/* Centered Logo Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <img
                        src="/header.png"
                        alt="Logo"
                        className="max-w-full h-auto z-10"
                    />
                </div>

                {/* Navigation Dots */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {bannerImages.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`w-3 h-3 rounded-full transition-colors duration-200 ${currentSlide === index
                                ? 'bg-white'
                                : 'bg-white/50 hover:bg-white/70'
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation Arrows */}
                <button
                    onClick={() => setCurrentSlide(prev => prev === 0 ? bannerImages.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors duration-200"
                >
                    ←
                </button>
                <button
                    onClick={() => setCurrentSlide(prev => (prev + 1) % bannerImages.length)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors duration-200"
                >
                    →
                </button>
            </div>
        </div>
    )
}

export default Header
