export const discountTypes = [
  { key: "studentDiscount", fareKey: "studentFare", label: "Student" },
  { key: "seniorDiscount", fareKey: "seniorFare", label: "Senior" },
  { key: "childDiscount", fareKey: "childFare", label: "Child" },
  { key: "pwdDiscount", fareKey: "pwdFare", label: "PWD" },
  {
    key: "pregnantDiscount",
    fareKey: "pregnantFare",
    label: "Pregnant (operator policy)",
  },
] as const;

export type FareSettings = {
  passengerDiscounts?: CustomDiscount[] | null;
  customDiscounts?: CustomDiscount[];
  regularFare: number;
  studentDiscount: number;
  seniorDiscount: number;
  childDiscount: number;
  pwdDiscount: number;
  pregnantDiscount?: number;
};

export type CustomDiscount = {
  id: string;
  name: string;
  percentage: number;
  isActive: boolean;
};
export type CustomDiscountFare = CustomDiscount & { fare: number };
const reservedNames = [
  "regular",
  "student",
  "senior",
  "senior citizen",
  "child",
  "pwd",
  "pregnant",
  "pregnant (operator policy)",
];
function discountCollectionError(
  discounts: CustomDiscount[] = [],
  allowStandard = false,
) {
  if (discounts.length > 20)
    return "Use at most 20 custom discounts per vessel.";
  const names = new Set<string>(),
    ids = new Set<string>();
  for (const discount of discounts) {
    const name = discount.name.trim().replace(/\s+/g, " ").toLowerCase();
    const uniqueName = passengerTypeCode(name).toLowerCase();
    if (!name || name.length > 60)
      return "Enter a discount name from 1 to 60 characters.";
    if (
      name === "regular" ||
      (!allowStandard && reservedNames.includes(name)) ||
      names.has(uniqueName)
    )
      return allowStandard
        ? "Use unique discount names. Regular is the base fare."
        : "Use unique names different from the standard passenger types.";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        discount.id,
      ) ||
      ids.has(discount.id)
    )
      return "Each discount needs a unique ID.";
    if (
      !Number.isInteger(discount.percentage) ||
      discount.percentage < 0 ||
      discount.percentage > 99
    )
      return "Discount percentages must be whole numbers from 0 to 99%.";
    if (typeof discount.isActive !== "boolean")
      return "Choose whether the discount is active.";
    names.add(uniqueName);
    ids.add(discount.id);
  }
  return "";
}
export function customDiscountError(discounts: CustomDiscount[] = []) {
  return discountCollectionError(discounts);
}
export function passengerDiscountError(discounts?: CustomDiscount[] | null) {
  return discountCollectionError(discounts ?? [], true);
}
export function passengerDiscountsForSettings(
  settings: FareSettings,
): CustomDiscount[] {
  return (
    settings.passengerDiscounts ?? [
      ...discountTypes.map((type, index) => ({
        id: "ffffffff-0000-4000-8000-00000000000" + (index + 1),
        name: type.key === "pregnantDiscount" ? "Pregnant" : type.label,
        percentage: settings[type.key] ?? 0,
        isActive: true,
      })),
      ...(settings.customDiscounts || []),
    ]
  );
}
export function copyFareSettings(settings: FareSettings): FareSettings {
  return {
    ...settings,
    passengerDiscounts: passengerDiscountsForSettings(settings).map((d) => ({
      ...d,
      name: d.name.trim().replace(/\s+/g, " "),
    })),
    customDiscounts: (settings.customDiscounts || []).map((discount) => ({
      ...discount,
      name: discount.name.trim().replace(/\s+/g, " "),
    })),
  };
}
export function discountFare(regularFare: number, percentage: number) {
  return Math.max(1, Math.round((regularFare * (100 - percentage)) / 100));
}
export function passengerTypeCode(type: string) {
  const upper = type.toUpperCase();
  return upper === "PREGNANT (OPERATOR POLICY)"
    ? "PREGNANT"
    : upper === "SENIOR CITIZEN"
      ? "SENIOR"
      : ["REGULAR", "STUDENT", "SENIOR", "CHILD", "PWD", "PREGNANT"].includes(
            upper,
          )
        ? upper
        : type;
}
export function passengerFare(
  trip: {
    regularFare: number;
    studentFare: number;
    seniorFare: number;
    childFare: number;
    pwdFare: number;
    pregnantFare?: number;
    customDiscounts?: CustomDiscountFare[];
    passengerDiscounts?: CustomDiscountFare[] | null;
  },
  type: string,
) {
  const code = passengerTypeCode(type);
  if (code !== "REGULAR" && trip.passengerDiscounts != null)
    return (
      trip.passengerDiscounts.find(
        (d) => d.name === type || passengerTypeCode(d.name) === code,
      )?.fare ?? 0
    );
  const keys: Record<
    string,
    | "regularFare"
    | "studentFare"
    | "seniorFare"
    | "childFare"
    | "pwdFare"
    | "pregnantFare"
  > = {
    REGULAR: "regularFare",
    STUDENT: "studentFare",
    SENIOR: "seniorFare",
    CHILD: "childFare",
    PWD: "pwdFare",
    PREGNANT: "pregnantFare",
  };
  if (Object.prototype.hasOwnProperty.call(keys, code))
    return trip[keys[code]] ?? trip.regularFare;
  return (
    trip.customDiscounts?.find((discount) => discount.name === type)?.fare ?? 0
  );
}

// Match the existing create-trip defaults until administrators save their rates.
export const defaultFareSettings: FareSettings = {
  regularFare: 500,
  studentDiscount: 20,
  seniorDiscount: 20,
  childDiscount: 20,
  pwdDiscount: 20,
  pregnantDiscount: 0,
};

export function validFareSettings(settings: FareSettings) {
  return (
    Number.isSafeInteger(settings.regularFare) &&
    settings.regularFare > 0 &&
    settings.regularFare <= 2147483647 &&
    discountTypes.every(
      (type) =>
        Number.isInteger(settings[type.key] ?? 0) &&
        (settings[type.key] ?? 0) >= 0 &&
        (settings[type.key] ?? 0) < 100,
    ) &&
    !(settings.passengerDiscounts != null
      ? passengerDiscountError(settings.passengerDiscounts)
      : customDiscountError(settings.customDiscounts))
  );
}

export function calculateFares(regularFare: number, settings: FareSettings) {
  const percentage = (type: (typeof discountTypes)[number]) =>
    settings.passengerDiscounts != null
      ? (settings.passengerDiscounts.find(
          (d) =>
            d.isActive &&
            passengerTypeCode(d.name) ===
              passengerTypeCode(
                type.key === "pregnantDiscount" ? "Pregnant" : type.label,
              ),
        )?.percentage ?? 0)
      : (settings[type.key] ?? 0);
  return {
    regularFare,
    ...Object.fromEntries(
      discountTypes.map((type) => [
        type.fareKey,
        Math.max(1, Math.round((regularFare * (100 - percentage(type))) / 100)),
      ]),
    ),
  } as {
    regularFare: number;
    studentFare: number;
    seniorFare: number;
    childFare: number;
    pwdFare: number;
    pregnantFare: number;
  };
}

export function passengerDiscountChoices(trip: {
  passengerDiscounts?: CustomDiscountFare[] | null;
  customDiscounts?: CustomDiscountFare[];
  regularFare: number;
  studentFare: number;
  seniorFare: number;
  childFare: number;
  pwdFare: number;
  pregnantFare?: number;
}): CustomDiscountFare[] {
  return (
    trip.passengerDiscounts ?? [
      ...discountTypes.map((d, index) => ({
        id: "legacy-" + index,
        name: d.key === "pregnantDiscount" ? "Pregnant" : d.label,
        percentage: Math.round(
          100 -
            ((trip[d.fareKey] ?? trip.regularFare) * 100) / trip.regularFare,
        ),
        isActive: true,
        fare: trip[d.fareKey] ?? trip.regularFare,
      })),
      ...(trip.customDiscounts || []),
    ]
  );
}
