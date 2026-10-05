/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
// Legacy fetch-policy options are accepted for compatibility; list options reach PostgreSQL.
import {
  executeDatabase,
  type DatabaseClient,
  type QueryOptions,
} from "./client";
import type * as Types from "./staff.types";
export type * from "./staff.types";

export function adminFareSettings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminFareSettingsData }> {
  return executeDatabase<Types.AdminFareSettingsData>(
    client,
    "AdminFareSettings",
    {},
  );
}

export function adminSaveFareSettings(
  client: DatabaseClient,
  variables: Types.AdminSaveFareSettingsVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminSaveFareSettingsData }> {
  return executeDatabase<Types.AdminSaveFareSettingsData>(
    client,
    "AdminSaveFareSettings",
    variables,
  );
}

export function adminExportManifest(
  client: DatabaseClient,
  variables: Types.AdminExportManifestVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminExportManifestData }> {
  return executeDatabase<Types.AdminExportManifestData>(
    client,
    "AdminExportManifest",
    variables,
  );
}

export function staffBookings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.StaffBookingsData }> {
  return executeDatabase<Types.StaffBookingsData>(
    client,
    "StaffBookings",
    _options || {},
  );
}

export function ticketingPassengerAccounts(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.TicketingPassengerAccountsData }> {
  return executeDatabase<Types.TicketingPassengerAccountsData>(
    client,
    "TicketingPassengerAccounts",
    {},
  );
}

export function ticketingSailings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.TicketingSailingsData }> {
  return executeDatabase<Types.TicketingSailingsData>(
    client,
    "TicketingSailings",
    {},
  );
}

export function collectBookingPayment(
  client: DatabaseClient,
  variables: Types.CollectBookingPaymentVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.CollectBookingPaymentData }> {
  return executeDatabase<Types.CollectBookingPaymentData>(
    client,
    "CollectBookingPayment",
    variables,
  );
}

export function ticketingCreateWalkIn(
  client: DatabaseClient,
  variables: Types.TicketingCreateWalkInVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.TicketingCreateWalkInData }> {
  return executeDatabase<Types.TicketingCreateWalkInData>(
    client,
    "TicketingCreateWalkIn",
    variables,
  );
}

export function ticketingCreateGuestWalkIn(
  client: DatabaseClient,
  variables: Types.TicketingCreateGuestWalkInVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.TicketingCreateGuestWalkInData }> {
  return executeDatabase<Types.TicketingCreateGuestWalkInData>(
    client,
    "TicketingCreateGuestWalkIn",
    variables,
  );
}

export function boardingManifest(
  client: DatabaseClient,
  variables: Types.BoardingManifestVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.BoardingManifestData }> {
  return executeDatabase<Types.BoardingManifestData>(
    client,
    "BoardingManifest",
    variables,
  );
}

export function boardingSailings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.BoardingSailingsData }> {
  return executeDatabase<Types.BoardingSailingsData>(
    client,
    "BoardingSailings",
    {},
  );
}

export function boardingActivity(
  client: DatabaseClient,
  variables: Types.BoardingActivityVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.BoardingActivityData }> {
  return executeDatabase<Types.BoardingActivityData>(
    client,
    "BoardingActivity",
    variables,
  );
}

export function checkInTicket(
  client: DatabaseClient,
  variables: Types.CheckInTicketVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.CheckInTicketData }> {
  return executeDatabase<Types.CheckInTicketData>(
    client,
    "CheckInTicket",
    variables,
  );
}

export function boardTicket(
  client: DatabaseClient,
  variables: Types.BoardTicketVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.BoardTicketData }> {
  return executeDatabase<Types.BoardTicketData>(
    client,
    "BoardTicket",
    variables,
  );
}

export function adminSailings(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminSailingsData }> {
  return executeDatabase<Types.AdminSailingsData>(
    client,
    "AdminSailings",
    _options || {},
  );
}

export function adminDashboardStats(
  client: DatabaseClient,
  variables: Types.AdminDashboardStatsVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminDashboardStatsData }> {
  return executeDatabase<Types.AdminDashboardStatsData>(
    client,
    "AdminDashboardStats",
    variables,
  );
}

export function adminUsers(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminUsersData }> {
  return executeDatabase<Types.AdminUsersData>(
    client,
    "AdminUsers",
    _options || {},
  );
}

export function adminPassengerRecords(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminPassengerRecordsData }> {
  return executeDatabase<Types.AdminPassengerRecordsData>(
    client,
    "AdminPassengerRecords",
    _options || {},
  );
}

export function adminPorts(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminPortsData }> {
  return executeDatabase<Types.AdminPortsData>(client, "AdminPorts", {});
}

export function adminVessels(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminVesselsData }> {
  return executeDatabase<Types.AdminVesselsData>(client, "AdminVessels", {});
}

export function adminCreatePort(
  client: DatabaseClient,
  variables: Types.AdminCreatePortVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminCreatePortData }> {
  return executeDatabase<Types.AdminCreatePortData>(
    client,
    "AdminCreatePort",
    variables,
  );
}

export function adminUpdatePort(
  client: DatabaseClient,
  variables: Types.AdminUpdatePortVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminUpdatePortData }> {
  return executeDatabase<Types.AdminUpdatePortData>(
    client,
    "AdminUpdatePort",
    variables,
  );
}

export function adminCreateVessel(
  client: DatabaseClient,
  variables: Types.AdminCreateVesselVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminCreateVesselData }> {
  return executeDatabase<Types.AdminCreateVesselData>(
    client,
    "AdminCreateVessel",
    variables,
  );
}

export function adminUpdateVessel(
  client: DatabaseClient,
  variables: Types.AdminUpdateVesselVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminUpdateVesselData }> {
  return executeDatabase<Types.AdminUpdateVesselData>(
    client,
    "AdminUpdateVessel",
    variables,
  );
}

export function adminCreateSailing(
  client: DatabaseClient,
  variables: Types.AdminCreateSailingVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminCreateSailingData }> {
  return executeDatabase<Types.AdminCreateSailingData>(
    client,
    "AdminCreateSailing",
    variables,
  );
}

export function adminUpdateSailingStatus(
  client: DatabaseClient,
  variables: Types.AdminUpdateSailingStatusVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminUpdateSailingStatusData }> {
  return executeDatabase<Types.AdminUpdateSailingStatusData>(
    client,
    "AdminUpdateSailingStatus",
    variables,
  );
}

export function adminSailingBookings(
  client: DatabaseClient,
  variables: Types.AdminSailingBookingsVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminSailingBookingsData }> {
  return executeDatabase<Types.AdminSailingBookingsData>(
    client,
    "AdminSailingBookings",
    variables,
  );
}

export function adminUpdateUnbookedSailing(
  client: DatabaseClient,
  variables: Types.AdminUpdateUnbookedSailingVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminUpdateUnbookedSailingData }> {
  return executeDatabase<Types.AdminUpdateUnbookedSailingData>(
    client,
    "AdminUpdateUnbookedSailing",
    variables,
  );
}

export function adminRescheduleSailing(
  client: DatabaseClient,
  variables: Types.AdminRescheduleSailingVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminRescheduleSailingData }> {
  return executeDatabase<Types.AdminRescheduleSailingData>(
    client,
    "AdminRescheduleSailing",
    variables,
  );
}

export function adminCancelBooking(
  client: DatabaseClient,
  variables: Types.AdminCancelBookingVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminCancelBookingData }> {
  return executeDatabase<Types.AdminCancelBookingData>(
    client,
    "AdminCancelBooking",
    variables,
  );
}

export function adminReports(
  client: DatabaseClient,
  variables: Types.AdminReportsVariables,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminReportsData }> {
  return executeDatabase<Types.AdminReportsData>(
    client,
    "AdminReports",
    variables,
  );
}

export function adminNextTripCode(
  client: DatabaseClient,
  _options?: QueryOptions,
): Promise<{ data: Types.AdminNextTripCodeData }> {
  return executeDatabase<Types.AdminNextTripCodeData>(
    client,
    "AdminNextTripCode",
    {},
  );
}
