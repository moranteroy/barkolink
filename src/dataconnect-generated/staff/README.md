# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `staff`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*AdminFareSettings*](#adminfaresettings)
  - [*AdminExportManifest*](#adminexportmanifest)
  - [*StaffBookings*](#staffbookings)
  - [*TicketingPassengerAccounts*](#ticketingpassengeraccounts)
  - [*TicketingSailings*](#ticketingsailings)
  - [*BoardingManifest*](#boardingmanifest)
  - [*BoardingSailings*](#boardingsailings)
  - [*BoardingActivity*](#boardingactivity)
  - [*AdminSailings*](#adminsailings)
  - [*AdminDashboardStats*](#admindashboardstats)
  - [*AdminUsers*](#adminusers)
  - [*AdminPassengerRecords*](#adminpassengerrecords)
  - [*AdminPorts*](#adminports)
  - [*AdminVessels*](#adminvessels)
  - [*AdminSailingBookings*](#adminsailingbookings)
  - [*AdminReports*](#adminreports)
  - [*AdminNextTripCode*](#adminnexttripcode)
- [**Mutations**](#mutations)
  - [*AdminSaveFareSettings*](#adminsavefaresettings)
  - [*CollectBookingPayment*](#collectbookingpayment)
  - [*TicketingCreateWalkIn*](#ticketingcreatewalkin)
  - [*TicketingCreateGuestWalkIn*](#ticketingcreateguestwalkin)
  - [*CheckInTicket*](#checkinticket)
  - [*BoardTicket*](#boardticket)
  - [*AdminCreatePort*](#admincreateport)
  - [*AdminUpdatePort*](#adminupdateport)
  - [*AdminCreateVessel*](#admincreatevessel)
  - [*AdminUpdateVessel*](#adminupdatevessel)
  - [*AdminCreateSailing*](#admincreatesailing)
  - [*AdminUpdateSailingStatus*](#adminupdatesailingstatus)
  - [*AdminUpdateUnbookedSailing*](#adminupdateunbookedsailing)
  - [*AdminRescheduleSailing*](#adminreschedulesailing)
  - [*AdminCancelBooking*](#admincancelbooking)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `staff`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@barkolink/dataconnect-staff` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@barkolink/dataconnect-staff';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@barkolink/dataconnect-staff';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `staff` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## AdminFareSettings
You can execute the `AdminFareSettings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminFareSettings(options?: ExecuteQueryOptions): QueryPromise<AdminFareSettingsData, undefined>;

interface AdminFareSettingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminFareSettingsData, undefined>;
}
export const adminFareSettingsRef: AdminFareSettingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminFareSettings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminFareSettingsData, undefined>;

interface AdminFareSettingsRef {
  ...
  (dc: DataConnect): QueryRef<AdminFareSettingsData, undefined>;
}
export const adminFareSettingsRef: AdminFareSettingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminFareSettingsRef:
```typescript
const name = adminFareSettingsRef.operationName;
console.log(name);
```

### Variables
The `AdminFareSettings` query has no variables.
### Return Type
Recall that executing the `AdminFareSettings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminFareSettingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminFareSettings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminFareSettings } from '@barkolink/dataconnect-staff';


// Call the `adminFareSettings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminFareSettings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminFareSettings(dataConnect);

console.log(data.fareSettings);
console.log(data.vesselFareSettings);

// Or, you can use the `Promise` API.
adminFareSettings().then((response) => {
  const data = response.data;
  console.log(data.fareSettings);
  console.log(data.vesselFareSettings);
});
```

### Using `AdminFareSettings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminFareSettingsRef } from '@barkolink/dataconnect-staff';


// Call the `adminFareSettingsRef()` function to get a reference to the query.
const ref = adminFareSettingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminFareSettingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.fareSettings);
console.log(data.vesselFareSettings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.fareSettings);
  console.log(data.vesselFareSettings);
});
```

## AdminExportManifest
You can execute the `AdminExportManifest` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminExportManifest(vars: AdminExportManifestVariables, options?: ExecuteQueryOptions): QueryPromise<AdminExportManifestData, AdminExportManifestVariables>;

interface AdminExportManifestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminExportManifestVariables): QueryRef<AdminExportManifestData, AdminExportManifestVariables>;
}
export const adminExportManifestRef: AdminExportManifestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminExportManifest(dc: DataConnect, vars: AdminExportManifestVariables, options?: ExecuteQueryOptions): QueryPromise<AdminExportManifestData, AdminExportManifestVariables>;

interface AdminExportManifestRef {
  ...
  (dc: DataConnect, vars: AdminExportManifestVariables): QueryRef<AdminExportManifestData, AdminExportManifestVariables>;
}
export const adminExportManifestRef: AdminExportManifestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminExportManifestRef:
```typescript
const name = adminExportManifestRef.operationName;
console.log(name);
```

### Variables
The `AdminExportManifest` query requires an argument of type `AdminExportManifestVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminExportManifestVariables {
  sailingCode: string;
  offset: number;
}
```
### Return Type
Recall that executing the `AdminExportManifest` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminExportManifestData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminExportManifest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminExportManifest, AdminExportManifestVariables } from '@barkolink/dataconnect-staff';

// The `AdminExportManifest` query requires an argument of type `AdminExportManifestVariables`:
const adminExportManifestVars: AdminExportManifestVariables = {
  sailingCode: ..., 
  offset: ..., 
};

// Call the `adminExportManifest()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminExportManifest(adminExportManifestVars);
// Variables can be defined inline as well.
const { data } = await adminExportManifest({ sailingCode: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminExportManifest(dataConnect, adminExportManifestVars);

console.log(data.bookingPassengers);

// Or, you can use the `Promise` API.
adminExportManifest(adminExportManifestVars).then((response) => {
  const data = response.data;
  console.log(data.bookingPassengers);
});
```

### Using `AdminExportManifest`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminExportManifestRef, AdminExportManifestVariables } from '@barkolink/dataconnect-staff';

// The `AdminExportManifest` query requires an argument of type `AdminExportManifestVariables`:
const adminExportManifestVars: AdminExportManifestVariables = {
  sailingCode: ..., 
  offset: ..., 
};

// Call the `adminExportManifestRef()` function to get a reference to the query.
const ref = adminExportManifestRef(adminExportManifestVars);
// Variables can be defined inline as well.
const ref = adminExportManifestRef({ sailingCode: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminExportManifestRef(dataConnect, adminExportManifestVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.bookingPassengers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingPassengers);
});
```

## StaffBookings
You can execute the `StaffBookings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
staffBookings(options?: ExecuteQueryOptions): QueryPromise<StaffBookingsData, undefined>;

interface StaffBookingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<StaffBookingsData, undefined>;
}
export const staffBookingsRef: StaffBookingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
staffBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<StaffBookingsData, undefined>;

interface StaffBookingsRef {
  ...
  (dc: DataConnect): QueryRef<StaffBookingsData, undefined>;
}
export const staffBookingsRef: StaffBookingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the staffBookingsRef:
```typescript
const name = staffBookingsRef.operationName;
console.log(name);
```

### Variables
The `StaffBookings` query has no variables.
### Return Type
Recall that executing the `StaffBookings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `StaffBookingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `StaffBookings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, staffBookings } from '@barkolink/dataconnect-staff';


// Call the `staffBookings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await staffBookings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await staffBookings(dataConnect);

console.log(data.bookings);

// Or, you can use the `Promise` API.
staffBookings().then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

### Using `StaffBookings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, staffBookingsRef } from '@barkolink/dataconnect-staff';


// Call the `staffBookingsRef()` function to get a reference to the query.
const ref = staffBookingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = staffBookingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.bookings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

## TicketingPassengerAccounts
You can execute the `TicketingPassengerAccounts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
ticketingPassengerAccounts(options?: ExecuteQueryOptions): QueryPromise<TicketingPassengerAccountsData, undefined>;

interface TicketingPassengerAccountsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<TicketingPassengerAccountsData, undefined>;
}
export const ticketingPassengerAccountsRef: TicketingPassengerAccountsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
ticketingPassengerAccounts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<TicketingPassengerAccountsData, undefined>;

interface TicketingPassengerAccountsRef {
  ...
  (dc: DataConnect): QueryRef<TicketingPassengerAccountsData, undefined>;
}
export const ticketingPassengerAccountsRef: TicketingPassengerAccountsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the ticketingPassengerAccountsRef:
```typescript
const name = ticketingPassengerAccountsRef.operationName;
console.log(name);
```

### Variables
The `TicketingPassengerAccounts` query has no variables.
### Return Type
Recall that executing the `TicketingPassengerAccounts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `TicketingPassengerAccountsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface TicketingPassengerAccountsData {
  users: ({
    uid: string;
    fullName: string;
    email: string;
  } & User_Key)[];
}
```
### Using `TicketingPassengerAccounts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ticketingPassengerAccounts } from '@barkolink/dataconnect-staff';


// Call the `ticketingPassengerAccounts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await ticketingPassengerAccounts();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await ticketingPassengerAccounts(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
ticketingPassengerAccounts().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `TicketingPassengerAccounts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, ticketingPassengerAccountsRef } from '@barkolink/dataconnect-staff';


// Call the `ticketingPassengerAccountsRef()` function to get a reference to the query.
const ref = ticketingPassengerAccountsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = ticketingPassengerAccountsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## TicketingSailings
You can execute the `TicketingSailings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
ticketingSailings(options?: ExecuteQueryOptions): QueryPromise<TicketingSailingsData, undefined>;

interface TicketingSailingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<TicketingSailingsData, undefined>;
}
export const ticketingSailingsRef: TicketingSailingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
ticketingSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<TicketingSailingsData, undefined>;

interface TicketingSailingsRef {
  ...
  (dc: DataConnect): QueryRef<TicketingSailingsData, undefined>;
}
export const ticketingSailingsRef: TicketingSailingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the ticketingSailingsRef:
```typescript
const name = ticketingSailingsRef.operationName;
console.log(name);
```

### Variables
The `TicketingSailings` query has no variables.
### Return Type
Recall that executing the `TicketingSailings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `TicketingSailingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `TicketingSailings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ticketingSailings } from '@barkolink/dataconnect-staff';


// Call the `ticketingSailings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await ticketingSailings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await ticketingSailings(dataConnect);

console.log(data.sailings);

// Or, you can use the `Promise` API.
ticketingSailings().then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

### Using `TicketingSailings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, ticketingSailingsRef } from '@barkolink/dataconnect-staff';


// Call the `ticketingSailingsRef()` function to get a reference to the query.
const ref = ticketingSailingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = ticketingSailingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sailings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

## BoardingManifest
You can execute the `BoardingManifest` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
boardingManifest(vars: BoardingManifestVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingManifestData, BoardingManifestVariables>;

interface BoardingManifestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: BoardingManifestVariables): QueryRef<BoardingManifestData, BoardingManifestVariables>;
}
export const boardingManifestRef: BoardingManifestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
boardingManifest(dc: DataConnect, vars: BoardingManifestVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingManifestData, BoardingManifestVariables>;

interface BoardingManifestRef {
  ...
  (dc: DataConnect, vars: BoardingManifestVariables): QueryRef<BoardingManifestData, BoardingManifestVariables>;
}
export const boardingManifestRef: BoardingManifestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the boardingManifestRef:
```typescript
const name = boardingManifestRef.operationName;
console.log(name);
```

### Variables
The `BoardingManifest` query requires an argument of type `BoardingManifestVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface BoardingManifestVariables {
  sailingCode: string;
}
```
### Return Type
Recall that executing the `BoardingManifest` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `BoardingManifestData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `BoardingManifest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, boardingManifest, BoardingManifestVariables } from '@barkolink/dataconnect-staff';

// The `BoardingManifest` query requires an argument of type `BoardingManifestVariables`:
const boardingManifestVars: BoardingManifestVariables = {
  sailingCode: ..., 
};

// Call the `boardingManifest()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await boardingManifest(boardingManifestVars);
// Variables can be defined inline as well.
const { data } = await boardingManifest({ sailingCode: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await boardingManifest(dataConnect, boardingManifestVars);

console.log(data.bookings);

// Or, you can use the `Promise` API.
boardingManifest(boardingManifestVars).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

### Using `BoardingManifest`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, boardingManifestRef, BoardingManifestVariables } from '@barkolink/dataconnect-staff';

// The `BoardingManifest` query requires an argument of type `BoardingManifestVariables`:
const boardingManifestVars: BoardingManifestVariables = {
  sailingCode: ..., 
};

// Call the `boardingManifestRef()` function to get a reference to the query.
const ref = boardingManifestRef(boardingManifestVars);
// Variables can be defined inline as well.
const ref = boardingManifestRef({ sailingCode: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = boardingManifestRef(dataConnect, boardingManifestVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.bookings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

## BoardingSailings
You can execute the `BoardingSailings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
boardingSailings(options?: ExecuteQueryOptions): QueryPromise<BoardingSailingsData, undefined>;

interface BoardingSailingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<BoardingSailingsData, undefined>;
}
export const boardingSailingsRef: BoardingSailingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
boardingSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<BoardingSailingsData, undefined>;

interface BoardingSailingsRef {
  ...
  (dc: DataConnect): QueryRef<BoardingSailingsData, undefined>;
}
export const boardingSailingsRef: BoardingSailingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the boardingSailingsRef:
```typescript
const name = boardingSailingsRef.operationName;
console.log(name);
```

### Variables
The `BoardingSailings` query has no variables.
### Return Type
Recall that executing the `BoardingSailings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `BoardingSailingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `BoardingSailings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, boardingSailings } from '@barkolink/dataconnect-staff';


// Call the `boardingSailings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await boardingSailings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await boardingSailings(dataConnect);

console.log(data.sailings);

// Or, you can use the `Promise` API.
boardingSailings().then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

### Using `BoardingSailings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, boardingSailingsRef } from '@barkolink/dataconnect-staff';


// Call the `boardingSailingsRef()` function to get a reference to the query.
const ref = boardingSailingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = boardingSailingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sailings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

## BoardingActivity
You can execute the `BoardingActivity` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
boardingActivity(vars: BoardingActivityVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingActivityData, BoardingActivityVariables>;

interface BoardingActivityRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: BoardingActivityVariables): QueryRef<BoardingActivityData, BoardingActivityVariables>;
}
export const boardingActivityRef: BoardingActivityRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
boardingActivity(dc: DataConnect, vars: BoardingActivityVariables, options?: ExecuteQueryOptions): QueryPromise<BoardingActivityData, BoardingActivityVariables>;

interface BoardingActivityRef {
  ...
  (dc: DataConnect, vars: BoardingActivityVariables): QueryRef<BoardingActivityData, BoardingActivityVariables>;
}
export const boardingActivityRef: BoardingActivityRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the boardingActivityRef:
```typescript
const name = boardingActivityRef.operationName;
console.log(name);
```

### Variables
The `BoardingActivity` query requires an argument of type `BoardingActivityVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface BoardingActivityVariables {
  sailingCode: string;
}
```
### Return Type
Recall that executing the `BoardingActivity` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `BoardingActivityData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `BoardingActivity`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, boardingActivity, BoardingActivityVariables } from '@barkolink/dataconnect-staff';

// The `BoardingActivity` query requires an argument of type `BoardingActivityVariables`:
const boardingActivityVars: BoardingActivityVariables = {
  sailingCode: ..., 
};

// Call the `boardingActivity()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await boardingActivity(boardingActivityVars);
// Variables can be defined inline as well.
const { data } = await boardingActivity({ sailingCode: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await boardingActivity(dataConnect, boardingActivityVars);

console.log(data.boardingEvents);

// Or, you can use the `Promise` API.
boardingActivity(boardingActivityVars).then((response) => {
  const data = response.data;
  console.log(data.boardingEvents);
});
```

### Using `BoardingActivity`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, boardingActivityRef, BoardingActivityVariables } from '@barkolink/dataconnect-staff';

// The `BoardingActivity` query requires an argument of type `BoardingActivityVariables`:
const boardingActivityVars: BoardingActivityVariables = {
  sailingCode: ..., 
};

// Call the `boardingActivityRef()` function to get a reference to the query.
const ref = boardingActivityRef(boardingActivityVars);
// Variables can be defined inline as well.
const ref = boardingActivityRef({ sailingCode: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = boardingActivityRef(dataConnect, boardingActivityVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.boardingEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.boardingEvents);
});
```

## AdminSailings
You can execute the `AdminSailings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminSailings(options?: ExecuteQueryOptions): QueryPromise<AdminSailingsData, undefined>;

interface AdminSailingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminSailingsData, undefined>;
}
export const adminSailingsRef: AdminSailingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminSailingsData, undefined>;

interface AdminSailingsRef {
  ...
  (dc: DataConnect): QueryRef<AdminSailingsData, undefined>;
}
export const adminSailingsRef: AdminSailingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminSailingsRef:
```typescript
const name = adminSailingsRef.operationName;
console.log(name);
```

### Variables
The `AdminSailings` query has no variables.
### Return Type
Recall that executing the `AdminSailings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminSailingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminSailings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminSailings } from '@barkolink/dataconnect-staff';


// Call the `adminSailings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminSailings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminSailings(dataConnect);

console.log(data.sailings);

// Or, you can use the `Promise` API.
adminSailings().then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

### Using `AdminSailings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminSailingsRef } from '@barkolink/dataconnect-staff';


// Call the `adminSailingsRef()` function to get a reference to the query.
const ref = adminSailingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminSailingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sailings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

## AdminDashboardStats
You can execute the `AdminDashboardStats` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminDashboardStats(vars: AdminDashboardStatsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminDashboardStatsData, AdminDashboardStatsVariables>;

interface AdminDashboardStatsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminDashboardStatsVariables): QueryRef<AdminDashboardStatsData, AdminDashboardStatsVariables>;
}
export const adminDashboardStatsRef: AdminDashboardStatsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminDashboardStats(dc: DataConnect, vars: AdminDashboardStatsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminDashboardStatsData, AdminDashboardStatsVariables>;

interface AdminDashboardStatsRef {
  ...
  (dc: DataConnect, vars: AdminDashboardStatsVariables): QueryRef<AdminDashboardStatsData, AdminDashboardStatsVariables>;
}
export const adminDashboardStatsRef: AdminDashboardStatsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminDashboardStatsRef:
```typescript
const name = adminDashboardStatsRef.operationName;
console.log(name);
```

### Variables
The `AdminDashboardStats` query requires an argument of type `AdminDashboardStatsVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminDashboardStatsVariables {
  dayStart: TimestampString;
  dayEnd: TimestampString;
}
```
### Return Type
Recall that executing the `AdminDashboardStats` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminDashboardStatsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminDashboardStats`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminDashboardStats, AdminDashboardStatsVariables } from '@barkolink/dataconnect-staff';

// The `AdminDashboardStats` query requires an argument of type `AdminDashboardStatsVariables`:
const adminDashboardStatsVars: AdminDashboardStatsVariables = {
  dayStart: ..., 
  dayEnd: ..., 
};

// Call the `adminDashboardStats()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminDashboardStats(adminDashboardStatsVars);
// Variables can be defined inline as well.
const { data } = await adminDashboardStats({ dayStart: ..., dayEnd: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminDashboardStats(dataConnect, adminDashboardStatsVars);

console.log(data.todaySailings);
console.log(data.todayBookings);
console.log(data.cancelledBookings);
console.log(data.allPassengers);
console.log(data.checkedInPassengers);
console.log(data.boardedPassengers);

// Or, you can use the `Promise` API.
adminDashboardStats(adminDashboardStatsVars).then((response) => {
  const data = response.data;
  console.log(data.todaySailings);
  console.log(data.todayBookings);
  console.log(data.cancelledBookings);
  console.log(data.allPassengers);
  console.log(data.checkedInPassengers);
  console.log(data.boardedPassengers);
});
```

### Using `AdminDashboardStats`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminDashboardStatsRef, AdminDashboardStatsVariables } from '@barkolink/dataconnect-staff';

// The `AdminDashboardStats` query requires an argument of type `AdminDashboardStatsVariables`:
const adminDashboardStatsVars: AdminDashboardStatsVariables = {
  dayStart: ..., 
  dayEnd: ..., 
};

// Call the `adminDashboardStatsRef()` function to get a reference to the query.
const ref = adminDashboardStatsRef(adminDashboardStatsVars);
// Variables can be defined inline as well.
const ref = adminDashboardStatsRef({ dayStart: ..., dayEnd: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminDashboardStatsRef(dataConnect, adminDashboardStatsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.todaySailings);
console.log(data.todayBookings);
console.log(data.cancelledBookings);
console.log(data.allPassengers);
console.log(data.checkedInPassengers);
console.log(data.boardedPassengers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.todaySailings);
  console.log(data.todayBookings);
  console.log(data.cancelledBookings);
  console.log(data.allPassengers);
  console.log(data.checkedInPassengers);
  console.log(data.boardedPassengers);
});
```

## AdminUsers
You can execute the `AdminUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminUsers(options?: ExecuteQueryOptions): QueryPromise<AdminUsersData, undefined>;

interface AdminUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminUsersData, undefined>;
}
export const adminUsersRef: AdminUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminUsersData, undefined>;

interface AdminUsersRef {
  ...
  (dc: DataConnect): QueryRef<AdminUsersData, undefined>;
}
export const adminUsersRef: AdminUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminUsersRef:
```typescript
const name = adminUsersRef.operationName;
console.log(name);
```

### Variables
The `AdminUsers` query has no variables.
### Return Type
Recall that executing the `AdminUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminUsersData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminUsers } from '@barkolink/dataconnect-staff';


// Call the `adminUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
adminUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `AdminUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminUsersRef } from '@barkolink/dataconnect-staff';


// Call the `adminUsersRef()` function to get a reference to the query.
const ref = adminUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## AdminPassengerRecords
You can execute the `AdminPassengerRecords` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminPassengerRecords(options?: ExecuteQueryOptions): QueryPromise<AdminPassengerRecordsData, undefined>;

interface AdminPassengerRecordsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminPassengerRecordsData, undefined>;
}
export const adminPassengerRecordsRef: AdminPassengerRecordsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminPassengerRecords(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminPassengerRecordsData, undefined>;

interface AdminPassengerRecordsRef {
  ...
  (dc: DataConnect): QueryRef<AdminPassengerRecordsData, undefined>;
}
export const adminPassengerRecordsRef: AdminPassengerRecordsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminPassengerRecordsRef:
```typescript
const name = adminPassengerRecordsRef.operationName;
console.log(name);
```

### Variables
The `AdminPassengerRecords` query has no variables.
### Return Type
Recall that executing the `AdminPassengerRecords` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminPassengerRecordsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminPassengerRecords`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminPassengerRecords } from '@barkolink/dataconnect-staff';


// Call the `adminPassengerRecords()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminPassengerRecords();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminPassengerRecords(dataConnect);

console.log(data.bookingPassengers);

// Or, you can use the `Promise` API.
adminPassengerRecords().then((response) => {
  const data = response.data;
  console.log(data.bookingPassengers);
});
```

### Using `AdminPassengerRecords`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminPassengerRecordsRef } from '@barkolink/dataconnect-staff';


// Call the `adminPassengerRecordsRef()` function to get a reference to the query.
const ref = adminPassengerRecordsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminPassengerRecordsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.bookingPassengers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.bookingPassengers);
});
```

## AdminPorts
You can execute the `AdminPorts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminPorts(options?: ExecuteQueryOptions): QueryPromise<AdminPortsData, undefined>;

interface AdminPortsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminPortsData, undefined>;
}
export const adminPortsRef: AdminPortsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminPorts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminPortsData, undefined>;

interface AdminPortsRef {
  ...
  (dc: DataConnect): QueryRef<AdminPortsData, undefined>;
}
export const adminPortsRef: AdminPortsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminPortsRef:
```typescript
const name = adminPortsRef.operationName;
console.log(name);
```

### Variables
The `AdminPorts` query has no variables.
### Return Type
Recall that executing the `AdminPorts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminPortsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminPorts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminPorts } from '@barkolink/dataconnect-staff';


// Call the `adminPorts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminPorts();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminPorts(dataConnect);

console.log(data.ports);

// Or, you can use the `Promise` API.
adminPorts().then((response) => {
  const data = response.data;
  console.log(data.ports);
});
```

### Using `AdminPorts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminPortsRef } from '@barkolink/dataconnect-staff';


// Call the `adminPortsRef()` function to get a reference to the query.
const ref = adminPortsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminPortsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.ports);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.ports);
});
```

## AdminVessels
You can execute the `AdminVessels` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminVessels(options?: ExecuteQueryOptions): QueryPromise<AdminVesselsData, undefined>;

interface AdminVesselsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminVesselsData, undefined>;
}
export const adminVesselsRef: AdminVesselsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminVessels(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminVesselsData, undefined>;

interface AdminVesselsRef {
  ...
  (dc: DataConnect): QueryRef<AdminVesselsData, undefined>;
}
export const adminVesselsRef: AdminVesselsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminVesselsRef:
```typescript
const name = adminVesselsRef.operationName;
console.log(name);
```

### Variables
The `AdminVessels` query has no variables.
### Return Type
Recall that executing the `AdminVessels` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminVesselsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminVesselsData {
  vessels: ({
    id: UUIDString;
    code: string;
    name: string;
    passengerCapacity: number;
    isActive: boolean;
  } & Vessel_Key)[];
}
```
### Using `AdminVessels`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminVessels } from '@barkolink/dataconnect-staff';


// Call the `adminVessels()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminVessels();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminVessels(dataConnect);

console.log(data.vessels);

// Or, you can use the `Promise` API.
adminVessels().then((response) => {
  const data = response.data;
  console.log(data.vessels);
});
```

### Using `AdminVessels`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminVesselsRef } from '@barkolink/dataconnect-staff';


// Call the `adminVesselsRef()` function to get a reference to the query.
const ref = adminVesselsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminVesselsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.vessels);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.vessels);
});
```

## AdminSailingBookings
You can execute the `AdminSailingBookings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminSailingBookings(vars: AdminSailingBookingsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminSailingBookingsData, AdminSailingBookingsVariables>;

interface AdminSailingBookingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminSailingBookingsVariables): QueryRef<AdminSailingBookingsData, AdminSailingBookingsVariables>;
}
export const adminSailingBookingsRef: AdminSailingBookingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminSailingBookings(dc: DataConnect, vars: AdminSailingBookingsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminSailingBookingsData, AdminSailingBookingsVariables>;

interface AdminSailingBookingsRef {
  ...
  (dc: DataConnect, vars: AdminSailingBookingsVariables): QueryRef<AdminSailingBookingsData, AdminSailingBookingsVariables>;
}
export const adminSailingBookingsRef: AdminSailingBookingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminSailingBookingsRef:
```typescript
const name = adminSailingBookingsRef.operationName;
console.log(name);
```

### Variables
The `AdminSailingBookings` query requires an argument of type `AdminSailingBookingsVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminSailingBookingsVariables {
  code: string;
}
```
### Return Type
Recall that executing the `AdminSailingBookings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminSailingBookingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminSailingBookingsData {
  bookings: ({
    id: UUIDString;
    ownerUid: string;
    passengerCount: number;
    bookingChannel: string;
  } & Booking_Key)[];
}
```
### Using `AdminSailingBookings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminSailingBookings, AdminSailingBookingsVariables } from '@barkolink/dataconnect-staff';

// The `AdminSailingBookings` query requires an argument of type `AdminSailingBookingsVariables`:
const adminSailingBookingsVars: AdminSailingBookingsVariables = {
  code: ..., 
};

// Call the `adminSailingBookings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminSailingBookings(adminSailingBookingsVars);
// Variables can be defined inline as well.
const { data } = await adminSailingBookings({ code: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminSailingBookings(dataConnect, adminSailingBookingsVars);

console.log(data.bookings);

// Or, you can use the `Promise` API.
adminSailingBookings(adminSailingBookingsVars).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

### Using `AdminSailingBookings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminSailingBookingsRef, AdminSailingBookingsVariables } from '@barkolink/dataconnect-staff';

// The `AdminSailingBookings` query requires an argument of type `AdminSailingBookingsVariables`:
const adminSailingBookingsVars: AdminSailingBookingsVariables = {
  code: ..., 
};

// Call the `adminSailingBookingsRef()` function to get a reference to the query.
const ref = adminSailingBookingsRef(adminSailingBookingsVars);
// Variables can be defined inline as well.
const ref = adminSailingBookingsRef({ code: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminSailingBookingsRef(dataConnect, adminSailingBookingsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.bookings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

## AdminReports
You can execute the `AdminReports` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminReports(vars: AdminReportsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminReportsData, AdminReportsVariables>;

interface AdminReportsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminReportsVariables): QueryRef<AdminReportsData, AdminReportsVariables>;
}
export const adminReportsRef: AdminReportsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminReports(dc: DataConnect, vars: AdminReportsVariables, options?: ExecuteQueryOptions): QueryPromise<AdminReportsData, AdminReportsVariables>;

interface AdminReportsRef {
  ...
  (dc: DataConnect, vars: AdminReportsVariables): QueryRef<AdminReportsData, AdminReportsVariables>;
}
export const adminReportsRef: AdminReportsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminReportsRef:
```typescript
const name = adminReportsRef.operationName;
console.log(name);
```

### Variables
The `AdminReports` query requires an argument of type `AdminReportsVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminReportsVariables {
  startAt: TimestampString;
  endAt: TimestampString;
}
```
### Return Type
Recall that executing the `AdminReports` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminReportsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminReportsData {
  sailings?: unknown[] | null;
}
```
### Using `AdminReports`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminReports, AdminReportsVariables } from '@barkolink/dataconnect-staff';

// The `AdminReports` query requires an argument of type `AdminReportsVariables`:
const adminReportsVars: AdminReportsVariables = {
  startAt: ..., 
  endAt: ..., 
};

// Call the `adminReports()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminReports(adminReportsVars);
// Variables can be defined inline as well.
const { data } = await adminReports({ startAt: ..., endAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminReports(dataConnect, adminReportsVars);

console.log(data.sailings);

// Or, you can use the `Promise` API.
adminReports(adminReportsVars).then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

### Using `AdminReports`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminReportsRef, AdminReportsVariables } from '@barkolink/dataconnect-staff';

// The `AdminReports` query requires an argument of type `AdminReportsVariables`:
const adminReportsVars: AdminReportsVariables = {
  startAt: ..., 
  endAt: ..., 
};

// Call the `adminReportsRef()` function to get a reference to the query.
const ref = adminReportsRef(adminReportsVars);
// Variables can be defined inline as well.
const ref = adminReportsRef({ startAt: ..., endAt: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminReportsRef(dataConnect, adminReportsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sailings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

## AdminNextTripCode
You can execute the `AdminNextTripCode` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminNextTripCode(options?: ExecuteQueryOptions): QueryPromise<AdminNextTripCodeData, undefined>;

interface AdminNextTripCodeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminNextTripCodeData, undefined>;
}
export const adminNextTripCodeRef: AdminNextTripCodeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminNextTripCode(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminNextTripCodeData, undefined>;

interface AdminNextTripCodeRef {
  ...
  (dc: DataConnect): QueryRef<AdminNextTripCodeData, undefined>;
}
export const adminNextTripCodeRef: AdminNextTripCodeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminNextTripCodeRef:
```typescript
const name = adminNextTripCodeRef.operationName;
console.log(name);
```

### Variables
The `AdminNextTripCode` query has no variables.
### Return Type
Recall that executing the `AdminNextTripCode` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminNextTripCodeData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminNextTripCodeData {
  nextTripCode?: unknown | null;
}
```
### Using `AdminNextTripCode`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminNextTripCode } from '@barkolink/dataconnect-staff';


// Call the `adminNextTripCode()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminNextTripCode();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminNextTripCode(dataConnect);

console.log(data.nextTripCode);

// Or, you can use the `Promise` API.
adminNextTripCode().then((response) => {
  const data = response.data;
  console.log(data.nextTripCode);
});
```

### Using `AdminNextTripCode`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminNextTripCodeRef } from '@barkolink/dataconnect-staff';


// Call the `adminNextTripCodeRef()` function to get a reference to the query.
const ref = adminNextTripCodeRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminNextTripCodeRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.nextTripCode);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.nextTripCode);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `staff` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## AdminSaveFareSettings
You can execute the `AdminSaveFareSettings` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminSaveFareSettings(vars: AdminSaveFareSettingsVariables): MutationPromise<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;

interface AdminSaveFareSettingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminSaveFareSettingsVariables): MutationRef<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;
}
export const adminSaveFareSettingsRef: AdminSaveFareSettingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminSaveFareSettings(dc: DataConnect, vars: AdminSaveFareSettingsVariables): MutationPromise<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;

interface AdminSaveFareSettingsRef {
  ...
  (dc: DataConnect, vars: AdminSaveFareSettingsVariables): MutationRef<AdminSaveFareSettingsData, AdminSaveFareSettingsVariables>;
}
export const adminSaveFareSettingsRef: AdminSaveFareSettingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminSaveFareSettingsRef:
```typescript
const name = adminSaveFareSettingsRef.operationName;
console.log(name);
```

### Variables
The `AdminSaveFareSettings` mutation requires an argument of type `AdminSaveFareSettingsVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminSaveFareSettingsVariables {
  vesselId: UUIDString;
  regularFare: number;
  studentDiscount: number;
  seniorDiscount: number;
  childDiscount: number;
  pwdDiscount: number;
}
```
### Return Type
Recall that executing the `AdminSaveFareSettings` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminSaveFareSettingsData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminSaveFareSettingsData {
  query?: {
    vessels: ({
      id: UUIDString;
    } & Vessel_Key)[];
  };
  fareSettings_upsert: FareSettings_Key;
}
```
### Using `AdminSaveFareSettings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminSaveFareSettings, AdminSaveFareSettingsVariables } from '@barkolink/dataconnect-staff';

// The `AdminSaveFareSettings` mutation requires an argument of type `AdminSaveFareSettingsVariables`:
const adminSaveFareSettingsVars: AdminSaveFareSettingsVariables = {
  vesselId: ..., 
  regularFare: ..., 
  studentDiscount: ..., 
  seniorDiscount: ..., 
  childDiscount: ..., 
  pwdDiscount: ..., 
};

// Call the `adminSaveFareSettings()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminSaveFareSettings(adminSaveFareSettingsVars);
// Variables can be defined inline as well.
const { data } = await adminSaveFareSettings({ vesselId: ..., regularFare: ..., studentDiscount: ..., seniorDiscount: ..., childDiscount: ..., pwdDiscount: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminSaveFareSettings(dataConnect, adminSaveFareSettingsVars);

console.log(data.query);
console.log(data.fareSettings_upsert);

// Or, you can use the `Promise` API.
adminSaveFareSettings(adminSaveFareSettingsVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.fareSettings_upsert);
});
```

### Using `AdminSaveFareSettings`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminSaveFareSettingsRef, AdminSaveFareSettingsVariables } from '@barkolink/dataconnect-staff';

// The `AdminSaveFareSettings` mutation requires an argument of type `AdminSaveFareSettingsVariables`:
const adminSaveFareSettingsVars: AdminSaveFareSettingsVariables = {
  vesselId: ..., 
  regularFare: ..., 
  studentDiscount: ..., 
  seniorDiscount: ..., 
  childDiscount: ..., 
  pwdDiscount: ..., 
};

// Call the `adminSaveFareSettingsRef()` function to get a reference to the mutation.
const ref = adminSaveFareSettingsRef(adminSaveFareSettingsVars);
// Variables can be defined inline as well.
const ref = adminSaveFareSettingsRef({ vesselId: ..., regularFare: ..., studentDiscount: ..., seniorDiscount: ..., childDiscount: ..., pwdDiscount: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminSaveFareSettingsRef(dataConnect, adminSaveFareSettingsVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.fareSettings_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.fareSettings_upsert);
});
```

## CollectBookingPayment
You can execute the `CollectBookingPayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
collectBookingPayment(vars: CollectBookingPaymentVariables): MutationPromise<CollectBookingPaymentData, CollectBookingPaymentVariables>;

interface CollectBookingPaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CollectBookingPaymentVariables): MutationRef<CollectBookingPaymentData, CollectBookingPaymentVariables>;
}
export const collectBookingPaymentRef: CollectBookingPaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
collectBookingPayment(dc: DataConnect, vars: CollectBookingPaymentVariables): MutationPromise<CollectBookingPaymentData, CollectBookingPaymentVariables>;

interface CollectBookingPaymentRef {
  ...
  (dc: DataConnect, vars: CollectBookingPaymentVariables): MutationRef<CollectBookingPaymentData, CollectBookingPaymentVariables>;
}
export const collectBookingPaymentRef: CollectBookingPaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the collectBookingPaymentRef:
```typescript
const name = collectBookingPaymentRef.operationName;
console.log(name);
```

### Variables
The `CollectBookingPayment` mutation requires an argument of type `CollectBookingPaymentVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CollectBookingPaymentVariables {
  bookingId: UUIDString;
  method: string;
}
```
### Return Type
Recall that executing the `CollectBookingPayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CollectBookingPaymentData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `CollectBookingPayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, collectBookingPayment, CollectBookingPaymentVariables } from '@barkolink/dataconnect-staff';

// The `CollectBookingPayment` mutation requires an argument of type `CollectBookingPaymentVariables`:
const collectBookingPaymentVars: CollectBookingPaymentVariables = {
  bookingId: ..., 
  method: ..., 
};

// Call the `collectBookingPayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await collectBookingPayment(collectBookingPaymentVars);
// Variables can be defined inline as well.
const { data } = await collectBookingPayment({ bookingId: ..., method: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await collectBookingPayment(dataConnect, collectBookingPaymentVars);

console.log(data.query);
console.log(data.booking_update);
console.log(data.bookingPassenger_updateMany);
console.log(data.notification_insert);

// Or, you can use the `Promise` API.
collectBookingPayment(collectBookingPaymentVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.booking_update);
  console.log(data.bookingPassenger_updateMany);
  console.log(data.notification_insert);
});
```

### Using `CollectBookingPayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, collectBookingPaymentRef, CollectBookingPaymentVariables } from '@barkolink/dataconnect-staff';

// The `CollectBookingPayment` mutation requires an argument of type `CollectBookingPaymentVariables`:
const collectBookingPaymentVars: CollectBookingPaymentVariables = {
  bookingId: ..., 
  method: ..., 
};

// Call the `collectBookingPaymentRef()` function to get a reference to the mutation.
const ref = collectBookingPaymentRef(collectBookingPaymentVars);
// Variables can be defined inline as well.
const ref = collectBookingPaymentRef({ bookingId: ..., method: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = collectBookingPaymentRef(dataConnect, collectBookingPaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.booking_update);
console.log(data.bookingPassenger_updateMany);
console.log(data.notification_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.booking_update);
  console.log(data.bookingPassenger_updateMany);
  console.log(data.notification_insert);
});
```

## TicketingCreateWalkIn
You can execute the `TicketingCreateWalkIn` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
ticketingCreateWalkIn(vars: TicketingCreateWalkInVariables): MutationPromise<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;

interface TicketingCreateWalkInRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: TicketingCreateWalkInVariables): MutationRef<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;
}
export const ticketingCreateWalkInRef: TicketingCreateWalkInRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
ticketingCreateWalkIn(dc: DataConnect, vars: TicketingCreateWalkInVariables): MutationPromise<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;

interface TicketingCreateWalkInRef {
  ...
  (dc: DataConnect, vars: TicketingCreateWalkInVariables): MutationRef<TicketingCreateWalkInData, TicketingCreateWalkInVariables>;
}
export const ticketingCreateWalkInRef: TicketingCreateWalkInRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the ticketingCreateWalkInRef:
```typescript
const name = ticketingCreateWalkInRef.operationName;
console.log(name);
```

### Variables
The `TicketingCreateWalkIn` mutation requires an argument of type `TicketingCreateWalkInVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface TicketingCreateWalkInVariables {
  sailingCode: string;
  ownerUid: string;
  reference: string;
  passengerName: string;
  passengerType: string;
  method: string;
}
```
### Return Type
Recall that executing the `TicketingCreateWalkIn` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `TicketingCreateWalkInData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `TicketingCreateWalkIn`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ticketingCreateWalkIn, TicketingCreateWalkInVariables } from '@barkolink/dataconnect-staff';

// The `TicketingCreateWalkIn` mutation requires an argument of type `TicketingCreateWalkInVariables`:
const ticketingCreateWalkInVars: TicketingCreateWalkInVariables = {
  sailingCode: ..., 
  ownerUid: ..., 
  reference: ..., 
  passengerName: ..., 
  passengerType: ..., 
  method: ..., 
};

// Call the `ticketingCreateWalkIn()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await ticketingCreateWalkIn(ticketingCreateWalkInVars);
// Variables can be defined inline as well.
const { data } = await ticketingCreateWalkIn({ sailingCode: ..., ownerUid: ..., reference: ..., passengerName: ..., passengerType: ..., method: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await ticketingCreateWalkIn(dataConnect, ticketingCreateWalkInVars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.bookingPassenger_insert);
console.log(data.notification_insert);

// Or, you can use the `Promise` API.
ticketingCreateWalkIn(ticketingCreateWalkInVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.bookingPassenger_insert);
  console.log(data.notification_insert);
});
```

### Using `TicketingCreateWalkIn`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, ticketingCreateWalkInRef, TicketingCreateWalkInVariables } from '@barkolink/dataconnect-staff';

// The `TicketingCreateWalkIn` mutation requires an argument of type `TicketingCreateWalkInVariables`:
const ticketingCreateWalkInVars: TicketingCreateWalkInVariables = {
  sailingCode: ..., 
  ownerUid: ..., 
  reference: ..., 
  passengerName: ..., 
  passengerType: ..., 
  method: ..., 
};

// Call the `ticketingCreateWalkInRef()` function to get a reference to the mutation.
const ref = ticketingCreateWalkInRef(ticketingCreateWalkInVars);
// Variables can be defined inline as well.
const ref = ticketingCreateWalkInRef({ sailingCode: ..., ownerUid: ..., reference: ..., passengerName: ..., passengerType: ..., method: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = ticketingCreateWalkInRef(dataConnect, ticketingCreateWalkInVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.bookingPassenger_insert);
console.log(data.notification_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.bookingPassenger_insert);
  console.log(data.notification_insert);
});
```

## TicketingCreateGuestWalkIn
You can execute the `TicketingCreateGuestWalkIn` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
ticketingCreateGuestWalkIn(vars: TicketingCreateGuestWalkInVariables): MutationPromise<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;

interface TicketingCreateGuestWalkInRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: TicketingCreateGuestWalkInVariables): MutationRef<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;
}
export const ticketingCreateGuestWalkInRef: TicketingCreateGuestWalkInRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
ticketingCreateGuestWalkIn(dc: DataConnect, vars: TicketingCreateGuestWalkInVariables): MutationPromise<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;

interface TicketingCreateGuestWalkInRef {
  ...
  (dc: DataConnect, vars: TicketingCreateGuestWalkInVariables): MutationRef<TicketingCreateGuestWalkInData, TicketingCreateGuestWalkInVariables>;
}
export const ticketingCreateGuestWalkInRef: TicketingCreateGuestWalkInRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the ticketingCreateGuestWalkInRef:
```typescript
const name = ticketingCreateGuestWalkInRef.operationName;
console.log(name);
```

### Variables
The `TicketingCreateGuestWalkIn` mutation requires an argument of type `TicketingCreateGuestWalkInVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `TicketingCreateGuestWalkIn` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `TicketingCreateGuestWalkInData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `TicketingCreateGuestWalkIn`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ticketingCreateGuestWalkIn, TicketingCreateGuestWalkInVariables } from '@barkolink/dataconnect-staff';

// The `TicketingCreateGuestWalkIn` mutation requires an argument of type `TicketingCreateGuestWalkInVariables`:
const ticketingCreateGuestWalkInVars: TicketingCreateGuestWalkInVariables = {
  sailingCode: ..., 
  guestUid: ..., 
  guestEmail: ..., 
  reference: ..., 
  ticketCode: ..., 
  passengerName: ..., 
  passengerPhone: ..., // optional
  birthDate: ..., // optional
  sex: ..., // optional
  nationality: ..., // optional
  passengerType: ..., 
  method: ..., 
};

// Call the `ticketingCreateGuestWalkIn()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await ticketingCreateGuestWalkIn(ticketingCreateGuestWalkInVars);
// Variables can be defined inline as well.
const { data } = await ticketingCreateGuestWalkIn({ sailingCode: ..., guestUid: ..., guestEmail: ..., reference: ..., ticketCode: ..., passengerName: ..., passengerPhone: ..., birthDate: ..., sex: ..., nationality: ..., passengerType: ..., method: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await ticketingCreateGuestWalkIn(dataConnect, ticketingCreateGuestWalkInVars);

console.log(data.query);
console.log(data.guest);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.bookingPassenger_insert);

// Or, you can use the `Promise` API.
ticketingCreateGuestWalkIn(ticketingCreateGuestWalkInVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.guest);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.bookingPassenger_insert);
});
```

### Using `TicketingCreateGuestWalkIn`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, ticketingCreateGuestWalkInRef, TicketingCreateGuestWalkInVariables } from '@barkolink/dataconnect-staff';

// The `TicketingCreateGuestWalkIn` mutation requires an argument of type `TicketingCreateGuestWalkInVariables`:
const ticketingCreateGuestWalkInVars: TicketingCreateGuestWalkInVariables = {
  sailingCode: ..., 
  guestUid: ..., 
  guestEmail: ..., 
  reference: ..., 
  ticketCode: ..., 
  passengerName: ..., 
  passengerPhone: ..., // optional
  birthDate: ..., // optional
  sex: ..., // optional
  nationality: ..., // optional
  passengerType: ..., 
  method: ..., 
};

// Call the `ticketingCreateGuestWalkInRef()` function to get a reference to the mutation.
const ref = ticketingCreateGuestWalkInRef(ticketingCreateGuestWalkInVars);
// Variables can be defined inline as well.
const ref = ticketingCreateGuestWalkInRef({ sailingCode: ..., guestUid: ..., guestEmail: ..., reference: ..., ticketCode: ..., passengerName: ..., passengerPhone: ..., birthDate: ..., sex: ..., nationality: ..., passengerType: ..., method: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = ticketingCreateGuestWalkInRef(dataConnect, ticketingCreateGuestWalkInVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.guest);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.bookingPassenger_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.guest);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.bookingPassenger_insert);
});
```

## CheckInTicket
You can execute the `CheckInTicket` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
checkInTicket(vars: CheckInTicketVariables): MutationPromise<CheckInTicketData, CheckInTicketVariables>;

interface CheckInTicketRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CheckInTicketVariables): MutationRef<CheckInTicketData, CheckInTicketVariables>;
}
export const checkInTicketRef: CheckInTicketRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
checkInTicket(dc: DataConnect, vars: CheckInTicketVariables): MutationPromise<CheckInTicketData, CheckInTicketVariables>;

interface CheckInTicketRef {
  ...
  (dc: DataConnect, vars: CheckInTicketVariables): MutationRef<CheckInTicketData, CheckInTicketVariables>;
}
export const checkInTicketRef: CheckInTicketRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the checkInTicketRef:
```typescript
const name = checkInTicketRef.operationName;
console.log(name);
```

### Variables
The `CheckInTicket` mutation requires an argument of type `CheckInTicketVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CheckInTicketVariables {
  passengerId: UUIDString;
}
```
### Return Type
Recall that executing the `CheckInTicket` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CheckInTicketData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `CheckInTicket`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, checkInTicket, CheckInTicketVariables } from '@barkolink/dataconnect-staff';

// The `CheckInTicket` mutation requires an argument of type `CheckInTicketVariables`:
const checkInTicketVars: CheckInTicketVariables = {
  passengerId: ..., 
};

// Call the `checkInTicket()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await checkInTicket(checkInTicketVars);
// Variables can be defined inline as well.
const { data } = await checkInTicket({ passengerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await checkInTicket(dataConnect, checkInTicketVars);

console.log(data.query);
console.log(data.bookingPassenger_update);
console.log(data.boardingEvent_insert);

// Or, you can use the `Promise` API.
checkInTicket(checkInTicketVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.bookingPassenger_update);
  console.log(data.boardingEvent_insert);
});
```

### Using `CheckInTicket`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, checkInTicketRef, CheckInTicketVariables } from '@barkolink/dataconnect-staff';

// The `CheckInTicket` mutation requires an argument of type `CheckInTicketVariables`:
const checkInTicketVars: CheckInTicketVariables = {
  passengerId: ..., 
};

// Call the `checkInTicketRef()` function to get a reference to the mutation.
const ref = checkInTicketRef(checkInTicketVars);
// Variables can be defined inline as well.
const ref = checkInTicketRef({ passengerId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = checkInTicketRef(dataConnect, checkInTicketVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.bookingPassenger_update);
console.log(data.boardingEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.bookingPassenger_update);
  console.log(data.boardingEvent_insert);
});
```

## BoardTicket
You can execute the `BoardTicket` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
boardTicket(vars: BoardTicketVariables): MutationPromise<BoardTicketData, BoardTicketVariables>;

interface BoardTicketRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: BoardTicketVariables): MutationRef<BoardTicketData, BoardTicketVariables>;
}
export const boardTicketRef: BoardTicketRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
boardTicket(dc: DataConnect, vars: BoardTicketVariables): MutationPromise<BoardTicketData, BoardTicketVariables>;

interface BoardTicketRef {
  ...
  (dc: DataConnect, vars: BoardTicketVariables): MutationRef<BoardTicketData, BoardTicketVariables>;
}
export const boardTicketRef: BoardTicketRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the boardTicketRef:
```typescript
const name = boardTicketRef.operationName;
console.log(name);
```

### Variables
The `BoardTicket` mutation requires an argument of type `BoardTicketVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface BoardTicketVariables {
  passengerId: UUIDString;
}
```
### Return Type
Recall that executing the `BoardTicket` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `BoardTicketData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface BoardTicketData {
  query?: {
    bookingPassengers: ({
      id: UUIDString;
    } & BookingPassenger_Key)[];
  };
  bookingPassenger_update?: BookingPassenger_Key | null;
  boardingEvent_insert: BoardingEvent_Key;
}
```
### Using `BoardTicket`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, boardTicket, BoardTicketVariables } from '@barkolink/dataconnect-staff';

// The `BoardTicket` mutation requires an argument of type `BoardTicketVariables`:
const boardTicketVars: BoardTicketVariables = {
  passengerId: ..., 
};

// Call the `boardTicket()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await boardTicket(boardTicketVars);
// Variables can be defined inline as well.
const { data } = await boardTicket({ passengerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await boardTicket(dataConnect, boardTicketVars);

console.log(data.query);
console.log(data.bookingPassenger_update);
console.log(data.boardingEvent_insert);

// Or, you can use the `Promise` API.
boardTicket(boardTicketVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.bookingPassenger_update);
  console.log(data.boardingEvent_insert);
});
```

### Using `BoardTicket`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, boardTicketRef, BoardTicketVariables } from '@barkolink/dataconnect-staff';

// The `BoardTicket` mutation requires an argument of type `BoardTicketVariables`:
const boardTicketVars: BoardTicketVariables = {
  passengerId: ..., 
};

// Call the `boardTicketRef()` function to get a reference to the mutation.
const ref = boardTicketRef(boardTicketVars);
// Variables can be defined inline as well.
const ref = boardTicketRef({ passengerId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = boardTicketRef(dataConnect, boardTicketVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.bookingPassenger_update);
console.log(data.boardingEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.bookingPassenger_update);
  console.log(data.boardingEvent_insert);
});
```

## AdminCreatePort
You can execute the `AdminCreatePort` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminCreatePort(vars: AdminCreatePortVariables): MutationPromise<AdminCreatePortData, AdminCreatePortVariables>;

interface AdminCreatePortRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCreatePortVariables): MutationRef<AdminCreatePortData, AdminCreatePortVariables>;
}
export const adminCreatePortRef: AdminCreatePortRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminCreatePort(dc: DataConnect, vars: AdminCreatePortVariables): MutationPromise<AdminCreatePortData, AdminCreatePortVariables>;

interface AdminCreatePortRef {
  ...
  (dc: DataConnect, vars: AdminCreatePortVariables): MutationRef<AdminCreatePortData, AdminCreatePortVariables>;
}
export const adminCreatePortRef: AdminCreatePortRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminCreatePortRef:
```typescript
const name = adminCreatePortRef.operationName;
console.log(name);
```

### Variables
The `AdminCreatePort` mutation requires an argument of type `AdminCreatePortVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminCreatePortVariables {
  code: string;
  name: string;
  city: string;
  region?: string | null;
}
```
### Return Type
Recall that executing the `AdminCreatePort` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminCreatePortData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminCreatePortData {
  port_insert: Port_Key;
}
```
### Using `AdminCreatePort`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminCreatePort, AdminCreatePortVariables } from '@barkolink/dataconnect-staff';

// The `AdminCreatePort` mutation requires an argument of type `AdminCreatePortVariables`:
const adminCreatePortVars: AdminCreatePortVariables = {
  code: ..., 
  name: ..., 
  city: ..., 
  region: ..., // optional
};

// Call the `adminCreatePort()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminCreatePort(adminCreatePortVars);
// Variables can be defined inline as well.
const { data } = await adminCreatePort({ code: ..., name: ..., city: ..., region: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminCreatePort(dataConnect, adminCreatePortVars);

console.log(data.port_insert);

// Or, you can use the `Promise` API.
adminCreatePort(adminCreatePortVars).then((response) => {
  const data = response.data;
  console.log(data.port_insert);
});
```

### Using `AdminCreatePort`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminCreatePortRef, AdminCreatePortVariables } from '@barkolink/dataconnect-staff';

// The `AdminCreatePort` mutation requires an argument of type `AdminCreatePortVariables`:
const adminCreatePortVars: AdminCreatePortVariables = {
  code: ..., 
  name: ..., 
  city: ..., 
  region: ..., // optional
};

// Call the `adminCreatePortRef()` function to get a reference to the mutation.
const ref = adminCreatePortRef(adminCreatePortVars);
// Variables can be defined inline as well.
const ref = adminCreatePortRef({ code: ..., name: ..., city: ..., region: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminCreatePortRef(dataConnect, adminCreatePortVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.port_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.port_insert);
});
```

## AdminUpdatePort
You can execute the `AdminUpdatePort` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminUpdatePort(vars: AdminUpdatePortVariables): MutationPromise<AdminUpdatePortData, AdminUpdatePortVariables>;

interface AdminUpdatePortRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdatePortVariables): MutationRef<AdminUpdatePortData, AdminUpdatePortVariables>;
}
export const adminUpdatePortRef: AdminUpdatePortRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminUpdatePort(dc: DataConnect, vars: AdminUpdatePortVariables): MutationPromise<AdminUpdatePortData, AdminUpdatePortVariables>;

interface AdminUpdatePortRef {
  ...
  (dc: DataConnect, vars: AdminUpdatePortVariables): MutationRef<AdminUpdatePortData, AdminUpdatePortVariables>;
}
export const adminUpdatePortRef: AdminUpdatePortRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminUpdatePortRef:
```typescript
const name = adminUpdatePortRef.operationName;
console.log(name);
```

### Variables
The `AdminUpdatePort` mutation requires an argument of type `AdminUpdatePortVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminUpdatePortVariables {
  id: UUIDString;
  name: string;
  city: string;
  region?: string | null;
  isActive: boolean;
}
```
### Return Type
Recall that executing the `AdminUpdatePort` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminUpdatePortData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminUpdatePortData {
  port_update?: Port_Key | null;
}
```
### Using `AdminUpdatePort`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminUpdatePort, AdminUpdatePortVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdatePort` mutation requires an argument of type `AdminUpdatePortVariables`:
const adminUpdatePortVars: AdminUpdatePortVariables = {
  id: ..., 
  name: ..., 
  city: ..., 
  region: ..., // optional
  isActive: ..., 
};

// Call the `adminUpdatePort()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminUpdatePort(adminUpdatePortVars);
// Variables can be defined inline as well.
const { data } = await adminUpdatePort({ id: ..., name: ..., city: ..., region: ..., isActive: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminUpdatePort(dataConnect, adminUpdatePortVars);

console.log(data.port_update);

// Or, you can use the `Promise` API.
adminUpdatePort(adminUpdatePortVars).then((response) => {
  const data = response.data;
  console.log(data.port_update);
});
```

### Using `AdminUpdatePort`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminUpdatePortRef, AdminUpdatePortVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdatePort` mutation requires an argument of type `AdminUpdatePortVariables`:
const adminUpdatePortVars: AdminUpdatePortVariables = {
  id: ..., 
  name: ..., 
  city: ..., 
  region: ..., // optional
  isActive: ..., 
};

// Call the `adminUpdatePortRef()` function to get a reference to the mutation.
const ref = adminUpdatePortRef(adminUpdatePortVars);
// Variables can be defined inline as well.
const ref = adminUpdatePortRef({ id: ..., name: ..., city: ..., region: ..., isActive: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminUpdatePortRef(dataConnect, adminUpdatePortVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.port_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.port_update);
});
```

## AdminCreateVessel
You can execute the `AdminCreateVessel` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminCreateVessel(vars: AdminCreateVesselVariables): MutationPromise<AdminCreateVesselData, AdminCreateVesselVariables>;

interface AdminCreateVesselRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCreateVesselVariables): MutationRef<AdminCreateVesselData, AdminCreateVesselVariables>;
}
export const adminCreateVesselRef: AdminCreateVesselRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminCreateVessel(dc: DataConnect, vars: AdminCreateVesselVariables): MutationPromise<AdminCreateVesselData, AdminCreateVesselVariables>;

interface AdminCreateVesselRef {
  ...
  (dc: DataConnect, vars: AdminCreateVesselVariables): MutationRef<AdminCreateVesselData, AdminCreateVesselVariables>;
}
export const adminCreateVesselRef: AdminCreateVesselRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminCreateVesselRef:
```typescript
const name = adminCreateVesselRef.operationName;
console.log(name);
```

### Variables
The `AdminCreateVessel` mutation requires an argument of type `AdminCreateVesselVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminCreateVesselVariables {
  code: string;
  name: string;
  capacity: number;
}
```
### Return Type
Recall that executing the `AdminCreateVessel` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminCreateVesselData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminCreateVesselData {
  vessel_insert: Vessel_Key;
}
```
### Using `AdminCreateVessel`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminCreateVessel, AdminCreateVesselVariables } from '@barkolink/dataconnect-staff';

// The `AdminCreateVessel` mutation requires an argument of type `AdminCreateVesselVariables`:
const adminCreateVesselVars: AdminCreateVesselVariables = {
  code: ..., 
  name: ..., 
  capacity: ..., 
};

// Call the `adminCreateVessel()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminCreateVessel(adminCreateVesselVars);
// Variables can be defined inline as well.
const { data } = await adminCreateVessel({ code: ..., name: ..., capacity: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminCreateVessel(dataConnect, adminCreateVesselVars);

console.log(data.vessel_insert);

// Or, you can use the `Promise` API.
adminCreateVessel(adminCreateVesselVars).then((response) => {
  const data = response.data;
  console.log(data.vessel_insert);
});
```

### Using `AdminCreateVessel`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminCreateVesselRef, AdminCreateVesselVariables } from '@barkolink/dataconnect-staff';

// The `AdminCreateVessel` mutation requires an argument of type `AdminCreateVesselVariables`:
const adminCreateVesselVars: AdminCreateVesselVariables = {
  code: ..., 
  name: ..., 
  capacity: ..., 
};

// Call the `adminCreateVesselRef()` function to get a reference to the mutation.
const ref = adminCreateVesselRef(adminCreateVesselVars);
// Variables can be defined inline as well.
const ref = adminCreateVesselRef({ code: ..., name: ..., capacity: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminCreateVesselRef(dataConnect, adminCreateVesselVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vessel_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vessel_insert);
});
```

## AdminUpdateVessel
You can execute the `AdminUpdateVessel` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminUpdateVessel(vars: AdminUpdateVesselVariables): MutationPromise<AdminUpdateVesselData, AdminUpdateVesselVariables>;

interface AdminUpdateVesselRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdateVesselVariables): MutationRef<AdminUpdateVesselData, AdminUpdateVesselVariables>;
}
export const adminUpdateVesselRef: AdminUpdateVesselRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminUpdateVessel(dc: DataConnect, vars: AdminUpdateVesselVariables): MutationPromise<AdminUpdateVesselData, AdminUpdateVesselVariables>;

interface AdminUpdateVesselRef {
  ...
  (dc: DataConnect, vars: AdminUpdateVesselVariables): MutationRef<AdminUpdateVesselData, AdminUpdateVesselVariables>;
}
export const adminUpdateVesselRef: AdminUpdateVesselRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminUpdateVesselRef:
```typescript
const name = adminUpdateVesselRef.operationName;
console.log(name);
```

### Variables
The `AdminUpdateVessel` mutation requires an argument of type `AdminUpdateVesselVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminUpdateVesselVariables {
  id: UUIDString;
  name: string;
  capacity: number;
  isActive: boolean;
}
```
### Return Type
Recall that executing the `AdminUpdateVessel` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminUpdateVesselData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminUpdateVesselData {
  vessel_update?: Vessel_Key | null;
}
```
### Using `AdminUpdateVessel`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminUpdateVessel, AdminUpdateVesselVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdateVessel` mutation requires an argument of type `AdminUpdateVesselVariables`:
const adminUpdateVesselVars: AdminUpdateVesselVariables = {
  id: ..., 
  name: ..., 
  capacity: ..., 
  isActive: ..., 
};

// Call the `adminUpdateVessel()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminUpdateVessel(adminUpdateVesselVars);
// Variables can be defined inline as well.
const { data } = await adminUpdateVessel({ id: ..., name: ..., capacity: ..., isActive: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminUpdateVessel(dataConnect, adminUpdateVesselVars);

console.log(data.vessel_update);

// Or, you can use the `Promise` API.
adminUpdateVessel(adminUpdateVesselVars).then((response) => {
  const data = response.data;
  console.log(data.vessel_update);
});
```

### Using `AdminUpdateVessel`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminUpdateVesselRef, AdminUpdateVesselVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdateVessel` mutation requires an argument of type `AdminUpdateVesselVariables`:
const adminUpdateVesselVars: AdminUpdateVesselVariables = {
  id: ..., 
  name: ..., 
  capacity: ..., 
  isActive: ..., 
};

// Call the `adminUpdateVesselRef()` function to get a reference to the mutation.
const ref = adminUpdateVesselRef(adminUpdateVesselVars);
// Variables can be defined inline as well.
const ref = adminUpdateVesselRef({ id: ..., name: ..., capacity: ..., isActive: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminUpdateVesselRef(dataConnect, adminUpdateVesselVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vessel_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vessel_update);
});
```

## AdminCreateSailing
You can execute the `AdminCreateSailing` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminCreateSailing(vars: AdminCreateSailingVariables): MutationPromise<AdminCreateSailingData, AdminCreateSailingVariables>;

interface AdminCreateSailingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCreateSailingVariables): MutationRef<AdminCreateSailingData, AdminCreateSailingVariables>;
}
export const adminCreateSailingRef: AdminCreateSailingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminCreateSailing(dc: DataConnect, vars: AdminCreateSailingVariables): MutationPromise<AdminCreateSailingData, AdminCreateSailingVariables>;

interface AdminCreateSailingRef {
  ...
  (dc: DataConnect, vars: AdminCreateSailingVariables): MutationRef<AdminCreateSailingData, AdminCreateSailingVariables>;
}
export const adminCreateSailingRef: AdminCreateSailingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminCreateSailingRef:
```typescript
const name = adminCreateSailingRef.operationName;
console.log(name);
```

### Variables
The `AdminCreateSailing` mutation requires an argument of type `AdminCreateSailingVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `AdminCreateSailing` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminCreateSailingData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminCreateSailing`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminCreateSailing, AdminCreateSailingVariables } from '@barkolink/dataconnect-staff';

// The `AdminCreateSailing` mutation requires an argument of type `AdminCreateSailingVariables`:
const adminCreateSailingVars: AdminCreateSailingVariables = {
  code: ..., 
  originPortId: ..., 
  destinationPortId: ..., 
  vesselId: ..., 
  departureAt: ..., 
  arrivalAt: ..., 
  durationMinutes: ..., 
  regularFare: ..., 
  studentFare: ..., 
  seniorFare: ..., 
  childFare: ..., 
  pwdFare: ..., 
};

// Call the `adminCreateSailing()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminCreateSailing(adminCreateSailingVars);
// Variables can be defined inline as well.
const { data } = await adminCreateSailing({ code: ..., originPortId: ..., destinationPortId: ..., vesselId: ..., departureAt: ..., arrivalAt: ..., durationMinutes: ..., regularFare: ..., studentFare: ..., seniorFare: ..., childFare: ..., pwdFare: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminCreateSailing(dataConnect, adminCreateSailingVars);

console.log(data.codeLock);
console.log(data.query);
console.log(data.sailing_insert);

// Or, you can use the `Promise` API.
adminCreateSailing(adminCreateSailingVars).then((response) => {
  const data = response.data;
  console.log(data.codeLock);
  console.log(data.query);
  console.log(data.sailing_insert);
});
```

### Using `AdminCreateSailing`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminCreateSailingRef, AdminCreateSailingVariables } from '@barkolink/dataconnect-staff';

// The `AdminCreateSailing` mutation requires an argument of type `AdminCreateSailingVariables`:
const adminCreateSailingVars: AdminCreateSailingVariables = {
  code: ..., 
  originPortId: ..., 
  destinationPortId: ..., 
  vesselId: ..., 
  departureAt: ..., 
  arrivalAt: ..., 
  durationMinutes: ..., 
  regularFare: ..., 
  studentFare: ..., 
  seniorFare: ..., 
  childFare: ..., 
  pwdFare: ..., 
};

// Call the `adminCreateSailingRef()` function to get a reference to the mutation.
const ref = adminCreateSailingRef(adminCreateSailingVars);
// Variables can be defined inline as well.
const ref = adminCreateSailingRef({ code: ..., originPortId: ..., destinationPortId: ..., vesselId: ..., departureAt: ..., arrivalAt: ..., durationMinutes: ..., regularFare: ..., studentFare: ..., seniorFare: ..., childFare: ..., pwdFare: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminCreateSailingRef(dataConnect, adminCreateSailingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.codeLock);
console.log(data.query);
console.log(data.sailing_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.codeLock);
  console.log(data.query);
  console.log(data.sailing_insert);
});
```

## AdminUpdateSailingStatus
You can execute the `AdminUpdateSailingStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminUpdateSailingStatus(vars: AdminUpdateSailingStatusVariables): MutationPromise<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;

interface AdminUpdateSailingStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdateSailingStatusVariables): MutationRef<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;
}
export const adminUpdateSailingStatusRef: AdminUpdateSailingStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminUpdateSailingStatus(dc: DataConnect, vars: AdminUpdateSailingStatusVariables): MutationPromise<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;

interface AdminUpdateSailingStatusRef {
  ...
  (dc: DataConnect, vars: AdminUpdateSailingStatusVariables): MutationRef<AdminUpdateSailingStatusData, AdminUpdateSailingStatusVariables>;
}
export const adminUpdateSailingStatusRef: AdminUpdateSailingStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminUpdateSailingStatusRef:
```typescript
const name = adminUpdateSailingStatusRef.operationName;
console.log(name);
```

### Variables
The `AdminUpdateSailingStatus` mutation requires an argument of type `AdminUpdateSailingStatusVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminUpdateSailingStatusVariables {
  code: string;
  status: string;
}
```
### Return Type
Recall that executing the `AdminUpdateSailingStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminUpdateSailingStatusData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminUpdateSailingStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminUpdateSailingStatus, AdminUpdateSailingStatusVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdateSailingStatus` mutation requires an argument of type `AdminUpdateSailingStatusVariables`:
const adminUpdateSailingStatusVars: AdminUpdateSailingStatusVariables = {
  code: ..., 
  status: ..., 
};

// Call the `adminUpdateSailingStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminUpdateSailingStatus(adminUpdateSailingStatusVars);
// Variables can be defined inline as well.
const { data } = await adminUpdateSailingStatus({ code: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminUpdateSailingStatus(dataConnect, adminUpdateSailingStatusVars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.notified);

// Or, you can use the `Promise` API.
adminUpdateSailingStatus(adminUpdateSailingStatusVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.notified);
});
```

### Using `AdminUpdateSailingStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminUpdateSailingStatusRef, AdminUpdateSailingStatusVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdateSailingStatus` mutation requires an argument of type `AdminUpdateSailingStatusVariables`:
const adminUpdateSailingStatusVars: AdminUpdateSailingStatusVariables = {
  code: ..., 
  status: ..., 
};

// Call the `adminUpdateSailingStatusRef()` function to get a reference to the mutation.
const ref = adminUpdateSailingStatusRef(adminUpdateSailingStatusVars);
// Variables can be defined inline as well.
const ref = adminUpdateSailingStatusRef({ code: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminUpdateSailingStatusRef(dataConnect, adminUpdateSailingStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.notified);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.notified);
});
```

## AdminUpdateUnbookedSailing
You can execute the `AdminUpdateUnbookedSailing` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminUpdateUnbookedSailing(vars: AdminUpdateUnbookedSailingVariables): MutationPromise<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;

interface AdminUpdateUnbookedSailingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminUpdateUnbookedSailingVariables): MutationRef<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;
}
export const adminUpdateUnbookedSailingRef: AdminUpdateUnbookedSailingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminUpdateUnbookedSailing(dc: DataConnect, vars: AdminUpdateUnbookedSailingVariables): MutationPromise<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;

interface AdminUpdateUnbookedSailingRef {
  ...
  (dc: DataConnect, vars: AdminUpdateUnbookedSailingVariables): MutationRef<AdminUpdateUnbookedSailingData, AdminUpdateUnbookedSailingVariables>;
}
export const adminUpdateUnbookedSailingRef: AdminUpdateUnbookedSailingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminUpdateUnbookedSailingRef:
```typescript
const name = adminUpdateUnbookedSailingRef.operationName;
console.log(name);
```

### Variables
The `AdminUpdateUnbookedSailing` mutation requires an argument of type `AdminUpdateUnbookedSailingVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `AdminUpdateUnbookedSailing` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminUpdateUnbookedSailingData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminUpdateUnbookedSailing`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminUpdateUnbookedSailing, AdminUpdateUnbookedSailingVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdateUnbookedSailing` mutation requires an argument of type `AdminUpdateUnbookedSailingVariables`:
const adminUpdateUnbookedSailingVars: AdminUpdateUnbookedSailingVariables = {
  code: ..., 
  originPortId: ..., 
  destinationPortId: ..., 
  vesselId: ..., 
  departureAt: ..., 
  arrivalAt: ..., 
  durationMinutes: ..., 
  regularFare: ..., 
  studentFare: ..., 
  seniorFare: ..., 
  childFare: ..., 
  pwdFare: ..., 
};

// Call the `adminUpdateUnbookedSailing()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminUpdateUnbookedSailing(adminUpdateUnbookedSailingVars);
// Variables can be defined inline as well.
const { data } = await adminUpdateUnbookedSailing({ code: ..., originPortId: ..., destinationPortId: ..., vesselId: ..., departureAt: ..., arrivalAt: ..., durationMinutes: ..., regularFare: ..., studentFare: ..., seniorFare: ..., childFare: ..., pwdFare: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminUpdateUnbookedSailing(dataConnect, adminUpdateUnbookedSailingVars);

console.log(data.query);
console.log(data.sailing_update);

// Or, you can use the `Promise` API.
adminUpdateUnbookedSailing(adminUpdateUnbookedSailingVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
});
```

### Using `AdminUpdateUnbookedSailing`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminUpdateUnbookedSailingRef, AdminUpdateUnbookedSailingVariables } from '@barkolink/dataconnect-staff';

// The `AdminUpdateUnbookedSailing` mutation requires an argument of type `AdminUpdateUnbookedSailingVariables`:
const adminUpdateUnbookedSailingVars: AdminUpdateUnbookedSailingVariables = {
  code: ..., 
  originPortId: ..., 
  destinationPortId: ..., 
  vesselId: ..., 
  departureAt: ..., 
  arrivalAt: ..., 
  durationMinutes: ..., 
  regularFare: ..., 
  studentFare: ..., 
  seniorFare: ..., 
  childFare: ..., 
  pwdFare: ..., 
};

// Call the `adminUpdateUnbookedSailingRef()` function to get a reference to the mutation.
const ref = adminUpdateUnbookedSailingRef(adminUpdateUnbookedSailingVars);
// Variables can be defined inline as well.
const ref = adminUpdateUnbookedSailingRef({ code: ..., originPortId: ..., destinationPortId: ..., vesselId: ..., departureAt: ..., arrivalAt: ..., durationMinutes: ..., regularFare: ..., studentFare: ..., seniorFare: ..., childFare: ..., pwdFare: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminUpdateUnbookedSailingRef(dataConnect, adminUpdateUnbookedSailingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
});
```

## AdminRescheduleSailing
You can execute the `AdminRescheduleSailing` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminRescheduleSailing(vars: AdminRescheduleSailingVariables): MutationPromise<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;

interface AdminRescheduleSailingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminRescheduleSailingVariables): MutationRef<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;
}
export const adminRescheduleSailingRef: AdminRescheduleSailingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminRescheduleSailing(dc: DataConnect, vars: AdminRescheduleSailingVariables): MutationPromise<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;

interface AdminRescheduleSailingRef {
  ...
  (dc: DataConnect, vars: AdminRescheduleSailingVariables): MutationRef<AdminRescheduleSailingData, AdminRescheduleSailingVariables>;
}
export const adminRescheduleSailingRef: AdminRescheduleSailingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminRescheduleSailingRef:
```typescript
const name = adminRescheduleSailingRef.operationName;
console.log(name);
```

### Variables
The `AdminRescheduleSailing` mutation requires an argument of type `AdminRescheduleSailingVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminRescheduleSailingVariables {
  code: string;
  departureAt: TimestampString;
  arrivalAt: TimestampString;
  durationMinutes: number;
}
```
### Return Type
Recall that executing the `AdminRescheduleSailing` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminRescheduleSailingData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminRescheduleSailing`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminRescheduleSailing, AdminRescheduleSailingVariables } from '@barkolink/dataconnect-staff';

// The `AdminRescheduleSailing` mutation requires an argument of type `AdminRescheduleSailingVariables`:
const adminRescheduleSailingVars: AdminRescheduleSailingVariables = {
  code: ..., 
  departureAt: ..., 
  arrivalAt: ..., 
  durationMinutes: ..., 
};

// Call the `adminRescheduleSailing()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminRescheduleSailing(adminRescheduleSailingVars);
// Variables can be defined inline as well.
const { data } = await adminRescheduleSailing({ code: ..., departureAt: ..., arrivalAt: ..., durationMinutes: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminRescheduleSailing(dataConnect, adminRescheduleSailingVars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.notified);

// Or, you can use the `Promise` API.
adminRescheduleSailing(adminRescheduleSailingVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.notified);
});
```

### Using `AdminRescheduleSailing`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminRescheduleSailingRef, AdminRescheduleSailingVariables } from '@barkolink/dataconnect-staff';

// The `AdminRescheduleSailing` mutation requires an argument of type `AdminRescheduleSailingVariables`:
const adminRescheduleSailingVars: AdminRescheduleSailingVariables = {
  code: ..., 
  departureAt: ..., 
  arrivalAt: ..., 
  durationMinutes: ..., 
};

// Call the `adminRescheduleSailingRef()` function to get a reference to the mutation.
const ref = adminRescheduleSailingRef(adminRescheduleSailingVars);
// Variables can be defined inline as well.
const ref = adminRescheduleSailingRef({ code: ..., departureAt: ..., arrivalAt: ..., durationMinutes: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminRescheduleSailingRef(dataConnect, adminRescheduleSailingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.notified);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.notified);
});
```

## AdminCancelBooking
You can execute the `AdminCancelBooking` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [staff/index.d.ts](./index.d.ts):
```typescript
adminCancelBooking(vars: AdminCancelBookingVariables): MutationPromise<AdminCancelBookingData, AdminCancelBookingVariables>;

interface AdminCancelBookingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminCancelBookingVariables): MutationRef<AdminCancelBookingData, AdminCancelBookingVariables>;
}
export const adminCancelBookingRef: AdminCancelBookingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminCancelBooking(dc: DataConnect, vars: AdminCancelBookingVariables): MutationPromise<AdminCancelBookingData, AdminCancelBookingVariables>;

interface AdminCancelBookingRef {
  ...
  (dc: DataConnect, vars: AdminCancelBookingVariables): MutationRef<AdminCancelBookingData, AdminCancelBookingVariables>;
}
export const adminCancelBookingRef: AdminCancelBookingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminCancelBookingRef:
```typescript
const name = adminCancelBookingRef.operationName;
console.log(name);
```

### Variables
The `AdminCancelBooking` mutation requires an argument of type `AdminCancelBookingVariables`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminCancelBookingVariables {
  bookingId: UUIDString;
  sailingCode: string;
  passengerCount: number;
}
```
### Return Type
Recall that executing the `AdminCancelBooking` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminCancelBookingData`, which is defined in [staff/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminCancelBooking`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminCancelBooking, AdminCancelBookingVariables } from '@barkolink/dataconnect-staff';

// The `AdminCancelBooking` mutation requires an argument of type `AdminCancelBookingVariables`:
const adminCancelBookingVars: AdminCancelBookingVariables = {
  bookingId: ..., 
  sailingCode: ..., 
  passengerCount: ..., 
};

// Call the `adminCancelBooking()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminCancelBooking(adminCancelBookingVars);
// Variables can be defined inline as well.
const { data } = await adminCancelBooking({ bookingId: ..., sailingCode: ..., passengerCount: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminCancelBooking(dataConnect, adminCancelBookingVars);

console.log(data.query);
console.log(data.booking_update);
console.log(data.sailing_update);

// Or, you can use the `Promise` API.
adminCancelBooking(adminCancelBookingVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.booking_update);
  console.log(data.sailing_update);
});
```

### Using `AdminCancelBooking`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminCancelBookingRef, AdminCancelBookingVariables } from '@barkolink/dataconnect-staff';

// The `AdminCancelBooking` mutation requires an argument of type `AdminCancelBookingVariables`:
const adminCancelBookingVars: AdminCancelBookingVariables = {
  bookingId: ..., 
  sailingCode: ..., 
  passengerCount: ..., 
};

// Call the `adminCancelBookingRef()` function to get a reference to the mutation.
const ref = adminCancelBookingRef(adminCancelBookingVars);
// Variables can be defined inline as well.
const ref = adminCancelBookingRef({ bookingId: ..., sailingCode: ..., passengerCount: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminCancelBookingRef(dataConnect, adminCancelBookingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.booking_update);
console.log(data.sailing_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.booking_update);
  console.log(data.sailing_update);
});
```

