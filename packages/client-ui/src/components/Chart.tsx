import "./Chart.css";
import { Link } from "react-router-dom";

import { useSchoolConfig } from "../context/school";
import image01 from "../assets/images/01.png";
import academicImage from "../assets/images/academic.png";
import officeOrderImage from "../assets/images/office-order.png";
import classRoutineSyllabusImage from "../assets/images/Class-Routine_Syllabus.jpg";
import admissionImage from "../assets/images/admission.png";
import dataSymbolImage from "../assets/images/datasymbol.png";
import resultIconImage from "../assets/images/Result-Icon-2.png";
import formFillupImage from "../assets/images/Form-Fillup.png";
import citizenImage from "../assets/images/citizen.png";
import apaCabImage from "../assets/images/apa_cab.png";
import coEducationalActivitiesImage from "../assets/images/Co-educational-activities.jpg";
import onlineClassImage from "../assets/images/Online-Class.jpg";
import miscImage from "../assets/images/0-1.png";
import emergencyCallServicesImage from "../assets/images/Emergency-call-Services.jpg";

export type ChartProps = {
  resultsUrl?: string;
  onRoutineClick?: (e: React.MouseEvent) => void | Promise<void>;
  onCitizenCharterClick?: () => void | Promise<void>;
  onSyllabusClick?: (classNum: number) => void | Promise<void>;
};

export function Chart({
  resultsUrl: resultsUrlProp,
  onRoutineClick,
  onCitizenCharterClick,
  onSyllabusClick,
}: ChartProps) {
  const school = useSchoolConfig();
  const resultsUrl = resultsUrlProp ?? (school as any)?.links?.results;

  return (
    <div className="front-boxs-area">
      <div className="boxs-front">
        <div className="boxs-front-board">
          <div className="row">
            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>বিদ্যালয় প্রশাসন</h3>
                </div>
                <div className="flex ">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={image01}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <Link to="/message-from-head">প্রধান শিক্ষক</Link>
                      </li>
                      <li>
                        <a>সহকারী প্রধান শিক্ষক</a>
                      </li>
                      <li>
                        <a>একাডেমিক কাউন্সিল</a>
                      </li>
                      <li>
                        <a>অরগ্যানোগ্রাম</a>
                      </li>
                      <li>
                        <Link to="/teacher-list">শিক্ষকবৃন্দ</Link>
                      </li>
                      <li>
                        <Link to="/staff-list">কর্মচারীবৃন্দ</Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>একাডেমিক/রুটিন</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={academicImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a
                          onClick={onRoutineClick}
                          style={{ cursor: "pointer" }}
                        >
                          ষষ্ঠ শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={onRoutineClick}
                          style={{ cursor: "pointer" }}
                        >
                          সপ্তম শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={onRoutineClick}
                          style={{ cursor: "pointer" }}
                        >
                          অষ্টম শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={onRoutineClick}
                          style={{ cursor: "pointer" }}
                        >
                          নবম শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={onRoutineClick}
                          style={{ cursor: "pointer" }}
                        >
                          দশম শ্রেণি
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>অফিস আদেশ/বিজ্ঞপ্তি</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={officeOrderImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a title="সভার নোটিশ">সভার নোটিশ</a>
                      </li>
                      <li>
                        <a title="অন্যান্য নোটিশ">অন্যান্য নোটিশ</a>
                      </li>
                      <li>
                        <a title="অফিস আদেশ">অফিস আদেশ</a>
                      </li>
                      <li>
                        <a title="সরকারি আদেশ">সরকারি আদেশ</a>
                      </li>
                      <li>
                        <a title="অনাপত্তি পত্র (NOC) ">অনাপত্তি পত্র (NOC)</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>সিলেবাস</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={classRoutineSyllabusImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a
                          onClick={() => onSyllabusClick?.(6)}
                          style={{ cursor: "pointer" }}
                        >
                          ষষ্ঠ শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={() => onSyllabusClick?.(7)}
                          style={{ cursor: "pointer" }}
                        >
                          সপ্তম শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={() => onSyllabusClick?.(8)}
                          style={{ cursor: "pointer" }}
                        >
                          অষ্টম শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={() => onSyllabusClick?.(9)}
                          style={{ cursor: "pointer" }}
                        >
                          নবম শ্রেণি
                        </a>
                      </li>
                      <li>
                        <a
                          onClick={() => onSyllabusClick?.(10)}
                          style={{ cursor: "pointer" }}
                        >
                          দশম শ্রেণি
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>ভর্তি সম্পর্কিত</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={admissionImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>ষষ্ঠ শ্রেণি</a>
                      </li>
                      <li>
                        <a>সপ্তম শ্রেণি</a>
                      </li>
                      <li>
                        <a>অষ্টম শ্রেণি</a>
                      </li>
                      <li>
                        <a>নবম শ্রেণি</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>ডাটাবেজ</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={dataSymbolImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>বিদ্যালয় ডাটাবেজ</a>
                      </li>
                      <li>
                        <a>শিক্ষক ডাটাবেজ</a>
                      </li>
                      <li>
                        <a>স্টাফ ডাটাবেজ</a>
                      </li>
                      <li>
                        <a>স্টুডেন্ট ডাটাবেজ</a>
                      </li>
                      <li>
                        <a>ই-পেমেন্ট</a>
                      </li>
                      <li>
                        <a>ই-লাইব্রেরি</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>ফলাফল</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={resultIconImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      {[6, 7, 8, 9, 10].map((cls) => (
                        <li key={cls}>
                          <a
                            href={resultsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {cls === 6
                              ? "ষষ্ঠ শ্রেণি"
                              : cls === 7
                                ? "সপ্তম শ্রেণি"
                                : cls === 8
                                  ? "অষ্টম শ্রেণি"
                                  : cls === 9
                                    ? "নবম শ্রেণি"
                                    : "দশম শ্রেণি"}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>রেজিস্ট্রেশন সম্পর্কিত</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={formFillupImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <Link to="/registration/class-6">ষষ্ঠ শ্রেণি</Link>
                      </li>
                      {/* <li>
                        <a>সপ্তম শ্রেণি</a>
                      </li> */}
                      <li>
                        <Link to="/registration/class-8">অষ্টম শ্রেণি</Link>
                      </li>
                      <li>
                        <Link to="/reg/ssc">নবম শ্রেণি</Link>
                      </li>
                      {/* <li>
                        <a>দশম শ্রেণি</a>
                      </li> */}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>সিটিজেন চার্টার</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={citizenImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a
                          onClick={() => onCitizenCharterClick?.()}
                          style={{ cursor: "pointer" }}
                        >
                          সিটিজেন্‌স চার্টার
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>বার্ষিক কর্মসম্পাদন চুক্তি</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={apaCabImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>নোটিশ</a>
                      </li>
                      <li>
                        <a>অফিস আদেশ</a>
                      </li>
                      <li>
                        <a>প্রজ্ঞাপন/কর্মপদ্ধতি/কাঠামো</a>
                      </li>
                      <li>
                        <a>নীতিমালা/চুক্তি/অগ্রগতি</a>
                      </li>
                      <li>
                        <a>প্রতিবেদন</a>
                      </li>
                      <li>
                        <a>আঞ্চলিক কার্যালয়ের চুক্তিসমূহ</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>সহশিক্ষা কার্যক্রম</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={coEducationalActivitiesImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>ডিবেটিং সোসাইটি</a>
                      </li>
                      <li>
                        <a>বয়েজ স্কাউটস্</a>
                      </li>
                      <li>
                        <a>রেড ক্রিসেন্ট</a>
                      </li>
                      <li>
                        <a>ক্লাবসমূহ</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>অনলাইন শিক্ষা</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={onlineClassImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>ষষ্ঠ শ্রেণি</a>
                      </li>
                      <li>
                        <a>সপ্তম শ্রেণি</a>
                      </li>
                      <li>
                        <a>অষ্টম শ্রেণি</a>
                      </li>
                      <li>
                        <a>নবম শ্রেণি</a>
                      </li>
                      <li>
                        <a>দশম শ্রেণি</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>বিবিধ</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={miscImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>সরকারি ছুটির তালিকা</a>
                      </li>
                      <li>
                        <a>হলিডে লিস্ট শিক্ষা প্রতিষ্ঠান</a>
                      </li>
                      <li>
                        <a>মেডিকেল সেন্টার</a>
                      </li>
                      <li>
                        <a>উদ্ভাবন কর্ণার</a>
                      </li>
                      <li>
                        <a>ইন-হাউজ ট্রেনিং</a>
                      </li>
                      <li>
                        <a href="http://cga.portal.gov.bd/sites/default/files/files/cga.portal.gov.bd/page/9e02aa22_ffef_4f13_bff5_8aee0e73fb9e/pay_civil2015.pdf">
                          জাতীয় বেতনস্কেল ২০১৫
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-left col-md-6">
              <div className="box-item">
                <div className="box-title">
                  <h3>জরুরি কল ও সেবা</h3>
                </div>
                <div className="flex">
                  <div className="box-img">
                    <img
                      width="150"
                      height="150"
                      src={emergencyCallServicesImage}
                      className="thumbs wp-post-image"
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="box-text">
                    <ul>
                      <li>
                        <a>হেল্পডেস্ক</a>
                      </li>
                      <li>
                        <a>কল সেন্টারসমূহ</a>
                      </li>
                      <li>
                        <a>ফোনে ডাক্তারের সেবা</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
