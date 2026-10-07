import type { CustomDiscountFare } from "../../data/fareSettings";
import type { Accommodation } from "./workspaces";
// Application data contracts retained during the PostgreSQL migration.
export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export interface BoardingEvent_Key {
  id: UUIDString;
  __typename?: "BoardingEvent_Key";
}

export interface BookingPassenger_Key {
  id: UUIDString;
  __typename?: "BookingPassenger_Key";
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: "Booking_Key";
}

export interface BrowseActivePortsData {
  ports: ({
    id: UUIDString;
    code: string;
    name: string;
    city: string;
  } & Port_Key)[];
}

export interface BrowseSailingsData {
  sailings: ({
    code: string;
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
    availableSeats: number;
    status: string;
    origin: {
      id: UUIDString;
      code: string;
      name: string;
      city: string;
    } & Port_Key;
    destination: {
      id: UUIDString;
      code: string;
      name: string;
      city: string;
    } & Port_Key;
    vessel: {
      id: UUIDString;
      code: string;
      name: string;
      passengerCapacity: number;
    } & Vessel_Key;
  } & Sailing_Key)[];
}

export interface CancelMyBookingData {
  query?: {
    bookings: {
      status: string;
      paymentStatus: string;
      paymentDeadline?: string | null;
      cancellationReason?: string | null;
      sailingCode: string;
      passengerCount: number;
    }[];
    sailings: {
      availableSeats: number;
    }[];
  };
  booking_update?: Booking_Key | null;
  sailing_update?: Sailing_Key | null;
  notification_insert: Notification_Key;
}

export interface CancelMyBookingVariables {
  id: UUIDString;
  sailingCode: string;
  passengerCount: number;
}

export interface CreateMyProfileData {
  user_insert: User_Key;
}

export interface CreateMyProfileVariables {
  email: string;
  fullName: string;
  phone?: string | null;
}

export interface FareSettings_Key {
  code: string;
  __typename?: "FareSettings_Key";
}

export interface MarkNotificationReadData {
  notification_update?: Notification_Key | null;
}

export interface MarkNotificationReadVariables {
  id: UUIDString;
}

export interface MyBookingsData {
  bookings: ({
    id: UUIDString;
    reference: string;
    status: string;
    passengerCount: number;
    passengerFareTotal: number;
    serviceFee: number;
    accommodationId?: string | null;
    accommodationName?: string | null;
    accommodationSurcharge?: number;
    paymentStatus: string;
    paymentDeadline?: string | null;
    cancellationReason?: string | null;
    paymentMethod?: string | null;
    paymentProviderMethod?: string | null;
    paymentVerificationRequired?: boolean | null;
    paymentVerifiedAt?: string | null;
    paidAt?: TimestampString | null;
    bookingChannel: string;
    total: number;
    voucherCode?: string | null;
    voucherDiscount?: number;
    currency: string;
    createdAt: TimestampString;
    sailing: {
      code: string;
      departureAt: TimestampString;
      arrivalAt: TimestampString;
      origin: {
        name: string;
        city: string;
      };
      destination: {
        name: string;
        city: string;
      };
      vessel: {
        name: string;
      };
    } & Sailing_Key;
    bookingPassengers_on_booking: ({
      id: UUIDString;
      fullName: string;
      passengerType: string;
      fare: number;
      ticketCode: UUIDString;
      ticketStatus: string;
      discountVerifiedAt?: string | null;
      discountVerificationNote?: string | null;
      issuedAt: TimestampString;
      checkedInAt?: TimestampString | null;
      boardedAt?: TimestampString | null;
    } & BookingPassenger_Key)[];
  } & Booking_Key)[];
}

export interface MyNotificationsData {
  notifications: ({
    id: UUIDString;
    title: string;
    message: string;
    category: string;
    readAt?: TimestampString | null;
    createdAt: TimestampString;
  } & Notification_Key)[];
}

export interface MyProfileData {
  user?: {
    uid: string;
    email: string;
    fullName: string;
    phone?: string | null;
    role: string;
  } & User_Key;
}

export interface MyTicketsData {
  bookingPassengers: ({
    id: UUIDString;
    ticketCode: UUIDString;
    ticketStatus: string;
    discountVerifiedAt?: string | null;
    discountVerificationNote?: string | null;
    issuedAt: TimestampString;
    checkedInAt?: TimestampString | null;
    boardedAt?: TimestampString | null;
    fullName: string;
    passengerType: string;
    booking: {
      reference: string;
      sailing: {
        code: string;
        departureAt: TimestampString;
        arrivalAt: TimestampString;
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

export interface Notification_Key {
  id: UUIDString;
  __typename?: "Notification_Key";
}

export interface Port_Key {
  id: UUIDString;
  __typename?: "Port_Key";
}

export interface ReserveSailing1Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
}

export interface ReserveSailing1Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
}

export interface ReserveSailing2Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
}

export interface ReserveSailing2Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
}

export interface ReserveSailing3Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
}

export interface ReserveSailing3Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
  passenger3Name: string;
  passenger3Type: string;
  passenger3BirthDate?: DateString | null;
  passenger3Sex?: string | null;
  passenger3Phone?: string | null;
  passenger3Nationality?: string | null;
}

export interface ReserveSailing4Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
  passenger4: BookingPassenger_Key;
}

export interface ReserveSailing4Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
  passenger3Name: string;
  passenger3Type: string;
  passenger3BirthDate?: DateString | null;
  passenger3Sex?: string | null;
  passenger3Phone?: string | null;
  passenger3Nationality?: string | null;
  passenger4Name: string;
  passenger4Type: string;
  passenger4BirthDate?: DateString | null;
  passenger4Sex?: string | null;
  passenger4Phone?: string | null;
  passenger4Nationality?: string | null;
}

export interface ReserveSailing5Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
  passenger4: BookingPassenger_Key;
  passenger5: BookingPassenger_Key;
}

export interface ReserveSailing5Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
  passenger3Name: string;
  passenger3Type: string;
  passenger3BirthDate?: DateString | null;
  passenger3Sex?: string | null;
  passenger3Phone?: string | null;
  passenger3Nationality?: string | null;
  passenger4Name: string;
  passenger4Type: string;
  passenger4BirthDate?: DateString | null;
  passenger4Sex?: string | null;
  passenger4Phone?: string | null;
  passenger4Nationality?: string | null;
  passenger5Name: string;
  passenger5Type: string;
  passenger5BirthDate?: DateString | null;
  passenger5Sex?: string | null;
  passenger5Phone?: string | null;
  passenger5Nationality?: string | null;
}

export interface ReserveSailing6Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
  passenger4: BookingPassenger_Key;
  passenger5: BookingPassenger_Key;
  passenger6: BookingPassenger_Key;
}

export interface ReserveSailing6Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
  passenger3Name: string;
  passenger3Type: string;
  passenger3BirthDate?: DateString | null;
  passenger3Sex?: string | null;
  passenger3Phone?: string | null;
  passenger3Nationality?: string | null;
  passenger4Name: string;
  passenger4Type: string;
  passenger4BirthDate?: DateString | null;
  passenger4Sex?: string | null;
  passenger4Phone?: string | null;
  passenger4Nationality?: string | null;
  passenger5Name: string;
  passenger5Type: string;
  passenger5BirthDate?: DateString | null;
  passenger5Sex?: string | null;
  passenger5Phone?: string | null;
  passenger5Nationality?: string | null;
  passenger6Name: string;
  passenger6Type: string;
  passenger6BirthDate?: DateString | null;
  passenger6Sex?: string | null;
  passenger6Phone?: string | null;
  passenger6Nationality?: string | null;
}

export interface ReserveSailing7Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
  passenger4: BookingPassenger_Key;
  passenger5: BookingPassenger_Key;
  passenger6: BookingPassenger_Key;
  passenger7: BookingPassenger_Key;
}

export interface ReserveSailing7Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
  passenger3Name: string;
  passenger3Type: string;
  passenger3BirthDate?: DateString | null;
  passenger3Sex?: string | null;
  passenger3Phone?: string | null;
  passenger3Nationality?: string | null;
  passenger4Name: string;
  passenger4Type: string;
  passenger4BirthDate?: DateString | null;
  passenger4Sex?: string | null;
  passenger4Phone?: string | null;
  passenger4Nationality?: string | null;
  passenger5Name: string;
  passenger5Type: string;
  passenger5BirthDate?: DateString | null;
  passenger5Sex?: string | null;
  passenger5Phone?: string | null;
  passenger5Nationality?: string | null;
  passenger6Name: string;
  passenger6Type: string;
  passenger6BirthDate?: DateString | null;
  passenger6Sex?: string | null;
  passenger6Phone?: string | null;
  passenger6Nationality?: string | null;
  passenger7Name: string;
  passenger7Type: string;
  passenger7BirthDate?: DateString | null;
  passenger7Sex?: string | null;
  passenger7Phone?: string | null;
  passenger7Nationality?: string | null;
}

export interface ReserveSailing8Data {
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
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
  passenger4: BookingPassenger_Key;
  passenger5: BookingPassenger_Key;
  passenger6: BookingPassenger_Key;
  passenger7: BookingPassenger_Key;
  passenger8: BookingPassenger_Key;
}

export interface ReserveSailing8Variables {
  accommodationId?: string;
  sailingCode: string;
  reference: string;
  passenger1Name: string;
  passenger1Type: string;
  passenger1BirthDate?: DateString | null;
  passenger1Sex?: string | null;
  passenger1Phone?: string | null;
  passenger1Nationality?: string | null;
  passenger2Name: string;
  passenger2Type: string;
  passenger2BirthDate?: DateString | null;
  passenger2Sex?: string | null;
  passenger2Phone?: string | null;
  passenger2Nationality?: string | null;
  passenger3Name: string;
  passenger3Type: string;
  passenger3BirthDate?: DateString | null;
  passenger3Sex?: string | null;
  passenger3Phone?: string | null;
  passenger3Nationality?: string | null;
  passenger4Name: string;
  passenger4Type: string;
  passenger4BirthDate?: DateString | null;
  passenger4Sex?: string | null;
  passenger4Phone?: string | null;
  passenger4Nationality?: string | null;
  passenger5Name: string;
  passenger5Type: string;
  passenger5BirthDate?: DateString | null;
  passenger5Sex?: string | null;
  passenger5Phone?: string | null;
  passenger5Nationality?: string | null;
  passenger6Name: string;
  passenger6Type: string;
  passenger6BirthDate?: DateString | null;
  passenger6Sex?: string | null;
  passenger6Phone?: string | null;
  passenger6Nationality?: string | null;
  passenger7Name: string;
  passenger7Type: string;
  passenger7BirthDate?: DateString | null;
  passenger7Sex?: string | null;
  passenger7Phone?: string | null;
  passenger7Nationality?: string | null;
  passenger8Name: string;
  passenger8Type: string;
  passenger8BirthDate?: DateString | null;
  passenger8Sex?: string | null;
  passenger8Phone?: string | null;
  passenger8Nationality?: string | null;
}

export interface Sailing_Key {
  code: string;
  __typename?: "Sailing_Key";
}

export interface UpdateMyProfileData {
  user_update?: User_Key | null;
}

export interface UpdateMyProfileVariables {
  fullName: string;
  phone?: string | null;
}

export interface User_Key {
  uid: string;
  __typename?: "User_Key";
}

export interface Vessel_Key {
  id: UUIDString;
  __typename?: "Vessel_Key";
}
