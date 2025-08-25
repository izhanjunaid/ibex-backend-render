# EduCore Student Android App - Technical Specification

## 📱 Project Overview

**App Name:** EduCore Student  
**Target Platform:** Android (Google Play Store)  
**Backend:** Node.js/Express REST API  
**User Role:** Students only  
**Architecture:** Native Android or React Native  

---

## 🎯 Core Features & CRUD Operations

### 1. **Authentication**
- **Login Screen** with email/password
- **Auto-login** with stored JWT token
- **Logout** functionality
- **Password change** option

### 2. **Dashboard/Home**
- Welcome message with student name
- Quick stats (assignments, grades, announcements)
- Navigation to main sections

### 3. **Grade Sections**
- **View** enrolled grade sections
- **View** section details (name, teacher, classmates)

### 4. **Assignments**
- **View** all assignments for enrolled sections
- **Filter** by section, status, due date
- **View** assignment details
- **Submit** assignments (file upload)
- **View** submission status and grades

### 5. **Homework**
- **View** homework announcements
- **Filter** by date, section
- **Mark** homework as read/completed

### 6. **Announcements**
- **View** school announcements
- **Filter** by date, importance
- **Mark** as read

### 7. **Profile Management**
- **View** student profile
- **Update** personal information
- **Change** password
- **View** academic information

### 8. **Comments System**
- **View** comments on assignments and announcements
- **Post** comments on assignments and announcements  
- **Delete** own comments
- **Real-time** comment updates with author info

### 9. **Timetable/Schedule**
- **View** class timetable/schedule
- **Filter** by day, week, month
- **Export** timetable (PDF, Excel, CSV)
- **View** enrolled classes with teacher info

### 10. **File Management**
- **Upload** assignment files
- **Download** shared files
- **View** file history

### 11. **Submission Management**
- **Submit** assignments with text and file attachments
- **Resubmit** assignments (delete and resubmit)
- **View** submission history and status
- **View** grades and teacher feedback

---

## 🔧 Technical Requirements

### **Backend Integration**
- **Base URL:** `https://your-backend-url.com/api`
- **Authentication:** JWT Bearer tokens
- **Content-Type:** `application/json`
- **File Upload:** `multipart/form-data`

### **Android Requirements**
- **Minimum SDK:** 21 (Android 5.0)
- **Target SDK:** 34 (Android 14)
- **Architecture:** MVVM with Repository pattern
- **Networking:** Retrofit2 + OkHttp
- **Local Storage:** Room Database + SharedPreferences
- **File Handling:** Android Storage Access Framework

### **UI/UX Guidelines**
- **Design System:** Material Design 3
- **Theme:** Light/Dark mode support
- **Navigation:** Bottom Navigation + Navigation Component
- **Responsive:** Support tablets and phones
- **Offline:** Cache critical data locally

---

## 🔐 Authentication Flow

### **Login Process**
```
1. User enters email/password
2. POST /api/auth/login
3. Store JWT token securely
4. Navigate to dashboard
```

### **Auto-Login**
```
1. Check stored JWT token on app start
2. Validate token with backend
3. Auto-navigate to dashboard if valid
4. Show login screen if invalid/expired
```

### **Token Management**
- Store JWT in Android Keystore (encrypted)
- Auto-refresh tokens before expiry
- Handle 401 responses (redirect to login)

---

## 📡 API Endpoints Reference

### **Authentication**
```http
POST /api/auth/login
Body: {"email": "student@ibex.com", "password": "ibex123"}
Response: {"success": true, "token": "JWT...", "user": {...}}
```

### **Student Profile**
```http
GET /api/users/:id
Headers: Authorization: Bearer JWT_TOKEN
Response: {"id": "...", "first_name": "...", "role": "student", ...}
```

### **Grade Sections**
```http
GET /api/grade-sections
Headers: Authorization: Bearer JWT_TOKEN
Response: [{"id": "...", "name": "Grade 8 A", "teacher": {...}, ...}]
```

### **Assignments**
```http
GET /api/assignments
Headers: Authorization: Bearer JWT_TOKEN
Response: [{"id": "...", "title": "Math Homework", "due_date": "...", ...}]

POST /api/submissions
Headers: Authorization: Bearer JWT_TOKEN
Body: {"assignment_id": "...", "content": "...", "files": [...]}
```

### **Homework**
```http
GET /api/homework
Headers: Authorization: Bearer JWT_TOKEN
Response: [{"id": "...", "title": "...", "homework_date": "...", ...}]
```

### **Announcements**
```http
GET /api/announcements
Headers: Authorization: Bearer JWT_TOKEN
Response: [{"id": "...", "title": "...", "content": "...", "created_at": "..."}]
```

### **Comments**
```http
GET /api/comments/:type/:id
Headers: Authorization: Bearer JWT_TOKEN
Response: [{"id": "...", "content": "...", "author": {...}, "created_at": "..."}]

POST /api/comments
Headers: Authorization: Bearer JWT_TOKEN
Body: {"parentType": "assignment", "parentId": "...", "content": "..."}
Response: {"id": "...", "content": "...", "author": {...}}

DELETE /api/comments/:id
Headers: Authorization: Bearer JWT_TOKEN
Response: {"message": "Deleted"}
```

### **Timetable**
```http
GET /api/timetable
Headers: Authorization: Bearer JWT_TOKEN
Response: {"success": true, "data": [...], "weekStart": "..."}

GET /api/timetable/export?format=pdf
Headers: Authorization: Bearer JWT_TOKEN
Response: {"success": true, "data": {...}, "exportUrl": "..."}
```

### **Submissions**
```http
POST /api/submissions
Headers: Authorization: Bearer JWT_TOKEN
Content-Type: multipart/form-data
Body: FormData with assignmentId, text, and files
Response: {"submission": {"id": "...", "status": "submitted", ...}}

DELETE /api/submissions/:assignmentId/self
Headers: Authorization: Bearer JWT_TOKEN
Response: {"message": "Submission deleted - you can now resubmit"}

GET /api/submissions/student/:assignmentId
Headers: Authorization: Bearer JWT_TOKEN
Response: {"submission": {"grade": "...", "feedback": "...", ...}}
```

### **File Upload**
```http
POST /api/files/upload
Headers: Authorization: Bearer JWT_TOKEN
Content-Type: multipart/form-data
Body: FormData with file
Response: {"success": true, "file": {"id": "...", "url": "..."}}
```

---

## 🎨 Screen Specifications

### **1. Login Screen**
- Email input field
- Password input field (with show/hide toggle)
- Login button
- "Forgot Password?" link (if implemented)
- Loading indicator
- Error message display

### **2. Dashboard/Home Screen**
- Header with student name and profile picture
- Stats cards (pending assignments, new announcements)
- Quick action buttons
- Recent activity feed
- Navigation drawer/bottom nav

### **3. Grade Sections Screen**
- List of enrolled sections
- Section cards showing:
  - Section name (e.g., "Grade 8 A")
  - Teacher name
  - Number of students
  - Recent activity

### **4. Assignments Screen**
- Tab layout: All | Pending | Submitted | Graded
- Assignment cards showing:
  - Title and description
  - Due date with countdown
  - Subject/section
  - Status badge
- Floating Action Button for quick submission
- Search and filter options

### **5. Assignment Detail Screen**
- Full assignment description
- Due date and time
- Attachments/resources
- Submission section:
  - Text input area
  - File attachment button
  - Submit button
- Previous submissions (if any)
- Grade and feedback (if graded)

### **6. Homework Screen**
- Calendar view option
- List view with homework items
- Filter by date range and section
- Mark as completed checkbox
- Homework detail view

### **7. Announcements Screen**
- List of announcements (newest first)
- Announcement cards with:
  - Title and preview
  - Date and time
  - Read/unread indicator
  - Priority badge (if important)
- Pull-to-refresh
- Search functionality

### **8. Comments Screen**
- Comments list for assignments/announcements
- Comment composer with text input
- Author profile pictures and names
- Timestamp display
- Delete option for own comments
- Real-time updates

### **9. Timetable Screen**
- Weekly calendar view
- Daily schedule list
- Class cards showing:
  - Subject name
  - Teacher name
  - Time and duration
  - Classroom/location
- Export options (PDF, Excel, CSV)
- Week navigation

### **10. Submission Detail Screen**
- Assignment information
- Previous submission display
- Grade and feedback (if graded)
- Resubmit option
- File attachments view
- Submission history

### **11. Profile Screen**
- Profile picture (editable)
- Personal information display/edit
- Academic information (read-only)
- Settings section:
  - Change password
  - Notification preferences
  - Theme selection
  - Logout button

---

## 📱 App Architecture

### **Recommended Structure**
```
app/
├── data/
│   ├── api/          # Retrofit API interfaces
│   ├── database/     # Room database
│   ├── repository/   # Data repositories
│   └── models/       # Data models/DTOs
├── ui/
│   ├── auth/         # Login screens
│   ├── dashboard/    # Home screen
│   ├── assignments/  # Assignment screens
│   ├── homework/     # Homework screens
│   ├── profile/      # Profile screens
│   └── common/       # Shared UI components
├── utils/
│   ├── Constants.kt
│   ├── NetworkUtils.kt
│   └── DateUtils.kt
└── di/               # Dependency injection
```

### **Key Libraries**
```gradle
// Networking
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
implementation 'com.squareup.okhttp3:logging-interceptor:4.11.0'

// Database
implementation 'androidx.room:room-runtime:2.5.0'
implementation 'androidx.room:room-ktx:2.5.0'

// UI
implementation 'androidx.navigation:navigation-fragment-ktx:2.7.1'
implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0'
implementation 'com.google.android.material:material:1.9.0'

// Image loading
implementation 'com.github.bumptech.glide:glide:4.15.1'

// File handling
implementation 'androidx.activity:activity-ktx:1.7.2'
```

---

## 🔄 Data Flow & State Management

### **Repository Pattern**
```kotlin
class AssignmentRepository(
    private val apiService: ApiService,
    private val localDatabase: AppDatabase
) {
    suspend fun getAssignments(): Flow<List<Assignment>> {
        // 1. Return cached data immediately
        // 2. Fetch from API in background
        // 3. Update local cache
        // 4. Emit updated data
    }
}
```

### **ViewModel Example**
```kotlin
class AssignmentViewModel(
    private val repository: AssignmentRepository
) : ViewModel() {
    
    private val _assignments = MutableLiveData<List<Assignment>>()
    val assignments: LiveData<List<Assignment>> = _assignments
    
    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading
    
    fun loadAssignments() {
        viewModelScope.launch {
            _loading.value = true
            try {
                repository.getAssignments().collect {
                    _assignments.value = it
                }
            } catch (e: Exception) {
                // Handle error
            } finally {
                _loading.value = false
            }
        }
    }
}
```

---

## 🔒 Security Considerations

### **Data Protection**
- Store JWT tokens in Android Keystore
- Use HTTPS for all API calls
- Implement certificate pinning
- Validate all user inputs
- Handle sensitive data securely

### **Error Handling**
- Network connectivity checks
- Graceful offline mode
- User-friendly error messages
- Retry mechanisms for failed requests
- Crash reporting (Firebase Crashlytics)

---

## 📊 Analytics & Monitoring

### **Recommended Tools**
- **Firebase Analytics** - User behavior tracking
- **Firebase Crashlytics** - Crash reporting
- **Firebase Performance** - App performance monitoring

### **Key Metrics to Track**
- User engagement (daily/monthly active users)
- Feature usage (assignments, homework, announcements)
- App performance (load times, crashes)
- User retention rates

---

## 🚀 Deployment & Distribution

### **Build Configuration**
```gradle
android {
    compileSdk 34
    
    defaultConfig {
        applicationId "com.yourcompany.educore.student"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
            buildConfigField "String", "API_BASE_URL", "\"https://your-api.com/api\""
        }
        debug {
            buildConfigField "String", "API_BASE_URL", "\"http://localhost:5000/api\""
        }
    }
}
```

### **Google Play Store Requirements**
- **Target API Level:** 33+ (required by Google Play)
- **App Bundle:** Use Android App Bundle (.aab) format
- **Privacy Policy:** Required for apps handling user data
- **Content Rating:** Educational category
- **App Signing:** Enable Google Play App Signing

---

## 📋 Testing Strategy

### **Unit Tests**
- Repository layer tests
- ViewModel tests
- Utility function tests

### **Integration Tests**
- API integration tests
- Database tests
- Authentication flow tests

### **UI Tests**
- Critical user journey tests
- Login/logout flow
- Assignment submission flow

---

## 📅 Development Timeline

### **Phase 1: Foundation (2-3 weeks)**
- Project setup and architecture
- Authentication implementation
- Basic UI framework
- API integration setup

### **Phase 2: Core Features (3-4 weeks)**
- Dashboard implementation
- Grade sections view
- Assignments CRUD
- Homework view

### **Phase 3: Enhanced Features (2-3 weeks)**
- File upload/download
- Announcements
- Profile management
- Offline support

### **Phase 4: Polish & Testing (1-2 weeks)**
- UI/UX improvements
- Performance optimization
- Testing and bug fixes
- Play Store preparation

---

## 📞 Support & Resources

### **Backend API Documentation**
- Base URL: `https://your-backend-url.com/api`
- Authentication: JWT Bearer tokens
- All endpoints return JSON responses
- Error responses include error codes and messages

### **Design Assets**
- App icon (1024x1024 PNG)
- Splash screen assets
- Color palette and typography
- UI mockups/wireframes

### **Contact Information**
- **Backend Developer:** [Your contact]
- **Project Manager:** [PM contact]
- **API Issues:** [Support email]

---

## ✅ Acceptance Criteria

### **Functional Requirements**
- [ ] Students can login with email/password
- [ ] Students can view their enrolled grade sections
- [ ] Students can view and submit assignments
- [ ] Students can view homework announcements
- [ ] Students can view school announcements
- [ ] Students can post and view comments on assignments/announcements
- [ ] Students can view their class timetable/schedule
- [ ] Students can export timetable in different formats
- [ ] Students can resubmit assignments
- [ ] Students can view grades and feedback
- [ ] Students can update their profile
- [ ] Students can upload and download files
- [ ] App works offline with cached data

### **Non-Functional Requirements**
- [ ] App loads within 3 seconds on average devices
- [ ] Works on Android 5.0+ devices
- [ ] Supports both portrait and landscape orientations
- [ ] Follows Material Design guidelines
- [ ] Handles network errors gracefully
- [ ] Data is cached for offline access
- [ ] App passes Google Play Store review

---

## 🎯 Success Metrics

- **User Adoption:** 80%+ of students use the app monthly
- **Engagement:** Average session duration > 5 minutes
- **Performance:** App crash rate < 1%
- **Ratings:** 4.0+ stars on Google Play Store
- **Retention:** 70%+ users return after 7 days

---

*This document should be reviewed and updated as the project progresses. For technical questions or clarifications, please contact the backend development team.*