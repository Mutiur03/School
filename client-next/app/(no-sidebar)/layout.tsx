import { Footer } from "@/components/Footer";
import { HeaderClient } from "@/components/HeaderClient";
import { Navbar } from "@/components/Navbar";
import { TopBanner } from "@/components/TopBanner";
import { fetchSchoolConfig } from "@/queries/school.queries";
import governmentLogoImage from "../../assets/images/gov-logo.png";

export default async function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const school = await fetchSchoolConfig();
    const assets = school?.assets;

    return (
        <>
            <div className="container">
                <HeaderClient
                    bannerImages={assets?.banners ?? []}
                    headerLogo={assets?.headerLogo ?? ""}
                    leftLogo={assets?.logo ?? ""}
                    rightLogo={(assets as { governmentLogo?: string } | undefined)?.governmentLogo ?? governmentLogoImage}
                    titleBn={String(school?.name?.bn ?? "")}
                    titleEn={String(school?.name?.en ?? "")}
                />
                <Navbar />
                <hr className="border-t border-gray-300" />
                <TopBanner />

                <div className="min-h-screen text-black">
                    <br />
                    <div className="main-content-full">
                        <div className="content-part-1">{children}</div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
