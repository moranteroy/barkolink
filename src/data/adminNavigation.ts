import { bedOutline, boatOutline, briefcaseOutline, businessOutline, calendarOutline, chatbubblesOutline, clipboardOutline, compassOutline, constructOutline, documentTextOutline, enterOutline, giftOutline, gridOutline, homeOutline, idCardOutline, locationOutline, megaphoneOutline, navigateOutline, notificationsOutline, optionsOutline, peopleCircleOutline, peopleOutline, personRemoveOutline, pricetagsOutline, receiptOutline, scanOutline, settingsOutline, ticketOutline, walkOutline } from 'ionicons/icons';

export const adminNavigation = [
  {
    label: "OVERVIEW",
    icon: homeOutline,
    items: [{ key: "dashboard", label: "Dashboard", icon: gridOutline }],
  },
  {
    label: "WORKSPACE",
    icon: briefcaseOutline,
    items: [
      { key: "bookings", label: "Bookings", icon: ticketOutline },
      { key: "passengers", label: "Passengers", icon: peopleOutline },
    ],
  },
  {
    label: "FERRY OPERATIONS",
    icon: compassOutline,
    items: [
      { key: "trips", label: "Trips & schedules", icon: calendarOutline },
      {
        key: "trip-operations",
        label: "Trip operations",
        icon: optionsOutline,
      },
    ],
  },
  {
    label: "FLEET SETUP",
    icon: constructOutline,
    items: [
      { key: "ports", label: "Ports", icon: locationOutline },
      { key: "routes", label: "Routes", icon: navigateOutline },
      { key: "vessels", label: "Vessels", icon: boatOutline },
      { key: "accommodation", label: "Accommodation", icon: bedOutline },
    ],
  },
  {
    label: "PRICING & PROMOS",
    icon: pricetagsOutline,
    items: [
      { key: "fares", label: "Fares & discounts", icon: pricetagsOutline },
      { key: "vouchers", label: "Vouchers", icon: giftOutline },
    ],
  },
  {
    label: "PASSENGER OPERATIONS",
    icon: walkOutline,
    items: [
      { key: "check-in", label: "Check-in", icon: scanOutline },
      { key: "boarding", label: "Boarding", icon: enterOutline },
      { key: "manifest", label: "Passenger manifest", icon: clipboardOutline },
      { key: "no-shows", label: "No-shows", icon: personRemoveOutline },
    ],
  },
  {
    label: "COMMUNICATION",
    icon: chatbubblesOutline,
    items: [
      { key: "advisories", label: "Travel advisories", icon: megaphoneOutline },
      {
        key: "notifications",
        label: "Broadcasts",
        icon: notificationsOutline,
      },
    ],
  },
  {
    label: "MANAGEMENT",
    icon: businessOutline,
    items: [
      { key: "reports", label: "Reports", icon: documentTextOutline },
      { key: "users", label: "Users", icon: peopleCircleOutline },
      { key: "staff-ports", label: "Staff port assignments", icon: idCardOutline },
      { key: "audit-logs", label: "Audit logs", icon: receiptOutline },
      {
        key: "operations",
        label: "Operations settings",
        icon: settingsOutline,
      },
    ],
  },
];
