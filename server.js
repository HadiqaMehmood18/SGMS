 // Student Grievance Management System - Final Enhanced Backend
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static('.'));

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
        }
    }
});

const config = {
    user: 'sa',
    password: 'hm1808',
    server: 'MUZZAMMIL-PC',
    database: 'SGMS',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 60000,  // 60 seconds
        requestTimeout: 60000,     // 60 seconds
        cancelTimeout: 5000,       // 5 seconds
        acquireTimeoutMillis: 60000, // 60 seconds
        idleTimeoutMillis: 30000   // 30 seconds
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const emailConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'hadiqamehmood18@gmail.com',
        pass: 'askjojylzuenphbl'
    }
};

const transporter = nodemailer.createTransport(emailConfig);
let pool;

async function initDB() {
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to SQL Server');
    } catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
}

async function sendEmail(to, subject, htmlContent, grievanceId = null, notificationType = 'General') {
    try {
        // Create a simple text version by stripping HTML tags
        const textContent = htmlContent
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        const mailOptions = {
            from: '"Grievance System" <' + emailConfig.auth.user + '>',
            to: to,
            subject: subject,
            html: htmlContent,
            text: textContent // Fallback for email clients that don't support HTML
        };

        await transporter.sendMail(mailOptions);

        await pool.request()
            .input('recipientEmail', sql.NVarChar, to)
            .input('subject', sql.NVarChar, subject)
            .input('body', sql.NVarChar, htmlContent)
            .input('grievanceId', sql.Int, grievanceId)
            .input('notificationType', sql.NVarChar, notificationType)
            .query(`
                INSERT INTO EmailNotifications (RecipientEmail, Subject, Body, Status, GrievanceID, NotificationType)
                VALUES (@recipientEmail, @subject, @body, 'Sent', @grievanceId, @notificationType)
            `);

        console.log('✉️ Email sent to:', to);
    } catch (error) {
        console.error('❌ Email failed:', error);

        await pool.request()
            .input('recipientEmail', sql.NVarChar, to)
            .input('subject', sql.NVarChar, subject)
            .input('body', sql.NVarChar, htmlContent)
            .input('grievanceId', sql.Int, grievanceId)
            .input('notificationType', sql.NVarChar, notificationType)
            .query(`
                INSERT INTO EmailNotifications (RecipientEmail, Subject, Body, GrievanceID, NotificationType)
                VALUES (@recipientEmail, @subject, @body, 'Failed', @grievanceId, @notificationType)
            `);
    }
}

function getWelcomeEmailTemplate(fullName, username) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎓 Welcome to Grievance System</h1>
                </div>
                <div class="content">
                    <h2>Hello ${fullName}!</h2>
                    <p>Your account has been successfully created.</p>
                    <p><strong>Username:</strong> ${username}</p>
                    <p>You can now submit and track your grievances through our system.</p>
                </div>
                <div class="footer">
                    <p>© 2025 Student Grievance Management System. Developed by Hadiqa & Mahnoor. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function getGrievanceSubmittedEmailTemplate(fullName, grievanceId, title, category) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
                .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Grievance Submitted Successfully</h1>
                </div>
                <div class="content">
                    <h2>Hello ${fullName},</h2>
                    <p>Your grievance has been successfully submitted.</p>
                    <div class="info-box">
                        <p><strong>Grievance ID:</strong> #${grievanceId}</p>
                        <p><strong>Title:</strong> ${title}</p>
                        <p><strong>Category:</strong> ${category}</p>
                        <p><strong>Status:</strong> Pending</p>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2025 Student Grievance Management System. Developed by Hadiqa & Mahnoor. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function getStatusChangeEmailTemplate(fullName, grievanceId, title, oldStatus, newStatus) {
    const statusColors = {
        'Pending': '#f59e0b',
        'In Progress': '#3b82f6',
        'Resolved': '#10b981',
        'Rejected': '#ef4444'
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .status-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
                .status-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; color: white; margin: 10px; }
                .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔔 Grievance Status Updated</h1>
                </div>
                <div class="content">
                    <h2>Hello ${fullName},</h2>
                    <p>The status of your grievance has been updated.</p>
                    <div class="status-box">
                        <p><strong>Grievance ID:</strong> #${grievanceId}</p>
                        <p><strong>Title:</strong> ${title}</p>
                        <br>
                        <span class="status-badge" style="background: ${statusColors[oldStatus] || '#888'};">${oldStatus}</span>
                        <span style="font-size: 24px;">→</span>
                        <span class="status-badge" style="background: ${statusColors[newStatus] || '#888'};">${newStatus}</span>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2025 Student Grievance Management System. Developed by Hadiqa & Mahnoor. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function getAdminNotificationTemplate(studentName, registrationNumber, grievanceId, title, category, priority) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; border-radius: 5px; }
                .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 New Grievance Submitted</h1>
                </div>
                <div class="content">
                    <h2>New Grievance Alert</h2>
                    <div class="info-box">
                        <p><strong>Grievance ID:</strong> #${grievanceId}</p>
                        <p><strong>Student:</strong> ${studentName} (${registrationNumber})</p>
                        <p><strong>Title:</strong> ${title}</p>
                        <p><strong>Category:</strong> ${category}</p>
                        <p><strong>Priority:</strong> ${priority}</p>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2025 Student Grievance Management System. Developed by Hadiqa & Mahnoor. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .query(`
                SELECT UserID, Username, FullName, Email, UserRole, Department, RegistrationNumber 
                FROM Users 
                WHERE Username = @username AND Password = @password AND IsActive = 1
            `);

        if (result.recordset.length > 0) {
            res.json({ success: true, user: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, fullName, email, phoneNumber, department, registrationNumber } = req.body;
        
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('fullName', sql.NVarChar, fullName)
            .input('email', sql.NVarChar, email)
            .input('phoneNumber', sql.NVarChar, phoneNumber)
            .input('department', sql.NVarChar, department)
            .input('registrationNumber', sql.NVarChar, registrationNumber)
            .query(`
                INSERT INTO Users (Username, Password, FullName, Email, PhoneNumber, UserRole, Department, RegistrationNumber, EmailVerified)
                VALUES (@username, @password, @fullName, @email, @phoneNumber, 'Student', @department, @registrationNumber, 1);
                SELECT SCOPE_IDENTITY() AS UserID;
            `);

        const emailTemplate = getWelcomeEmailTemplate(fullName, username);
        await sendEmail(email, '🎓 Welcome to Student Grievance System', emailTemplate, null, 'Registration');

        res.json({ success: true, userId: result.recordset[0].UserID });
    } catch (err) {
        if (err.number === 2627) {
            res.status(400).json({ success: false, message: 'Username or email already exists' });
        } else {
            console.error(err);
            res.status(500).json({ success: false, message: 'Registration failed' });
        }
    }
});

// ==================== GRIEVANCE ROUTES ====================

app.post('/api/grievances', upload.single('attachment'), async (req, res) => {
    try {
        const { studentId, categoryId, title, description, priority } = req.body;
        const file = req.file;
        
        let attachmentFileName = null;
        let attachmentFileType = null;
        let attachmentData = null;

        if (file) {
            attachmentFileName = file.originalname;
            attachmentFileType = file.mimetype;
            attachmentData = file.buffer;
        }

        const result = await pool.request()
            .input('studentId', sql.Int, studentId)
            .input('categoryId', sql.Int, categoryId)
            .input('title', sql.NVarChar, title)
            .input('description', sql.NVarChar, description)
            .input('priority', sql.NVarChar, priority || 'Medium')
            .input('attachmentFileName', sql.NVarChar, attachmentFileName)
            .input('attachmentFileType', sql.NVarChar, attachmentFileType)
            .input('attachmentData', sql.VarBinary, attachmentData)
            .query(`
                INSERT INTO Grievances (StudentID, CategoryID, Title, Description, Priority, Status, AttachmentFileName, AttachmentFileType, AttachmentData)
                VALUES (@studentId, @categoryId, @title, @description, @priority, 'Pending', @attachmentFileName, @attachmentFileType, @attachmentData);
                SELECT SCOPE_IDENTITY() AS GrievanceID;
            `);

        const grievanceId = result.recordset[0].GrievanceID;

        const detailsResult = await pool.request()
            .input('grievanceId', sql.Int, grievanceId)
            .query(`
                SELECT 
                    s.FullName, s.Email, s.RegistrationNumber,
                    gc.CategoryName
                FROM Grievances g
                JOIN Users s ON g.StudentID = s.UserID
                JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
                WHERE g.GrievanceID = @grievanceId
            `);

        const details = detailsResult.recordset[0];

        const studentEmailTemplate = getGrievanceSubmittedEmailTemplate(
            details.FullName, grievanceId, title, details.CategoryName
        );
        await sendEmail(details.Email, '✅ Grievance Submitted Successfully', studentEmailTemplate, grievanceId, 'GrievanceSubmitted');

        const adminResult = await pool.request().query(`SELECT Email FROM Users WHERE UserRole = 'Administrator' AND IsActive = 1`);
        for (const admin of adminResult.recordset) {
            const adminEmailTemplate = getAdminNotificationTemplate(
                details.FullName, details.RegistrationNumber, grievanceId, title, details.CategoryName, priority || 'Medium'
            );
            await sendEmail(admin.Email, '🚨 New Grievance Submitted', adminEmailTemplate, grievanceId, 'AdminNotification');
        }

        // Create notification for student
        await pool.request()
            .input('userId', sql.Int, studentId)
            .input('title', sql.NVarChar, 'Grievance Submitted Successfully')
            .input('message', sql.NVarChar, `Your grievance "${title}" has been submitted successfully. Grievance ID: #${grievanceId}`)
            .input('grievanceId', sql.Int, grievanceId)
            .query(`
                INSERT INTO Notifications (UserID, Title, Message, NotificationType, GrievanceID)
                VALUES (@userId, @title, @message, 'GrievanceSubmitted', @grievanceId)
            `);

        res.json({ success: true, grievanceId: grievanceId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to submit grievance' });
    }
});

app.get('/api/grievances/:id/attachment', async (req, res) => {
    try {
        const result = await pool.request()
            .input('grievanceId', sql.Int, req.params.id)
            .query(`
                SELECT AttachmentFileName, AttachmentFileType, AttachmentData
                FROM Grievances
                WHERE GrievanceID = @grievanceId AND AttachmentData IS NOT NULL
            `);

        if (result.recordset.length > 0) {
            const attachment = result.recordset[0];
            res.setHeader('Content-Type', attachment.AttachmentFileType);
            res.setHeader('Content-Disposition', `attachment; filename="${attachment.AttachmentFileName}"`);
            res.send(attachment.AttachmentData);
        } else {
            res.status(404).json({ success: false, message: 'Attachment not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to retrieve attachment' });
    }
});

app.get('/api/grievances/student/:studentId', async (req, res) => {
    try {
        const result = await pool.request()
            .input('studentId', sql.Int, req.params.studentId)
            .query(`
                SELECT 
                    g.GrievanceID,
                    g.Title,
                    g.Description,
                    g.Status,
                    g.Priority,
                    g.SubmittedDate,
                    g.ResolvedDate,
                    g.AttachmentFileName,
                    gc.CategoryName,
                    s.FullName AS StudentName,
                    s.RegistrationNumber
                FROM Grievances g
                JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
                JOIN Users s ON g.StudentID = s.UserID
                WHERE g.StudentID = @studentId
                ORDER BY g.GrievanceID ASC
            `);

        res.json({ success: true, grievances: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch grievances' });
    }
});

app.get('/api/grievances/all', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                g.GrievanceID,
                g.Title,
                g.Description,
                g.Status,
                g.Priority,
                g.SubmittedDate,
                g.ResolvedDate,
                g.AttachmentFileName,
                g.AttachmentFileType,
                gc.CategoryName,
                s.FullName AS StudentName,
                s.Email AS StudentEmail,
                s.RegistrationNumber,
                s.Department,
                a.FullName AS AssignedToName
            FROM Grievances g
            LEFT JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
            LEFT JOIN Users s ON g.StudentID = s.UserID
            LEFT JOIN Users a ON g.AssignedTo = a.UserID
            ORDER BY
                CASE g.Priority
                    WHEN 'Critical' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    WHEN 'Low' THEN 4
                END,
                g.SubmittedDate DESC
        `);
        res.json({ success: true, grievances: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch grievances' });
    }
});

app.get('/api/grievances/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('grievanceId', sql.Int, req.params.id)
            .query(`
                SELECT 
                    g.*,
                    gc.CategoryName,
                    s.FullName AS StudentName,
                    s.Email AS StudentEmail,
                    s.RegistrationNumber,
                    s.Department,
                    a.FullName AS AssignedToName
                FROM Grievances g
                LEFT JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
                LEFT JOIN Users s ON g.StudentID = s.UserID
                LEFT JOIN Users a ON g.AssignedTo = a.UserID
                WHERE g.GrievanceID = @grievanceId
            `);

        if (result.recordset.length > 0) {
            res.json({ success: true, grievance: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Grievance not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/grievances/:id/status', async (req, res) => {
    try {
        const { status, adminId } = req.body;
        
        const oldDataResult = await pool.request()
            .input('grievanceId', sql.Int, req.params.id)
            .query(`
                SELECT g.Status AS OldStatus, g.Title, s.FullName, s.Email, g.StudentID
                FROM Grievances g
                JOIN Users s ON g.StudentID = s.UserID
                WHERE g.GrievanceID = @grievanceId
            `);

        const oldData = oldDataResult.recordset[0];
        
        await pool.request()
            .input('grievanceId', sql.Int, req.params.id)
            .input('status', sql.NVarChar, status)
            .input('adminId', sql.Int, adminId)
            .query(`
                UPDATE Grievances 
                SET Status = @status, AssignedTo = @adminId
                WHERE GrievanceID = @grievanceId
            `);

        if (oldData.OldStatus !== status) {
            const emailTemplate = getStatusChangeEmailTemplate(
                oldData.FullName, req.params.id, oldData.Title, oldData.OldStatus, status
            );
            await sendEmail(oldData.Email, '🔔 Grievance Status Updated', emailTemplate, req.params.id, 'StatusChange');

            // Create notification for student
            await pool.request()
                .input('userId', sql.Int, oldData.StudentID)
                .input('title', sql.NVarChar, 'Grievance Status Updated')
                .input('message', sql.NVarChar, `Your grievance "${oldData.Title}" status has been updated from ${oldData.OldStatus} to ${status}. Grievance ID: #${req.params.id}`)
                .input('grievanceId', sql.Int, req.params.id)
                .query(`
                    INSERT INTO Notifications (UserID, Title, Message, NotificationType, GrievanceID)
                    VALUES (@userId, @title, @message, 'StatusChange', @grievanceId)
                `);
        }

        res.json({ success: true, message: 'Status updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
});

app.post('/api/grievances/:id/responses', async (req, res) => {
    try {
        const { responderId, responseText } = req.body;
        
        await pool.request()
            .input('grievanceId', sql.Int, req.params.id)
            .input('responderId', sql.Int, responderId)
            .input('responseText', sql.NVarChar, responseText)
            .query(`
                INSERT INTO GrievanceResponses (GrievanceID, ResponderID, ResponseText)
                VALUES (@grievanceId, @responderId, @responseText)
            `);

        res.json({ success: true, message: 'Response added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to add response' });
    }
});

app.get('/api/grievances/:id/responses', async (req, res) => {
    try {
        const result = await pool.request()
            .input('grievanceId', sql.Int, req.params.id)
            .query(`
                SELECT 
                    gr.*,
                    u.FullName AS ResponderName,
                    u.UserRole AS ResponderRole
                FROM GrievanceResponses gr
                JOIN Users u ON gr.ResponderID = u.UserID
                WHERE gr.GrievanceID = @grievanceId
                ORDER BY gr.ResponseDate ASC
            `);

        res.json({ success: true, responses: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch responses' });
    }
});

// ==================== CATEGORY ROUTES ====================

app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT * FROM GrievanceCategories WHERE IsActive = 1
        `);
        res.json({ success: true, categories: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
});

// ==================== DASHBOARD ROUTES ====================

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { studentId } = req.query;

        if (studentId) {
            // Get stats for specific student
            const result = await pool.request()
                .input('studentId', sql.Int, studentId)
                .query(`
                    SELECT
                        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
                        SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgressCount,
                        SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS ResolvedCount,
                        SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) AS RejectedCount
                    FROM Grievances
                    WHERE StudentID = @studentId
                `);
            res.json({ success: true, stats: result.recordset[0] });
        } else {
            // Get global stats for admin
            const result = await pool.request().execute('sp_GetDashboardStats');
            res.json({ success: true, stats: result.recordset[0] });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

app.get('/api/dashboard/priority-stats', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) AS Low,
                SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) AS Medium,
                SUM(CASE WHEN Priority = 'High' THEN 1 ELSE 0 END) AS High,
                SUM(CASE WHEN Priority = 'Critical' THEN 1 ELSE 0 END) AS Critical
            FROM Grievances
        `);
        
        const data = result.recordset[0];
        const priorities = [data.Low, data.Medium, data.High, data.Critical];
        res.json({ success: true, priorities });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch priority stats' });
    }
});

// Date-based Trend (Daily submissions)
app.get('/api/dashboard/daily-trend', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                FORMAT(SubmittedDate, 'MMM dd') AS Day,
                COUNT(*) AS Count
            FROM Grievances
            WHERE SubmittedDate >= DATEADD(day, -14, GETDATE())
            GROUP BY CAST(SubmittedDate AS DATE), FORMAT(SubmittedDate, 'MMM dd')
            ORDER BY CAST(SubmittedDate AS DATE)
        `);

        const days = result.recordset.map(r => r.Day);
        const counts = result.recordset.map(r => r.Count);
        res.json({ success: true, days, counts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch daily trend' });
    }
});

// Category-wise Analysis
app.get('/api/dashboard/category-stats', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                gc.CategoryName,
                COUNT(g.GrievanceID) AS TotalCount,
                SUM(CASE WHEN g.Status = 'Resolved' THEN 1 ELSE 0 END) AS ResolvedCount,
                SUM(CASE WHEN g.Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
                SUM(CASE WHEN g.Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgressCount
            FROM GrievanceCategories gc
            LEFT JOIN Grievances g ON gc.CategoryID = g.CategoryID
            GROUP BY gc.CategoryID, gc.CategoryName
            ORDER BY TotalCount DESC
        `);

        const categories = result.recordset.map(r => r.CategoryName);
        const totalCounts = result.recordset.map(r => r.TotalCount);
        const resolvedCounts = result.recordset.map(r => r.ResolvedCount);
        const pendingCounts = result.recordset.map(r => r.PendingCount);
        const inProgressCounts = result.recordset.map(r => r.InProgressCount);

        res.json({
            success: true,
            categories,
            totalCounts,
            resolvedCounts,
            pendingCounts,
            inProgressCounts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch category stats' });
    }
});

// ==================== TESTIMONIALS ROUTES ====================

app.post('/api/testimonials', async (req, res) => {
    try {
        const { userId, rating, reviewText, message, testimonialText } = req.body;

        // Validate that userId is provided and is a valid student
        if (!userId || userId === 1) {
            return res.status(400).json({ success: false, message: 'Valid user authentication required' });
        }

        // Validate rating
        const numRating = parseInt(rating);
        if (!numRating || numRating < 1 || numRating > 5) {
            return res.status(400).json({ success: false, message: 'Please select a valid rating (1-5 stars)' });
        }

        const finalReviewText = reviewText || message || testimonialText; // Support both field names

        // Validate review text
        if (!finalReviewText || finalReviewText.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide your testimonial text' });
        }

        // Verify the user exists and is active
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`SELECT UserID, UserRole FROM Users WHERE UserID = @userId AND IsActive = 1`);

        if (userCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid user' });
        }

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('rating', sql.Int, numRating)
            .input('reviewText', sql.NVarChar, finalReviewText.trim())
            .query(`
                INSERT INTO Testimonials (UserID, Rating, ReviewText)
                VALUES (@userId, @rating, @reviewText)
            `);

        res.json({ success: true, message: 'Testimonial submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to submit testimonial' });
    }
});

app.get('/api/testimonials', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                t.TestimonialID,
                t.Rating,
                t.ReviewText,
                t.SubmittedDate,
                u.FullName,
                u.Department
            FROM Testimonials t
            JOIN Users u ON t.UserID = u.UserID
            WHERE u.IsActive = 1
            ORDER BY t.SubmittedDate DESC
        `);

        res.json({ success: true, testimonials: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
    }
});

// ==================== NOTIFICATIONS ROUTES ====================

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.params.userId)
            .query(`
                SELECT
                    NotificationID,
                    Title,
                    Message,
                    NotificationType,
                    GrievanceID,
                    IsRead,
                    CreatedDate
                FROM Notifications
                WHERE UserID = @userId
                ORDER BY CreatedDate DESC
            `);

        res.json({ success: true, notifications: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
});

app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
        await pool.request()
            .input('notificationId', sql.Int, req.params.notificationId)
            .query(`
                UPDATE Notifications
                SET IsRead = 1
                WHERE NotificationID = @notificationId
            `);

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
});

app.put('/api/notifications/user/:userId/read-all', async (req, res) => {
    try {
        await pool.request()
            .input('userId', sql.Int, req.params.userId)
            .query(`
                UPDATE Notifications
                SET IsRead = 1
                WHERE UserID = @userId AND IsRead = 0
            `);

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
    }
});

app.get('/api/notifications/:userId/unread-count', async (req, res) => {
    try {
        const result = await pool.request()
            .input('userId', sql.Int, req.params.userId)
            .query(`
                SELECT COUNT(*) AS UnreadCount
                FROM Notifications
                WHERE UserID = @userId AND IsRead = 0
            `);

        res.json({ success: true, unreadCount: result.recordset[0].UnreadCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
});

// ==================== CONTACT FORM ROUTE ====================

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        const userEmailTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Thank You for Contacting Us!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${name},</h2>
                        <p>We have received your message and will get back to you soon.</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Student Grievance Management System. Developed by Hadiqa & Mahnoor. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await sendEmail(email, 'Message Received - SGMS', userEmailTemplate, null, 'ContactForm');

        const adminResult = await pool.request().query(`SELECT Email FROM Users WHERE UserRole = 'Administrator' AND IsActive = 1`);
        for (const admin of adminResult.recordset) {
            const adminEmailTemplate = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>New Contact Form Submission</h1>
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <p><strong>Name:</strong> ${name}</p>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Message:</strong></p>
                                <p>${message}</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;
            await sendEmail(admin.Email, 'New Contact Form Submission', adminEmailTemplate, null, 'ContactFormAdmin');
        }

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

// ==================== SIMPLIFIED PDF REPORT ====================

app.get('/api/reports/pdf', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = `
            SELECT
                COUNT(*) AS TotalGrievances,
                SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS ResolvedCount,
                SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
                SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgressCount,
                SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) AS RejectedCount,
                AVG(CASE WHEN Status = 'Resolved' THEN DATEDIFF(day, SubmittedDate, ResolvedDate) ELSE NULL END) AS AvgResolutionDays
            FROM Grievances
            WHERE 1=1
        `;

        let categoryQuery = `
            SELECT
                gc.CategoryName,
                COUNT(g.GrievanceID) AS Count,
                SUM(CASE WHEN g.Status = 'Resolved' THEN 1 ELSE 0 END) AS Resolved
            FROM GrievanceCategories gc
            LEFT JOIN Grievances g ON gc.CategoryID = g.CategoryID
            WHERE 1=1
        `;

        let priorityQuery = `
            SELECT
                Priority,
                COUNT(*) AS Count,
                SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS Resolved
            FROM Grievances
            WHERE 1=1
        `;

        let departmentQuery = `
            SELECT
                u.Department,
                COUNT(g.GrievanceID) AS Count,
                SUM(CASE WHEN g.Status = 'Resolved' THEN 1 ELSE 0 END) AS Resolved
            FROM Users u
            LEFT JOIN Grievances g ON u.UserID = g.StudentID
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        // Add date filters if provided
        if (startDate) {
            query += ` AND SubmittedDate >= @startDate`;
            categoryQuery += ` AND g.SubmittedDate >= @startDate`;
            priorityQuery += ` AND SubmittedDate >= @startDate`;
            departmentQuery += ` AND g.SubmittedDate >= @startDate`;
            params.push({ name: 'startDate', type: sql.DateTime, value: new Date(startDate) });
        }

        if (endDate) {
            query += ` AND SubmittedDate <= @endDate`;
            categoryQuery += ` AND g.SubmittedDate <= @endDate`;
            priorityQuery += ` AND SubmittedDate <= @endDate`;
            departmentQuery += ` AND g.SubmittedDate <= @endDate`;
            params.push({ name: 'endDate', type: sql.DateTime, value: new Date(endDate + ' 23:59:59') });
        }

        categoryQuery += ` GROUP BY gc.CategoryID, gc.CategoryName ORDER BY Count DESC`;
        priorityQuery += ` GROUP BY Priority ORDER BY Priority`;
        departmentQuery += ` GROUP BY u.Department ORDER BY Count DESC`;

        const request = pool.request();

        // Add parameters
        params.forEach(param => {
            request.input(param.name, param.type, param.value);
        });

        const [statsResult, categoryResult, priorityResult, departmentResult] = await Promise.all([
            request.query(query),
            request.query(categoryQuery),
            request.query(priorityQuery),
            request.query(departmentQuery)
        ]);

        const result = {
            recordsets: [
                statsResult.recordset,
                categoryResult.recordset,
                priorityResult.recordset,
                departmentResult.recordset
            ]
        };

        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            bufferPages: true
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="grievance-report.pdf"');
        
        doc.pipe(res);

        // Title
        doc.fontSize(24)
           .fillColor('#4f46e5')
           .font('Helvetica-Bold')
           .text('Student Grievance Management System', { align: 'center' });
        
        doc.moveDown(0.5);
        doc.fontSize(18)
           .fillColor('#7c3aed')
           .text('Comprehensive Report', { align: 'center' });
        
        doc.moveDown(0.3);
        doc.fontSize(10)
           .fillColor('#64748b')
           .font('Helvetica')
           .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        
        doc.moveDown(1);
        doc.moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .strokeColor('#4f46e5')
           .lineWidth(2)
           .stroke();
        
        doc.moveDown(2);

        // Overall Statistics
        const stats = result.recordsets[0][0];

        doc.fontSize(16)
           .fillColor('#1f2937')
           .font('Helvetica-Bold')
           .text('Overall Statistics', { align: 'center', underline: true });
        
        doc.moveDown(1);

        const tableTop = doc.y;
        const leftCol = 100;
        const rightCol = 350;
        const rowHeight = 30;
        
        // Header
        doc.rect(50, tableTop, doc.page.width - 100, rowHeight)
           .fillAndStroke('#4f46e5', '#4f46e5');
        
        doc.fontSize(12)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text('Metric', leftCol, tableTop + 10)
           .text('Count', rightCol, tableTop + 10);

        let currentY = tableTop + rowHeight;
        
        const totalGrievances = stats.TotalGrievances || 1;
        const tableData = [
            { label: 'Total Grievances', value: stats.TotalGrievances, color: '#3b82f6' },
            { label: 'Resolved', value: stats.ResolvedCount, color: '#10b981' },
            { label: 'Pending', value: stats.PendingCount, color: '#f59e0b' },
            { label: 'In Progress', value: stats.InProgressCount, color: '#3b82f6' },
            { label: 'Rejected', value: stats.RejectedCount, color: '#ef4444' },
            { label: 'Avg Resolution Time', value: stats.AvgResolutionDays ? `${stats.AvgResolutionDays.toFixed(1)} days` : 'N/A', color: '#6366f1' }
        ];

        tableData.forEach((row, index) => {
            const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';
            
            doc.rect(50, currentY, doc.page.width - 100, rowHeight)
               .fillAndStroke(bgColor, '#e5e7eb');
            
            doc.fontSize(11)
               .fillColor(row.color)
               .font('Helvetica-Bold')
               .text(row.label, leftCol, currentY + 10);
            
            doc.fillColor('#1f2937')
               .font('Helvetica')
               .text(row.value.toString(), rightCol, currentY + 10);
            
            currentY += rowHeight;
        });

        doc.y = currentY + 30;

        // Category-wise breakdown
        doc.addPage();
        doc.fontSize(16)
           .fillColor('#1f2937')
           .font('Helvetica-Bold')
           .text('Category-wise Breakdown', { align: 'center', underline: true });
        
        doc.moveDown(1);

        const catTableTop = doc.y;
        const catCol1 = 80;
        const catCol2 = 300;
        const catCol3 = 400;
        const catCol4 = 480;
        const catRowHeight = 28;

        // Header
        doc.rect(50, catTableTop, doc.page.width - 100, catRowHeight)
           .fillAndStroke('#4f46e5', '#4f46e5');
        
        doc.fontSize(11)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text('Category', catCol1, catTableTop + 8)
           .text('Total', catCol2, catTableTop + 8)
           .text('Resolved', catCol3, catTableTop + 8)
           .text('Rate', catCol4, catTableTop + 8);

        let catY = catTableTop + catRowHeight;

        result.recordsets[1].forEach((cat, index) => {
            if (catY + catRowHeight > doc.page.height - 50) {
                doc.addPage();
                catY = doc.y;
                // Redraw header on new page
                doc.rect(50, catY, doc.page.width - 100, catRowHeight)
                   .fillAndStroke('#4f46e5', '#4f46e5');
                doc.fontSize(11)
                   .fillColor('white')
                   .font('Helvetica-Bold')
                   .text('Category', catCol1, catY + 8)
                   .text('Total', catCol2, catY + 8)
                   .text('Resolved', catCol3, catY + 8)
                   .text('Rate', catCol4, catY + 8);
                catY += catRowHeight;
            }

            const resolvedRate = cat.Count > 0 ? ((cat.Resolved / cat.Count) * 100).toFixed(1) : '0.0';
            const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';

            doc.rect(50, catY, doc.page.width - 100, catRowHeight)
               .fillAndStroke(bgColor, '#e5e7eb');

            doc.fontSize(10)
               .fillColor('#1f2937')
               .font('Helvetica')
               .text(cat.CategoryName.substring(0, 20), catCol1, catY + 8)
               .text(cat.Count.toString(), catCol2, catY + 8)
               .text(cat.Resolved.toString(), catCol3, catY + 8);

            doc.fillColor(parseFloat(resolvedRate) > 75 ? '#10b981' : parseFloat(resolvedRate) > 50 ? '#f59e0b' : '#ef4444')
               .font('Helvetica-Bold')
               .text(`${resolvedRate}%`, catCol4, catY + 8);

            catY += catRowHeight;
        });

        // Priority-wise breakdown
        doc.addPage();

        doc.fontSize(16)
           .fillColor('#1f2937')
           .font('Helvetica-Bold')
           .text('Priority-wise Breakdown', { align: 'center', underline: true, width: doc.page.width - 100 });
        
        doc.moveDown(1);

        const priTableTop = doc.y;
        let priY = priTableTop;

        // Header
        doc.rect(50, priY, doc.page.width - 100, catRowHeight)
           .fillAndStroke('#4f46e5', '#4f46e5');
        
        doc.fontSize(11)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text('Priority', catCol1, priY + 8)
           .text('Total', catCol2, priY + 8)
           .text('Resolved', catCol3, priY + 8)
           .text('Pending', catCol4, priY + 8);

        priY += catRowHeight;

        result.recordsets[2].forEach((priority, index) => {
            const priorityColors = {
                'Critical': '#ef4444',
                'High': '#f59e0b',
                'Medium': '#3b82f6',
                'Low': '#64748b'
            };
            
            const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';
            const pendingCount = priority.Count - priority.Resolved;
            
            doc.rect(50, priY, doc.page.width - 100, catRowHeight)
               .fillAndStroke(bgColor, '#e5e7eb');
            
            doc.fontSize(10)
               .fillColor(priorityColors[priority.Priority] || '#64748b')
               .font('Helvetica-Bold')
               .text(priority.Priority, catCol1, priY + 8);
            
            doc.fillColor('#1f2937')
               .font('Helvetica')
               .text(priority.Count.toString(), catCol2, priY + 8)
               .text(priority.Resolved.toString(), catCol3, priY + 8)
               .text(pendingCount.toString(), catCol4, priY + 8);
            
            priY += catRowHeight;
        });

        doc.y = priY + 30;

        // Department-wise breakdown
        doc.addPage();
        doc.fontSize(16)
           .fillColor('#1f2937')
           .font('Helvetica-Bold')
           .text('Department-wise Analysis',  { align: 'center', underline: true });
        
        doc.moveDown(1);

        const deptTableTop = doc.y;
        let deptY = deptTableTop;

        // Header
        doc.rect(50, deptY, doc.page.width - 100, catRowHeight)
           .fillAndStroke('#4f46e5', '#4f46e5');
        
        doc.fontSize(11)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text('Department', catCol1, deptY + 8)
           .text('Total', catCol2, deptY + 8)
           .text('Resolved', catCol3, deptY + 8)
           .text('Pending', catCol4, deptY + 8);

        deptY += catRowHeight;

        result.recordsets[3].forEach((dept, index) => {
            const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';
            const pendingCount = dept.Count - dept.Resolved;
            
            doc.rect(50, deptY, doc.page.width - 100, catRowHeight)
               .fillAndStroke(bgColor, '#e5e7eb');
            
            doc.fontSize(10)
               .fillColor('#1f2937')
               .font('Helvetica')
               .text(dept.Department.substring(0, 18), catCol1, deptY + 8)
               .text(dept.Count.toString(), catCol2, deptY + 8);
            
            doc.fillColor('#10b981')
               .text(dept.Resolved.toString(), catCol3, deptY + 8);
            
            doc.fillColor(pendingCount > 0 ? '#f59e0b' : '#64748b')
               .text(pendingCount.toString(), catCol4, deptY + 8);
            
            deptY += catRowHeight;
        });

        // Footer
        doc.fontSize(9)
           .fillColor('#94a3b8')
           .text('© 2025 Student Grievance Management System - Developed by Hadiqa & Mahnoor - All Rights Reserved', 50, doc.page.height - 50, { align: 'center' });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to generate PDF report' });
    }
});

// ==================== ENHANCED EXCEL REPORT ====================

app.get('/api/reports/excel', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = `
            SELECT
                COUNT(*) AS TotalGrievances,
                SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS ResolvedCount,
                SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
                SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) AS InProgressCount,
                SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) AS RejectedCount,
                AVG(CASE WHEN Status = 'Resolved' THEN DATEDIFF(day, SubmittedDate, ResolvedDate) ELSE NULL END) AS AvgResolutionDays
            FROM Grievances
            WHERE 1=1
        `;

        let categoryQuery = `
            SELECT
                gc.CategoryName,
                COUNT(g.GrievanceID) AS Count,
                SUM(CASE WHEN g.Status = 'Resolved' THEN 1 ELSE 0 END) AS Resolved
            FROM GrievanceCategories gc
            LEFT JOIN Grievances g ON gc.CategoryID = g.CategoryID
            WHERE 1=1
        `;

        let priorityQuery = `
            SELECT
                Priority,
                COUNT(*) AS Count,
                SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) AS Resolved
            FROM Grievances
            WHERE 1=1
        `;

        let departmentQuery = `
            SELECT
                u.Department,
                COUNT(g.GrievanceID) AS Count,
                SUM(CASE WHEN g.Status = 'Resolved' THEN 1 ELSE 0 END) AS Resolved
            FROM Users u
            LEFT JOIN Grievances g ON u.UserID = g.StudentID
            WHERE 1=1
        `;

        const params = [];

        // Add date filters if provided
        if (startDate) {
            query += ` AND SubmittedDate >= @startDate`;
            categoryQuery += ` AND g.SubmittedDate >= @startDate`;
            priorityQuery += ` AND SubmittedDate >= @startDate`;
            departmentQuery += ` AND g.SubmittedDate >= @startDate`;
            params.push({ name: 'startDate', type: sql.DateTime, value: new Date(startDate) });
        }

        if (endDate) {
            query += ` AND SubmittedDate <= @endDate`;
            categoryQuery += ` AND g.SubmittedDate <= @endDate`;
            priorityQuery += ` AND SubmittedDate <= @endDate`;
            departmentQuery += ` AND g.SubmittedDate <= @endDate`;
            params.push({ name: 'endDate', type: sql.DateTime, value: new Date(endDate + ' 23:59:59') });
        }

        categoryQuery += ` GROUP BY gc.CategoryID, gc.CategoryName ORDER BY Count DESC`;
        priorityQuery += ` GROUP BY Priority ORDER BY Priority`;
        departmentQuery += ` GROUP BY u.Department ORDER BY Count DESC`;

        const request = pool.request();

        // Add parameters
        params.forEach(param => {
            request.input(param.name, param.type, param.value);
        });

        const [statsResult, categoryResult, priorityResult, departmentResult] = await Promise.all([
            request.query(query),
            request.query(categoryQuery),
            request.query(priorityQuery),
            request.query(departmentQuery)
        ]);

        const result = {
            recordsets: [
                statsResult.recordset,
                categoryResult.recordset,
                priorityResult.recordset,
                departmentResult.recordset
            ]
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SGMS';
        workbook.created = new Date();
        
        // Overall Statistics Sheet
        const statsSheet = workbook.addWorksheet('Overall Statistics', {
            properties: { tabColor: { argb: '4f46e5' } }
        });
        
        statsSheet.mergeCells('A1:D1');
        const titleCell = statsSheet.getCell('A1');
        titleCell.value = 'Student Grievance Management System';
        titleCell.font = { size: 18, bold: true, color: { argb: '4f46e5' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        statsSheet.getRow(1).height = 35;
        
        statsSheet.mergeCells('A2:D2');
        const subtitleCell = statsSheet.getCell('A2');
        subtitleCell.value = 'Comprehensive Grievance Report';
        subtitleCell.font = { size: 14, bold: true, color: { argb: '7c3aed' } };
        subtitleCell.alignment = { horizontal: 'center' };
        statsSheet.getRow(2).height = 25;
        
        statsSheet.mergeCells('A3:D3');
        const dateCell = statsSheet.getCell('A3');
        dateCell.value = `Generated on: ${new Date().toLocaleString()}`;
        dateCell.font = { size: 11, italic: true, color: { argb: '64748b' } };
        dateCell.alignment = { horizontal: 'center' };
        
        statsSheet.addRow([]);
        
        statsSheet.columns = [
            { key: 'metric', width: 30 },
            { key: 'value', width: 15 },
            { key: 'percentage', width: 15 },
            { key: 'visual', width: 30 }
        ];
        
        const stats = result.recordsets[0][0];
        const totalGrievances = stats.TotalGrievances || 1;
        
        const headerRow = statsSheet.addRow(['Metric', 'Value', 'Percentage', 'Visual']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4f46e5' }
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 30;
        
        const dataRows = [
            { 
                metric: 'Total Grievances', 
                value: stats.TotalGrievances,
                percentage: '100.0%',
                visual: '█'.repeat(20),
                color: '3b82f6'
            },
            { 
                metric: 'Resolved', 
                value: stats.ResolvedCount,
                percentage: `${((stats.ResolvedCount/totalGrievances)*100).toFixed(1)}%`,
                visual: '█'.repeat(Math.round((stats.ResolvedCount/totalGrievances)*20)),
                color: '10b981'
            },
            { 
                metric: 'Pending', 
                value: stats.PendingCount,
                percentage: `${((stats.PendingCount/totalGrievances)*100).toFixed(1)}%`,
                visual: '█'.repeat(Math.round((stats.PendingCount/totalGrievances)*20)),
                color: 'f59e0b'
            },
            { 
                metric: 'In Progress', 
                value: stats.InProgressCount,
                percentage: `${((stats.InProgressCount/totalGrievances)*100).toFixed(1)}%`,
                visual: '█'.repeat(Math.round((stats.InProgressCount/totalGrievances)*20)),
                color: '3b82f6'
            },
            { 
                metric: 'Rejected', 
                value: stats.RejectedCount,
                percentage: `${((stats.RejectedCount/totalGrievances)*100).toFixed(1)}%`,
                visual: '█'.repeat(Math.round((stats.RejectedCount/totalGrievances)*20)),
                color: 'ef4444'
            },
            { 
                metric: 'Avg Resolution Time', 
                value: stats.AvgResolutionDays ? `${stats.AvgResolutionDays.toFixed(1)} days` : 'N/A',
                percentage: '-',
                visual: stats.AvgResolutionDays ? '⏱'.repeat(Math.min(Math.round(stats.AvgResolutionDays/2), 20)) : 'N/A',
                color: '6366f1'
            }
        ];

        dataRows.forEach((rowData, index) => {
            const row = statsSheet.addRow([rowData.metric, rowData.value, rowData.percentage, rowData.visual]);
            row.height = 25;
            row.alignment = { vertical: 'middle' };
            row.getCell(1).font = { bold: true, color: { argb: rowData.color } };
            row.getCell(4).font = { color: { argb: rowData.color } };
            
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F3F4F6' }
                };
            }
        });

        // Category Sheet
        const categorySheet = workbook.addWorksheet('Category Analysis', {
            properties: { tabColor: { argb: '7c3aed' } }
        });
        
        categorySheet.mergeCells('A1:E1');
        const catTitle = categorySheet.getCell('A1');
        catTitle.value = 'Category-wise Breakdown';
        catTitle.font = { size: 16, bold: true, color: { argb: '4f46e5' } };
        catTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        categorySheet.getRow(1).height = 30;
        
        categorySheet.addRow([]);
        
        categorySheet.columns = [
            { key: 'category', width: 35 },
            { key: 'total', width: 12 },
            { key: 'resolved', width: 12 },
            { key: 'rate', width: 18 },
            { key: 'status', width: 20 }
        ];
        
        const catHeaderRow = categorySheet.addRow(['Category', 'Total', 'Resolved', 'Resolution Rate', 'Status']);
        catHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        catHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4f46e5' }
        };
        catHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        catHeaderRow.height = 25;
        
        result.recordsets[1].forEach((cat, index) => {
            const resolutionRate = cat.Count > 0 ? ((cat.Resolved / cat.Count) * 100).toFixed(1) : '0.0';
            const statusText = cat.Resolved === cat.Count ? '✓ Complete' : `${cat.Count - cat.Resolved} Pending`;
            const statusColor = cat.Resolved === cat.Count ? '10b981' : 'f59e0b';
            
            const row = categorySheet.addRow({
                category: cat.CategoryName,
                total: cat.Count,
                resolved: cat.Resolved,
                rate: `${resolutionRate}%`,
                status: statusText
            });
            
            row.height = 22;
            row.alignment = { vertical: 'middle' };
            row.getCell(4).font = { 
                bold: true, 
                color: { argb: parseFloat(resolutionRate) > 75 ? '10b981' : parseFloat(resolutionRate) > 50 ? 'f59e0b' : 'ef4444' }
            };
            row.getCell(5).font = { color: { argb: statusColor } };
            
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F9FAFB' }
                };
            }
        });

        // Priority Sheet
        const prioritySheet = workbook.addWorksheet('Priority Analysis', {
            properties: { tabColor: { argb: 'f59e0b' } }
        });
        
        prioritySheet.mergeCells('A1:E1');
        const priTitle = prioritySheet.getCell('A1');
        priTitle.value = 'Priority-wise Breakdown';
        priTitle.font = { size: 16, bold: true, color: { argb: '4f46e5' } };
        priTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        prioritySheet.getRow(1).height = 30;
        
        prioritySheet.addRow([]);
        
        prioritySheet.columns = [
            { key: 'priority', width: 20 },
            { key: 'total', width: 12 },
            { key: 'resolved', width: 12 },
            { key: 'pending', width: 12 },
            { key: 'status', width: 20 }
        ];
        
        const priHeaderRow = prioritySheet.addRow(['Priority', 'Total', 'Resolved', 'Pending', 'Status']);
        priHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        priHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4f46e5' }
        };
        priHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        priHeaderRow.height = 25;
        
        const priorityColors = {
            'Critical': 'ef4444',
            'High': 'f59e0b',
            'Medium': '3b82f6',
            'Low': '64748b'
        };
        
        result.recordsets[2].forEach((priority, index) => {
            const pendingCount = priority.Count - priority.Resolved;
            const statusText = pendingCount === 0 ? '✓ All Resolved' : `⏳ ${pendingCount} Pending`;
            
            const row = prioritySheet.addRow({
                priority: priority.Priority,
                total: priority.Count,
                resolved: priority.Resolved,
                pending: pendingCount,
                status: statusText
            });
            
            row.height = 22;
            row.alignment = { vertical: 'middle' };
            row.getCell(1).font = { bold: true, color: { argb: priorityColors[priority.Priority] || '64748b' } };
            row.getCell(5).font = { color: { argb: pendingCount === 0 ? '10b981' : 'f59e0b' } };
            
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F9FAFB' }
                };
            }
        });

        // Department Sheet
        const deptSheet = workbook.addWorksheet('Department Analysis', {
            properties: { tabColor: { argb: '10b981' } }
        });
        
        deptSheet.mergeCells('A1:E1');
        const deptTitle = deptSheet.getCell('A1');
        deptTitle.value = 'Department-wise Analysis';
        deptTitle.font = { size: 16, bold: true, color: { argb: '4f46e5' } };
        deptTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        deptSheet.getRow(1).height = 30;
        
        deptSheet.addRow([]);
        
        deptSheet.columns = [
            { key: 'department', width: 35 },
            { key: 'total', width: 12 },
            { key: 'resolved', width: 12 },
            { key: 'pending', width: 12 },
            { key: 'rate', width: 18 }
        ];
        
        const deptHeaderRow = deptSheet.addRow(['Department', 'Total', 'Resolved', 'Pending', 'Resolution Rate']);
        deptHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        deptHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4f46e5' }
        };
        deptHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        deptHeaderRow.height = 25;
        
        result.recordsets[3].forEach((dept, index) => {
            const pendingCount = dept.Count - dept.Resolved;
            const resolutionRate = dept.Count > 0 ? ((dept.Resolved / dept.Count) * 100).toFixed(1) : '0.0';
            
            const row = deptSheet.addRow({
                department: dept.Department,
                total: dept.Count,
                resolved: dept.Resolved,
                pending: pendingCount,
                rate: `${resolutionRate}%`
            });
            
            row.height = 22;
            row.alignment = { vertical: 'middle' };
            row.getCell(3).font = { color: { argb: '10b981' }, bold: true };
            row.getCell(4).font = { color: { argb: pendingCount > 0 ? 'f59e0b' : '64748b' } };
            row.getCell(5).font = { 
                bold: true,
                color: { argb: parseFloat(resolutionRate) > 75 ? '10b981' : parseFloat(resolutionRate) > 50 ? 'f59e0b' : 'ef4444' }
            };
            
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F9FAFB' }
                };
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="grievance-report.xlsx"');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to generate Excel report' });
    }
});

// ==================== START SERVER ====================

app.listen(PORT, async () => {
    await initDB();
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API Endpoints available at http://localhost:${PORT}/api`);
    console.log(`✉️  Email notifications enabled`);
    console.log(`📁 File upload enabled (Max: 10MB)`);
    console.log(`📄 Simplified reports enabled (PDF & Excel)`);
});

process.on('SIGINT', async () => {
    await pool.close();
    console.log('Database connection closed');
    process.exit(0);
});