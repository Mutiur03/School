import './ExtraHome.css'
import { Link } from 'react-router-dom'

function ExtraHome() {
    return (
        <>
            <div className="front-gallerys-area">
                <div
                    id="bwp_gallery-3"
                    className="front-page-gallery-widget widget bwp_gallery"
                >
                    <div className="section-heading">
                        <h2 className="text-3xl">Photo Gallery</h2>
                    </div>

                    <div className="gallery-grid-4col">
                        <div className="gallery-item">
                            <img src="placeholder.svg" alt="" />
                        </div>
                        <div className="gallery-item">
                            <img src="placeholder.svg" alt="" />
                        </div>
                        <div className="gallery-item">
                            <img src="placeholder.svg" alt="" />
                        </div>
                        <div className="gallery-item">
                            <img src="placeholder.svg" alt="" />
                        </div>
                       
                    </div>

                    <h4 className="text-right">
                        <Link
                            to='gallery'
                            aria-label="View all notices"
                            className="inline-flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform text-black bg-gray-300 py-1.5 px-2.5 mt-4 rounded-md no-underline "
                        >
                            View All
                           
                        </Link>
                    </h4>
                </div>
            </div>

            {/* Video Gallery Section */}
            {/* <div className="front-videogallerys-area">
                <h2 className="text-3xl mb-4">Recent Video</h2>

                <div className="feature-item post-item">
                    <div className="row">
                        <div className="col-md-6 feature-video-item">
                            <div className="feature-item-area">
                                <div className="post-item-img">
                                    <div className="brbanner-video">
                                        <div className="youtube-article">
                                            <iframe
                                                className="dt-youtube"
                                                width="100%"
                                                height="280"
                                                src="//www.youtube.com/embed/GVPJHDp29tg"
                                                
                                            ></iframe>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6 feature-video-item">
                            <div className="feature-item-area">
                                <div className="post-item-img">
                                    <div className="brbanner-video">
                                        <div className="youtube-article">
                                            <iframe
                                                className="dt-youtube"
                                                width="100%"
                                                height="280"
                                                src="//www.youtube.com/embed/l7G3TPz6P24"

                                            ></iframe>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div> */}

            {/* Maps Section */}
            <div className="front-maps-area">
                <div
                    id="text-8"
                    className="front-page-map-widget widget widget_text"
                >
                    <div className="section-heading">
                        <h2 className="text-3xl">Our Location</h2>
                    </div>
                    <div className="textwidget">
                        <p>
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3610.4413182758058!2d89.0162750103328!3d25.18833557762371!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39fc940036ab258f%3A0x1ad698a28f60162!2sPanchbibi%20Lal%20Bihari%20Pilot%20Government%20High%20School!5e0!3m2!1sen!2sbd!4v1759324093017!5m2!1sen!2sbd"
                                width="100%"
                                height="450"
                                style={{ border: 0 }}
                                allowFullScreen={true}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                            {/* <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3634.450794817794!2d88.59980241499314!3d24.365616684289673!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39fbefaf059d282f%3A0x7aec01980805ef79!2sGovt.%20Pramathnath%20Girls'%20High%20School!5e0!3m2!1sen!2sbd!4v1653836568164!5m2!1sen!2sbd"
                                width="100%"
                                height="400"
                                style={{ border: 0 }}
                                allowFullScreen={true}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe> */}
                        </p>
                    </div>
                    {/* <div className="clearfix"></div> */}
                </div>
            </div>
        </>
    )
}

export default ExtraHome
