import { useEffect, useState } from "react";

export function useBrowserPathname(): [
  string,
  (nextPathname: string) => void,
] {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const syncPathnameFromHistory = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", syncPathnameFromHistory);
    return () => {
      window.removeEventListener("popstate", syncPathnameFromHistory);
    };
  }, []);

  function navigateToPathname(nextPathname: string) {
    window.history.pushState(null, "", nextPathname);
    setPathname(nextPathname);
  }

  return [pathname, navigateToPathname];
}
