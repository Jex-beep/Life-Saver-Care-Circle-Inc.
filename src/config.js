/**
 * STATIC_MODE — pre-approval launch switch.
 *
 * true  = informational site only: Home, About, Branches (hardcoded data),
 *         Pharmacy (program info). No bookings, cart, tracking, or admin.
 *         Does NOT need the backend server or Supabase.
 *
 * false = full system: live slots, pharmacy ordering, reference tracking,
 *         per-branch admin dashboard. Requires the /server backend running.
 *
 * Flip this single value to restore the full system after client approval.
 */
export const STATIC_MODE = false
