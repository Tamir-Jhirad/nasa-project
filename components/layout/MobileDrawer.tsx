"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Renders children into a portal attached to document.body.
 * This is necessary because the DashboardClient flex container has
 * overflow-hidden, which clips fixed/absolute descendants on iOS Safari.
 * Portaling to body escapes all ancestor overflow constraints.
 */
export function MobileDrawer({ open, onClose, children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open so background content cannot scroll
  // behind the backdrop. Restore on close or unmount.
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, mounted]);

  // Do not render on the server (portals are client-only)
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={[
          "fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={[
          "fixed top-0 left-0 h-full z-50 md:hidden",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
