import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface BoardingEvent_Key {
  id: UUIDString;
  __typename?: 'BoardingEvent_Key';
}

export interface BookingPassenger_Key {
  id: UUIDString;
  __typename?: 'BookingPassenger_Key';
}

export interface Booking_Key {
  id: UUIDString;
  __typename?: 'Booking_Key';
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
    bookings: ({
      status: string;
      paymentStatus: string;
      sailingCode: string;
      passengerCount: number;
    })[];
    sailings: ({
      availableSeats: number;
    })[];
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
  __typename?: 'FareSettings_Key';
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
    paymentStatus: string;
    paymentMethod?: string | null;
    paidAt?: TimestampString | null;
    bookingChannel: string;
    total: number;
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
  __typename?: 'Notification_Key';
}

export interface Port_Key {
  id: UUIDString;
  __typename?: 'Port_Key';
}

export interface ReserveSailing1Data {
  query?: {
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
  };
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
}

export interface ReserveSailing1Variables {
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
  };
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
}

export interface ReserveSailing2Variables {
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
  };
  sailing_update?: Sailing_Key | null;
  booking_insert: Booking_Key;
  notification_insert: Notification_Key;
  passenger1: BookingPassenger_Key;
  passenger2: BookingPassenger_Key;
  passenger3: BookingPassenger_Key;
}

export interface ReserveSailing3Variables {
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
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
    sailings: ({
      regularFare: number;
      studentFare: number;
      seniorFare: number;
      childFare: number;
      pwdFare: number;
    })[];
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
  __typename?: 'Sailing_Key';
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
  __typename?: 'User_Key';
}

export interface Vessel_Key {
  id: UUIDString;
  __typename?: 'Vessel_Key';
}

interface BrowseActivePortsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<BrowseActivePortsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<BrowseActivePortsData, undefined>;
  operationName: string;
}
export const browseActivePortsRef: BrowseActivePortsRef;

export function browseActivePorts(options?: ExecuteQueryOptions): QueryPromise<BrowseActivePortsData, undefined>;
export function browseActivePorts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<BrowseActivePortsData, undefined>;

interface BrowseSailingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<BrowseSailingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<BrowseSailingsData, undefined>;
  operationName: string;
}
export const browseSailingsRef: BrowseSailingsRef;

export function browseSailings(options?: ExecuteQueryOptions): QueryPromise<BrowseSailingsData, undefined>;
export function browseSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<BrowseSailingsData, undefined>;

interface MyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyProfileData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyProfileData, undefined>;
  operationName: string;
}
export const myProfileRef: MyProfileRef;

export function myProfile(options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;
export function myProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;

interface CreateMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMyProfileVariables): MutationRef<CreateMyProfileData, CreateMyProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateMyProfileVariables): MutationRef<CreateMyProfileData, CreateMyProfileVariables>;
  operationName: string;
}
export const createMyProfileRef: CreateMyProfileRef;

export function createMyProfile(vars: CreateMyProfileVariables): MutationPromise<CreateMyProfileData, CreateMyProfileVariables>;
export function createMyProfile(dc: DataConnect, vars: CreateMyProfileVariables): MutationPromise<CreateMyProfileData, CreateMyProfileVariables>;

interface UpdateMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyProfileVariables): MutationRef<UpdateMyProfileData, UpdateMyProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMyProfileVariables): MutationRef<UpdateMyProfileData, UpdateMyProfileVariables>;
  operationName: string;
}
export const updateMyProfileRef: UpdateMyProfileRef;

export function updateMyProfile(vars: UpdateMyProfileVariables): MutationPromise<UpdateMyProfileData, UpdateMyProfileVariables>;
export function updateMyProfile(dc: DataConnect, vars: UpdateMyProfileVariables): MutationPromise<UpdateMyProfileData, UpdateMyProfileVariables>;

interface MyBookingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyBookingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyBookingsData, undefined>;
  operationName: string;
}
export const myBookingsRef: MyBookingsRef;

export function myBookings(options?: ExecuteQueryOptions): QueryPromise<MyBookingsData, undefined>;
export function myBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyBookingsData, undefined>;

interface ReserveSailing1Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing1Variables): MutationRef<ReserveSailing1Data, ReserveSailing1Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing1Variables): MutationRef<ReserveSailing1Data, ReserveSailing1Variables>;
  operationName: string;
}
export const reserveSailing1Ref: ReserveSailing1Ref;

export function reserveSailing1(vars: ReserveSailing1Variables): MutationPromise<ReserveSailing1Data, ReserveSailing1Variables>;
export function reserveSailing1(dc: DataConnect, vars: ReserveSailing1Variables): MutationPromise<ReserveSailing1Data, ReserveSailing1Variables>;

interface ReserveSailing2Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing2Variables): MutationRef<ReserveSailing2Data, ReserveSailing2Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing2Variables): MutationRef<ReserveSailing2Data, ReserveSailing2Variables>;
  operationName: string;
}
export const reserveSailing2Ref: ReserveSailing2Ref;

export function reserveSailing2(vars: ReserveSailing2Variables): MutationPromise<ReserveSailing2Data, ReserveSailing2Variables>;
export function reserveSailing2(dc: DataConnect, vars: ReserveSailing2Variables): MutationPromise<ReserveSailing2Data, ReserveSailing2Variables>;

interface ReserveSailing3Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing3Variables): MutationRef<ReserveSailing3Data, ReserveSailing3Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing3Variables): MutationRef<ReserveSailing3Data, ReserveSailing3Variables>;
  operationName: string;
}
export const reserveSailing3Ref: ReserveSailing3Ref;

export function reserveSailing3(vars: ReserveSailing3Variables): MutationPromise<ReserveSailing3Data, ReserveSailing3Variables>;
export function reserveSailing3(dc: DataConnect, vars: ReserveSailing3Variables): MutationPromise<ReserveSailing3Data, ReserveSailing3Variables>;

interface ReserveSailing4Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing4Variables): MutationRef<ReserveSailing4Data, ReserveSailing4Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing4Variables): MutationRef<ReserveSailing4Data, ReserveSailing4Variables>;
  operationName: string;
}
export const reserveSailing4Ref: ReserveSailing4Ref;

export function reserveSailing4(vars: ReserveSailing4Variables): MutationPromise<ReserveSailing4Data, ReserveSailing4Variables>;
export function reserveSailing4(dc: DataConnect, vars: ReserveSailing4Variables): MutationPromise<ReserveSailing4Data, ReserveSailing4Variables>;

interface ReserveSailing5Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing5Variables): MutationRef<ReserveSailing5Data, ReserveSailing5Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing5Variables): MutationRef<ReserveSailing5Data, ReserveSailing5Variables>;
  operationName: string;
}
export const reserveSailing5Ref: ReserveSailing5Ref;

export function reserveSailing5(vars: ReserveSailing5Variables): MutationPromise<ReserveSailing5Data, ReserveSailing5Variables>;
export function reserveSailing5(dc: DataConnect, vars: ReserveSailing5Variables): MutationPromise<ReserveSailing5Data, ReserveSailing5Variables>;

interface ReserveSailing6Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing6Variables): MutationRef<ReserveSailing6Data, ReserveSailing6Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing6Variables): MutationRef<ReserveSailing6Data, ReserveSailing6Variables>;
  operationName: string;
}
export const reserveSailing6Ref: ReserveSailing6Ref;

export function reserveSailing6(vars: ReserveSailing6Variables): MutationPromise<ReserveSailing6Data, ReserveSailing6Variables>;
export function reserveSailing6(dc: DataConnect, vars: ReserveSailing6Variables): MutationPromise<ReserveSailing6Data, ReserveSailing6Variables>;

interface ReserveSailing7Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing7Variables): MutationRef<ReserveSailing7Data, ReserveSailing7Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing7Variables): MutationRef<ReserveSailing7Data, ReserveSailing7Variables>;
  operationName: string;
}
export const reserveSailing7Ref: ReserveSailing7Ref;

export function reserveSailing7(vars: ReserveSailing7Variables): MutationPromise<ReserveSailing7Data, ReserveSailing7Variables>;
export function reserveSailing7(dc: DataConnect, vars: ReserveSailing7Variables): MutationPromise<ReserveSailing7Data, ReserveSailing7Variables>;

interface ReserveSailing8Ref {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing8Variables): MutationRef<ReserveSailing8Data, ReserveSailing8Variables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveSailing8Variables): MutationRef<ReserveSailing8Data, ReserveSailing8Variables>;
  operationName: string;
}
export const reserveSailing8Ref: ReserveSailing8Ref;

export function reserveSailing8(vars: ReserveSailing8Variables): MutationPromise<ReserveSailing8Data, ReserveSailing8Variables>;
export function reserveSailing8(dc: DataConnect, vars: ReserveSailing8Variables): MutationPromise<ReserveSailing8Data, ReserveSailing8Variables>;

interface CancelMyBookingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CancelMyBookingVariables): MutationRef<CancelMyBookingData, CancelMyBookingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CancelMyBookingVariables): MutationRef<CancelMyBookingData, CancelMyBookingVariables>;
  operationName: string;
}
export const cancelMyBookingRef: CancelMyBookingRef;

export function cancelMyBooking(vars: CancelMyBookingVariables): MutationPromise<CancelMyBookingData, CancelMyBookingVariables>;
export function cancelMyBooking(dc: DataConnect, vars: CancelMyBookingVariables): MutationPromise<CancelMyBookingData, CancelMyBookingVariables>;

interface MyNotificationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyNotificationsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyNotificationsData, undefined>;
  operationName: string;
}
export const myNotificationsRef: MyNotificationsRef;

export function myNotifications(options?: ExecuteQueryOptions): QueryPromise<MyNotificationsData, undefined>;
export function myNotifications(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyNotificationsData, undefined>;

interface MyTicketsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyTicketsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyTicketsData, undefined>;
  operationName: string;
}
export const myTicketsRef: MyTicketsRef;

export function myTickets(options?: ExecuteQueryOptions): QueryPromise<MyTicketsData, undefined>;
export function myTickets(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyTicketsData, undefined>;

interface MarkNotificationReadRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationReadVariables): MutationRef<MarkNotificationReadData, MarkNotificationReadVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkNotificationReadVariables): MutationRef<MarkNotificationReadData, MarkNotificationReadVariables>;
  operationName: string;
}
export const markNotificationReadRef: MarkNotificationReadRef;

export function markNotificationRead(vars: MarkNotificationReadVariables): MutationPromise<MarkNotificationReadData, MarkNotificationReadVariables>;
export function markNotificationRead(dc: DataConnect, vars: MarkNotificationReadVariables): MutationPromise<MarkNotificationReadData, MarkNotificationReadVariables>;

