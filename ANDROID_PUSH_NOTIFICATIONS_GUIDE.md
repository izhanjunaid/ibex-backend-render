# 📱 **Android Push Notifications Implementation Guide**

## 🎯 **Overview**

This guide shows you how to implement push notifications in your Android Studio app using **Griddle** and **Firebase Cloud Messaging (FCM)**. When attendance is marked by teachers/admins, students will receive instant pop-up notifications showing their attendance status.

---

## 🏗️ **System Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Android App   │    │   Backend API    │    │  Firebase FCM   │
│   (Griddle)     │◄──►│   (Node.js)      │◄──►│   (Google)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  FCM Token      │    │  Attendance      │    │  Push           │
│  Registration   │    │  Marking         │    │  Notification   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🔧 **Backend Setup (Already Implemented)**

### **1. Database Tables Created**
- `fcm_tokens` - Stores device tokens for each user
- `notification_history` - Logs all sent notifications

### **2. API Endpoints Available**
- `POST /api/notifications/register-token` - Register FCM token
- `POST /api/notifications/unregister-token` - Unregister FCM token
- `GET /api/notifications/history` - Get notification history
- `GET /api/notifications/tokens` - Get user's active tokens

### **3. Automatic Notification Trigger**
When attendance is marked via `POST /api/attendance/bulk-mark`, the system automatically:
- Sends push notifications to all students whose attendance was marked
- Includes attendance status (Present ✅, Absent ❌, Late ⏰, Excused 📝)
- Shows grade section name and date

---

## 📱 **Android App Implementation**

### **Step 1: Firebase Setup**

#### **A. Create Firebase Project**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Add Android app to the project
4. Download `google-services.json` file

#### **B. Configure Firebase in Android Studio**
1. Place `google-services.json` in `app/` directory
2. Add Firebase dependencies to `build.gradle`:

```gradle
// app/build.gradle
dependencies {
    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    implementation 'com.google.firebase:firebase-analytics:21.5.0'
    
    // Griddle dependencies
    implementation 'com.github.griddle:griddle:1.0.0'
}
```

### **Step 2: Griddle Implementation**

#### **A. Create Notification Service**

```kotlin
// app/src/main/java/com/yourapp/services/FCMService.kt
package com.yourapp.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.yourapp.MainActivity
import com.yourapp.R

class FCMService : FirebaseMessagingService() {
    
    companion object {
        private const val CHANNEL_ID = "attendance_notifications"
        private const val CHANNEL_NAME = "Attendance Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for attendance updates"
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Register new token with backend
        registerTokenWithBackend(token)
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        // Handle notification
        remoteMessage.notification?.let { notification ->
            sendNotification(
                title = notification.title ?: "Attendance Update",
                messageBody = notification.body ?: "",
                data = remoteMessage.data
            )
        }
    }
    
    private fun sendNotification(title: String, messageBody: String, data: Map<String, String>) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            // Add notification data to intent
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
        
        notificationManager.notify(0, notificationBuilder.build())
    }
    
    private fun registerTokenWithBackend(token: String) {
        // TODO: Implement API call to register token
        // This will be implemented in the next step
    }
}
```

#### **B. Create Notification Manager**

```kotlin
// app/src/main/java/com/yourapp/managers/NotificationManager.kt
package com.yourapp.managers

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.yourapp.api.ApiService
import com.yourapp.models.FCMTokenRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class NotificationManager(private val context: Context) {
    
    private val apiService = ApiService.getInstance()
    
    suspend fun registerFCMToken() {
        try {
            // Get FCM token
            val token = FirebaseMessaging.getInstance().token.await()
            
            // Register with backend
            val request = FCMTokenRequest(
                token = token,
                deviceType = "android",
                deviceName = android.os.Build.MODEL
            )
            
            val response = withContext(Dispatchers.IO) {
                apiService.registerFCMToken(request)
            }
            
            if (response.isSuccessful) {
                println("✅ FCM token registered successfully")
            } else {
                println("❌ Failed to register FCM token")
            }
        } catch (e: Exception) {
            println("❌ Error registering FCM token: ${e.message}")
        }
    }
    
    suspend fun unregisterFCMToken(token: String) {
        try {
            val response = withContext(Dispatchers.IO) {
                apiService.unregisterFCMToken(FCMTokenRequest(token = token))
            }
            
            if (response.isSuccessful) {
                println("✅ FCM token unregistered successfully")
            } else {
                println("❌ Failed to unregister FCM token")
            }
        } catch (e: Exception) {
            println("❌ Error unregistering FCM token: ${e.message}")
        }
    }
    
    suspend fun getNotificationHistory(limit: Int = 50, offset: Int = 0) {
        try {
            val response = withContext(Dispatchers.IO) {
                apiService.getNotificationHistory(limit, offset)
            }
            
            if (response.isSuccessful) {
                val notifications = response.body()
                println("📱 Retrieved ${notifications?.notifications?.size ?: 0} notifications")
            } else {
                println("❌ Failed to get notification history")
            }
        } catch (e: Exception) {
            println("❌ Error getting notification history: ${e.message}")
        }
    }
}
```

#### **C. Create API Service**

```kotlin
// app/src/main/java/com/yourapp/api/ApiService.kt
package com.yourapp.api

import com.yourapp.models.FCMTokenRequest
import com.yourapp.models.NotificationHistoryResponse
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    
    @POST("notifications/register-token")
    suspend fun registerFCMToken(@Body request: FCMTokenRequest): Response<Any>
    
    @POST("notifications/unregister-token")
    suspend fun unregisterFCMToken(@Body request: FCMTokenRequest): Response<Any>
    
    @GET("notifications/history")
    suspend fun getNotificationHistory(
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): Response<NotificationHistoryResponse>
    
    companion object {
        private var INSTANCE: ApiService? = null
        
        fun getInstance(): ApiService {
            if (INSTANCE == null) {
                INSTANCE = RetrofitClient.createService(ApiService::class.java)
            }
            return INSTANCE!!
        }
    }
}
```

#### **D. Create Data Models**

```kotlin
// app/src/main/java/com/yourapp/models/NotificationModels.kt
package com.yourapp.models

import com.google.gson.annotations.SerializedName

data class FCMTokenRequest(
    @SerializedName("token")
    val token: String,
    
    @SerializedName("deviceType")
    val deviceType: String = "android",
    
    @SerializedName("deviceName")
    val deviceName: String? = null
)

data class NotificationHistoryResponse(
    @SerializedName("notifications")
    val notifications: List<NotificationItem>?,
    
    @SerializedName("pagination")
    val pagination: PaginationInfo?
)

data class NotificationItem(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("title")
    val title: String,
    
    @SerializedName("body")
    val body: String,
    
    @SerializedName("notification_type")
    val type: String,
    
    @SerializedName("status")
    val status: String,
    
    @SerializedName("sent_at")
    val sentAt: String,
    
    @SerializedName("data")
    val data: Map<String, String>?
)

data class PaginationInfo(
    @SerializedName("limit")
    val limit: Int,
    
    @SerializedName("offset")
    val offset: Int,
    
    @SerializedName("count")
    val count: Int
)
```

### **Step 3: Main Activity Integration**

```kotlin
// app/src/main/java/com/yourapp/MainActivity.kt
package com.yourapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.yourapp.managers.NotificationManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    
    private lateinit var notificationManager: NotificationManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        notificationManager = NotificationManager(this)
        
        // Register FCM token when app starts
        CoroutineScope(Dispatchers.Main).launch {
            notificationManager.registerFCMToken()
        }
        
        // Check if app was opened from notification
        handleNotificationIntent(intent.extras)
        
        setContent {
            // Your Griddle UI components here
            YourAppTheme {
                // Main app content
            }
        }
    }
    
    private fun handleNotificationIntent(extras: Bundle?) {
        extras?.let { bundle ->
            // Handle notification data
            val type = bundle.getString("type")
            if (type == "attendance") {
                val status = bundle.getString("status")
                val date = bundle.getString("date")
                val gradeSection = bundle.getString("grade_section_name")
                
                // Navigate to attendance screen or show attendance details
                showAttendanceDetails(status, date, gradeSection)
            }
        }
    }
    
    private fun showAttendanceDetails(status: String?, date: String?, gradeSection: String?) {
        // Implement navigation to attendance details screen
        // This will depend on your app's navigation structure
    }
}
```

### **Step 4: Android Manifest Configuration**

```xml
<!-- app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.yourapp">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme">

        <!-- Firebase Messaging Service -->
        <service
            android:name=".services.FCMService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- Main Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
```

---

## 🎨 **Griddle UI Components**

### **Notification Settings Screen**

```kotlin
// app/src/main/java/com/yourapp/ui/screens/NotificationSettingsScreen.kt
package com.yourapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yourapp.managers.NotificationManager

@Composable
fun NotificationSettingsScreen(
    notificationManager: NotificationManager
) {
    var isLoading by remember { mutableStateOf(false) }
    var notificationHistory by remember { mutableStateOf<List<NotificationItem>>(emptyList()) }
    
    LaunchedEffect(Unit) {
        isLoading = true
        notificationManager.getNotificationHistory()
        isLoading = false
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Notification Settings",
            style = MaterialTheme.typography.headlineMedium
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Notification History
        Text(
            text = "Recent Notifications",
            style = MaterialTheme.typography.titleMedium
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        if (isLoading) {
            CircularProgressIndicator()
        } else {
            LazyColumn {
                items(notificationHistory) { notification ->
                    NotificationCard(notification = notification)
                }
            }
        }
    }
}

@Composable
fun NotificationCard(notification: NotificationItem) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = notification.title,
                style = MaterialTheme.typography.titleSmall
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Text(
                text = notification.body,
                style = MaterialTheme.typography.bodyMedium
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = notification.type,
                    style = MaterialTheme.typography.bodySmall
                )
                
                Text(
                    text = notification.sentAt,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
```

---

## 🔧 **Environment Variables**

Add these to your backend environment:

```bash
# Firebase Configuration
FIREBASE_SERVER_KEY=your_firebase_server_key_here

# Backend URL (for Android app)
BACKEND_URL=https://your-backend-url.com
```

---

## 🧪 **Testing the Implementation**

### **1. Test FCM Token Registration**
```bash
curl -X POST https://your-backend.com/api/notifications/register-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test_fcm_token_123",
    "deviceType": "android",
    "deviceName": "Test Device"
  }'
```

### **2. Test Attendance Notification**
```bash
curl -X POST https://your-backend.com/api/notifications/send-attendance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_uuid_here",
    "status": "present",
    "date": "2025-01-15",
    "gradeSectionName": "Grade 10-A"
  }'
```

### **3. Test Attendance Marking (Triggers Notifications)**
```bash
curl -X POST https://your-backend.com/api/attendance/bulk-mark \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "grade_section_id": "grade_section_uuid",
    "date": "2025-01-15",
    "attendance_records": [
      {
        "student_id": "student_uuid_1",
        "status": "present"
      },
      {
        "student_id": "student_uuid_2",
        "status": "absent"
      }
    ]
  }'
```

---

## 📱 **Expected User Experience**

### **When Attendance is Marked:**

1. **Student receives pop-up notification:**
   ```
   ✅ Attendance Marked
   Hi John! Your attendance has been marked as Present 
   for 1/15/2025 in Grade 10-A.
   ```

2. **Notification appears with:**
   - ✅ Emoji for Present
   - ❌ Emoji for Absent  
   - ⏰ Emoji for Late
   - 📝 Emoji for Excused
   - Student's first name
   - Date and grade section

3. **Tapping notification:**
   - Opens the app
   - Navigates to attendance details
   - Shows full attendance information

---

## 🚀 **Deployment Checklist**

- [ ] Firebase project created and configured
- [ ] `google-services.json` added to Android project
- [ ] FCM dependencies added to `build.gradle`
- [ ] `FCMService.kt` implemented
- [ ] `NotificationManager.kt` implemented
- [ ] API service configured
- [ ] Android Manifest updated
- [ ] MainActivity integrated
- [ ] Backend environment variables set
- [ ] Database migration applied
- [ ] Supabase Edge Function deployed
- [ ] Test notifications sent successfully

---

## 🎯 **Next Steps**

1. **Implement the Android app** using the code above
2. **Test with real devices** to ensure notifications work
3. **Add notification preferences** (enable/disable, sound, vibration)
4. **Implement notification actions** (mark as read, delete)
5. **Add notification badges** for unread notifications
6. **Implement notification grouping** by date/type

This implementation provides a complete push notification system that will automatically notify students when their attendance is marked, with beautiful pop-up notifications showing their status with appropriate emojis and details!
