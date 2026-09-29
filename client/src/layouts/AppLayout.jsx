import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

import { AppHeader } from "../components/AppHeader";
import { AppSidebar, MobileTabBar } from "../components/Navigation";

/**
 * Application shell: fixed desktop sidebar, sticky header, mobile tab bar.
 *
 * The content column is explicitly allowed to shrink (`min-w-0`) and every
 * grid inside it uses `minmax(0, ...)` tracks. That is what keeps the page
 * free of horizontal scrollbars structurally, rather than by hiding overflow.
 */
function AppLayout() {
  const { pathname } = useLocation();

  // Every navigation should start at the top, like a real page load.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[264px]">
        <AppHeader />

        <main
          id="main-content"
          className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-10 lg:px-6 lg:py-6"
        >
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}

export default AppLayout;

