export function validatedProfile(name: string, phone: string) {
  const fullName = name.trim().replace(/\s+/g, " ");
  const mobile = phone.trim().replace(/[\s()-]/g, "");
  if (!fullName || fullName.length > 120)
    throw new Error("Enter your full name using 1 to 120 characters.");
  if (mobile && !/^\+?\d{7,15}$/.test(mobile))
    throw new Error(
      "Enter a valid contact number with 7 to 15 digits, optionally starting with +.",
    );
  return { fullName, phone: mobile || null };
}
