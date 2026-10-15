/** Never trust or reflect provider query parameters (including errors or "success").
 * No GET-side verification. The logged-in setup page reads the user's pending ID from the DB.
 * Infrastructure URL logging on this callback must be scrubbed before live enablement.
 */
export function GET() {
  return new Response(null, { status: 303, headers: {
    Location: "/profile-setup", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
  } });
}
