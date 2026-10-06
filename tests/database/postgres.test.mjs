import { PGlite } from "@electric-sql/pglite";
import { before, beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ids = {
  passenger: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  admin: "33333333-3333-4333-8333-333333333333",
  ticketing: "44444444-4444-4444-8444-444444444444",
  boarding: "55555555-5555-4555-8555-555555555555",
};
const origin = "76a29980-5c27-4c4b-9ead-cae943202001",
  destination = "76a29980-5c27-4c4b-9ead-cae943202002";
const vessel = "76a29980-5c27-4c4b-9ead-cae943203001";
let db;
async function call(
  role,
  operation,
  args = {},
  databaseRole = "authenticated",
) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    ids[role] || "",
  ]);
  await db.exec(`set role ${databaseRole}`);
  try {
    const result = await db.query(
      "select public.barkolink_execute($1, $2::jsonb) as data",
      [operation, JSON.stringify(args)],
    );
    return result.rows[0].data;
  } finally {
    await db.exec("reset role");
  }
}
const reserveArgs = (reference = "BK-TEST", count = 1) => ({
  sailingCode: "TEST-TRIP",
  reference,
  ...Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      [`passenger${i + 1}Name`, `Passenger ${i + 1}`],
      [`passenger${i + 1}Type`, i ? "STUDENT" : "REGULAR"],
    ]).flat(),
  ),
});
async function reserve(reference = "BK-TEST", count = 1) {
  await call(
    "passenger",
    `ReserveSailing${count}`,
    reserveArgs(reference, count),
  );
  return (await call("passenger", "MyBookings")).bookings.find(
    (b) => b.reference === reference,
  );
}

describe("Supabase PostgreSQL migrations and business rules", () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text unique not null, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `);
    for (const file of fs.readdirSync("supabase/migrations").sort())
      await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
  });
  after(async () => {
    await db?.close();
  });

  it("searches audit records before pagination and uses Philippine date boundaries", async () => {
    await db.exec("truncate public.activity_log");
    for (let i = 0; i < 35; i++)
      await db.query(
        `insert into public.activity_log(actor_uid,action,entity_type,entity_id,created_at,details)
      values($1,'PAYMENT_RECEIVED','booking',$2,$3,'{"amount":600}')`,
        [
          ids.admin,
          `MATCH-${String(i).padStart(2, "0")}`,
          `2026-10-04T16:${String(i).padStart(2, "0")}:00Z`,
        ],
      );
    await db.exec(
      "insert into public.activity_log(action,entity_type,entity_id,created_at) values('SAILING_UPDATED','sailing','OUTSIDE-DATE','2026-10-04T15:59:59Z'),('PAYMENT_RECEIVED','booking','NEXT-DATE','2026-10-05T16:00:00Z')",
    );
    const first = await call("admin", "AdminAuditLog", {
      search: "match",
      fromDate: "2026-10-05",
      toDate: "2026-10-05",
      page: 0,
    });
    assert.equal(first.totalCount, 35);
    assert.equal(first.records.length, 30);
    assert.equal(first.records[0].entityId, "MATCH-34");
    assert.deepEqual(first.actions, ["PAYMENT_RECEIVED", "SAILING_UPDATED"]);
    const second = await call("admin", "AdminAuditLog", {
      search: "match",
      page: 1,
    });
    assert.equal(second.records.length, 5);
    assert.equal(second.records[4].entityId, "MATCH-00");
    assert.equal(
      (await call("admin", "AdminAuditLog", { search: "MATCH-00" })).totalCount,
      1,
    );
    assert.equal(
      (await call("admin", "AdminAuditLog", { search: "%" })).totalCount,
      0,
    );
    assert.equal(
      (await call("admin", "AdminAuditLog", { action: "SAILING_UPDATED" }))
        .totalCount,
      1,
    );
    assert.equal(
      (
        await call("admin", "AdminAuditLog", {
          fromDate: "2026-10-05",
          toDate: "2026-10-05",
        })
      ).totalCount,
      35,
    );
    assert.equal(
      (
        await call("admin", "AdminAuditLog", {
          search: first.records[0].actorName,
        })
      ).totalCount,
      35,
    );
    await assert.rejects(
      call("admin", "AdminAuditLog", { page: -1 }),
      /Invalid records page/,
    );
    await assert.rejects(
      call("admin", "AdminAuditLog", { pageSize: 101 }),
      /Invalid records page/,
    );
    await assert.rejects(
      call("admin", "AdminAuditLog", {
        fromDate: "2026-10-06",
        toDate: "2026-10-05",
      }),
      /valid date range/,
    );
  });

  it("filters complete admin directories before paging and restricts sailing options", async () => {
    await db.exec(`insert into public.app_user(uid,email,full_name,role)
      select 'directory-'||n,'directory-'||n||'@example.invalid','Directory '||n,'PASSENGER' from generate_series(1,35) n`);
    const users = await call('admin', 'AdminUsers', { search: 'directory-', status: 'PASSENGER', pageSize: 30 });
    assert.equal(users.totalCount, 35);
    assert.equal(users.users.length, 30);
    assert.equal((await call('admin', 'AdminUsers', { search: 'directory-', page: 1, pageSize: 30 })).users.length, 5);
    assert.equal((await call('admin', 'AdminUsers', { search: 'directory-35@' })).users[0].uid, 'directory-35');
    assert.equal((await call('admin', 'AdminSailings', { search: 'TEST-TRIP' })).totalCount, 1);
    assert.equal((await call('admin', 'AdminSailings', { status: 'CANCELLED' })).totalCount, 0);
    await reserve('DIRECTORY-BOOKING');
    assert.equal((await call('admin', 'AdminPassengerRecords', { search: 'DIRECTORY-BOOKING' })).totalCount, 1);
    assert.equal((await call('admin', 'AdminPassengerRecords', { sailingCode: 'missing' })).totalCount, 0);
    assert.equal((await call('admin', 'AdminPassengerRecords', { paidOnly: true })).totalCount, 0);
    assert.ok((await call('admin', 'AdminSailingOptions')).sailings.some(s => s.code === 'TEST-TRIP'));
    await assert.rejects(call('boarding', 'AdminSailingOptions'), /Administrator/);
  });

  it("filters settings history before pagination and preserves actor roles after role changes", async () => {
    await db.exec("truncate public.activity_log");
    for (let i = 0; i < 32; i++)
      await db.query(
        "insert into public.activity_log(actor_uid,action,entity_type,entity_id) values($1,'UPDATE','operation_settings',$2)",
        [ids.admin, `SETTINGS-${i}`],
      );
    await db.query(
      "insert into public.activity_log(actor_uid,action,entity_type,entity_id,actor_role) values($1,'PAYMENT_RECEIVED','booking','ROLE-SNAPSHOT','ADMIN')",
      [ids.ticketing],
    );
    await db.exec(
      "insert into public.activity_log(action,entity_type,entity_id) values('RESERVATION_EXPIRED','booking','SYSTEM-EXPIRY')",
    );
    const settings = await call("admin", "AdminAuditLog", {
      entityType: "operation_settings",
    });
    assert.equal(settings.totalCount, 32);
    assert.equal(settings.records.length, 30);
    assert.ok(
      settings.records.every(
        (record) =>
          record.entityType === "operation_settings" &&
          record.actorRole === "ADMIN" &&
          record.actorRoleRecorded,
      ),
    );
    assert.equal(
      (
        await call("admin", "AdminAuditLog", {
          entityType: "operation_settings",
          page: 1,
        })
      ).records.length,
      2,
    );
    await db.query(
      "update auth.users set raw_app_meta_data=jsonb_build_object('role','BOARDING') where id=$1",
      [ids.ticketing],
    );
    const snapshot = (
      await call("admin", "AdminAuditLog", { search: "ROLE-SNAPSHOT" })
    ).records[0];
    assert.equal(snapshot.actorRole, "TICKETING");
    assert.equal(snapshot.actorRoleRecorded, true);
    const system = (
      await call("admin", "AdminAuditLog", { search: "SYSTEM-EXPIRY" })
    ).records[0];
    assert.equal(system.actorName, "System");
    assert.equal(system.actorRole, "SYSTEM");
    // Model a legacy row without claiming that the current role was its historical role.
    await db.exec(
      "update public.activity_log set actor_role=null where entity_id='ROLE-SNAPSHOT'",
    );
    const legacy = (
      await call("admin", "AdminAuditLog", { search: "ROLE-SNAPSHOT" })
    ).records[0];
    assert.equal(legacy.actorRole, "BOARDING");
    assert.equal(legacy.actorRoleRecorded, false);
    await assert.rejects(
      call("admin", "AdminAuditLog", { entityType: "x".repeat(81) }),
      /Record type is too long/,
    );
  });

  it("restricts audit search and its private function to authorized administrators", async () => {
    for (const role of ["passenger", "ticketing", "boarding"])
      await assert.rejects(
        call(role, "AdminAuditLog"),
        /Administrator access required/,
      );
    await assert.rejects(
      call(null, "AdminAuditLog", {}, "anon"),
      /Administrator access required/,
    );
    await db.exec("set role authenticated");
    try {
      await assert.rejects(
        db.query("select * from public.activity_log"),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "select barkolink_private.execute_workspace('AdminAuditLog','{}',$1,'ADMIN')",
          [ids.passenger],
        ),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("saves custom discounts, snapshots new trips and preserves existing fares", async () => {
    const custom = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Special discount",
      percentage: 15,
      isActive: true,
    };
    const settings = {
      vesselId: vessel,
      regularFare: 600,
      studentDiscount: 20,
      seniorDiscount: 20,
      childDiscount: 50,
      pwdDiscount: 20,
      pregnantDiscount: 0,
      customDiscounts: [
        custom,
        {
          ...custom,
          id: "77777777-7777-4777-8777-777777777777",
          name: "Inactive discount",
          isActive: false,
        },
      ],
    };
    await call("admin", "AdminSaveFareSettings", settings);
    assert.deepEqual(
      (await call("ticketing", "StaffFares")).fares.find(
        (f) => f.vesselId === vessel,
      ).customDiscounts,
      settings.customDiscounts,
    );
    const create = await call("admin", "AdminCreateSailing", {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-01-02T08:00:00Z",
      arrivalAt: "2099-01-02T10:00:00Z",
      durationMinutes: 120,
    });
    const code = create.sailing_insert.code;
    const trip = (await call("admin", "AdminSailings")).sailings.find(
      (s) => s.code === code,
    );
    assert.deepEqual(trip.customDiscounts, [{ ...custom, fare: 510 }]);
    assert.deepEqual(
      (await call("admin", "AdminSailings")).sailings.find(
        (s) => s.code === "TEST-TRIP",
      ).customDiscounts,
      [],
    );
    const args = {
      ...reserveArgs("CUSTOM-BOOKING"),
      sailingCode: code,
      passenger1Type: custom.name,
      passenger1Fare: 1,
    };
    const reserved = await call("passenger", "ReserveSailing1", args);
    const saved = (await call("passenger", "MyBookings")).bookings.find(
      (b) => b.reference === "CUSTOM-BOOKING",
    );
    assert.equal(saved.total, 510);
    assert.equal(
      saved.bookingPassengers_on_booking[0].passengerType,
      custom.name,
    );
    await assert.rejects(
      call("ticketing", "CollectBookingPayment", {
        bookingId: reserved.booking_insert.id,
        method: "CASH",
      }),
      /verif/i,
    );
    await assert.rejects(
      call("passenger", "ReserveSailing1", {
        ...args,
        reference: "FAKE",
        passenger1Type: "Fake discount",
      }),
      /Invalid passenger type/,
    );
    await assert.rejects(
      call("passenger", "ReserveSailing1", {
        ...args,
        reference: "INACTIVE",
        passenger1Type: "Inactive discount",
      }),
      /Invalid passenger type/,
    );
    await call("ticketing", "VerifyPassengerDiscount", {
      passengerId: saved.bookingPassengers_on_booking[0].id,
      note: "Operator eligibility checked",
    });
    await call("ticketing", "CollectBookingPayment", {
      bookingId: saved.id,
      method: "CASH",
    });
    await call("admin", "AdminSaveFareSettings", {
      ...settings,
      customDiscounts: [],
    });
    assert.deepEqual(
      (await call("admin", "AdminSailings")).sailings.find(
        (s) => s.code === code,
      ).customDiscounts,
      trip.customDiscounts,
    );
    await call("passenger", "ReserveSailing1", args);
    assert.equal(
      (await call("passenger", "MyBookings")).bookings.find(
        (b) => b.reference === "CUSTOM-BOOKING",
      ).total,
      510,
    );
    const walk = {
      sailingCode: code,
      guestUid: "walkin:custom",
      guestEmail: "custom@example.com",
      reference: "CUSTOM-WALK",
      ticketCode: "88888888-8888-4888-8888-888888888888",
      passengerName: "Custom Guest",
      passengerType: custom.name,
      method: "CASH",
    };
    await assert.rejects(
      call("ticketing", "TicketingCreateGuestWalkIn", walk),
      /eligibility/,
    );
    await call("ticketing", "TicketingCreateGuestWalkIn", {
      ...walk,
      discountVerified: true,
      verificationNote: "Operator eligibility checked",
    });
    assert.equal(
      (await call("ticketing", "StaffBookings")).bookings.find(
        (b) => b.reference === "CUSTOM-WALK",
      ).total,
      510,
    );
  });
  it("keeps custom fares aligned with unbooked trip edits and separates identically named vessels", async () => {
    const custom = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Special discount",
      percentage: 15,
      isActive: true,
    };
    const settings = {
      vesselId: vessel,
      regularFare: 600,
      studentDiscount: 20,
      seniorDiscount: 20,
      childDiscount: 50,
      pwdDiscount: 20,
      pregnantDiscount: 0,
      customDiscounts: [custom],
    };
    await call("admin", "AdminSaveFareSettings", settings);
    const schedule = {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-01-02T08:00:00Z",
      arrivalAt: "2099-01-02T10:00:00Z",
      durationMinutes: 120,
    };
    const created = await call("admin", "AdminCreateSailing", schedule);
    await call("admin", "AdminSaveFareSettings", {
      ...settings,
      customDiscounts: [{ ...custom, percentage: 30 }],
    });
    await call("admin", "AdminUpdateUnbookedSailing", {
      ...schedule,
      code: created.sailing_insert.code,
      regularFare: 1000,
      studentFare: 800,
      seniorFare: 800,
      childFare: 500,
      pwdFare: 800,
      pregnantFare: 1000,
    });
    const trip = (await call("admin", "AdminSailings")).sailings.find(
      (s) => s.code === created.sailing_insert.code,
    );
    assert.equal(trip.customDiscounts[0].fare, 850);
    assert.equal(trip.customDiscounts[0].percentage, 15);
    const accommodation = await call("admin", "AdminSaveAccommodation", {
      vesselId: vessel,
      name: "Comfort",
      capacity: 20,
      surcharge: 100,
      isActive: true,
    });
    await call("passenger", "ReserveSailing1", {
      ...reserveArgs("CLASS-CUSTOM"),
      sailingCode: trip.code,
      passenger1Type: custom.name,
      accommodationId: accommodation.id,
    });
    const booking = (await call("passenger", "MyBookings")).bookings[0];
    assert.equal(booking.total, 950);
    const otherVessel = "99999999-9999-4999-8999-999999999999";
    await db.query(
      "insert into public.vessel(id,code,name,passenger_capacity) select $1,'SAME-NAME',name,100 from public.vessel where id=$2",
      [otherVessel, vessel],
    );
    await call("admin", "AdminSaveFareSettings", {
      ...settings,
      vesselId: otherVessel,
      customDiscounts: [],
    });
    const fares = (await call("ticketing", "StaffFares")).fares.filter(
      (f) => f.vesselId === vessel || f.vesselId === otherVessel,
    );
    assert.equal(fares.length, 2);
    assert.equal(
      fares.find((f) => f.vesselId === vessel).customDiscounts[0].percentage,
      30,
    );
    assert.deepEqual(
      fares.find((f) => f.vesselId === otherVessel).customDiscounts,
      [],
    );
  });
  it("validates custom discounts atomically and requires administrator access", async () => {
    const custom = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Special discount",
      percentage: 15,
      isActive: true,
    };
    const settings = {
      vesselId: vessel,
      regularFare: 600,
      studentDiscount: 20,
      seniorDiscount: 20,
      childDiscount: 50,
      pwdDiscount: 20,
      pregnantDiscount: 0,
      customDiscounts: [custom],
    };
    await call("admin", "AdminSaveFareSettings", settings);
    for (const role of ["passenger", "ticketing", "boarding", null])
      await assert.rejects(
        call(role, "AdminSaveFareSettings", settings),
        /Administrator/,
      );
    for (const customDiscounts of [
      null,
      {},
      [{ ...custom, name: "Student" }],
      [{ ...custom, name: "" }],
      [{ ...custom, percentage: 100 }],
      [{ ...custom, percentage: 1.5 }],
      [
        custom,
        {
          ...custom,
          id: "77777777-7777-4777-8777-777777777777",
          name: "special  discount",
        },
      ],
    ]) {
      await assert.rejects(
        call("admin", "AdminSaveFareSettings", {
          ...settings,
          regularFare: 900,
          customDiscounts,
        }),
      );
      const saved = (
        await call("admin", "AdminFareSettings")
      ).vesselFareSettings.find((f) => f.code === vessel);
      assert.equal(saved.regularFare, 600);
      assert.deepEqual(saved.customDiscounts, [custom]);
    }
    await call("admin", "AdminSaveFareSettings", {
      ...settings,
      customDiscounts: undefined,
    });
    assert.deepEqual(
      (await call("admin", "AdminFareSettings")).vesselFareSettings.find(
        (f) => f.code === vessel,
      ).customDiscounts,
      [custom],
    );
  });

  it("edits and deletes existing passenger discounts while preserving old trip choices", async () => {
    await db.exec(
      "update public.sailing set passenger_discounts=null where code='TEST-TRIP'",
    );
    const args = {
      vesselId: vessel,
      regularFare: 600,
      passengerDiscounts: [
        {
          id: "ffffffff-0000-4000-8000-000000000001",
          name: "Scholar",
          percentage: 35,
          isActive: true,
        },
        {
          id: "ffffffff-0000-4000-8000-000000000004",
          name: "PWD",
          percentage: 20,
          isActive: false,
        },
      ],
    };
    await call("admin", "AdminSaveFareSettings", args);
    const saved = (
      await call("admin", "AdminFareSettings")
    ).vesselFareSettings.find((f) => f.code === vessel);
    assert.deepEqual(saved.passengerDiscounts, args.passengerDiscounts);
    const create = await call("admin", "AdminCreateSailing", {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-01-02T08:00:00Z",
      arrivalAt: "2099-01-02T10:00:00Z",
      durationMinutes: 120,
    });
    const code = create.sailing_insert.code;
    const trip = (await call("admin", "AdminSailings")).sailings.find(
      (s) => s.code === code,
    );
    assert.deepEqual(trip.passengerDiscounts, [
      { ...args.passengerDiscounts[0], fare: 390 },
    ]);
    for (const type of ["STUDENT", "SENIOR", "CHILD", "PWD", "PREGNANT"])
      await assert.rejects(
        call("passenger", "ReserveSailing1", {
          ...reserveArgs("DELETED-" + type),
          sailingCode: code,
          passenger1Type: type,
        }),
        /unavailable discount/,
      );
    await call("passenger", "ReserveSailing1", {
      ...reserveArgs("RENAMED"),
      sailingCode: code,
      passenger1Type: "Scholar",
    });
    assert.equal(
      (await call("passenger", "MyBookings")).bookings.find(
        (b) => b.reference === "RENAMED",
      ).total,
      390,
    );
    await call("passenger", "ReserveSailing1", {
      ...reserveArgs("LEGACY-STUDENT"),
      passenger1Type: "STUDENT",
    });
    assert.equal(
      (await call("passenger", "MyBookings")).bookings.find(
        (b) => b.reference === "LEGACY-STUDENT",
      ).total,
      480,
    );
    await call("admin", "AdminSaveFareSettings", {
      ...args,
      passengerDiscounts: [],
    });
    assert.deepEqual(
      (await call("ticketing", "StaffFares")).fares[0].passengerDiscounts,
      [],
    );
    assert.deepEqual(
      (await call("admin", "AdminSailings")).sailings.find(
        (s) => s.code === code,
      ).passengerDiscounts,
      trip.passengerDiscounts,
    );
    const next = await call("admin", "AdminCreateSailing", {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-01-03T08:00:00Z",
      arrivalAt: "2099-01-03T10:00:00Z",
      durationMinutes: 120,
    });
    assert.deepEqual(
      (await call("admin", "AdminSailings")).sailings.find(
        (s) => s.code === next.sailing_insert.code,
      ).passengerDiscounts,
      [],
    );
    await assert.rejects(
      call("passenger", "ReserveSailing1", {
        ...reserveArgs("NO-DISCOUNT"),
        sailingCode: next.sailing_insert.code,
        passenger1Type: "Scholar",
      }),
      /unavailable discount/,
    );
    await assert.rejects(
      call("ticketing", "AdminSaveFareSettings", args),
      /Administrator/,
    );
    await assert.rejects(
      call("admin", "AdminSaveFareSettings", {
        ...args,
        passengerDiscounts: [
          { ...args.passengerDiscounts[0], name: "Regular" },
        ],
      }),
      /base fare/,
    );
    await assert.rejects(
      call("admin", "AdminSaveFareSettings", {
        ...args,
        passengerDiscounts: [
          { ...args.passengerDiscounts[0], name: "Senior" },
          { ...args.passengerDiscounts[1], name: "Senior Citizen" },
        ],
      }),
      /unique name/,
    );
  });

  beforeEach(async () => {
    await db.exec(
      "truncate public.activity_log, public.boarding_event, public.notification, public.booking_passenger, public.booking, public.sailing, public.fare_settings, public.vessel, public.port, public.app_user, auth.users cascade",
    );
    for (const [role, id] of Object.entries(ids)) {
      await db.query(
        "insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values ($1,$2,$3,$4)",
        [
          id,
          `${role}@example.com`,
          { fullName: role },
          { role: role === "other" ? "PASSENGER" : role.toUpperCase() },
        ],
      );
    }
    await db.exec(fs.readFileSync("supabase/seed.sql", "utf8"));
    await db.query(
      `insert into public.sailing(code,origin_port_id,destination_port_id,vessel_id,departure_at,arrival_at,duration_minutes,
      regular_fare,student_fare,senior_fare,child_fare,pwd_fare,pregnant_fare,available_seats)
      values ('TEST-TRIP',$1,$2,$3,'2099-01-01T08:00:00Z','2099-01-01T10:00:00Z',120,600,480,480,300,480,600,2)`,
      [origin, destination, vessel],
    );
  });

  it("lists accommodation records through the admin RPC before and after edits", async () => {
    assert.deepEqual(
      (await call("admin", "AdminAccommodations")).accommodations,
      [],
    );
    const draft = {
      vesselId: vessel,
      name: "Tourist",
      description: "Comfort seats",
      capacity: 2,
      surcharge: 100,
      isActive: true,
    };
    const saved = await call("admin", "AdminSaveAccommodation", draft);
    const listed = (await call("admin", "AdminAccommodations")).accommodations;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, saved.id);
    assert.equal(listed[0].vesselId, vessel);
    assert.ok(listed[0].vesselName);
    await call("admin", "AdminSaveAccommodation", {
      ...draft,
      id: saved.id,
      name: "Tourist Plus",
      surcharge: 120,
    });
    const updated = (await call("admin", "AdminAccommodations"))
      .accommodations[0];
    assert.equal(updated.name, "Tourist Plus");
    assert.equal(updated.surcharge, 120);
    for (const role of ["passenger", "ticketing", "boarding"])
      await assert.rejects(call(role, "AdminAccommodations"), /Administrator/);
    await assert.rejects(
      call(null, "AdminAccommodations", {}, "anon"),
      /Administrator/,
    );
  });

  it("reserves class inventory atomically, snapshots surcharges, and restores class seats on cancellation", async () => {
    const draft = {
      vesselId: vessel,
      name: "Business",
      description: "Comfort seats",
      capacity: 1,
      surcharge: 150,
      isActive: true,
    };
    const saved = await call("admin", "AdminSaveAccommodation", draft);
    const args = { ...reserveArgs("BK-CLASS"), accommodationId: saved.id };
    await assert.rejects(
      call("passenger", "ReserveSailing1", reserveArgs("BK-MISSING")),
      /Choose an accommodation/,
    );
    await call("passenger", "ReserveSailing1", args);
    const booking = (await call("passenger", "MyBookings")).bookings[0];
    assert.equal(booking.total, 750);
    assert.equal(booking.serviceFee, 150);
    assert.equal(booking.accommodationName, "Business");
    await call("passenger", "ReserveSailing1", args);
    await assert.rejects(
      call("passenger", "ReserveSailing1", {
        ...args,
        accommodationId: undefined,
      }),
      /different accommodation/,
    );
    await assert.rejects(
      call("other", "ReserveSailing1", { ...args, reference: "BK-OVER" }),
      /enough available seats/,
    );
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .accommodations[0].availableSeats,
      0,
    );
    await call("admin", "AdminSaveAccommodation", {
      ...draft,
      id: saved.id,
      surcharge: 200,
      name: "Business Plus",
    });
    assert.equal(
      (await call("passenger", "MyBookings")).bookings[0].total,
      750,
    );
    assert.equal(
      (await call("passenger", "MyBookings")).bookings[0].accommodationName,
      "Business",
    );
    await call("passenger", "CancelMyBooking", { id: booking.id });
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .accommodations[0].availableSeats,
      1,
    );
  });
  it("protects class allocation and retains discount verification with accommodation charges", async () => {
    const draft = {
      vesselId: vessel,
      name: "Tourist",
      capacity: 2,
      surcharge: 100,
      isActive: true,
    };
    const saved = await call("admin", "AdminSaveAccommodation", draft);
    await assert.rejects(
      call("ticketing", "AdminSaveAccommodation", draft),
      /Administrator/,
    );
    await assert.rejects(
      call("admin", "AdminSaveAccommodation", {
        ...draft,
        name: "Too large",
        capacity: 300,
      }),
      /fit within/,
    );
    const result = await call("passenger", "ReserveSailing2", {
      ...reserveArgs("BK-DISCOUNT-CLASS", 2),
      accommodationId: saved.id,
    });
    await assert.rejects(
      call("admin", "AdminSaveAccommodation", {
        ...draft,
        id: saved.id,
        capacity: 1,
      }),
      /already reserved/,
    );
    const booking = (await call("passenger", "MyBookings")).bookings[0];
    assert.equal(booking.total, 1280);
    assert.equal(booking.passengerFareTotal, 1080);
    await assert.rejects(
      call("ticketing", "CollectBookingPayment", {
        bookingId: result.booking_insert.id,
        method: "CASH",
      }),
      /Verify/,
    );
    const student = booking.bookingPassengers_on_booking.find(
      (passenger) => passenger.passengerType === "STUDENT",
    );
    assert.ok(student);
    await call("ticketing", "VerifyPassengerDiscount", {
      passengerId: student.id,
      note: "Student ID checked",
    });
    await call("ticketing", "CollectBookingPayment", {
      bookingId: booking.id,
      method: "CASH",
    });
    assert.equal(
      (await call("passenger", "MyBookings")).bookings[0].total,
      1280,
    );
  });
  it("creates paid walk-in tickets with selected class charges and preserves safe retries", async () => {
    const saved = await call("admin", "AdminSaveAccommodation", {
      vesselId: vessel,
      name: "Economy",
      capacity: 1,
      surcharge: 80,
      isActive: true,
    });
    const args = {
      sailingCode: "TEST-TRIP",
      accommodationId: saved.id,
      guestUid: "walkin:class",
      guestEmail: "guest-class@example.com",
      reference: "BK-GUEST-CLASS",
      ticketCode: "66666666-6666-4666-8666-666666666666",
      passengerName: "Guest",
      passengerType: "REGULAR",
      method: "CASH",
    };
    await call("ticketing", "TicketingCreateGuestWalkIn", args);
    await call("ticketing", "TicketingCreateGuestWalkIn", args);
    const records = (await call("ticketing", "StaffBookings")).bookings;
    assert.equal(records.length, 1);
    assert.equal(records[0].total, 680);
    assert.equal(records[0].paymentStatus, "PAID");
    assert.equal(records[0].accommodationName, "Economy");
  });
  it("saves routes with active distinct ports and restricts staff catalog access", async () => {
    const args = {
      code: "CAL-BAT",
      originPortId: origin,
      destinationPortId: destination,
      durationMinutes: 120,
      isActive: true,
    };
    const saved = await call("admin", "AdminSaveRoute", args);
    assert.equal(
      (await call("admin", "AdminRoutes")).routes[0].code,
      "CAL-BAT",
    );
    await call("admin", "AdminSaveRoute", {
      ...args,
      id: saved.id,
      durationMinutes: 90,
    });
    assert.equal(
      (await call("admin", "AdminRoutes")).routes[0].durationMinutes,
      90,
    );
    await assert.rejects(
      call("admin", "AdminSaveRoute", {
        ...args,
        code: "INVALID",
        destinationPortId: origin,
      }),
      /check constraint/,
    );
    await assert.rejects(call("ticketing", "AdminRoutes"), /Administrator/);
    await assert.rejects(call("boarding", "StaffPassengers"), /Ticketing/);
    await assert.rejects(call("passenger", "StaffSailings"), /Staff access/);
    assert.equal(
      (await call("boarding", "StaffSailings", { search: "test-trip" }))
        .totalCount,
      1,
    );
    assert.equal(
      (await call("boarding", "StaffSailings", { search: "%" })).totalCount,
      0,
    );
    await assert.rejects(
      call("ticketing", "StaffSailings", { page: -1 }),
      /Invalid records/,
    );
  });
  it("delivers scoped notifications once and preserves account ownership", async () => {
    await reserve();
    const draft = {
      title: "Departure reminder",
      message: "Please bring your ticket.",
      audience: "TRIP",
      sailingCode: "TEST-TRIP",
      requestId: "77777777-7777-4777-8777-777777777777",
    };
    assert.equal(
      (await call("admin", "AdminNotificationRecipients", draft)).recipients,
      1,
    );
    assert.equal((await call("admin", "AdminSendNotification", draft)).sent, 1);
    assert.equal((await call("admin", "AdminSendNotification", draft)).sent, 1);
    await assert.rejects(
      call("admin", "AdminSendNotification", {
        ...draft,
        title: "Changed title",
      }),
      /different content/,
    );
    const notices = (
      await call("passenger", "MyNotifications")
    ).notifications.filter((n) => n.title === draft.title);
    assert.equal(notices.length, 1);
    assert.equal(
      (await call("other", "MyNotifications")).notifications.filter(
        (n) => n.title === draft.title,
      ).length,
      0,
    );
    await assert.rejects(
      call("other", "MarkNotificationRead", { id: notices[0].id }),
      /not found/,
    );
    await call("passenger", "MarkNotificationRead", { id: notices[0].id });
    assert.ok(
      (await call("passenger", "MyNotifications")).notifications.find(
        (n) => n.id === notices[0].id,
      ).readAt,
    );
    const campaign = (await call("admin", "AdminNotificationCampaigns"))
      .campaigns[0];
    assert.equal(campaign.recipientCount, 1);
    await assert.rejects(
      call("ticketing", "AdminSendNotification", draft),
      /Administrator/,
    );
    assert.equal(
      (
        await call("admin", "AdminNotificationRecipients", {
          audience: "STAFF",
        })
      ).recipients,
      3,
    );
  });
  it("records boarding staff no-shows only after departure and completion", async () => {
    const booking = await reserve();
    await call("ticketing", "CollectBookingPayment", {
      bookingId: booking.id,
      method: "CASH",
    });
    await assert.rejects(
      call("boarding", "StaffMarkNoShow", { sailingCode: "TEST-TRIP" }),
      /Complete the departed/,
    );
    await assert.rejects(
      call("ticketing", "StaffMarkNoShow", { sailingCode: "TEST-TRIP" }),
      /Boarding/,
    );
    await db.exec(
      "update public.sailing set status='COMPLETED',departure_at=now()-interval '2 hours',arrival_at=now()-interval '1 hour' where code='TEST-TRIP'",
    );
    assert.equal(
      (await call("boarding", "StaffMarkNoShow", { sailingCode: "TEST-TRIP" }))
        .marked,
      1,
    );
    assert.equal(
      (await call("boarding", "StaffMarkNoShow", { sailingCode: "TEST-TRIP" }))
        .marked,
      0,
    );
    assert.equal(
      (await call("boarding", "StaffNoShows", { sailingCode: "TEST-TRIP" }))
        .passengers[0].noShow,
      true,
    );
    const dashboard = await call("admin", "AdminOverview");
    assert.equal(dashboard.stats.todayTrips, 1);
    assert.equal(dashboard.stats.todayPassengers, 1);
    assert.equal(dashboard.stats.noShow, 1);
    assert.equal(dashboard.monthly.length, 6);
    assert.equal(
      dashboard.categories.find((c) => c.name === "REGULAR").value,
      1,
    );
    assert.equal((await call("ticketing", "StaffDashboard")).paid, 1);
  });
  it("allows public browsing and denies private data and direct table access", async () => {
    const data = await call(null, "BrowseSailings", {}, "anon");
    assert.equal(data.sailings[0].availableSeats, 2);
    assert.equal(data.sailings[0].origin.city, "Calapan");
    await assert.rejects(call(null, "MyBookings", {}, "anon"), /Sign in/);
    await db.exec("set role authenticated");
    try {
      await assert.rejects(
        db.exec("select * from public.booking"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("enforces ownership and rejects passenger access to admin and private functions", async () => {
    await reserve();
    assert.equal((await call("other", "MyBookings")).bookings.length, 0);
    await assert.rejects(call("passenger", "AdminUsers"), /Administrator/);
    await assert.rejects(call("passenger", "StaffBookings"), /Ticketing/);
    await assert.rejects(
      call("passenger", "CreateManagedUserProfile"),
      /account management/,
    );
    await db.exec("set role authenticated");
    try {
      await assert.rejects(
        db.query("select barkolink_private.execute($1,$2,$3,$4)", [
          "AdminUsers",
          {},
          ids.admin,
          "ADMIN",
        ]),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("creates passengers and fares atomically and prevents overselling", async () => {
    const b = await reserve("BK-TWO", 2);
    assert.equal(b.total, 1080);
    assert.equal(b.bookingPassengers_on_booking.length, 2);
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .availableSeats,
      0,
    );
    await assert.rejects(reserve("BK-OVER"), /enough available seats/);
    assert.equal((await call("passenger", "MyBookings")).bookings.length, 1);
  });
  it("rolls back all writes when a passenger is invalid", async () => {
    await assert.rejects(
      call("passenger", "ReserveSailing2", {
        ...reserveArgs("BK-BAD", 2),
        passenger2Name: "",
      }),
      /check constraint/,
    );
    assert.equal((await call("passenger", "MyBookings")).bookings.length, 0);
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .availableSeats,
      2,
    );
  });
  it("makes reservation retries idempotent and rejects conflicting references", async () => {
    await reserve();
    await call("passenger", "ReserveSailing1", reserveArgs());
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .availableSeats,
      1,
    );
    await assert.rejects(
      call("other", "ReserveSailing1", reserveArgs()),
      /already in use/,
    );
  });
  it("returns the stored seat count on cancellation and forbids repeated refunds", async () => {
    const b = await reserve();
    await assert.rejects(
      call("other", "CancelMyBooking", { id: b.id }),
      /not found/,
    );
    await call("passenger", "CancelMyBooking", {
      id: b.id,
      passengerCount: 999,
      sailingCode: "wrong",
    });
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .availableSeats,
      2,
    );
    await assert.rejects(
      call("passenger", "CancelMyBooking", { id: b.id }),
      /Only unpaid/,
    );
  });
  it("requires cash payment, issues tickets once and enforces boarding order", async () => {
    const b = await reserve();
    const passengerId = b.bookingPassengers_on_booking[0].id;
    await assert.rejects(
      call("boarding", "CheckInTicket", { passengerId }),
      /Payment/,
    );
    await assert.rejects(
      call("ticketing", "CollectBookingPayment", {
        bookingId: b.id,
        method: "CARD",
      }),
      /cash/,
    );
    await call("ticketing", "CollectBookingPayment", {
      bookingId: b.id,
      method: "CASH",
    });
    await assert.rejects(
      call("ticketing", "CollectBookingPayment", {
        bookingId: b.id,
        method: "CASH",
      }),
      /unpaid/,
    );
    await assert.rejects(
      call("passenger", "CancelMyBooking", { id: b.id }),
      /Only unpaid/,
    );
    assert.equal(
      (await call("passenger", "MyTickets")).bookingPassengers[0].ticketStatus,
      "ISSUED",
    );
    await assert.rejects(
      call("boarding", "BoardTicket", { passengerId }),
      /Check in first/,
    );
    await call("boarding", "CheckInTicket", { passengerId });
    await assert.rejects(
      call("boarding", "CheckInTicket", { passengerId }),
      /Only issued/,
    );
    await call("admin", "AdminUpdateSailingStatus", {
      code: "TEST-TRIP",
      status: "BOARDING",
    });
    await call("boarding", "BoardTicket", { passengerId });
    await assert.rejects(
      call("boarding", "BoardTicket", { passengerId }),
      /Check in first/,
    );
    assert.equal(
      (await call("boarding", "BoardingActivity", { sailingCode: "TEST-TRIP" }))
        .boardingEvents.length,
      2,
    );
    const reports = await call("admin", "AdminReports", {
      startAt: "2099-01-01",
      endAt: "2099-01-02",
    });
    assert.equal(reports.sailings[0].collectedRevenue, 600);
    assert.equal(reports.sailings[0].boarded, 1);
    const manifest = await call("admin", "AdminExportManifest", {
      sailingCode: "TEST-TRIP",
      offset: 0,
    });
    assert.equal(manifest.bookingPassengers[0].ticketStatus, "BOARDED");
  });
  it("uses trusted metadata and immediately applies staff demotions", async () => {
    await db.query(
      'update auth.users set raw_user_meta_data = raw_user_meta_data || \'{"role":"ADMIN"}\' where id=$1',
      [ids.passenger],
    );
    await assert.rejects(call("passenger", "AdminUsers"), /Administrator/);
    await db.query(
      'update auth.users set raw_app_meta_data = \'{"role":"PASSENGER"}\' where id=$1',
      [ids.admin],
    );
    await assert.rejects(call("admin", "AdminUsers"), /Administrator/);
  });
  it("creates trips with stored vessel fares and rejects unsafe edits/status changes", async () => {
    const args = {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-02-01T08:00:00Z",
      arrivalAt: "2099-02-01T10:00:00Z",
      durationMinutes: 120,
      regularFare: 1,
    };
    const data = await call("admin", "AdminCreateSailing", args);
    const trip = (await call("admin", "AdminSailings")).sailings.find(
      (s) => s.code === data.sailing_insert.code,
    );
    assert.ok(trip);
    assert.equal(trip.regularFare, 600);
    await reserve();
    await assert.rejects(
      call("admin", "AdminUpdateUnbookedSailing", {
        ...args,
        code: "TEST-TRIP",
      }),
      /Only unbooked/,
    );
    await assert.rejects(
      call("admin", "AdminUpdateSailingStatus", {
        code: "TEST-TRIP",
        status: "COMPLETED",
      }),
      /not allowed/,
    );
  });
  it("creates paid guest walk-ins and validates report ranges and operation names", async () => {
    await call("ticketing", "TicketingCreateGuestWalkIn", {
      sailingCode: "TEST-TRIP",
      guestUid: "guest-test",
      guestEmail: "guest@example.com",
      reference: "BK-GUEST",
      ticketCode: "66666666-6666-4666-8666-666666666666",
      passengerName: "Guest Passenger",
      passengerType: "REGULAR",
      method: "CASH",
    });
    const bookings = (await call("ticketing", "StaffBookings")).bookings;
    assert.equal(bookings[0].paymentStatus, "PAID");
    assert.equal(
      bookings[0].bookingPassengers_on_booking[0].ticketStatus,
      "ISSUED",
    );
    await assert.rejects(
      call("admin", "AdminReports", {
        startAt: "2020-01-01",
        endAt: "2025-01-01",
      }),
      /366 days/,
    );
    await assert.rejects(call("passenger", "Unknown"), /Unknown/);
  });
  it("returns the update acknowledgement and notification count when rescheduling", async () => {
    await reserve();
    const data = await call("admin", "AdminRescheduleSailing", {
      code: "TEST-TRIP",
      departureAt: "2099-03-01T08:00:00Z",
      arrivalAt: "2099-03-01T10:00:00Z",
      durationMinutes: 120,
    });
    assert.equal(data.sailing_update.code, "TEST-TRIP");
    assert.equal(data.notified, 1);
    const stats = await call("admin", "AdminDashboardStats", {
      dayStart: "2099-03-01",
      dayEnd: "2099-03-02",
    });
    assert.equal(stats.todaySailings[0]._count, 1);
    const updated = (await call("passenger", "MyBookings")).bookings[0];
    assert.equal(updated.sailing.departureAt, "2099-03-01T08:00:00+00:00");
  });
  it("expires unpaid reservations exactly once and restores seats and notifies their owner", async () => {
    const b = await reserve();
    const remaining = Date.parse(b.paymentDeadline) - Date.now();
    assert.ok(remaining > 23.9 * 3600000 && remaining <= 24 * 3600000);
    await db.query(
      "update public.booking set payment_deadline=now()-interval '1 second' where id=$1",
      [b.id],
    );
    const records = await call("passenger", "MyBookings");
    assert.equal(records.bookings[0].status, "EXPIRED");
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .availableSeats,
      2,
    );
    assert.equal(
      (await call(null, "BrowseSailings", {}, "anon")).sailings[0]
        .availableSeats,
      2,
    );
    await assert.rejects(
      call("ticketing", "CollectBookingPayment", {
        bookingId: b.id,
        method: "CASH",
      }),
      /deadline/,
    );
    assert.ok(
      (await call("passenger", "MyNotifications")).notifications.some(
        (n) => n.title === "Reservation expired",
      ),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.activity_log where action='RESERVATION_EXPIRED'",
        )
      ).rows[0].n,
      1,
    );
  });
  it("clamps the payment deadline to departure and restricts deadline settings to admin", async () => {
    await assert.rejects(
      call("passenger", "AdminSaveOperationsSettings", {
        reservationMinutes: 5,
      }),
      /Administrator/,
    );
    await call("admin", "AdminSaveOperationsSettings", {
      reservationMinutes: 30,
    });
    assert.equal(
      (await call("admin", "AdminOperationsSettings")).reservationMinutes,
      30,
    );
    await db.exec(
      "update public.sailing set departure_at=now()+interval '10 minutes',arrival_at=now()+interval '2 hours' where code='TEST-TRIP'",
    );
    const b = await reserve();
    assert.equal(b.paymentDeadline, b.sailing.departureAt);
  });
  it("blocks schedule overlaps on creation and rescheduling while allowing adjacent trips", async () => {
    await call("admin", "AdminSaveFareSettings", {
      vesselId: vessel,
      regularFare: 600,
      studentDiscount: 20,
      seniorDiscount: 20,
      childDiscount: 50,
      pwdDiscount: 20,
      pregnantDiscount: 0,
    });
    const args = {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-01-01T09:00:00Z",
      arrivalAt: "2099-01-01T11:00:00Z",
      durationMinutes: 120,
    };
    await assert.rejects(
      call("admin", "AdminCreateSailing", args),
      /overlapping/,
    );
    const trip = await call("admin", "AdminCreateSailing", {
      ...args,
      departureAt: "2099-01-01T10:00:00Z",
      arrivalAt: "2099-01-01T12:00:00Z",
    });
    await assert.rejects(
      call("admin", "AdminRescheduleSailing", {
        code: trip.sailing_insert.code,
        ...args,
      }),
      /overlapping/,
    );
  });
  it("requires staff verification for discounted reservations and stores the verifier", async () => {
    const b = await reserve("BK-DISCOUNT", 2);
    await assert.rejects(
      call("ticketing", "CollectBookingPayment", {
        bookingId: b.id,
        method: "CASH",
      }),
      /Verify/,
    );
    const student = b.bookingPassengers_on_booking.find(
      (p) => p.passengerType === "STUDENT",
    );
    await assert.rejects(
      call("passenger", "VerifyPassengerDiscount", {
        passengerId: student.id,
        note: "ID checked",
      }),
      /Ticketing/,
    );
    await call("ticketing", "VerifyPassengerDiscount", {
      passengerId: student.id,
      note: "Student ID checked",
    });
    await call("ticketing", "CollectBookingPayment", {
      bookingId: b.id,
      method: "CASH",
    });
    const updated = (await call("passenger", "MyBookings")).bookings[0];
    assert.equal(updated.paymentStatus, "PAID");
    assert.equal(
      updated.bookingPassengers_on_booking.find((p) => p.id === student.id)
        .discountVerifiedByUid,
      ids.ticketing,
    );
  });
  it("supports configurable pregnancy fares without assuming a mandatory discount", async () => {
    const b = await call("passenger", "ReserveSailing1", {
      ...reserveArgs("PREGNANT-ZERO"),
      passenger1Type: "PREGNANT",
    });
    const saved = (await call("passenger", "MyBookings")).bookings[0];
    assert.equal(saved.total, 600);
    await call("ticketing", "CollectBookingPayment", {
      bookingId: b.booking_insert.id,
      method: "CASH",
    });
    await call("admin", "AdminSaveFareSettings", {
      vesselId: vessel,
      regularFare: 600,
      studentDiscount: 20,
      seniorDiscount: 20,
      childDiscount: 50,
      pwdDiscount: 20,
      pregnantDiscount: 10,
    });
    const created = await call("admin", "AdminCreateSailing", {
      originPortId: origin,
      destinationPortId: destination,
      vesselId: vessel,
      departureAt: "2099-01-02T08:00:00Z",
      arrivalAt: "2099-01-02T10:00:00Z",
      durationMinutes: 120,
    });
    const trip = (await call("admin", "AdminSailings")).sailings.find(
      (s) => s.code === created.sailing_insert.code,
    );
    assert.equal(trip.pregnantFare, 540);
  });
  it("rejects unverified discounted walk-ins and atomically records verified discounts", async () => {
    const args = {
      sailingCode: "TEST-TRIP",
      guestUid: "walkin:test",
      guestEmail: "walkin@example.com",
      reference: "BK-VERIFIED",
      ticketCode: "66666666-6666-4666-8666-666666666666",
      passengerName: "Walk-in Student",
      passengerType: "STUDENT",
      method: "CASH",
    };
    await assert.rejects(
      call("ticketing", "TicketingCreateGuestWalkIn", args),
      /eligibility/,
    );
    assert.equal((await call("ticketing", "StaffBookings")).bookings.length, 0);
    await call("ticketing", "TicketingCreateGuestWalkIn", {
      ...args,
      discountVerified: true,
      verificationNote: "Student ID checked",
    });
    const person = (await call("ticketing", "StaffBookings")).bookings[0]
      .bookingPassengers_on_booking[0];
    assert.ok(person.discountVerifiedAt);
    assert.equal(person.discountVerifiedByUid, ids.ticketing);
  });
  it("cancels a trip, tracks paid refunds and prevents duplicate cash refunds", async () => {
    const b = await reserve();
    await call("ticketing", "CollectBookingPayment", {
      bookingId: b.id,
      method: "CASH",
    });
    const pending = await reserve("BK-UNPAID");
    await call("admin", "AdminUpdateSailingStatus", {
      code: "TEST-TRIP",
      status: "CANCELLED",
      reason: "Weather cancellation",
    });
    const cancelled = (await call("ticketing", "StaffBookings")).bookings;
    assert.equal(
      cancelled.find((x) => x.id === b.id).paymentStatus,
      "REFUND_PENDING",
    );
    assert.equal(
      cancelled.find((x) => x.id === pending.id).paymentStatus,
      "UNPAID",
    );
    assert.equal(
      (await call("boarding", "BoardingManifest", { sailingCode: "TEST-TRIP" }))
        .bookings.length,
      0,
    );
    const range = { startAt: "2099-01-01", endAt: "2099-01-02" };
    const report = (await call("admin", "AdminReports", range)).sailings[0];
    assert.equal(report.refundPending, 600);
    assert.equal(report.collectedRevenue, 600);
    await assert.rejects(
      call("passenger", "RefundBooking", {
        bookingId: b.id,
        note: "Cash returned",
      }),
      /Ticketing/,
    );
    await call("ticketing", "RefundBooking", {
      bookingId: b.id,
      note: "Cash returned, receipt TEST-01",
    });
    await assert.rejects(
      call("ticketing", "RefundBooking", {
        bookingId: b.id,
        note: "Cash returned again",
      }),
      /awaiting a refund/,
    );
    const refunded = (await call("admin", "AdminReports", range)).sailings[0];
    assert.equal(refunded.collectedRevenue, 0);
    assert.equal(refunded.refundedRevenue, 600);
    const trip = (await call("admin", "AdminSailings")).sailings[0];
    assert.equal(trip.availableSeats, 2);
    await assert.rejects(
      call("admin", "AdminUpdateSailingStatus", {
        code: "TEST-TRIP",
        status: "CANCELLED",
        reason: "Again",
      }),
      /Only active/,
    );
  });
  it("paginates filtered staff records and protects activity logs", async () => {
    const first = await reserve("FIRST");
    await reserve("SECOND");
    await call("passenger", "CancelMyBooking", { id: first.id });
    const page = await call("ticketing", "StaffBookings", {
      page: 0,
      pageSize: 1,
      status: "UNPAID",
      search: "SECOND",
    });
    assert.equal(page.totalCount, 1);
    assert.equal(page.bookings[0].reference, "SECOND");
    assert.equal(
      (await call("ticketing", "StaffBookings", { page: 1, pageSize: 1 }))
        .bookings.length,
      1,
    );
    await assert.rejects(
      call("ticketing", "AdminActivityLog"),
      /Administrator/,
    );
    const log = await call("admin", "AdminActivityLog");
    assert.ok(log.records.some((r) => r.entityType === "booking"));
    assert.ok(log.totalCount > 0);
    await db.exec("set role authenticated");
    try {
      await assert.rejects(
        db.exec("select * from public.activity_log"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("removes cancelled checked-in passengers from terminal counts and blocks cancellation after boarding", async () => {
    const b = await reserve();
    await call("ticketing", "CollectBookingPayment", {
      bookingId: b.id,
      method: "CASH",
    });
    const passengerId = b.bookingPassengers_on_booking[0].id;
    await call("boarding", "CheckInTicket", { passengerId });
    await call("admin", "AdminUpdateSailingStatus", {
      code: "TEST-TRIP",
      status: "CANCELLED",
      reason: "Weather",
    });
    const stats = await call("admin", "AdminDashboardStats", {
      dayStart: "2099-01-01",
      dayEnd: "2099-01-02",
    });
    assert.equal(stats.checkedInPassengers[0]._count, 0);
    assert.equal(stats.allPassengers[0]._count, 0);
    await assert.rejects(
      call("boarding", "BoardTicket", { passengerId }),
      /Payment/,
    );
    await db.exec(
      "update public.sailing set status='BOARDING' where code='TEST-TRIP'; update public.booking set status='CONFIRMED',payment_status='PAID'; update public.booking_passenger set ticket_status='BOARDED'",
    );
    await assert.rejects(
      call("admin", "AdminUpdateSailingStatus", {
        code: "TEST-TRIP",
        status: "CANCELLED",
        reason: "Weather",
      }),
      /boarded passengers/,
    );
  });
  it("isolates saved travelers, enforces ownership and validates birth dates", async () => {
    const args = {
      fullName: "Saved Passenger",
      birthDate: "1990-01-01",
      sex: "FEMALE",
      phone: "09123456789",
      nationality: "Filipino",
    };
    const saved = await call("passenger", "MySaveTraveler", args);
    assert.equal(
      (await call("passenger", "MySavedTravelers")).travelers.length,
      1,
    );
    assert.equal((await call("other", "MySavedTravelers")).travelers.length, 0);
    await assert.rejects(
      call("other", "MyDeleteTraveler", { id: saved.id }),
      /not found/,
    );
    await assert.rejects(
      call("other", "MySaveTraveler", { ...args, id: saved.id }),
      /not found/,
    );
    await assert.rejects(
      call("passenger", "MySaveTraveler", { ...args, birthDate: "2199-01-01" }),
      /future/,
    );
    await assert.rejects(call("admin", "MySavedTravelers"), /Passenger access/);
    await call("passenger", "MyDeleteTraveler", { id: saved.id });
    assert.equal(
      (await call("passenger", "MySavedTravelers")).travelers.length,
      0,
    );
  });
  it("publishes only effective advisories for the selected sailing and restricts authors", async () => {
    const args = {
      title: "Travel update",
      message: "Please check the terminal notice.",
      category: "WEATHER",
      priority: "HIGH",
      startsAt: "2000-01-01T00:00:00Z",
      endsAt: "2099-01-01T00:00:00Z",
      published: true,
      sailingCode: null,
    };
    await assert.rejects(
      call("passenger", "AdminSaveAdvisory", args),
      /Administrator/,
    );
    await assert.rejects(call(null, "ActiveAdvisories", {}, "anon"), /Sign in/);
    const global = await call("admin", "AdminSaveAdvisory", args);
    await call("admin", "AdminSaveAdvisory", {
      ...args,
      title: "Trip update",
      sailingCode: "TEST-TRIP",
    });
    await call("admin", "AdminSaveAdvisory", {
      ...args,
      title: "Draft update",
      published: false,
    });
    await call("admin", "AdminSaveAdvisory", {
      ...args,
      title: "Expired update",
      endsAt: "2001-01-01T00:00:00Z",
    });
    assert.equal(
      (await call("passenger", "ActiveAdvisories")).advisories.length,
      1,
    );
    assert.equal(
      (
        await call("passenger", "ActiveAdvisories", {
          sailingCode: "TEST-TRIP",
        })
      ).advisories.length,
      2,
    );
    assert.equal((await call("admin", "AdminAdvisories")).advisories.length, 4);
    await call("admin", "AdminSaveAdvisory", {
      ...args,
      id: global.id,
      published: false,
    });
    assert.equal(
      (await call("passenger", "ActiveAdvisories")).advisories.length,
      0,
    );
    await assert.rejects(
      call("admin", "AdminSaveAdvisory", { ...args, endsAt: args.startsAt }),
      /check constraint/,
    );
  });
  it("bulk marks only the current account notifications and remains safe to repeat", async () => {
    await db.query(
      "insert into public.notification(owner_uid,title,message) values ($1,'Own','Test'),($2,'Other','Test')",
      [ids.passenger, ids.other],
    );
    assert.equal(
      (await call("passenger", "MyMarkAllNotificationsRead")).marked,
      1,
    );
    assert.equal(
      (await call("passenger", "MyMarkAllNotificationsRead")).marked,
      0,
    );
    assert.equal(
      (await call("other", "MyNotifications")).notifications[0].readAt,
      null,
    );
  });
  it("reconciles only paid non-boarded passengers on departed completed sailings", async () => {
    await db.exec("update public.sailing set available_seats=10");
    await call("passenger", "ReserveSailing2", {
      ...reserveArgs("BK-PAID", 2),
      passenger2Type: "REGULAR",
    });
    const b = (await call("passenger", "MyBookings")).bookings[0];
    await call("ticketing", "CollectBookingPayment", {
      bookingId: b.id,
      method: "CASH",
    });
    await reserve("BK-UNPAID");
    const boardedId = b.bookingPassengers_on_booking[0].id;
    await call("boarding", "CheckInTicket", { passengerId: boardedId });
    await call("admin", "AdminUpdateSailingStatus", {
      code: "TEST-TRIP",
      status: "BOARDING",
    });
    await call("boarding", "BoardTicket", { passengerId: boardedId });
    await assert.rejects(
      call("passenger", "AdminTripOperations", { code: "TEST-TRIP" }),
      /Administrator/,
    );
    await assert.rejects(
      call("admin", "AdminReconcileNoShows", { code: "TEST-TRIP" }),
      /Complete/,
    );
    await db.exec("update public.sailing set status='COMPLETED'");
    await assert.rejects(
      call("admin", "AdminReconcileNoShows", { code: "TEST-TRIP" }),
      /Complete/,
    );
    await db.exec(
      "update public.sailing set departure_at='2020-01-01T08:00:00Z',arrival_at='2020-01-01T10:00:00Z'",
    );
    const seats = (await db.query("select available_seats from public.sailing"))
      .rows[0].available_seats;
    assert.equal(
      (await call("admin", "AdminReconcileNoShows", { code: "TEST-TRIP" }))
        .marked,
      1,
    );
    assert.equal(
      (await call("admin", "AdminReconcileNoShows", { code: "TEST-TRIP" }))
        .marked,
      0,
    );
    const operations = await call("admin", "AdminTripOperations", {
      code: "TEST-TRIP",
    });
    assert.equal(operations.bookings.length, 2);
    assert.equal(operations.passengers.filter((p) => p.noShow).length, 1);
    assert.equal(
      operations.passengers.find((p) => p.id === boardedId).noShow,
      false,
    );
    assert.equal(
      (await db.query("select available_seats from public.sailing")).rows[0]
        .available_seats,
      seats,
    );
    await assert.rejects(
      call("boarding", "BoardTicket", {
        passengerId: b.bookingPassengers_on_booking[1].id,
      }),
      /Check in first/,
    );
    assert.equal(
      operations.activity.filter((a) => a.action === "NO_SHOW_RECONCILED")
        .length,
      1,
    );
  });

  it("saves profile identity atomically without changing role, email or another account", async () => {
    await db.query(
      'update auth.users set raw_user_meta_data = raw_user_meta_data || \'{"preference":"keep"}\'::jsonb where id=$1',
      [ids.passenger],
    );
    await call("passenger", "UpdateMyProfile", {
      fullName: "  Maria   Santos  ",
      phone: "+63 (912) 345-6789",
      role: "ADMIN",
      email: "changed@example.com",
      uid: ids.other,
    });
    const profile = (await call("passenger", "MyProfile")).user;
    assert.equal(profile.fullName, "Maria Santos");
    assert.equal(profile.phone, "+639123456789");
    assert.equal(profile.role, "PASSENGER");
    assert.equal(profile.email, "passenger@example.com");
    const user = (
      await db.query(
        "select raw_user_meta_data,raw_app_meta_data from auth.users where id=$1",
        [ids.passenger],
      )
    ).rows[0];
    assert.equal(user.raw_user_meta_data.fullName, "Maria Santos");
    assert.equal(user.raw_user_meta_data.preference, "keep");
    assert.equal(user.raw_app_meta_data.role, "PASSENGER");
    assert.equal((await call("other", "MyProfile")).user.fullName, "other");
    await assert.rejects(
      call("passenger", "UpdateMyProfile", {
        fullName: "New name",
        phone: "invalid",
      }),
      /valid contact/,
    );
    assert.equal(
      (await call("passenger", "MyProfile")).user.fullName,
      "Maria Santos",
    );
    assert.equal(
      (
        await db.query(
          "select raw_user_meta_data from auth.users where id=$1",
          [ids.passenger],
        )
      ).rows[0].raw_user_meta_data.fullName,
      "Maria Santos",
    );
    await assert.rejects(
      call("passenger", "UpdateMyProfile", { fullName: "   " }),
      /full name/,
    );
    await assert.rejects(
      call(null, "UpdateMyProfile", { fullName: "Anonymous" }, "anon"),
      /Sign in/,
    );
    await call("passenger", "UpdateMyProfile", {
      fullName: "Maria Santos",
      phone: null,
    });
    assert.equal((await call("passenger", "MyProfile")).user.phone, null);
    await db.exec(
      "alter table public.app_user add constraint test_phone_reject check (phone is distinct from '+639123456789')",
    );
    try {
      await assert.rejects(
        call("passenger", "UpdateMyProfile", {
          fullName: "Must roll back",
          phone: "+639123456789",
        }),
        /test_phone_reject/,
      );
      assert.equal(
        (await call("passenger", "MyProfile")).user.fullName,
        "Maria Santos",
      );
      assert.equal(
        (
          await db.query(
            "select raw_user_meta_data from auth.users where id=$1",
            [ids.passenger],
          )
        ).rows[0].raw_user_meta_data.fullName,
        "Maria Santos",
      );
    } finally {
      await db.exec(
        "alter table public.app_user drop constraint test_phone_reject",
      );
    }
  });
});
