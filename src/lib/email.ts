// src/lib/email.ts
import Mailgun from 'mailgun.js';
import formData from 'form-data';
// Remove the specific interface import:
// import { IMailgunClient } from 'mailgun.js/interfaces';

interface EmailParams {
    to: string;
    taskName: string;
    messageContent: string;
    publicLink: string;
    senderName: string;
}

// Configure Mailgun Client
const API_KEY = process.env.MAILGUN_API_KEY;
const DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL;
const API_URL = process.env.MAILGUN_API_URL; // Optional

// --- Environment Variable Checks ---
// ... keep checks ...
if (!API_KEY) console.warn("MAILGUN_API_KEY environment variable is not set. Email sending will be disabled.");
if (!DOMAIN) console.warn("MAILGUN_DOMAIN environment variable is not set. Email sending will be disabled.");
if (!FROM_EMAIL) console.warn("MAILGUN_FROM_EMAIL environment variable is not set. Email sending will be disabled.");


// ***** Infer the client type *****
// Declare mg without an explicit type initially, or use ReturnType
let mg: ReturnType<InstanceType<typeof Mailgun>['client']> | null = null;
// Or simpler, let TypeScript infer later: let mg = null;

if (API_KEY && DOMAIN) {
    try {
        const mailgun = new Mailgun(formData);
        const client = mailgun.client({ // Assign to intermediate variable
            username: 'api',
            key: API_KEY,
            url: API_URL || 'https://api.mailgun.net'
        });
        mg = client; // Assign here, TS should infer the type for mg now

        // Now mg has the correct inferred type IMailgunClient
        console.log(`Mailgun client initialized for domain: ${DOMAIN} using endpoint: ${API_URL || 'https://api.mailgun.net'}`);
    } catch (error) {
         console.error("Error initializing Mailgun client:", error);
         mg = null;
    }
} else {
     console.error("Mailgun client NOT initialized due to missing API Key or Domain.");
}


export async function sendTaskShareEmail(params: EmailParams): Promise<void> {
    // Check if client (mg) is initialized and required variables are present
    if (!mg || !FROM_EMAIL || !DOMAIN) {
        console.error('Mailgun not configured or client failed to initialize. Skipping email send.');
        return;
    }

    // ... rest of the function remains the same ...
    const { to, taskName, messageContent, publicLink, senderName } = params;
    // Construct email content (using simple HTML)
    const subject = `[LiquidLM Task] Message regarding: ${taskName}`;
    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .message-box { background-color: #f9f9f9; border-left: 4px solid #ddd; padding: 15px; margin: 20px 0; }
        a { color: #3b82f6; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .button { display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 15px; }
        .footer { font-size: 0.8em; color: #777; margin-top: 20px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <p>Hello,</p>
        <p><strong>${senderName}</strong> left a message for you regarding the LiquidLM task: <strong>"${taskName}"</strong></p>
        <div class="message-box">
          <p><em>${messageContent}</em></p>
        </div>
        <p>You can view this message and reply using the secure link below. This link is valid for 7 days and can only be used once to view the message:</p>
        <p><a href="${publicLink}">${publicLink}</a></p>
        <p style="text-align: center;">
          <a href="${publicLink}" class="button">View & Reply</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p>Thanks,<br/>The LiquidLM Team</p>
        <p class="footer">Sent via LiquidLM Task Management</p>
      </div>
    </body>
    </html>
    `;
    const data = { from: FROM_EMAIL, to: [to], subject: subject, html: htmlBody, };

    try {
        // Use mg directly - TS knows its type now
        const result = await mg.messages.create(DOMAIN, data);
        console.log('Mailgun email sent successfully:', result);
    } catch (error) {
        console.error('Failed to send email via Mailgun:', error);
    }
}