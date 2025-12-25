-- Student Grievance Management System Database Schema
-- Create Database
CREATE DATABASE SGMS;
GO
USE SGMS;
GO
-- Users Table (Students and Administrators)
CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(50) UNIQUE NOT NULL,
    Password NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    PhoneNumber NVARCHAR(20),
    UserRole NVARCHAR(20) CHECK (UserRole IN ('Student', 'Administrator')) NOT NULL,
    Department NVARCHAR(100),
    RegistrationNumber NVARCHAR(50),
    CreatedAt DATETIME DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1,
    EmailVerified BIT DEFAULT 0
);
GO
-- Grievance Categories Table
CREATE TABLE GrievanceCategories (
    CategoryID INT PRIMARY KEY IDENTITY(1,1),
    CategoryName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255),
    IsActive BIT DEFAULT 1
);
GO
-- Grievances Table with Attachment Support
CREATE TABLE Grievances (
    GrievanceID INT PRIMARY KEY IDENTITY(1,1),
    StudentID INT FOREIGN KEY REFERENCES Users(UserID),
    CategoryID INT FOREIGN KEY REFERENCES GrievanceCategories(CategoryID),
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) CHECK (Status IN ('Pending', 'In Progress', 'Resolved', 'Rejected')) DEFAULT 'Pending',
    Priority NVARCHAR(20) CHECK (Priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    SubmittedDate DATETIME DEFAULT GETDATE(),
    ResolvedDate DATETIME NULL,
    AssignedTo INT FOREIGN KEY REFERENCES Users(UserID) NULL,
    AttachmentFileName NVARCHAR(500) NULL,
    AttachmentFileType NVARCHAR(50) NULL,
    AttachmentData VARBINARY(MAX) NULL,
    LastStatusChangeDate DATETIME NULL
);
GO
-- Grievance Responses Table
CREATE TABLE GrievanceResponses (
    ResponseID INT PRIMARY KEY IDENTITY(1,1),
    GrievanceID INT FOREIGN KEY REFERENCES Grievances(GrievanceID) ON DELETE CASCADE,
    ResponderID INT FOREIGN KEY REFERENCES Users(UserID),
    ResponseText NVARCHAR(MAX) NOT NULL,
    ResponseDate DATETIME DEFAULT GETDATE(),
    IsInternal BIT DEFAULT 0
);
GO
-- Email Notifications Log Table
CREATE TABLE EmailNotifications (
    NotificationID INT PRIMARY KEY IDENTITY(1,1),
    RecipientEmail NVARCHAR(100) NOT NULL,
    Subject NVARCHAR(255) NOT NULL,
    Body NVARCHAR(MAX) NOT NULL,
    SentDate DATETIME DEFAULT GETDATE(),
    Status NVARCHAR(20) CHECK (Status IN ('Sent', 'Failed', 'Pending')) DEFAULT 'Pending',
    GrievanceID INT FOREIGN KEY REFERENCES Grievances(GrievanceID) NULL,
    NotificationType NVARCHAR(50) NOT NULL
);
GO
-- In-App Notifications Table
CREATE TABLE Notifications (
    NotificationID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    Title NVARCHAR(255) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    NotificationType NVARCHAR(50) NOT NULL,
    GrievanceID INT FOREIGN KEY REFERENCES Grievances(GrievanceID) NULL,
    IsRead BIT DEFAULT 0,
    CreatedDate DATETIME DEFAULT GETDATE()
);
GO
-- Testimonials Table
CREATE TABLE Testimonials (
    TestimonialID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT FOREIGN KEY REFERENCES Users(UserID),
    Rating INT CHECK (Rating >= 1 AND Rating <= 5) NOT NULL,
    ReviewText NVARCHAR(MAX) NOT NULL,
    SubmittedDate DATETIME DEFAULT GETDATE()
);
GO
-- Insert Default Categories
INSERT INTO GrievanceCategories (CategoryName, Description) VALUES
('Academic Issue', 'Issues related to courses, exams, grades'),
('Infrastructure', 'Problems with facilities, buildings, equipment'),
('Faculty Complaint', 'Issues related to teaching staff'),
('Administrative', 'Administrative and documentation issues'),
('Hostel/Accommodation', 'Hostel and accommodation related issues'),
('Library', 'Library services and resources'),
('Finance/Fees', 'Fee payment and financial matters'),
('Ragging/Harassment', 'Safety and harassment concerns'),
('Other', 'Other grievances not covered above');
GO
-- Insert Default Admin User (Password: admin123)
INSERT INTO Users (Username, Password, FullName, Email, PhoneNumber, UserRole, Department, EmailVerified) VALUES
('admin', 'admin123', 'System Administrator', 'hadiqamehmood18@gmail.com', '1234567890', 'Administrator', 'Administration', 1);
GO
-- Stored Procedure: Get Dashboard Statistics
CREATE PROCEDURE sp_GetDashboardStats
AS
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM Grievances WHERE Status = 'Pending') AS PendingCount,
        (SELECT COUNT(*) FROM Grievances WHERE Status = 'In Progress') AS InProgressCount,
        (SELECT COUNT(*) FROM Grievances WHERE Status = 'Resolved') AS ResolvedCount,
        (SELECT COUNT(*) FROM Grievances WHERE Status = 'Rejected') AS RejectedCount,
        (SELECT COUNT(*) FROM Grievances) AS TotalCount,
        (SELECT COUNT(*) FROM Users WHERE UserRole = 'Student') AS TotalStudents,
        (SELECT COUNT(*) FROM Grievances WHERE SubmittedDate >= DATEADD(day, -7, GETDATE())) AS WeeklyGrievances,
        (SELECT COUNT(*) FROM Grievances WHERE SubmittedDate >= DATEADD(day, -30, GETDATE())) AS MonthlyGrievances;
END;
GO
-- Stored Procedure: Get Student Grievances
CREATE PROCEDURE sp_GetStudentGrievances
    @StudentID INT
AS
BEGIN
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
        u.FullName AS AssignedToName
    FROM Grievances g
    LEFT JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
    LEFT JOIN Users u ON g.AssignedTo = u.UserID
    WHERE g.StudentID = @StudentID
    ORDER BY g.SubmittedDate DESC;
END;
GO
-- Stored Procedure: Get All Grievances (Admin)
CREATE PROCEDURE sp_GetAllGrievances
AS
BEGIN
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
        g.SubmittedDate DESC;
END;
GO
-- Stored Procedure: Get Report Data
CREATE PROCEDURE sp_GetReportData
    @StartDate DATETIME = NULL,
    @EndDate DATETIME = NULL
AS
BEGIN
    IF @StartDate IS NULL SET @StartDate = DATEADD(month, -1, GETDATE());
    IF @EndDate IS NULL SET @EndDate = GETDATE();

    -- Overall Statistics
    SELECT 
        COUNT(*) AS TotalGrievances,
        COUNT(CASE WHEN Status = 'Resolved' THEN 1 END) AS ResolvedCount,
        COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS PendingCount,
        COUNT(CASE WHEN Status = 'In Progress' THEN 1 END) AS InProgressCount,
        COUNT(CASE WHEN Status = 'Rejected' THEN 1 END) AS RejectedCount,
        AVG(CASE WHEN ResolvedDate IS NOT NULL 
            THEN DATEDIFF(day, SubmittedDate, ResolvedDate) END) AS AvgResolutionDays
    FROM Grievances
    WHERE SubmittedDate BETWEEN @StartDate AND @EndDate;
    -- Category-wise breakdown
    SELECT 
        gc.CategoryName,
        COUNT(*) AS Count,
        COUNT(CASE WHEN g.Status = 'Resolved' THEN 1 END) AS Resolved
    FROM Grievances g
    JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
    WHERE g.SubmittedDate BETWEEN @StartDate AND @EndDate
    GROUP BY gc.CategoryName
    ORDER BY Count DESC;
    -- Priority-wise breakdown
    SELECT 
        Priority,
        COUNT(*) AS Count,
        COUNT(CASE WHEN Status = 'Resolved' THEN 1 END) AS Resolved
    FROM Grievances
    WHERE SubmittedDate BETWEEN @StartDate AND @EndDate
    GROUP BY Priority
    ORDER BY 
        CASE Priority 
            WHEN 'Critical' THEN 1
            WHEN 'High' THEN 2
            WHEN 'Medium' THEN 3
            WHEN 'Low' THEN 4
        END;
    -- Department-wise breakdown
    SELECT 
        u.Department,
        COUNT(*) AS Count,
        COUNT(CASE WHEN g.Status = 'Resolved' THEN 1 END) AS Resolved
    FROM Grievances g
    JOIN Users u ON g.StudentID = u.UserID
    WHERE g.SubmittedDate BETWEEN @StartDate AND @EndDate
    GROUP BY u.Department
    ORDER BY Count DESC;
END;
GO
-- Trigger: Update Resolved Date and Track Status Changes
CREATE TRIGGER trg_UpdateGrievanceStatus
ON Grievances
AFTER UPDATE
AS
BEGIN
    -- Update resolved date when status changes to Resolved
    IF UPDATE(Status)
    BEGIN
        UPDATE Grievances
        SET ResolvedDate = GETDATE(),
            LastStatusChangeDate = GETDATE()
        WHERE GrievanceID IN (SELECT GrievanceID FROM inserted WHERE Status = 'Resolved')
        AND GrievanceID IN (SELECT GrievanceID FROM deleted WHERE Status != 'Resolved');
        -- Update last status change date for other status changes
        UPDATE Grievances
        SET LastStatusChangeDate = GETDATE()
        WHERE GrievanceID IN (
            SELECT i.GrievanceID
            FROM inserted i
            JOIN deleted d ON i.GrievanceID = d.GrievanceID
            WHERE i.Status != d.Status
        );
        -- Create notifications for status changes
        INSERT INTO Notifications (UserID, Title, Message, NotificationType, GrievanceID)
        SELECT
            g.StudentID,
            'Grievance Status Updated',
            'Your grievance "' + g.Title + '" status has been changed to ' + i.Status,
            'StatusChange',
            g.GrievanceID
        FROM inserted i
        JOIN deleted d ON i.GrievanceID = d.GrievanceID
        JOIN Grievances g ON i.GrievanceID = g.GrievanceID
        WHERE i.Status != d.Status;
    END
END;
GO
-- Trigger: Create notifications for new grievances (Admin)
CREATE TRIGGER trg_NewGrievanceNotification
ON Grievances
AFTER INSERT
AS
BEGIN
    INSERT INTO Notifications (UserID, Title, Message, NotificationType, GrievanceID)
    SELECT
        u.UserID,
        'New Grievance Submitted',
        'A new grievance "' + i.Title + '" has been submitted by ' + s.FullName + ' (' + s.RegistrationNumber + ')',
        'NewGrievance',
        i.GrievanceID
    FROM inserted i
    JOIN Users s ON i.StudentID = s.UserID
    CROSS JOIN Users u
    WHERE u.UserRole = 'Administrator' AND u.IsActive = 1;
END;
GO
-- Trigger: Create notifications for new responses
CREATE TRIGGER trg_NewResponseNotification
ON GrievanceResponses
AFTER INSERT
AS
BEGIN
    -- Notify student when admin responds
    INSERT INTO Notifications (UserID, Title, Message, NotificationType, GrievanceID)
    SELECT
        g.StudentID,
        'New Response Received',
        'You have received a new response on your grievance "' + g.Title + '"',
        'NewResponse',
        g.GrievanceID
    FROM inserted i
    JOIN Grievances g ON i.GrievanceID = g.GrievanceID
    JOIN Users r ON i.ResponderID = r.UserID
    WHERE r.UserRole = 'Administrator';
    -- Notify admin when student responds
    INSERT INTO Notifications (UserID, Title, Message, NotificationType, GrievanceID)
    SELECT
        u.UserID,
        'Student Response Received',
        'Student ' + s.FullName + ' has responded to grievance "' + g.Title + '"',
        'StudentResponse',
        g.GrievanceID
    FROM inserted i
    JOIN Grievances g ON i.GrievanceID = g.GrievanceID
    JOIN Users s ON g.StudentID = s.UserID
    JOIN Users r ON i.ResponderID = r.UserID
    CROSS JOIN Users u
    WHERE r.UserRole = 'Student' AND u.UserRole = 'Administrator' AND u.IsActive = 1;
END;
GO
-- Trigger: Create notifications for new testimonials (Admin)
CREATE TRIGGER trg_NewTestimonialNotification
ON Testimonials
AFTER INSERT
AS
BEGIN
    INSERT INTO Notifications (UserID, Title, Message, NotificationType)
    SELECT
        u.UserID,
        'New Testimonial Submitted',
        'A new testimonial has been submitted by ' + us.FullName,
        'NewTestimonial'
    FROM inserted i
    JOIN Users us ON i.UserID = us.UserID
    CROSS JOIN Users u
    WHERE u.UserRole = 'Administrator' AND u.IsActive = 1;
END;
GO
-- View: Grievance Summary with Email Info
CREATE VIEW vw_GrievanceSummaryWithEmail AS
SELECT 
    g.GrievanceID,
    g.Title,
    g.Status,
    g.Priority,
    g.SubmittedDate,
    g.LastStatusChangeDate,
    gc.CategoryName,
    s.FullName AS StudentName,
    s.Email AS StudentEmail,
    s.RegistrationNumber,
    s.Department,
    a.FullName AS AdminName,
    a.Email AS AdminEmail
FROM Grievances g
JOIN GrievanceCategories gc ON g.CategoryID = gc.CategoryID
JOIN Users s ON g.StudentID = s.UserID
LEFT JOIN Users a ON g.AssignedTo = a.UserID;
GO

