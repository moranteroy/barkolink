# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { adminFareSettings, adminSaveFareSettings, adminExportManifest, staffBookings, ticketingPassengerAccounts, ticketingSailings, collectBookingPayment, ticketingCreateWalkIn, ticketingCreateGuestWalkIn, boardingManifest } from '@barkolink/dataconnect-staff';


// Operation AdminFareSettings: 
const { data } = await AdminFareSettings(dataConnect);

// Operation AdminSaveFareSettings:  For variables, look at type AdminSaveFareSettingsVars in ../index.d.ts
const { data } = await AdminSaveFareSettings(dataConnect, adminSaveFareSettingsVars);

// Operation AdminExportManifest:  For variables, look at type AdminExportManifestVars in ../index.d.ts
const { data } = await AdminExportManifest(dataConnect, adminExportManifestVars);

// Operation StaffBookings: 
const { data } = await StaffBookings(dataConnect);

// Operation TicketingPassengerAccounts: 
const { data } = await TicketingPassengerAccounts(dataConnect);

// Operation TicketingSailings: 
const { data } = await TicketingSailings(dataConnect);

// Operation CollectBookingPayment:  For variables, look at type CollectBookingPaymentVars in ../index.d.ts
const { data } = await CollectBookingPayment(dataConnect, collectBookingPaymentVars);

// Operation TicketingCreateWalkIn:  For variables, look at type TicketingCreateWalkInVars in ../index.d.ts
const { data } = await TicketingCreateWalkIn(dataConnect, ticketingCreateWalkInVars);

// Operation TicketingCreateGuestWalkIn:  For variables, look at type TicketingCreateGuestWalkInVars in ../index.d.ts
const { data } = await TicketingCreateGuestWalkIn(dataConnect, ticketingCreateGuestWalkInVars);

// Operation BoardingManifest:  For variables, look at type BoardingManifestVars in ../index.d.ts
const { data } = await BoardingManifest(dataConnect, boardingManifestVars);


```