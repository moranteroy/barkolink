import type {
  CustomDiscount,
  CustomDiscountFare,
} from "../../data/fareSettings";
import { executeDatabase, type DatabaseClient } from "./client";
export type Accommodation = {
  id: string;
  vesselId: string;
  vesselName?: string;
  name: string;
  description: string;
  capacity: number;
  surcharge: number;
  isActive: boolean;
  availableSeats?: number;
};
export type WorkspaceTrip = {
  passengerDiscounts?: CustomDiscountFare[] | null;
  customDiscounts?: CustomDiscountFare[];
  code: string;
  departureAt: string;
  status: string;
  availableSeats: number;
  origin: { name: string };
  destination: { name: string };
  vessel: { name: string; passengerCapacity: number };
  regularFare: number;
  studentFare: number;
  seniorFare: number;
  pwdFare: number;
  childFare: number;
  accommodations?: Accommodation[];
};
export type WorkspacePassenger = {
  id: string;
  fullName: string;
  passengerType: string;
  ticketStatus: string;
  ticketCode: string;
  noShow?: boolean;
  booking: {
    reference: string;
    status: string;
    paymentStatus: string;
    accommodationName?: string;
    sailing: WorkspaceTrip;
  };
};
export type Overview = {
  stats: Record<string, number>;
  trips: WorkspaceTrip[];
  monthly: Array<{ month: string; bookings: number; passengers: number }>;
  bookingStatus: Array<{ name: string; value: number }>;
  categories: Array<{ name: string; value: number }>;
  routes: Array<{ route: string; passengers: number }>;
};
export type FerryRoute = {
  id: string;
  code: string;
  originPortId: string;
  destinationPortId: string;
  durationMinutes: number;
  isActive: boolean;
  origin: { name: string };
  destination: { name: string };
};
export type Campaign = {
  id: string;
  title: string;
  message: string;
  audience: string;
  sailingCode: string | null;
  recipientCount: number;
  createdAt: string;
};
export type VesselFares = {
  vesselName: string;
  regularFare: number;
  studentDiscount: number;
  seniorDiscount: number;
  childDiscount: number;
  pwdDiscount: number;
  pregnantDiscount: number;
  passengerDiscounts?: CustomDiscount[] | null;
  customDiscounts?: CustomDiscount[];
  accommodations: Accommodation[];
};
export const overview = (dc: DatabaseClient) =>
  executeDatabase<Overview>(dc, "AdminOverview", {});
export const accommodations = (dc: DatabaseClient) =>
  executeDatabase<{ accommodations: Accommodation[] }>(
    dc,
    "AdminAccommodations",
    {},
  );
export const saveAccommodation = (
  dc: DatabaseClient,
  args: Omit<Accommodation, "id" | "vesselName" | "availableSeats"> & {
    id?: string;
  },
) => executeDatabase(dc, "AdminSaveAccommodation", args);
export const routes = (dc: DatabaseClient) =>
  executeDatabase<{ routes: FerryRoute[] }>(dc, "AdminRoutes", {});
export const saveRoute = (
  dc: DatabaseClient,
  args: Omit<FerryRoute, "id" | "origin" | "destination"> & { id?: string },
) => executeDatabase(dc, "AdminSaveRoute", args);
export const staffTrips = (
  dc: DatabaseClient,
  args: { page?: number; search?: string; status?: string } = {},
) =>
  executeDatabase<{ sailings: WorkspaceTrip[]; totalCount: number }>(
    dc,
    "StaffSailings",
    args,
  );
export const staffPassengers = (
  dc: DatabaseClient,
  args: { page?: number; search?: string; sailingCode?: string } = {},
) =>
  executeDatabase<{ passengers: WorkspacePassenger[]; totalCount: number }>(
    dc,
    "StaffPassengers",
    args,
  );
export const staffFares = (dc: DatabaseClient) =>
  executeDatabase<{ fares: VesselFares[] }>(dc, "StaffFares", {});
export const staffDashboard = (dc: DatabaseClient) =>
  executeDatabase<{
    bookings: number;
    paid: number;
    unpaid: number;
    awaitingVerification?: number;
    trips: number;
  }>(dc, "StaffDashboard", {});
export const noShows = (dc: DatabaseClient, sailingCode: string) =>
  executeDatabase<{
    passengers: WorkspacePassenger[];
    sailing: WorkspaceTrip | null;
  }>(dc, "StaffNoShows", { sailingCode });
export const markNoShow = (
  dc: DatabaseClient,
  sailingCode: string,
  passengerId?: string,
) =>
  executeDatabase<{ marked: number }>(dc, "StaffMarkNoShow", {
    sailingCode,
    passengerId,
  });
export const campaigns = (dc: DatabaseClient, page = 0) =>
  executeDatabase<{ campaigns: Campaign[]; totalCount: number }>(
    dc,
    "AdminNotificationCampaigns",
    { page },
  );
export type NotificationDraft = {
  title: string;
  message: string;
  audience: string;
  sailingCode?: string;
};
export const notificationRecipients = (
  dc: DatabaseClient,
  args: NotificationDraft,
) =>
  executeDatabase<{ recipients: number }>(
    dc,
    "AdminNotificationRecipients",
    args,
  );
export const sendNotification = (
  dc: DatabaseClient,
  args: NotificationDraft & { requestId: string },
) => executeDatabase<{ sent: number }>(dc, "AdminSendNotification", args);
