export const THEME_KEY = "preppilot.theme";

/** Inline, blocking script for <head>: applies a stored override before first paint. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
