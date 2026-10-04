# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { browseActivePorts, browseSailings, myProfile, createMyProfile, updateMyProfile, myBookings, reserveSailing1, reserveSailing2, reserveSailing3, reserveSailing4 } from '@barkolink/dataconnect-passenger';


// Operation BrowseActivePorts: 
const { data } = await BrowseActivePorts(dataConnect);

// Operation BrowseSailings: 
const { data } = await BrowseSailings(dataConnect);

// Operation MyProfile: 
const { data } = await MyProfile(dataConnect);

// Operation CreateMyProfile:  For variables, look at type CreateMyProfileVars in ../index.d.ts
const { data } = await CreateMyProfile(dataConnect, createMyProfileVars);

// Operation UpdateMyProfile:  For variables, look at type UpdateMyProfileVars in ../index.d.ts
const { data } = await UpdateMyProfile(dataConnect, updateMyProfileVars);

// Operation MyBookings: 
const { data } = await MyBookings(dataConnect);

// Operation ReserveSailing1:  For variables, look at type ReserveSailing1Vars in ../index.d.ts
const { data } = await ReserveSailing1(dataConnect, reserveSailing1Vars);

// Operation ReserveSailing2:  For variables, look at type ReserveSailing2Vars in ../index.d.ts
const { data } = await ReserveSailing2(dataConnect, reserveSailing2Vars);

// Operation ReserveSailing3:  For variables, look at type ReserveSailing3Vars in ../index.d.ts
const { data } = await ReserveSailing3(dataConnect, reserveSailing3Vars);

// Operation ReserveSailing4:  For variables, look at type ReserveSailing4Vars in ../index.d.ts
const { data } = await ReserveSailing4(dataConnect, reserveSailing4Vars);


```