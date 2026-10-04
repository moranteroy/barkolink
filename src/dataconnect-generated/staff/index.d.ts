import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AdminCancelBookingData {
  query?: {
    bookings: ({
      status: string;
      paymentStatus: string;
      passengerCount: number;
    })[];
    sailings: ({
      code: string;
      departureAt: TimestampString;
    } & Sailing_Key)[];
  };
  booking_update?: Booking_Key | null;
  sailing_update?: Sailing_Key | null;
}

export interface AdminCancelBookingVariables {
  bookingId: UUIDString;
  sailingCode: string;
  passengerCount: number;
}

export interface AdminCreatePortData {
  port_insert: Port_Key;
}

export interface AdminCreatePortVariables {
  code: string;
  name: string;
  city: string;
  region?: string | null;
}

export interface AdminCreateSailingData {
  codeLock?: number | null;
  query?: {
    ports: ({
      id: UUIDString;
    } & Port_Key)[];
    vessels: ({
      id: UUIDString;
      passengerCapacity: number;
    } & Vessel_Key)[];
    fares: ({
      regularFare: number;
      studentDiscount: number;
      seniorDiscount: number;
      childDiscount: number;
      pwdDiscount: number;
    })[];
    nextTripCode?: unknown | null;
  };
  sailing_insert: Sailing_Key;
}

export interface AdminCreateSailingVariables {
  code: string;
  originPortId: UUIDString;
  destinationPortId: UUIDString;
  vesselId: UUIDString;
  departureAt: TimestampString;
  arrivalAt: TimestampString;
  durationMinutes: number;
  regularFare: number;
  studentFare: number;
  seniorFare: number;
  childFare: number;
  pwdFare: number;
}

export interface AdminCreateVesselData {
  vessel_insert: Vessel_Key;
}

export interface AdminCreateVesselVariables {
  code: string;
  name: string;
  capacity: number;
}

export interface AdminDashboardStatsData {
  todaySailings: ({
    _count: number;
  })[];
  todayBookings: ({
    _count: number;
  })[];
  cancelledBookings: ({
    _count: number;
  })[];
  allPassengers: ({
    _count: number;
  })[];
  checkedInPassengers: ({
    _count: number;
  })[];
  boardedPassengers: ({
    _count: number;
  })[];
}

export interface AdminDashboardStatsVariables {
  dayStart: TimestampString;
  dayEnd: TimestampString;
}

export interface AdminExportManifestData {
  bookingPassengers: ({
    fullName: string;
    sex?: string | null;
    passengerType: string;
    ticketStatus: string;
    boardedAt?: TimestampString | null;
    booking: {
      reference: string;
      sailing: {
        code: string;
      } & Sailing_Key;
    };
  })[];
}

export interface AdminExportManifestVariables {
  sailingCode: string;
  offset: number;
}

export interface AdminFareSettingsData {
  fareSettings?: {
    regularFare: number;
    studentDiscount: number;
    seniorDiscount: number;
    childDiscount: number;
    pwdDiscount: number;
  };
  vesselFareSettings: ({
    code: string;
    regularFare: number;
    studentDiscount: number;
    seniorDiscount: number;
    childDiscount: number;
    pwdDiscount: number;
  } & FareSettings_Key)[];
}

export interface AdminNextTripCodeData {
  nextTripCode?: unknown | null;
}

export interface AdminPassengerRecordsData {
  bookingPassengers: ({
    id: UUIDString;
    fullName: string;
    passengerType: string;
    sex?: string | null;
    ticketCode: UUIDString;
    ticketStatus: string;
    checkedInAt?: TimestampString | null;
    boardedAt?: TimestampString | null;
    createdAt: TimestampString;
    booking: {
      reference: string;
      status: string;
      paymentStatus: string;
      owner: {
        fullName: string;
        email: string;
      };
      sailing: {
        code: string;
        status: string;
        departureAt: TimestampString;
        origin: {
          name: string;
        };
        destination: {
          name: string;
        };
        vessel: {
          name: string;
        };
      } & Sailing_Key;
    };
  } & BookingPassenger_Key)[];
}

export interface AdminPortsData {
  ports: ({
    id: UUIDString;
    code: string;
    name: string;
    city: string;
    region?: string | null;
    isActive: boolean;
  } & Port_Key)[];
}

export interface AdminReportsData {
  sailings?: unknown[] | null;
}

export interface AdminReportsVariables {
  startAt: TimestampString;
  endAt: TimestampString;
}

export interface AdminRescheduleSailingData {
  query?: {
    sailings: ({
      code: string;
      departureAt: TimestampString;
      arrivalAt: TimestampString;
    } & Sailing_Key)[];
  };
  sailing_update?: Sailing_Key | null;
  notified?: number | null;
}

export interface AdminRescheduleSailingVariables {
  code: string;
  departureAt: TimestampString;
  arrivalAt: TimestampString;
  durationMinutes: number;
}

export interface AdminSailingBookingsData {
  bookings: ({
    id: UUIDString;
    ownerUid: string;
    passengerCount: number;
    bookingChannel: string;
  } & Booking_Key)[];
}

export interface AdminSailingBookingsVariables {
  code: string;
}

export interface AdminSailingsData {
  sailings: ({
    code: string;
    departureAt: TimestampString;
    arrivalAt: TimestampString;
    availableSeats: number;
    regularFare: number;
    studentFare: number;
    seniorFare: number;
    childFare: number;
    pwdFare: number;
    status: string;
    origin: {
      id: UUIDString;
      name: string;
    } & Port_Key;
    destination: {
      id: UUIDString;
      name: string;
    } & Port_Key;
    vessel: {
      id: UUIDString;
      name: string;
      passengerCapacity: number;
    } & Vessel_Key;
  } & Sailing_Key)[];
}

export interface AdminSaveFareSettingsData {
  query?: {
    vessels: ({
      id: UUIDString;
    } & Vessel_Key)[];
  };
  fareSettings_upsert: FareSettings_Key;
}

export interface AdminSaveFareSettingsVariables {
  vesselId: UUIDString;
  regularFare: number;
  studentDiscount: number;
  seniorDiscount: number;
  childDiscount: number;
  pwdDiscount: number;
}

export interface AdminUpdatePortData {
  port_update?: Port_Key | null;
}

export interface AdminUpdatePortVariables {
  id: UUIDString;
  name: string;
  city: string;
  region?: string | null;
  isActive: boolean;
}

export interface AdminUpdateSailingStatusData {
  query?: {
    sailings: ({
      code: string;
      status: string;
    } & Sailing_Key)[];
  };
  sailing_update?: Sailing_Key | null;
  notified?: number | null;
}

export interface AdminUpdateSailingStatusVariables {
  code: string;
  status: string;
}

export interface AdminUpdateUnbookedSailingData {
  query?: {
    sailings: ({
      code: string;
      availableSeats: number;
      vessel: {
        passengerCapacity: number;
      };
    } & Sailing_Key)[];
    bookings: ({
      id: UUIDString;
    } & Booking_Key)[];
    ports: ({
      id: UUIDString;
    } & Port_Key)[];
    vessels: ({
      id: UUIDString;
      passengerCapacity: number;
    } & Vessel_Key)[];
  };
  sailing_update?: Sailing_Key | null;
}

export interface AdminUpdateUnbookedSailingVariables {
  code: string;
  originPortId: UUIDString;
  destinationPortId: UUIDString;
  vesselId: UUIDString;
  departureAt: TimestampString;
  arrivalAt: TimestampString;
  durationMinutes: number;
  regularFare: number;
  studentFare: number;
  seniorFare: number;
  childFare: number;
  pwdFare: number;
}

export interface AdminUpdateVesselData {
  vessel_update?: Vessel_Key | null;
}

export interface AdminUpdateVesselVariables {
  id: UUIDString;
  name: string;
  capacity: number;
  isActive: boolean;
}

export interface AdminUsersData {
  users: ({
    uid: string;
    email: string;
    fullName: string;
    phone?: string | null;
    role: string;
    createdAt: TimestampString;
  } & User_Key)[];
}

export interface AdminVesselsData {
  vessels: ({
    id: UUIDString;
    code: string;
    name: string;
    passengerCapacity: number;
    isActive: boolean;
  } & Vessel_Key)[];
}

export interface BoardTicketData {
  query?: {
    bookingPassengers: ({
      id: UUIDString;
    } & BookingPassenger_Key)[];
  };
  bookingPassenger_update?: BookingPassenger_Key | null;
  boardingEvent_insert: BoardingEvent_Key;
}

export interface BoardTicketVariables {
  passengerId: UUIDString;
}

export interface BoardingActivityData {
  boardingEvents: ({
    id: UUIDString;
    eventType: string;
    createdAt: TimestampString;
    staffUid: string;
    passenger: {
      fullName: string;
      booking: {
        reference: string;
      };
    };
  } & BoardingEvent_Key)[];
}

export interface BoardingActivityVariables {
  sailingCode: string;
}

export interface BoardingEvent_Key {
  id: UUIDString;
  __typename?: 'BoardingEvent_Key';
}

export interface BoardingManifestData {
  bookings: ({
    reference: string;
    owner: {
      fullName: string;
    };
    sailing: {
      code: string;
      departureAt: TimestampString;
    } & Sailing_Key;
    bookingPassengers_on_booking: ({
      fullName: string;
      passengerType: string;
      id: UUIDString;
      ticketCode: UUIDString;
      ticketStatus: string;
      booking: {
        paymentStatus: string;
        status: string;
      };
      checkedInAt?: TimestampString | null;
      boardedAt?: TimestampString | null;
    } & BookingPassenger_Key)[];
  })[];
}

export interface BoardingManifestVariables {
  sailingCode: string;
}

export interface BoardingSailingsData {
  sailings: ({
    code: string;
    status: string;
    departureAt: TimestampString;
    origin: {
      name: string;
    };
    destination: {
      name: string;
    };
    vessel: {
      name: string;
    };
  } & Sailing_Key)[];
}

export interface BookingPassenger_Key {
  id: UUIDString;
  __typename?: 'BookingPassenger_Key';
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: 'Booking_Key';
}

export interface CheckInTicketData {
  query?: {
    bookingPassengers: ({
      id: UUIDString;
      booking: {
        sailing: {
          status: string;
          departureAt: TimestampString;
        };
      };
    } & BookingPassenger_Key)[];
  };
  bookingPassenger_update?: BookingPassenger_Key | null;
  boardingEvent_insert: BoardingEvent_Key;
}

export interface CheckInTicketVariables {
  passengerId: UUIDString;
}

export interface CollectBookingPaymentData {
  query?: {
    bookings: ({
      id: UUIDString;
      ownerUid: string;
      reference: string;
      passengerCount: number;
    } & Booking_Key)[];
  };
  booking_update?: Booking_Key | null;
  bookingPassenger_updateMany: number;
  notification_insert: Notification_Key;
}

export interface CollectBookingPaymentVariables {
  bookingId: UUIDString;
  method: string;
}

export interface FareSettings_Key {
  code: string;
  __typename?: 'FareSettings_Key';
}

export interface Notification_Key {
  id: UUIDString;
  __typename?: 'Notification_Key';
}

export interface Port_Key {
  id: UUIDString;
  __typename?: 'Port_Key';
}

export interface Sailing_Key {
  code: string;
  __typename?: 'Sailing_Key';
}

export interface StaffBookingsData {
  bookings: ({
    id: UUIDString;
    reference: string;
    status: string;
    passengerCount: number;
    total: number;
    serviceFee: number;
    paymentStatus: string;
    paymentMethod?: string | null;
    paidAt?: TimestampString | null;
    bookingChannel: string;
    createdAt: TimestampString;
    owner: {
      fullName: string;
      email: string;
      phone?: string | null;
    };
    sailing: {
      code: string;
      departureAt: TimestampString;
      origin: {
        name: string;
      };
      destination: {
        name: string;
      };
      vessel: {
        name: string;
      };
    } & Sailing_Key;
    bookingPassengers_on_booking: ({
      fullName: string;
      passengerType: string;
      fare: number;
      ticketCode: UUIDString;
      ticketStatus: string;
    })[];
  } & Booking_Key)[];
}

export interface TicketingCreateGuestWalkInData {
  query?: {
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
  };
  guest: User_Key;
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  bookingPassenger_insert: BookingPassenger_Key;
}

export interface TicketingCreateGuestWalkInVariables {
  sailingCode: string;
  guestUid: string;
  guestEmail: string;
  reference: string;
  ticketCode: UUIDString;
  passengerName: string;
  passengerPhone?: string | null;
  birthDate?: DateString | null;
  sex?: string | null;
  nationality?: string | null;
  passengerType: string;
  method: string;
}

export interface TicketingCreateWalkInData {
  query?: {
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
    users: ({
      uid: string;
    } & User_Key)[];
  };
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  bookingPassenger_insert: BookingPassenger_Key;
  notification_insert: Notification_Key;
}

export interface TicketingCreateWalkInVariables {
  sailingCode: string;
  ownerUid: string;
  reference: string;
  passengerName: string;
  passengerType: string;
  method: string;
}

export interface TicketingPassengerAccountsData {
  users: ({
    uid: string;
    fullName: string;
    email: string;
  } & User_Key)[];
}

export interface TicketingSailingsData {
  sailings: ({
    code: string;
    departureAt: TimestampString;
    availableSeats: number;
    regularFare: number;
    studentFare: number;
    seniorFare: number;
    childFare: number;
    pwdFare: number;
    origin: {
      name: string;
    };
    destination: {
      name: string;
    };
    vessel: {
      name: string;
    };
  } & Sailing_Key)[];
}

export interface User_Key {
  uid: string;
  __typename?: 'User_Key';
}

export interface Vessel_Key {
  id: UUIDString;
  __typename?: 'Vessel_Key';
}

interface AdminFareSettingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminFareSettingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminFareSettingsData, undefined>;
  operationName: string;
}
export const adminFareSettingsRef: AdminFareSettingsRef;

export function adminFareSettings(options?: ExecuteQueryOptions): QueryPromise<AdminFareSettingsData, undefined>;
export function adminFareSettings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminFareSettingsData, undefined>;

interface AdminSaveFareSettingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminSaveFareSettingsVariables): MutationRef<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminSaveFareSettingsVariables): MutationRef<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;
  operationName: string;
}
export const adminSaveFareSettingsRef: AdminSaveFareSettingsRef;

export function adminSaveFareSettings(vars: AdminSaveFareSettingsVariables): MutationPromise<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;
export function adminSaveFareSettings(dc: DataConnect, vars: AdminSaveFareSettingsVariables): MutationPromise<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;

interface AdminExportManifestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminExportManifestVariables): QueryRef<AdminExportManifestData, AdminExportManifestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminExportManifestVariables): QueryRef<AdminExportManifestData, AdminExportManifestVariables>;
  operationName: string;
}
export const adminExportManifestRef: AdminExportManifestRef;

export function adminExportManifest(vars: AdminExportManifestVariables, options?: ExecuteQueryOptions): QueryPromise<AdminExportManifestData, AdminExportManifestVariables>;
export function adminExportManifest(dc: DataConnect, vars: AdminExportManifestVariables, options?: ExecuteQueryOptions): QueryPromise<AdminExportManifestData, AdminExportManifestVariables>;

interface StaffBookingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<StaffBookingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<StaffBookingsData, undefined>;
  operationName: string;
}
export const staffBookingsRef: StaffBookingsRef;

export function staffBookings(options?: ExecuteQueryOptions): QueryPromise<StaffBookingsData, undefined>;
export function staffBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<StaffBookingsData, undefined>;

interface TicketingPassengerAccountsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<TicketingPassengerAccountsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<TicketingPassengerAccountsData, undefined>;
  operationName: string;
}
export const ticketingPassengerAccountsRef: TicketingPassengerAccountsRef;

export function ticketingPassengerAccounts(options?: ExecuteQueryOptions): QueryPromise<TicketingPassengerAccountsData, undefined>;
export function ticketingPassengerAccounts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<TicketingPassengerAccountsData, undefined>;

interface TicketingSailingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<TicketingSailingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<TicketingSailingsData, undefined>;
  operationName: string;
}
export const ticketingSailingsRef: TicketingSailingsRef;

export function ticketingSailings(options?: ExecuteQueryOptions): QueryPromise<TicketingSailingsData, undefined>;
export function ticketingSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<TicketingSailingsData, undefined>;

interface CollectBookingPaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CollectBookingPaymentVariables): MutationRef<CollectBookingPaymentData, CollectBookingPaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CollectBookingPaymentVariables): MutationRef<CollectBookingPaymentData, CollectBookingPaymentVariables>;
  operationName: string;
}
export const collectBookingPaymentRef: CollectBookingPaymentRef;

export function collectBookingPayment(vars: CollectBookingPaymentVariables): MutationPromise<CollectBookingPaymentData, CollectBookingPaymentVariables>;
export function collectBookingPayment(dc: DataConnect, vars: CollectBookingPaymentVariables): MutationPromise<CollectBookingPaymentData, CollectBookingPaymentVariables>;

interface TicketingCreateWalkInRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TicketingCreateWalkInVariables): MutationRef<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TicketingCreateWalkInVariables): MutationRef<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;
  operationName: string;
}
export const ticketingCreateWalkInRef: TicketingCreateWalkInRef;

export function ticketingCreateWalkIn(vars: TicketingCreateWalkInVariables): MutationPromise<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;
export function ticketingCreateWalkIn(dc: DataConnect, vars: TicketingCreateWalkInVariables): MutationPromise<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;

interface TicketingCreateGuestWalkInRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TicketingCreateGuestWalkInVariables): MutationRef<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TicketingCreateGuestWalkInVariables): MutationRef<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;
  operationName: string;
}
export const ticketingCreateGuestWalkInRef: TicketingCreateGuestWalkInRef;

export function ticketingCreateGuestWalkIn(vars: TicketingCreateGuestWalkInVariables): MutationPromise<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;
export function ticketingCreateGuestWalkIn(dc: DataConnect, vars: TicketingCreateGuestWalkInVariables): MutationPromise<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;

interface BoardingManifestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: BoardingManifestVariables): QueryRef<BoardingManifestData, BoardingManifestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: BoardingManifestVariables): QueryRef<BoardingManifestData, BoardingManifestVariables>;
  operationName: string;
}
export const boardingManifestRef: BoardingManifestRef;

export function boardingManifest(vars: BoardingManifestVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingManifestData, BoardingManifestVariables>;
export function boardingManifest(dc: DataConnect, vars: BoardingManifestVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingManifestData, BoardingManifestVariables>;

interface BoardingSailingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<BoardingSailingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<BoardingSailingsData, undefined>;
  operationName: string;
}
export const boardingSailingsRef: BoardingSailingsRef;

export function boardingSailings(options?: ExecuteQueryOptions): QueryPromise<BoardingSailingsData, undefined>;
export function boardingSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<BoardingSailingsData, undefined>;

interface BoardingActivityRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: BoardingActivityVariables): QueryRef<BoardingActivityData, BoardingActivityVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: BoardingActivityVariables): QueryRef<BoardingActivityData, BoardingActivityVariables>;
  operationName: string;
}
export const boardingActivityRef: BoardingActivityRef;

export function boardingActivity(vars: BoardingActivityVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingActivityData, BoardingActivityVariables>;
export function boardingActivity(dc: DataConnect, vars: BoardingActivityVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingActivityData, BoardingActivityVariables>;

interface CheckInTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CheckInTicketVariables): MutationRef<CheckInTicketData, CheckInTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CheckInTicketVariables): MutationRef<CheckInTicketData, CheckInTicketVariables>;
  operationName: string;
}
export const checkInTicketRef: CheckInTicketRef;

export function checkInTicket(vars: CheckInTicketVariables): MutationPromise<CheckInTicketData, CheckInTicketVariables>;
export function checkInTicket(dc: DataConnect, vars: CheckInTicketVariables): MutationPromise<CheckInTicketData, CheckInTicketVariables>;

interface BoardTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: BoardTicketVariables): MutationRef<BoardTicketData, BoardTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: BoardTicketVariables): MutationRef<BoardTicketData, BoardTicketVariables>;
  operationName: string;
}
export const boardTicketRef: BoardTicketRef;

export function boardTicket(vars: BoardTicketVariables): MutationPromise<BoardTicketData, BoardTicketVariables>;
export function boardTicket(dc: DataConnect, vars: BoardTicketVariables): MutationPromise<BoardTicketData, BoardTicketVariables>;

interface AdminSailingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminSailingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminSailingsData, undefined>;
  operationName: string;
}
export const adminSailingsRef: AdminSailingsRef;

export function adminSailings(options?: ExecuteQueryOptions): QueryPromise<AdminSailingsData, undefined>;
export function adminSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminSailingsData, undefined>;

interface AdminDashboardStatsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDashboardStatsVariables): QueryRef<AdminDashboardStatsData, AdminDashboardStatsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminDashboardStatsVariables): QueryRef<AdminDashboardStatsData, AdminDashboardStatsVariables>;
  operationName: string;
}
export const adminDashboardStatsRef: AdminDashboardStatsRef;

export function adminDashboardStats(vars: AdminDashboardStatsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminDashboardStatsData, AdminDashboardStatsVariables>;
export function adminDashboardStats(dc: DataConnect, vars: AdminDashboardStatsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminDashboardStatsData, AdminDashboardStatsVariables>;

interface AdminUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminUsersData, undefined>;
  operationName: string;
}
export const adminUsersRef: AdminUsersRef;

export function adminUsers(options?: ExecuteQueryOptions): QueryPromise<AdminUsersData, undefined>;
export function adminUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminUsersData, undefined>;

interface AdminPassengerRecordsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminPassengerRecordsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminPassengerRecordsData, undefined>;
  operationName: string;
}
export const adminPassengerRecordsRef: AdminPassengerRecordsRef;

export function adminPassengerRecords(options?: ExecuteQueryOptions): QueryPromise<AdminPassengerRecordsData, undefined>;
export function adminPassengerRecords(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminPassengerRecordsData, undefined>;

interface AdminPortsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminPortsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminPortsData, undefined>;
  operationName: string;
}
export const adminPortsRef: AdminPortsRef;

export function adminPorts(options?: ExecuteQueryOptions): QueryPromise<AdminPortsData, undefined>;
export function adminPorts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminPortsData, undefined>;

interface AdminVesselsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminVesselsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminVesselsData, undefined>;
  operationName: string;
}
export const adminVesselsRef: AdminVesselsRef;

export function adminVessels(options?: ExecuteQueryOptions): QueryPromise<AdminVesselsData, undefined>;
export function adminVessels(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminVesselsData, undefined>;

interface AdminCreatePortRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCreatePortVariables): MutationRef<AdminCreatePortData, AdminCreatePortVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminCreatePortVariables): MutationRef<AdminCreatePortData, AdminCreatePortVariables>;
  operationName: string;
}
export const adminCreatePortRef: AdminCreatePortRef;

export function adminCreatePort(vars: AdminCreatePortVariables): MutationPromise<AdminCreatePortData, AdminCreatePortVariables>;
export function adminCreatePort(dc: DataConnect, vars: AdminCreatePortVariables): MutationPromise<AdminCreatePortData, AdminCreatePortVariables>;

interface AdminUpdatePortRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdatePortVariables): MutationRef<AdminUpdatePortData, AdminUpdatePortVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminUpdatePortVariables): MutationRef<AdminUpdatePortData, AdminUpdatePortVariables>;
  operationName: string;
}
export const adminUpdatePortRef: AdminUpdatePortRef;

export function adminUpdatePort(vars: AdminUpdatePortVariables): MutationPromise<AdminUpdatePortData, AdminUpdatePortVariables>;
export function adminUpdatePort(dc: DataConnect, vars: AdminUpdatePortVariables): MutationPromise<AdminUpdatePortData, AdminUpdatePortVariables>;

interface AdminCreateVesselRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCreateVesselVariables): MutationRef<AdminCreateVesselData, AdminCreateVesselVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminCreateVesselVariables): MutationRef<AdminCreateVesselData, AdminCreateVesselVariables>;
  operationName: string;
}
export const adminCreateVesselRef: AdminCreateVesselRef;

export function adminCreateVessel(vars: AdminCreateVesselVariables): MutationPromise<AdminCreateVesselData, AdminCreateVesselVariables>;
export function adminCreateVessel(dc: DataConnect, vars: AdminCreateVesselVariables): MutationPromise<AdminCreateVesselData, AdminCreateVesselVariables>;

interface AdminUpdateVesselRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdateVesselVariables): MutationRef<AdminUpdateVesselData, AdminUpdateVesselVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminUpdateVesselVariables): MutationRef<AdminUpdateVesselData, AdminUpdateVesselVariables>;
  operationName: string;
}
export const adminUpdateVesselRef: AdminUpdateVesselRef;

export function adminUpdateVessel(vars: AdminUpdateVesselVariables): MutationPromise<AdminUpdateVesselData, AdminUpdateVesselVariables>;
export function adminUpdateVessel(dc: DataConnect, vars: AdminUpdateVesselVariables): MutationPromise<AdminUpdateVesselData, AdminUpdateVesselVariables>;

interface AdminCreateSailingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCreateSailingVariables): MutationRef<AdminCreateSailingData, AdminCreateSailingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminCreateSailingVariables): MutationRef<AdminCreateSailingData, AdminCreateSailingVariables>;
  operationName: string;
}
export const adminCreateSailingRef: AdminCreateSailingRef;

export function adminCreateSailing(vars: AdminCreateSailingVariables): MutationPromise<AdminCreateSailingData, AdminCreateSailingVariables>;
export function adminCreateSailing(dc: DataConnect, vars: AdminCreateSailingVariables): MutationPromise<AdminCreateSailingData, AdminCreateSailingVariables>;

interface AdminUpdateSailingStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdateSailingStatusVariables): MutationRef<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminUpdateSailingStatusVariables): MutationRef<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;
  operationName: string;
}
export const adminUpdateSailingStatusRef: AdminUpdateSailingStatusRef;

export function adminUpdateSailingStatus(vars: AdminUpdateSailingStatusVariables): MutationPromise<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;
export function adminUpdateSailingStatus(dc: DataConnect, vars: AdminUpdateSailingStatusVariables): MutationPromise<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;

interface AdminSailingBookingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminSailingBookingsVariables): QueryRef<AdminSailingBookingsData, AdminSailingBookingsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminSailingBookingsVariables): QueryRef<AdminSailingBookingsData, AdminSailingBookingsVariables>;
  operationName: string;
}
export const adminSailingBookingsRef: AdminSailingBookingsRef;

export function adminSailingBookings(vars: AdminSailingBookingsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminSailingBookingsData, AdminSailingBookingsVariables>;
export function adminSailingBookings(dc: DataConnect, vars: AdminSailingBookingsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminSailingBookingsData, AdminSailingBookingsVariables>;

interface AdminUpdateUnbookedSailingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdateUnbookedSailingVariables): MutationRef<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminUpdateUnbookedSailingVariables): MutationRef<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;
  operationName: string;
}
export const adminUpdateUnbookedSailingRef: AdminUpdateUnbookedSailingRef;

export function adminUpdateUnbookedSailing(vars: AdminUpdateUnbookedSailingVariables): MutationPromise<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;
export function adminUpdateUnbookedSailing(dc: DataConnect, vars: AdminUpdateUnbookedSailingVariables): MutationPromise<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;

interface AdminRescheduleSailingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminRescheduleSailingVariables): MutationRef<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminRescheduleSailingVariables): MutationRef<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;
  operationName: string;
}
export const adminRescheduleSailingRef: AdminRescheduleSailingRef;

export function adminRescheduleSailing(vars: AdminRescheduleSailingVariables): MutationPromise<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;
export function adminRescheduleSailing(dc: DataConnect, vars: AdminRescheduleSailingVariables): MutationPromise<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;

interface AdminCancelBookingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCancelBookingVariables): MutationRef<AdminCancelBookingData, AdminCancelBookingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminCancelBookingVariables): MutationRef<AdminCancelBookingData, AdminCancelBookingVariables>;
  operationName: string;
}
export const adminCancelBookingRef: AdminCancelBookingRef;

export function adminCancelBooking(vars: AdminCancelBookingVariables): MutationPromise<AdminCancelBookingData, AdminCancelBookingVariables>;
export function adminCancelBooking(dc: DataConnect, vars: AdminCancelBookingVariables): MutationPromise<AdminCancelBookingData, AdminCancelBookingVariables>;

interface AdminReportsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminReportsVariables): QueryRef<AdminReportsData, AdminReportsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminReportsVariables): QueryRef<AdminReportsData, AdminReportsVariables>;
  operationName: string;
}
export const adminReportsRef: AdminReportsRef;

export function adminReports(vars: AdminReportsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminReportsData, AdminReportsVariables>;
export function adminReports(dc: DataConnect, vars: AdminReportsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminReportsData, AdminReportsVariables>;

interface AdminNextTripCodeRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminNextTripCodeData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminNextTripCodeData, undefined>;
  operationName: string;
}
export const adminNextTripCodeRef: AdminNextTripCodeRef;

export function adminNextTripCode(options?: ExecuteQueryOptions): QueryPromise<AdminNextTripCodeData, undefined>;
export function adminNextTripCode(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminNextTripCodeData, undefined>;

