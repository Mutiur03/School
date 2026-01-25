import { schoolConfig } from "@/lib/info";
import "./Footer.css";

function Footer() {
  return (
    <footer id="colophon" className="site-footer footer ">
      <div className="footer-site-info site-info text-center">
        <div className="">
          <div className="copy-right">
            <div className="copyright-text">
              <p>
                All rights reserved © {new Date().getFullYear()},{" "}
                {schoolConfig.name.en}.
                {/* Design & Maintenance by
                                    <a target="_blank" rel="noopener noreferrer" href="#">
                                        ZyraSoft
                                    </a>
                                */}
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

export default Footer;
