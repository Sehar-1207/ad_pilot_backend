import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const { data, error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>', 
      to: [process.env.NOTIFICATION_EMAIL],
      replyTo: email, 
      subject: `[Contact Form] ${subject}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <br/>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({  success: true,  message: 'Your message has been sent successfully.',  id: data.id,  });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};