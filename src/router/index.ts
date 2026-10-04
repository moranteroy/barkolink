import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { nextTick } from 'vue'
import { auth, dataConnect, firebaseConfigured } from '../services/firebase'
import { myProfile } from '../dataconnect-generated/passenger'
import { resolveAccountRole, roleDestination } from '../data/sessionRole'
import { dataConnectRequestError } from '../data/dataConnectErrors'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('../views/LandingPage.vue')
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomePage.vue')
  },
  { path: '/search', name: 'Search', component: () => import('../views/SearchPage.vue') },
  { path: '/trip-details', name: 'details', component: () => import('../views/BookingFlowPage.vue') },
  { path: '/passenger-info', name: 'passengers', component: () => import('../views/BookingFlowPage.vue') },
  { path: '/booking-summary', name: 'summary', component: () => import('../views/BookingFlowPage.vue') },
  { path: '/booking-confirmed', name: 'confirmed', component: () => import('../views/BookingFlowPage.vue') },
  { path: '/bookings', name: 'bookings', component: () => import('../views/DemoPage.vue') },
  { path: '/booking-details', name: 'booking-details', component: () => import('../views/DemoPage.vue') },
  { path: '/ticket', name: 'ticket', component: () => import('../views/DemoPage.vue') },
  { path: '/notifications', name: 'notifications', component: () => import('../views/DemoPage.vue') },
  { path: '/profile', name: 'profile', redirect: '/settings/profile' },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsPage.vue') },
  { path: '/settings/appearance', name: 'settings-appearance', component: () => import('../views/SettingsPage.vue') },
  { path: '/settings/profile', name: 'settings-profile', component: () => import('../views/SettingsPage.vue') },
  { path: '/settings/password', name: 'settings-password', component: () => import('../views/SettingsPage.vue') },
  { path: '/role-preview', redirect: '/home' },
  { path: '/staff/ticketing/walk-in', name: 'ticketing-walk-in', component: () => import('../views/TicketingWalkInPage.vue') },
  { path: '/staff/:role/settings', redirect: to => `/staff/${to.params.role}/settings/account` },
  { path: '/staff/:role/settings/:section', name: 'staff-settings', component: () => import('../views/StaffSettingsPage.vue') },
  { path: '/staff/boarding', name: 'staff-boarding', component: () => import('../views/StaffBoardingPage.vue') },
  { path: '/staff/:role', name: 'staff', component: () => import('../views/StaffPage.vue') },
  { path: '/login', name: 'login', component: () => import('../views/AuthPage.vue') },
  { path: '/register', name: 'register', component: () => import('../views/AuthPage.vue') },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminWorkspacePage.vue') },
  { path: '/admin/settings', name: 'admin-settings', component: () => import('../views/SettingsPage.vue') },
  { path: '/admin/:section', component: () => import('../views/AdminWorkspacePage.vue') }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.afterEach(async () => {
  await nextTick()
  const focused = document.activeElement
  if (focused instanceof HTMLElement && focused.closest('ion-router-outlet')) focused.blur()
})

router.beforeEach(async to => {
  const path = to.path
  if (path.startsWith('/admin/') && path !== '/admin/settings' && !['bookings', 'passengers', 'trips', 'fares', 'ports', 'vessels', 'check-in', 'boarding', 'manifest', 'reports', 'users'].includes(String(to.params.section || ''))) return '/admin'
  const protectedPassenger = ['/home', '/search', '/trip-details', '/passenger-info', '/booking-summary', '/booking-confirmed', '/bookings', '/booking-details', '/ticket', '/notifications', '/profile', '/settings', '/settings/appearance', '/settings/profile', '/settings/password']
  const staffPath = /^\/staff\/(ticketing|boarding)(?:\/(walk-in|settings(?:\/(account|security|appearance))?))?$/.exec(path)
  if (path.startsWith('/staff/') && (!staffPath || (staffPath[2] === 'walk-in' && staffPath[1] !== 'ticketing'))) return '/login'
  const role = path.startsWith('/admin') ? 'ADMIN' : path.startsWith('/staff/ticketing') ? 'TICKETING' : path.startsWith('/staff/boarding') ? 'BOARDING' : null
  if (!firebaseConfigured || !auth) return role || protectedPassenger.includes(path) ? { path: '/login', query: { redirect: to.fullPath } } : true
  if (path === '/login' || path === '/register' || path === '/') return true
  const authInstance = auth
  await authInstance.authStateReady()
  const user = authInstance.currentUser
  if (!user) return { path: '/login', query: { redirect: to.fullPath } }
  if (role || protectedPassenger.includes(path)) {
    let assignedRole = ''
    try {
      const tokenResult = await user.getIdTokenResult(true)
      const profile = !tokenResult.claims.role && dataConnect
        ? await myProfile(dataConnect, { fetchPolicy: 'SERVER_ONLY' }) : null
      assignedRole = resolveAccountRole(tokenResult.claims.role, profile?.data.user?.role)
    } catch (error) {
      return { path: '/login', query: { redirect: to.fullPath, sessionError: dataConnectRequestError(error, 'Could not verify your account. Please try signing in again.') } }
    }
    const destination = roleDestination(assignedRole as import('../data/sessionRole').AccountRole)
    if (role && assignedRole !== role && assignedRole !== 'ADMIN') return destination
    if (protectedPassenger.includes(path) && assignedRole !== 'PASSENGER') return destination
  }
  return true
})

export default router
