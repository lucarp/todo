// src/lib/email.ts

interface EmailParams {
    to: string;
    taskName: string;
    messageContent: string;
    publicLink: string;
    senderName: string;
}

// --- PLACEHOLDER EMAIL FUNCTION ---
// Replace this with actual email sending logic using Resend, SendGrid, etc.
export async function sendTaskShareEmail(params: EmailParams): Promise<void> {
    const { to, taskName, messageContent, publicLink, senderName } = params;

    const subject = `Message regarding task: ${taskName}`;
    const body = `
        Hello,

        ${senderName} left a message for you regarding the task "${taskName}":

        "${messageContent}"

        You can view this message and reply using the secure link below (valid for 7 days):
        ${publicLink}

        Thanks,
        The Task App Team (or your app name)
    `; // Use HTML for better formatting in a real implementation

    console.log("--- Sending Email (Placeholder) ---");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Link:", publicLink);
    console.log("Body:", body);
    console.log("------------------------------------");

    // In a real app, you would use your email provider's SDK here:
    // try {
    //   const resend = new Resend(process.env.RESEND_API_KEY);
    //   await resend.emails.send({
    //     from: 'Your App <noreply@yourdomain.com>',
    //     to: to,
    //     subject: subject,
    //     html: <GenerateHTMLBody>, // Use an email template library
    //   });
    // } catch (error) {
    //   console.error("Failed to send email:", error);
    //   // Handle error appropriately
    // }
}