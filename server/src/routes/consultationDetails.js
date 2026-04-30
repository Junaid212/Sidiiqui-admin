const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const nodemailer = require('nodemailer');

// Lazy SMTP transporter — built on first use so dotenv is guaranteed to have run
function getTransporter() {
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
    });
}

/**
 * POST /api/public/consultations
 * Public endpoint to book a consultation
 */
router.post('/', async (req, res) => {
    console.log('📥 Received consultation booking request:', req.body);
    try {
        const { name, email, phone, selected_date, selected_time, message, consultant } = req.body;
        const assignedConsultant = consultant || 'Muhammad.Q.Siddiqui';

        // 1. Basic Validation
        if (!name || !email || !selected_date || !selected_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 2. Save to Supabase 'consultations' table
        const { data, error: dbError } = await supabaseAdmin
            .from('consultations')
            .insert([
                {
                    name,
                    email,
                    phone,
                    selected_date,
                    selected_time,
                    message,
                    consultant: assignedConsultant,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            return res.status(500).json({ error: 'Failed to save consultation booking' });
        }

        // 3. Send Confirmation Email via SMTP
        const transporter = getTransporter();
        if (transporter) {
            try {
                // Send email to the user
                await transporter.sendMail({
                    from: `"Siddiqui Digital" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: email,
                    subject: 'Consultation Booking Confirmed',
                    html: `
                        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #ef4444;">Booking Confirmed!</h2>
                            <p>Hello <strong>${name}</strong>,</p>
                            <p>Your consultation has been successfully booked. Here are the details:</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                                <p style="margin: 5px 0;"><strong>Date:</strong> ${selected_date}</p>
                                <p style="margin: 5px 0;"><strong>Time:</strong> ${selected_time}</p>
                                <p style="margin: 5px 0;"><strong>Consultant:</strong> ${assignedConsultant}</p>
                            </div>
                            <p>We look forward to speaking with you.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="font-size: 0.85rem; color: #666;">This is an automated confirmation from Siddiqui Digital.</p>
                        </div>
                    `
                });
                console.log('📧 Confirmation email sent to user:', email);

                // Send email to the admin
                const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
                await transporter.sendMail({
                    from: `"Siddiqui Digital System" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: adminEmail,
                    subject: `New Consultation Booking: ${name}`,
                    html: `
                        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #ef4444;">Your Consultation Booked</h2>
                            <p>A new consultation has been booked by <strong>${name}</strong>.</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                                <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                                <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
                                <p style="margin: 5px 0;"><strong>Date:</strong> ${selected_date}</p>
                                <p style="margin: 5px 0;"><strong>Time:</strong> ${selected_time}</p>
                                <p style="margin: 5px 0;"><strong>Consultant:</strong> ${assignedConsultant}</p>
                                <p style="margin: 5px 0;"><strong>Message:</strong> ${message || 'N/A'}</p>
                            </div>
                    `
                });
                console.log('📧 Notification email sent to admin:', adminEmail);
            } catch (emailErr) {
                console.error('❌ SMTP Email sending failed:', emailErr);
                // We don't return error here because the booking was already saved
            }
        } else {
            console.warn('⚠️ SMTP transporter not initialized, skipping email');
        }

        return res.status(201).json({
            success: true,
            message: 'Consultation booked successfully',
            data
        });

    } catch (err) {
        console.error('Consultation booking error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
