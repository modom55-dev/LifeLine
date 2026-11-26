import { useEffect } from "react";

/** Capture navigation before the router so unsaved editor work is never silently discarded. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    function intercept(event: MouseEvent) {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !dirty ||
        !target ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const href = target.getAttribute("href");
      if (!href || href === "/admin/editor" || href.startsWith("#")) return;
      if (
        !window.confirm(
          "Your bulletin has unsaved changes. Leave without saving?"
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [dirty]);
}
