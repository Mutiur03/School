"use client"
import {

  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark text-white pt-12 pb-6">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* School info */}
          <div>
            <h3 className="text-xl font-bold mb-4 border-b-2 border-secondary pb-2 inline-block">
              Panchbibi Lal Bihari Pilot Government High School

            </h3>
            <p className="mb-4">
              Providing quality education and shaping the future of our nation
              since 1940.
            </p>
            {/* <div className="flex space-x-4">
              <a to="#" className="hover:text-secondary transition-colors" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a to="#" className="hover:text-secondary transition-colors" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a to="#" className="hover:text-secondary transition-colors" aria-label="Twitter">
                <Twitter size={20} />
              </a>
            </div> */}
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-xl font-bold mb-4 border-b-2 border-secondary pb-2 inline-block">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/about/history"
                  className="hover:text-secondary transition-colors"
                >
                  School History
                </Link>
              </li>
              <li>
                <Link
                  to="/administration/teacher"
                  className="hover:text-secondary transition-colors"
                >
                  Our Teachers
                </Link>
              </li>
              <li>
                <Link
                  to="/notice"
                  className="hover:text-secondary transition-colors"
                >
                  Notices
                </Link>
              </li>
              <li>
                <Link
                  to="/gallery"
                  className="hover:text-secondary transition-colors"
                >
                  Photo Gallery
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="hover:text-secondary transition-colors"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h3 className="text-xl font-bold mb-4 border-b-2 border-secondary pb-2 inline-block">
              Contact Us
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin size={20} className="mt-1 shrink-0" />
                <span>Panchbibi, Joypurhat, Bangladesh</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={20} className="shrink-0" />
                <span>+880 1309-121983</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={20} className="shrink-0" />
                <span>lbpgovtschool@gmail.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-gray-700 text-center text-sm">
          <p>
            © {currentYear} Panchbibi Lal Bihari Pilot Government High School. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
