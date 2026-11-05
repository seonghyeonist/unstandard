"use client";
import { useEffect, useRef } from "react";
import { trackFunnel } from "@/lib/acquisition/client";
export function LandingMeasurement() {
  const measured = useRef(false);
  const formMeasured = useRef(false);
  useEffect(() => {
    if (!measured.current) { measured.current = true; trackFunnel("landing_view"); }
    const form = document.getElementById("alpha-apply");
    if (!form) return;
    const observer = new IntersectionObserver(entries => {
      if (!formMeasured.current && entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        formMeasured.current = true;
        trackFunnel("waitlist_form_view");
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  return null;
}
export function AlphaCta() {
  return <a href="#alpha-apply" style={{ color: "#fff" }} className="recruitment-cta" onClick={event => {
    trackFunnel("alpha_cta_click");
    const form = document.getElementById("alpha-apply");
    if (form) {
      event.preventDefault();
      history.replaceState(null, "", `${location.pathname}${location.search}#alpha-apply`);
      form.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    }
  }}>알파 초대 신청 <span aria-hidden="true">↗</span></a>;
}
