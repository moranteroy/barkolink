import {
  executeDatabase,
  type DatabaseClient,
  type QueryOptions,
} from "./client";
import type * as Types from "./passenger.types";
export type * from "./passenger.types";

export function browseActivePorts(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.BrowseActivePortsData }> {
  return executeDatabase<Types.BrowseActivePortsData>(
    client,
    "BrowseActivePorts",
    {},
  );
}

export function browseSailings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.BrowseSailingsData }> {
  return executeDatabase<Types.BrowseSailingsData>(
    client,
    "BrowseSailings",
    {},
  );
}

export function myProfile(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.MyProfileData }> {
  return executeDatabase<Types.MyProfileData>(client, "MyProfile", {});
}

export function createMyProfile(
  client: DatabaseClient,
  variables: Types.CreateMyProfileVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.CreateMyProfileData }> {
  return executeDatabase<Types.CreateMyProfileData>(
    client,
    "CreateMyProfile",
    variables,
  );
}

export function updateMyProfile(
  client: DatabaseClient,
  variables: Types.UpdateMyProfileVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.UpdateMyProfileData }> {
  return executeDatabase<Types.UpdateMyProfileData>(
    client,
    "UpdateMyProfile",
    variables,
  );
}

export function myBookings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.MyBookingsData }> {
  return executeDatabase<Types.MyBookingsData>(client, "MyBookings", {});
}

export function reserveSailing1(
  client: DatabaseClient,
  variables: Types.ReserveSailing1Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing1Data }> {
  return executeDatabase<Types.ReserveSailing1Data>(
    client,
    "ReserveSailing1",
    variables,
  );
}

export function reserveSailing2(
  client: DatabaseClient,
  variables: Types.ReserveSailing2Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing2Data }> {
  return executeDatabase<Types.ReserveSailing2Data>(
    client,
    "ReserveSailing2",
    variables,
  );
}

export function reserveSailing3(
  client: DatabaseClient,
  variables: Types.ReserveSailing3Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing3Data }> {
  return executeDatabase<Types.ReserveSailing3Data>(
    client,
    "ReserveSailing3",
    variables,
  );
}

export function reserveSailing4(
  client: DatabaseClient,
  variables: Types.ReserveSailing4Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing4Data }> {
  return executeDatabase<Types.ReserveSailing4Data>(
    client,
    "ReserveSailing4",
    variables,
  );
}

export function reserveSailing5(
  client: DatabaseClient,
  variables: Types.ReserveSailing5Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing5Data }> {
  return executeDatabase<Types.ReserveSailing5Data>(
    client,
    "ReserveSailing5",
    variables,
  );
}

export function reserveSailing6(
  client: DatabaseClient,
  variables: Types.ReserveSailing6Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing6Data }> {
  return executeDatabase<Types.ReserveSailing6Data>(
    client,
    "ReserveSailing6",
    variables,
  );
}

export function reserveSailing7(
  client: DatabaseClient,
  variables: Types.ReserveSailing7Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing7Data }> {
  return executeDatabase<Types.ReserveSailing7Data>(
    client,
    "ReserveSailing7",
    variables,
  );
}

export function reserveSailing8(
  client: DatabaseClient,
  variables: Types.ReserveSailing8Variables,
  _options?: QueryOptions,
): Promise<{ data: Types.ReserveSailing8Data }> {
  return executeDatabase<Types.ReserveSailing8Data>(
    client,
    "ReserveSailing8",
    variables,
  );
}

export function cancelMyBooking(
  client: DatabaseClient,
  variables: Types.CancelMyBookingVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.CancelMyBookingData }> {
  return executeDatabase<Types.CancelMyBookingData>(
    client,
    "CancelMyBooking",
    variables,
  );
}

export function myNotifications(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.MyNotificationsData }> {
  return executeDatabase<Types.MyNotificationsData>(
    client,
    "MyNotifications",
    {},
  );
}

export function myTickets(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.MyTicketsData }> {
  return executeDatabase<Types.MyTicketsData>(client, "MyTickets", {});
}

export function markNotificationRead(
  client: DatabaseClient,
  variables: Types.MarkNotificationReadVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.MarkNotificationReadData }> {
  return executeDatabase<Types.MarkNotificationReadData>(
    client,
    "MarkNotificationRead",
    variables,
  );
}
