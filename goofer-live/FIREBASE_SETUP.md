# Firebase Admin Panel Setup Guide

This guide will help you set up Firebase authentication and database for your admin panel.

## Step 1: Install Firebase

Run this command in your project directory:

```bash
npm install firebase
```

## Step 2: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name (e.g., "goofer-live")
4. Disable Google Analytics (optional)
5. Click "Create Project"

## Step 3: Enable Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click "Get Started"
3. Go to **Sign-in method** tab
4. Enable **Email/Password** authentication
5. Click "Save"

## Step 4: Create Admin User

1. Go to **Authentication** → **Users** tab
2. Click "Add user"
3. Enter your email and password
4. Click "Add user"
5. **Save these credentials** - you'll use them to login

## Step 5: Set Up Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (we'll set rules next)
4. Select your preferred location
5. Click "Enable"

## Step 6: Configure Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write schedule
    match /settings/schedule {
      allow read: if true;  // Anyone can read the schedule
      allow write: if request.auth != null;  // Only authenticated users can write
    }
  }
}
```

3. Click "Publish"

## Step 7: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the **Web icon** (`</>`)
4. Register your app (name it "goofer-live-web")
5. Copy the Firebase configuration object

## Step 8: Add Environment Variables

1. Create a `.env.local` file in your project root
2. Add your Firebase configuration:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

3. Replace the values with your actual Firebase config values

## Step 9: Update Your App.js

You need to integrate the admin panel into your app. Update your main App.js file:

```jsx
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminSchedulePage from './pages/AdminSchedulePage';

// Add 'admin' to your page states
const [page, setPage] = useState('home'); // Can be: 'home', 'schedule', 'admin', etc.

// Add route handling for admin
{page === 'admin' && !currentUser && (
  <AdminLoginPage onLoginSuccess={() => setPage('admin-schedule')} />
)}

{page === 'admin-schedule' && currentUser && (
  <AdminSchedulePage onLogout={() => setPage('home')} />
)}
```

## Step 10: Add Admin Link to Navigation

Add an admin link to your navigation (only visible to you):

```jsx
// In Navigation.js, add to navItems:
{ id: 'admin', label: 'ADMIN' }
```

Or create a hidden admin route by visiting `/admin` or `?page=admin`

## Step 11: Use Firebase Schedule in Your App

Update components that use the schedule to fetch from Firebase:

```jsx
import { useSchedule } from './hooks/useSchedule';

function YourComponent() {
  const { schedule, loading } = useSchedule();

  // Use schedule data
  // It will automatically update in real-time when you edit it in the admin panel!
}
```

## How It Works

1. **Login**: Visit the admin page and login with your email/password
2. **Edit Schedule**: Change stream times, games, content, and status
3. **Save**: Click "Save Schedule" - changes are saved to Firebase
4. **Real-time Updates**: Your website immediately reflects the changes (no code deploy needed!)

## Deployment Notes

### For Vercel:
1. Go to your project settings
2. Add all `REACT_APP_FIREBASE_*` environment variables
3. Redeploy your site

### For Netlify:
1. Go to Site settings → Build & deploy → Environment
2. Add all `REACT_APP_FIREBASE_*` environment variables
3. Redeploy your site

## Security Best Practices

- **Never commit `.env.local`** to git
- Keep your admin credentials secure
- Consider adding 2FA to your Firebase account
- Regularly review Firestore security rules
- Monitor authentication logs in Firebase Console

## Troubleshooting

**"Firebase: Error (auth/wrong-password)"**
- Double-check your email and password
- Make sure Email/Password auth is enabled in Firebase

**"Missing or insufficient permissions"**
- Check Firestore security rules
- Make sure you're logged in when editing

**Schedule not updating**
- Check browser console for errors
- Verify Firebase config in .env.local
- Make sure Firestore is initialized properly

## Support

If you run into issues:
1. Check the Firebase Console for error logs
2. Check your browser console (F12)
3. Verify all environment variables are set correctly
