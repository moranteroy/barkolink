import { executeDatabase, type DatabaseClient } from "./client";

export type Advisory = {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  sailingCode: string | null;
  startsAt: string;
  endsAt: string;
  published: boolean;
};
export type SavedTraveler = {
  id: string;
  fullName: string;
  birthDate: string;
  sex: string;
  phone: string;
  nationality: string;
};
export type TripPassenger = {
  id: string;
  fullName: string;
  passengerType: string;
  ticketStatus: string;
  checkedInAt: string | null;
  boardedAt: string | null;
  noShow: boolean;
  booking: { reference: string; status: string; paymentStatus: string };
};
export type TripOperations = {
  sailing: {
    code: string;
    departureAt: string;
    arrivalAt: string;
    status: string;
    availableSeats: number;
    origin: { name: string };
    destination: { name: string };
    vessel: { name: string; passengerCapacity: number };
  };
  bookings: Array<{
    id: string;
    reference: string;
    passengerCount: number;
    status: string;
    paymentStatus: string;
    total: number;
  }>;
  passengers: TripPassenger[];
  activity: Array<{ id: string; action: string; createdAt: string }>;
};
export const activeAdvisories = (
  client: DatabaseClient,
  sailingCode?: string,
) =>
  executeDatabase<{ advisories: Advisory[] }>(client, "ActiveAdvisories", {
    sailingCode,
  });
export const adminAdvisories = (client: DatabaseClient) =>
  executeDatabase<{ advisories: Advisory[] }>(client, "AdminAdvisories", {});
export const saveAdvisory = (
  client: DatabaseClient,
  advisory: Omit<Advisory, "id"> & { id?: string },
) => executeDatabase(client, "AdminSaveAdvisory", advisory);
export const markAllNotificationsRead = (client: DatabaseClient) =>
  executeDatabase(client, "MyMarkAllNotificationsRead", {});
export const savedTravelers = (client: DatabaseClient) =>
  executeDatabase<{ travelers: SavedTraveler[] }>(
    client,
    "MySavedTravelers",
    {},
  );
export const saveTraveler = (
  client: DatabaseClient,
  traveler: Omit<SavedTraveler, "id"> & { id?: string },
) => executeDatabase(client, "MySaveTraveler", traveler);
export const deleteTraveler = (client: DatabaseClient, id: string) =>
  executeDatabase(client, "MyDeleteTraveler", { id });
export const tripOperations = (client: DatabaseClient, code: string) =>
  executeDatabase<TripOperations>(client, "AdminTripOperations", { code });
export const reconcileNoShows = (client: DatabaseClient, code: string) =>
  executeDatabase<{ marked: number }>(client, "AdminReconcileNoShows", {
    code,
  });
