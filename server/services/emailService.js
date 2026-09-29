import nodemailer from "nodemailer";

const safeErrorInfo = (error) => ({
  name: error?.name,
  message: error?.message,
  code: error?.code,
  status: error?.status,
  responseCode: error?.responseCode,
});

const formatDateTime = (value) => {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM
  );

const createTransporter = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.MONGO_TEST_URI);

  const timeoutMs = isTestEnv ? 1000 : 10000;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
};

const sendTransactionalEmail = async ({ to, subject, text, html }) => {
  if (!to) {
    return { success: false, skipped: true, reason: "No recipient email provided" };
  }

  if (!isSmtpConfigured()) {
    console.info("[EMAIL] SMTP not configured; skipping transactional email", {
      recipient: to,
      subject,
    });
    return { success: false, skipped: true, reason: "SMTP not configured" };
  }

  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.info("[EMAIL] Transporter unavailable; skipping transactional email", {
        recipient: to,
        subject,
      });
      return { success: false, skipped: true, reason: "Transporter unavailable" };
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: info?.messageId,
      accepted: info?.accepted || [],
    };
  } catch (error) {
    console.error("[EMAIL ERROR]", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      status: error?.status,
      responseCode: error?.responseCode,
    });

    return {
      success: false,
      skipped: false,
      reason: "Email delivery failed",
    };
  }
};

const renderRideSummary = ({
  source,
  destination,
  date,
  driverName,
  seatCount,
  contribution,
  rideReference,
}) => `
  <p><strong>Route:</strong> ${escapeHtml(source || "Unknown")} → ${escapeHtml(destination || "Unknown")}</p>
  <p><strong>Date and time:</strong> ${formatDateTime(date)}</p>
  <p><strong>Driver:</strong> ${escapeHtml(driverName || "Driver")}</p>
  <p><strong>Ride reference:</strong> ${escapeHtml(rideReference || "N/A")}</p>
  ${seatCount !== undefined ? `<p><strong>Seats booked:</strong> ${seatCount}</p>` : ""}
  ${contribution !== undefined ? `<p><strong>Suggested contribution:</strong> $${Number(contribution).toFixed(2)}</p>` : ""}
`;

export const sendBookingConfirmationEmail = async ({
  passengerEmail,
  passengerName,
  driverName,
  source,
  destination,
  date,
  seats,
  contribution,
  rideReference,
}) => {
  const subject = "Your ride booking is confirmed";
  const text = `Hello ${passengerName || "Passenger"},\n\nYour ride booking has been confirmed.\n\nDriver: ${driverName || "Driver"}\nRoute: ${source || "Unknown"} → ${destination || "Unknown"}\nDate and time: ${formatDateTime(date)}\nSeats booked: ${seats || 1}\nSuggested contribution: $${Number(contribution || 0).toFixed(2)}\nRide reference: ${rideReference || "N/A"}\n\nThank you for using CarpoolConnect.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 12px;">Booking confirmed</h2>
      <p>Hello ${escapeHtml(passengerName || "Passenger")},</p>
      <p>Your ride booking has been confirmed.</p>
      ${renderRideSummary({
        source,
        destination,
        date,
        driverName,
        seatCount: seats,
        contribution,
        rideReference,
      })}
      <p>Thank you for using CarpoolConnect.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to: passengerEmail,
    subject,
    text,
    html,
  });
};

export const sendBookingCancellationEmail = async ({
  passengerEmail,
  passengerName,
  driverName,
  source,
  destination,
  date,
  seats,
  contribution,
  rideReference,
}) => {
  const subject = "Your booking has been cancelled";
  const text = `Hello ${passengerName || "Passenger"},\n\nYour booking has been cancelled.\n\nDriver: ${driverName || "Driver"}\nRoute: ${source || "Unknown"} → ${destination || "Unknown"}\nDate and time: ${formatDateTime(date)}\nSeats cancelled: ${seats || 1}\nSuggested contribution: $${Number(contribution || 0).toFixed(2)}\nRide reference: ${rideReference || "N/A"}\n\nYou can still browse other rides on CarpoolConnect.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 12px;">Booking cancelled</h2>
      <p>Hello ${escapeHtml(passengerName || "Passenger")},</p>
      <p>Your booking has been cancelled.</p>
      ${renderRideSummary({
        source,
        destination,
        date,
        driverName,
        seatCount: seats,
        contribution,
        rideReference,
      })}
      <p>You can still browse other rides on CarpoolConnect.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to: passengerEmail,
    subject,
    text,
    html,
  });
};

export const sendRideCancellationEmail = async ({
  passengerEmail,
  passengerName,
  driverName,
  source,
  destination,
  date,
  seats,
  rideReference,
  cancellationReason,
}) => {
  const subject = "A ride you booked has been cancelled";
  const text = `Hello ${passengerName || "Passenger"},\n\nA ride you booked has been cancelled.\n\nDriver: ${driverName || "Driver"}\nRoute: ${source || "Unknown"} → ${destination || "Unknown"}\nDate and time: ${formatDateTime(date)}\nSeats affected: ${seats || 1}\nRide reference: ${rideReference || "N/A"}\n${cancellationReason ? `Reason: ${cancellationReason}\n` : ""}Please review your upcoming trips in the app.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 12px;">Ride cancelled</h2>
      <p>Hello ${escapeHtml(passengerName || "Passenger")},</p>
      <p>A ride you booked has been cancelled.</p>
      ${renderRideSummary({
        source,
        destination,
        date,
        driverName,
        seatCount: seats,
        rideReference,
      })}
      ${cancellationReason ? `<p><strong>Reason:</strong> ${escapeHtml(cancellationReason)}</p>` : ""}
      <p>Please review your upcoming trips in the app.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to: passengerEmail,
    subject,
    text,
    html,
  });
};

export const sendRideCompletionEmail = async ({
  passengerEmail,
  passengerName,
  driverName,
  source,
  destination,
  date,
  rideReference,
}) => {
  const subject = "Your ride has been completed";
  const text = `Hello ${passengerName || "Passenger"},\n\nYour ride has been completed.\n\nDriver: ${driverName || "Driver"}\nRoute: ${source || "Unknown"} → ${destination || "Unknown"}\nDate and time: ${formatDateTime(date)}\nRide reference: ${rideReference || "N/A"}\n\nThanks for riding with CarpoolConnect.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 12px;">Ride completed</h2>
      <p>Hello ${escapeHtml(passengerName || "Passenger")},</p>
      <p>Your ride has been completed.</p>
      ${renderRideSummary({
        source,
        destination,
        date,
        driverName,
        rideReference,
      })}
      <p>Thanks for riding with CarpoolConnect.</p>
    </div>
  `;

  return sendTransactionalEmail({
    to: passengerEmail,
    subject,
    text,
    html,
  });
};

/**
 * Password reset email.
 *
 * Reuses the existing transporter, timeout, escaping and graceful
 * degradation: if SMTP is not configured this is skipped with a log line
 * rather than throwing, and a delivery failure never blocks the endpoint.
 */
export const sendPasswordResetEmail = async ({
  to,
  name,
  resetUrl,
  expiresInMinutes = 60,
}) => {
  const subject = "Reset your CarpoolConnect password";
  const safeUrl = escapeHtml(resetUrl);

  const text = `Hello ${name || "there"},\n\nWe received a request to reset your CarpoolConnect password.\n\nOpen this link to choose a new one:\n${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes and can only be used once.\n\nIf you did not request this, you can safely ignore this email. Your password has not changed.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16211d; max-width: 560px;">
      <h2 style="margin-bottom: 12px; color: #12332a;">Reset your password</h2>
      <p>Hello ${escapeHtml(name || "there")},</p>
      <p>We received a request to reset your CarpoolConnect password.</p>
      <p style="margin: 20px 0;">
        <a href="${safeUrl}" style="background:#2e7d62;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:bold;">Choose a new password</a>
      </p>
      <p style="font-size: 13px; color: #6b7a73; word-break: break-all;">If the button does not work, copy this link into your browser:<br />${safeUrl}</p>
      <p style="font-size: 13px; color: #6b7a73;">This link expires in ${escapeHtml(expiresInMinutes)} minutes and can only be used once.</p>
      <p style="font-size: 13px; color: #6b7a73;">If you did not request this, you can safely ignore this email. Your password has not changed.</p>
    </div>
  `;

  return sendTransactionalEmail({ to, subject, text, html });
};

export const isEmailConfigured = () => isSmtpConfigured();
export { safeErrorInfo };

