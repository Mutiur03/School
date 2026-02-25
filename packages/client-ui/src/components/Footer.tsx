import * as React from "react";
import "./Footer.css";

import { useSchoolConfig } from "../context/school";

export type FooterProps = {
  year?: number;
};

export function Footer({ year = new Date().getFullYear() }: FooterProps) {
  const school = useSchoolConfig();
  const schoolName = String(school.name?.en ?? "");

  return (
    <footer id="colophon" className="site-footer footer ">
      <div className="footer-site-info site-info text-center">
        <div className="">
          <div className="copy-right">
            <div className="copyright-text">
              <p>
                All rights reserved © {year}, {schoolName}.
              </p>
            </div>
          </div>
        </div>
      </div>
      <a href="#" id="scroll-top" style={{ display: "none" }}>
        <i className="fa fa-angle-up"></i>
      </a>
    </footer>
  );
}
