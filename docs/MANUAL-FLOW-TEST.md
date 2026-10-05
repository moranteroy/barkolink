# BarkoLink manual flow test

Sample data ito para ikaw mismo ang mag-enter sa UI. Walang live records na awtomatikong idinadagdag ng guide na ito. Fictional ang names, emails, at contact details; pang-testing lang.

Gamitin ang October 10, 2026, Philippine time. Kung lumipas na ang petsang iyon, palitan ang parehong trips ng future date. Gumamit ng magkahiwalay na browser profiles o mag-log out bago lumipat ng role.

## 1. Admin setup

Mag-login gamit ang existing admin account. Sa Users, gumawa ng mga sumusunod:

| Full name | Email | Role |
| --- | --- | --- |
| Passenger Test | passenger.test@barkolink.com | PASSENGER |
| Ticketing Test | ticketing.test@barkolink.com | TICKETING |
| Boarding Test | boarding.test@barkolink.com | BOARDING |

Gamitin ang **Generate** para sa temporary password at itabi ang password ng bawat account. Gawin ang accounts sa Admin Users: ang admin-created accounts ay confirmed na, kaya hindi kailangang mag-confirm ng dummy email sa inbox.

Sa Ports, idagdag ang mga ito. Kung mayroon nang parehong code, gamitin ang existing active record.

| Code | Name | City | Region | Active |
| --- | --- | --- | --- | --- |
| CAL | Calapan Port | Calapan | Oriental Mindoro | Yes |
| BTG | Batangas Port | Batangas | Batangas | Yes |

Sa Vessels:

| Code | Name | Capacity | Active |
| --- | --- | --- | --- |
| BLTEST001 | BarkoLink Test Ferry | 3 | Yes |

Sadyang maliit ang capacity para madaling makita ang seat changes. Hindi ito halimbawa ng actual ferry capacity.

Sa Fares, piliin ang **BarkoLink Test Ferry** at i-save ang rates bago gumawa ng trips:

| Field | Input | Expected fare |
| --- | --- | --- |
| Regular fare | 600 | PHP 600 |
| Student discount | 20% | PHP 480 |
| Senior discount | 20% | PHP 480 |
| Child discount | 50% | PHP 300 |
| PWD discount | 20% | PHP 480 |

Sa Trips, gumawa ng dalawang trips gamit ang vessel na iyon:

| Field | Main flow trip | Cancellation test trip |
| --- | --- | --- |
| Origin | Calapan Port | Batangas Port |
| Destination | Batangas Port | Calapan Port |
| Departure | October 10, 2026, 8:00 AM | October 10, 2026, 12:00 PM |
| Arrival | October 10, 2026, 10:00 AM | October 10, 2026, 2:00 PM |
| Regular fare | PHP 600 | PHP 600 |
| Initial status | SCHEDULED | SCHEDULED |
| Initial seats | 3 | 3 |

Automatic ang trip code at duration. Itabi ang generated trip codes; huwag mag-enter ng sariling booking, ticket, o QR codes.

## 2. Online reservation: dalawang passengers

Mag-login bilang **Passenger Test**. Hanapin ang Calapan → Batangas trip sa October 10. Piliin ito at ilagay ang dalawang passengers:

| Field | Passenger 1 | Passenger 2 |
| --- | --- | --- |
| Full name | Juan Test | Maria Test |
| Passenger type | Regular | Student |
| Date of birth | 1990-05-12 | 2006-08-20 |
| Sex | Male | Female |
| Mobile number | 09170000001 | 09170000002 |
| Nationality | Filipino | Filipino |
| Fare | PHP 600 | PHP 480 |

Review at confirm reservation. Expected total: **PHP 1,080**, service fee PHP 0. Itabi ang generated booking reference.

Expected: booking **PENDING**, payment **UNPAID**, tickets **PENDING**, at available seats **3 → 1**. Makikita ang reservation sa passenger records.

## 3. Ticketing: cash payment

Mag-login bilang **Ticketing Test**. Sa awaiting payment queue, hanapin ang booking reference. I-check ang student ID ni Maria Test at gamitin ang Verify discount, kasama ang note na `Student ID checked`. Pagkatapos, buksan ang payment action, piliin ang CASH kung hinihingi, at confirm na natanggap ang **PHP 1,080**.

Expected: booking **CONFIRMED**, payment **PAID**, at dalawang tickets **ISSUED**. Mananatiling **1** ang available seat dahil na-reserve na ang dalawang seats sa previous step. Dapat may ticket/receipt at sariling generated QR code ang bawat passenger.

## 4. Walk-in booking: huling seat

Habang SCHEDULED pa ang main trip, pumunta sa Ticketing Walk-in. Piliin ang parehong Calapan → Batangas trip at ilagay:

| Field | Value |
| --- | --- |
| Full name | Pedro Walk-in |
| Passenger type | Regular |
| Date of birth | 1988-03-15 |
| Sex | Male |
| Mobile number | 09170000003 |
| Nationality | Filipino |
| Cash payment | PHP 600 |

Piliin ang **Review cash payment**, pagkatapos **Cash received — issue ticket**. Hindi kailangan ng passenger account si Pedro.

Expected: hiwalay na walk-in booking na **CONFIRMED / PAID**, isang **ISSUED** ticket, available seats **1 → 0**. Total cash collected sa main trip: **PHP 1,680**.

Subukan ang isa pang reservation o walk-in sa main trip. Dapat hindi ito makapag-book dahil puno na ang trip.

## 5. Check-in at boarding

Mag-login bilang **Boarding Test** at piliin ang main trip. Gamitin ang generated ticket QR/code para kay Juan, Maria, at Pedro. I-check in ang bawat ticket.

Expected: tatlong tickets na **CHECKED_IN**. Kung subukang mag-board habang SCHEDULED ang trip, hindi pa ito dapat payagan.

Mag-login bilang admin at palitan ang main trip status sa **BOARDING**. Bumalik sa Boarding Test, reload ang trip kung kailangan, at i-board ang tatlong checked-in tickets.

Expected: tatlong tickets na **BOARDED**. Subukang i-board muli ang isang boarded ticket: dapat hindi madagdagan ang boarding count.

## 6. Manifest at reports

Sa admin, buksan ang manifest para sa main trip at reports na sakop ang October 10, 2026. Bago markahang COMPLETED, i-check ang mga ito:

| Result para sa main trip | Expected |
| --- | --- |
| Bookings | 2 |
| Online bookings | 1 |
| Walk-in bookings | 1 |
| Paid passengers / manifest entries | 3 |
| Regular passengers | 2 |
| Student passengers | 1 |
| Collected amount | PHP 1,680 |
| Boarded passengers | 3 |
| Available seats | 0 |

Kung may iba nang transactions sa database, i-filter ang main trip o ikumpara ang dagdag sa totals. Ang report check-in count ay maaaring kasama ang mga boarded na; sa boarding queue naman, wala nang naghihintay na checked-in passenger kapag na-board na silang lahat.

Pagkatapos ng checks, palitan ang main trip mula **BOARDING → COMPLETED**.

## 7. Unpaid cancellation test

Mag-login bilang Passenger Test. Sa hiwalay na Batangas → Calapan trip, gumawa ng reservation para kay **Juan Test**, Regular, gamit ang parehong personal details.

Expected: total **PHP 600**, booking PENDING / UNPAID, available seats **3 → 2**.

Sa passenger records, i-cancel ang reservation bago bayaran. Expected: booking **CANCELLED** at available seats **2 → 3**. Hindi dapat magkaroon ng cash collection para sa cancelled unpaid booking.

Ang paid bookings ng main trip ay hindi dapat magkaroon ng unpaid-cancellation action. Ang cancelled ticket ay hindi dapat magamit sa boarding.

## Quick checklist

- [ ] Role-based login gumagana para sa admin, passenger, ticketing, at boarding.
- [ ] Saved vessel fares ang lumalabas sa trip at booking summary.
- [ ] Online booking reserves exactly two seats.
- [ ] Cash payment issues tickets without deducting seats a second time.
- [ ] Walk-in fills the last seat and full-trip booking is blocked.
- [ ] Boarding requires check-in and BOARDING trip status.
- [ ] Repeated boarding does not increase totals.
- [ ] Manifest and main-trip revenue match three passengers and PHP 1,680.
- [ ] Unpaid cancellation restores exactly one seat.

Kapag may hindi tumugma, itabi ang trip code, booking reference, role, action, at exact error message para madaling ma-trace.


Para sa expiry, pregnancy discount, schedule conflicts at cancelled-trip refunds, sundin din ang [Operations upgrade guide](OPERATIONS-UPGRADE.md).
