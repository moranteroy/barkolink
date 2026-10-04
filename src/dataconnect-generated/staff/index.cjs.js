const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'staff',
  service: 'barkolink-87e5e-service',
  location: 'asia-southeast1'
};
exports.connectorConfig = connectorConfig;

const adminFareSettingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminFareSettings');
}
adminFareSettingsRef.operationName = 'AdminFareSettings';
exports.adminFareSettingsRef = adminFareSettingsRef;

exports.adminFareSettings = function adminFareSettings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminFareSettingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminSaveFareSettingsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminSaveFareSettings', inputVars);
}
adminSaveFareSettingsRef.operationName = 'AdminSaveFareSettings';
exports.adminSaveFareSettingsRef = adminSaveFareSettingsRef;

exports.adminSaveFareSettings = function adminSaveFareSettings(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminSaveFareSettingsRef(dcInstance, inputVars));
}
;

const adminExportManifestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminExportManifest', inputVars);
}
adminExportManifestRef.operationName = 'AdminExportManifest';
exports.adminExportManifestRef = adminExportManifestRef;

exports.adminExportManifest = function adminExportManifest(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(adminExportManifestRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const staffBookingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'StaffBookings');
}
staffBookingsRef.operationName = 'StaffBookings';
exports.staffBookingsRef = staffBookingsRef;

exports.staffBookings = function staffBookings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(staffBookingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const ticketingPassengerAccountsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'TicketingPassengerAccounts');
}
ticketingPassengerAccountsRef.operationName = 'TicketingPassengerAccounts';
exports.ticketingPassengerAccountsRef = ticketingPassengerAccountsRef;

exports.ticketingPassengerAccounts = function ticketingPassengerAccounts(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(ticketingPassengerAccountsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const ticketingSailingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'TicketingSailings');
}
ticketingSailingsRef.operationName = 'TicketingSailings';
exports.ticketingSailingsRef = ticketingSailingsRef;

exports.ticketingSailings = function ticketingSailings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(ticketingSailingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const collectBookingPaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CollectBookingPayment', inputVars);
}
collectBookingPaymentRef.operationName = 'CollectBookingPayment';
exports.collectBookingPaymentRef = collectBookingPaymentRef;

exports.collectBookingPayment = function collectBookingPayment(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(collectBookingPaymentRef(dcInstance, inputVars));
}
;

const ticketingCreateWalkInRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'TicketingCreateWalkIn', inputVars);
}
ticketingCreateWalkInRef.operationName = 'TicketingCreateWalkIn';
exports.ticketingCreateWalkInRef = ticketingCreateWalkInRef;

exports.ticketingCreateWalkIn = function ticketingCreateWalkIn(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(ticketingCreateWalkInRef(dcInstance, inputVars));
}
;

const ticketingCreateGuestWalkInRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'TicketingCreateGuestWalkIn', inputVars);
}
ticketingCreateGuestWalkInRef.operationName = 'TicketingCreateGuestWalkIn';
exports.ticketingCreateGuestWalkInRef = ticketingCreateGuestWalkInRef;

exports.ticketingCreateGuestWalkIn = function ticketingCreateGuestWalkIn(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(ticketingCreateGuestWalkInRef(dcInstance, inputVars));
}
;

const boardingManifestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'BoardingManifest', inputVars);
}
boardingManifestRef.operationName = 'BoardingManifest';
exports.boardingManifestRef = boardingManifestRef;

exports.boardingManifest = function boardingManifest(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(boardingManifestRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const boardingSailingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'BoardingSailings');
}
boardingSailingsRef.operationName = 'BoardingSailings';
exports.boardingSailingsRef = boardingSailingsRef;

exports.boardingSailings = function boardingSailings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(boardingSailingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const boardingActivityRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'BoardingActivity', inputVars);
}
boardingActivityRef.operationName = 'BoardingActivity';
exports.boardingActivityRef = boardingActivityRef;

exports.boardingActivity = function boardingActivity(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(boardingActivityRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const checkInTicketRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CheckInTicket', inputVars);
}
checkInTicketRef.operationName = 'CheckInTicket';
exports.checkInTicketRef = checkInTicketRef;

exports.checkInTicket = function checkInTicket(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(checkInTicketRef(dcInstance, inputVars));
}
;

const boardTicketRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'BoardTicket', inputVars);
}
boardTicketRef.operationName = 'BoardTicket';
exports.boardTicketRef = boardTicketRef;

exports.boardTicket = function boardTicket(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(boardTicketRef(dcInstance, inputVars));
}
;

const adminSailingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminSailings');
}
adminSailingsRef.operationName = 'AdminSailings';
exports.adminSailingsRef = adminSailingsRef;

exports.adminSailings = function adminSailings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminSailingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminDashboardStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminDashboardStats', inputVars);
}
adminDashboardStatsRef.operationName = 'AdminDashboardStats';
exports.adminDashboardStatsRef = adminDashboardStatsRef;

exports.adminDashboardStats = function adminDashboardStats(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(adminDashboardStatsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminUsers');
}
adminUsersRef.operationName = 'AdminUsers';
exports.adminUsersRef = adminUsersRef;

exports.adminUsers = function adminUsers(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminUsersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminPassengerRecordsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminPassengerRecords');
}
adminPassengerRecordsRef.operationName = 'AdminPassengerRecords';
exports.adminPassengerRecordsRef = adminPassengerRecordsRef;

exports.adminPassengerRecords = function adminPassengerRecords(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminPassengerRecordsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminPortsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminPorts');
}
adminPortsRef.operationName = 'AdminPorts';
exports.adminPortsRef = adminPortsRef;

exports.adminPorts = function adminPorts(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminPortsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminVesselsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminVessels');
}
adminVesselsRef.operationName = 'AdminVessels';
exports.adminVesselsRef = adminVesselsRef;

exports.adminVessels = function adminVessels(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminVesselsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminCreatePortRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminCreatePort', inputVars);
}
adminCreatePortRef.operationName = 'AdminCreatePort';
exports.adminCreatePortRef = adminCreatePortRef;

exports.adminCreatePort = function adminCreatePort(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminCreatePortRef(dcInstance, inputVars));
}
;

const adminUpdatePortRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminUpdatePort', inputVars);
}
adminUpdatePortRef.operationName = 'AdminUpdatePort';
exports.adminUpdatePortRef = adminUpdatePortRef;

exports.adminUpdatePort = function adminUpdatePort(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminUpdatePortRef(dcInstance, inputVars));
}
;

const adminCreateVesselRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminCreateVessel', inputVars);
}
adminCreateVesselRef.operationName = 'AdminCreateVessel';
exports.adminCreateVesselRef = adminCreateVesselRef;

exports.adminCreateVessel = function adminCreateVessel(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminCreateVesselRef(dcInstance, inputVars));
}
;

const adminUpdateVesselRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminUpdateVessel', inputVars);
}
adminUpdateVesselRef.operationName = 'AdminUpdateVessel';
exports.adminUpdateVesselRef = adminUpdateVesselRef;

exports.adminUpdateVessel = function adminUpdateVessel(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminUpdateVesselRef(dcInstance, inputVars));
}
;

const adminCreateSailingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminCreateSailing', inputVars);
}
adminCreateSailingRef.operationName = 'AdminCreateSailing';
exports.adminCreateSailingRef = adminCreateSailingRef;

exports.adminCreateSailing = function adminCreateSailing(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminCreateSailingRef(dcInstance, inputVars));
}
;

const adminUpdateSailingStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminUpdateSailingStatus', inputVars);
}
adminUpdateSailingStatusRef.operationName = 'AdminUpdateSailingStatus';
exports.adminUpdateSailingStatusRef = adminUpdateSailingStatusRef;

exports.adminUpdateSailingStatus = function adminUpdateSailingStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminUpdateSailingStatusRef(dcInstance, inputVars));
}
;

const adminSailingBookingsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminSailingBookings', inputVars);
}
adminSailingBookingsRef.operationName = 'AdminSailingBookings';
exports.adminSailingBookingsRef = adminSailingBookingsRef;

exports.adminSailingBookings = function adminSailingBookings(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(adminSailingBookingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminUpdateUnbookedSailingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminUpdateUnbookedSailing', inputVars);
}
adminUpdateUnbookedSailingRef.operationName = 'AdminUpdateUnbookedSailing';
exports.adminUpdateUnbookedSailingRef = adminUpdateUnbookedSailingRef;

exports.adminUpdateUnbookedSailing = function adminUpdateUnbookedSailing(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminUpdateUnbookedSailingRef(dcInstance, inputVars));
}
;

const adminRescheduleSailingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminRescheduleSailing', inputVars);
}
adminRescheduleSailingRef.operationName = 'AdminRescheduleSailing';
exports.adminRescheduleSailingRef = adminRescheduleSailingRef;

exports.adminRescheduleSailing = function adminRescheduleSailing(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminRescheduleSailingRef(dcInstance, inputVars));
}
;

const adminCancelBookingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminCancelBooking', inputVars);
}
adminCancelBookingRef.operationName = 'AdminCancelBooking';
exports.adminCancelBookingRef = adminCancelBookingRef;

exports.adminCancelBooking = function adminCancelBooking(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminCancelBookingRef(dcInstance, inputVars));
}
;

const adminReportsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminReports', inputVars);
}
adminReportsRef.operationName = 'AdminReports';
exports.adminReportsRef = adminReportsRef;

exports.adminReports = function adminReports(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(adminReportsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminNextTripCodeRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminNextTripCode');
}
adminNextTripCodeRef.operationName = 'AdminNextTripCode';
exports.adminNextTripCodeRef = adminNextTripCodeRef;

exports.adminNextTripCode = function adminNextTripCode(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminNextTripCodeRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
