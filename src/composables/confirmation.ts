import { alertController } from "@ionic/vue";

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

// Ionic renders alert messages as HTML. Treat booking names and references as text.
function escapeText(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export async function confirmAction(
  options: ConfirmationOptions,
): Promise<boolean> {
  const dialog = await alertController.create({
    header: options.title,
    message: escapeText(options.message),
    cssClass: options.danger
      ? "barkolink-confirmation destructive-confirmation"
      : "barkolink-confirmation",
    backdropDismiss: false,
    buttons: [
      { text: "Go back", role: "cancel", cssClass: "confirmation-back" },
      {
        text: options.confirmText || "Confirm",
        role: "confirm",
        cssClass: "confirmation-proceed",
      },
    ],
  });
  await dialog.present();
  return (await dialog.onDidDismiss()).role === "confirm";
}

export async function requestReason(
  options: ConfirmationOptions,
): Promise<string | null> {
  let reason: string | null = null;
  const dialog = await alertController.create({
    header: options.title,
    message: escapeText(options.message),
    cssClass: "barkolink-confirmation destructive-confirmation",
    backdropDismiss: false,
    inputs: [
      {
        name: "reason",
        type: "textarea",
        placeholder: "Explain the reason (3–160 characters)",
        attributes: { maxlength: 160, "aria-label": "Cancellation reason" },
      },
    ],
    buttons: [
      { text: "Go back", role: "cancel", cssClass: "confirmation-back" },
      {
        text: "Continue",
        role: "confirm",
        cssClass: "confirmation-proceed",
        handler: (values: { reason?: string }) => {
          const value = values.reason?.trim() || "";
          if (value.length < 3 || value.length > 160) {
            dialog.message = escapeText(
              "Enter a cancellation reason of 3 to 160 characters. Paid bookings will require a cash refund.",
            );
            return false;
          }
          reason = value;
          return true;
        },
      },
    ],
  });
  await dialog.present();
  return (await dialog.onDidDismiss()).role === "confirm" ? reason : null;
}
