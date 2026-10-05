import type {
  CustomDiscount,
  CustomDiscountFare,
} from "../../data/fareSettings";
import type { Accommodation } from "./workspaces";
// Application data contracts retained during the PostgreSQL migration.
export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export interface AdminCancelBookingData {
  query?: {
    bookings: {
      status: string;
      paymentStatus: string;
      paymentDeadline?: string | null;
      cancellationReason?: string | null;
      passengerCount: number;
    }[];
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
    fares: {
      regularFare: number;
      studentDiscount: number;
      seniorDiscount: number;
      childDiscount: number;
      pwdDiscount: number;
      pregnantDiscount?: number;
      passengerDiscounts?: CustomDiscount[] | null;
      customDiscounts?: CustomDiscount[];
    }[];
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
  pregnantFare?: number;
  passengerDiscounts?: CustomDiscountFare[] | null;
  customDiscounts?: CustomDiscountFare[];
  accommodations?: Accommodation[];
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
  todaySailings: {
    _count: number;
  }[];
  todayBookings: {
    _count: number;
  }[];
  cancelledBookings: {
    _count: number;
  }[];
  allPassengers: {
    _count: number;
  }[];
  checkedInPassengers: {
    _count: number;
  }[];
  boardedPassengers: {
    _count: number;
  }[];
}

export interface AdminDashboardStatsVariables {
  dayStart: TimestampString;
  dayEnd: TimestampString;
}

export interface AdminExportManifestData {
  bookingPassengers: {
    fullName: string;
    sex?: string | null;
    passengerType: string;
    ticketStatus: string;
    discountVerifiedAt?: string | null;
    discountVerificationNote?: string | null;
    boardedAt?: TimestampString | null;
    booking: {
      reference: string;
      sailing: {
        code: string;
      } & Sailing_Key;
    };
  }[];
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
    pregnantDiscount?: number;
    passengerDiscounts?: CustomDiscount[] | null;
    customDiscounts?: CustomDiscount[];
  };
  vesselFareSettings: ({
    code: string;
    regularFare: number;
    studentDiscount: number;
    seniorDiscount: number;
    childDiscount: number;
    pwdDiscount: number;
    pregnantDiscount?: number;
    passengerDiscounts?: CustomDiscount[] | null;
    customDiscounts?: CustomDiscount[];
  } & FareSettings_Key)[];
}

export interface AdminNextTripCodeData {
  nextTripCode?: unknown | null;
}

export interface AdminPassengerRecordsData {
  totalCount?: number;
  bookingPassengers: ({
    id: UUIDString;
    fullName: string;
    passengerType: string;
    sex?: string | null;
    ticketCode: UUIDString;
    ticketStatus: string;
    discountVerifiedAt?: string | null;
    discountVerificationNote?: string | null;
    checkedInAt?: TimestampString | null;
    boardedAt?: TimestampString | null;
    createdAt: TimestampString;
    booking: {
      reference: string;
      status: string;
      paymentStatus: string;
      paymentDeadline?: string | null;
      cancellationReason?: string | null;
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
  totalCount?: number;
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
    pregnantFare?: number;
    passengerDiscounts?: CustomDiscountFare[] | null;
    customDiscounts?: CustomDiscountFare[];
    accommodations?: Accommodation[];
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
  pregnantDiscount?: number;
  passengerDiscounts?: CustomDiscount[] | null;
  customDiscounts?: CustomDiscount[];
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
  reason?: string;
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
  pregnantFare?: number;
  passengerDiscounts?: CustomDiscountFare[] | null;
  customDiscounts?: CustomDiscountFare[];
  accommodations?: Accommodation[];
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
  totalCount?: number;
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
  __typename?: "BoardingEvent_Key";
}

export interface BoardingManifestData {
  bookings: {
    accommodationName?: string | null;
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
      discountVerifiedAt?: string | null;
      discountVerificationNote?: string | null;
      booking: {
        paymentStatus: string;
        paymentDeadline?: string | null;
        cancellationReason?: string | null;
        status: string;
      };
      checkedInAt?: TimestampString | null;
      boardedAt?: TimestampString | null;
    } & BookingPassenger_Key)[];
  }[];
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
  __typename?: "BookingPassenger_Key";
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: "Booking_Key";
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
  discountVerified?: boolean;
  verificationNote?: string;
}

export interface FareSettings_Key {
  code: string;
  __typename?: "FareSettings_Key";
}

export interface Notification_Key {
  id: UUIDString;
  __typename?: "Notification_Key";
}

export interface Port_Key {
  id: UUIDString;
  __typename?: "Port_Key";
}

export interface Sailing_Key {
  code: string;
  __typename?: "Sailing_Key";
}

export interface StaffBookingsData {
  totalCount?: number;
  bookings: ({
    id: UUIDString;
    reference: string;
    status: string;
    passengerCount: number;
    total: number;
    serviceFee: number;
    accommodationId?: string | null;
    accommodationName?: string | null;
    accommodationSurcharge?: number;
    paymentStatus: string;
    paymentDeadline?: string | null;
    cancellationReason?: string | null;
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
    bookingPassengers_on_booking: {
      fullName: string;
      passengerType: string;
      fare: number;
      ticketCode: UUIDString;
      ticketStatus: string;
      discountVerifiedAt?: string | null;
      discountVerificationNote?: string | null;
    }[];
  } & Booking_Key)[];
}

export interface TicketingCreateGuestWalkInData {
  query?: {
    sailings: {
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
      pregnantFare?: number;
      passengerDiscounts?: CustomDiscountFare[] | null;
      customDiscounts?: CustomDiscountFare[];
      accommodations?: Accommodation[];
    }[];
  };
  guest: User_Key;
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  bookingPassenger_insert: BookingPassenger_Key;
}

export interface TicketingCreateGuestWalkInVariables {
  accommodationId?: string;
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
  discountVerified?: boolean;
  verificationNote?: string;
}

export interface TicketingCreateWalkInData {
  query?: {
    sailings: {
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
      pregnantFare?: number;
      passengerDiscounts?: CustomDiscountFare[] | null;
      customDiscounts?: CustomDiscountFare[];
      accommodations?: Accommodation[];
    }[];
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
  accommodationId?: string;
  sailingCode: string;
  ownerUid: string;
  reference: string;
  passengerName: string;
  passengerType: string;
  method: string;
  discountVerified?: boolean;
  verificationNote?: string;
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
    pregnantFare?: number;
    passengerDiscounts?: CustomDiscountFare[] | null;
    customDiscounts?: CustomDiscountFare[];
    accommodations?: Accommodation[];
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
  __typename?: "User_Key";
}

export interface Vessel_Key {
  id: UUIDString;
  __typename?: "Vessel_Key";
}
