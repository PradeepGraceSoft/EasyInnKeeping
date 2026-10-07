export const AlertMessages = {
  // CRM Campaign
  CAMPAIGN_NO_EMAIL_FOR_FILTER: "No email found for the given filter criteria",

  // PMS - Login
  LOGIN_INVALID_CREDENTIALS: "Invalid Credentials!",

  LOGIN_LOCKED_TWO_ATTEMPTS_LEFT:
    "You have 2 more attempts before your account is locked. Use 'Forgot Password' option instead.",

  LOGIN_LOCKED_ONE_ATTEMPTS_LEFT:
    "You have 1 more attempts before your account is locked. Use 'Forgot Password' option instead.",

  LOGIN_LOCKED_ACCOUNT: "Your User Account Locked! Please Reset Your Password.",

  LOGIN_EMPTY_ALL_CREDENTIALS:
    "Password should not be blank\n" +
    "User Name should not be blank\n" +
    "Property Short Name should not be blank",

  LOGIN_EMPTY_SHORT_NAME: "Property Short Name should not be blank",

  // Reservation
  RESERVATION_SAVED_SUCCESS: "Saved successfully",

  RESERVATION_CANCELLED_SUCCESS: "Cancelled Successfully!",

  RESERVATION_CANCELLED_RESTORE: "Restored Successfully!",

  RESERVATION_DELETE_SUCCESS: "Deleted Successfully!",

  RESERVATION_PAYMENT_PROCESS_SUCCESS: "Transaction Successful",

  RESERVATION_PAYMENT_VOIDED_SUCCESS: "Transaction Voided successfully",

  RESERVATION_PAYMENT_REFUND_DECLINED:
    "Refund declined by the payment gateway.",

  RESERVATION_PAYMENT_VOID_REQUIRES_REFUND:
    "The trasaction could not be VOIDED. Please issue a refund.",

  RESERVATION_PAYMENT_VOID_DECLINED: "The trasaction could not be VOIDED.",

  RESERVATION_LIST_NO_RESERVATION_DELETE: "No Reservations Selected!",

  SHARED_ROOM_EDIT_WARNING:
    "Editing this room will update all shared guest room details, except for the Rate Name, Number of Guests, Unit Rate, and Unit Total. Do you want to continue?",

  // Billing
  BILLING_SAVED_SUCCESS: "Saved successfully.",

  BILLING_EMAIL_SUCCESS: "Invoice emailed successfully.",

  // Setup Pages
  SETUP_PAGE_SAVED: "Records Updated Successfully.",

  SETUP_PAGE_PHOTOGALLERY_RESET: "Records Reseted Successfully.",

  // Online
  ONLINE_DEFAULT_GUEST_EXCEEDS:
    "Rooms / Rates are not available for the selected number of guests.",

  ONLINE_PROMO_CODE_APPLIED: "Promo Code Applied Successfully.",
} as const;
