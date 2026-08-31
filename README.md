# StudyOS - All-in-One Student Learning App

An intelligent study management system that combines document management, class scheduling, assignment tracking, and AI-powered study planning.

## Features

### 1. **Authentication** 
- Email/password signup and login with Supabase Auth
- Secure session management
- Automatic redirect to dashboard on successful login

### 2. **Document Management**
- Upload study materials (PDFs, images)
- Store files securely in Supabase Storage
- View upload history with timestamps and file sizes
- Delete documents easily

### 3. **Timetable Management**
- Schedule classes for each day of the week
- Track class times, subjects, and locations
- Visual weekly view
- Add/delete classes with ease

### 4. **Assignment Tracking**
- Create assignments with title, subject, deadline, difficulty, and estimated hours
- Track completion status
- Color-coded urgency indicators (red = overdue, orange = 1-3 days, yellow = 1-7 days, green = 7+ days)
- Separate view for pending and completed assignments

### 5. **AI-Powered Study Plan Generator** ⭐
- Generates intelligent study schedules using Groq API (Mixtral model)
- Considers your timetable and pending assignments
- Prioritizes based on deadline urgency and difficulty
- Provides recommended study duration for each task
- Adapts to your schedule automatically

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **AI/ML**: Groq API (Mixtral 8x7B)
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for database and storage)
- Groq API key

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sportsngamesfan-art/StudyOS.git
   cd StudyOS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file based on `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Fill in your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   GROQ_API_KEY=your-groq-api-key
   ```

4. **Set up Supabase Database**
   
   In your Supabase dashboard, create these tables:
   
   **documents table:**
   ```sql
   CREATE TABLE documents (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users NOT NULL,
     filename text NOT NULL,
     file_path text NOT NULL,
     file_size integer NOT NULL,
     created_at timestamp DEFAULT now()
   );
   ```
   
   **timetable table:**
   ```sql
   CREATE TABLE timetable (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users NOT NULL,
     subject text NOT NULL,
     day text NOT NULL,
     start_time text NOT NULL,
     end_time text NOT NULL,
     room text,
     created_at timestamp DEFAULT now()
   );
   ```
   
   **assignments table:**
   ```sql
   CREATE TABLE assignments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users NOT NULL,
     title text NOT NULL,
     subject text NOT NULL,
     deadline date NOT NULL,
     difficulty text NOT NULL,
     hours_required float NOT NULL,
     completed boolean DEFAULT false,
     created_at timestamp DEFAULT now()
   );
   ```

5. **Set up Supabase Storage**
   
   Create a bucket named `documents` in Supabase Storage for file uploads.

6. **Run the development server**
   ```bash
   npm run dev
   ```
   
   Open http://localhost:3000 in your browser.

## Project Structure

```
StudyOS/
├── app/
│   ├── api/
│   │   └── generate-study-plan/    # Groq API integration
│   │       └── route.ts
│   ├── auth/
│   │   └── page.tsx               # Login/signup page
│   ├── dashboard/
│   │   ├── layout.tsx             # Dashboard sidebar & auth guard
│   │   ├── page.tsx               # Dashboard overview
│   │   ├── documents/
│   │   │   └── page.tsx           # Document upload & management
│   │   ├── timetable/
│   │   │   └── page.tsx           # Class scheduling
│   │   ├── assignments/
│   │   │   └── page.tsx           # Assignment tracking
│   │   └── plan/
│   │       └── page.tsx           # Study plan generator
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Home page
├── lib/
│   ├── supabase.ts               # Supabase client
│   └── groq.ts                   # Groq client
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── next.config.js
```

## Usage Guide

### Authentication
1. Click "Get Started" on the home page
2. Sign up with email and password
3. Confirm your email (check spam folder)
4. Log in with your credentials

### Documents
1. Go to Documents from the sidebar
2. Click file input to upload PDFs or images
3. View all uploaded files in the list
4. Click "Delete" to remove files

### Timetable
1. Go to Timetable from the sidebar
2. Click "+ Add Class"
3. Fill in subject, day, time, and room
4. Classes appear in the weekly view
5. Click "Delete" to remove a class

### Assignments
1. Go to Assignments from the sidebar
2. Click "+ Add Assignment"
3. Enter title, subject, deadline, difficulty, and hours
4. Click "✓ Done" to mark complete
5. Click "Undo" to revert completion status
6. Assignments color-coded by urgency

### Study Plan
1. Go to Study Plan from the sidebar
2. Make sure you have assignments and/or classes added
3. Click "🤖 Generate Plan"
4. AI generates a smart study schedule for the next week
5. Study sessions organized by date with priority levels

## API Endpoints

### POST `/api/generate-study-plan`
Generates an AI-powered study plan.

**Request:**
```json
{
  "prompt": "Study plan generation prompt"
}
```

**Response:**
```json
{
  "plan": [
    {
      "date": "2024-09-01",
      "subject": "Mathematics",
      "duration": 2,
      "task": "Chapter 5: Algebra review",
      "priority": "high"
    }
  ]
}
```

## Error Handling

- **Auth errors**: Check Supabase credentials and network connection
- **Upload errors**: Verify file type (PDF/images only) and size
- **Study plan errors**: Ensure Groq API key is valid and you have assignments/classes
- **Database errors**: Check Supabase connection and table permissions

## Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Type Check
```bash
npx tsc --noEmit
```

## Deployment

The app is configured for easy deployment on Vercel:

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel settings
4. Deploy with `vercel deploy`

## Security

- All auth handled by Supabase
- API keys stored in environment variables
- Database access restricted to authenticated users
- File uploads validated by type and size

## Future Enhancements

- [ ] Study notes feature
- [ ] Quiz generation from notes
- [ ] Collaborative study groups
- [ ] Mobile app
- [ ] Integration with calendar apps
- [ ] Email reminders for deadlines
- [ ] Analytics dashboard
- [ ] Multiple study plan strategies

## Contributing

Contributions welcome! Please create a branch and submit a pull request.

## License

MIT