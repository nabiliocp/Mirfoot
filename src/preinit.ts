/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

if (typeof window !== "undefined") {
  const href = window.location.href;
  if (href.includes("##")) {
    console.log("[Preinit] Double hash '##' detected! Replacing with '#' to secure Supabase auth parsing...");
    const cleanUrl = href.replace("##", "#");
    window.history.replaceState({}, document.title, cleanUrl);
  }
}
