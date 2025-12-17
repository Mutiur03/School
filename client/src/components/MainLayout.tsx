import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Navbar from "./Navbar";
import TopBanner from "./TopBanner";
import RightSidebar from "./RightSidebar";
import Footer from "./Footer";

function MainLayout() {
    const location = useLocation();

    const routesWithoutSidebar = ['/registration/ssc', '/reg/ssc', '/admission'];
    const shouldHideSidebar = routesWithoutSidebar.some(route =>
        location.pathname === route || location.pathname.startsWith(route + '/')
    );

    return (
        <>
            <div className="container">
                <Header />
                <Navbar />
                <hr className="border-t border-gray-300" />
                <TopBanner />

                <div className="min-h-screen text-black">
                    <br />
                    <div className={shouldHideSidebar ? "main-content-full" : "main-content"}>
                        <div className="rcontent-pat-1">
                            <Outlet />
                        </div>

                        {!shouldHideSidebar && (
                            <div className="content-part-2">
                                <div className="secondary-content">
                                    <RightSidebar />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}

export default MainLayout;
