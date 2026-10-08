import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import { nextTick } from "vue";
import { auth, database, supabaseConfigured } from "../services/session";
import { myProfile } from "../services/database/passenger";
import { resolveAccountRole, roleDestination } from "../data/sessionRole";
import { databaseRequestError } from "../data/databaseErrors";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/travelers",
    component: () => import("../views/passenger/TravelersPage.vue"),
  },
  { path: "/help", component: () => import("../views/passenger/HelpPage.vue") },
  { path: "/assistant", component: () => import("../views/passenger/AssistantPage.vue") },
  {
    path: "/privacy",
    component: () => import("../views/auth/PrivacyNoticePage.vue"),
  },
  {
    path: "/reset-password",
    component: () => import("../views/auth/ResetPasswordPage.vue"),
  },
  {
    path: "/",
    name: "Landing",
    component: () => import("../views/auth/LandingPage.vue"),
  },
  {
    path: "/home",
    name: "Home",
    component: () => import("../views/passenger/HomePage.vue"),
  },
  {
    path: "/search",
    redirect: (to) => ({ path: "/trips", query: to.query, hash: to.hash }),
  },
  {
    path: "/trips",
    name: "Trips",
    component: () => import("../views/passenger/SearchPage.vue"),
  },
  {
    path: "/trip-details",
    name: "details",
    component: () => import("../views/passenger/BookingFlowPage.vue"),
  },
  {
    path: "/passenger-info",
    name: "passengers",
    component: () => import("../views/passenger/BookingFlowPage.vue"),
  },
  {
    path: "/booking-summary",
    name: "summary",
    component: () => import("../views/passenger/BookingFlowPage.vue"),
  },
  {
    path: "/booking-confirmed",
    name: "confirmed",
    component: () => import("../views/passenger/BookingFlowPage.vue"),
  },
  {
    path: "/bookings",
    name: "bookings",
    component: () => import("../views/passenger/PassengerRecordsPage.vue"),
  },
  {
    path: "/booking-details",
    name: "booking-details",
    component: () => import("../views/passenger/PassengerRecordsPage.vue"),
  },
  {
    path: "/ticket",
    name: "ticket",
    component: () => import("../views/passenger/PassengerRecordsPage.vue"),
  },
  {
    path: "/notifications",
    name: "notifications",
    component: () => import("../views/passenger/PassengerRecordsPage.vue"),
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("../views/passenger/ProfilePage.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../views/shared/SettingsPage.vue"),
  },
  {
    path: "/settings/appearance",
    name: "settings-appearance",
    component: () => import("../views/shared/SettingsPage.vue"),
  },
  {
    path: "/settings/profile",
    name: "settings-profile",
    component: () => import("../views/shared/SettingsPage.vue"),
  },
  {
    path: "/settings/password",
    name: "settings-password",
    component: () => import("../views/shared/SettingsPage.vue"),
  },
  { path: "/role-preview", redirect: "/home" },
  {
    path: "/staff/ticketing/walk-in",
    name: "ticketing-walk-in",
    component: () => import("../views/staff/ticketing/TicketingWalkInPage.vue"),
  },
  {
    path: "/staff/:role/settings",
    redirect: (to) => `/staff/${to.params.role}/settings/account`,
  },
  {
    path: "/staff/:role/settings/:section",
    name: "staff-settings",
    component: () => import("../views/shared/StaffSettingsPage.vue"),
  },
  {
    path: "/staff/:role(ticketing)/bookings",
    component: () => import("../views/staff/ticketing/TicketingPage.vue"),
  },
  {
    path: "/staff/boarding/:section(check-in|boarding|manifest)",
    component: () => import("../views/staff/boarding/StaffBoardingPage.vue"),
  },
  {
    path: "/staff/:role/:section(trips|passengers|fares|no-shows|notifications)",
    component: () => import("../views/staff/StaffCatalogPage.vue"),
  },
  {
    path: "/staff/boarding",
    name: "staff-boarding",
    component: () => import("../views/staff/boarding/StaffBoardingPage.vue"),
  },
  {
    path: "/staff/:role",
    name: "staff",
    component: () => import("../views/staff/ticketing/TicketingPage.vue"),
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/auth/AuthPage.vue"),
  },
  {
    path: "/register",
    name: "register",
    component: () => import("../views/auth/AuthPage.vue"),
  },
  {
    path: "/admin",
    name: "admin",
    component: () => import("../views/admin/AdminWorkspacePage.vue"),
  },
  {
    path: "/admin/settings",
    name: "admin-settings",
    component: () => import("../views/shared/SettingsPage.vue"),
  },
  {
    path: "/admin/settings/:preference(profile|password|appearance)",
    component: () => import("../views/shared/SettingsPage.vue"),
  },
  {
    path: "/admin/:section",
    component: () => import("../views/admin/AdminWorkspacePage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

let navigationNumber = 0;
router.afterEach(async (to, from) => {
  const request = ++navigationNumber;
  const label = to.path.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') || 'Welcome';
  document.title = `${label.replace(/\b\w/g, letter => letter.toUpperCase())} | BarkoLink`;
  if (to.path === from.path) return;
  await nextTick();
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused.closest("ion-router-outlet"))
    focused.blur();
  window.setTimeout(() => {
    if (request !== navigationNumber) return;
    const headings = Array.from(document.querySelectorAll<HTMLElement>('.ion-page:not(.ion-page-hidden):not(.ion-page-invisible) h1'));
    const heading = headings.filter(el => el.getClientRects().length).at(-1);
    if (!heading) return;
    document.title = `${heading.textContent?.trim()} | BarkoLink`;
    if (document.activeElement instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, 450);
});

router.beforeEach(async (to) => {
  const path = to.path;
  if (path === '/admin/analytics') return '/admin/reports';
  if (
    path.startsWith("/admin/") &&
    !/^\/admin\/settings(?:\/(profile|password|appearance))?$/.test(path) &&
    ![
      "bookings",
      "passengers",
      "trips",
      "fares",
      "ports",
      "vessels",
      "check-in",
      "boarding",
      "manifest",
      "reports",
      "users",
      "operations",
      "audit-logs",
      "advisories",
      "trip-operations",
      "routes",
      "accommodation",
      "no-shows",
      "notifications",
      "inbox",
      "analytics",
      "vouchers",
    ].includes(String(to.params.section || ""))
  )
    return "/admin";
  const protectedPassenger = [
    "/assistant",
    "/travelers",
    "/home",
    "/trip-details",
    "/passenger-info",
    "/booking-summary",
    "/booking-confirmed",
    "/bookings",
    "/booking-details",
    "/ticket",
    "/notifications",
    "/profile",
    "/settings",
    "/settings/appearance",
    "/settings/profile",
    "/settings/password",
  ];
  const staffPath =
    /^\/staff\/(ticketing|boarding)(?:\/(walk-in|bookings|passengers|trips|fares|check-in|boarding|manifest|no-shows|notifications|settings(?:\/(account|security|appearance))?))?$/.exec(
      path,
    );
  if (
    path.startsWith("/staff/") &&
    (!staffPath ||
      (["walk-in", "bookings", "passengers", "fares"].includes(staffPath[2]) &&
        staffPath[1] !== "ticketing") ||
      (staffPath &&
        ["check-in", "boarding", "manifest", "no-shows"].includes(
          staffPath[2],
        ) &&
        staffPath[1] !== "boarding"))
  )
    return "/login";
  const role = path.startsWith("/admin")
    ? "ADMIN"
    : path.startsWith("/staff/ticketing")
      ? "TICKETING"
      : path.startsWith("/staff/boarding")
        ? "BOARDING"
        : null;
  if (!supabaseConfigured || !auth)
    return role || protectedPassenger.includes(path)
      ? { path: "/login", query: { redirect: to.fullPath } }
      : true;
  if (
    path === "/login" ||
    path === "/register" ||
    path === "/" ||
    path === "/reset-password" ||
    path === "/privacy" || path === "/trips" || path === "/help"
  )
    return true;
  const authInstance = auth;
  await authInstance.ready();
  const user = authInstance.currentUser;
  if (!user) return { path: "/login", query: { redirect: to.fullPath } };
  if (role || protectedPassenger.includes(path)) {
    let assignedRole = "";
    try {
      const tokenResult = await user.getRoleSession(true);
      const profile =
        !tokenResult.claims.role && database
          ? await myProfile(database, { fetchPolicy: "SERVER_ONLY" })
          : null;
      assignedRole = resolveAccountRole(
        tokenResult.claims.role,
        profile?.data.user?.role,
      );
    } catch (error) {
      return {
        path: "/login",
        query: {
          redirect: to.fullPath,
          sessionError: databaseRequestError(
            error,
            "Could not verify your account. Please try signing in again.",
          ),
        },
      };
    }
    const destination = roleDestination(
      assignedRole as import("../data/sessionRole").AccountRole,
    );
    if (role && assignedRole !== role && assignedRole !== "ADMIN")
      return destination;
    if (protectedPassenger.includes(path) && assignedRole !== "PASSENGER")
      return destination;
  }
  return true;
});

export default router;
