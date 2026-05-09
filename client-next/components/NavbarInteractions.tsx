"use client";

import { useEffect } from "react";

export function NavbarInteractions() {
  useEffect(() => {
    const nav = document.getElementById("TF-Navbar");
    const toggler = document.querySelector<HTMLButtonElement>(".navbar-toggler");

    if (!nav || !toggler) return;

    const closeSiblingDropdowns = (item: Element) => {
      const siblings = item.parentElement?.children;
      if (!siblings) return;

      Array.from(siblings).forEach((sibling) => {
        if (sibling !== item) sibling.classList.remove("show");
      });
    };

    const handleToggle = () => {
      const isOpen = nav.classList.toggle("show");
      toggler.classList.toggle("active", isOpen);
      toggler.setAttribute("aria-expanded", String(isOpen));
    };

    const handleNavClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>(".nav-link, .dropdown-item");
      if (!link || !nav.contains(link)) return;

      const item = link.closest("li");
      const hasDropdown = Boolean(item?.querySelector(":scope > .dropdown-menu"));
      const isMobile = window.matchMedia("(max-width: 767px)").matches;

      if (!isMobile || !item || !hasDropdown) return;

      event.preventDefault();
      closeSiblingDropdowns(item);
      item.classList.toggle("show");
      link.setAttribute("aria-expanded", String(item.classList.contains("show")));
    };

    toggler.addEventListener("click", handleToggle);
    nav.addEventListener("click", handleNavClick);

    return () => {
      toggler.removeEventListener("click", handleToggle);
      nav.removeEventListener("click", handleNavClick);
    };
  }, []);

  return null;
}
