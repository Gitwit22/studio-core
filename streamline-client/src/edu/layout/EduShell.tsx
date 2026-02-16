import { Outlet } from "react-router-dom";
import EduSidebar from "./EduSidebar";
import EduTopbar from "./EduTopbar";

export default function EduShell() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <EduSidebar />
      <div className="flex-1 flex flex-col ml-64">
        <EduTopbar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
