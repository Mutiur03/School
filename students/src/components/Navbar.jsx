import ThemeChange from "./ThemeChange";
import { useAuth } from "../context/appContext";
function Navbar() {
   const {student} = useAuth();
  const host = import.meta.env.VITE_BACKEND_URL;
  return (
    <>
      <nav className="navbar h-[3.5rem] flex z-30 justify-between sticky top-0 w-full bg-sidebar border-b shadow-md px-5 items-center backdrop-blur-xl">
        <h2>Student Dashboard</h2>
        <div className="mr-8">
          <div className="flex items-center justify-between">
            <img
              src={`${host}/${student.image}`}
              alt="Profile"
              className="w-10 h-10 rounded-full border-4 border-gray-300 shadow-sm object-cover"
            />
            <span className="ml-2">{student.name}</span>
          </div>
          <ThemeChange />
        </div>
      </nav>
    </>
  );
}

export default Navbar;
