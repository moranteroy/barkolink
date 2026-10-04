const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'passenger',
  service: 'barkolink-87e5e-service',
  location: 'asia-southeast1'
};
exports.connectorConfig = connectorConfig;

const browseActivePortsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'BrowseActivePorts');
}
browseActivePortsRef.operationName = 'BrowseActivePorts';
exports.browseActivePortsRef = browseActivePortsRef;

exports.browseActivePorts = function browseActivePorts(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(browseActivePortsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const browseSailingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'BrowseSailings');
}
browseSailingsRef.operationName = 'BrowseSailings';
exports.browseSailingsRef = browseSailingsRef;

exports.browseSailings = function browseSailings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(browseSailingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const myProfileRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyProfile');
}
myProfileRef.operationName = 'MyProfile';
exports.myProfileRef = myProfileRef;

exports.myProfile = function myProfile(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myProfileRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createMyProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateMyProfile', inputVars);
}
createMyProfileRef.operationName = 'CreateMyProfile';
exports.createMyProfileRef = createMyProfileRef;

exports.createMyProfile = function createMyProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createMyProfileRef(dcInstance, inputVars));
}
;

const updateMyProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMyProfile', inputVars);
}
updateMyProfileRef.operationName = 'UpdateMyProfile';
exports.updateMyProfileRef = updateMyProfileRef;

exports.updateMyProfile = function updateMyProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateMyProfileRef(dcInstance, inputVars));
}
;

const myBookingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyBookings');
}
myBookingsRef.operationName = 'MyBookings';
exports.myBookingsRef = myBookingsRef;

exports.myBookings = function myBookings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myBookingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const reserveSailing1Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing1', inputVars);
}
reserveSailing1Ref.operationName = 'ReserveSailing1';
exports.reserveSailing1Ref = reserveSailing1Ref;

exports.reserveSailing1 = function reserveSailing1(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing1Ref(dcInstance, inputVars));
}
;

const reserveSailing2Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing2', inputVars);
}
reserveSailing2Ref.operationName = 'ReserveSailing2';
exports.reserveSailing2Ref = reserveSailing2Ref;

exports.reserveSailing2 = function reserveSailing2(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing2Ref(dcInstance, inputVars));
}
;

const reserveSailing3Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing3', inputVars);
}
reserveSailing3Ref.operationName = 'ReserveSailing3';
exports.reserveSailing3Ref = reserveSailing3Ref;

exports.reserveSailing3 = function reserveSailing3(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing3Ref(dcInstance, inputVars));
}
;

const reserveSailing4Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing4', inputVars);
}
reserveSailing4Ref.operationName = 'ReserveSailing4';
exports.reserveSailing4Ref = reserveSailing4Ref;

exports.reserveSailing4 = function reserveSailing4(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing4Ref(dcInstance, inputVars));
}
;

const reserveSailing5Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing5', inputVars);
}
reserveSailing5Ref.operationName = 'ReserveSailing5';
exports.reserveSailing5Ref = reserveSailing5Ref;

exports.reserveSailing5 = function reserveSailing5(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing5Ref(dcInstance, inputVars));
}
;

const reserveSailing6Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing6', inputVars);
}
reserveSailing6Ref.operationName = 'ReserveSailing6';
exports.reserveSailing6Ref = reserveSailing6Ref;

exports.reserveSailing6 = function reserveSailing6(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing6Ref(dcInstance, inputVars));
}
;

const reserveSailing7Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing7', inputVars);
}
reserveSailing7Ref.operationName = 'ReserveSailing7';
exports.reserveSailing7Ref = reserveSailing7Ref;

exports.reserveSailing7 = function reserveSailing7(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing7Ref(dcInstance, inputVars));
}
;

const reserveSailing8Ref = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveSailing8', inputVars);
}
reserveSailing8Ref.operationName = 'ReserveSailing8';
exports.reserveSailing8Ref = reserveSailing8Ref;

exports.reserveSailing8 = function reserveSailing8(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveSailing8Ref(dcInstance, inputVars));
}
;

const cancelMyBookingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CancelMyBooking', inputVars);
}
cancelMyBookingRef.operationName = 'CancelMyBooking';
exports.cancelMyBookingRef = cancelMyBookingRef;

exports.cancelMyBooking = function cancelMyBooking(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(cancelMyBookingRef(dcInstance, inputVars));
}
;

const myNotificationsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyNotifications');
}
myNotificationsRef.operationName = 'MyNotifications';
exports.myNotificationsRef = myNotificationsRef;

exports.myNotifications = function myNotifications(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myNotificationsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const myTicketsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyTickets');
}
myTicketsRef.operationName = 'MyTickets';
exports.myTicketsRef = myTicketsRef;

exports.myTickets = function myTickets(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myTicketsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const markNotificationReadRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkNotificationRead', inputVars);
}
markNotificationReadRef.operationName = 'MarkNotificationRead';
exports.markNotificationReadRef = markNotificationReadRef;

exports.markNotificationRead = function markNotificationRead(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(markNotificationReadRef(dcInstance, inputVars));
}
;
