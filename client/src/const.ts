export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start Google sign-in. The server mints the one-time state and redirects to
// Google, so call this only from an event handler, never during render.
export const startLogin = () => {
  window.location.href = "/api/auth/google/start";
};
