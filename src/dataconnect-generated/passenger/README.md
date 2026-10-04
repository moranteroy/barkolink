# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `passenger`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*BrowseActivePorts*](#browseactiveports)
  - [*BrowseSailings*](#browsesailings)
  - [*MyProfile*](#myprofile)
  - [*MyBookings*](#mybookings)
  - [*MyNotifications*](#mynotifications)
  - [*MyTickets*](#mytickets)
- [**Mutations**](#mutations)
  - [*CreateMyProfile*](#createmyprofile)
  - [*UpdateMyProfile*](#updatemyprofile)
  - [*ReserveSailing1*](#reservesailing1)
  - [*ReserveSailing2*](#reservesailing2)
  - [*ReserveSailing3*](#reservesailing3)
  - [*ReserveSailing4*](#reservesailing4)
  - [*ReserveSailing5*](#reservesailing5)
  - [*ReserveSailing6*](#reservesailing6)
  - [*ReserveSailing7*](#reservesailing7)
  - [*ReserveSailing8*](#reservesailing8)
  - [*CancelMyBooking*](#cancelmybooking)
  - [*MarkNotificationRead*](#marknotificationread)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `passenger`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@barkolink/dataconnect-passenger` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@barkolink/dataconnect-passenger';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@barkolink/dataconnect-passenger';

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

Below are examples of how to use the `passenger` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## BrowseActivePorts
You can execute the `BrowseActivePorts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
browseActivePorts(options?: ExecuteQueryOptions): QueryPromise<BrowseActivePortsData, undefined>;

interface BrowseActivePortsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<BrowseActivePortsData, undefined>;
}
export const browseActivePortsRef: BrowseActivePortsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
browseActivePorts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<BrowseActivePortsData, undefined>;

interface BrowseActivePortsRef {
  ...
  (dc: DataConnect): QueryRef<BrowseActivePortsData, undefined>;
}
export const browseActivePortsRef: BrowseActivePortsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the browseActivePortsRef:
```typescript
const name = browseActivePortsRef.operationName;
console.log(name);
```

### Variables
The `BrowseActivePorts` query has no variables.
### Return Type
Recall that executing the `BrowseActivePorts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `BrowseActivePortsData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface BrowseActivePortsData {
  ports: ({
    id: UUIDString;
    code: string;
    name: string;
    city: string;
  } & Port_Key)[];
}
```
### Using `BrowseActivePorts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, browseActivePorts } from '@barkolink/dataconnect-passenger';


// Call the `browseActivePorts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await browseActivePorts();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await browseActivePorts(dataConnect);

console.log(data.ports);

// Or, you can use the `Promise` API.
browseActivePorts().then((response) => {
  const data = response.data;
  console.log(data.ports);
});
```

### Using `BrowseActivePorts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, browseActivePortsRef } from '@barkolink/dataconnect-passenger';


// Call the `browseActivePortsRef()` function to get a reference to the query.
const ref = browseActivePortsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = browseActivePortsRef(dataConnect);

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

## BrowseSailings
You can execute the `BrowseSailings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
browseSailings(options?: ExecuteQueryOptions): QueryPromise<BrowseSailingsData, undefined>;

interface BrowseSailingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<BrowseSailingsData, undefined>;
}
export const browseSailingsRef: BrowseSailingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
browseSailings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<BrowseSailingsData, undefined>;

interface BrowseSailingsRef {
  ...
  (dc: DataConnect): QueryRef<BrowseSailingsData, undefined>;
}
export const browseSailingsRef: BrowseSailingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the browseSailingsRef:
```typescript
const name = browseSailingsRef.operationName;
console.log(name);
```

### Variables
The `BrowseSailings` query has no variables.
### Return Type
Recall that executing the `BrowseSailings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `BrowseSailingsData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `BrowseSailings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, browseSailings } from '@barkolink/dataconnect-passenger';


// Call the `browseSailings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await browseSailings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await browseSailings(dataConnect);

console.log(data.sailings);

// Or, you can use the `Promise` API.
browseSailings().then((response) => {
  const data = response.data;
  console.log(data.sailings);
});
```

### Using `BrowseSailings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, browseSailingsRef } from '@barkolink/dataconnect-passenger';


// Call the `browseSailingsRef()` function to get a reference to the query.
const ref = browseSailingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = browseSailingsRef(dataConnect);

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

## MyProfile
You can execute the `MyProfile` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
myProfile(options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;

interface MyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyProfileData, undefined>;
}
export const myProfileRef: MyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;

interface MyProfileRef {
  ...
  (dc: DataConnect): QueryRef<MyProfileData, undefined>;
}
export const myProfileRef: MyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myProfileRef:
```typescript
const name = myProfileRef.operationName;
console.log(name);
```

### Variables
The `MyProfile` query has no variables.
### Return Type
Recall that executing the `MyProfile` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyProfileData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MyProfileData {
  user?: {
    uid: string;
    email: string;
    fullName: string;
    phone?: string | null;
    role: string;
  } & User_Key;
}
```
### Using `MyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myProfile } from '@barkolink/dataconnect-passenger';


// Call the `myProfile()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myProfile();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myProfile(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
myProfile().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `MyProfile`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myProfileRef } from '@barkolink/dataconnect-passenger';


// Call the `myProfileRef()` function to get a reference to the query.
const ref = myProfileRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myProfileRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## MyBookings
You can execute the `MyBookings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
myBookings(options?: ExecuteQueryOptions): QueryPromise<MyBookingsData, undefined>;

interface MyBookingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyBookingsData, undefined>;
}
export const myBookingsRef: MyBookingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myBookings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyBookingsData, undefined>;

interface MyBookingsRef {
  ...
  (dc: DataConnect): QueryRef<MyBookingsData, undefined>;
}
export const myBookingsRef: MyBookingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myBookingsRef:
```typescript
const name = myBookingsRef.operationName;
console.log(name);
```

### Variables
The `MyBookings` query has no variables.
### Return Type
Recall that executing the `MyBookings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyBookingsData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `MyBookings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myBookings } from '@barkolink/dataconnect-passenger';


// Call the `myBookings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myBookings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myBookings(dataConnect);

console.log(data.bookings);

// Or, you can use the `Promise` API.
myBookings().then((response) => {
  const data = response.data;
  console.log(data.bookings);
});
```

### Using `MyBookings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myBookingsRef } from '@barkolink/dataconnect-passenger';


// Call the `myBookingsRef()` function to get a reference to the query.
const ref = myBookingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myBookingsRef(dataConnect);

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

## MyNotifications
You can execute the `MyNotifications` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
myNotifications(options?: ExecuteQueryOptions): QueryPromise<MyNotificationsData, undefined>;

interface MyNotificationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyNotificationsData, undefined>;
}
export const myNotificationsRef: MyNotificationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myNotifications(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyNotificationsData, undefined>;

interface MyNotificationsRef {
  ...
  (dc: DataConnect): QueryRef<MyNotificationsData, undefined>;
}
export const myNotificationsRef: MyNotificationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myNotificationsRef:
```typescript
const name = myNotificationsRef.operationName;
console.log(name);
```

### Variables
The `MyNotifications` query has no variables.
### Return Type
Recall that executing the `MyNotifications` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyNotificationsData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `MyNotifications`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myNotifications } from '@barkolink/dataconnect-passenger';


// Call the `myNotifications()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myNotifications();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myNotifications(dataConnect);

console.log(data.notifications);

// Or, you can use the `Promise` API.
myNotifications().then((response) => {
  const data = response.data;
  console.log(data.notifications);
});
```

### Using `MyNotifications`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myNotificationsRef } from '@barkolink/dataconnect-passenger';


// Call the `myNotificationsRef()` function to get a reference to the query.
const ref = myNotificationsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myNotificationsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.notifications);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.notifications);
});
```

## MyTickets
You can execute the `MyTickets` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
myTickets(options?: ExecuteQueryOptions): QueryPromise<MyTicketsData, undefined>;

interface MyTicketsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyTicketsData, undefined>;
}
export const myTicketsRef: MyTicketsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myTickets(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyTicketsData, undefined>;

interface MyTicketsRef {
  ...
  (dc: DataConnect): QueryRef<MyTicketsData, undefined>;
}
export const myTicketsRef: MyTicketsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myTicketsRef:
```typescript
const name = myTicketsRef.operationName;
console.log(name);
```

### Variables
The `MyTickets` query has no variables.
### Return Type
Recall that executing the `MyTickets` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyTicketsData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `MyTickets`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myTickets } from '@barkolink/dataconnect-passenger';


// Call the `myTickets()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myTickets();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myTickets(dataConnect);

console.log(data.bookingPassengers);

// Or, you can use the `Promise` API.
myTickets().then((response) => {
  const data = response.data;
  console.log(data.bookingPassengers);
});
```

### Using `MyTickets`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myTicketsRef } from '@barkolink/dataconnect-passenger';


// Call the `myTicketsRef()` function to get a reference to the query.
const ref = myTicketsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myTicketsRef(dataConnect);

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

Below are examples of how to use the `passenger` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateMyProfile
You can execute the `CreateMyProfile` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
createMyProfile(vars: CreateMyProfileVariables): MutationPromise<CreateMyProfileData, CreateMyProfileVariables>;

interface CreateMyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMyProfileVariables): MutationRef<CreateMyProfileData, CreateMyProfileVariables>;
}
export const createMyProfileRef: CreateMyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createMyProfile(dc: DataConnect, vars: CreateMyProfileVariables): MutationPromise<CreateMyProfileData, CreateMyProfileVariables>;

interface CreateMyProfileRef {
  ...
  (dc: DataConnect, vars: CreateMyProfileVariables): MutationRef<CreateMyProfileData, CreateMyProfileVariables>;
}
export const createMyProfileRef: CreateMyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createMyProfileRef:
```typescript
const name = createMyProfileRef.operationName;
console.log(name);
```

### Variables
The `CreateMyProfile` mutation requires an argument of type `CreateMyProfileVariables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateMyProfileVariables {
  email: string;
  fullName: string;
  phone?: string | null;
}
```
### Return Type
Recall that executing the `CreateMyProfile` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateMyProfileData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateMyProfileData {
  user_insert: User_Key;
}
```
### Using `CreateMyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createMyProfile, CreateMyProfileVariables } from '@barkolink/dataconnect-passenger';

// The `CreateMyProfile` mutation requires an argument of type `CreateMyProfileVariables`:
const createMyProfileVars: CreateMyProfileVariables = {
  email: ..., 
  fullName: ..., 
  phone: ..., // optional
};

// Call the `createMyProfile()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createMyProfile(createMyProfileVars);
// Variables can be defined inline as well.
const { data } = await createMyProfile({ email: ..., fullName: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createMyProfile(dataConnect, createMyProfileVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createMyProfile(createMyProfileVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateMyProfile`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createMyProfileRef, CreateMyProfileVariables } from '@barkolink/dataconnect-passenger';

// The `CreateMyProfile` mutation requires an argument of type `CreateMyProfileVariables`:
const createMyProfileVars: CreateMyProfileVariables = {
  email: ..., 
  fullName: ..., 
  phone: ..., // optional
};

// Call the `createMyProfileRef()` function to get a reference to the mutation.
const ref = createMyProfileRef(createMyProfileVars);
// Variables can be defined inline as well.
const ref = createMyProfileRef({ email: ..., fullName: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createMyProfileRef(dataConnect, createMyProfileVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateMyProfile
You can execute the `UpdateMyProfile` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
updateMyProfile(vars: UpdateMyProfileVariables): MutationPromise<UpdateMyProfileData, UpdateMyProfileVariables>;

interface UpdateMyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyProfileVariables): MutationRef<UpdateMyProfileData, UpdateMyProfileVariables>;
}
export const updateMyProfileRef: UpdateMyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMyProfile(dc: DataConnect, vars: UpdateMyProfileVariables): MutationPromise<UpdateMyProfileData, UpdateMyProfileVariables>;

interface UpdateMyProfileRef {
  ...
  (dc: DataConnect, vars: UpdateMyProfileVariables): MutationRef<UpdateMyProfileData, UpdateMyProfileVariables>;
}
export const updateMyProfileRef: UpdateMyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMyProfileRef:
```typescript
const name = updateMyProfileRef.operationName;
console.log(name);
```

### Variables
The `UpdateMyProfile` mutation requires an argument of type `UpdateMyProfileVariables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMyProfileVariables {
  fullName: string;
  phone?: string | null;
}
```
### Return Type
Recall that executing the `UpdateMyProfile` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMyProfileData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMyProfileData {
  user_update?: User_Key | null;
}
```
### Using `UpdateMyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMyProfile, UpdateMyProfileVariables } from '@barkolink/dataconnect-passenger';

// The `UpdateMyProfile` mutation requires an argument of type `UpdateMyProfileVariables`:
const updateMyProfileVars: UpdateMyProfileVariables = {
  fullName: ..., 
  phone: ..., // optional
};

// Call the `updateMyProfile()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMyProfile(updateMyProfileVars);
// Variables can be defined inline as well.
const { data } = await updateMyProfile({ fullName: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMyProfile(dataConnect, updateMyProfileVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateMyProfile(updateMyProfileVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateMyProfile`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMyProfileRef, UpdateMyProfileVariables } from '@barkolink/dataconnect-passenger';

// The `UpdateMyProfile` mutation requires an argument of type `UpdateMyProfileVariables`:
const updateMyProfileVars: UpdateMyProfileVariables = {
  fullName: ..., 
  phone: ..., // optional
};

// Call the `updateMyProfileRef()` function to get a reference to the mutation.
const ref = updateMyProfileRef(updateMyProfileVars);
// Variables can be defined inline as well.
const ref = updateMyProfileRef({ fullName: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMyProfileRef(dataConnect, updateMyProfileVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## ReserveSailing1
You can execute the `ReserveSailing1` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing1(vars: ReserveSailing1Variables): MutationPromise<ReserveSailing1Data, ReserveSailing1Variables>;

interface ReserveSailing1Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing1Variables): MutationRef<ReserveSailing1Data, ReserveSailing1Variables>;
}
export const reserveSailing1Ref: ReserveSailing1Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing1(dc: DataConnect, vars: ReserveSailing1Variables): MutationPromise<ReserveSailing1Data, ReserveSailing1Variables>;

interface ReserveSailing1Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing1Variables): MutationRef<ReserveSailing1Data, ReserveSailing1Variables>;
}
export const reserveSailing1Ref: ReserveSailing1Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing1Ref:
```typescript
const name = reserveSailing1Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing1` mutation requires an argument of type `ReserveSailing1Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing1` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing1Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing1`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing1, ReserveSailing1Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing1` mutation requires an argument of type `ReserveSailing1Variables`:
const reserveSailing1Vars: ReserveSailing1Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
};

// Call the `reserveSailing1()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing1(reserveSailing1Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing1({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing1(dataConnect, reserveSailing1Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);

// Or, you can use the `Promise` API.
reserveSailing1(reserveSailing1Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
});
```

### Using `ReserveSailing1`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing1Ref, ReserveSailing1Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing1` mutation requires an argument of type `ReserveSailing1Variables`:
const reserveSailing1Vars: ReserveSailing1Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
};

// Call the `reserveSailing1Ref()` function to get a reference to the mutation.
const ref = reserveSailing1Ref(reserveSailing1Vars);
// Variables can be defined inline as well.
const ref = reserveSailing1Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing1Ref(dataConnect, reserveSailing1Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
});
```

## ReserveSailing2
You can execute the `ReserveSailing2` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing2(vars: ReserveSailing2Variables): MutationPromise<ReserveSailing2Data, ReserveSailing2Variables>;

interface ReserveSailing2Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing2Variables): MutationRef<ReserveSailing2Data, ReserveSailing2Variables>;
}
export const reserveSailing2Ref: ReserveSailing2Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing2(dc: DataConnect, vars: ReserveSailing2Variables): MutationPromise<ReserveSailing2Data, ReserveSailing2Variables>;

interface ReserveSailing2Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing2Variables): MutationRef<ReserveSailing2Data, ReserveSailing2Variables>;
}
export const reserveSailing2Ref: ReserveSailing2Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing2Ref:
```typescript
const name = reserveSailing2Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing2` mutation requires an argument of type `ReserveSailing2Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing2` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing2Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing2`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing2, ReserveSailing2Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing2` mutation requires an argument of type `ReserveSailing2Variables`:
const reserveSailing2Vars: ReserveSailing2Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
};

// Call the `reserveSailing2()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing2(reserveSailing2Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing2({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing2(dataConnect, reserveSailing2Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);

// Or, you can use the `Promise` API.
reserveSailing2(reserveSailing2Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
});
```

### Using `ReserveSailing2`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing2Ref, ReserveSailing2Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing2` mutation requires an argument of type `ReserveSailing2Variables`:
const reserveSailing2Vars: ReserveSailing2Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
};

// Call the `reserveSailing2Ref()` function to get a reference to the mutation.
const ref = reserveSailing2Ref(reserveSailing2Vars);
// Variables can be defined inline as well.
const ref = reserveSailing2Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing2Ref(dataConnect, reserveSailing2Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
});
```

## ReserveSailing3
You can execute the `ReserveSailing3` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing3(vars: ReserveSailing3Variables): MutationPromise<ReserveSailing3Data, ReserveSailing3Variables>;

interface ReserveSailing3Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing3Variables): MutationRef<ReserveSailing3Data, ReserveSailing3Variables>;
}
export const reserveSailing3Ref: ReserveSailing3Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing3(dc: DataConnect, vars: ReserveSailing3Variables): MutationPromise<ReserveSailing3Data, ReserveSailing3Variables>;

interface ReserveSailing3Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing3Variables): MutationRef<ReserveSailing3Data, ReserveSailing3Variables>;
}
export const reserveSailing3Ref: ReserveSailing3Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing3Ref:
```typescript
const name = reserveSailing3Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing3` mutation requires an argument of type `ReserveSailing3Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing3` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing3Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing3`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing3, ReserveSailing3Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing3` mutation requires an argument of type `ReserveSailing3Variables`:
const reserveSailing3Vars: ReserveSailing3Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
};

// Call the `reserveSailing3()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing3(reserveSailing3Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing3({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing3(dataConnect, reserveSailing3Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);

// Or, you can use the `Promise` API.
reserveSailing3(reserveSailing3Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
});
```

### Using `ReserveSailing3`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing3Ref, ReserveSailing3Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing3` mutation requires an argument of type `ReserveSailing3Variables`:
const reserveSailing3Vars: ReserveSailing3Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
};

// Call the `reserveSailing3Ref()` function to get a reference to the mutation.
const ref = reserveSailing3Ref(reserveSailing3Vars);
// Variables can be defined inline as well.
const ref = reserveSailing3Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing3Ref(dataConnect, reserveSailing3Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
});
```

## ReserveSailing4
You can execute the `ReserveSailing4` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing4(vars: ReserveSailing4Variables): MutationPromise<ReserveSailing4Data, ReserveSailing4Variables>;

interface ReserveSailing4Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing4Variables): MutationRef<ReserveSailing4Data, ReserveSailing4Variables>;
}
export const reserveSailing4Ref: ReserveSailing4Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing4(dc: DataConnect, vars: ReserveSailing4Variables): MutationPromise<ReserveSailing4Data, ReserveSailing4Variables>;

interface ReserveSailing4Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing4Variables): MutationRef<ReserveSailing4Data, ReserveSailing4Variables>;
}
export const reserveSailing4Ref: ReserveSailing4Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing4Ref:
```typescript
const name = reserveSailing4Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing4` mutation requires an argument of type `ReserveSailing4Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing4` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing4Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing4`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing4, ReserveSailing4Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing4` mutation requires an argument of type `ReserveSailing4Variables`:
const reserveSailing4Vars: ReserveSailing4Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
};

// Call the `reserveSailing4()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing4(reserveSailing4Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing4({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing4(dataConnect, reserveSailing4Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);

// Or, you can use the `Promise` API.
reserveSailing4(reserveSailing4Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
});
```

### Using `ReserveSailing4`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing4Ref, ReserveSailing4Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing4` mutation requires an argument of type `ReserveSailing4Variables`:
const reserveSailing4Vars: ReserveSailing4Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
};

// Call the `reserveSailing4Ref()` function to get a reference to the mutation.
const ref = reserveSailing4Ref(reserveSailing4Vars);
// Variables can be defined inline as well.
const ref = reserveSailing4Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing4Ref(dataConnect, reserveSailing4Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
});
```

## ReserveSailing5
You can execute the `ReserveSailing5` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing5(vars: ReserveSailing5Variables): MutationPromise<ReserveSailing5Data, ReserveSailing5Variables>;

interface ReserveSailing5Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing5Variables): MutationRef<ReserveSailing5Data, ReserveSailing5Variables>;
}
export const reserveSailing5Ref: ReserveSailing5Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing5(dc: DataConnect, vars: ReserveSailing5Variables): MutationPromise<ReserveSailing5Data, ReserveSailing5Variables>;

interface ReserveSailing5Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing5Variables): MutationRef<ReserveSailing5Data, ReserveSailing5Variables>;
}
export const reserveSailing5Ref: ReserveSailing5Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing5Ref:
```typescript
const name = reserveSailing5Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing5` mutation requires an argument of type `ReserveSailing5Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing5` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing5Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing5`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing5, ReserveSailing5Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing5` mutation requires an argument of type `ReserveSailing5Variables`:
const reserveSailing5Vars: ReserveSailing5Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
};

// Call the `reserveSailing5()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing5(reserveSailing5Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing5({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing5(dataConnect, reserveSailing5Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);

// Or, you can use the `Promise` API.
reserveSailing5(reserveSailing5Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
});
```

### Using `ReserveSailing5`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing5Ref, ReserveSailing5Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing5` mutation requires an argument of type `ReserveSailing5Variables`:
const reserveSailing5Vars: ReserveSailing5Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
};

// Call the `reserveSailing5Ref()` function to get a reference to the mutation.
const ref = reserveSailing5Ref(reserveSailing5Vars);
// Variables can be defined inline as well.
const ref = reserveSailing5Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing5Ref(dataConnect, reserveSailing5Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
});
```

## ReserveSailing6
You can execute the `ReserveSailing6` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing6(vars: ReserveSailing6Variables): MutationPromise<ReserveSailing6Data, ReserveSailing6Variables>;

interface ReserveSailing6Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing6Variables): MutationRef<ReserveSailing6Data, ReserveSailing6Variables>;
}
export const reserveSailing6Ref: ReserveSailing6Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing6(dc: DataConnect, vars: ReserveSailing6Variables): MutationPromise<ReserveSailing6Data, ReserveSailing6Variables>;

interface ReserveSailing6Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing6Variables): MutationRef<ReserveSailing6Data, ReserveSailing6Variables>;
}
export const reserveSailing6Ref: ReserveSailing6Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing6Ref:
```typescript
const name = reserveSailing6Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing6` mutation requires an argument of type `ReserveSailing6Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing6` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing6Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing6`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing6, ReserveSailing6Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing6` mutation requires an argument of type `ReserveSailing6Variables`:
const reserveSailing6Vars: ReserveSailing6Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
  passenger6Name: ..., 
  passenger6Type: ..., 
  passenger6BirthDate: ..., // optional
  passenger6Sex: ..., // optional
  passenger6Phone: ..., // optional
  passenger6Nationality: ..., // optional
};

// Call the `reserveSailing6()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing6(reserveSailing6Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing6({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., passenger6Name: ..., passenger6Type: ..., passenger6BirthDate: ..., passenger6Sex: ..., passenger6Phone: ..., passenger6Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing6(dataConnect, reserveSailing6Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);
console.log(data.passenger6);

// Or, you can use the `Promise` API.
reserveSailing6(reserveSailing6Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
  console.log(data.passenger6);
});
```

### Using `ReserveSailing6`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing6Ref, ReserveSailing6Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing6` mutation requires an argument of type `ReserveSailing6Variables`:
const reserveSailing6Vars: ReserveSailing6Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
  passenger6Name: ..., 
  passenger6Type: ..., 
  passenger6BirthDate: ..., // optional
  passenger6Sex: ..., // optional
  passenger6Phone: ..., // optional
  passenger6Nationality: ..., // optional
};

// Call the `reserveSailing6Ref()` function to get a reference to the mutation.
const ref = reserveSailing6Ref(reserveSailing6Vars);
// Variables can be defined inline as well.
const ref = reserveSailing6Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., passenger6Name: ..., passenger6Type: ..., passenger6BirthDate: ..., passenger6Sex: ..., passenger6Phone: ..., passenger6Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing6Ref(dataConnect, reserveSailing6Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);
console.log(data.passenger6);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
  console.log(data.passenger6);
});
```

## ReserveSailing7
You can execute the `ReserveSailing7` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing7(vars: ReserveSailing7Variables): MutationPromise<ReserveSailing7Data, ReserveSailing7Variables>;

interface ReserveSailing7Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing7Variables): MutationRef<ReserveSailing7Data, ReserveSailing7Variables>;
}
export const reserveSailing7Ref: ReserveSailing7Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing7(dc: DataConnect, vars: ReserveSailing7Variables): MutationPromise<ReserveSailing7Data, ReserveSailing7Variables>;

interface ReserveSailing7Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing7Variables): MutationRef<ReserveSailing7Data, ReserveSailing7Variables>;
}
export const reserveSailing7Ref: ReserveSailing7Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing7Ref:
```typescript
const name = reserveSailing7Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing7` mutation requires an argument of type `ReserveSailing7Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing7` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing7Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing7`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing7, ReserveSailing7Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing7` mutation requires an argument of type `ReserveSailing7Variables`:
const reserveSailing7Vars: ReserveSailing7Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
  passenger6Name: ..., 
  passenger6Type: ..., 
  passenger6BirthDate: ..., // optional
  passenger6Sex: ..., // optional
  passenger6Phone: ..., // optional
  passenger6Nationality: ..., // optional
  passenger7Name: ..., 
  passenger7Type: ..., 
  passenger7BirthDate: ..., // optional
  passenger7Sex: ..., // optional
  passenger7Phone: ..., // optional
  passenger7Nationality: ..., // optional
};

// Call the `reserveSailing7()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing7(reserveSailing7Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing7({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., passenger6Name: ..., passenger6Type: ..., passenger6BirthDate: ..., passenger6Sex: ..., passenger6Phone: ..., passenger6Nationality: ..., passenger7Name: ..., passenger7Type: ..., passenger7BirthDate: ..., passenger7Sex: ..., passenger7Phone: ..., passenger7Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing7(dataConnect, reserveSailing7Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);
console.log(data.passenger6);
console.log(data.passenger7);

// Or, you can use the `Promise` API.
reserveSailing7(reserveSailing7Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
  console.log(data.passenger6);
  console.log(data.passenger7);
});
```

### Using `ReserveSailing7`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing7Ref, ReserveSailing7Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing7` mutation requires an argument of type `ReserveSailing7Variables`:
const reserveSailing7Vars: ReserveSailing7Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
  passenger6Name: ..., 
  passenger6Type: ..., 
  passenger6BirthDate: ..., // optional
  passenger6Sex: ..., // optional
  passenger6Phone: ..., // optional
  passenger6Nationality: ..., // optional
  passenger7Name: ..., 
  passenger7Type: ..., 
  passenger7BirthDate: ..., // optional
  passenger7Sex: ..., // optional
  passenger7Phone: ..., // optional
  passenger7Nationality: ..., // optional
};

// Call the `reserveSailing7Ref()` function to get a reference to the mutation.
const ref = reserveSailing7Ref(reserveSailing7Vars);
// Variables can be defined inline as well.
const ref = reserveSailing7Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., passenger6Name: ..., passenger6Type: ..., passenger6BirthDate: ..., passenger6Sex: ..., passenger6Phone: ..., passenger6Nationality: ..., passenger7Name: ..., passenger7Type: ..., passenger7BirthDate: ..., passenger7Sex: ..., passenger7Phone: ..., passenger7Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing7Ref(dataConnect, reserveSailing7Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);
console.log(data.passenger6);
console.log(data.passenger7);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
  console.log(data.passenger6);
  console.log(data.passenger7);
});
```

## ReserveSailing8
You can execute the `ReserveSailing8` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
reserveSailing8(vars: ReserveSailing8Variables): MutationPromise<ReserveSailing8Data, ReserveSailing8Variables>;

interface ReserveSailing8Ref {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveSailing8Variables): MutationRef<ReserveSailing8Data, ReserveSailing8Variables>;
}
export const reserveSailing8Ref: ReserveSailing8Ref;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveSailing8(dc: DataConnect, vars: ReserveSailing8Variables): MutationPromise<ReserveSailing8Data, ReserveSailing8Variables>;

interface ReserveSailing8Ref {
  ...
  (dc: DataConnect, vars: ReserveSailing8Variables): MutationRef<ReserveSailing8Data, ReserveSailing8Variables>;
}
export const reserveSailing8Ref: ReserveSailing8Ref;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveSailing8Ref:
```typescript
const name = reserveSailing8Ref.operationName;
console.log(name);
```

### Variables
The `ReserveSailing8` mutation requires an argument of type `ReserveSailing8Variables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `ReserveSailing8` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveSailing8Data`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ReserveSailing8`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveSailing8, ReserveSailing8Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing8` mutation requires an argument of type `ReserveSailing8Variables`:
const reserveSailing8Vars: ReserveSailing8Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
  passenger6Name: ..., 
  passenger6Type: ..., 
  passenger6BirthDate: ..., // optional
  passenger6Sex: ..., // optional
  passenger6Phone: ..., // optional
  passenger6Nationality: ..., // optional
  passenger7Name: ..., 
  passenger7Type: ..., 
  passenger7BirthDate: ..., // optional
  passenger7Sex: ..., // optional
  passenger7Phone: ..., // optional
  passenger7Nationality: ..., // optional
  passenger8Name: ..., 
  passenger8Type: ..., 
  passenger8BirthDate: ..., // optional
  passenger8Sex: ..., // optional
  passenger8Phone: ..., // optional
  passenger8Nationality: ..., // optional
};

// Call the `reserveSailing8()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveSailing8(reserveSailing8Vars);
// Variables can be defined inline as well.
const { data } = await reserveSailing8({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., passenger6Name: ..., passenger6Type: ..., passenger6BirthDate: ..., passenger6Sex: ..., passenger6Phone: ..., passenger6Nationality: ..., passenger7Name: ..., passenger7Type: ..., passenger7BirthDate: ..., passenger7Sex: ..., passenger7Phone: ..., passenger7Nationality: ..., passenger8Name: ..., passenger8Type: ..., passenger8BirthDate: ..., passenger8Sex: ..., passenger8Phone: ..., passenger8Nationality: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveSailing8(dataConnect, reserveSailing8Vars);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);
console.log(data.passenger6);
console.log(data.passenger7);
console.log(data.passenger8);

// Or, you can use the `Promise` API.
reserveSailing8(reserveSailing8Vars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
  console.log(data.passenger6);
  console.log(data.passenger7);
  console.log(data.passenger8);
});
```

### Using `ReserveSailing8`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveSailing8Ref, ReserveSailing8Variables } from '@barkolink/dataconnect-passenger';

// The `ReserveSailing8` mutation requires an argument of type `ReserveSailing8Variables`:
const reserveSailing8Vars: ReserveSailing8Variables = {
  sailingCode: ..., 
  reference: ..., 
  passenger1Name: ..., 
  passenger1Type: ..., 
  passenger1BirthDate: ..., // optional
  passenger1Sex: ..., // optional
  passenger1Phone: ..., // optional
  passenger1Nationality: ..., // optional
  passenger2Name: ..., 
  passenger2Type: ..., 
  passenger2BirthDate: ..., // optional
  passenger2Sex: ..., // optional
  passenger2Phone: ..., // optional
  passenger2Nationality: ..., // optional
  passenger3Name: ..., 
  passenger3Type: ..., 
  passenger3BirthDate: ..., // optional
  passenger3Sex: ..., // optional
  passenger3Phone: ..., // optional
  passenger3Nationality: ..., // optional
  passenger4Name: ..., 
  passenger4Type: ..., 
  passenger4BirthDate: ..., // optional
  passenger4Sex: ..., // optional
  passenger4Phone: ..., // optional
  passenger4Nationality: ..., // optional
  passenger5Name: ..., 
  passenger5Type: ..., 
  passenger5BirthDate: ..., // optional
  passenger5Sex: ..., // optional
  passenger5Phone: ..., // optional
  passenger5Nationality: ..., // optional
  passenger6Name: ..., 
  passenger6Type: ..., 
  passenger6BirthDate: ..., // optional
  passenger6Sex: ..., // optional
  passenger6Phone: ..., // optional
  passenger6Nationality: ..., // optional
  passenger7Name: ..., 
  passenger7Type: ..., 
  passenger7BirthDate: ..., // optional
  passenger7Sex: ..., // optional
  passenger7Phone: ..., // optional
  passenger7Nationality: ..., // optional
  passenger8Name: ..., 
  passenger8Type: ..., 
  passenger8BirthDate: ..., // optional
  passenger8Sex: ..., // optional
  passenger8Phone: ..., // optional
  passenger8Nationality: ..., // optional
};

// Call the `reserveSailing8Ref()` function to get a reference to the mutation.
const ref = reserveSailing8Ref(reserveSailing8Vars);
// Variables can be defined inline as well.
const ref = reserveSailing8Ref({ sailingCode: ..., reference: ..., passenger1Name: ..., passenger1Type: ..., passenger1BirthDate: ..., passenger1Sex: ..., passenger1Phone: ..., passenger1Nationality: ..., passenger2Name: ..., passenger2Type: ..., passenger2BirthDate: ..., passenger2Sex: ..., passenger2Phone: ..., passenger2Nationality: ..., passenger3Name: ..., passenger3Type: ..., passenger3BirthDate: ..., passenger3Sex: ..., passenger3Phone: ..., passenger3Nationality: ..., passenger4Name: ..., passenger4Type: ..., passenger4BirthDate: ..., passenger4Sex: ..., passenger4Phone: ..., passenger4Nationality: ..., passenger5Name: ..., passenger5Type: ..., passenger5BirthDate: ..., passenger5Sex: ..., passenger5Phone: ..., passenger5Nationality: ..., passenger6Name: ..., passenger6Type: ..., passenger6BirthDate: ..., passenger6Sex: ..., passenger6Phone: ..., passenger6Nationality: ..., passenger7Name: ..., passenger7Type: ..., passenger7BirthDate: ..., passenger7Sex: ..., passenger7Phone: ..., passenger7Nationality: ..., passenger8Name: ..., passenger8Type: ..., passenger8BirthDate: ..., passenger8Sex: ..., passenger8Phone: ..., passenger8Nationality: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveSailing8Ref(dataConnect, reserveSailing8Vars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.sailing_update);
console.log(data.booking_insert);
console.log(data.notification_insert);
console.log(data.passenger1);
console.log(data.passenger2);
console.log(data.passenger3);
console.log(data.passenger4);
console.log(data.passenger5);
console.log(data.passenger6);
console.log(data.passenger7);
console.log(data.passenger8);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.sailing_update);
  console.log(data.booking_insert);
  console.log(data.notification_insert);
  console.log(data.passenger1);
  console.log(data.passenger2);
  console.log(data.passenger3);
  console.log(data.passenger4);
  console.log(data.passenger5);
  console.log(data.passenger6);
  console.log(data.passenger7);
  console.log(data.passenger8);
});
```

## CancelMyBooking
You can execute the `CancelMyBooking` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
cancelMyBooking(vars: CancelMyBookingVariables): MutationPromise<CancelMyBookingData, CancelMyBookingVariables>;

interface CancelMyBookingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CancelMyBookingVariables): MutationRef<CancelMyBookingData, CancelMyBookingVariables>;
}
export const cancelMyBookingRef: CancelMyBookingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
cancelMyBooking(dc: DataConnect, vars: CancelMyBookingVariables): MutationPromise<CancelMyBookingData, CancelMyBookingVariables>;

interface CancelMyBookingRef {
  ...
  (dc: DataConnect, vars: CancelMyBookingVariables): MutationRef<CancelMyBookingData, CancelMyBookingVariables>;
}
export const cancelMyBookingRef: CancelMyBookingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the cancelMyBookingRef:
```typescript
const name = cancelMyBookingRef.operationName;
console.log(name);
```

### Variables
The `CancelMyBooking` mutation requires an argument of type `CancelMyBookingVariables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CancelMyBookingVariables {
  id: UUIDString;
  sailingCode: string;
  passengerCount: number;
}
```
### Return Type
Recall that executing the `CancelMyBooking` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CancelMyBookingData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `CancelMyBooking`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, cancelMyBooking, CancelMyBookingVariables } from '@barkolink/dataconnect-passenger';

// The `CancelMyBooking` mutation requires an argument of type `CancelMyBookingVariables`:
const cancelMyBookingVars: CancelMyBookingVariables = {
  id: ..., 
  sailingCode: ..., 
  passengerCount: ..., 
};

// Call the `cancelMyBooking()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await cancelMyBooking(cancelMyBookingVars);
// Variables can be defined inline as well.
const { data } = await cancelMyBooking({ id: ..., sailingCode: ..., passengerCount: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await cancelMyBooking(dataConnect, cancelMyBookingVars);

console.log(data.query);
console.log(data.booking_update);
console.log(data.sailing_update);
console.log(data.notification_insert);

// Or, you can use the `Promise` API.
cancelMyBooking(cancelMyBookingVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.booking_update);
  console.log(data.sailing_update);
  console.log(data.notification_insert);
});
```

### Using `CancelMyBooking`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, cancelMyBookingRef, CancelMyBookingVariables } from '@barkolink/dataconnect-passenger';

// The `CancelMyBooking` mutation requires an argument of type `CancelMyBookingVariables`:
const cancelMyBookingVars: CancelMyBookingVariables = {
  id: ..., 
  sailingCode: ..., 
  passengerCount: ..., 
};

// Call the `cancelMyBookingRef()` function to get a reference to the mutation.
const ref = cancelMyBookingRef(cancelMyBookingVars);
// Variables can be defined inline as well.
const ref = cancelMyBookingRef({ id: ..., sailingCode: ..., passengerCount: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = cancelMyBookingRef(dataConnect, cancelMyBookingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.booking_update);
console.log(data.sailing_update);
console.log(data.notification_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.booking_update);
  console.log(data.sailing_update);
  console.log(data.notification_insert);
});
```

## MarkNotificationRead
You can execute the `MarkNotificationRead` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [passenger/index.d.ts](./index.d.ts):
```typescript
markNotificationRead(vars: MarkNotificationReadVariables): MutationPromise<MarkNotificationReadData, MarkNotificationReadVariables>;

interface MarkNotificationReadRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkNotificationReadVariables): MutationRef<MarkNotificationReadData, MarkNotificationReadVariables>;
}
export const markNotificationReadRef: MarkNotificationReadRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markNotificationRead(dc: DataConnect, vars: MarkNotificationReadVariables): MutationPromise<MarkNotificationReadData, MarkNotificationReadVariables>;

interface MarkNotificationReadRef {
  ...
  (dc: DataConnect, vars: MarkNotificationReadVariables): MutationRef<MarkNotificationReadData, MarkNotificationReadVariables>;
}
export const markNotificationReadRef: MarkNotificationReadRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markNotificationReadRef:
```typescript
const name = markNotificationReadRef.operationName;
console.log(name);
```

### Variables
The `MarkNotificationRead` mutation requires an argument of type `MarkNotificationReadVariables`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkNotificationReadVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `MarkNotificationRead` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkNotificationReadData`, which is defined in [passenger/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkNotificationReadData {
  notification_update?: Notification_Key | null;
}
```
### Using `MarkNotificationRead`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markNotificationRead, MarkNotificationReadVariables } from '@barkolink/dataconnect-passenger';

// The `MarkNotificationRead` mutation requires an argument of type `MarkNotificationReadVariables`:
const markNotificationReadVars: MarkNotificationReadVariables = {
  id: ..., 
};

// Call the `markNotificationRead()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markNotificationRead(markNotificationReadVars);
// Variables can be defined inline as well.
const { data } = await markNotificationRead({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markNotificationRead(dataConnect, markNotificationReadVars);

console.log(data.notification_update);

// Or, you can use the `Promise` API.
markNotificationRead(markNotificationReadVars).then((response) => {
  const data = response.data;
  console.log(data.notification_update);
});
```

### Using `MarkNotificationRead`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markNotificationReadRef, MarkNotificationReadVariables } from '@barkolink/dataconnect-passenger';

// The `MarkNotificationRead` mutation requires an argument of type `MarkNotificationReadVariables`:
const markNotificationReadVars: MarkNotificationReadVariables = {
  id: ..., 
};

// Call the `markNotificationReadRef()` function to get a reference to the mutation.
const ref = markNotificationReadRef(markNotificationReadVars);
// Variables can be defined inline as well.
const ref = markNotificationReadRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markNotificationReadRef(dataConnect, markNotificationReadVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notification_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notification_update);
});
```

