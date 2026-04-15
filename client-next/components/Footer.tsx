import * as React from "react";
import "./Footer.css";
import { fetchSchoolConfig } from "@/queries/school.queries";


export type FooterProps = {
  year?: number;
};

export async function Footer({ year = new Date().getFullYear() }: FooterProps) {
  const school = await fetchSchoolConfig();

  return (
    <footer id="colophon" className="site-footer footer ">
      <div className="footer-site-info site-info text-center">
        <div className="">
          <div className="copy-right">
            <div className="copyright-text">
              <p>
                All rights reserved © {year}, {school?.name?.en}.
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
