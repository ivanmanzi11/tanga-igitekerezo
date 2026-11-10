# Tanga Igitekerezo

Tanga Igitekerezo (Share Your Idea) is a digital platform for suggestions, complaints, and institutional feedback. I conceived and developed this full-stack web application during my internship at Rwanda's Ministry of Justice (MINIJUST) as an independent project.

I wanted to explore how a traditional suggestion box could become a more useful digital service. Instead of simply collecting feedback, the platform allows people to submit ideas or concerns, track their progress, and receive responses. It also gives staff a structured way to review, assign, and resolve submissions.

## Features

For people submitting feedback, I built a way to:

- Submit suggestions or complaints, including supporting files.
- Choose anonymous, confidential, or identified submission where enabled.
- Receive a tracking code and check the status of a submission.
- Respond to follow-up questions and view replies.
- View eligible personal submissions through an account.
- Use the platform on phones, tablets, or computers, with English, Kinyarwanda, and French interface support.

For staff and administrators, I built tools to:

- Review, categorize, filter, assign, and update cases.
- Manage access for officers, department heads, and administrators.
- Prioritize submissions and coordinate through internal messages and notifications.
- View analytics and export reports.
- Manage departments, categories, staff accounts, and permission groups.
- Provide FAQ-based assistance and forward unanswered questions to staff.

## How it works

A person submits feedback and receives a tracking code. Staff can then review the submission, assign it to the appropriate department or officer, request more information, respond, and update its status. The person who submitted it can use the tracking code to follow its progress without needing a staff account.

## Technologies

I used React, JavaScript, Vite, HTML, and CSS for the frontend. The backend uses Python, Django, and Django REST Framework, with JWT authentication through SimpleJWT. The project uses SQLite for local development and supports PostgreSQL configuration.

The backend folder contains the Django application, including accounts, submissions, notifications, shared permissions, and related features. The frontend folder contains the React interface, including pages, components, and authentication context. Additional deployment guidance is available in DEPLOYMENT.md.

## Running the project locally

You will need Python, Node.js, and npm installed.

To start the backend, open PowerShell in the project folder and run:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

The backend normally runs at http://localhost:8000/. You can also run `python manage.py seed_data` to create sample departments and categories. If the command creates a demonstration administrator account, change its default password immediately.

In a second PowerShell window, start the frontend from the project root:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:5173/ or the address displayed by Vite. If needed, adjust the local environment settings in the .env files. See DEPLOYMENT.md for additional setup information.

## Privacy and security

I excluded local environment files, the SQLite database, uploaded media, and generated dependencies from this repository. The database models and migrations are included so the application can be set up locally without publishing development records.

Although I designed privacy-focused submission options, the application is a prototype. A production deployment would require further review of security, data protection, hosting, permissions, and operational requirements.

## Why I built it

This project gave me an opportunity to apply my software development skills to a practical problem. I worked on the frontend, backend, database design, access controls, and reporting features, and improved the system as I tested different workflows.

My goal was to build more than an online suggestion form. I wanted to create a platform where feedback could be followed from submission to response, making the process clearer for both the person sharing an idea and the people responsible for addressing it.