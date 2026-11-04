const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const nodemailer = require('nodemailer');
const { validateBookingInput, isActiveStatus, normalizeDate, normalizeTime, escapeHtml } = require('../utils/consultationRules');

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

router.post('/', async (req, res) => {
    console.log('📥 Received consultation booking request');
    try {
        const validated = validateBookingInput(req.body);
        if (!validated.ok) {
            return res.status(validated.status).json({ error: validated.error });
        }

        const { name, email, phone, message, date, time } = validated.value;
        const assignedConsultant = req.body.consultant || 'Muhammad.Q.Siddiqui';

        const { data: existingRows, error: existingError } = await supabaseAdmin
            .from('consultations')
            .select('id, date, time, selected_date, selected_time, status')
            .or(`date.eq.${date},selected_date.eq.${date}`);

        if (existingError) {
            console.error('Database error:', existingError);
            return res.status(500).json({ error: 'Failed to check consultation availability' });
        }

        const taken = (existingRows || []).some((row) => {
            if (!isActiveStatus(row.status)) return false;
            return normalizeDate(row.date || row.selected_date) === date
                && normalizeTime(row.time || row.selected_time) === time;
        });

        if (taken) {
            return res.status(409).json({ error: 'This time slot is already booked. Please choose another time.' });
        }

        const payload = {
            name,
            email,
            phone,
            date,
            time,
            selected_date: date,
            selected_time: time,
            message,
            consultant: assignedConsultant,
            status: 'booked',
            email_sent: false,
        };

        const { data, error: dbError } = await supabaseAdmin
            .from('consultations')
            .insert([payload])
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            if (dbError.code === '23505') {
                return res.status(409).json({ error: 'This time slot is already booked. Please choose another time.' });
            }
            return res.status(500).json({ error: 'Failed to save consultation booking' });
        }

        let userEmailSent = false;
        let adminEmailSent = false;
        const transporter = getTransporter();
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: email,
                    subject: 'Consultation Booking Confirmed',
                    html: `
                        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #ef4444;">Booking Confirmed!</h2>
                            <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
                            <p>Your consultation has been successfully booked. Here are the details:</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                                <p style="margin: 5px 0;"><strong>Date:</strong> ${escapeHtml(date)}</p>
                                <p style="margin: 5px 0;"><strong>Time:</strong> ${escapeHtml(time)}</p>
                                <p style="margin: 5px 0;"><strong>Consultant:</strong> ${escapeHtml(assignedConsultant)}</p>
                            </div>
                            <p>We look forward to speaking with you.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="font-size: 0.85rem; color: #666;">This is an automated confirmation from Siddiqui Digital.</p>
                        </div>
                    `
                });
                userEmailSent = true;
                console.log('📧 Confirmation email sent to user:', email);

                const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: adminEmail,
                    subject: `New Consultation Booking: ${String(name).replace(/[\r\n]/g, ' ')}`,
                    html: `
                        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #ef4444;">Your Consultation Booked</h2>
                            <p>A new consultation has been booked by <strong>${escapeHtml(name)}</strong>.</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                                <p style="margin: 5px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
                                <p style="margin: 5px 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>
                                <p style="margin: 5px 0;"><strong>Date:</strong> ${escapeHtml(date)}</p>
                                <p style="margin: 5px 0;"><strong>Time:</strong> ${escapeHtml(time)}</p>
                                <p style="margin: 5px 0;"><strong>Consultant:</strong> ${escapeHtml(assignedConsultant)}</p>
                                <p style="margin: 5px 0;"><strong>Message:</strong> ${escapeHtml(message || 'N/A')}</p>
                            </div>
                    `
                });
                adminEmailSent = true;
                console.log('📧 Notification email sent to admin:', adminEmail);
            } catch (emailErr) {
                console.error('❌ SMTP Email sending failed:', emailErr);
            }
        }

        if (userEmailSent) {
            await supabaseAdmin.from('consultations').update({ email_sent: true }).eq('id', data.id);
        }

        return res.status(201).json({
            success: true,
            message: 'Consultation booked successfully',
            data,
            emailDelivery: { customer: userEmailSent, admin: adminEmailSent },
        });

    } catch (err) {
        console.error('Consultation booking error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
