import "./ExtraHome.css";
import Link from "next/link";

import placeholderImage from "../assets/images/placeholder.svg";
import Image from "next/image";
import { fetchSchoolConfig } from "@/queries/school.queries";

export type ExtraHomeProps = {
  galleryPath?: string;
};

export async function ExtraHome({ galleryPath = "/gallery" }: ExtraHomeProps) {
  const school = await fetchSchoolConfig();
  const embedUrl = school?.map?.embedUrl as string | undefined;

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

          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 ">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-sm bg-gray-100 w-40 h-40"
                >
                  <Image
                    src={placeholderImage}
                    alt=""
                    width={160}
                    height={160}
                    className="w-full h-full object-cover block"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="text-right">
            <Link
              href={galleryPath}
              aria-label="View all photos"
              className="inline-flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-[box-shadow,transform] duration-300 ease-in-out text-black bg-gray-300 py-1.5 px-2.5 mt-4 rounded-md no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
            >
              View All
            </Link>
          </div>
        </div>
      </div>

      <div className="front-maps-area">
        <div id="text-8" className="front-page-map-widget widget widget_text">
          <div className="section-heading">
            <h2 className="text-3xl">Our Location</h2>
          </div>
          <div className="textwidget">
            <p>
              <iframe
                src={embedUrl}
                title="School location on Google Maps"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
